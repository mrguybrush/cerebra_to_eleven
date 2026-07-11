import {Component, OnDestroy} from "@angular/core";
import {FormControl, Validators} from "@angular/forms";
import {Observable} from "rxjs";
import {MatSnackBar} from "@angular/material/snack-bar";
import {VoiceRecordingService} from "src/app/shared/services/voice-recording.service";
import {VoiceRecording} from "src/app/shared/types/voice-recording";
import {toWavBlob} from "src/app/shared/services/wav-encoder.util";

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
                "Aufnahme braucht eine sichere Verbindung (HTTPS oder localhost) - der Browser blockiert Mikrofonzugriff über http://.",
            );
            return;
        }
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
        } catch (err) {
            this.toast(
                "Mikrofonzugriff nicht möglich: " + String((err as Error).message ?? err),
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
                "Aufnahme konnte nicht verarbeitet werden: " +
                    String((err as Error).message ?? err),
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
                this.toast("Aufnahme gespeichert");
                this.discardRecording();
            },
            error: (err) => {
                this.uploading = false;
                this.toast(
                    "Speichern fehlgeschlagen: " +
                        (err?.error?.error ?? err?.message ?? String(err)),
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
        if (!file.name.toLowerCase().endsWith(".wav")) {
            this.toast("Nur .wav-Dateien werden unterstützt.");
            return;
        }
        this.uploading = true;
        this.voiceRecordingService.upload(file.name, file).subscribe({
            next: () => {
                this.uploading = false;
                this.toast("Datei hochgeladen");
            },
            error: (err) => {
                this.uploading = false;
                this.toast(
                    "Upload fehlgeschlagen: " +
                        (err?.error?.error ?? err?.message ?? String(err)),
                );
            },
        });
    }

    deleteRecording(recording: VoiceRecording): void {
        this.voiceRecordingService.delete(recording.filename).subscribe({
            next: () => this.toast("Gelöscht"),
            error: (err) =>
                this.toast(
                    "Löschen fehlgeschlagen: " +
                        (err?.error?.error ?? err?.message ?? String(err)),
                ),
        });
    }

    togglePlay(recording: VoiceRecording): void {
        this.playingFilename =
            this.playingFilename === recording.filename ? null : recording.filename;
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
