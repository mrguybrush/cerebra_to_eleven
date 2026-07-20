import * as Blockly from "blockly";

// Dropdown of uploaded/recorded WAV files (see the "Voice Recording" page).
// Options are populated dynamically at runtime (see
// program-workspace.component.ts's updatePlayWavBlockDropdown, mirroring
// how move_to_pose already does this for poses) - this
// server-side copy only ever needs a placeholder, since it just
// deserializes an already-chosen filename from the submitted workspace
// JSON rather than rendering a live dropdown UI.
export const playWav = (Blockly.Blocks["play_wav"] = {
    init() {
        this.appendDummyInput()
            // dynamic-dropdown blocks build their label imperatively, so
            // translation goes through Blockly.Msg directly (same pattern
            // as move_to_pose in pose-block.ts)
            .appendField(Blockly.Msg["PIB_PLAY_WAV"] || "play wav file")
            .appendField(new CustomFieldDropdown(this.getWavFiles), "FILENAME");
        this.setColour(260);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(
            Blockly.Msg["PIB_PLAY_WAV_TOOLTIP"] ||
                "plays back a recorded/uploaded wav file",
        );
        this.setHelpUrl("");
    },

    getWavFiles() {
        return [["Loading...", "LOADING"]];
    },
});

class CustomFieldDropdown extends Blockly.FieldDropdown {
    constructor(menuGenerator: any, opt_validator?: any, opt_config?: any) {
        super(menuGenerator, opt_validator, opt_config);
    }
    override doClassValidation_(newValue: any) {
        return newValue;
    }
}
