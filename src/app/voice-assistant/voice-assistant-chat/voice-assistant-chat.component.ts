import {
    Component,
    OnDestroy,
    OnInit,
    TemplateRef,
    ViewChild,
} from "@angular/core";
import {FormControl, Validators} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";
import {NgbModal, NgbModalRef} from "@ng-bootstrap/ng-bootstrap";
import {Observable, Subject, Subscription} from "rxjs";
import {SidebarElement} from "src/app/shared/interfaces/sidebar-element.interface";
import {ChatService} from "src/app/shared/services/chat.service";
import {VoiceAssistantService} from "src/app/shared/services/voice-assistant.service";
import {CerebraRegex} from "src/app/shared/types/cerebra-regex";
import {Chat, ChatDto} from "src/app/shared/types/chat.class";
import {VoiceAssistant} from "src/app/shared/types/voice-assistant";
import {VoiceAssistantState} from "../../shared/types/voice-assistant-state";
import {Location} from "@angular/common";
import {TokenService} from "src/app/shared/services/token.service";
import {AssistantModel} from "src/app/shared/types/assistantModel";
import {TranslateService} from "@ngx-translate/core";

@Component({
    selector: "app-voice-assistant-chat",
    templateUrl: "./voice-assistant-chat.component.html",
    styleUrls: ["./voice-assistant-chat.component.scss"],
})
export class VoiceAssistantChatComponent implements OnInit, OnDestroy {
    @ViewChild("modalContent") modalContent: TemplateRef<any> | undefined;
    ngbModalRef?: NgbModalRef;
    personalityIcon: string = "../../assets/voice-assistant-svgs/chat/chat.svg";
    topicFormControl: FormControl = new FormControl("");
    subject!: Observable<SidebarElement[]>;
    personality?: VoiceAssistant;
    personalityId?: string | null;
    uuid: string | undefined;
    selected: Subject<string> = new Subject();
    turnedOn: boolean = false;
    activeChatId: string = "";
    activePersonalityId: string = "";
    currentChatId: string | null = "";
    voiceAssistantActivationToggle = new FormControl(false);
    chatSubjectSubscription!: Subscription;
    private personalitiesSubscription!: Subscription;
    smartConnectActive = false;
    private assistantModels: AssistantModel[] = [];

    constructor(
        private readonly modalService: NgbModal,
        private readonly router: Router,
        private readonly chatService: ChatService,
        private readonly voiceAssistantService: VoiceAssistantService,
        private readonly route: ActivatedRoute,
        private readonly tokenService: TokenService,
        private readonly translateService: TranslateService,
        location: Location,
    ) {
        location.onUrlChange((url, _state) => {
            let urlArray: string[] = url.split("/");
            this.currentChatId = urlArray[urlArray.length - 1];
        });
    }

    ngOnInit() {
        // set current state of VA (in case another user is using it)
        this.voiceAssistantService.voiceAssistantStateObservable.subscribe(
            (state: VoiceAssistantState) => {
                this.voiceAssistantActivationToggle.setValue(state.turnedOn);
                this.turnedOn = state.turnedOn;
                const deleteChat = this.dropdownCallbackMethods.find(
                    (e) => e.label === this.deleteChatLabel,
                );
                if (deleteChat) {
                    deleteChat.disabled = this.turnedOn;
                }
                this.chatService.getChatById(state.chatId).subscribe((chat) => {
                    this.activePersonalityId = chat.personalityId;
                });
            },
        );
        this.tokenService.tokenStatus$.subscribe((response) => {
            this.smartConnectActive = response.tokenActive;
        });
        this.voiceAssistantService.assistantModelsSubject.subscribe(
            (models) => {
                this.assistantModels = models;
            },
        );
        this.voiceAssistantService.getAllAssistantModels();
        // this.personality is otherwise only (re-)assigned inside the
        // route.paramMap subscription below, i.e. on navigation - it never
        // picked up changes made elsewhere (e.g. switching the Chat-LLM in
        // Settings updates the personality's assistantModelId in the
        // service's cache, but this component kept its stale reference from
        // before the change), so canActivateVoiceAssistant() kept seeing the
        // old model and refused to unlock the toggle even with a valid key.
        this.personalitiesSubscription =
            this.voiceAssistantService.personalitiesSubject.subscribe(
                (personalities) => {
                    if (!this.personalityId) {
                        return;
                    }
                    const updated = personalities.find(
                        (p) => p.personalityId === this.personalityId,
                    );
                    if (updated) {
                        this.personality = updated;
                    }
                },
            );
        this.route.paramMap.subscribe((_params) => {
            const routeParts: string[] = this.router.url.split("/");
            this.currentChatId = routeParts[routeParts.length - 1];

            this.personalityId = this.router.url
                .split("/")
                .find((segment) => RegExp(CerebraRegex.UUID).test(segment));
            this.personality = this.personalityId
                ? this.voiceAssistantService.getPersonality(
                      this.personalityId,
                  ) ?? this.route.snapshot.params["personality"]
                : this.route.snapshot.params["personality"];
            if (this.personality) {
                this.subject = this.chatService.getSubject(
                    this.personality.personalityId,
                );
            } else {
                throw Error("undefined personality and subject");
            }
            localStorage.setItem("voice-assistant-tab", "chat");
            this.topicFormControl.setValidators([
                Validators.required,
                Validators.minLength(2),
                Validators.maxLength(255),
            ]);
            this.toggleDeleteChat(this.chatService.chats);
        });

        this.chatSubjectSubscription = this.chatService.chatSubject.subscribe(
            (chats) => {
                this.toggleDeleteChat(chats);
            },
        );
    }

