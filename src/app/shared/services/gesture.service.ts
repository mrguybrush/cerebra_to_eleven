import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, Subject, map, tap} from "rxjs";
import {Gesture, GestureDTO} from "../types/gesture";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {MotorPosition} from "../types/motor-position";
import {MotorService} from "./motor.service";

@Injectable({
    providedIn: "root",
})
export class GestureService {
    private gestures: Gesture[] = [];
    private gesturesSubject: Subject<Gesture[]> = new BehaviorSubject(
        this.gestures,
    );
    private gestureIdToMotorPositions: Map<string, MotorPosition[]> = new Map();

    constructor(
        private apiService: ApiService,
        private motorService: MotorService,
    ) {
        this.getAllGesturesFromDb().subscribe((gestures) => {
            this.gestures.unshift(...gestures);
            this.publishGestures();
        });
    }

    public getGesturesObservable(): Observable<Gesture[]> {
        return this.gesturesSubject;
    }

    public saveGesture(
        name: string,
        motorPositions: MotorPosition[],
    ): Observable<Gesture> {
        return this.createGestureInDb(name, motorPositions).pipe(
            tap((gesture) => {
                this.gestures.push(gesture);
                this.publishGestures();
                this.gestureIdToMotorPositions.set(
                    gesture.gestureId,
                    structuredClone(motorPositions),
                );
            }),
        );
    }

    public renameGesture(gestureId: string, name: string) {
        this.apiService
            .patch(`${UrlConstants.GESTURE}/${gestureId}`, {name})
            .subscribe(() => {
                const gesture = this.getCachedGestureOfId(gestureId);
                if (gesture) {
                    gesture.name = name;
                    this.publishGestures();
                }
            });
    }

    public deleteGesture(gestureId: string) {
        this.apiService
            .delete(`${UrlConstants.GESTURE}/${gestureId}`)
            .subscribe(() => {
                this.gestures = this.gestures.filter(
                    (gesture) => gesture.gestureId !== gestureId,
                );
                this.publishGestures();
            });
    }

    public applyGesture(gestureId: string) {
        const cached = this.gestureIdToMotorPositions.get(gestureId);
        if (cached) {
            this.motorService.setPositions(cached);
            return;
        }
        this.apiService
            .get(`${UrlConstants.GESTURE}/${gestureId}`)
            .pipe(map((dto) => dto["motorPositions"] as MotorPosition[]))
            .subscribe((motorPositions) => {
                this.gestureIdToMotorPositions.set(gestureId, motorPositions);
                this.motorService.setPositions(motorPositions);
            });
    }

    /** Full gesture (name + motorPositions) for export. */
    public getGestureForExport(
        gestureId: string,
    ): Observable<{name: string; motorPositions: MotorPosition[]}> {
        return this.apiService
            .get(`${UrlConstants.GESTURE}/${gestureId}`)
            .pipe(
                map((dto) => ({
                    name: dto["name"] as string,
                    motorPositions: dto["motorPositions"] as MotorPosition[],
                })),
            );
    }

    private getAllGesturesFromDb(): Observable<Gesture[]> {
        return this.apiService.get(UrlConstants.GESTURE).pipe(
            map((dto) => {
                const gestureDtos: GestureDTO[] = dto["gestures"];
                return gestureDtos.map(
                    (d) => new Gesture(d.name, d.gestureId, d.deletable),
                );
            }),
        );
    }

    private createGestureInDb(
        name: string,
        motorPositions: MotorPosition[],
    ): Observable<Gesture> {
        return this.apiService
            .post(UrlConstants.GESTURE, {name, motorPositions})
            .pipe(
                map(
                    (dto: GestureDTO) =>
                        new Gesture(dto.name, dto.gestureId, dto.deletable),
                ),
            );
    }

    private publishGestures() {
        this.gesturesSubject.next(this.gestures);
    }

    private getCachedGestureOfId(gestureId: string): Gesture | undefined {
        return this.gestures.find((gesture) => gesture.gestureId === gestureId);
    }
}
