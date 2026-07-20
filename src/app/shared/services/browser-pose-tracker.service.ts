import {Injectable} from "@angular/core";
import {
    FilesetResolver,
    HandLandmarker,
    PoseLandmarker,
} from "@mediapipe/tasks-vision";
import {BehaviorSubject, Subscription} from "rxjs";
import {RosService} from "./ros-service/ros.service";

// MediaPipe Hand Landmarker's 21-point indices, used to compute a proper
// palm-orientation (for lower-arm/wrist rotation) instead of the coarse
// pinky/index approximation previously derived from the 3 low-fidelity hand
// keypoints the Pose model exposes, and (MCP + fingertip pairs) to estimate
// each finger's stretch/opposition independently for retargeting.py's
// per-finger candidates. Names match what retargeting.py expects under
// points["hands"][side][name].
const HAND_KP_NAMES: {[index: number]: string} = {
    0: "wrist",
    2: "thumb_mcp",
    4: "thumb_tip",
    5: "index_mcp",
    8: "index_tip",
    9: "middle_mcp",
    12: "middle_tip",
    13: "ring_mcp",
    16: "ring_tip",
    17: "pinky_mcp",
    20: "pinky_tip",
};

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

// "oak": EXPERIMENTELL - Erkennung laeuft on-device auf der OAK-D-VPU
// (MoveNet + Hand-Landmark, siehe oak_d_lite/stereo.py). Der Browser zeigt
// nur noch Kamera-Frames + die vom Roboter publizierten Landmarks an,
// MediaPipe laeuft dann gar nicht - minimale Latenz auf schwachen Geraeten.
export type PoseSource = "robot" | "webcam" | "oak";

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
    /** Which hands are currently detected - shown in the UI so it's obvious
     * when hand-tracking-based rotation candidates are actually available. */
    handsDetected$ = new BehaviorSubject<{left: boolean; right: boolean}>({
        left: false,
        right: false,
    });

    private poseLandmarker?: PoseLandmarker;
    private handLandmarker?: HandLandmarker;
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

    // Latency controls (set from the motion_capture_settings singleton via
    // the component). evalIntervalMs caps how often detection runs (0 = as
    // fast as frames arrive); pose+hand CPU/GPU inference is the main cost,
    // so throttling prevents backlog on weak devices.
    private evalIntervalMs = 0;
    private lastEvalTime = 0;
    // HandLandmarker is expensive; hand open/close and wrist rotation don't
    // need every frame. Run it only every Nth detection and reuse the last
    // result in between.
    private static readonly HAND_DETECTION_EVERY_N = 2;
    private detectCount = 0;
    private lastHandResult?: HandResult;
    // "oak" mode (on-device NN, experimentell): frames only for display,
    // landmarks arrive from the camera node via browser_pose_landmarks.
    private oakActive = false;
    private oakLandmarksSubscription?: Subscription;
    // Stereo-Tiefenstream der OAK-D aktiv (robot- und oak-Quelle) - siehe
    // setOakDepthActive im RosService.
    private depthActive = false;

    constructor(private rosService: RosService) {}

    /** Cap detection frequency (ms between detections); 0 = uncapped.
     * Driven by eval_max_hz from motion_capture_settings. */
    setEvalIntervalMs(ms: number): void {
        this.evalIntervalMs = Math.max(0, ms);
    }

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

        if (source === "oak") {
            // On-Device-Erkennung: kein MediaPipe im Browser. Frames nur
            // zur Anzeige, Landmarks kommen vom Kamera-Node.
            try {
                await this.startFromOakNn();
            } catch (err) {
                this.error$.next(
                    "Kamera konnte nicht gestartet werden: " + String(err),
                );
                throw err;
            }
            this.oakActive = true;
            this.depthActive = true;
            this.rosService.setOakDepthActive(true);
            this.landmarkerReady$.next(true);
            this.running = true;
            return;
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
                // Stereo-Tiefenstream der OAK-D mitlaufen lassen: das
                // Backend ersetzt damit die vom MediaPipe-Modell nur
                // geschaetzte Tiefe durch Messwerte (Armdrehung/Ellbogen).
                // Bei der eigenen Webcam sinnlos (anderes Blickfeld).
                this.depthActive = true;
                this.rosService.setOakDepthActive(true);
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
        if (this.depthActive) {
            this.depthActive = false;
            this.rosService.setOakDepthActive(false);
        }
        if (this.oakActive) {
            this.oakActive = false;
            this.rosService.setOakNnActive(false);
            this.rosService.unsubscribeBrowserPoseLandmarks();
            this.oakLandmarksSubscription?.unsubscribe();
            this.oakLandmarksSubscription = undefined;
        }
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
        this.handsDetected$.next({left: false, right: false});
        this.lastEvalTime = 0;
        this.detectCount = 0;
        this.lastHandResult = undefined;
        this.busy = false;
    }

    private async initLandmarker(mode: "IMAGE" | "VIDEO"): Promise<void> {
        if (
            this.poseLandmarker &&
            this.handLandmarker &&
            this.landmarkerRunningMode === mode
        ) {
            return;
        }
        // Self-hosted (see Dockerfile) - no external CDN needed at runtime.
        const vision = await FilesetResolver.forVisionTasks("assets/mediapipe/wasm");
        // Try the WebGL GPU delegate first (big latency win on a real
        // desktop Chrome), fall back to CPU if it throws - the GPU delegate
        // is unavailable/broken on some mobile browsers/devices, which is
        // why this used to be CPU-only.
        this.poseLandmarker = await this.createWithGpuFallback((delegate) =>
            PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "assets/mediapipe/pose_landmarker_lite.task",
                    delegate,
                },
                runningMode: mode,
                numPoses: 1,
            }),
        );
        this.handLandmarker = await this.createWithGpuFallback((delegate) =>
            HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "assets/mediapipe/hand_landmarker.task",
                    delegate,
                },
                runningMode: mode,
                numHands: 2,
            }),
        );
        this.landmarkerRunningMode = mode;
    }

    private async createWithGpuFallback<T>(
        create: (delegate: "GPU" | "CPU") => Promise<T>,
    ): Promise<T> {
        try {
            return await create("GPU");
        } catch {
            return await create("CPU");
        }
    }

    // --- Source: on-device NN on the OAK-D itself (EXPERIMENTELL) ---------
    // Kein MediaPipe im Browser: Frames werden nur angezeigt, die Landmarks
    // publiziert der Kamera-Node selbst (MoveNet + Hand-Landmark auf der
    // VPU, siehe oak_d_lite/stereo.py) - gesture_control konsumiert sie
    // unveraendert ueber browser_pose_landmarks.

    private async startFromOakNn(): Promise<void> {
        this.imageElement = new Image();
        this.rosService.subscribeCameraTopic();
        this.cameraSubscription = this.rosService.cameraReceiver$.subscribe(
            (base64Jpeg: string) => this.onOakFrame(base64Jpeg),
        );
        this.rosService.subscribeBrowserPoseLandmarks();
        this.oakLandmarksSubscription =
            this.rosService.browserPoseLandmarksReceiver$.subscribe(
                (json: string) => this.onOakLandmarks(json),
            );
        this.rosService.setOakNnActive(true);
    }

    private onOakFrame(base64Jpeg: string) {
        if (base64Jpeg.startsWith("Camera not available")) {
            return;
        }
        const dataUrl = "data:image/jpeg;base64," + base64Jpeg;
        this.frame$.next(dataUrl);
        this.framesReceived$.next(this.framesReceived$.value + 1);
        // aspect once per session (needed to un-scale the payload's x/z)
        if (this.imageElement && !this.imageElement.src) {
            this.imageElement.onload = () => {
                if (this.imageElement && this.imageElement.naturalHeight > 0) {
                    this.frameAspect =
                        this.imageElement.naturalWidth /
                        this.imageElement.naturalHeight;
                }
            };
            this.imageElement.src = dataUrl;
        }
    }

    private onOakLandmarks(json: string) {
        let payload: {
            pose?: {[name: string]: number[]};
            hands?: {[side: string]: object};
        };
        try {
            payload = JSON.parse(json);
        } catch {
            return;
        }
        // payload format matches what this service itself publishes:
        // pose {name: [x*aspect, y, score, z*aspect]} - un-scale for display
        const namedList: NamedLandmark[] = [];
        for (const [name, values] of Object.entries(payload.pose ?? {})) {
            if (!Array.isArray(values) || values.length < 3) {
                continue;
            }
            namedList.push({
                name,
                x: values[0] / this.frameAspect,
                y: values[1],
                z: (values[3] ?? 0) / this.frameAspect,
                score: values[2],
            });
        }
        this.landmarks$.next(namedList);
        this.jointAngles$.next(this.computeBodyAngles(namedList));
        const hands = payload.hands ?? {};
        this.handsDetected$.next({
            left: "left" in hands,
            right: "right" in hands,
        });
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

        // Always show the incoming frame so the video preview stays smooth,
        // even when detection is throttled below.
        const dataUrl = "data:image/jpeg;base64," + base64Jpeg;
        this.frame$.next(dataUrl);
        this.framesReceived$.next(this.framesReceived$.value + 1);

        if (this.busy) {
            return;
        }
        const now = performance.now();
        if (this.evalIntervalMs > 0 && now - this.lastEvalTime < this.evalIntervalMs) {
            return; // detection throttle - frame already displayed above
        }
        this.lastEvalTime = now;

        this.busy = true;
        this.imageElement.onload = () => {
            try {
                const img = this.imageElement!;
                if (img.naturalHeight > 0) {
                    this.frameAspect = img.naturalWidth / img.naturalHeight;
                }
                const result = this.poseLandmarker!.detect(img);
                const handResult = this.maybeDetectHands(() =>
                    this.handLandmarker?.detect(img) as HandResult | undefined,
                );
                this.handleResult(result.landmarks, handResult);
            } finally {
                this.busy = false;
            }
        };
        this.imageElement.onerror = () => {
            this.busy = false;
        };
        this.imageElement.src = dataUrl;
    }

    /** Runs the (expensive) hand detection only every Nth call, reusing the
     * last result in between - hand open/close and wrist rotation don't need
     * full framerate, and this roughly halves per-frame inference cost. */
    private maybeDetectHands(
        detect: () => HandResult | undefined,
    ): HandResult | undefined {
        this.detectCount++;
        if (
            !this.lastHandResult ||
            this.detectCount % BrowserPoseTrackerService.HAND_DETECTION_EVERY_N === 0
        ) {
            this.lastHandResult = detect();
        }
        return this.lastHandResult;
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
        // The RAF loop fires at ~60Hz; throttle the heavy work (capture +
        // inference) to evalIntervalMs so a slow device doesn't back up.
        const now = performance.now();
        if (this.evalIntervalMs > 0 && now - this.lastEvalTime < this.evalIntervalMs) {
            this.animationFrameId = requestAnimationFrame(this.webcamDetectLoop);
            return;
        }
        this.lastEvalTime = now;

        const canvas = document.createElement("canvas");
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        canvas.getContext("2d")?.drawImage(this.videoElement, 0, 0);
        this.frame$.next(canvas.toDataURL("image/jpeg"));
        this.framesReceived$.next(this.framesReceived$.value + 1);
        if (this.videoElement.videoHeight > 0) {
            this.frameAspect = this.videoElement.videoWidth / this.videoElement.videoHeight;
        }

        const result = this.poseLandmarker.detectForVideo(this.videoElement, now);
        const handResult = this.maybeDetectHands(
            () =>
                this.handLandmarker?.detectForVideo(
                    this.videoElement!,
                    now,
                ) as HandResult | undefined,
        );
        this.handleResult(result.landmarks, handResult);

        this.animationFrameId = requestAnimationFrame(this.webcamDetectLoop);
    };

    // --- Shared: landmark result -> named dict -> angles + publish ---

    private handleResult(
        landmarksPerPose: {x: number; y: number; z: number; visibility?: number}[][],
        handResult?: HandResult,
    ) {
        if (landmarksPerPose.length === 0) {
            this.landmarks$.next([]);
            this.jointAngles$.next({});
            this.smoothedAngles = {};
            this.handsDetected$.next({left: false, right: false});
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

        const hands = this.extractHands(handResult);
        this.rosService.publishPoseLandmarks(named, hands.payload);
        this.handsDetected$.next(hands.detected);
    }

    /**
     * Converts the Hand Landmarker's per-hand results into
     * {left: {name: [x,y,z]}, right: {...}}, aspect-corrected like the pose
     * points. IMPORTANT: MediaPipe's handedness classifier assumes a
     * mirrored (selfie-style) input image; both our sources (robot camera
     * and raw webcam feed) are NOT mirrored, so the label is inverted here
     * to get the person's true anatomical hand - see MediaPipe Hand
     * Landmarker docs ("handedness ... assumes the input image is mirrored").
     */
    private extractHands(handResult?: HandResult): {
        payload: {[side: string]: {[name: string]: [number, number, number]}};
        detected: {left: boolean; right: boolean};
    } {
        const payload: {[side: string]: {[name: string]: [number, number, number]}} = {};
        const detected = {left: false, right: false};
        if (!handResult) {
            return {payload, detected};
        }
        // Field name changed across @mediapipe/tasks-vision versions
        // ("handedness" in earlier previews, "handednesses" from the GA
        // release onward) - read whichever is present rather than pinning
        // to one.
        const handednessPerHand = handResult.handednesses ?? handResult.handedness ?? [];
        for (let i = 0; i < handResult.landmarks.length; i++) {
            const rawLabel = handednessPerHand[i]?.[0]?.categoryName;
            if (!rawLabel) {
                continue;
            }
            const side = rawLabel === "Left" ? "right" : "left"; // mirror-correction, see above
            const points: {[name: string]: [number, number, number]} = {};
            for (const [indexStr, name] of Object.entries(HAND_KP_NAMES)) {
                const lm = handResult.landmarks[i][Number(indexStr)];
                if (!lm) {
                    continue;
                }
                points[name] = [lm.x * this.frameAspect, lm.y, lm.z * this.frameAspect];
            }
            payload[side] = points;
            detected[side as "left" | "right"] = true;
        }
        return {payload, detected};
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

// Shape of HandLandmarker's detect()/detectForVideo() result that this
// service actually uses. Declared loosely (both possible handedness field
// names optional) rather than importing the SDK's own result type, since
// the field was renamed across @mediapipe/tasks-vision versions - see
// extractHands() above.
interface HandResult {
    landmarks: {x: number; y: number; z: number}[][];
    handedness?: {categoryName: string}[][];
    handednesses?: {categoryName: string}[][];
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
