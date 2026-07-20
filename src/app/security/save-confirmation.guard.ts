import {Injectable} from "@angular/core";
import {TranslateService} from "@ngx-translate/core";
import {SaveConfirmationGuardService} from "../shared/services/save-confirmation-guard.service";
import {SaveConfirmationOptions} from "../shared/types/save-confirmation-options.enum";
import {ProgramSplitscreenComponent} from "../program/program-overview/program-manager/program-splitscreen/program-splitscreen.component";
import {ProgramService} from "../shared/services/program.service";

@Injectable({
    providedIn: "root",
})
export class SaveConfirmationGuard {
    constructor(
        private saveConfirmationGuardService: SaveConfirmationGuardService,
        private programService: ProgramService,
        private readonly translateService: TranslateService,
    ) {}

    async canDeactivate(
        component: ProgramSplitscreenComponent,
    ): Promise<boolean> {
        const title: string = this.translateService.instant("saveConfirmation.title");
        const msg: string = this.translateService.instant("saveConfirmation.message");
        const declineMsg: string = this.translateService.instant(
            "saveConfirmation.dontSave",
        );
        const confirmationMsg: string = this.translateService.instant("common.save");

        if (
            component.codeVisualNew !== component.codeVisualOld &&
            this.programService.getProgramFromCache(component.programNumber)
        ) {
            const confirmationResult =
                await this.saveConfirmationGuardService.openConfirmationModal(
                    title,
                    msg,
                    confirmationMsg,
                    declineMsg,
                );
            if (confirmationResult === SaveConfirmationOptions.Cancel) {
                return false;
            }

            if (confirmationResult === SaveConfirmationOptions.Save) {
                component.saveCode();
            }
        }
        return true;
    }
}
