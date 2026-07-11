import {Component, OnInit} from "@angular/core";
import {Observable} from "rxjs";
import {MatSnackBar} from "@angular/material/snack-bar";
import {ProgramService, ProgramAssignment} from "src/app/shared/services/program.service";
import {PoseService, PoseAssignment} from "src/app/shared/services/pose.service";
import {
    LearningGroup,
    LearningGroupService,
} from "src/app/shared/services/learning-group.service";
import {Program} from "src/app/shared/types/program";

type AssignmentKind = "program" | "pose";
type SortColumn = "name" | "kind" | "group";

interface AssignmentRow {
    kind: AssignmentKind;
    id: string; // programNumber or poseId
    name: string;
    // Programs have no "non-deletable" concept, so this is always true for
    // them - only default poses (Startup/Resting, Calibration) are locked.
    deletable: boolean;
    learningGroupId: string | null;
    editingName: string | null; // non-null while the inline rename input is open
    copyTargetGroupId: string; // bound to the row's "copy to" select, "" = keine Gruppe
}

/**
 * "Programme": admin table listing every program and pose (not
 * just the ones visible under the currently active group) so they can be
 * assigned to a learning group, copied into another one, renamed or
 * deleted - see pose_service.get_all_poses_admin /
 * program_service.get_all_programs_admin (GET .../?all=true) on the
 * backend. Gestures/movement sequences are intentionally left out for now.
 */
@Component({
    selector: "app-program-assignment",
    templateUrl: "./program-assignment.component.html",
    styleUrl: "./program-assignment.component.scss",
})
export class ProgramAssignmentComponent implements OnInit {
    rows: AssignmentRow[] = [];
    groups: LearningGroup[] = [];

    sortColumn: SortColumn = "name";
    sortAscending = true;

    constructor(
        private programService: ProgramService,
        private poseService: PoseService,
        private learningGroupService: LearningGroupService,
        private matSnackBarService: MatSnackBar,
    ) {}

    ngOnInit(): void {
        this.learningGroupService.groupsSubject.subscribe((groups) => {
            this.groups = groups;
        });
        this.reload();
    }

    reload(): void {
        this.programService
            .getAllProgramsForAssignment()
            .subscribe((programs: ProgramAssignment[]) => {
                const programRows = programs.map((p) =>
                    this.toRow(
                        "program",
                        p.programNumber,
                        p.name,
                        true,
                        p.learningGroupId,
                    ),
                );
                this.poseService
                    .getAllPosesForAssignment()
                    .subscribe((poses: PoseAssignment[]) => {
                        const poseRows = poses.map((p) =>
                            this.toRow(
                                "pose",
                                p.poseId,
                                p.name,
                                p.deletable,
                                p.learningGroupId,
                            ),
                        );
                        this.rows = [...programRows, ...poseRows];
                        this.applySort();
                    });
            });
    }

    private toRow(
        kind: AssignmentKind,
        id: string,
        name: string,
        deletable: boolean,
        learningGroupId: string | null,
    ): AssignmentRow {
        return {
            kind,
            id,
            name,
            deletable,
            learningGroupId,
            editingName: null,
            copyTargetGroupId: "",
        };
    }

    sortBy(column: SortColumn): void {
        if (this.sortColumn === column) {
            this.sortAscending = !this.sortAscending;
        } else {
            this.sortColumn = column;
            this.sortAscending = true;
        }
        this.applySort();
    }

    private applySort(): void {
        const dir = this.sortAscending ? 1 : -1;
        this.rows = [...this.rows].sort((a, b) => {
            switch (this.sortColumn) {
                case "kind":
                    return (
                        dir * a.kind.localeCompare(b.kind) ||
                        a.name.localeCompare(b.name)
                    );
                case "group":
                    return (
                        dir *
                            this.groupName(a.learningGroupId).localeCompare(
                                this.groupName(b.learningGroupId),
                            ) || a.name.localeCompare(b.name)
                    );
                case "name":
                default:
                    return dir * a.name.localeCompare(b.name);
            }
        });
    }

    groupName(groupId: string | null): string {
        if (!groupId) return "(keine Gruppe)";
        return (
            this.groups.find((g) => g.groupId === groupId)?.name ??
            "(keine Gruppe)"
        );
    }

    onGroupChange(row: AssignmentRow, groupId: string): void {
        const newGroupId = groupId || null;
        // Explicit union-of-value-type annotation (not a union of two
        // distinct Observable<X> types) - otherwise TS can't resolve the
        // .subscribe() overload on the ternary's inferred union type.
        const request$: Observable<ProgramAssignment | PoseAssignment> =
            row.kind === "program"
                ? this.programService.setProgramGroup(row.id, newGroupId)
                : this.poseService.setPoseGroup(row.id, newGroupId);
        request$.subscribe({
            next: () => {
                row.learningGroupId = newGroupId;
                this.applySort();
                this.toast(`„${row.name}" zugeordnet: ${this.groupName(newGroupId)}`);
            },
            error: () => this.toast("Gruppe konnte nicht geändert werden."),
        });
    }

    copyToGroup(row: AssignmentRow): void {
        const targetGroupId = row.copyTargetGroupId || null;
        const request$: Observable<ProgramAssignment | PoseAssignment> =
            row.kind === "program"
                ? this.programService.copyProgramToGroup(row.id, targetGroupId)
                : this.poseService.copyPoseToGroup(row.id, targetGroupId);
        request$.subscribe({
            next: () => {
                this.toast(
                    `„${row.name}" nach ${this.groupName(targetGroupId)} kopiert.`,
                );
                this.reload();
            },
            error: () => this.toast("Kopieren fehlgeschlagen."),
        });
    }

    startRename(row: AssignmentRow): void {
        if (!row.deletable) return;
        row.editingName = row.name;
    }

    cancelRename(row: AssignmentRow): void {
        row.editingName = null;
    }

    confirmRename(row: AssignmentRow): void {
        const newName = (row.editingName ?? "").trim();
        row.editingName = null;
        if (!newName || newName === row.name) return;

        if (row.kind === "program") {
            this.programService
                .updateProgramByProgramNumber(new Program(newName, row.id))
                .subscribe({
                    next: () => (row.name = newName),
                    error: () => this.toast("Umbenennen fehlgeschlagen."),
                });
        } else {
            // renamePose() is fire-and-forget (no confirmation observable),
            // matching how pose.component.ts already uses it.
            this.poseService.renamePose(row.id, newName);
            row.name = newName;
        }
    }

    deleteRow(row: AssignmentRow): void {
        if (!row.deletable) return;
        if (!confirm(`„${row.name}" wirklich löschen?`)) return;

        if (row.kind === "program") {
            this.programService.deleteProgramByProgramNumber(row.id).subscribe({
                next: () => this.removeRow(row),
                error: () => this.toast("Löschen fehlgeschlagen."),
            });
        } else {
            // deletePose() is fire-and-forget, matching pose.component.ts.
            this.poseService.deletePose(row.id);
            this.removeRow(row);
        }
    }

    private removeRow(row: AssignmentRow): void {
        this.rows = this.rows.filter((r) => r !== row);
    }

    private toast(message: string): void {
        this.matSnackBarService.open(message, "", {
            panelClass: "cerebra-toast",
            duration: 3000,
        });
    }
}
