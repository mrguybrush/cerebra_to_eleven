import {Component, OnInit} from "@angular/core";
import {
    AbstractControl,
    FormControl,
    FormGroup,
    Validators,
} from "@angular/forms";
import {debounceTime, distinctUntilChanged} from "rxjs";
import {BlocklyLanguageService} from "src/app/shared/services/blockly-language.service";
import {PibBlocklyLocale} from "src/app/program/pib-blockly/i18n/pib-blockly-locales";
import {RosService} from "src/app/shared/services/ros-service/ros.service";
import {TokenService} from "src/app/shared/services/token.service";
import {VoiceSettingsService} from "src/app/shared/services/voice-settings.service";
import {VoiceAssistantService} from "src/app/shared/services/voice-assistant.service";
import {
    GeminiKeyVerification,
    LlmSettingsService,
} from "src/app/shared/services/llm-settings.service";
import {
    LearningGroup,
    LearningGroupService,
} from "src/app/shared/services/learning-group.service";
import {PoseService} from "src/app/shared/services/pose.service";
import {ProgramService} from "src/app/shared/services/program.service";
import {SystemSettingsService} from "src/app/shared/services/system-settings.service";
import {
    MovementSettingsService,
    MIN_SPEED_PERCENT,
    ABSOLUTE_MAX_SPEED_PERCENT,
} from "src/app/shared/services/movement-settings.service";
import {
    VoiceSettings,
    PiperVoice,
} from "src/app/shared/types/voice-settings";
import {AssistantModel} from "src/app/shared/types/assistantModel";
import {VoiceAssistant} from "src/app/shared/types/voice-assistant";
import {LlmSettings} from "src/app/shared/types/llm-settings";
import {MenuVisibility} from "src/app/shared/types/menu-visibility";
import {TranslateService} from "@ngx-translate/core";

type ConnectionType = "gemini" | "local-llm" | "tryb";

@Component({
    selector: "app-settings",
    templateUrl: "./settings.component.html",
    styleUrl: "./settings.component.scss",
})
export class SettingsComponent implements OnInit {
    // --- Auto-Off (automatische Ruhestellung + Abschaltung) ---
    // null = deaktiviert. ACHTUNG: das Input ist type="number", Angulars
    // NumberValueAccessor liefert daher eine ZAHL oder null als
    // Control-Wert - NICHT den rohen String aus dem Feld.
    autoOffMinutesControl = new FormControl<number | string | null>(null);
    // null = wird nicht angezeigt (Auto-Off deaktiviert oder Roboter schon
    // aus). Kommt live per ROS-Topic aus relay_control.py, nicht aus der DB.
    autoOffSecondsRemaining: number | null = null;

    // --- Maximale Bewegungsgeschwindigkeit (Sicherheits-Obergrenze) ---
    // Begrenzt den Tempo-Regler unter Posen; wird backend-seitig
    // durchgesetzt (siehe movement_settings_service.py).
    maxSpeedPercent = 100;
    readonly minSpeedPercent = MIN_SPEED_PERCENT;
    readonly absoluteMaxSpeedPercent = ABSOLUTE_MAX_SPEED_PERCENT;

    // --- Menüpunkte ein-/ausblenden ---
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
    // Einziger Weg zurueck in die Einstellungen, sobald "System" ausgeblendet
    // ist (der Menuepunkt verschwindet dann aus der Navigation).
    readonly systemDirectLink = `${window.location.origin}/system/settings`;
    systemLinkCopied = false;

    // --- Augen-Anzeige neu starten ---
    // Behilft dem Fall, dass die Augen nach dem Hochfahren des Roboters
    // nicht vollstaendig im Vollbild angezeigt werden.
    restartingDisplay = false;

    // --- Blockprogrammierung-Sprache ---
    locales: PibBlocklyLocale[];
    selectedLanguage: string;

    // --- Chat-LLM (gilt global fuer alle Personalities) ---
    // Radiobutton entscheidet die Verbindungsart; nur die dazu passenden
    // Felder werden angezeigt (Gemini-Key / lokale LLM-Adresse / Tryb-Modell
    // + -Token) - vorher standen alle Optionen gleichzeitig und ungeordnet
    // untereinander.
    connectionType: ConnectionType = "tryb";
    assistantModels: AssistantModel[] = [];
    selectedAssistantModelId: number | null = null;
    private personalities: VoiceAssistant[] = [];

