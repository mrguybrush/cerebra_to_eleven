import {
    AfterViewInit,
    Component,
    ElementRef,
    OnDestroy,
    ViewChild,
} from "@angular/core";
import {Observable, Subscription} from "rxjs";
import {
    BrowserPoseTrackerService,
    NamedLandmark,
    PoseSource,
} from "src/app/shared/services/browser-pose-tracker.service";
import {RosService} from "src/app/shared/services/ros-service/ros.service";
import {JointMappingService} from "src/app/shared/services/joint-mapping.service";
import {JointMappingEntry, JointSide} from "src/app/shared/types/joint-mapping";
import {MotionCaptureSettingsService} from "src/app/shared/services/motion-capture-settings.service";

// Rumpf/Gesicht: rein visueller Kontext, ohne Zuordnung zu einem Motor -
// bleiben neutral eingefaerbt (kein Zuordnungsfarbe).
const CONTEXT_CONNECTIONS: [string, string][] = [
    ["left_shoulder", "right_shoulder"],
    ["left_shoulder", "left_hip"],
    ["right_shoulder", "right_hip"],
    ["left_hip", "right_hip"],
    ["left_ear", "left_eye"],
    ["left_eye", "nose"],
    ["nose", "right_eye"],
    ["right_eye", "right_ear"],
];

// Regionen, denen Motoren zugeordnet werden koennen - jede bekommt pro Seite
// eine feste Videofarbe (siehe SEGMENT_COLORS), unabhaengig davon, welcher
// Motor gerade zugeordnet ist. Die Zuordnungstabelle zeigt fuer jede Zeile
// die Farbe der aktuell gewaehlten Quellseite - das ist der visuelle Link
// zwischen Tabelle und Videobild.
type SegmentGroup = "upper_arm" | "lower_arm" | "hand";

const SEGMENT_COLORS: {[group in SegmentGroup]: {left: string; right: string}} = {
    upper_arm: {left: "#ff9100", right: "#00b0ff"},
    lower_arm: {left: "#ffea00", right: "#1de9b6"},
    hand: {left: "#d500f9", right: "#ff1744"},
};

// Knochen-Linien werden neutral gezeichnet (nur Kontext). Die Regionsfarbe
// sitzt jetzt auf den GELENKPUNKTEN (siehe COLORED_JOINT_POINTS in
// drawSkeleton) - dort entsteht der Winkel, und die Tabellenfarbe zeigt
// direkt auf den passenden Punkt im Video.
const BONE_CONNECTIONS: [string, string][] = [
    ["left_shoulder", "left_elbow"],
    ["left_elbow", "left_wrist"],
    ["right_shoulder", "right_elbow"],
    ["right_elbow", "right_wrist"],
];

// Welcher Gelenkpunkt bekommt welche Regionsfarbe (passend zur Tabelle):
// Schulterpunkt = Oberarm-Region, Ellbogenpunkt = Unterarm-Region,
// Handgelenkpunkt = Hand-Region.
const COLORED_JOINT_POINTS: {name: string; group: SegmentGroup; side: JointSide}[] = [
    {name: "left_shoulder", group: "upper_arm", side: "left"},
    {name: "right_shoulder", group: "upper_arm", side: "right"},
    {name: "left_elbow", group: "lower_arm", side: "left"},
    {name: "right_elbow", group: "lower_arm", side: "right"},
    {name: "left_wrist", group: "hand", side: "left"},
    {name: "right_wrist", group: "hand", side: "right"},
];

const VISIBILITY_THRESHOLD = 0.5;

// The robot joints live mirroring can drive - motor names exactly as in
// pibdata.db (same names the gesture_control backend maps to). Hip/torso
// are deliberately not offered here (legs don't exist as motors at all).
// groupMotors (hand rows only): one row drives all 6 finger motors of a
// side together as one open/close signal - motor is the representative used
// for display/selection, groupMotors the full list saved/enabled.
interface JointRow {
    motor: string;
    labelKey: string;
    group: SegmentGroup;
    groupMotors?: string[];
}

