import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, Subject, map, tap} from "rxjs";
import {
    MovementSequence,
    MovementSequenceDTO,
    MovementSequenceFrameDTO,
} from "../types/movement-sequence";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {MotorPosition} from "../types/motor-position";
import {MotorService} from "./motor.service";

@Injectable({
    providedIn: "root",
})
export class MovementSequenceService {
    private sequences: MovementSequence[] = [];
    private sequencesSubject: Subject<MovementSequence[]> = new BehaviorSubject(
        this.sequences,
    );
    private sequenceIdToFrames: Map<string, MovementSequenceFrameDTO[]> =
        new Map();

    constructor(
        private apiService: ApiService,
        private motorService: MotorService,
    ) {
        this.getAllSequencesFromDb().subscribe((sequences) => {
            this.sequences.unshift(...sequences);
            this.publishSequences();
        });
    }

    public getSequencesObservable(): Observable<MovementSequence[]> {
        return this.sequencesSubject;
    }

    public saveSequence(
        name: string,
        sampleRateHz: number,
        frames: MovementSequenceFrameDTO[],
    ): Observable<MovementSequence> {
        return this.apiService
            .post(UrlConstants.MOVEMENT_SEQUENCE, {
                name,
                sampleRateHz,
                frames,
            })
            .pipe(
                map(
                    (dto: MovementSequenceDTO) =>
                        new MovementSequence(
                            dto.name,
                            dto.sequenceId,
                            dto.deletable,
                            dto.sampleRateHz,
                        ),
                ),
                tap((sequence) => {
                    this.sequences.push(sequence);
                    this.publishSequences();
                    this.sequenceIdToFrames.set(sequence.sequenceId, frames);
                }),
            );
    }

    public renameSequence(sequenceId: string, name: string) {
        this.apiService
            .patch(`${UrlConstants.MOVEMENT_SEQUENCE}/${sequenceId}`, {name})
            .subscribe(() => {
                const sequence = this.getCachedSequenceOfId(sequenceId);
                if (sequence) {
                    sequence.name = name;
                    this.publishSequences();
                }
            });
    }

    public deleteSequence(sequenceId: string) {
        this.apiService
            .delete(`${UrlConstants.MOVEMENT_SEQUENCE}/${sequenceId}`)
            .subscribe(() => {
                this.sequences = this.sequences.filter(
                    (sequence) => sequence.sequenceId !== sequenceId,
                );
                this.publishSequences();
            });
    }

    /** Plays back the recorded frames respecting their original timing. */
    public applySequence(sequenceId: string) {
        const cached = this.sequenceIdToFrames.get(sequenceId);
        if (cached) {
            this.playFrames(cached);
            return;
        }
        this.apiService
            .get(`${UrlConstants.MOVEMENT_SEQUENCE}/${sequenceId}`)
            .pipe(map((dto) => dto["frames"] as MovementSequenceFrameDTO[]))
            .subscribe((frames) => {
                this.sequenceIdToFrames.set(sequenceId, frames);
                this.playFrames(frames);
            });
    }

    /** Full sequence (name + sampleRate + frames) for export. */
    public getSequenceForExport(sequenceId: string): Observable<{
        name: string;
        sampleRateHz: number;
        frames: MovementSequenceFrameDTO[];
    }> {
        return this.apiService
            .get(`${UrlConstants.MOVEMENT_SEQUENCE}/${sequenceId}`)
            .pipe(
                map((dto) => ({
                    name: dto["name"] as string,
                    sampleRateHz: dto["sampleRateHz"] as number,
                    frames: dto["frames"] as MovementSequenceFrameDTO[],
                })),
            );
    }

    private playFrames(frames: MovementSequenceFrameDTO[]) {
        frames.forEach((frame) => {
            setTimeout(() => {
                const motorPositions: MotorPosition[] = Object.entries(
                    frame.positions,
                ).map(([motorName, position]) => ({motorName, position}));
                this.motorService.setPositions(motorPositions);
            }, frame.timestampMs);
        });
    }

    private getAllSequencesFromDb(): Observable<MovementSequence[]> {
        return this.apiService.get(UrlConstants.MOVEMENT_SEQUENCE).pipe(
            map((dto) => {
                const sequenceDtos: MovementSequenceDTO[] =
                    dto["movementSequences"];
                return sequenceDtos.map(
                    (d) =>
                        new MovementSequence(
                            d.name,
                            d.sequenceId,
                            d.deletable,
                            d.sampleRateHz,
                        ),
                );
            }),
        );
    }

    private publishSequences() {
        this.sequencesSubject.next(this.sequences);
    }

    private getCachedSequenceOfId(
        sequenceId: string,
    ): MovementSequence | undefined {
        return this.sequences.find(
            (sequence) => sequence.sequenceId === sequenceId,
        );
    }
}
