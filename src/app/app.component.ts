import {Component, OnInit} from "@angular/core";
import {NavigationEnd, Router} from "@angular/router";
import {SystemSettingsService} from "src/app/shared/services/system-settings.service";
import {MenuVisibility} from "src/app/shared/types/menu-visibility";
import {BlocklyLanguageService} from "src/app/shared/services/blockly-language.service";
import {TranslateService} from "@ngx-translate/core";
import {DEFAULT_LOCALE_CODE} from "src/app/program/pib-blockly/i18n/pib-blockly-locales";
import {RosService} from "src/app/shared/services/ros-service/ros.service";
import {APP_VERSION} from "src/app/version";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit {
    // Kleine Versionsanzeige unter dem Motorstrom-Button (siehe version.ts).
    readonly appVersion = APP_VERSION;
    currentRoute: string = "";
    isActiveRoute = false;
    jointControlNavItemGroup = [
        "/joint-control/",
        "/joint-control/head",
        "/joint-control/left-hand",
        "/joint-control/right-hand",
        "/joint-control/left-arm",
        "/joint-control/right-arm",
    ];

    // Ausgeblendet ueber einen Haken in den Einstellungen ("Menüpunkte") -
    // die Seite bleibt ueber die direkte URL trotzdem erreichbar.
    menuVisibility: MenuVisibility = {
        jointControl: false,
        pose: false,
        camera: false,
        motionCapture: false,
        voiceRecording: false,
        voiceAssistant: false,
        program: false,
        system: false,
    };

    // null = Countdown ausblenden (Auto-Off deaktiviert oder Roboter schon
    // aus) - siehe relay_control.py _publish_countdown.
    autoOffSecondsRemaining: number | null = null;

    constructor(
        private router: Router,
        private readonly systemSettingsService: SystemSettingsService,
        private readonly blocklyLanguageService: BlocklyLanguageService,
        private readonly translateService: TranslateService,
        private readonly rosService: RosService,
    ) {
        // Gleiche Sprachauswahl wie fuer die Blockly-Bloecke (siehe
        // settings.component.ts onLanguageChange) - beim Start den zuletzt
        // gespeicherten Code uebernehmen, statt immer mit Deutsch zu starten.
        this.translateService.setDefaultLang(DEFAULT_LOCALE_CODE);
        this.translateService.use(this.blocklyLanguageService.currentCode$.value);
    }

    ngOnInit(): void {
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                this.isActiveRoute =
                    event.urlAfterRedirects.includes("joint-control");
            }
        });
        this.systemSettingsService.menuVisibilitySubject.subscribe(
            (visibility) => {
                this.menuVisibility = visibility;
            },
        );
        this.rosService.autoOffSecondsRemainingReceiver$.subscribe(
            (seconds) => {
                this.autoOffSecondsRemaining = seconds < 0 ? null : seconds;
            },
        );
    }
}
