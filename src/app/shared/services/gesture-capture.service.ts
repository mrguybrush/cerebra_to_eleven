import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import {RosService} from "./ros-service/ros.service";

export type CaptureMode = "static" | "dynamic";

interface RawStaticResult {
    mode: "static";
    positions: {[motorName: string]: number};
}

interface RawDynamicResult {
    mode: "dynamic";
    sample_rate_hz: number;
    frames: {t_ms: number; positions: {[motorName: string]: number}}[];
}

export interface CaptureResult {
    mode: CaptureMode;
    positions?: {[motorName: string]: number};
    sampleRateHz?: number;
    frames?: {timestampMs: number; positions: {[motorName: string]: number}}[];
}

/**
 * Thin wrapper around the ROS topics that drive gesture_capture.py
 * (Layer 3+4 in the plan). Owns only the start/stop/result flow and a
 * simple countdown for the UI - saving a result as a named Gesture or
 * MovementSequence is done by whoever consumes captureResult$
 * (see pose.component.ts), via GestureService/MovementSequenceService.
 */
@Injectable({
    providedIn: "root",
})
export class GestureCaptureService {
    capturing$ = new BehaviorSubject<boolean>(false);
    remainingSeconds$ = new BehaviorSubject<number>(0);
    captureResult$ = new BehaviorSubject<CaptureResult | null>(null);

    private countdownInterval?: ReturnType<typeof setInterval>;

    constructor(private rosService: RosService) {
        this.rosService.gestureCaptureResultReceiver$.subscribe((data: string) => {
            this.onResult(data);
        });
    }

    start(mode: CaptureMode, durationS: number) {
        this.captureResult$.next(null);
        this.capturing$.next(true);
        this.remainingSeconds$.next(durationS);
        this.rosService.startGestureCapture(mode, durationS);

        clearInterval(this.countdownInterval);
        this.countdownInterval = setInterval(() => {
            const remaining = this.remainingSeconds$.value - 1;
            this.remainingSeconds$.next(Math.max(0, remaining));
            if (remaining <= 0) {
                clearInterval(this.countdownInterval);
            }
        }, 1000);
    }

    stop() {
        this.rosService.stopGestureCapture();
        this.capturing$.next(false);
        clearInterval(this.countdownInterval);
    }

    private onResult(data: string) {
        this.capturing$.next(false);
        clearInterval(this.countdownInterval);

        let raw: RawStaticResult | RawDynamicResult;
        try {
            raw = JSON.parse(data);
        } catch {
            console.error("gesture_capture_result: invalid JSON", data);
            return;
        }

        if (raw.mode === "static") {
            this.captureResult$.next({mode: "static", positions: raw.positions});
        } else {
            this.captureResult$.next({
                mode: "dynamic",
                sampleRateHz: raw.sample_rate_hz,
                frames: raw.frames.map((f) => ({
                    timestampMs: f.t_ms,
                    positions: f.positions,
                })),
            });
        }
    }
}
