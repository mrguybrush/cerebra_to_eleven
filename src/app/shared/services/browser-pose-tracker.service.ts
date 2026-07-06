import {Injectable} from "@angular/core";
import {FilesetResolver, PoseLandmarker} from "@mediapipe/tasks-vision";
import {BehaviorSubject, Subscription} from "rxjs";
import {RosService} from "./ros-service/ros.service";

// MediaPipe Pose's 33-point landmark indices - matches BODY_KP in
// gesture_control/vendor_mediapipe_utils.py exactly, since both sides need
// to agree on which index is "left_shoulder" etc.
const BODY_KP_NAMES: {[index: number]: string} = {
    0: "nose",
    2: "left_eye",
    5: "right_eye",
    7: "left_ear",
    8: "right_ear",
    11: "left_shoulder",
    12: "right_shoulder",
    13: "left_elbow",
    14: "right_elbow",
    15: "left_wrist",
    16: "right_wrist",
    // hand keypoints - needed by the backend to estimate lower-arm
    // (pronation/supination) rotation from the hand's orientation
    17: "left_pinky",
    18: "right_pinky",
    19: "left_index",
    20: "right_index",
    21: "left_thumb",
    22: "right_thumb",
    23: "left_hip",
    24: "right_hip",
    25: "left_knee",
    26: "right_knee",
    27: "left_ankle",
    28: "right_ankle",
};

// Joint angles computed for display, following the standalone prototype's
// approach: classic vector geometry on the (aspect-corrected) 3D landmarks.
// Vertex-angle joints are expressed as point triples; head yaw/tilt are
// handled separately (atan2 on the ear-midpoint->nose direction vector).
// Display-only - the gesture_control backend computes its own angles from
// the raw landmarks it receives and remains the single source of truth for
// what actually drives motors.
const VERTEX_ANGLE_JOINTS: {label: string; points: [string, string, string]}[] = [
    // Schulter-Abspreizung: Winkel zwischen Oberarm (Schulter->Ellbogen)
    // und Rumpf (Schulter->Hüfte). 0 Grad = Arm hängt.
    {label: "Schulter links", points: ["left_elbow", "left_shoulder", "left_hip"]},
    {label: "Schulter rechts", points: ["right_elbow", "right_shoulder", "right_hip"]},
    // Ellbogen-Beugung: 180 Grad = gestreckt.
    {label: "Ellbogen links", points: ["left_shoulder", "left_elbow", "left_wrist"]},
    {label: "Ellbogen rechts", points: ["right_shoulder", "right_elbow", "right_wrist"]},
    {label: "Hüfte links", points: ["left_shoulder", "left_hip", "left_knee"]},
    {label: "Hüfte rechts", points: ["right_shoulder", "right_hip", "right_knee"]},
    {label: "Knie links", points: ["left_hip", "left_knee", "left_ankle"]},
    {label: "Knie rechts", points: ["right_hip", "right_knee", "right_ankle"]},
];

// Points with visibility below this are treated as not seen (per prototype).
const VISIBILITY_THRESHOLD = 0.5;
// Exponential-moving-average factor for the displayed angles, so the table
// doesn't jitter (per prototype: alpha ~0.35; higher = snappier).
const EMA_ALPHA = 0.35;

export type PoseSource = "robot" | "webcam";

export interface NamedLandmark {
    name: string;
    x: number; // normalized [0,1]
    y: number; // normalized [0,1]
    z: number; // estimated depth, hip-relative (MediaPipe convention)
    score: number;
}

/**
 * Runs MediaPipe PoseLandmarker directly in the browser (WASM/WebGL) -
 * either on the OAK-D's own video feed (the same base64 JPEG stream already
 * shown on the Camera page, camera_topic via rosbridge) or on the
 * operator's own webcam via getUserMedia. Detection never runs on pib
 * itself: two earlier approaches (OAK-D VPU, then Raspberry Pi CPU) both
 * hit hardware limits; a PC/iPad has far more headroom.
 *
 * "robot" is the more natural default (person just stands in front of pib,
 * no extra permission prompt); "webcam" is a fallback for setups where the
 * operator wants to use their own camera instead. Both need no internet
 * access at runtime - the MediaPipe WASM runtime and model are self-hosted
 * under assets/mediapipe/ (baked in at Docker build time, see Dockerfile)
 * rather than fetched from an external CDN each time, matching the
 * project's offline-first approach. See gesture_control ROS package for
 * the receiving side.
 */