    // Tryb-Modelle (GPT-4o/Claude/...) - alles AUSSER Gemini und dem
    // lokalen LLM, die je nur ein "Modell" ohne Auswahl haben.
    get trybModels(): AssistantModel[] {
        return this.assistantModels.filter(
            (m) => !this.isGeminiModel(m) && !this.isLocalLlmModel(m),
        );
    }
    selectedTrybModelId: number | null = null;

    private get geminiModelId(): number | null {
        return this.assistantModels.find((m) => this.isGeminiModel(m))?.id ?? null;
    }

    private get localLlmModelId(): number | null {
        return this.assistantModels.find((m) => this.isLocalLlmModel(m))?.id ?? null;
    }

    private isGeminiModel(m: AssistantModel): boolean {
        return m.apiName.toLowerCase().includes("gemini");
    }

    private isLocalLlmModel(m: AssistantModel): boolean {
        return m.apiName.toLowerCase() === "local-llm";
    }

    // --- Gemini / lokales Netzwerk-LLM ---
    geminiApiKeyControl = new FormControl("");
    geminiKeyTextType = false;
    verifyingGeminiKey = false;
    geminiKeyVerification: GeminiKeyVerification | null = null;
    localLlmUrlControl = new FormControl("");
    localLlmModelControl = new FormControl("");
    llmSettingsSaved = false;

    // --- Lerngruppe ---
    learningGroups: LearningGroup[] = [];
    activeLearningGroup: LearningGroup | null = null;
    newGroupNameControl = new FormControl("");

    // --- Lokale Sprachausgabe (Piper) ---
    localVoiceEnabled: boolean = false;
    selectedVoiceModel: string = "de_DE-thorsten-low";
    availableVoices: PiperVoice[] = [];

    // --- Smart-API-Token (GPT-4o / Claude via tryb) ---
    passwordTextType: boolean = true;
    isTokenStored: boolean = false;
    isTokenActive: boolean = false;
    onErrorSubmit: boolean = false;
    encryptTokenForm = new FormGroup(
        {
            token: new FormControl("", [Validators.required]),
            password: new FormControl("", [
                Validators.required,
                Validators.minLength(8),
            ]),
            confirmPassword: new FormControl("", [Validators.required]),
        },
        {validators: this.passwordMatchValidator},
    );
    decryptTokenForm = new FormGroup({
        password: new FormControl({value: "", disabled: this.isTokenActive}, [
            Validators.required,
        ]),
    });

    constructor(
        private blocklyLanguageService: BlocklyLanguageService,
        private readonly rosService: RosService,
        private readonly tokenService: TokenService,
        private readonly voiceSettingsService: VoiceSettingsService,
        private readonly voiceAssistantService: VoiceAssistantService,
        private readonly llmSettingsService: LlmSettingsService,
        private readonly learningGroupService: LearningGroupService,
        private readonly poseService: PoseService,
        private readonly programService: ProgramService,
        private readonly systemSettingsService: SystemSettingsService,
        private readonly translateService: TranslateService,
        private readonly movementSettingsService: MovementSettingsService,
    ) {
        this.locales = this.blocklyLanguageService.locales;
        this.selectedLanguage = this.blocklyLanguageService.currentCode$.value;
    }

