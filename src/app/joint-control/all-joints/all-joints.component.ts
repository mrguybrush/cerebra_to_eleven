import {Component, OnDestroy, OnInit} from "@angular/core";
import {Subscription} from "rxjs";
import {MotorService} from "src/app/shared/services/motor.service";

// One table row: the same joint on both body sides. Column order is
// MIRRORED on purpose (facing the robot): the LEFT table column drives the
// robot's RIGHT side, the RIGHT table column its LEFT side.
interface MirroredJointRow {
    label: string;
    rightMotor: string; // robot's right side -> left table column
    leftMotor: string; // robot's left side -> right table column
}

const MIRRORED_ROWS: MirroredJointRow[] = [
    {label: "Schulter vertikal", rightMotor: "shoulder_vertical_right", leftMotor: "shoulder_vertical_left"},
    {label: "Schulter horizontal", rightMotor: "shoulder_horizontal_right", leftMotor: "shoulder_horizontal_left"},
    {label: "Oberarm-Drehung", rightMotor: "upper_arm_right_rotation", leftMotor: "upper_arm_left_rotation"},
    {label: "Ellbogen", rightMotor: "elbow_right", leftMotor: "elbow_left"},
    {label: "Unterarm-Drehung", rightMotor: "lower_arm_right_rotation", leftMotor: "lower_arm_left_rotation"},
    {label: "Handgelenk", rightMotor: "wrist_right", leftMotor: "wrist_left"},
    // Quick all-at-once open/close: the backend multi-motor names
    // "all_fingers_left/right" fan a single position out to every finger
    // motor of that hand (see pib_motors/motor.py). Individual finger
    // sliders follow below for fine control of one finger at a time.
    {label: "Hand (öffnen/schließen)", rightMotor: "all_fingers_right", leftMotor: "all_fingers_left"},
    {label: "Daumen-Opposition", rightMotor: "thumb_right_opposition", leftMotor: "thumb_left_opposition"},
    {label: "Daumen strecken", rightMotor: "thumb_right_stretch", leftMotor: "thumb_left_stretch"},
    {label: "Zeigefinger strecken", rightMotor: "index_right_stretch", leftMotor: "index_left_stretch"},
    {label: "Mittelfinger strecken", rightMotor: "middle_right_stretch", leftMotor: "middle_left_stretch"},
    {label: "Ringfinger strecken", rightMotor: "ring_right_stretch", leftMotor: "ring_left_stretch"},
    {label: "Kleiner Finger strecken", rightMotor: "pinky_right_stretch", leftMotor: "pinky_left_stretch"},
];

// head joints have no left/right counterpart - full-width rows at the top
const HEAD_ROWS: {label: string; motor: string}[] = [
    {label: "Kopf drehen", motor: "turn_head_motor"},
    {label: "Kopf neigen", motor: "tilt_forward_motor"},
];

// don't spam the ROS service while dragging a slider
const SEND_INTERVAL_MS = 100;

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
    // Purely visual, per-session slider flip (checkbox in front of each
    // slider) - lets the user make a slider's drag direction feel
    // intuitive without touching the motor's actual rotation range/
    // direction in the backend. Not persisted.
    invertedMotors: {[motor: string]: boolean} = {};
    // Single checkbox at the top of the page - shows/hides the motor
    // current (mA) reading next to every slider at once.
    showMotorCurrent = false;

    private subscriptions = new Subscription();
    private lastSendTime: {[motor: string]: number} = {};
    private pendingSend: {[motor: string]: ReturnType<typeof setTimeout>} = {};

    constructor(private motorService: MotorService) {}

    ngOnInit(): void {
        const allMotors = [
            ...this.headRows.map((row) => row.motor),
            ...this.mirroredRows.flatMap((row) => [row.rightMotor, row.leftMotor]),
        ];
        for (const motor of allMotors) {
            this.motorValues[motor] = 0;
            this.motorRanges[motor] = {min: -9000, max: 9000};
            this.subscriptions.add(
                this.motorService
                    .getSettingsObservable(motor)
                    .subscribe((settings) => {
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

    onSliderInput(motor: string, value: string): void {
        const position = Number(value);
        this.motorValues[motor] = position;
        this.sendThrottled(motor, position);
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
}
