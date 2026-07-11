import {
    Component,
    ElementRef,
    OnInit,
    QueryList,
    TemplateRef,
    ViewChild,
    ViewChildren,
} from "@angular/core";
import {FormControl, Validators} from "@angular/forms";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {Observable, concatMap, from, map} from "rxjs";
import {PoseService} from "src/app/shared/services/pose.service";
import {Pose} from "src/app/shared/types/pose";
import {MatSnackBar} from "@angular/material/snack-bar";
import {GestureService} from "src/app/shared/services/gesture.service";
import {MovementSequenceService} from "src/app/shared/services/movement-sequence.service";
import {
    CaptureMode,
    GestureCaptureService,
} from "src/app/shared/services/gesture-capture.service";
import {
    BrowserPoseTrackerService,
    NamedLandmark,
    PoseSource,
} from "src/app/shared/services/browser-pose-tracker.service";
import {Gesture} from "src/app/shared/types/gesture";
import {MovementSequence} from "src/app/shared/types/movement-sequence";
import {MotorPosition} from "src/app/shared/types/motor-position";
import {
    downloadJson,
    pickJsonFile,
    safeFilename,
} from "src/app/shared/services/file-transfer.util";

const GESTURE_EXPORT_KIND = "pib-gesture";
const SEQUENCE_EXPORT_KIND = "pib-movement-sequence";
const POSE_EXPORT_KIND = "pib-pose";
const POSE_COLLECTION_EXPORT_KIND = "pib-pose-collection";

@Component({
    selector: "app-pose",
    templateUrl: "./pose.component.html",
    styleUrls: ["./pose.component.css"],
})
export class PoseComponent implements OnInit {
    @ViewChild("modalContent") modalContent: TemplateRef<any> | undefined;
    @ViewChild("deleteAllModalContent") deleteAllModalContent:
        | TemplateRef<any>
        | undefined;
    @ViewChildren("renameButton") renameButtons:
        | QueryList<ElementRef<HTMLButtonElement>>
        | undefined;
    @ViewChild("previewCanvas") previewCanvas?: ElementRef<HTMLCanvasElement>;

    poses!: Observable<Pose[]>;
    gestures!: Observable<Gesture[]>;
    sequences!: Observable<MovementSequence[]>;

    modalTitle = "";

    nameFormControl: FormControl<string | null> = new FormControl("", {
        validators: [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(255),
        ],
    });

    selectedPoseId?: string;

    // Camera-based gesture/movement-sequence capture is temporarily hidden
    // (still fully implemented underneath) until it's ready for general use.
    showGestureFeatures = false;

    // Safety check for "delete all poses": the user must solve a (deliberately
    // annoying) mental-arithmetic task before the delete button unlocks.
    mathQuestion = "";
    mathAnswerControl: FormControl<string | null> = new FormControl("");
    private mathExpectedAnswer = 0;

    // Gesture control (see plan: "Gestensteuerung" section on this page)
    captureMode: CaptureMode = "static";
    captureDurationS = 5;
    poseSource: PoseSource = "robot";
    capturing$: Observable<boolean>;
    remainingSeconds$: Observable<number>;
    jointAngles$: Observable<{[motorName: string]: number}>;
    poseTrackerError$: Observable<string | null>;
    // Debug counters (see browser-pose-tracker.service.ts) - shown directly
    // in the page so this can be diagnosed without browser devtools access.
    framesReceived$: Observable<number>;
    framesDrawn$: Observable<number>;
    landmarkerReady$: Observable<boolean>;
    rawFrame$: Observable<string | null>;

    private previewImage = new Image();

