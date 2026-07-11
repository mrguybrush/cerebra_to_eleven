import {Injectable} from "@angular/core";
import {
    BehaviorSubject,
    Observable,
    Subject,
    forkJoin,
    map,
    of,
    tap,
} from "rxjs";
import {Pose, PoseDTO} from "../types/pose";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {MotorPosition} from "../types/motor-position";
import {MotorService} from "./motor.service";
import {motors} from "../types/motor-configuration";

/** Row shape for the "Programme" assignment table - not the full
 * Pose (no motor positions), but includes the group id the normal pose
 * list doesn't expose. */
export interface PoseAssignment {
    poseId: string;
    name: string;
    deletable: boolean;
    learningGroupId: string | null;
}

@Injectable({
    providedIn: "root",
})
export class PoseService {
    private poses: Pose[] = [];
    private posesSubject: Subject<Pose[]> = new BehaviorSubject(this.poses);
    private poseIdToMotorPositions: Map<string, MotorPosition[]> = new Map();
    private currentMotorPositions: MotorPosition[];

    constructor(
        private apiService: ApiService,
        private motorService: MotorService,
    ) {
        this.currentMotorPositions = motors
            .filter((motor) => !motor.isMultiMotor)
            .map((motor) => ({motorName: motor.motorName, position: 0}));
        this.currentMotorPositions.forEach((motorPosition) => {
            motorService
                .getPositionObservable(motorPosition.motorName)
                .subscribe((position) => (motorPosition.position = position));
        });
        this.getAllPosesFromDb().subscribe((poses) => {
            this.poses.unshift(...poses);
            this.publishPoses();
        });
    }

    public getPosesObservable(): Observable<Pose[]> {
        return this.posesSubject;
    }

    /** Re-fetches the pose list from the backend - needed after the active
     * learning group changes, since filtering happens server-side. */
    public reload(): void {
        this.getAllPosesFromDb().subscribe((poses) => {
            this.poses = poses;
            this.poseIdToMotorPositions.clear();
            this.publishPoses();
        });
    }

    public saveCurrentPose(name: string): Observable<Pose> {
        const motorPositions = this.currentMotorPositions;
        return this.createPoseInDb(name, motorPositions).pipe(
            tap((pose) => {
                this.poses.push(pose);
                this.publishPoses();
                this.poseIdToMotorPositions.set(
                    pose.poseId,
                    structuredClone(motorPositions),
                );
            }),
        );
    }

    public renamePose(poseId: string, name: string) {
        this.renamePoseInDb(poseId, name).subscribe(() => {
            const pose = this.getCachedPoseOfId(poseId);
            if (pose) {
                pose.name = name;
                this.publishPoses();
            }
        });
    }

    public deletePose(poseId: string) {
        this.deletePoseFromDb(poseId).subscribe(() => {
            this.poses = this.poses.filter((pose) => pose.poseId !== poseId);
            this.publishPoses();
        });
    }

    public applyPose(poseId: string) {
        const pose = this.getCachedPoseOfId(poseId);
        if (!pose?.active) return;
        const motorPositions = this.poseIdToMotorPositions.get(poseId);
        const positionsObservable: Observable<MotorPosition[]> = motorPositions
            ? of(motorPositions)
            : this.getMotorPositionsOfPoseFromDb(poseId).pipe(
                  tap((mp) => this.poseIdToMotorPositions.set(poseId, mp)),
              );
        positionsObservable.subscribe((motorPositions) => {
            this.motorService.setPositions(motorPositions);
            pose.active = false;
            this.publishPoses();
            setTimeout(() => {
                pose.active = true;
                this.publishPoses();
            }, 1000);
        });
    }

    /** Name + motor positions of one pose, for JSON export. */
    public getPoseForExport(
        poseId: string,
    ): Observable<{name: string; motorPositions: MotorPosition[]}> {
        const pose = this.getCachedPoseOfId(poseId);
        const cached = this.poseIdToMotorPositions.get(poseId);
        const positions$ = cached
            ? of(cached)
            : this.getMotorPositionsOfPoseFromDb(poseId).pipe(
                  tap((mp) => this.poseIdToMotorPositions.set(poseId, mp)),
              );
        return positions$.pipe(
            map((motorPositions) => ({
                name: pose?.name ?? "pose",
                motorPositions,
            })),
        );
    }

    /** All poses (incl. non-deletable ones) with their motor positions. */
    public getAllPosesForExport(): Observable<
        {name: string; motorPositions: MotorPosition[]}[]
    > {
        if (this.poses.length === 0) {
            return of([]);
        }
        return forkJoin(
            this.poses.map((pose) => this.getPoseForExport(pose.poseId)),
        );
    }

