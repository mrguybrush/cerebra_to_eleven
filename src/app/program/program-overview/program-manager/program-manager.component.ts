import {
    OnInit,
    Component,
    ViewChild,
    TemplateRef,
    AfterViewInit,
} from "@angular/core";

import {Observable, Subject} from "rxjs";
import {NgbModal, NgbModalRef} from "@ng-bootstrap/ng-bootstrap";
import {FormControl, Validators} from "@angular/forms";
import {ActivatedRoute, NavigationEnd, Router} from "@angular/router";
import {Program} from "../../../shared/types/program";
import {SidebarElement} from "../../../shared/interfaces/sidebar-element.interface";
import {ProgramService} from "../../../shared/services/program.service";
import {MatSnackBar} from "@angular/material/snack-bar";
import {
    downloadJson,
    pickJsonFile,
    safeFilename,
} from "../../../shared/services/file-transfer.util";
import {map, switchMap} from "rxjs/operators";
import {TranslateService} from "@ngx-translate/core";

// Marker + shape of an exported program file, so imports can be validated.
const PROGRAM_EXPORT_KIND = "pib-program";

// localStorage key for the last opened program - navigating away from the
// editor and back re-opens that program instead of always the first one.
const LAST_PROGRAM_KEY = "pib-last-program-number";
interface ProgramExport {
    kind: string;
    name: string;
    codeVisual: string;
}

@Component({
    selector: "app-program-manager",
    templateUrl: "./program-manager.component.html",
    styleUrls: ["./program-manager.component.scss"],
})
export class ProgramManagerComponent implements OnInit, AfterViewInit {
    @ViewChild("modalContent") modalContent: TemplateRef<any> | undefined;
    closeResult!: string;
    ngbModalRef?: NgbModalRef;
    subject!: Observable<SidebarElement[]>;
    nameFormControl: FormControl = new FormControl("");
    program: Program | undefined;
    selected: Subject<string> = new Subject();

    constructor(
        private modalService: NgbModal,
        private router: Router,
        private route: ActivatedRoute,
        private programService: ProgramService,
        private snackBar: MatSnackBar,
        private readonly translateService: TranslateService,
    ) {}

    ngOnInit(): void {
        this.subject = this.programService.programsSubject;
        this.nameFormControl.setValidators([
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(255),
        ]);
        // Remember which program the user last opened (sidebar clicks
        // navigate to /program/<number>), so re-entering the editor
        // restores it instead of falling back to the first program.
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                const match = event.urlAfterRedirects.match(
                    /\/program\/([^/?#]+)/,
                );
                if (match) {
                    localStorage.setItem(LAST_PROGRAM_KEY, match[1]);
                }
            }
        });
    }

    ngAfterViewInit() {
        this.route.url.subscribe((_segments) => {
            this.programService.getAllPrograms().subscribe((programs) => {
                const last = localStorage.getItem(LAST_PROGRAM_KEY);
                const restored = programs.find((p) => p.getUUID() === last);
                this.selected.next((restored ?? programs[0])?.getUUID());
            });
        });
    }

    getProgramFromRoute(): Program | undefined {
        const programNumber: string | undefined = this.router.url
            .split("/")
            .pop();
        if (!programNumber) return;
        return this.programService.getProgramFromCache(programNumber);
    }

    showModal(): Promise<string> {
        return this.modalService.open(this.modalContent, {
            ariaLabelledBy: "modal-basic-title",
            size: "sm",
            windowClass: "cerebra-modal",
            backdropClass: "cerebra-modal-backdrop",
        }).result;
    }

    addProgram() {
        this.nameFormControl.setValue("");
        this.showModal().then(() => {
            if (this.nameFormControl.valid) {
                this.programService
                    .createProgram(new Program(this.nameFormControl.value))
                    .subscribe((program) =>
                        this.selected.next(program.programNumber),
                    );
            }
        });
    }

    editProgram(uuid: string = "") {
        const program$ = this.programService.getProgramByProgramNumber(uuid);
        program$.subscribe((program) => {
            if (!program) return;

            this.nameFormControl.setValue(program.name);

            this.showModal().then(() => {
                if (this.nameFormControl.valid) {
                    program.name = this.nameFormControl.value;
                    this.programService.updateProgramByProgramNumber(program);
                }
            });
        });
    }

    deleteProgram(uuid: string = "") {
        this.programService.deleteProgramByProgramNumber(uuid).subscribe(() => {
            this.selected.next(this.programService.programs[0]?.getUUID());
        });
    }

    exportProgram(uuid: string = "") {
        const program = this.programService.getProgramFromCache(uuid);
        this.programService.getCodeByProgramNumber(uuid).subscribe((code) => {
            const data: ProgramExport = {
                kind: PROGRAM_EXPORT_KIND,
                name: program?.name ?? "program",
                codeVisual: code.codeVisual,
            };
            downloadJson(`programm_${safeFilename(data.name)}`, data);
        });
    }

    importProgram() {
        pickJsonFile()
            .then((raw) => {
                if (!raw) return;
                const data = raw as ProgramExport;
                if (data.kind !== PROGRAM_EXPORT_KIND || typeof data.name !== "string") {
                    throw new Error(
                        this.translateService.instant("programManager.invalidProgramFile"),
                    );
                }
                // Create the program, then attach its visual code.
                this.programService
                    .createProgram(new Program(data.name))
                    .pipe(
                        switchMap((program) =>
                            this.programService
                                .updateCodeByProgramNumber(program.programNumber, {
                                    codeVisual: data.codeVisual ?? "{}",
                                })
                                .pipe(map(() => program)),
                        ),
                    )
                    .subscribe((program) => {
                        this.selected.next(program.programNumber);
                        this.snackBar.open(
                            this.translateService.instant("programManager.programImported"),
                            "",
                            {panelClass: "cerebra-toast", duration: 3000},
                        );
                    });
            })
            .catch((err) =>
                this.snackBar.open(String(err.message ?? err), "", {
                    panelClass: "cerebra-toast",
                    duration: 4000,
                }),
            );
    }

    optionCallbackMethods = [
        {
            icon: "",
            label: this.translateService.instant("programManager.newProgram"),
            clickCallback: this.addProgram.bind(this),
            disabled: false,
        },
        {
            icon: "",
            label: this.translateService.instant("programManager.importProgram"),
            clickCallback: this.importProgram.bind(this),
            disabled: false,
        },
    ];

    dropdownCallbackMethods = [
        {
            icon: "../../assets/edit.svg",
            label: this.translateService.instant("common.rename"),
            clickCallback: this.editProgram.bind(this),
            disabled: false,
        },
        {
            icon: "../../assets/export.svg",
            label: this.translateService.instant("common.export"),
            clickCallback: this.exportProgram.bind(this),
            disabled: false,
        },
        {
            icon: "../../assets/delete.svg",
            label: this.translateService.instant("common.delete"),
            clickCallback: this.deleteProgram.bind(this),
            disabled: false,
        },
    ];
}
