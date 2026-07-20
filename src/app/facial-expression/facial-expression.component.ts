import {Component, TemplateRef, ViewChild} from "@angular/core";
import {FormControl, Validators} from "@angular/forms";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {CdkDragDrop} from "@angular/cdk/drag-drop";
import {Observable, from, map} from "rxjs";
import {MatSnackBar} from "@angular/material/snack-bar";
import {TranslateService} from "@ngx-translate/core";
import {FacialExpressionService} from "src/app/shared/services/facial-expression.service";
import {FacialExpression} from "src/app/shared/types/facial-expression";

/**
 * Verwaltungsseite fuer benutzerdefinierte Gesichtsausdruecke: eigene
 * GIF-Dateien hochladen, als Kacheln anzeigen, umbenennen/loeschen/GIF
 * austauschen und per Drag&Drop sortieren. Die hier angelegten Ausdruecke
 * erscheinen zusaetzlich zu den fest einprogrammierten Emotionen auf der
 * Posen-Seite (siehe pose.component.ts).
 */
@Component({
    selector: "app-facial-expression",
    templateUrl: "./facial-expression.component.html",
    styleUrls: ["./facial-expression.component.scss"],
})
export class FacialExpressionComponent {
    @ViewChild("renameModalContent") renameModalContent!: TemplateRef<unknown>;

    expressions$: Observable<FacialExpression[]>;

    newNameFormControl = new FormControl("", [
        Validators.required,
        Validators.minLength(1),
    ]);
    newGifFile: File | null = null;
    creating = false;

    modalTitle = "";
    nameFormControl = new FormControl("", [
        Validators.required,
        Validators.minLength(1),
    ]);

    constructor(
        private facialExpressionService: FacialExpressionService,
        private modalService: NgbModal,
        private matSnackBarService: MatSnackBar,
        private translateService: TranslateService,
    ) {
        this.expressions$ = this.facialExpressionService.expressionsSubject;
    }

    previewUrl(expression: FacialExpression): string {
        return this.facialExpressionService.previewUrl(expression.expressionId);
    }

    onNewGifSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        this.newGifFile = file ?? null;
    }

    createExpression(): void {
        if (this.newNameFormControl.invalid || !this.newGifFile) {
            return;
        }
        this.creating = true;
        this.facialExpressionService
            .create(this.newNameFormControl.value!, this.newGifFile)
            .subscribe({
                next: () => {
                    this.creating = false;
                    this.newNameFormControl.setValue("");
                    this.newGifFile = null;
                },
                error: (err) => {
                    this.creating = false;
                    this.toast(this.errorMessage(err));
                },
            });
    }

    dropExpression(event: CdkDragDrop<FacialExpression[]>): void {
        if (event.previousIndex === event.currentIndex) {
            return;
        }
        this.facialExpressionService.reorder(
            event.previousIndex,
            event.currentIndex,
        );
    }

    renameExpression(expression: FacialExpression): void {
        this.modalTitle = this.translateService.instant(
            "facialExpression.renameTitle",
        );
        this.nameFormControl.setValue(expression.name);
        from(
            this.modalService.open(this.renameModalContent, {
                ariaLabelledBy: "rename-facial-expression",
                size: "sm",
                windowClass: "cerebra-modal",
                backdropClass: "cerebra-modal-backdrop",
            }).result,
        )
            .pipe(
                map(() => {
                    if (!this.nameFormControl.valid) {
                        throw new Error("invalid name");
                    }
                    return this.nameFormControl.value!;
                }),
            )
            .subscribe({
                next: (name) => {
                    this.facialExpressionService
                        .rename(expression.expressionId, name)
                        .subscribe({
                            error: (err) => this.toast(this.errorMessage(err)),
                        });
                },
                error: () => {
                    /* modal dismissed - nothing to do */
                },
            });
    }

    replaceGif(expression: FacialExpression, event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
            return;
        }
        this.facialExpressionService
            .replaceGif(expression.expressionId, file)
            .subscribe({
                next: () => {
                    // cache-bust the <img> preview, the filename stays the same
                    this.facialExpressionService.loadExpressions();
                },
                error: (err) => this.toast(this.errorMessage(err)),
            });
        (event.target as HTMLInputElement).value = "";
    }

    deleteExpression(expression: FacialExpression): void {
        this.facialExpressionService.delete(expression.expressionId).subscribe();
    }

    private errorMessage(err: unknown): string {
        const message = (err as {error?: {error?: string}})?.error?.error;
        return message ?? this.translateService.instant("common.unknownError");
    }

    private toast(message: string): void {
        this.matSnackBarService.open(message, "", {
            panelClass: "cerebra-toast",
            duration: 3500,
        });
    }
}
