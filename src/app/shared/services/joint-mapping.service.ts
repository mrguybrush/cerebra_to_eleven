import {Injectable} from "@angular/core";
import {Observable, map} from "rxjs";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";
import {JointMappingEntry} from "../types/joint-mapping";

/**
 * Liest/schreibt die kalibrierte Motion-Capture-Zuordnung (welche erkannte
 * Koerperseite welchen Robotermotor treibt) - siehe Kalibrierungs-Assistent
 * in motion-capture.component.ts. Persistiert ueber das pib-API in der
 * Datenbank; der gesture_control-ROS-Node liest sie beim (Re-)Start von
 * Mirroring/Capture.
 */
@Injectable({
    providedIn: "root",
})
export class JointMappingService {
    constructor(private apiService: ApiService) {}

    getMapping(): Observable<JointMappingEntry[]> {
        return this.apiService
            .get(UrlConstants.JOINT_MAPPING)
            .pipe(map((dto) => (dto["mappings"] ?? []) as JointMappingEntry[]));
    }

    /** Ersetzt die komplette Zuordnung (ein Eintrag pro kalibriertem Motor). */
    saveMapping(entries: JointMappingEntry[]): Observable<JointMappingEntry[]> {
        return this.apiService
            .put(UrlConstants.JOINT_MAPPING, {mappings: entries})
            .pipe(map((dto) => (dto["mappings"] ?? []) as JointMappingEntry[]));
    }
}