const HAND_LEFT_MOTORS = [
    "index_left_stretch",
    "middle_left_stretch",
    "ring_left_stretch",
    "pinky_left_stretch",
    "thumb_left_stretch",
    "thumb_left_opposition",
];
const HAND_RIGHT_MOTORS = [
    "index_right_stretch",
    "middle_right_stretch",
    "ring_right_stretch",
    "pinky_right_stretch",
    "thumb_right_stretch",
    "thumb_right_opposition",
];

const JOINT_ROWS: JointRow[] = [
    {motor: "shoulder_vertical_left", labelKey: "motionCapture.joints.shoulderVerticalLeft", group: "upper_arm"},
    {motor: "shoulder_vertical_right", labelKey: "motionCapture.joints.shoulderVerticalRight", group: "upper_arm"},
    {motor: "shoulder_horizontal_left", labelKey: "motionCapture.joints.shoulderHorizontalLeft", group: "upper_arm"},
    {motor: "shoulder_horizontal_right", labelKey: "motionCapture.joints.shoulderHorizontalRight", group: "upper_arm"},
    {motor: "upper_arm_left_rotation", labelKey: "motionCapture.joints.upperArmLeftRotation", group: "upper_arm"},
    {motor: "upper_arm_right_rotation", labelKey: "motionCapture.joints.upperArmRightRotation", group: "upper_arm"},
    {motor: "elbow_left", labelKey: "motionCapture.joints.elbowLeft", group: "lower_arm"},
    {motor: "elbow_right", labelKey: "motionCapture.joints.elbowRight", group: "lower_arm"},
    {motor: "lower_arm_left_rotation", labelKey: "motionCapture.joints.lowerArmLeftRotation", group: "lower_arm"},
    {motor: "lower_arm_right_rotation", labelKey: "motionCapture.joints.lowerArmRightRotation", group: "lower_arm"},
    {
        motor: "middle_left_stretch",
        labelKey: "motionCapture.joints.handLeft",
        group: "hand",
        groupMotors: HAND_LEFT_MOTORS,
    },
    {
        motor: "middle_right_stretch",
        labelKey: "motionCapture.joints.handRight",
        group: "hand",
        groupMotors: HAND_RIGHT_MOTORS,
    },
];

// Preselected joints: the ones whose angles are robustly recoverable from
// the camera image. Rotation joints and the hands are experimental - the
// user enables them explicitly by clicking their row.
const DEFAULT_SELECTED_JOINTS = [
    "shoulder_vertical_left",
    "shoulder_vertical_right",
    "elbow_left",
    "elbow_right",
];

// Matches gesture_control/retargeting.py's MOTOR_TO_CANDIDATE exactly - the
// mapping table needs to know which raw candidate (computed for BOTH
// tracked sides) feeds a given motor, to show its live left/right values.
const MOTOR_TO_CANDIDATE_KEY: {[motor: string]: string} = {
    elbow_left: "elbow",
    elbow_right: "elbow",
    shoulder_vertical_left: "shoulder_vertical",
    shoulder_vertical_right: "shoulder_vertical",
    shoulder_horizontal_left: "shoulder_horizontal",
    shoulder_horizontal_right: "shoulder_horizontal",
    upper_arm_left_rotation: "upper_arm_rotation",
    upper_arm_right_rotation: "upper_arm_rotation",
    lower_arm_left_rotation: "lower_arm_rotation",
    lower_arm_right_rotation: "lower_arm_rotation",
    // Both hand rows (representative motor = middle_*_stretch) show the one
    // combined open/close candidate.
    middle_left_stretch: "hand_openness",
    middle_right_stretch: "hand_openness",
};

interface RowMappingState {
    sourceSide: JointSide;
    invert: boolean;
    candidateLowDeg: number | null;
    candidateHighDeg: number | null;
    minDeg: number | null;
    maxDeg: number | null;
    speedPercent: number;
}

/**
 * Dedicated live motion-capture view: the camera image (robot camera or
 * own webcam) with the detected skeleton drawn over it in real time, plus
 * a table of all recognized joint angles that also doubles as the
 * side/invert assignment editor (colors link a table row to the matching
 * video segment). Detection runs in the browser (see
 * BrowserPoseTrackerService); landmarks are also published to ROS as usual,
 * but nothing moves motors unless a capture is started on the Poses page or
 * live mirroring is switched on here.
 */
