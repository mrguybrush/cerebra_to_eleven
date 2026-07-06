import {Injectable} from "@angular/core";
import {BehaviorSubject, catchError, throwError} from "rxjs";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {VoiceSettings, PiperVoice} from "../types/voice-settings";

/**
 * Verwaltet die globalen TTS-Einstellungen (lokale Piper-Stimme an/aus
 * und Auswahl der Stimme). Persistiert ueber das pib-API in der Datenbank.
 */
@Injectable({
    providedIn: "root",
})
export class VoiceSettingsService {
    // Aktuelle Einstellungen (fuer die UI abonnierbar).
    voiceSettingsSubject: BehaviorSubject<VoiceSettings> =
        new BehaviorSubject<VoiceSettings>({
            localVoiceEnabled: false,
            localVoiceModel: "de_DE-thorsten-low",
        });

    // Liste der verfuegbaren deutschen Stimmen (vom Backend).
    availableVoicesSubject: BehaviorSubject<PiperVoice[]> =
        new BehaviorSubject<PiperVoice[]>([]);

    constructor(private apiService: ApiService) {
        this.loadVoiceSettings();
        this.loadAvailableVoices();
    }

    loadVoiceSettings() {
        this.apiService
            .get(UrlConstants.VOICE_SETTINGS)
            .pipe(
                catchError((err) => {
                    return throwError(() => {
                        console.log(err);
                    });
                }),
            )
            .subscribe((response) => {
                this.voiceSettingsSubject.next(response as VoiceSettings);
            });
    }

    loadAvailableVoices() {
        this.apiService
            .get(UrlConstants.VOICE_SETTINGS + "/available-voices")
            .pipe(
                catchError((err) => {
                    return throwError(() => {
                        console.log(err);
                    });
                }),
            )
            .subscribe((response) => {
                this.availableVoicesSubject.next(
                    response["voices"] as PiperVoice[],
                );
            });
    }

    updateVoiceSettings(settings: VoiceSettings) {
        this.apiService
            .put(UrlConstants.VOICE_SETTINGS, settings)
            .pipe(
                catchError((err) => {
                    return throwError(() => {
                        console.log(err);
                    });
                }),
            )
            .subscribe((response) => {
                this.voiceSettingsSubject.next(response as VoiceSettings);
            });
    }
}
