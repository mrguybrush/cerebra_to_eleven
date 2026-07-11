import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, catchError, map, throwError} from "rxjs";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {LlmSettings} from "../types/llm-settings";

export interface GeminiKeyVerification {
    valid: boolean;
    message: string;
}

/**
 * Verwaltet die globalen Verbindungsdaten fuer Chat-LLMs ohne
 * tryb-Smart-API-Token (Gemini-API-Key, lokales Netzwerk-LLM).
 * Persistiert ueber das pib-API in der Datenbank.
 */
@Injectable({
    providedIn: "root",
})
export class LlmSettingsService {
    llmSettingsSubject: BehaviorSubject<LlmSettings> =
        new BehaviorSubject<LlmSettings>({
            geminiApiKey: null,
            localLlmUrl: "",
            localLlmModel: "",
        });

    constructor(private apiService: ApiService) {
        this.loadLlmSettings();
    }

    loadLlmSettings() {
        this.apiService
            .get(UrlConstants.LLM_SETTINGS)
            .pipe(
                catchError((err) => {
                    return throwError(() => {
                        console.log(err);
                    });
                }),
            )
            .subscribe((response) => {
                this.llmSettingsSubject.next(response as LlmSettings);
            });
    }

    updateLlmSettings(settings: Partial<LlmSettings>) {
        this.apiService
            .put(UrlConstants.LLM_SETTINGS, settings)
            .pipe(
                catchError((err) => {
                    return throwError(() => {
                        console.log(err);
                    });
                }),
            )
            .subscribe((response) => {
                this.llmSettingsSubject.next(response as LlmSettings);
            });
    }

    /** Tests a Gemini API key against Google's API (does not need to be
     * saved first - the key is passed straight through for the check). */
    verifyGeminiKey(apiKey: string): Observable<GeminiKeyVerification> {
        return this.apiService
            .post(UrlConstants.VERIFY_GEMINI_KEY, {geminiApiKey: apiKey})
            .pipe(map((response) => response as GeminiKeyVerification));
    }
}
