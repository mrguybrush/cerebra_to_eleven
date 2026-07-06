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

// Bone connections between the named landmarks the tracker exposes -
// drawn as the line skeleton over the live image (green body, pink head
// direction), following the standalone prototype's overlay style.
const BODY_CONNECTIONS: [string, string][] = [
    // Rumpf
    ["left_shoulder", "right_shoulder"],
    ["left_shoulder", "left_hip"],
    ["right_shoulder", "right_hip"],
    ["left_hip", "right_hip"],
    // Arme
    ["left_shoulder", "left_elbow"],
    ["left_elbow", "left_wrist"],
    ["right_shoulder", "right_elbow"],
    ["right_elbow", "right_wrist"],
    // Beine
    ["left_hip", "left_knee"],
    ["left_knee", "left_ankle"],
    ["right_hip", "right_knee"],
    ["right_knee", "right_ankle"],
    // Gesicht
    ["left_ear", "left_eye"],
    ["left_eye", "nose"],
    ["nose", "right_eye"],
    ["right_eye", "right_ear"],
];

const VISIBILITY_THRESHOLD = 0.5;

// The robot joints live mirroring can drive - motor names exactly as in
// pibdata.db (same names the gesture_control backend maps to). Hip/torso
// and fingers are deliberately not offered here.
interface JointRow {
    motor: string;
    label: string;
}

const JOINT_ROWS: JointRow[] = [
    {motor: "shoulder_vertical_left", label: "Schulter heben links"},
    {motor: "shoulder_vertical_right", label: "Schulter heben rechts"},
    {motor: "shoulder_horizontal_left", label: "Schulter horizontal links"},
    {motor: "shoulder_horizontal_right", label: "Schulter horizontal rechts"},
    {motor: "upper_arm_left_rotation", label: "Oberarm-Drehung links"},
    {motor: "upper_arm_right_rotation", label: "Oberarm-Drehung rechts"},
    {motor: "elbow_left", label: "Ellbogen links"},
    {motor: "elbow_right", label: "Ellbogen rechts"},
    {motor: "lower_arm_left_rotation", label: "Unterarm-Drehung links"},
    {motor: "lower_arm_right_rotation", label: "Unterarm-Drehung rechts"},
];

// Preselected joints: the ones whose angles are robustly recoverable from
// the camera image. The rotation joints are experimental - the user enables
// them explicitly by clicking their row.
const DEFAULT_SELECTED_JOINTS = [
    "shoulder_vertical_left",
    "shoulder_vertical_right",
    "elbow_left",
    "elbow_right",
];

/**
 * Dedicated live motion-capture view: the camera image (robot camera or
 * own webcam) with the detected skeleton drawn over it in real time, plus
 * a smoothed table of all recognized joint angles. Detection runs in the
 * browser (see BrowserPoseTrackerService); landmarks are also published to
 * ROS as usual, but nothing moves motors unless a capture is started on
 * the Poses page - this page is pure visualization.
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
    // that joint in the mirroring. Live values come from the gesture_control
    // backend (topic gesture_retarget_targets, centidegrees).
    jointRows = JOINT_ROWS;
    selectedJoints = new Set<string>(DEFAULT_SELECTED_JOINTS);
    liveTargets: {[motor: string]: number} = {};

    private frameSubscription?: Subscription;
    private targetsSubscription?: Subscription;
    private frameImage = new Image();

    constructor(
        private tracker: BrowserPoseTrackerService,
        private rosService: RosService,
    ) {
        this.jointAngles$ = this.tracker.jointAngles$;
        this.error$ = this.tracker.error$;
        this.framesReceived$ = this.tracker.framesReceived$;
        this.landmarkerReady$ = this.tracker.landmarkerReady$;
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
        // If tracking is already running (started on another page), just
        // reflect that instead of forcing a restart.
        this.running = this.tracker.isRunning();
        // Tell the backend which joints the mirroring may drive - it keeps
        // the last selection otherwise, which may be stale from an earlier
        // session on this page.
        this.rosService.setGestureJoints(Array.from(this.selectedJoints));
    }

    ngOnDestroy(): void {
        this.frameSubscription?.unsubscribe();
        this.targetsSubscription?.unsubscribe();
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

    /** Click on a table row: include/exclude this joint in the mirroring. */
    toggleJoint(motor: string) {
        if (this.selectedJoints.has(motor)) {
            this.selectedJoints.delete(motor);
        } else {
            this.selectedJoints.add(motor);
        }
        this.rosService.setGestureJoints(Array.from(this.selectedJoints));
    }

    /** Live value for a joint in degrees, or null if currently not detected. */
    liveDegrees(motor: string): number | null {
        const centideg = this.liveTargets[motor];
        return centideg === undefined ? null : centideg / 100;
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

        // Knochenlinien (grün)
        ctx.strokeStyle = "#00e676";
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        for (const [fromName, toName] of BODY_CONNECTIONS) {
            const from = byName[fromName];
            const to = byName[toName];
            if (
                !from ||
                !to ||
                from.score < VISIBILITY_THRESHOLD ||
                to.score < VISIBILITY_THRESHOLD
            ) {
                continue;
            }
            ctx.beginPath();
            ctx.moveTo(from.x * w, from.y * h);
            ctx.lineTo(to.x * w, to.y * h);
            ctx.stroke();
        }

        // Kopfrichtung (Ohrmitte -> Nase, pink)
        const nose = byName["nose"];
        const earL = byName["left_ear"];
        const earR = byName["right_ear"];
        if (
            nose &&
            earL &&
            earR &&
            nose.score >= VISIBILITY_THRESHOLD &&
            earL.score >= VISIBILITY_THRESHOLD &&
            earR.score >= VISIBILITY_THRESHOLD
        ) {
            ctx.strokeStyle = "#e10072";
            ctx.beginPath();
            ctx.moveTo(((earL.x + earR.x) / 2) * w, ((earL.y + earR.y) / 2) * h);
            ctx.lineTo(nose.x * w, nose.y * h);
            ctx.stroke();
        }

        // Gelenkpunkte
        ctx.fillStyle = "#ffffff";
        for (const lm of landmarks) {
            if (lm.score < VISIBILITY_THRESHOLD) {
                continue;
            }
            ctx.beginPath();
            ctx.arc(lm.x * w, lm.y * h, lineWidth * 1.2, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}