@Component({
    selector: "app-motion-capture",
    templateUrl: "./motion-capture.component.html",
    styleUrls: ["./motion-capture.component.css"],
})
export class MotionCaptureComponent implements AfterViewInit, OnDestroy {
    @ViewChild("overlayCanvas") overlayCanvas!: ElementRef<HTMLCanvasElement>;

    poseSource: PoseSource = "robot";
    running = false;
    starting = false;
    // Live mirroring: while true, pib's motors follow the tracked person.
    // Deliberately NOT persisted and reset to off on every stop/leave -
    // motor motion must always be a fresh, conscious decision.
    motorsActive = false;

    jointAngles$: Observable<{[label: string]: number}>;
    error$: Observable<string | null>;
    framesReceived$: Observable<number>;
    landmarkerReady$: Observable<boolean>;

    // Robot-joint table: always shown; each row is clickable to include
    // that joint in the mirroring, and carries its own side/invert
    // assignment (replaces the former step-by-step calibration wizard).
    // Live values come from the gesture_control backend (topic
    // gesture_retarget_targets, centidegrees).
    jointRows = JOINT_ROWS;
    selectedJoints = new Set<string>(DEFAULT_SELECTED_JOINTS);
    liveTargets: {[motor: string]: number} = {};
    handsDetected$: Observable<{left: boolean; right: boolean}>;

    // Per-row source-side/invert assignment, editable directly in the table.
    // Loaded from the DB on init; every change is saved immediately.
    mapping: {[motor: string]: RowMappingState} = {};
    liveCandidates: {[candidateKey: string]: {left: number | null; right: number | null}} =
        {};
    mappingSaved = false;

    // Globale Regler über der Tabelle (motion_capture_settings-Singleton).
    smoothingAlpha = 0.4;
    evalMaxHz = 12;

    private frameSubscription?: Subscription;
    private targetsSubscription?: Subscription;
    private candidatesSubscription?: Subscription;
    private frameImage = new Image();

    constructor(
        private tracker: BrowserPoseTrackerService,
        private rosService: RosService,
        private jointMappingService: JointMappingService,
        private settingsService: MotionCaptureSettingsService,
    ) {
        this.jointAngles$ = this.tracker.jointAngles$;
        this.error$ = this.tracker.error$;
        this.framesReceived$ = this.tracker.framesReceived$;
        this.landmarkerReady$ = this.tracker.landmarkerReady$;
        this.handsDetected$ = this.tracker.handsDetected$;
    }

    ngAfterViewInit(): void {
        this.frameSubscription = this.tracker.frame$.subscribe((dataUrl) => {
            if (dataUrl) {
                this.drawFrame(dataUrl);
            }
        });
        this.targetsSubscription =
            this.rosService.gestureRetargetTargetsReceiver$.subscribe(
                (json: string) => {
                    try {
                        this.liveTargets = JSON.parse(json).targets ?? {};
                    } catch {
                        this.liveTargets = {};
                    }
                },
            );
        this.candidatesSubscription =
            this.rosService.gestureRetargetCandidatesReceiver$.subscribe(
                (json: string) => {
                    try {
                        this.liveCandidates = JSON.parse(json) ?? {};
                    } catch {
                        this.liveCandidates = {};
                    }
                },
            );
        // If tracking is already running (started on another page), just
        // reflect that instead of forcing a restart.
        this.running = this.tracker.isRunning();
        // Tell the backend which joints the mirroring may drive - it keeps
        // the last selection otherwise, which may be stale from an earlier
        // session on this page.
        this.rosService.setGestureJoints(Array.from(this.selectedJoints));
        this.loadMapping();
        this.loadSettings();
    }

    /** Loads the global smoothing / eval-rate settings and applies the
     * eval-rate cap to the tracker (latency control). */
    private loadSettings() {
        this.settingsService.getSettings().subscribe((s) => {
            this.smoothingAlpha = s.smoothingAlpha;
            this.evalMaxHz = s.evalMaxHz;
            this.applyEvalRate();
        });
    }

    private applyEvalRate() {
        const hz = this.evalMaxHz > 0 ? this.evalMaxHz : 0;
        this.tracker.setEvalIntervalMs(hz > 0 ? 1000 / hz : 0);
    }

