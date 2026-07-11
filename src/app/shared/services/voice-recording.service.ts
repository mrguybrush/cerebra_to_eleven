import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, map, tap} from "rxjs";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {VoiceRecording} from "../types/voice-recording";

/**
 * Verwaltet die auf pib gespeicherten WAV-Dateien (aufgenommen im Browser
 * oder direkt hochgeladen) - siehe Seite "Voice Recording" und den
 * Blockly-Block "play_wav". Dateien liegen unter VOICE_RECORDINGS_DIR
 * (Flask), das dieselbe Verzeichnis-Mountung wie ros-voice-assistant nutzt,
 * damit der play_audio_from_file-Service sie tatsaechlich abspielen kann.
 */
@Injectable({
    providedIn: "root",
})
export class VoiceRecordingService {
    recordingsSubject: BehaviorSubject<VoiceRecording[]> = new BehaviorSubject<
        VoiceRecording[]
    >([]);

    constructor(private apiService: ApiService) {
        this.loadRecordings();
    }

    loadRecordings() {
        this.apiService
            .get(UrlConstants.VOICE_RECORDINGS)
            .pipe(map((dto) => (dto["recordings"] ?? []) as VoiceRecording[]))
            .subscribe((recordings) => this.recordingsSubject.next(recordings));
    }

    /** Laedt eine WAV-Datei hoch (Blob muss bereits gueltiges WAV/PCM sein -
     * siehe wav-encoder.util.ts fuer im Browser aufgenommenes Audio). */
    upload(filename: string, wavBlob: Blob): Observable<{filename: string}> {
        const formData = new FormData();
        formData.append("file", wavBlob, filename);
        return this.apiService
            .postFile(UrlConstants.VOICE_RECORDINGS, formData)
            .pipe(tap(() => this.loadRecordings()));
    }

    delete(filename: string): Observable<void> {
        return this.apiService
            .delete(`${UrlConstants.VOICE_RECORDINGS}/${encodeURIComponent(filename)}`)
            .pipe(tap(() => this.loadRecordings()));
    }

    /** Direkt abspielbare URL (fuer eine lokale Browser-Vorschau via
     * <audio src="...">) - nicht der Weg, wie der Roboter es abspielt, das
     * laeuft ueber den play_wav-Blockly-Block/ROS-Service. */
    previewUrl(filename: string): string {
        return `${this.apiService.baseUrl}${UrlConstants.VOICE_RECORDINGS}/${encodeURIComponent(filename)}`;
    }
}
