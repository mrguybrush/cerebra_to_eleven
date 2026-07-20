import {Component, OnDestroy, OnInit} from "@angular/core";
import {Subscription} from "rxjs";
import {MotorService} from "src/app/shared/services/motor.service";
import {SystemSettingsService} from "src/app/shared/services/system-settings.service";
import {MotorSettings} from "src/app/shared/types/motor-settings.class";

// The two "quick open/close" rows fan a single slider out to 5 real finger
// motors each (see mirroredRows below and pib_motors/motor.py
// name_to_motors) - there's no single "current position"/rotation-range
// tied to this virtual name, so the joint-limits buttons don't apply here.
const AGGREGATE_MOTORS = ["all_fingers_left", "all_fingers_right"];

// One table row: the same joint on both body sides. Column order is
// MIRRORED on purpose (facing the robot): the LEFT table column drives the
// robot's RIGHT side, the RIGHT table column its LEFT side.
interface MirroredJointRow {
    label: string;
    rightMotor: string; // robot's right side -> left table column
    leftMotor: string; // robot's left side -> right table column
}

const MIRRORED_ROWS: MirroredJointRow[] = [
    {label: "jointControl.allJointsPage.shoulderVertical", rightMotor: "shoulder_vertical_right", leftMotor: "shoulder_vertical_left"},
    {label: "jointControl.allJointsPage.shoulderHorizontal", rightMotor: "shoulder_horizontal_right", leftMotor: "shoulder_horizontal_left"},
    {label: "jointControl.allJointsPage.upperArmRotation", rightMotor: "upper_arm_right_rotation", leftMotor: "upper_arm_left_rotation"},
    {label: "jointControl.allJointsPage.elbow", rightMotor: "elbow_right", leftMotor: "elbow_left"},
    {label: "jointControl.allJointsPage.lowerArmRotation", rightMotor: "lower_arm_right_rotation", leftMotor: "lower_arm_left_rotation"},
    {label: "jointControl.allJointsPage.wrist", rightMotor: "wrist_right", leftMotor: "wrist_left"},
    // Quick all-at-once open/close: the backend multi-motor names
    // "all_fingers_left/right" fan a single position out to every finger
    // motor of that hand (see pib_motors/motor.py). Individual finger
    // sliders follow below for fine control of one finger at a time.
    {label: "jointControl.allJointsPage.handOpenClose", rightMotor: "all_fingers_right", leftMotor: "all_fingers_left"},
    {label: "jointControl.allJointsPage.thumbOpposition", rightMotor: "thumb_right_opposition", leftMotor: "thumb_left_opposition"},
    {label: "jointControl.allJointsPage.thumbStretch", rightMotor: "thumb_right_stretch", leftMotor: "thumb_left_stretch"},
    {label: "jointControl.allJointsPage.indexStretch", rightMotor: "index_right_stretch", leftMotor: "index_left_stretch"},
    {label: "jointControl.allJointsPage.middleStretch", rightMotor: "middle_right_stretch", leftMotor: "middle_left_stretch"},
    {label: "jointControl.allJointsPage.ringStretch", rightMotor: "ring_right_stretch", leftMotor: "ring_left_stretch"},
    {label: "jointControl.allJointsPage.pinkyStretch", rightMotor: "pinky_right_stretch", leftMotor: "pinky_left_stretch"},
];

// head joints have no left/right counterpart - full-width rows at the top
const HEAD_ROWS: {label: string; motor: string}[] = [
    {label: "jointControl.allJointsPage.turnHead", motor: "turn_head_motor"},
    {label: "jointControl.allJointsPage.tiltHead", motor: "tilt_forward_motor"},
];

// don't spam the ROS service while dragging a slider
const SEND_INTERVAL_MS = 100;

// step used by the "widen limit" nudge buttons, see widenLimit()
const WIDEN_STEP_HUNDREDTHS = 500; // 5 degrees

/**
 * "Alle Gelenke": every limb of the robot on one page, movable via one
 * slider each - no need to hop between the per-bodypart Joint Control tabs.
 */
@Component({
    selector: "app-all-joints",
    templateUrl: "./all-joints.component.html",
    styleUrls: ["./all-joints.component.scss"],
})
export class AllJointsComponent implements OnInit, OnDestroy {
    mirroredRows = MIRRORED_ROWS;
    headRows = HEAD_ROWS;