    constructor(
        private poseService: PoseService,
        private gestureService: GestureService,
        private movementSequenceService: MovementSequenceService,
        private gestureCaptureService: GestureCaptureService,
        private browserPoseTrackerService: BrowserPoseTrackerService,
        private modalService: NgbModal,
        private matSnackBarService: MatSnackBar,
    ) {
        this.capturing$ = this.gestureCaptureService.capturing$;
        this.jointAngles$ = this.browserPoseTrackerService.jointAngles$;
        this.poseTrackerError$ = this.browserPoseTrackerService.error$;
        this.remainingSeconds$ = this.gestureCaptureService.remainingSeconds$;
        this.framesReceived$ = this.browserPoseTrackerService.framesReceived$;
        this.framesDrawn$ = this.browserPoseTrackerService.framesDrawn$;
        this.landmarkerReady$ = this.browserPoseTrackerService.landmarkerReady$;
        this.rawFrame$ = this.browserPoseTrackerService.frame$;
    }

    ngOnInit(): void {
        this.poses = this.poseService.getPosesObservable();
        this.gestures = this.gestureService.getGesturesObservable();
        this.sequences = this.movementSequenceService.getSequencesObservable();

        this.browserPoseTrackerService.frame$.subscribe((dataUrl) => {
            if (dataUrl) {
                this.drawPreview(dataUrl);
            }
        });

        this.gestureCaptureService.captureResult$.subscribe((result) => {
            this.browserPoseTrackerService.stop();
            if (!result) {
                return;
            }
            if (result.mode === "static" && result.positions) {
                const motorPositions: MotorPosition[] = Object.entries(
                    result.positions,
                ).map(([motorName, position]) => ({motorName, position}));
                this.getNameInput("Save gesture", "New gesture").subscribe(
                    (name) => this.gestureService.saveGesture(name, motorPositions).subscribe(),
                );
            } else if (result.mode === "dynamic" && result.frames) {
                this.getNameInput(
                    "Save movement sequence",
                    "New movement sequence",
                ).subscribe((name) =>
                    this.movementSequenceService
                        .saveSequence(name, result.sampleRateHz ?? 10, result.frames!)
                        .subscribe(),
                );
            }
        });
    }

    startCapture() {
        this.browserPoseTrackerService
            .start(this.poseSource)
            .then(() => {
                this.gestureCaptureService.start(
                    this.captureMode,
                    this.captureDurationS,
                );
            })
            .catch((err) => {
                console.error("could not start pose tracking", err);
                this.matSnackBarService.open(
                    "Gestenerkennung konnte nicht gestartet werden (siehe Browser-Konsole).",
                    "",
                    {panelClass: "cerebra-toast", duration: 4000},
                );
            });
    }

    stopCapture() {
        this.gestureCaptureService.stop();
    }

    applyGesture(gesture: Gesture) {
        this.gestureService.applyGesture(gesture.gestureId);
    }

    renameGesture(gesture: Gesture) {
        if (!gesture.deletable) {
            return;
        }
        this.getNameInput("Rename gesture", gesture.name).subscribe((name) => {
            this.gestureService.renameGesture(gesture.gestureId, name);
        });
    }

    deleteGesture(gesture: Gesture) {
        this.gestureService.deleteGesture(gesture.gestureId);
    }

    exportGesture(gesture: Gesture) {
        this.gestureService
            .getGestureForExport(gesture.gestureId)
            .subscribe((data) => {
                downloadJson(`geste_${safeFilename(data.name)}`, {
                    kind: GESTURE_EXPORT_KIND,
                    ...data,
                });
            });
    }

    importGesture() {
        pickJsonFile()
            .then((raw) => {
                if (!raw) return;
                const data = raw as {
                    kind: string;
                    name: string;
                    motorPositions: MotorPosition[];
                };
                if (data.kind !== GESTURE_EXPORT_KIND || !data.motorPositions) {
                    throw new Error("Keine gültige Gesten-Datei.");
                }
                this.gestureService
                    .saveGesture(data.name, data.motorPositions)
                    .subscribe(() => this.toast("Geste importiert"));
            })
            .catch((err) => this.toast(String(err.message ?? err)));
    }

    applySequence(sequence: MovementSequence) {
        this.movementSequenceService.applySequence(sequence.sequenceId);
    }

