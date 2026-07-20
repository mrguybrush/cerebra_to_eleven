import {Component, OnInit} from "@angular/core";
import {FormControl} from "@angular/forms";
import {ActivatedRoute, Params} from "@angular/router";
import {ChatService} from "src/app/shared/services/chat.service";
import {VoiceAssistantService} from "src/app/shared/services/voice-assistant.service";
import {ChatMessage} from "src/app/shared/types/chat-message";
import {Chat} from "src/app/shared/types/chat.class";
import {Subscription, combineLatest, map} from "rxjs";
import {TokenService} from "src/app/shared/services/token.service";
import {AssistantModel} from "src/app/shared/types/assistantModel";

@Component({
    selector: "app-chat-window",
    templateUrl: "./chat-window.component.html",
    styleUrls: ["./chat-window.component.scss"],
})
export class ChatWindowComponent implements OnInit {
    chat?: Chat;
    personalityName: string | undefined;
    messages?: ChatMessage[];
    extendedMessages?: ChatMessage[];

    chatMessagesSubscription: Subscription | undefined;
    chatMessagesUpdateSubscription: Subscription | undefined;
    textInputActiveSubscription: Subscription | undefined;

    chatMessageFormControl: FormControl<string> = new FormControl();

    textInputActive = false;

    // Same gating as canActivateVoiceAssistant() in voice-assistant-chat.component.ts
    // (the on/off toggle) - this used to only look at the Smart-API-Token,
    // so the input stayed disabled for personalities on Gemini/lokales LLM
    // even though those need no token at all.
    private smartConnectActive = false;
    private assistantModels: AssistantModel[] = [];

    readonly USER_ICON =
        "../../../../assets/voice-assistant-svgs/chat/user.svg";
    readonly VA_ICON =
        "../../../../assets/voice-assistant-svgs/chat/pib-icon-speaking.png";
    readonly arrow = "../../../../assets/voice-assistant-svgs/chat/arrow.svg";

    constructor(
        private readonly chatService: ChatService,
        private readonly voiceAssistantService: VoiceAssistantService,
        private readonly route: ActivatedRoute,
        private readonly tokenService: TokenService,
    ) {}

    ngOnInit(): void {
        this.tokenService.tokenStatus$.subscribe((response) => {
            this.smartConnectActive = response.tokenActive;
            this.updateChatInputState();
        });
        this.voiceAssistantService.assistantModelsSubject.subscribe(
            (models) => {
                this.assistantModels = models;
                this.updateChatInputState();
            },
        );

        this.route.params.subscribe((params: Params) => {
            this.chatMessagesSubscription?.unsubscribe();
            this.chatMessagesUpdateSubscription?.unsubscribe();
            this.textInputActiveSubscription?.unsubscribe();

            const chatId = params["chatUuid"];
            if (!chatId) return;

            this.textInputActiveSubscription = combineLatest([
                this.chatMessageFormControl.valueChanges,
                this.chatService.getIsListeningObservable(chatId),
            ]).subscribe(([inputText, isListening]) => {
                this.textInputActive = Boolean(inputText && isListening);
            });

            this.chatMessagesSubscription = this.chatService
                .getChatMessagesObservable(chatId)
                .pipe(map((messages) => messages))
                .subscribe(
                    (messages) =>
                        (this.messages = this.chatService
                            .filterMessageUpdates(messages)
                            .slice()
                            .reverse()),
                );

            this.chat = this.chatService.getChat(chatId);
            if (this.chat) {
                this.personalityName =
                    this.voiceAssistantService.getPersonality(
                        this.chat?.personalityId,
                    )?.name;
            }
            this.updateChatInputState();
        });
    }

    /** Gleiche Freischalt-Logik wie canActivateVoiceAssistant() beim
     * Ein/Aus-Schalter: Gemini und lokales LLM brauchen keinen
     * Smart-API-Token. */
    private updateChatInputState(): void {
        if (this.canActivateVoiceAssistant()) {
            this.chatMessageFormControl.enable();
        } else {
            this.chatMessageFormControl.disable();
        }
    }

    private canActivateVoiceAssistant(): boolean {
        if (this.smartConnectActive) {
            return true;
        }
        const personality = this.chat
            ? this.voiceAssistantService.getPersonality(
                  this.chat.personalityId,
              )
            : undefined;
        const model = this.assistantModels.find(
            (m) => m.id === personality?.assistantModelId,
        );
        if (!model) {
            return false;
        }
        const apiName = model.apiName.toLowerCase();
        return apiName.includes("gemini") || apiName === "local-llm";
    }

    sendChatMessage() {
        if (this.chat && this.textInputActive) {
            this.chatService
                .sendChatMessage(
                    this.chat.chatId,
                    this.chatMessageFormControl.value,
                )
                .subscribe(() => this.chatMessageFormControl.setValue(""));
        }
    }
}
