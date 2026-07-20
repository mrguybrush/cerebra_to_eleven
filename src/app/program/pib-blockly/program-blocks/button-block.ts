import * as Blockly from "blockly";

// Labels use %{BKY_PIB_...} message references so the block is translatable
// (see BlocklyLanguageService). Structure must match the server-side copy
// so the shared generator reads the same fields.
export const button_blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
    {
        type: "set_rgb_button_color",
        message0: "%{BKY_PIB_SET_BUTTON_COLOR}",
        args0: [
            {
                type: "field_dropdown",
                name: "BUTTON",
                options: [
                    ["1", "1"],
                    ["2", "2"],
                    ["3", "3"],
                ],
            },
            {
                type: "input_value",
                name: "COLOUR",
                check: "Colour",
            },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: 45,
        tooltip: "%{BKY_PIB_SET_BUTTON_COLOR_TOOLTIP}",
        helpUrl: "",
    },
    {
        type: "button_is_pressed",
        message0: "%{BKY_PIB_BUTTON_IS_PRESSED}",
        args0: [
            {
                type: "field_dropdown",
                name: "BUTTON",
                options: [
                    ["1", "1"],
                    ["2", "2"],
                    ["3", "3"],
                ],
            },
        ],
        output: "Boolean",
        colour: 45,
        tooltip: "%{BKY_PIB_BUTTON_IS_PRESSED_TOOLTIP}",
        helpUrl: "",
    },
]);
