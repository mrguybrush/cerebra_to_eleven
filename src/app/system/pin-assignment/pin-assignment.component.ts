import {Component, OnInit} from "@angular/core";
import {Observable, take} from "rxjs";
import {BrickletPinService} from "src/app/shared/services/bricklet-pin.service";
import {MotorService} from "src/app/shared/services/motor.service";
import {MotorSettings} from "src/app/shared/types/motor-settings.class";
import {BrickletPinGroup, PinGrid, PinInfo} from "src/app/shared/types/bricklet-pin-grid";

const EMPTY_GRID: PinGrid = {bricklets: [], allMotorNames: []};

/**
 * "Pinbelegung": zeigt jeden Servo-Bricklet-Pin und erlaubt, ihm ein
 * Koerperteil zuzuweisen (oder "nicht angeschlossen") bzw. ihn als defekt
 * zu markieren. Ein bereits zugewiesener Motor verschwindet aus den
 * Dropdowns aller anderen Pins - ein Motor kann nur an einem Pin haengen.
 *
 * Zusaetzlich kann pro zugewiesenem Pin genau dieser eine Motor aktiviert
 * (Servo-Bricklet-Pin-Enable in Hardware, siehe MotorService.applySettings)
 * und per Testregler bewegt werden - im Gegensatz zur Pin-ZUWEISUNG selbst
 * wirkt das SOFORT, ohne ros-motors neu zu starten, weil es denselben
 * bereits laufenden Motor nur ueber die normale Settings/Position-API
 * anspricht.
 */
@Component({
    selector: "app-pin-assignment",
    templateUrl: "./pin-assignment.component.html",
    styleUrl: "./pin-assignment.component.scss",
})
export class PinAssignmentComponent implements OnInit {
    grid: PinGrid = EMPTY_GRID;
    restartingMotors = false;

    // Memoisierte Observables pro Motor: MotorService cached intern selbst
    // schon ein BehaviorSubject pro Motor, aber ohne dieses Zwischen-Caching
    // wuerde jeder Template-Aufruf von settingsFor()/positionFor() (z.B. bei
    // jedem Change-Detection-Zyklus) eine NEUE Observable-Huelle zurueck-
    // geben - "| async" wuerde dann bei jedem Zyklus neu (ab)subscriben,
    // statt einmal stabil zu bleiben.
    private settingsByMotor = new Map<string, Observable<MotorSettings>>();
    private positionByMotor = new Map<string, Observable<number>>();

    constructor(
        private brickletPinService: BrickletPinService,
        private motorService: MotorService,
    ) {}

    ngOnInit(): void {
        this.brickletPinService
            .getGridObservable()
            .subscribe((grid) => (this.grid = grid));
    }

    /** Settings (u.a. turnedOn, rotationRangeMin/Max) des an diesen Pin
     * angeschlossenen Motors - speist Aktiv-Haken und Testregler-Grenzen. */
    settingsFor(motorName: string): Observable<MotorSettings> {
        let obs = this.settingsByMotor.get(motorName);
        if (!obs) {
            obs = this.motorService.getSettingsObservable(motorName);
            this.settingsByMotor.set(motorName, obs);
        }
        return obs;
    }

    /** Aktuelle Position (Grad*100, siehe MotorService) fuer den
     * Startwert/die Live-Anzeige des Testreglers. */
    positionFor(motorName: string): Observable<number> {
        let obs = this.positionByMotor.get(motorName);
        if (!obs) {
            obs = this.motorService.getPositionObservable(motorName);
            this.positionByMotor.set(motorName, obs);
        }
        return obs;
    }

    /** Aktiviert/deaktiviert NUR diesen einen Motor (Hardware-Enable des
     * Servo-Bricklet-Pins) - so laesst sich die Verkabelung eines Pins
     * gezielt pruefen, ohne andere Motoren zu beeinflussen. */
    toggleMotorActive(motorName: string, active: boolean): void {
        this.motorService
            .getSettingsObservable(motorName)
            .pipe(take(1))
            .subscribe((settings) => {
                this.motorService.applySettings(motorName, {
                    ...settings,
                    turnedOn: active,
                });
            });
    }

    /** Testregler: faehrt diesen einen Motor auf positionDeg Grad. Die
     * Hardware ignoriert Positionsbefehle ohnehin, solange der Pin nicht
     * ueber toggleMotorActive() aktiviert wurde. */
    setTestPosition(motorName: string, positionDeg: number): void {
        this.motorService.setPosition(motorName, positionDeg * 100);
    }

    /** Dropdown options for one pin: every motor not currently wired to a
     * DIFFERENT pin, plus this pin's own current motor (so it stays
     * selectable/visible in its own dropdown). */
    availableMotorNames(currentMotorName: string | null): string[] {
        const assignedElsewhere = new Set(
            this.grid.bricklets
                .flatMap((bricklet: BrickletPinGroup) =>
                    bricklet.pins.map((pin: PinInfo) => pin.motorName),
                )
                .filter(
                    (name): name is string =>
                        !!name && name !== currentMotorName,
                ),
        );
        return this.grid.allMotorNames.filter(
            (name) => !assignedElsewhere.has(name),
        );
    }

    onAssign(brickletId: number, pin: number, motorName: string): void {
        this.brickletPinService.assignPin(brickletId, pin, motorName || null);
    }

    onToggleDefective(brickletId: number, pin: number, defective: boolean): void {
        this.brickletPinService.setDefective(brickletId, pin, defective);
    }

    restartMotors(): void {
        if (
            !confirm(
                "ros-motors neu starten? Der Roboter verliert dabei kurz " +
                    "die Verbindung zu allen Motoren. Nur nötig, wenn sich " +
                    "die Pinbelegung oben geändert hat.",
            )
        ) {
            return;
        }
        this.restartingMotors = true;
        this.brickletPinService
            .restartMotorsContainer()
            .subscribe(() => (this.restartingMotors = false));
    }

    /** Laedt die aktuelle Pinbelegung als JSON-Datei herunter. */
    exportAssignment(): void {
        this.brickletPinService.exportAssignment();
    }

    /** Liest die gewaehlte JSON-Datei ein und schickt sie an den Import. */
    onImportFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = ""; // erlaubt, dieselbe Datei erneut auszuwaehlen
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result as string);
                this.brickletPinService.importAssignment(data);
            } catch {
                alert("Die Datei ist keine gültige JSON-Pinbelegung.");
            }
        };
        reader.readAsText(file);
    }
}