    exportSequence(sequence: MovementSequence) {
        this.movementSequenceService
            .getSequenceForExport(sequence.sequenceId)
            .subscribe((data) => {
                downloadJson(`bewegungssequenz_${safeFilename(data.name)}`, {
                    kind: SEQUENCE_EXPORT_KIND,
                    ...data,
                });
            });
    }

    importSequence() {
        pickJsonFile()
            .then((raw) => {
                if (!raw) return;
                const data = raw as {
                    kind: string;
                    name: string;
                    sampleRateHz: number;
                    frames: {timestampMs: number; positions: {[m: string]: number}}[];
                };
                if (data.kind !== SEQUENCE_EXPORT_KIND || !data.frames) {
                    throw new Error("Keine gültige Bewegungssequenz-Datei.");
                }
                this.movementSequenceService
                    .saveSequence(data.name, data.sampleRateHz ?? 10, data.frames)
                    .subscribe(() => this.toast("Bewegungssequenz importiert"));
            })
            .catch((err) => this.toast(String(err.message ?? err)));
    }

    private toast(message: string) {
        this.matSnackBarService.open(message, "", {
            panelClass: "cerebra-toast",
            duration: 3000,
        });
    }

    renameSequence(sequence: MovementSequence) {
        if (!sequence.deletable) {
            return;
        }
        this.getNameInput("Rename movement sequence", sequence.name).subscribe(
            (name) => {
                this.movementSequenceService.renameSequence(
                    sequence.sequenceId,
                    name,
                );
            },
        );
    }

    deleteSequence(sequence: MovementSequence) {
        this.movementSequenceService.deleteSequence(sequence.sequenceId);
    }

    savePose() {
        this.getNameInput("Add new pose", "New pose").subscribe((name) => {
            this.poseService.saveCurrentPose(name).subscribe((pose) => {
                this.selectPose(pose);
            });
        });
    }

    exportPose(pose: Pose) {
        this.poseService.getPoseForExport(pose.poseId).subscribe((data) => {
            downloadJson(`pose_${safeFilename(data.name)}`, {
                kind: POSE_EXPORT_KIND,
                ...data,
            });
        });
    }

    exportAllPoses() {
        this.poseService.getAllPosesForExport().subscribe((poses) => {
            if (poses.length === 0) {
                this.toast("Keine Posen vorhanden");
                return;
            }
            downloadJson("alle_posen", {
                kind: POSE_COLLECTION_EXPORT_KIND,
                poses,
            });
        });
    }

    /** Imports a single-pose file OR an all-poses collection file. */
    importPoses() {
        pickJsonFile()
            .then((raw) => {
                if (!raw) return;
                const data = raw as {
                    kind: string;
                    name?: string;
                    motorPositions?: MotorPosition[];
                    poses?: {name: string; motorPositions: MotorPosition[]}[];
                };
                let items: {name: string; motorPositions: MotorPosition[]}[];
                if (data.kind === POSE_EXPORT_KIND && data.motorPositions) {
                    items = [
                        {name: data.name ?? "Pose", motorPositions: data.motorPositions},
                    ];
                } else if (
                    data.kind === POSE_COLLECTION_EXPORT_KIND &&
                    Array.isArray(data.poses)
                ) {
                    items = data.poses;
                } else {
                    throw new Error("Keine gültige Posen-Datei.");
                }
                if (items.some((item) => !item.name || !item.motorPositions)) {
                    throw new Error("Posen-Datei ist unvollständig.");
                }
                from(items)
                    .pipe(
                        concatMap((item) =>
                            this.poseService.importPose(
                                item.name,
                                item.motorPositions,
                            ),
                        ),
                    )
                    .subscribe({
                        complete: () =>
                            this.toast(
                                items.length === 1
                                    ? "Pose importiert"
                                    : `${items.length} Posen importiert`,
                            ),
                        error: (err) =>
                            this.toast("Import fehlgeschlagen: " + String(err)),
                    });
            })
            .catch((err) => this.toast(String(err.message ?? err)));
    }

