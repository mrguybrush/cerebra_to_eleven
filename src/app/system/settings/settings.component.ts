import {Component} from "@angular/core";
import {BlocklyLanguageService} from "src/app/shared/services/blockly-language.service";
import {PibBlocklyLocale} from "src/app/program/pib-blockly/i18n/pib-blockly-locales";

@Component({
    selector: "app-settings",
    templateUrl: "./settings.component.html",
    styleUrl: "./settings.component.scss",
})
export class SettingsComponent {
    locales: PibBlocklyLocale[];
    selectedLanguage: string;

    constructor(private blocklyLanguageService: BlocklyLanguageService) {
        this.locales = this.blocklyLanguageService.locales;
        this.selectedLanguage = this.blocklyLanguageService.currentCode$.value;
    }

    onLanguageChange(code: string): void {
        this.selectedLanguage = code;
        this.blocklyLanguageService.setLanguage(code);
    }
}
