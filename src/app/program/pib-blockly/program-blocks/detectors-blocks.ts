import * as Blockly from "blockly";

export const face_detector_blocks =
    Blockly.common.createBlockDefinitionsFromJsonArray([
        {
            type: "face_detector_start_stop",
            message0: "%{BKY_PIB_FACE_DETECTOR}",
            args0: [
                {
                    type: "field_dropdown",
                    name: "SETTING",
                    options: [
                        ["%{BKY_PIB_START}", "START"],
                        ["%{BKY_PIB_STOP}", "END"],
                    ],
                },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: 200,
            tooltip: "%{BKY_PIB_FACE_DETECTOR_TOOLTIP}",
            helpUrl: "",
        },

        {
            type: "face_detector_running",
            message0: "%{BKY_PIB_FACE_DETECTOR_RUN}",
            args0: [
                {
                    type: "input_dummy",
                },
                {
                    type: "field_variable",
                    name: "HORIZ_CENTER",
                    variable: "horiz_center",
                    variableTypes: ["Number"],
                    defaultType: "Number",
                },
                {
                    type: "field_variable",
                    name: "VERT_CENTER",
                    variable: "vert_center",
                    variableTypes: ["Number"],
                    defaultType: "Number",
                },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: 200,
            tooltip: "%{BKY_PIB_FACE_DETECTOR_RUN_TOOLTIP}",
            helpUrl: "",
        },
    ]);
