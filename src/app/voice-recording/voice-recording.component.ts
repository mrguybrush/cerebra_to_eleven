import {Component, OnDestroy} from "@angular/core";
import {FormControl, Validators} from "@angular/forms";
import {Observable} from "rxjs";
import {MatSnackBar} from "@angular/material/snack-bar";
import {VoiceRecordingService} from "src/app/shared/services/voice-recording.service";
import {VoiceRecording} from "src/app/shared/types/voice-recording";
import {RosService} from "src/app/shared/services/ros-service/ros.service";
import {toWavBlob} from "src/app/shared/services/wav-encoder.util";
import {TranslateService} from "@ngx-translate/core";

type RecordingState = "idle" | "recording" | "recorded";

/**
 * Seite "Voice Recording": eigene WAV-Dateien im Browser aufnehmen oder
 * hochladen, verwalten (Vorschau/Löschen) - die Dateien stehen danach im
 * Blockly-Block "play_wav" zur Auswahl (siehe program-workspace.component.ts).
 */
@Component({
    selector: "app-voice-recording",
    templateUrl: "./voice-recording.component.html",
    styleUrls: ["./voice-recording.component.scss"],
})
export class VoiceRecordingComponent implements OnDestroy {
    recordings$: Observable<VoiceRecording[]>;
    nameFormControl = new FormControl("", [
        Validators.required,
        Validators.minLength(1),
    ]);

    state: RecordingState = "idle";
    recordingSeconds = 0;
    previewUrl: string | null = null;
    uploading = false;
    playingFilename: string | null = null;

    private mediaStream?: MediaStream;
    private mediaRecorder?: MediaRecorder;
    private recordedChunks: Blob[] = [];
    private wavBlob?: Blob;
    private recordingTimer?: ReturnType<typeof setInterval>;

    constructor(
        private voiceRecordingService: VoiceRecordingService,
        private matSnackBarService: MatSnackBar,
        private rosService: RosService,
        private readonly translateService: TranslateService,
    ) {
        this.recordings$ = this.voiceRecordingService.recordingsSubject;
    }

    ngOnDestroy(): void {
        this.stopStream();
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
        }
    }

    /** Browsers only expose getUserMedia() in a "secure context" (HTTPS or
     * localhost) - pib is normally reached over plain http://<ip> on the
     * local network, so navigator.mediaDevices is undefined there and
     * recording can never start. Same restriction the webcam motion-capture
     * source already runs into - see browser-pose-tracker.service.ts. */
    get isSecureContext(): boolean {
        return window.isSecureContext;
    }

    get currentOrigin(): string {
        return window.location.origin;
    }

    async startRecording(): Promise<void> {
        if (!this.isSecureContext) {
            this.toast(
                this.translateService.instant(
                    "voiceRecording.insecureConnectionError",
                ),
            );
            return;
        }
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
        } catch (err) {
            this.toast(
                this.translateService.instant("voiceRecording.micAccessFailed", {
                    error: String((err as Error).message ?? err),
                }),
            );
            return;
        }

        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };
        this.mediaRecorder.onstop = () => this.onRecordingStopped();
        this.mediaRecorder.start();

        this.state = "recording";
        this.recordingSeconds = 0;
        this.recordingTimer = setInterval(() => {
            this.recordingSeconds++;
        }, 1000);
    }

    stopRecording(): void {
        this.mediaRecorder?.stop();
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = undefined;
        }
        this.stopStream();
    }

    private async onRecordingStopped(): Promise<void> {
        const rawBlob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder?.mimeType || "audio/webm",
        });
        try {
            this.wavBlob = await toWavBlob(rawBlob);
        } catch (err) {
            this.toast(
                this.translateService.instant("voiceRecording.processingFailed", {
                    error: String((err as Error).message ?? err),
                }),
            );
            this.state = "idle";
            return;
        }
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
        }
        this.previewUrl = URL.createObjectURL(this.wavBlob);
        this.state = "recorded";
    }

    discardRecording(): void {
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
        }
        this.previewUrl = null;
        this.wavBlob = undefined;
        this.nameFormControl.setValue("");
        this.state = "idle";
    }

    saveRecording(): void {
        if (!this.wavBlob || this.nameFormControl.invalid) {
            return;
        }
        const filename = this.safeFilename(this.nameFormControl.value!) + ".wav";
        this.uploading = true;
        this.voiceRecordingService.upload(filename, this.wavBlob).subscribe({
            next: () => {
                this.uploading = false;
                this.toast(this.translateService.instant("voiceRecording.saved"));
                this.discardRecording();
            },
            error: (err) => {
                this.uploading = false;
                this.toast(
                    this.translateService.instant("voiceRecording.saveFailed", {
                        error: err?.error?.error ?? err?.message ?? String(err),
                    }),
                );
            },
        });
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = ""; // allow selecting the same file again later
        if (!file) {
            return;
        }
        const lowerName = file.name.toLowerCase();
        if (!lowerName.endsWith(".wav") && !lowerName.endsWith(".mp3")) {
            this.toast(this.translateService.instant("voiceRecording.onlyWavMp3"));
            return;
        }
        this.uploading = true;
        this.voiceRecordingService.upload(file.name, file).subscribe({
            next: () => {
                this.uploading = false;
                this.toast(this.translateService.instant("voiceRecording.fileUploaded"));
            },
            error: (err) => {
                this.uploading = false;
                this.toast(
                    this.translateService.instant("voiceRecording.uploadFailed", {
                        error: err?.error?.error ?? err?.message ?? String(err),
                    }),
                );
            },
        });
    }

    deleteRecording(recording: VoiceRecording): void {
        this.voiceRecordingService.delete(recording.filename).subscribe({
            next: () => this.toast(this.translateService.instant("voiceRecording.deleted")),
            error: (err) =>
                this.toast(
                    this.translateService.instant("voiceRecording.deleteFailed", {
                        error: err?.error?.error ?? err?.message ?? String(err),
                    }),
                ),
        });
    }

    togglePlay(recording: VoiceRecording): void {
        this.playingFilename =
            this.playingFilename === recording.filename ? null : recording.filename;
    }

    /** Spielt die Aufnahme auf pibs eigenem Lautsprecher ab (statt im
     * Browser) - via play_audio_from_file-Service des Voice-Assistant-
     * Containers, der die Aufnahmen read-only gemountet hat. */
    playOnRobot(recording: VoiceRecording): void {
        this.rosService.playRecordingOnRobot(recording.filename);
        this.matSnackBarService.open(
            this.translateService.instant("voiceRecording.playingOnPib"),
            "",
            {panelClass: "cerebra-toast", duration: 2000},
        );
    }

    recordingUrl(recording: VoiceRecording): string {
        return this.voiceRecordingService.previewUrl(recording.filename);
    }

    formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        return `${(bytes / 1024).toFixed(0)} KB`;
    }

    private stopStream(): void {
        this.mediaStream?.getTracks().forEach((track) => track.stop());
        this.mediaStream = undefined;
    }

    private safeFilename(name: string): string {
        return (
            name.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "") || "aufnahme"
        );
    }

    private toast(message: string): void {
        this.matSnackBarService.open(message, "", {
            panelClass: "cerebra-toast",
            duration: 3500,
        });
    }
}