@Injectable({
    providedIn: "root",
})
export class BrowserPoseTrackerService {
    /** Latest camera frame as a data: URL / object URL, for live preview. */
    frame$ = new BehaviorSubject<string | null>(null);
    /** Latest detected landmarks (empty array if nobody is currently visible). */
    landmarks$ = new BehaviorSubject<NamedLandmark[]>([]);
    /** Latest computed joint angles (EMA-smoothed), keyed by display label. */
    jointAngles$ = new BehaviorSubject<{[label: string]: number}>({});
    /** Set when start() fails, cleared on the next successful start(). */
    error$ = new BehaviorSubject<string | null>(null);
    /** Debug-only counters, shown in the UI so this can be diagnosed without
     * browser devtools access (mobile browsers often make that awkward). */
    framesReceived$ = new BehaviorSubject<number>(0);
    framesDrawn$ = new BehaviorSubject<number>(0);
    landmarkerReady$ = new BehaviorSubject<boolean>(false);

    private poseLandmarker?: PoseLandmarker;
    private landmarkerRunningMode?: "IMAGE" | "VIDEO";
    private imageElement?: HTMLImageElement;
    private videoElement?: HTMLVideoElement;
    private mediaStream?: MediaStream;
    private cameraSubscription?: Subscription;
    private animationFrameId?: number;
    private running = false;
    private busy = false; // guards against overlapping detect() calls if a frame is slow
    private smoothedAngles: {[label: string]: number} = {};
    private frameAspect = 16 / 9; // width/height of the current source, for angle math

    constructor(private rosService: RosService) {}

    isRunning(): boolean {
        return this.running;
    }

    async start(source: PoseSource): Promise<void> {
        if (this.running) {
            return;
        }
        this.error$.next(null);
        this.framesReceived$.next(0);
        this.framesDrawn$.next(0);
        this.landmarkerReady$.next(false);
        this.smoothedAngles = {};

        if (source === "webcam" && !window.isSecureContext) {
            const msg =
                "Eigene Webcam braucht eine sichere Verbindung (HTTPS oder localhost) - " +
                "der Browser blockiert Kamerazugriff über http://. Bitte 'Kamera vom Roboter' verwenden.";
            this.error$.next(msg);
            throw new Error(msg);
        }

        try {
            await this.initLandmarker(source === "robot" ? "IMAGE" : "VIDEO");
            this.landmarkerReady$.next(true);
        } catch (err) {
            this.error$.next("MediaPipe konnte nicht geladen werden: " + String(err));
            throw err;
        }

        try {
            if (source === "robot") {
                await this.startFromRobotCamera();
            } else {
                await this.startFromWebcam();
            }
        } catch (err) {
            this.error$.next("Kamera konnte nicht gestartet werden: " + String(err));
            throw err;
        }
        this.running = true;
    }

