import {Component, OnInit} from "@angular/core";
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {Observable} from "rxjs";
import {MatSnackBar} from "@angular/material/snack-bar";
import {
    BrickletService,
    DetectedBricklet,
} from "src/app/shared/services/bricklet.service";
import {Bricklet} from "src/app/shared/types/bricklet";
import {
    patternOrOptionalValidator,
    uniqueValuesValidator,
} from "src/app/shared/validators/bricklet-uid.validator";

// Feste Zuordnung der HAT-Steckposition (a-h, Tinkerforge-Enumeration) zur
// internen bricklet_number in der DB - siehe Aufgabe:
//   Position a/b/c = Servo Bricklets 1/2/3
//   Position d/f/g = RGB-LED-Button-Bricklets (bricklet_number 5/6/7)
//   Position e     = Solid State Relay (bricklet_number 4)
// Der HAT selbst (Position 'i') hat keine Zuordnung und wird ignoriert.
const POSITION_TO_BRICKLET_NUMBER: {[position: string]: number} = {
    a: 1,
    b: 2,
    c: 3,
    e: 4,
    d: 5,
    f: 6,
    g: 7,
};

@Component({
    selector: "app-hardware-id",
    templateUrl: "./hardware-id.component.html",
    styleUrl: "./hardware-id.component.scss",
})
export class HardwareIdComponent implements OnInit {
    servoBricklets: Bricklet[] = [];
    relayBricklets: Bricklet[] = [];
    rgbBricklets: Bricklet[] = [];
    brickletUidForm = new FormGroup({}, {validators: uniqueValuesValidator()});

    detectedBricklets: DetectedBricklet[] = [];
    detecting = false;

    constructor(
        private brickletService: BrickletService,
        private matSnackBarService: MatSnackBar,
    ) {}

    ngOnInit(): void {
        this.brickletService.getBrickletObservable().subscribe((bricklets) => {
            this.servoBricklets = bricklets.filter(
                (b) => b.type == "Servo Bricklet",
            );
            this.relayBricklets = bricklets.filter(
                (b) => b.type === "Solid State Relay Bricklet",
            );
            this.rgbBricklets = bricklets.filter(
                (b) => b.type === "RGB LED Button Bricklet",
            );

            bricklets.forEach((bricklet) => {
                this.brickletUidForm.addControl(
                    bricklet.brickletNumber.toString(),
                    new FormControl(bricklet.uid, [
                        Validators.maxLength(6),
                        patternOrOptionalValidator(),
                    ]),
                );
            });
        });
    }

    updateIds() {
        if (!this.brickletUidForm.valid) return;
        const newBrickletInput: Record<number, string> =
            this.brickletUidForm.getRawValue();
        const changedBricklets: Bricklet[] =
            this.detectChangedBricklets(newBrickletInput);

        if (changedBricklets.length > 0) {
            this.brickletService.renameBrickletUid(changedBricklets);
        }
    }

    /** Fragt die angeschlossenen Bricklets live ab (fuellt die Tabelle) und
     * traegt ihre UIDs anhand der HAT-Steckposition automatisch in die
     * passenden Felder ein. Der Nutzer speichert danach wie gewohnt ueber
     * "Aktualisieren". */
    autoAssign() {
        this.detecting = true;
        this.brickletService.getDetectedBricklets().subscribe({
            next: (detected) => {
                this.detecting = false;
                this.detectedBricklets = detected;
                let assigned = 0;
                for (const brick of detected) {
                    const position = (brick.position ?? "").toLowerCase();
                    const brickletNumber =
                        POSITION_TO_BRICKLET_NUMBER[position];
                    if (brickletNumber === undefined) {
                        continue;
                    }
                    const control = this.brickletUidForm.get(
                        brickletNumber.toString(),
                    );
                    if (control) {
                        control.setValue(brick.uid);
                        control.markAsDirty();
                        assigned++;
                    }
                }
                this.matSnackBarService.open(
                    assigned > 0
                        ? `${assigned} Bricklet(s) automatisch zugewiesen. Zum Speichern „Aktualisieren“ klicken.`
                        : "Keine passenden Bricklets erkannt.",
                    "",
                    {panelClass: "cerebra-toast", duration: 4000},
                );
            },
            error: (err) => {
                this.detecting = false;
                const message =
                    (err as {error?: {error?: string}})?.error?.error ??
                    "Bricklets konnten nicht abgefragt werden.";
                this.matSnackBarService.open(message, "", {
                    panelClass: "cerebra-toast",
                    duration: 4000,
                });
            },
        });
    }

    private detectChangedBricklets(
        newBrickletInput: Record<number, string>,
    ): Bricklet[] {
        return Object.entries(newBrickletInput)
            .map(([key, value]) => {
                const brickletNumber = Number(key);
                const existingBricklet =
                    this.brickletService.getBricklet(brickletNumber);
                if (existingBricklet && existingBricklet.uid !== value) {
                    return new Bricklet(
                        value,
                        Number(key),
                        existingBricklet.type,
                    );
                }
                return null;
            })
            .filter((bricklet) => bricklet !== null) as Bricklet[];
    }
}