    /** Smoothing slider changed: persist and tell the ROS node to re-read
     * (reuses the existing reload path - the node reads smoothing_alpha in
     * _load_assignment). */
    onSmoothingChange(rawValue: string) {
        const value = Number(rawValue);
        if (Number.isNaN(value)) {
            return;
        }
        this.smoothingAlpha = Math.min(1, Math.max(0.05, value));
        this.settingsService
            .updateSettings({smoothingAlpha: this.smoothingAlpha})
            .subscribe(() => this.rosService.reloadGestureMapping());
    }

    /** Max evaluations/second changed: persist and apply the cap locally. */
    onEvalHzChange(rawValue: string) {
        const value = Number(rawValue);
        if (Number.isNaN(value)) {
            return;
        }
        this.evalMaxHz = Math.min(30, Math.max(1, value));
        this.applyEvalRate();
        this.settingsService.updateSettings({evalMaxHz: this.evalMaxHz}).subscribe();
    }

    /** Source dropdown changed (robot <-> webcam): if tracking is running,
     * cleanly stop the old source and start the new one. Over http:// the
     * webcam start surfaces the HTTPS hint via error$ (browser policy). */
    onSourceChange() {
        if (this.running) {
            this.stop();
            this.start();
        }
    }

    ngOnDestroy(): void {
        this.frameSubscription?.unsubscribe();
        this.targetsSubscription?.unsubscribe();
        this.candidatesSubscription?.unsubscribe();
        this.setMotorsActive(false);
        // Leaving the page stops tracking - it exists for live viewing, and
        // an ongoing gesture capture on the Poses page keeps its own tracker
        // session there.
        if (this.running) {
            this.tracker.stop();
        }
    }

    /** Toggle for live motor mirroring. Off = robot freezes in place. */
    setMotorsActive(active: boolean) {
        if (this.motorsActive === active) {
            return;
        }
        this.motorsActive = active;
        if (active) {
            // send the joint selection first, so mirroring never starts
            // with a stale set of joints
            this.rosService.setGestureJoints(Array.from(this.selectedJoints));
        }
        this.rosService.setGestureMirroring(active);
    }

    /** Click on a table row: include/exclude this joint (or, for a hand
     * row, all 6 of its finger motors together) in the mirroring. */
    toggleJoint(row: JointRow) {
        const motors = row.groupMotors ?? [row.motor];
        const enabling = !this.selectedJoints.has(row.motor);
        for (const motor of motors) {
            if (enabling) {
                this.selectedJoints.add(motor);
            } else {
                this.selectedJoints.delete(motor);
            }
        }
        this.rosService.setGestureJoints(Array.from(this.selectedJoints));
    }

    isRowSelected(row: JointRow): boolean {
        return this.selectedJoints.has(row.motor);
    }

    /** Live value for a joint in degrees, or null if currently not detected. */
    liveDegrees(motor: string): number | null {
        const centideg = this.liveTargets[motor];
        return centideg === undefined ? null : centideg / 100;
    }

    /** Live per-side candidate values (both, regardless of current
     * assignment) - lets the user compare left/right before picking. */
    candidateLeft(row: JointRow): number | null {
        return this.liveCandidates[MOTOR_TO_CANDIDATE_KEY[row.motor]]?.left ?? null;
    }

    candidateRight(row: JointRow): number | null {
        return this.liveCandidates[MOTOR_TO_CANDIDATE_KEY[row.motor]]?.right ?? null;
    }

    // --- Zuordnungstabelle (ersetzt den frueheren Schritt-fuer-Schritt-
    // Kalibrierungs-Assistenten): jede Zeile zeigt live BEIDE Seiten
    // (links/rechts) fuer ihr Gelenk, der Nutzer waehlt per Dropdown selbst,
    // welche seine ist - inkl. Vorzeichen-Umkehr per Checkbox, falls die
    // Bewegung seitenverkehrt ausschlaegt. Jede Aenderung speichert sofort. ---

