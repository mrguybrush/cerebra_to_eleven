import {Component, OnInit} from "@angular/core";
import {
    AbstractControl,
    FormControl,
    FormGroup,
    Validators,
} from "@angular/forms";
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
import {
    VoiceSettings,
    PiperVoice,
} from "src/app/shared/types/voice-settings";
import {AssistantModel} from "src/app/shared/types/assistantModel";
import {VoiceAssistant} from "src/app/shared/types/voice-assistant";
import {LlmSettings} from "src/app/shared/types/llm-settings";

type ConnectionType = "gemini" | "local-llm" | "tryb";

@Component({
    selector: "app-settings",
    templateUrl: "./settings.component.html",
    styleUrl: "./settings.component.scss",
})
export class SettingsComponent implements OnInit {
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
    ) {
        this.locales = this.blocklyLanguageService.locales;
        this.selectedLanguage = this.blocklyLanguageService.currentCode$.value;
    }

    ngOnInit(): void {
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

    onLanguageChange(code: string): void {
        this.selectedLanguage = code;
        this.blocklyLanguageService.setLanguage(code);
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