    showModal = () => {
        this.ngbModalRef = this.modalService.open(this.modalContent, {
            ariaLabelledBy: "modal-basic-title",
            size: "sm",
            windowClass: "cerebra-modal",
            backdropClass: "cerebra-modal-backdrop",
        });
        return this.ngbModalRef;
    };

    openAddModal() {
        this.topicFormControl.setValue("");
        this.showModal();
    }

    openEditModal(uuid: string) {
        this.uuid = uuid;
        if (this.uuid) {
            const updateChat = this.chatService.getChat(this.uuid);
            this.topicFormControl.setValue(updateChat?.topic ?? "");
            this.showModal();
        }
    }

    addChat() {
        if (this.personalityId) {
            const chat: Observable<Chat> = this.chatService.createChat(
                new ChatDto(this.topicFormControl.value, this.personalityId),
            );
            chat.subscribe((chat) => this.selected.next(chat.chatId));
        } else {
            this.ngbModalRef?.close("failed");
        }
    }

    editChat = () => {
        if (this.uuid) {
            const updateChat = this.chatService.getChat(this.uuid)?.clone();
            if (updateChat) {
                updateChat.topic = this.topicFormControl.value;
                this.chatService.updateChatById(updateChat);
                this.ngbModalRef?.close("edited");
                this.uuid = undefined;
            }
        }
    };

    saveChat() {
        if (this.topicFormControl.valid) {
            if (this.uuid) {
                this.editChat();
            } else {
                this.addChat();
            }
        }
        this.ngbModalRef?.close("saved");
    }

    closeModal = () => {
        this.ngbModalRef?.close("cancelled");
        this.uuid = undefined;
    };

    deleteChat(uudi: string) {
        if (uudi) {
            this.chatService.deleteChatById(uudi);
            localStorage.removeItem("chat");
        }
    }

    /** The assistant can be switched on when the smart-connect token is
     * active OR the current personality uses a model that needs no tryb
     * cloud access (Gemini has its own key, the local-network LLM none). */
    canActivateVoiceAssistant(): boolean {
        if (this.smartConnectActive) {
            return true;
        }
        const model = this.assistantModels.find(
            (m) => m.id === this.personality?.assistantModelId,
        );
        if (!model) {
            return false;
        }
        const apiName = model.apiName.toLowerCase();
        return apiName.includes("gemini") || apiName === "local-llm";
    }

    toggleVoiceAssistant() {
        const turnedOn = !this.voiceAssistantActivationToggle.value;
        const nextState: VoiceAssistantState = {turnedOn, chatId: ""};
        if (turnedOn) {
            const match = RegExp(
                `/voice-assistant/${CerebraRegex.UUID}/chat/(${CerebraRegex.UUID})`,
            ).exec(this.router.url);
            if (match) nextState.chatId = match[1];
            else throw new Error("no chat selected");
        }

        this.turnedOn = turnedOn;
        this.activeChatId = nextState.chatId;

        this.voiceAssistantService.setVoiceAssistantState(nextState).subscribe({
            error: (error) => console.error(error),
        });

        const deleteChat = this.dropdownCallbackMethods.find(
            (e) => e.label === this.deleteChatLabel,
        );
        if (deleteChat) {
            deleteChat.disabled = this.turnedOn;
        }
    }

    toggleDeleteChat(chats: Chat[]) {
        const filteredChats = chats.filter((chat) => {
            return chat.personalityId === this.personalityId;
        });
        const numberOfChats = filteredChats.length;
        const deleteChat = this.dropdownCallbackMethods.find(
            (e) => e.label === this.deleteChatLabel,
        );
        if (deleteChat && !this.turnedOn) {
            deleteChat.disabled = numberOfChats <= 1;
        }
    }

    ngOnDestroy(): void {
        this.chatSubjectSubscription.unsubscribe();
        this.personalitiesSubscription.unsubscribe();
    }

    private readonly deleteChatLabel = this.translateService.instant(
        "voiceAssistant.deleteChat",
    );

    optionCallbackMethods = [
        {
            icon: "",
            label: this.translateService.instant("voiceAssistant.newChat"),
            clickCallback: this.openAddModal.bind(this),
            disabled: false,
        },
    ];

    dropdownCallbackMethods = [
        {
            icon: "../../assets/edit.svg",
            label: this.translateService.instant("common.rename"),
            clickCallback: this.openEditModal.bind(this),
            disabled: false,
        },
        {
            icon: "../../assets/delete.svg",
            label: this.deleteChatLabel,
            clickCallback: this.deleteChat.bind(this),
            disabled: false,
        },
    ];
}
