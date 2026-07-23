import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, catchError, map, of, tap} from "rxjs";
import {MatSnackBar} from "@angular/material/snack-bar";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {PinGrid} from "../types/bricklet-pin-grid";

const EMPTY_GRID: PinGrid = {bricklets: [], allMotorNames: []};

/**
 * Servo-Bricklet-Pinbelegung: welches Koerperteil (Motor) haengt an
 * welchem physischen Pin, und welche Pins sind als defekt markiert.
 * Aenderungen wirken erst nach einem Neustart von ros-motors, das die
 * Zuordnung nur beim Start aus der DB laedt (siehe pib_motors/motor.py).
 */
@Injectable({
    providedIn: "root",
})
export class BrickletPinService {
    private gridSubject = new BehaviorSubject<PinGrid>(EMPTY_GRID);

    constructor(
        private apiService: ApiService,
        private matSnackBarService: MatSnackBar,
    ) {
        this.reload();
    }

    getGridObservable(): Observable<PinGrid> {
        return this.gridSubject;
    }

    reload(): void {
        this.apiService
            .get(UrlConstants.BRICKLET_PINS)
            .subscribe((grid: PinGrid) => this.gridSubject.next(grid));
    }

    assignPin(brickletId: number, pin: number, motorName: string | null): void {
        this.apiService
            .patch(`${UrlConstants.BRICKLET_PINS}/${brickletId}/${pin}`, {
                motorName,
            })
            .pipe(
                tap(() => this.reload()),
                catchError((err) => {
                    this.showError(err, "Zuweisung fehlgeschlagen.");
                    this.reload(); // revert any optimistic UI state to the real DB value
                    return of(null);
                }),
            )
            .subscribe();
    }

    setDefective(brickletId: number, pin: number, defective: boolean): void {
        this.apiService
            .patch(`${UrlConstants.BRICKLET_PINS}/${brickletId}/${pin}/defective`, {
                defective,
            })
            .pipe(
                tap(() => this.reload()),
                catchError((err) => {
                    this.showError(err, "Änderung fehlgeschlagen.");
                    this.reload();
                    return of(null);
                }),
            )
            .subscribe();
    }

    /** Restarts the ros-motors container so it picks up the new pin
     * wiring - it only reads that from the DB once at startup. Returns an
     * Observable purely so the caller can track the loading/done state of
     * the button; success/error feedback is already handled here. */
    restartMotorsContainer(): Observable<boolean> {
        return this.apiService.post(`${UrlConstants.BRICKLET_PINS}/restart-motors`, {}).pipe(
            tap(() =>
                this.matSnackBarService.open(
                    "ros-motors wurde neu gestartet.",
                    "",
                    {panelClass: "cerebra-toast", duration: 3000},
                ),
            ),
            map(() => true),
            catchError((err) => {
                this.showError(err, "Neustart von ros-motors fehlgeschlagen.");
                return of(false);
            }),
        );
    }

    /** Laedt die aktuelle Pinbelegung als JSON-Datei herunter (Zuordnung
     * ueber die stabile bricklet_number, siehe Backend export). */
    exportAssignment(): void {
        this.apiService.get(`${UrlConstants.BRICKLET_PINS}/export`).subscribe({
            next: (data) => {
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "pib-pinbelegung.json";
                link.click();
                URL.revokeObjectURL(url);
            },
            error: (err) =>
                this.showError(err, "Export der Pinbelegung fehlgeschlagen."),
        });
    }

    /** Uebernimmt eine zuvor exportierte Pinbelegung aus einer JSON-Datei. */
    importAssignment(data: object): void {
        this.apiService
            .put(`${UrlConstants.BRICKLET_PINS}/import`, data)
            .pipe(
                tap(() => {
                    this.matSnackBarService.open(
                        "Pinbelegung importiert. Zum Übernehmen ros-motors neu starten.",
                        "",
                        {panelClass: "cerebra-toast", duration: 4000},
                    );
                    this.reload();
                }),
                catchError((err) => {
                    this.showError(err, "Import der Pinbelegung fehlgeschlagen.");
                    return of(null);
                }),
            )
            .subscribe();
    }

    private showError(err: unknown, fallback: string) {
        const message =
            (err as {error?: {error?: string}})?.error?.error ?? fallback;
        this.matSnackBarService.open(message, "", {
            panelClass: "cerebra-toast",
            duration: 4000,
        });
    }
}