    stop(): void {
        this.running = false;
        this.cameraSubscription?.unsubscribe();
        this.cameraSubscription = undefined;
        this.imageElement = undefined;
        if (this.animationFrameId !== undefined) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = undefined;
        }
        this.mediaStream?.getTracks().forEach((track) => track.stop());
        this.mediaStream = undefined;
        this.videoElement = undefined;
        this.frame$.next(null);
        this.landmarks$.next([]);
        this.jointAngles$.next({});
        this.framesReceived$.next(0);
        this.framesDrawn$.next(0);
        this.landmarkerReady$.next(false);
        this.smoothedAngles = {};
    }

    private async initLandmarker(mode: "IMAGE" | "VIDEO"): Promise<void> {
        if (this.poseLandmarker && this.landmarkerRunningMode === mode) {
            return;
        }
        // Self-hosted (see Dockerfile) - no external CDN needed at runtime.
        const vision = await FilesetResolver.forVisionTasks("assets/mediapipe/wasm");
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "assets/mediapipe/pose_landmarker_lite.task",
                // CPU, not GPU: the WebGL-based GPU delegate throws on some
                // mobile browsers/devices. CPU is slower but universally
                // supported - reliability matters more than speed here,
                // especially at the ~10Hz we sample anyway.
                delegate: "CPU",
            },
            runningMode: mode,
            numPoses: 1,
        });
        this.landmarkerRunningMode = mode;
    }

    // --- Source: pib's own OAK-D camera (camera_topic), discrete JPEG frames ---

    private async startFromRobotCamera(): Promise<void> {
        this.imageElement = new Image();

        // Ensures camera_topic is actively streaming even if the Camera
        // page was never opened this session. Intentionally never
        // unsubscribed in stop() - the Camera page may depend on the same
        // subscription, and re-subscribing here is harmless/idempotent
        // from this service's perspective.
        this.rosService.subscribeCameraTopic();
        this.cameraSubscription = this.rosService.cameraReceiver$.subscribe(
            (base64Jpeg: string) => this.onRobotFrame(base64Jpeg),
        );
    }

    private onRobotFrame(base64Jpeg: string) {
        if (!this.imageElement || !this.poseLandmarker) {
            return;
        }
        if (base64Jpeg.startsWith("Camera not available")) {
            return;
        }
        if (this.busy) {
            return;
        }

        const dataUrl = "data:image/jpeg;base64," + base64Jpeg;
        this.frame$.next(dataUrl);
        this.framesReceived$.next(this.framesReceived$.value + 1);

        this.busy = true;
        this.imageElement.onload = () => {
            try {
                const img = this.imageElement!;
                if (img.naturalHeight > 0) {
                    this.frameAspect = img.naturalWidth / img.naturalHeight;
                }
                const result = this.poseLandmarker!.detect(img);
                this.handleResult(result.landmarks);
            } finally {
                this.busy = false;
            }
        };
        this.imageElement.onerror = () => {
            this.busy = false;
        };
        this.imageElement.src = dataUrl;
    }

    // --- Source: operator's own webcam via getUserMedia, continuous <video> ---

    private async startFromWebcam(): Promise<void> {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {width: 640, height: 480},
            audio: false,
        });
        this.videoElement = document.createElement("video");
        this.videoElement.srcObject = this.mediaStream;
        this.videoElement.playsInline = true;
        await this.videoElement.play();
        this.webcamDetectLoop();
    }

    private webcamDetectLoop = () => {
        if (!this.videoElement || !this.poseLandmarker || !this.running) {
            if (this.mediaStream) {
                // still active - keep looping until stop() clears mediaStream
                this.animationFrameId = requestAnimationFrame(this.webcamDetectLoop);
            }
            return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        canvas.getContext("2d")?.drawImage(this.videoElement, 0, 0);
        this.frame$.next(canvas.toDataURL("image/jpeg"));
        this.framesReceived$.next(this.framesReceived$.value + 1);
        if (this.videoElement.videoHeight > 0) {
            this.frameAspect = this.videoElement.videoWidth / this.videoElement.videoHeight;
        }

        const result = this.poseLandmarker.detectForVideo(this.videoElement, performance.now());
        this.handleResult(result.landmarks);

        this.animationFrameId = requestAnimationFrame(this.webcamDetectLoop);
    };

    // --- Shared: landmark result -> named dict -> angles + publish ---

    private handleResult(landmarksPerPose: {x: number; y: number; z: number; visibility?: number}[][]) {
        if (landmarksPerPose.length === 0) {
            this.landmarks$.next([]);
            this.jointAngles$.next({});
            this.smoothedAngles = {};
            return;
        }
        const landmarks = landmarksPerPose[0];
        // ROS payload: [x, y, score, z] per point. x and z are scaled by the
        // frame aspect so angles computed in the backend are not distorted
        // by the image format (same correction as computeBodyAngles below);
        // z enables the backend's rotation-joint estimates.
        const named: {[name: string]: [number, number, number, number]} = {};
        const namedList: NamedLandmark[] = [];
        for (const [indexStr, name] of Object.entries(BODY_KP_NAMES)) {
            const lm = landmarks[Number(indexStr)];
            if (!lm) {
                continue;
            }
            const score = lm.visibility ?? 1;
            if (score >= VISIBILITY_THRESHOLD) {
                named[name] = [
                    lm.x * this.frameAspect,
                    lm.y,
                    score,
                    lm.z * this.frameAspect,
                ];
            }
            namedList.push({name, x: lm.x, y: lm.y, z: lm.z, score});
        }
        this.landmarks$.next(namedList);
        this.jointAngles$.next(this.computeBodyAngles(namedList));
        this.rosService.publishPoseLandmarks(named);
    }

    /**
     * Vertex angles for shoulders/elbows/hips/knees plus head yaw/tilt,
     * on aspect-corrected 3D coordinates (x and z scaled by width/height so
     * the image format doesn't distort angles - per the prototype), with
     * per-point visibility gating and EMA smoothing.
     */
    private computeBodyAngles(landmarks: NamedLandmark[]): {[label: string]: number} {
        const pts: {[name: string]: Vec3} = {};
        for (const lm of landmarks) {
            if (lm.score < VISIBILITY_THRESHOLD) {
                continue;
            }
            pts[lm.name] = {
                x: lm.x * this.frameAspect,
                y: lm.y,
                z: lm.z * this.frameAspect,
            };
        }

        const raw: {[label: string]: number} = {};

        for (const {label, points} of VERTEX_ANGLE_JOINTS) {
            const [a, b, c] = points.map((n) => pts[n]);
            if (!a || !b || !c) {
                continue;
            }
            raw[label] = vertexAngle(a, b, c);
        }

        // Head yaw/tilt from the ear-midpoint -> nose direction vector.
        const nose = pts["nose"];
        const earL = pts["left_ear"];
        const earR = pts["right_ear"];
        if (nose && earL && earR) {
            const mid: Vec3 = {
                x: (earL.x + earR.x) / 2,
                y: (earL.y + earR.y) / 2,
                z: (earL.z + earR.z) / 2,
            };
            const v: Vec3 = {x: nose.x - mid.x, y: nose.y - mid.y, z: nose.z - mid.z};
            // Facing the camera, the nose sits closer than the ears
            // (more-negative z in MediaPipe's convention), so -v.z > 0 and
            // both angles read ~0 when looking straight ahead.
            raw["Kopf Drehung"] = (Math.atan2(v.x, -v.z) * 180) / Math.PI;
            raw["Kopf Neigung"] = (Math.atan2(-v.y, Math.hypot(v.x, v.z)) * 180) / Math.PI;
        }

        // EMA smoothing; drop state for joints that vanished this frame so
        // they re-initialize cleanly instead of gliding in from stale values.
        const smoothed: {[label: string]: number} = {};
        for (const [label, value] of Object.entries(raw)) {
            const prev = this.smoothedAngles[label];
            smoothed[label] =
                prev === undefined ? value : prev + EMA_ALPHA * (value - prev);
        }
        this.smoothedAngles = smoothed;
        return smoothed;
    }
}

interface Vec3 {
    x: number;
    y: number;
    z: number;
}

/** Interior angle in degrees at vertex b, formed by points a-b-c (3D). */
function vertexAngle(a: Vec3, b: Vec3, c: Vec3): number {
    const ba = {x: a.x - b.x, y: a.y - b.y, z: a.z - b.z};
    const bc = {x: c.x - b.x, y: c.y - b.y, z: c.z - b.z};
    const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
    const magBa = Math.hypot(ba.x, ba.y, ba.z);
    const magBc = Math.hypot(bc.x, bc.y, bc.z);
    if (magBa === 0 || magBc === 0) {
        return 0;
    }
    const cos = Math.max(-1, Math.min(1, dot / (magBa * magBc)));
    return (Math.acos(cos) * 180) / Math.PI;
}