    motorValues: {[motor: string]: number} = {};
    motorRanges: {[motor: string]: {min: number; max: number}} = {};
    motorCurrents: {[motor: string]: number} = {};
    motorSettings: {[motor: string]: MotorSettings} = {};
    // Purely visual, per-session slider flip (checkbox in front of each
    // slider) - lets the user make a slider's drag direction feel
    // intuitive without touching the motor's actual rotation range/
    // direction in the backend. Not persisted.
    invertedMotors: {[motor: string]: boolean} = {};
    // Single checkbox at the top of the page - shows/hides the motor
    // current (mA) reading next to every slider at once.
    showMotorCurrent = false;
    // Single checkbox at the top of the page - beim manuellen Posieren
    // (z.B. vor "Save current Pose") bewegt sich die andere Körperseite
    // automatisch mit auf denselben Wert. Motion Capture nutzt fuer
    // rechte/linke Gelenke bereits denselben Rohwert ohne Vorzeichenumkehr
    // fuer eine symmetrische Bewegung (siehe retargeting.py
    // DEFAULT_ASSIGNMENT) - "spiegeln" heisst hier also schlicht: gleicher
    // Wert auf beiden Seiten.
    mirrorMovements = false;
    // Checkbox at the top: shows the "als Min/Max setzen" buttons next to
    // every slider, so a joint's current (physical) position can be taken
    // over as its new rotation range limit - this range is enforced by
    // pib_motors.motor.Motor._validate_position() for EVERY motion source
    // (manual control, poses, programs), so setting it here applies
    // globally and prevents unnatural over-rotation. Forces showMotorCurrent
    // on too: watching the current spike as a joint nears its mechanical
    // hard stop is how you find a safe limit *before* reaching it.
    jointLimitsMode = false;
    limitError: {[motor: string]: string} = {};
    // "Gelenkgrenzen einstellen" ist ein technisches Feature fuer den
    // gleichen Nutzerkreis wie der "System"-Menuepunkt (Einstellungen >
    // Menüpunkte) - blendet mit ihm zusammen aus/ein.
    systemVisible = false;

    private subscriptions = new Subscription();
    private lastSendTime: {[motor: string]: number} = {};
    private pendingSend: {[motor: string]: ReturnType<typeof setTimeout>} = {};
    // motor -> Gegenstueck der anderen Koerperseite (nur Zeilen aus
    // mirroredRows - Kopf-Gelenke haben kein Gegenstueck).
    private mirrorPartner: {[motor: string]: string} = {};

    constructor(
        private motorService: MotorService,
        private systemSettingsService: SystemSettingsService,
    ) {}

    ngOnInit(): void {
        this.subscriptions.add(
            this.systemSettingsService.menuVisibilitySubject.subscribe(
                (visibility) => {
                    // MenuVisibility-Felder sind "true = ausgeblendet"
                    // (siehe menu-visibility.ts) - hier invertiert.
                    this.systemVisible = !visibility.system;
                    if (!this.systemVisible) {
                        this.jointLimitsMode = false;
                    }
                },
            ),
        );
        const allMotors = [
            ...this.headRows.map((row) => row.motor),
            ...this.mirroredRows.flatMap((row) => [row.rightMotor, row.leftMotor]),
        ];
        for (const row of this.mirroredRows) {
            this.mirrorPartner[row.rightMotor] = row.leftMotor;
            this.mirrorPartner[row.leftMotor] = row.rightMotor;
        }
        for (const motor of allMotors) {
            this.motorValues[motor] = 0;
            this.motorRanges[motor] = {min: -9000, max: 9000};
            this.subscriptions.add(
                this.motorService
                    .getSettingsObservable(motor)
                    .subscribe((settings) => {
                        this.motorSettings[motor] = settings;
                        this.motorRanges[motor] = {
                            min: settings.rotationRangeMin,
                            max: settings.rotationRangeMax,
                        };
                    }),
            );
            this.subscriptions.add(
                this.motorService
                    .getPositionObservable(motor)
                    .subscribe((position) => {
                        this.motorValues[motor] = position;
                    }),
            );
            this.motorCurrents[motor] = 0;
            this.subscriptions.add(
                this.motorService
                    .getCurrentObservable(motor)
                    .subscribe((current) => {
                        this.motorCurrents[motor] = current;
                    }),
            );
        }
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
        for (const timeout of Object.values(this.pendingSend)) {
            clearTimeout(timeout);
        }
    }