    ngOnInit(): void {
        this.systemSettingsService.getAutoOffMinutes().subscribe((minutes) => {
            // Race: wenn der Nutzer schon zu tippen anfaengt, bevor diese
            // (asynchrone) Anfrage zurueckkommt, darf die Antwort das
            // gerade Eingetippte nicht mit dem alten/leeren Wert
            // ueberschreiben - live per Netzwerk-Log nachvollzogen
            // (gespeichert wurde konsequent "null", weil genau das passiert
            // ist). "pristine" heisst: noch nicht angefasst.
            if (this.autoOffMinutesControl.pristine) {
                this.autoOffMinutesControl.setValue(minutes, {
                    emitEvent: false,
                });
            }
        });
        // Speichert waehrend des Tippens (statt nur bei Fokusverlust) - ein
        // Klick auf einen anderen Menuepunkt loeste den vorherigen
        // (blur)-basierten Save nicht zuverlaessig genug aus, bevor die
        // Seite wechselte, wodurch eingetragene Werte nie in der DB
        // ankamen.
        this.autoOffMinutesControl.valueChanges
            .pipe(debounceTime(600), distinctUntilChanged())
            .subscribe(() => this.onAutoOffMinutesChange());

        this.rosService.autoOffSecondsRemainingReceiver$.subscribe(
            (seconds) => {
                this.autoOffSecondsRemaining = seconds < 0 ? null : seconds;
            },
        );

        this.systemSettingsService.menuVisibilitySubject.subscribe(
            (visibility) => {
                this.menuVisibility = visibility;
            },
        );

        this.movementSettingsService.maxSpeedPercent$.subscribe((percent) => {
            this.maxSpeedPercent = percent;
        });

        this.tokenService.tokenStatus$.subscribe((response) => {
            this.isTokenStored = response.tokenExists;
            this.isTokenActive = response.tokenActive;
            this.updatePasswordControlState();
        });

        this.voiceSettingsService.voiceSettingsSubject.subscribe(
            (settings: VoiceSettings) => {
                this.localVoiceEnabled = settings.localVoiceEnabled;
                this.selectedVoiceModel = settings.localVoiceModel;
            },
        );
        this.voiceSettingsService.availableVoicesSubject.subscribe(
            (voices: PiperVoice[]) => {
                this.availableVoices = voices;
            },
        );

        this.voiceAssistantService.assistantModelsSubject.subscribe(
            (models: AssistantModel[]) => {
                this.assistantModels = models;
                this.updateConnectionTypeFromSelectedModel();
            },
        );
        this.voiceAssistantService.personalitiesSubject.subscribe(
            (personalities: VoiceAssistant[]) => {
                this.personalities = personalities;
                if (personalities.length > 0) {
                    const ids = new Set(
                        personalities.map((p) => p.assistantModelId),
                    );
                    // alle Personalities gleich -> Modell anzeigen, sonst
                    // "gemischt" (null)
                    this.selectedAssistantModelId =
                        ids.size === 1 ? personalities[0].assistantModelId : null;
                }
                this.updateConnectionTypeFromSelectedModel();
            },
        );
        // No explicit getAllAssistantModels()/getAllPersonalities() call
        // here: VoiceAssistantService already loads both once from its own
        // constructor (root-provided singleton) and pushes updates through
        // the subjects above. Re-triggering that fetch from this page
        // caused a real bug - see voice-assistant-nav.component.ts's
        // subscription-leak fix.

        this.llmSettingsService.llmSettingsSubject.subscribe(
            (settings: LlmSettings) => {
                this.geminiApiKeyControl.setValue(settings.geminiApiKey ?? "", {
                    emitEvent: false,
                });
                this.localLlmUrlControl.setValue(settings.localLlmUrl, {
                    emitEvent: false,
                });
                this.localLlmModelControl.setValue(settings.localLlmModel, {
                    emitEvent: false,
                });
            },
        );
        // Alte Pruefergebnisse sind nach einer Bearbeitung nicht mehr
        // aussagekraeftig ("gültig" fuer einen laengst geaenderten Key).
        this.geminiApiKeyControl.valueChanges.subscribe(() => {
            this.geminiKeyVerification = null;
        });

        this.learningGroupService.groupsSubject.subscribe((groups) => {
            this.learningGroups = groups;
        });
        this.learningGroupService.activeGroupSubject.subscribe((group) => {
            this.activeLearningGroup = group;
        });
    }

    // --- Lerngruppen ---

    onSelectLearningGroup(groupId: string) {
        this.learningGroupService
            .setActiveGroup(groupId || null)
            .subscribe(() => this.reloadGroupFilteredLists());
    }

    createLearningGroup() {
        const name = (this.newGroupNameControl.value ?? "").trim();
        if (!name) {
            return;
        }
        this.learningGroupService.createGroup(name).subscribe(() => {
            this.newGroupNameControl.setValue("");
        });
    }

    deleteLearningGroup(group: LearningGroup) {
        this.learningGroupService
            .deleteGroup(group.groupId)
            .subscribe(() => this.reloadGroupFilteredLists());
    }

    /** Programs and poses are filtered server-side by the active group, so
     * their cached frontend lists must be re-fetched after a change. */
    private reloadGroupFilteredLists() {
        this.poseService.reload();
        this.programService.getAllPrograms().subscribe();
    }

