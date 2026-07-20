import {Injectable} from "@angular/core";
import {Observable, map} from "rxjs";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";

/** Globale Regler über der Motion-Capture-Zuordnungstabelle (Singleton in
 * der DB, siehe motion_capture_settings). smoothingAlpha steuert die
 * Motor-Glättung im gesture_control-Node, evalMaxHz die maximale
 * Auswertungsrate der Browser-Erkennung (rein clientseitig angewendet). */
export interface MotionCaptureSettings {
    smoothingAlpha: number;
    evalMaxHz: number;
}

@Injectable({
    providedIn: "root",
})
export class MotionCaptureSettingsService {
    constructor(private apiService: ApiService) {}

    getSettings(): Observable<MotionCaptureSettings> {
        return this.apiService
            .get(UrlConstants.MOTION_CAPTURE_SETTINGS)
            .pipe(map((dto) => dto as MotionCaptureSettings));
    }

    updateSettings(
        settings: Partial<MotionCaptureSettings>,
    ): Observable<MotionCaptureSettings> {
        return this.apiService
            .put(UrlConstants.MOTION_CAPTURE_SETTINGS, settings)
            .pipe(map((dto) => dto as MotionCaptureSettings));
    }
}
