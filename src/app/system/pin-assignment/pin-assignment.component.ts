import {Component, OnInit} from "@angular/core";
import {BrickletPinService} from "src/app/shared/services/bricklet-pin.service";
import {BrickletPinGroup, PinGrid, PinInfo} from "src/app/shared/types/bricklet-pin-grid";

const EMPTY_GRID: PinGrid = {bricklets: [], allMotorNames: []};

/**
 * "Pinbelegung": zeigt jeden Servo-Bricklet-Pin und erlaubt, ihm ein
 * Koerperteil zuzuweisen (oder "nicht angeschlossen") bzw. ihn als defekt
 * zu markieren. Ein bereits zugewiesener Motor verschwindet aus den
 * Dropdowns aller anderen Pins - ein Motor kann nur an einem Pin haengen.
 */
@Component({
    selector: "app-pin-assignment",
    templateUrl: "./pin-assignment.component.html",
    styleUrl: "./pin-assignment.component.scss",
})
export class PinAssignmentComponent implements OnInit {
    grid: PinGrid = EMPTY_GRID;
    restartingMotors = false;

    constructor(private brickletPinService: BrickletPinService) {}

    ngOnInit(): void {
        this.brickletPinService
            .getGridObservable()
            .subscribe((grid) => (this.grid = grid));
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