    /** Ein Dropdown fuer beides: Blockly-Bloecke UND die gesamte Oberflaeche
     * teilen sich dieselbe Sprachauswahl (siehe pib-blockly-locales.ts fuer
     * die Codes "de"/"en"). */
    onLanguageChange(code: string): void {
        this.selectedLanguage = code;
        this.blocklyLanguageService.setLanguage(code);
        this.translateService.use(code);
    }

    /** Leeres Feld oder 0/negativ = Auto-Off deaktiviert. */
    onAutoOffMinutesChange(): void {
        // Kein direktes .trim() auf dem Control-Wert: der ist bei
        // type="number" eine Zahl (oder null), und (15).trim() wirft einen
        // TypeError - dadurch wurde das PUT nie abgeschickt (nginx-Log:
        // viele GETs, kein einziges PUT) und das Feld sprang beim
        // Tab-Wechsel immer auf "deaktiviert" zurueck.
        const raw = String(this.autoOffMinutesControl.value ?? "").trim();
        const parsed = raw === "" ? null : Number(raw);
        const minutes =
            parsed !== null && Number.isFinite(parsed) && parsed > 0
                ? Math.round(parsed)
                : null;
        this.systemSettingsService.setAutoOffMinutes(minutes).subscribe((saved) => {
            this.autoOffMinutesControl.setValue(saved, {emitEvent: false});
        });
    }

    /** Slider fuer die maximale Bewegungsgeschwindigkeit: aktualisiert die
     * Anzeige live und speichert direkt (ein einzelner Wert, kein
     * Tipp-Feld - Speichern beim Loslassen reicht). */
    onMaxSpeedInput(value: string): void {
        this.maxSpeedPercent = Number(value);
    }

    onMaxSpeedChange(value: string): void {
        this.movementSettingsService.setMaxSpeedPercent(Number(value));
    }

    onToggleMenuVisibility(key: keyof MenuVisibility, hidden: boolean): void {
        this.menuVisibility = {...this.menuVisibility, [key]: hidden};
        this.systemSettingsService.setMenuVisibility({[key]: hidden});
    }

    copySystemLink(): void {
        navigator.clipboard.writeText(this.systemDirectLink).then(() => {
            this.systemLinkCopied = true;
            setTimeout(() => (this.systemLinkCopied = false), 2500);
        });
    }

    restartDisplay(): void {
        if (
            !confirm(
                "Augen-Anzeige neu starten? Der Bildschirm ist dabei kurz " +
                    "schwarz.",
            )
        ) {
            return;
        }
        this.restartingDisplay = true;
        this.systemSettingsService
            .restartDisplay()
            .subscribe(() => (this.restartingDisplay = false));
    }

    /** Setzt das Assistant-Model fuer ALLE Personalities (gilt global). */
    private applyAssistantModel(modelId: number | null) {
        if (modelId === null || !Number.isFinite(modelId)) {
            return;
        }
        this.selectedAssistantModelId = modelId;
        for (const personality of this.personalities) {
            if (personality.assistantModelId === modelId) {
                continue;
            }
            const updated = personality.clone();
            updated.assistantModelId = modelId;
            this.voiceAssistantService.updatePersonalityById(updated);
        }
    }

    /** LLM im Tryb-Dropdown gewechselt (nur relevant bei connectionType "tryb"). */
    onSelectAssistantModel(value: string) {
        const modelId = Number(value);
        this.selectedTrybModelId = modelId;
        this.applyAssistantModel(modelId);
    }

    /** Radiobutton "Gemini" / "Lokales Netzwerk-LLM" / "Tryb" gewechselt:
     * setzt sofort das passende Assistant-Model fuer alle Personalities,
     * damit z.B. der Sprachassistent-Aktivierungsschalter sofort stimmt. */
    onSelectConnectionType(type: ConnectionType) {
        this.connectionType = type;
        if (type === "gemini") {
            this.applyAssistantModel(this.geminiModelId);
        } else if (type === "local-llm") {
            this.applyAssistantModel(this.localLlmModelId);
        } else {
            // Tryb: letzte eigene Auswahl, sonst das erste verfuegbare
            // Tryb-Modell - niemals automatisch Gemini/lokales LLM erneut
            // waehlen, auch wenn das gerade noch aktiv war.
            const fallback = this.trybModels[0]?.id ?? null;
            this.applyAssistantModel(this.selectedTrybModelId ?? fallback);
        }
    }