    toggleInvert(motor: string, inverted: boolean): void {
        this.invertedMotors[motor] = inverted;
    }

    toggleJointLimitsMode(enabled: boolean): void {
        this.jointLimitsMode = enabled;
        if (enabled) {
            this.showMotorCurrent = true;
        }
    }

    isAggregateMotor(motor: string): boolean {
        return AGGREGATE_MOTORS.includes(motor);
    }

    /** Takes the joint's current position and stores it as its new
     * rotation-range min/max - enforced globally from then on (see
     * pib_motors.motor.Motor._validate_position()). */
    setLimitFromCurrentPosition(motor: string, bound: "min" | "max"): void {
        const settings = this.motorSettings[motor];
        if (!settings) return;
        const position = this.motorValues[motor];

        if (bound === "min" && position >= settings.rotationRangeMax) {
            this.limitError[motor] =
                "jointControl.allJointsPage.limitErrorMin";
            return;
        }
        if (bound === "max" && position <= settings.rotationRangeMin) {
            this.limitError[motor] =
                "jointControl.allJointsPage.limitErrorMax";
            return;
        }
        delete this.limitError[motor];

        this.motorService.applySettings(motor, {
            ...settings,
            rotationRangeMin: bound === "min" ? position : settings.rotationRangeMin,
            rotationRangeMax: bound === "max" ? position : settings.rotationRangeMax,
        });
    }

    /** Once "Als Min/Max setzen" narrows a joint's range, the slider itself
     * can never drag past that new bound again - there'd be no way back to
     * correct it to something wider. This nudges the real limit outward by
     * a small, deliberate step (still watching the motor current!) so the
     * slider can reach further again, before setLimitFromCurrentPosition()
     * commits the final value. */
    widenLimit(motor: string, bound: "min" | "max"): void {
        const settings = this.motorSettings[motor];
        if (!settings) return;
        delete this.limitError[motor];
        this.motorService.applySettings(motor, {
            ...settings,
            rotationRangeMin:
                bound === "min"
                    ? Math.max(
                          settings.rotationRangeMin - WIDEN_STEP_HUNDREDTHS,
                          -9000,
                      )
                    : settings.rotationRangeMin,
            rotationRangeMax:
                bound === "max"
                    ? Math.min(
                          settings.rotationRangeMax + WIDEN_STEP_HUNDREDTHS,
                          9000,
                      )
                    : settings.rotationRangeMax,
        });
    }

    onSliderInput(motor: string, value: string): void {
        const position = Number(value);
        this.motorValues[motor] = position;
        this.sendThrottled(motor, position);

        if (this.mirrorMovements) {
            const partner = this.mirrorPartner[motor];
            if (partner) {
                const range = this.motorRanges[partner];
                const mirroredPosition = Math.min(
                    range.max,
                    Math.max(range.min, position),
                );
                this.motorValues[partner] = mirroredPosition;
                this.sendThrottled(partner, mirroredPosition);
            }
        }
    }

    /** Rate-limits per motor, but always delivers the LAST value - so the
     * joint ends up exactly where the slider was released. */
    private sendThrottled(motor: string, position: number): void {
        const now = Date.now();
        const elapsed = now - (this.lastSendTime[motor] ?? 0);
        if (this.pendingSend[motor] !== undefined) {
            clearTimeout(this.pendingSend[motor]);
        }
        if (elapsed >= SEND_INTERVAL_MS) {
            this.lastSendTime[motor] = now;
            this.motorService.setPosition(motor, position).subscribe();
        } else {
            this.pendingSend[motor] = setTimeout(() => {
                delete this.pendingSend[motor];
                this.lastSendTime[motor] = Date.now();
                this.motorService.setPosition(motor, position).subscribe();
            }, SEND_INTERVAL_MS - elapsed);
        }
    }

    degrees(motor: string): number {
        return Math.round((this.motorValues[motor] ?? 0) / 100);
    }

    /** rotationRangeMin/Max are stored in 1/100 degree units, like position. */
    hundredthsToDegrees(hundredths: number): number {
        return Math.round(hundredths / 100);
    }
}