    /** Loads the saved mapping (or defaults: same-side, not inverted,
     * uncalibrated/unlimited, full speed). */
    private loadMapping() {
        this.mapping = {};
        for (const row of this.jointRows) {
            const defaultSide: JointSide = row.motor.includes("_left")
                ? "left"
                : "right";
            this.mapping[row.motor] = {
                sourceSide: defaultSide,
                invert: false,
                candidateLowDeg: null,
                candidateHighDeg: null,
                minDeg: null,
                maxDeg: null,
                speedPercent: 100,
            };
        }
        this.jointMappingService.getMapping().subscribe((entries) => {
            for (const entry of entries) {
                if (this.mapping[entry.motorName]) {
                    this.mapping[entry.motorName] = {
                        sourceSide: entry.sourceSide,
                        invert: entry.invert,
                        candidateLowDeg: entry.candidateLowDeg,
                        candidateHighDeg: entry.candidateHighDeg,
                        minDeg: entry.minDeg,
                        maxDeg: entry.maxDeg,
                        speedPercent: entry.speedPercent,
                    };
                }
            }
        });
    }

    /** Color swatch for a table row: the fixed video-segment color of its
     * region, for whichever side is currently assigned as the source - so
     * flipping the dropdown immediately matches the line actually driving
     * this motor in the video. */
    rowColor(row: JointRow): string {
        const side = this.mapping[row.motor]?.sourceSide ?? "left";
        return SEGMENT_COLORS[row.group][side];
    }

    onSourceSideChange(row: JointRow, side: JointSide) {
        this.mapping[row.motor] = {...this.mapping[row.motor], sourceSide: side};
        this.saveMapping();
    }

    onInvertChange(row: JointRow, invert: boolean) {
        this.mapping[row.motor] = {...this.mapping[row.motor], invert};
        this.saveMapping();
    }

    /** Handler for the numeric tuning inputs. All four may be cleared to
     * "unset" (empty input -> null): candidateLow/HighDeg = not yet
     * calibrated (code fallback applies), minDeg/maxDeg = no extra limit.
     * speedPercent has its own onSpeedChange below (never "unset"). */
    onNumberFieldChange(
        row: JointRow,
        field: "candidateLowDeg" | "candidateHighDeg" | "minDeg" | "maxDeg",
        rawValue: string,
    ) {
        const value = rawValue.trim() === "" ? null : Number(rawValue);
        if (value !== null && Number.isNaN(value)) {
            return;
        }
        this.mapping[row.motor] = {...this.mapping[row.motor], [field]: value};
        this.saveMapping();
    }

    onSpeedChange(row: JointRow, rawValue: string) {
        const value = Number(rawValue);
        if (Number.isNaN(value)) {
            return;
        }
        this.mapping[row.motor] = {
            ...this.mapping[row.motor],
            speedPercent: Math.min(100, Math.max(0, value)),
        };
        this.saveMapping();
    }

    /** "Ist-Wert": reads a live value and stores it, so the user doesn't
     * have to read the number off the table and retype it by hand.
     * candidateLowDeg/candidateHighDeg (the "unten"/"oben" calibration
     * anchors) capture the raw camera reading for whichever side is
     * currently the row's source - move the joint there first, then click.
     * minDeg/maxDeg (absolute output limits) instead capture the actual
     * LIVE MOTOR TARGET (post-calibration), since they constrain the
     * output, not the camera input. */
    useCurrentAsField(
        row: JointRow,
        field: "candidateLowDeg" | "candidateHighDeg" | "minDeg" | "maxDeg",
    ) {
        let value: number | null;
        if (field === "candidateLowDeg" || field === "candidateHighDeg") {
            const side = this.mapping[row.motor]?.sourceSide;
            value = side === "right" ? this.candidateRight(row) : this.candidateLeft(row);
        } else {
            value = this.liveDegrees(row.motor);
        }
        if (value === null) {
            return;
        }
        this.mapping[row.motor] = {...this.mapping[row.motor], [field]: value};
        this.saveMapping();
    }

