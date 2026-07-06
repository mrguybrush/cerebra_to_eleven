import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import {RosService} from "./ros-service/ros.service";

// Scheduling a small distance ahead of the audio clock absorbs network
// jitter between rosbridge chunks; too large and the audible delay grows.
const JITTER_BUFFER_S = 0.15;
const DEFAULT_SAMPLE_RATE = 16000;

/**
 * Plays pib's microphone (ReSpeaker array, streamed as mono Int16 PCM
 * chunks on /audio_stream by the audio_streamer node) live in the browser
 * via the Web Audio API. Each incoming chunk becomes an AudioBuffer that
 * is scheduled seamlessly after the previous one; unlike an <audio> tag,
 * this needs no server-side encoding or extra endpoints - the existing
 * rosbridge websocket carries everything.
 *
 * start() must be called from a user gesture (click), otherwise the
 * browser's autoplay policy blocks the AudioContext.
 */
@Injectable({
    providedIn: "root",
})
export class RobotAudioService {
    listening$ = new BehaviorSubject<boolean>(false);
    error$ = new BehaviorSubject<string | null>(null);

    private audioContext?: AudioContext;
    private nextStartTime = 0;
    private sampleRate = DEFAULT_SAMPLE_RATE;

    constructor(private rosService: RosService) {}

    async start(): Promise<void> {
        if (this.listening$.value) {
            return;
        }
        this.error$.next(null);

        try {
            this.sampleRate = await this.rosService.getMicSampleRate();
        } catch {
            // Service unavailable (e.g. audio node restarting) - the
            // streamer's default is 16 kHz, so fall back to that.
            this.sampleRate = DEFAULT_SAMPLE_RATE;
        }

        try {
            this.audioContext = new AudioContext();
            await this.audioContext.resume();
        } catch (err) {
            this.error$.next("Audio-Wiedergabe konnte nicht gestartet werden: " + String(err));
            throw err;
        }

        this.nextStartTime = 0;
        this.rosService.subscribeAudioStream((samples) => this.onChunk(samples));
        this.listening$.next(true);
    }

    stop(): void {
        if (!this.listening$.value) {
            return;
        }
        this.rosService.unsubscribeAudioStream();
        this.audioContext?.close().catch(() => undefined);
        this.audioContext = undefined;
        this.listening$.next(false);
    }

    private onChunk(samples: number[]) {
        const ctx = this.audioContext;
        if (!ctx || samples.length === 0) {
            return;
        }

        const buffer = ctx.createBuffer(1, samples.length, this.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
            channel[i] = samples[i] / 32768; // Int16 -> Float32 [-1, 1]
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        // Schedule chunks back to back; if we fell behind (dropped chunks,
        // tab in background), jump forward instead of playing stale audio.
        const now = ctx.currentTime;
        if (this.nextStartTime < now + 0.02) {
            this.nextStartTime = now + JITTER_BUFFER_S;
        }
        source.start(this.nextStartTime);
        this.nextStartTime += buffer.duration;
    }
}