    /** Leitet den aktuell gewaehlten Radiobutton aus dem aktiven Modell ab
     * (z.B. nach dem Laden der Personalities, oder wenn eine andere
     * Cerebra-Instanz das Modell geaendert hat). */
    private updateConnectionTypeFromSelectedModel() {
        if (this.assistantModels.length === 0) {
            return;
        }
        const model = this.assistantModels.find(
            (m) => m.id === this.selectedAssistantModelId,
        );
        if (!model) {
            return; // "gemischt" (selectedAssistantModelId === null) - Radiobutton unveraendert lassen
        }
        if (this.isGeminiModel(model)) {
            this.connectionType = "gemini";
        } else if (this.isLocalLlmModel(model)) {
            this.connectionType = "local-llm";
        } else {
            this.connectionType = "tryb";
            this.selectedTrybModelId = model.id;
        }
    }

    toggleGeminiKeyTextType() {
        this.geminiKeyTextType = !this.geminiKeyTextType;
    }

    verifyGeminiKey() {
        this.verifyingGeminiKey = true;
        this.geminiKeyVerification = null;
        this.llmSettingsService
            .verifyGeminiKey(this.geminiApiKeyControl.value ?? "")
            .subscribe({
                next: (result) => {
                    this.geminiKeyVerification = result;
                    this.verifyingGeminiKey = false;
                },
                error: () => {
                    this.geminiKeyVerification = {
                        valid: false,
                        message: "Überprüfung fehlgeschlagen (keine Antwort vom Server).",
                    };
                    this.verifyingGeminiKey = false;
                },
            });
    }

    saveLlmSettings() {
        this.llmSettingsService.updateLlmSettings({
            geminiApiKey: this.geminiApiKeyControl.value || null,
            localLlmUrl: this.localLlmUrlControl.value ?? "",
            localLlmModel: this.localLlmModelControl.value ?? "",
        });
        this.llmSettingsSaved = true;
        setTimeout(() => (this.llmSettingsSaved = false), 2500);
    }

    // Checkbox "Nur lokale Stimme" umgeschaltet
    onToggleLocalVoice(enabled: boolean) {
        this.localVoiceEnabled = enabled;
        this.persistVoiceSettings();
    }

    // Stimme im Dropdown gewechselt
    onSelectVoiceModel(model: string) {
        this.selectedVoiceModel = model;
        this.persistVoiceSettings();
    }

    private persistVoiceSettings() {
        this.voiceSettingsService.updateVoiceSettings({
            localVoiceEnabled: this.localVoiceEnabled,
            localVoiceModel: this.selectedVoiceModel,
        });
    }

    passwordMatchValidator(form: AbstractControl): null {
        const password = form.get("password")?.value;
        const confirmPassword = form.get("confirmPassword")?.value;

        if (password !== confirmPassword && confirmPassword.length > 0) {
            form.get("confirmPassword")?.setErrors({mismatch: true});
        } else {
            form.get("confirmPassword")?.setErrors(null);
        }
        return null;
    }

    togglePasswordTextType() {
        this.passwordTextType = !this.passwordTextType;
    }

    onSubmitEncryptToken() {
        if (!this.encryptTokenForm.valid) {
            return;
        }
        // never null, because form needs to be valid
        this.rosService
            .encryptToken(
                this.encryptTokenForm.value.token!,
                this.encryptTokenForm.value.password!,
            )
            .subscribe((isSuccessful) => {
                this.submitFormSuccessful(isSuccessful);
            });
    }

    onSubmitDecryptToken() {
        if (!this.decryptTokenForm.valid) {
            return;
        }
        // never null, because form needs to be valid
        this.rosService
            .decryptToken(this.decryptTokenForm.value.password!)
            .subscribe((isSuccessful) => {
                this.submitFormSuccessful(isSuccessful);
            });
    }

    onDeleteToken() {
        this.rosService.deleteTokenMessage();
        this.decryptTokenForm.controls["password"].enable();
        this.tokenService.checkTokenExists();
    }

    private submitFormSuccessful(isSuccessful: boolean) {
        this.onErrorSubmit = !isSuccessful;
        if (isSuccessful) {
            this.tokenService.checkTokenExists();
            this.encryptTokenForm.reset();
            this.decryptTokenForm.reset();
        }
    }

    private updatePasswordControlState() {
        if (this.isTokenActive) {
            this.decryptTokenForm.controls["password"].disable();
        } else {
            this.decryptTokenForm.controls["password"].enable();
        }
    }
}
