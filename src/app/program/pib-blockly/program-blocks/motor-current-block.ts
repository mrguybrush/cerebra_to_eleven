import * as Blockly from "blockly";

// Same motor list as move_motor (motor-blocks.ts), minus the "all fingers"
// aggregate entries - those don't correspond to a single real motor and
// have no current reading of their own.
export const motor_current_block = Blockly.common.createBlockDefinitionsFromJsonArray([
    {
        type: "get_motor_current",
        // resolves from Blockly.Msg per language - see i18n/pib-blockly-locales.ts
        message0: "%{BKY_PIB_MOTOR_CURRENT}",
        args0: [
            {
                type: "field_dropdown",
                name: "MOTORNAME",
                options: [
                    ["thumb left opposition", "THUMB_LEFT_OPPOSITION"],
                    ["thumb left stretch", "THUMB_LEFT_STRETCH"],
                    ["index finger left stretch", "INDEX_LEFT_STRETCH"],
                    ["middle finger left stretch", "MIDDLE_LEFT_STRETCH"],
                    ["ring finger left stretch", "RING_LEFT_STRETCH"],
                    ["pinky finger left stretch", "PINKY_LEFT_STRETCH"],
                    ["thumb right opposition", "THUMB_RIGHT_OPPOSITION"],
                    ["thumb right stretch", "THUMB_RIGHT_STRETCH"],
                    ["index finger right stretch", "INDEX_RIGHT_STRETCH"],
                    ["middle finger right stretch", "MIDDLE_RIGHT_STRETCH"],
                    ["ring finger right stretch", "RING_RIGHT_STRETCH"],
                    ["pinky finger right stretch", "PINKY_RIGHT_STRETCH"],
                    ["upper left arm rotation", "UPPER_ARM_LEFT_ROTATION"],
                    ["elbow left", "ELBOW_LEFT"],
                    ["lower left arm rotation", "LOWER_ARM_LEFT_ROTATION"],
                    ["wrist left", "WRIST_LEFT"],
                    ["left shoulder vertical", "SHOULDER_VERTICAL_LEFT"],
                    ["left shoulder horizontal", "SHOULDER_HORIZONTAL_LEFT"],
                    ["upper right arm rotation", "UPPER_ARM_RIGHT_ROTATION"],
                    ["elbow right", "ELBOW_RIGHT"],
                    ["lower right arm rotation", "LOWER_ARM_RIGHT_ROTATION"],
                    ["wrist right", "WRIST_RIGHT"],
                    ["right shoulder vertical", "SHOULDER_VERTICAL_RIGHT"],
                    ["right shoulder horizontal", "SHOULDER_HORIZONTAL_RIGHT"],
                    ["tilt head forward", "TILT_FORWARD_HEAD"],
                    ["turn head", "TURN_HEAD"],
                ],
            },
        ],
        output: "Number",
        colour: 355,
        tooltip: "%{BKY_PIB_MOTOR_CURRENT_TOOLTIP}",
        helpUrl: "",
    },
]);