    private saveMapping() {
        const entries: JointMappingEntry[] = [];
        for (const row of this.jointRows) {
            const state = this.mapping[row.motor];
            // Hand rows fan their one calibration out to all 6 finger motors
            // of the side (they share the hand_openness candidate).
            for (const motorName of row.groupMotors ?? [row.motor]) {
                entries.push({
                    motorName,
                    sourceSide: state.sourceSide,
                    invert: state.invert,
                    candidateLowDeg: state.candidateLowDeg,
                    candidateHighDeg: state.candidateHighDeg,
                    minDeg: state.minDeg,
                    maxDeg: state.maxDeg,
                    speedPercent: state.speedPercent,
                });
            }
        }
        this.jointMappingService.saveMapping(entries).subscribe(() => {
            this.rosService.reloadGestureMapping();
            this.mappingSaved = true;
            setTimeout(() => (this.mappingSaved = false), 3000);
        });
    }

    start() {
        this.starting = true;
        this.tracker
            .start(this.poseSource)
            .then(() => (this.running = true))
            .catch(() => {
                // error text is surfaced via error$ in the template
            })
            .finally(() => (this.starting = false));
    }

    stop() {
        this.setMotorsActive(false);
        this.tracker.stop();
        this.running = false;
        const canvas = this.overlayCanvas?.nativeElement;
        canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }

    private drawFrame(dataUrl: string) {
        const canvas = this.overlayCanvas?.nativeElement;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) {
            return;
        }

        this.frameImage.onload = () => {
            canvas.width = this.frameImage.naturalWidth;
            canvas.height = this.frameImage.naturalHeight;

            // Mirror the webcam view so it behaves like a mirror; the robot
            // camera looks AT the person, which already feels mirror-like.
            const mirror = this.poseSource === "webcam";
            ctx.save();
            if (mirror) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(this.frameImage, 0, 0, canvas.width, canvas.height);
            this.drawSkeleton(ctx, canvas.width, canvas.height);
            ctx.restore();
        };
        this.frameImage.src = dataUrl;
    }

    private drawSkeleton(ctx: CanvasRenderingContext2D, w: number, h: number) {
        const landmarks = this.tracker.landmarks$.value;
        if (landmarks.length === 0) {
            return;
        }
        const byName: {[name: string]: NamedLandmark} = {};
        for (const lm of landmarks) {
            byName[lm.name] = lm;
        }

        const lineWidth = Math.max(2, w / 200);
        ctx.lineCap = "round";

        const drawLine = (fromName: string, toName: string, color: string) => {
            const from = byName[fromName];
            const to = byName[toName];
            if (
                !from ||
                !to ||
                from.score < VISIBILITY_THRESHOLD ||
                to.score < VISIBILITY_THRESHOLD
            ) {
                return;
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(from.x * w, from.y * h);
            ctx.lineTo(to.x * w, to.y * h);
            ctx.stroke();
        };

        // Alle Knochen (Rumpf/Gesicht + Arme) neutral grau - reiner Kontext.
        // Die Regionsfarbe sitzt jetzt auf den Gelenkpunkten (unten).
        for (const [fromName, toName] of [...CONTEXT_CONNECTIONS, ...BONE_CONNECTIONS]) {
            drawLine(fromName, toName, "#607d8b");
        }

        // Zuerst alle sichtbaren Gelenkpunkte klein/weiss (ausser Beine).
        for (const lm of landmarks) {
            if (lm.score < VISIBILITY_THRESHOLD) {
                continue;
            }
            if (
                lm.name === "left_knee" ||
                lm.name === "left_ankle" ||
                lm.name === "right_knee" ||
                lm.name === "right_ankle"
            ) {
                continue;
            }
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(lm.x * w, lm.y * h, lineWidth * 1.0, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Dann die zuordnungsrelevanten Gelenke gross + in Regionsfarbe -
        // dort entsteht der Winkel, und die Farbe matcht die Tabellenzeile
        // (Schulter=Oberarm, Ellbogen=Unterarm, Handgelenk=Hand).
        for (const jp of COLORED_JOINT_POINTS) {
            const lm = byName[jp.name];
            if (!lm || lm.score < VISIBILITY_THRESHOLD) {
                continue;
            }
            ctx.fillStyle = SEGMENT_COLORS[jp.group][jp.side];
            ctx.beginPath();
            ctx.arc(lm.x * w, lm.y * h, lineWidth * 2.4, 0, 2 * Math.PI);
            ctx.fill();
            // dunkler Rand fuer Kontrast auf hellem Hintergrund
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.lineWidth = Math.max(1, lineWidth * 0.4);
            ctx.stroke();
        }
    }
}
