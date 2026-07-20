import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    SimpleChanges,
    ViewChild,
} from "@angular/core";
import * as Blockly from "blockly";
import {Multiselect} from "@mit-app-inventor/blockly-plugin-workspace-multiselect";
import {toolbox} from "../../blockly";
import {ITheme} from "blockly/core/theme";
import {pythonGenerator} from "../../../../pib-blockly/program-generators/custom-generators";
import {customBlockDefinition} from "../../../../pib-blockly/program-blocks/custom-blocks";
import {Abstract} from "blockly/core/events/events_abstract";
import {GuardsCheckStart, Router} from "@angular/router";
import {Subscription} from "rxjs";
import {PoseService} from "src/app/shared/services/pose.service";
import {Pose} from "src/app/shared/types/pose";
import {GestureService} from "src/app/shared/services/gesture.service";
import {Gesture} from "src/app/shared/types/gesture";
import {MovementSequenceService} from "src/app/shared/services/movement-sequence.service";
import {MovementSequence} from "src/app/shared/types/movement-sequence";
import {BlocklyLanguageService} from "src/app/shared/services/blockly-language.service";
import {VoiceRecordingService} from "src/app/shared/services/voice-recording.service";
import {VoiceRecording} from "src/app/shared/types/voice-recording";

@Component({
    selector: "app-program-workspace",
    templateUrl: "./program-workspace.component.html",
    styleUrls: ["./program-workspace.component.scss"],
})
export class ProgramWorkspaceComponent
    implements OnInit, AfterViewInit, OnDestroy, OnChanges
{
    routerEventSubscription!: Subscription;
    observer!: ResizeObserver;
    @ViewChild("blocklyDiv") blocklyDiv!: ElementRef<HTMLDivElement>;

    workspace!: Blockly.WorkspaceSvg;
    toolbox: string = toolbox;

    @Input() codeVisual: string = "{}";

    @Output() codePythonChange = new EventEmitter<string>();
    @Output() codeVisualChange = new EventEmitter<string>();
    @Output() trashcanFlyoutChange = new EventEmitter<number>();

    supportedEvents = new Set([
        Blockly.Events.BLOCK_CHANGE,
        Blockly.Events.BLOCK_CREATE,
        Blockly.Events.BLOCK_DELETE,
        Blockly.Events.BLOCK_MOVE,
    ]);

    readonly customTheme: ITheme = Blockly.Theme.defineTheme("customTheme", {
        base: Blockly.Themes.Classic,
        name: "transparentBackground",
        componentStyles: {
            workspaceBackgroundColour: "transparent",
            toolboxBackgroundColour: "#ffffff12",
            flyoutBackgroundColour: "#314969",
        },
    });

    private languageSubscription?: Subscription;
    private currentLanguageCode?: string;

    constructor(
        private router: Router,
        private poseService: PoseService,
        private gestureService: GestureService,
        private movementSequenceService: MovementSequenceService,
        private blocklyLanguageService: BlocklyLanguageService,
        private voiceRecordingService: VoiceRecordingService,
    ) {}

    get workspaceContent(): string {
        return JSON.stringify(
            Blockly.serialization.workspaces.save(this.workspace),
        );
    }

    set workspaceContent(content: string | undefined) {
        Blockly.serialization.workspaces.load(
            JSON.parse(content ?? "{}"),
            this.workspace,
        );
    }

    get codePython(): string {
        return pythonGenerator.workspaceToCode(this.workspace);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ("codeVisual" in changes && !changes["codeVisual"].isFirstChange()) {
            const codeVisual = changes["codeVisual"].currentValue;
            this.workspaceContent = codeVisual;
            this.codePythonChange.emit(this.codePython);
        }
    }

    ngOnInit() {
        this.routerEventSubscription = this.router.events.subscribe((event) => {
            if (event instanceof GuardsCheckStart) {
                this.codeVisualChange.emit(this.workspaceContent);
                Blockly.hideChaff();
            }
        });

        this.poseService.getPosesObservable().subscribe((poses) => {
            poses.length > 0
                ? this.updatePoseBlockDropdown(poses)
                : this.updatePoseBlockDropdown([
                      new Pose(
                          this.blocklyLanguageService.msg("PIB_NO_POSE_AVAILABLE"),
                          "NO POSE",
                      ),
                  ]);
        });

        this.gestureService.getGesturesObservable().subscribe((gestures) => {
            gestures.length > 0
                ? this.updateGestureBlockDropdown(gestures)
                : this.updateGestureBlockDropdown([
                      new Gesture(
                          this.blocklyLanguageService.msg("PIB_NO_GESTURE_AVAILABLE"),
                          "NO GESTURE",
                      ),
                  ]);
        });

        this.voiceRecordingService.recordingsSubject.subscribe((recordings) => {
            recordings.length > 0
                ? this.updatePlayWavBlockDropdown(recordings)
                : this.updatePlayWavBlockDropdown([]);
        });

        this.movementSequenceService
            .getSequencesObservable()
            .subscribe((sequences) => {
                sequences.length > 0
                    ? this.updateMovementSequenceBlockDropdown(sequences)
                    : this.updateMovementSequenceBlockDropdown([
                          new MovementSequence(
                              this.blocklyLanguageService.msg(
                                  "PIB_NO_MOVEMENT_SEQUENCE_AVAILABLE",
                              ),
                              "NO SEQUENCE",
                          ),
                      ]);
            });

        // Blockly.Msg is already populated for the current language by
        // BlocklyLanguageService (applied in its constructor), so the
        // toolbox %{BKY_...} references and block labels resolve correctly.
        this.currentLanguageCode = this.blocklyLanguageService.currentCode$.value;
        this.workspace = Blockly.inject("blocklyDiv", {
            toolbox: this.toolbox,
            theme: this.customTheme,
        });
        this.initMultiselect(this.workspace);

        customBlockDefinition();

        // Re-render the workspace when the language changes (already-created
        // blocks and the toolbox don't re-read their labels on their own).
        this.languageSubscription =
            this.blocklyLanguageService.currentCode$.subscribe((code) => {
                if (code !== this.currentLanguageCode) {
                    this.currentLanguageCode = code;
                    this.reloadWorkspaceForLanguage();
                }
            });
        this.observer = new ResizeObserver(() => {
            this.resizeBlockly();
        });

        const trashWorkspace = this.workspace.trashcan?.flyout?.getWorkspace();
        trashWorkspace!.addChangeListener(this.flyoutChangeCallback);
        this.workspace.addChangeListener(this.flyoutChangeCallback);

        const blocklyMainBackground: SVGRectElement | null =
            document.querySelector(".blocklyMainBackground");
        if (blocklyMainBackground) {
            blocklyMainBackground.style.stroke = "none";
        }

        this.workspace.addChangeListener((event: Abstract) => {
            if (this.workspace.isDragging()) return;
            if (!this.supportedEvents.has(event.type)) return;
            this.codePythonChange.emit(this.codePython);
            this.codeVisualChange.emit(this.workspaceContent);
        });

        this.workspace.registerButtonCallback("CREATE_VARIABLE_ARRAY", () => {
            Blockly.Variables.createVariableButtonHandler(
                this.workspace,
                undefined,
                "Array",
            );
        });

        const variableCallback =
            this.workspace.getToolboxCategoryCallback("VARIABLE_DYNAMIC");
        this.workspace.removeToolboxCategoryCallback("VARIABLE_DYNAMIC");
        this.workspace.registerToolboxCategoryCallback(
            "VARIABLE_DYNAMIC",
            (workspaceSvg) => {
                const items = variableCallback?.(workspaceSvg) as HTMLElement[];
                const stringButton = items[0];
                const listButton = stringButton.cloneNode(true) as HTMLElement;
                listButton.setAttribute(
                    "text",
                    this.blocklyLanguageService.msg("PIB_CREATE_LIST_VARIABLE"),
                );
                listButton.setAttribute("callbackKey", "CREATE_VARIABLE_ARRAY");
                return [listButton, ...items];
            },
        );
    }

    ngAfterViewInit() {
        this.observer.observe(this.blocklyDiv.nativeElement);
        this.workspaceContent = this.codeVisual;
    }

    ngOnDestroy(): void {
        this.observer.unobserve(this.blocklyDiv.nativeElement);
        Blockly.registry.unregister("theme", "customtheme");
        this.routerEventSubscription.unsubscribe();
        this.languageSubscription?.unsubscribe();
    }

    /**
     * Re-injects the workspace so the new language's toolbox category names
     * and block labels take effect. Preserves the current program by saving
     * and restoring the serialized content around the re-inject.
     */
    private reloadWorkspaceForLanguage(): void {
        if (!this.workspace) {
            return;
        }
        const content = this.workspaceContent;
        this.workspace.dispose();
        this.workspace = Blockly.inject("blocklyDiv", {
            toolbox: this.toolbox,
            theme: this.customTheme,
        });
        this.initMultiselect(this.workspace);
        this.workspace.addChangeListener((event: Abstract) => {
            if (this.workspace.isDragging()) return;
            if (!this.supportedEvents.has(event.type)) return;
            this.codePythonChange.emit(this.codePython);
            this.codeVisualChange.emit(this.workspaceContent);
        });
        this.workspaceContent = content;
    }

    /**
     * Lets the user drag a selection box over multiple blocks (and
     * shift-click to add/remove individual ones) and then duplicate/delete
     * all of them at once - previously only one block at a time could be
     * duplicated. Ctrl/Cmd+C/V and Delete act on the whole selection.
     */
    private initMultiselect(workspace: Blockly.WorkspaceSvg): void {
        const multiselectPlugin = new Multiselect(workspace);
        multiselectPlugin.init({
            useDoubleClick: false,
            bumpNeighbours: false,
            multiselectIcon: {
                hideIcon: true,
                weight: 3,
                enabledIcon: "",
                disabledIcon: "",
            },
            multiFieldUpdate: true,
            workspaceAutoFocus: true,
            useCopyPaste: true,
            wsSearch: false,
        });
    }

    resizeBlockly() {
        Blockly.svgResize(this.workspace);
    }

    /**
     * Called by the parent when entering/leaving split-screen mode (Run
     * button or the split-screen toggle). Unlike a gutter drag, this is an
     * abrupt flex-basis jump (e.g. 100% -> 50% height), not a gradual
     * ResizeObserver stream - any open flyout/trashcan gets left stuck
     * mid-transition, and svgResize alone doesn't recenter content that's
     * now outside the shrunk viewport, which showed up as a blank/black or
     * misaligned-looking workspace.
     */
    handleLayoutTransition(): void {
        Blockly.hideChaff();
        requestAnimationFrame(() => {
            Blockly.svgResize(this.workspace);
            this.workspace.scrollCenter();
        });
    }

    flyoutChangeCallback = () => {
        const contentOpen = this.workspace.trashcan?.contentsIsOpen();
        const flyoutWidth = contentOpen
            ? this.workspace.trashcan?.flyout?.getWidth() ?? 0
            : 0;
        this.trashcanFlyoutChange.emit(flyoutWidth);
    };

    updatePoseBlockDropdown(poses: Pose[]): void {
        const poseOptions = poses.map((pose) => [pose.name, pose.poseId]);
        Blockly.Blocks["move_to_pose"].getPoses = () => poseOptions;
        if (this.workspace) {
            this.workspaceContent = this.codeVisual;
        }
    }

    updateGestureBlockDropdown(gestures: Gesture[]): void {
        const gestureOptions = gestures.map((gesture) => [
            gesture.name,
            gesture.gestureId,
        ]);
        Blockly.Blocks["run_gesture"].getGestures = () => gestureOptions;
        if (this.workspace) {
            this.workspaceContent = this.codeVisual;
        }
    }

    updatePlayWavBlockDropdown(recordings: VoiceRecording[]): void {
        const wavOptions =
            recordings.length > 0
                ? recordings.map((recording) => [
                      recording.filename,
                      recording.filename,
                  ])
                : [["keine Aufnahme vorhanden", "NO_RECORDING"]];
        Blockly.Blocks["play_wav"].getWavFiles = () => wavOptions;
        if (this.workspace) {
            this.workspaceContent = this.codeVisual;
        }
    }

    updateMovementSequenceBlockDropdown(sequences: MovementSequence[]): void {
        const sequenceOptions = sequences.map((sequence) => [
            sequence.name,
            sequence.sequenceId,
        ]);
        Blockly.Blocks["run_movement_sequence"].getMovementSequences = () =>
            sequenceOptions;
        if (this.workspace) {
            this.workspaceContent = this.codeVisual;
        }
    }
}
