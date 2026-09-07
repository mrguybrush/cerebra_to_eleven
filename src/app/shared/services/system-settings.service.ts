import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, catchError, map, of, tap} from "rxjs";
import {MatSnackBar} from "@angular/material/snack-bar";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {MenuVisibility} from "../types/menu-visibility";
import {SystemInfo} from "../types/system-info";

/**
 * Auto-Off: Minuten ohne Bewegung, nach denen der Roboter automatisch in
 * die Resting Pose faehrt und den Motorstrom abschaltet (verhindert
 * Ueberhitzung). Wird von ros-motors' relay_control.py periodisch
 * abgefragt - siehe system_settings_client.py. null = deaktiviert.
 */
@Injectable({
    providedIn: "root",
})
export class SystemSettingsService {
    // Sichtbarkeit der Hauptmenuepunkte - geteilt mit app.component (der
    // linken Navigationsleiste), damit ein Haken in den Einstellungen sich
    // sofort auswirkt, ohne Reload. Default (vor dem Laden): nichts
    // ausgeblendet.
    menuVisibilitySubject: BehaviorSubject<MenuVisibility> =
        new BehaviorSubject<MenuVisibility>({
            jointControl: false,
            pose: false,
            camera: false,
            motionCapture: false,
            voiceRecording: false,
            voiceAssistant: false,
            program: false,
            system: false,
        });

    constructor(
        private apiService: ApiService,
        private matSnackBarService: MatSnackBar,
    ) {
        this.loadMenuVisibility();
    }

    loadMenuVisibility() {
        this.apiService
            .get(UrlConstants.MENU_VISIBILITY)
            .subscribe((response) => {
                this.menuVisibilitySubject.next(response as MenuVisibility);
            });
    }

    setMenuVisibility(updates: Partial<MenuVisibility>) {
        this.apiService
            .put(UrlConstants.MENU_VISIBILITY, updates)
            .subscribe((response) => {
                this.menuVisibilitySubject.next(response as MenuVisibility);
            });
    }

    getAutoOffMinutes(): Observable<number | null> {
        return this.apiService
            .get(UrlConstants.AUTO_OFF)
            .pipe(map((dto) => dto["autoOffMinutes"] ?? null));
    }

    setAutoOffMinutes(minutes: number | null): Observable<number | null> {
        return this.apiService
            .put(UrlConstants.AUTO_OFF, {autoOffMinutes: minutes})
            .pipe(map((dto) => dto["autoOffMinutes"] ?? null));
    }

    /** Anzeigedauer des IP/QR-Code-Overlays beim Hochfahren (und nach
     * Klick auf den QR-Code im Frontend), in Sekunden. 0 = gar nicht
     * anzeigen. */
    getIpOverlaySeconds(): Observable<number> {
        return this.apiService
            .get(UrlConstants.IP_OVERLAY_SECONDS)
            .pipe(map((dto) => dto["ipOverlaySeconds"] ?? 20));
    }

    setIpOverlaySeconds(seconds: number): Observable<number> {
        return this.apiService
            .put(UrlConstants.IP_OVERLAY_SECONDS, {ipOverlaySeconds: seconds})
            .pipe(map((dto) => dto["ipOverlaySeconds"] ?? 20));
    }

    /** Restarts the ros-display container (Augen-Anzeige) - hilft, wenn die
     * Augen nach dem Hochfahren nicht vollstaendig im Vollbild angezeigt
     * werden. Returns an Observable purely so the caller can track the
     * loading/done state of the button; success/error feedback is already
     * handled here. */
    restartDisplay(): Observable<boolean> {
        return this.apiService.post(UrlConstants.RESTART_DISPLAY, {}).pipe(
            tap(() =>
                this.matSnackBarService.open(
                    "Augen-Anzeige wurde neu gestartet.",
                    "",
                    {panelClass: "cerebra-toast", duration: 3000},
                ),
            ),
            map(() => true),
            catchError((err) => {
                const message =
                    (err as {error?: {error?: string}})?.error?.error ??
                    "Neustart der Augen-Anzeige fehlgeschlagen.";
                this.matSnackBarService.open(message, "", {
                    panelClass: "cerebra-toast",
                    duration: 4000,
                });
                return of(false);
            }),
        );
    }

    /** Ausgabelautstaerke des Roboters (0-100%). */
    getVolumePercent(): Observable<number> {
        return this.apiService
            .get(UrlConstants.VOLUME)
            .pipe(map((dto) => dto["volumePercent"] ?? 100));
    }

    /** Setzt die Lautstaerke (0-100%) - wird backend-seitig sofort auf den
     * Audio-Sink angewendet und persistiert. */
    setVolumePercent(percent: number): Observable<number> {
        return this.apiService
            .put(UrlConstants.VOLUME, {volumePercent: percent})
            .pipe(
                map((dto) => dto["volumePercent"] ?? percent),
                catchError((err) => {
                    const message =
                        (err as {error?: {error?: string}})?.error?.error ??
                        "Lautstärke konnte nicht gesetzt werden.";
                    this.matSnackBarService.open(message, "", {
                        panelClass: "cerebra-toast",
                        duration: 4000,
                    });
                    return of(percent);
                }),
            );
    }

    /** Speicherplatz, RAM, CPU-Last und Temperatur des Roboter-Rechners -
     * fuer Live-Polling gedacht (siehe diagnose.component.ts), das Backend
     * beantwortet das ueber statvfs/proc/sysfs sub-Millisekunden schnell. */
    getSystemInfo(): Observable<SystemInfo> {
        return this.apiService
            .get(UrlConstants.SYSTEM_INFO)
            .pipe(map((dto) => dto as SystemInfo));
    }

    /** Startet den kompletten Raspberry Pi neu (nicht nur einen Container). */
    rebootSystem(): Observable<boolean> {
        return this.apiService.post(UrlConstants.REBOOT, {}).pipe(
            tap(() =>
                this.matSnackBarService.open(
                    "Roboter wird neu gestartet - bitte etwa eine Minute warten.",
                    "",
                    {panelClass: "cerebra-toast", duration: 6000},
                ),
            ),
            map(() => true),
            catchError((err) => {
                const message =
                    (err as {error?: {error?: string}})?.error?.error ??
                    "Neustart des Systems fehlgeschlagen.";
                this.matSnackBarService.open(message, "", {
                    panelClass: "cerebra-toast",
                    duration: 4000,
                });
                return of(false);
            }),
        );
    }
}