    /** Opens the delete-all confirmation; deletion only happens after the
     * math task is solved correctly (the delete button stays locked). */
    deleteAllPoses() {
        const a = 13 + Math.floor(Math.random() * 77); // 13..89
        const b = 13 + Math.floor(Math.random() * 77);
        const c = 111 + Math.floor(Math.random() * 888); // 111..998
        this.mathExpectedAnswer = a * b + c;
        this.mathQuestion = `${a} × ${b} + ${c} = ?`;
        this.mathAnswerControl.setValue("");
        from(
            this.modalService.open(this.deleteAllModalContent, {
                ariaLabelledBy: "delete-all-poses",
                size: "md",
                windowClass: "cerebra-modal",
                backdropClass: "cerebra-modal-backdrop",
            }).result,
        ).subscribe({
            next: () => {
                if (!this.isMathAnswerCorrect()) {
                    this.toast("Falsche Antwort – nichts gelöscht.");
                    return;
                }
                this.poseService.deleteAllPoses().subscribe((count) => {
                    this.toast(
                        count === 0
                            ? "Keine löschbaren Posen vorhanden."
                            : `${count} Pose(n) gelöscht.`,
                    );
                });
            },
            error: () => {
                // modal dismissed - nothing to do
            },
        });
    }

    isMathAnswerCorrect(): boolean {
        return (
            parseInt(this.mathAnswerControl.value ?? "", 10) ===
            this.mathExpectedAnswer
        );
    }

    renamePose(pose: Pose) {
        if (!pose.deletable) {
            return;
        }
        this.selectPose(pose);
        this.getNameInput("Rename pose", pose.name).subscribe((name) => {
            this.poseService.renamePose(pose.poseId, name);
        });
    }

    deletePose(pose: Pose) {
        this.poseService.deletePose(pose.poseId);
    }

    applyPose(pose: Pose) {
        this.selectPose(pose);
        this.poseService.applyPose(pose.poseId);
    }

    selectPose(pose: Pose) {
        this.selectedPoseId = pose.poseId;
    }

    updatePoseMotorPositions(pose: Pose) {
        if (!pose.deletable && pose.name !== "Startup/Resting") {
            return;
        }
        this.selectPose(pose);
        this.poseService.updatePoseMotorPositions(pose.poseId).subscribe(() => {
            this.matSnackBarService.open("Pose updated successfully", "", {
                panelClass: "cerebra-toast",
                duration: 3000,
            });
        });
    }

    /** Draws the current camera frame + detected landmark dots onto the preview canvas. */
    private drawPreview(dataUrl: string) {
        const canvas = this.previewCanvas?.nativeElement;
        if (!canvas) {
            console.warn("gesture preview: canvas not (yet) in DOM");
            return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.warn("gesture preview: no 2d context");
            return;
        }

        this.previewImage.onload = () => {
            canvas.width = this.previewImage.naturalWidth;
            canvas.height = this.previewImage.naturalHeight;
            ctx.drawImage(this.previewImage, 0, 0, canvas.width, canvas.height);

            const landmarks: NamedLandmark[] = this.browserPoseTrackerService.landmarks$.value;
            ctx.fillStyle = "#e10072";
            for (const lm of landmarks) {
                ctx.beginPath();
                ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
            const drawn$ = this.browserPoseTrackerService.framesDrawn$;
            drawn$.next(drawn$.value + 1);
        };
        this.previewImage.onerror = (err) => {
            console.error("gesture preview: image failed to decode", err);
        };
        this.previewImage.src = dataUrl;
    }

    private getNameInput(
        modalTitle: string,
        defaultValue: string,
    ): Observable<string> {
        this.modalTitle = modalTitle;
        this.nameFormControl.setValue(defaultValue);
        const observable = from(
            this.modalService.open(this.modalContent, {
                ariaLabelledBy: "rename-pose",
                size: "sm",
                windowClass: "cerebra-modal",
                backdropClass: "cerebra-modal-backdrop",
            }).result,
        );
        return observable.pipe(
            map(() => {
                if (!this.nameFormControl.valid) {
                    throw new Error("invalid name");
                }
                return this.nameFormControl.value!;
            }),
        );
    }
}
