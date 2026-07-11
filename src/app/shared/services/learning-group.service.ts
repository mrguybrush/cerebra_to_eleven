import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, map, tap} from "rxjs";
import {ApiService} from "./api.service";
import {UrlConstants} from "./url.constants";

export interface LearningGroup {
    groupId: string;
    name: string;
}

/**
 * Lerngruppen: Programme und Posen gehoeren optional zu einer Gruppe.
 * Die hier gesetzte aktive Gruppe filtert serverseitig die Listen
 * (GET /program, GET /pose) - dadurch sind auch die Blockly-Dropdowns
 * automatisch gefiltert. Nach einem Wechsel muessen die betroffenen
 * Frontend-Services ihre Caches neu laden (siehe settings.component.ts).
 */
@Injectable({
    providedIn: "root",
})
export class LearningGroupService {
    groupsSubject = new BehaviorSubject<LearningGroup[]>([]);
    activeGroupSubject = new BehaviorSubject<LearningGroup | null>(null);

    constructor(private apiService: ApiService) {
        this.loadGroups();
        this.loadActiveGroup();
    }

    loadGroups() {
        this.apiService
            .get(UrlConstants.LEARNING_GROUPS)
            .pipe(map((dto) => (dto["groups"] ?? []) as LearningGroup[]))
            .subscribe((groups) => this.groupsSubject.next(groups));
    }

    loadActiveGroup() {
        this.apiService
            .get(`${UrlConstants.LEARNING_GROUPS}/active`)
            .pipe(map((dto) => (dto["activeGroup"] ?? null) as LearningGroup | null))
            .subscribe((group) => this.activeGroupSubject.next(group));
    }

    createGroup(name: string): Observable<LearningGroup> {
        return this.apiService
            .post(UrlConstants.LEARNING_GROUPS, {name})
            .pipe(
                map((dto) => dto as LearningGroup),
                tap(() => this.loadGroups()),
            );
    }

    deleteGroup(groupId: string): Observable<void> {
        return this.apiService
            .delete(`${UrlConstants.LEARNING_GROUPS}/${groupId}`)
            .pipe(
                tap(() => {
                    this.loadGroups();
                    this.loadActiveGroup();
                }),
            );
    }

    /** groupId null = keine Gruppe aktiv (alles anzeigen). */
    setActiveGroup(groupId: string | null): Observable<LearningGroup | null> {
        return this.apiService
            .put(`${UrlConstants.LEARNING_GROUPS}/active`, {groupId})
            .pipe(
                map((dto) => (dto["activeGroup"] ?? null) as LearningGroup | null),
                tap((group) => this.activeGroupSubject.next(group)),
            );
    }
}