    /** Creates a pose from imported data. Pose names are unique in the
     * database, so colliding names get a " (2)"-style suffix instead of
     * failing the whole import. */
    public importPose(
        name: string,
        motorPositions: MotorPosition[],
    ): Observable<Pose> {
        const uniqueName = this.uniquePoseName(name);
        return this.createPoseInDb(uniqueName, motorPositions).pipe(
            tap((pose) => {
                this.poses.push(pose);
                this.publishPoses();
                this.poseIdToMotorPositions.set(
                    pose.poseId,
                    structuredClone(motorPositions),
                );
            }),
        );
    }

    /** Deletes every deletable pose; resolves with the number deleted.
     * Non-deletable poses (e.g. Startup/Resting) are kept. */
    public deleteAllPoses(): Observable<number> {
        const deletable = this.poses.filter((pose) => pose.deletable);
        if (deletable.length === 0) {
            return of(0);
        }
        return forkJoin(
            deletable.map((pose) => this.deletePoseFromDb(pose.poseId)),
        ).pipe(
            tap(() => {
                this.poses = this.poses.filter((pose) => !pose.deletable);
                deletable.forEach((pose) =>
                    this.poseIdToMotorPositions.delete(pose.poseId),
                );
                this.publishPoses();
            }),
            map(() => deletable.length),
        );
    }

    private uniquePoseName(base: string): string {
        const names = new Set(this.poses.map((pose) => pose.name));
        if (!names.has(base)) {
            return base;
        }
        for (let i = 2; ; i++) {
            const candidate = `${base} (${i})`;
            if (!names.has(candidate)) {
                return candidate;
            }
        }
    }

    /** All poses regardless of the active group, with their group
     * assignment - for the "Programme" admin table. */
    public getAllPosesForAssignment(): Observable<PoseAssignment[]> {
        return this.apiService
            .get(`${UrlConstants.POSE}?all=true`)
            .pipe(map((dto) => dto["poses"]));
    }

    public setPoseGroup(
        poseId: string,
        learningGroupId: string | null,
    ): Observable<PoseAssignment> {
        return this.apiService.patch(`${UrlConstants.POSE}/${poseId}/learning-group`, {
            learningGroupId,
        });
    }

    public copyPoseToGroup(
        poseId: string,
        learningGroupId: string | null,
    ): Observable<PoseAssignment> {
        return this.apiService.post(`${UrlConstants.POSE}/${poseId}/copy`, {
            learningGroupId,
        });
    }

    public updatePoseMotorPositions(poseId: string): Observable<void> {
        const motorPositions = this.currentMotorPositions;
        return this.updatePoseMotorPositionsInDb(poseId, motorPositions).pipe(
            tap(() => {
                this.poseIdToMotorPositions.set(
                    poseId,
                    structuredClone(motorPositions),
                );
            }),
        );
    }

    private getMotorPositionsOfPoseFromDb(
        poseId: string,
    ): Observable<MotorPosition[]> {
        return this.apiService
            .get(`${UrlConstants.POSE}/${poseId}/motor-positions`)
            .pipe(map((dto) => dto["motorPositions"]));
    }
    private getAllPosesFromDb(): Observable<Pose[]> {
        return this.apiService.get(UrlConstants.POSE).pipe(
            map((posesDto) => {
                const poseDtos: PoseDTO[] = posesDto["poses"];
                return poseDtos.map(
                    (dto) => new Pose(dto.name, dto.poseId, dto.deletable),
                );
            }),
        );
    }

    private renamePoseInDb(poseId: string, name: string): Observable<any> {
        return this.apiService.patch(`${UrlConstants.POSE}/${poseId}`, {name});
    }

    private createPoseInDb(
        name: string,
        motorPositions: MotorPosition[],
    ): Observable<Pose> {
        return this.apiService
            .post(UrlConstants.POSE, {name, motorPositions})
            .pipe(
                map(
                    (dto: PoseDTO) =>
                        new Pose(dto.name, dto.poseId, dto.deletable),
                ),
            );
    }

    private deletePoseFromDb(poseId: string): Observable<any> {
        return this.apiService.delete(`${UrlConstants.POSE}/${poseId}`);
    }

    private updatePoseMotorPositionsInDb(
        poseId: string,
        motorPositions: MotorPosition[],
    ): Observable<void> {
        return this.apiService.patch(
            `${UrlConstants.POSE}/${poseId}/motor-positions`,
            {motorPositions},
        );
    }

    private publishPoses() {
        this.posesSubject.next(this.poses);
    }

    private getCachedPoseOfId(poseId: string): Pose | undefined {
        return this.poses.find((pose) => pose.poseId === poseId);
    }
}
