import * as Blockly from "blockly";

// Labels use %{BKY_PIB_...} message references (resolved per block instance
// from Blockly.Msg, see BlocklyLanguageService) so the block is translatable.
export const motor_blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
    {
        type: "move_motor",
        message0: "%{BKY_PIB_MOVE_MOTOR}",
        args0: [
            {
                type: "field_dropdown",
                name: "MOTORNAME",
                options: [
                    ["%{BKY_PIB_MOTOR_THUMB_LEFT_OPPOSITION}", "THUMB_LEFT_OPPOSITION"],
                    ["%{BKY_PIB_MOTOR_THUMB_LEFT_STRETCH}", "THUMB_LEFT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_INDEX_LEFT_STRETCH}", "INDEX_LEFT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_MIDDLE_LEFT_STRETCH}", "MIDDLE_LEFT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_RING_LEFT_STRETCH}", "RING_LEFT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_PINKY_LEFT_STRETCH}", "PINKY_LEFT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_ALL_FINGERS_LEFT_STRETCH}", "ALL_FINGERS_LEFT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_THUMB_RIGHT_OPPOSITION}", "THUMB_RIGHT_OPPOSITION"],
                    ["%{BKY_PIB_MOTOR_THUMB_RIGHT_STRETCH}", "THUMB_RIGHT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_INDEX_RIGHT_STRETCH}", "INDEX_RIGHT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_MIDDLE_RIGHT_STRETCH}", "MIDDLE_RIGHT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_RING_RIGHT_STRETCH}", "RING_RIGHT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_PINKY_RIGHT_STRETCH}", "PINKY_RIGHT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_ALL_FINGERS_RIGHT_STRETCH}", "ALL_FINGERS_RIGHT_STRETCH"],
                    ["%{BKY_PIB_MOTOR_UPPER_ARM_LEFT_ROTATION}", "UPPER_ARM_LEFT_ROTATION"],
                    ["%{BKY_PIB_MOTOR_ELBOW_LEFT}", "ELBOW_LEFT"],
                    ["%{BKY_PIB_MOTOR_LOWER_ARM_LEFT_ROTATION}", "LOWER_ARM_LEFT_ROTATION"],
                    ["%{BKY_PIB_MOTOR_WRIST_LEFT}", "WRIST_LEFT"],
                    ["%{BKY_PIB_MOTOR_SHOULDER_VERTICAL_LEFT}", "SHOULDER_VERTICAL_LEFT"],
                    ["%{BKY_PIB_MOTOR_SHOULDER_HORIZONTAL_LEFT}", "SHOULDER_HORIZONTAL_LEFT"],
                    ["%{BKY_PIB_MOTOR_UPPER_ARM_RIGHT_ROTATION}", "UPPER_ARM_RIGHT_ROTATION"],
                    ["%{BKY_PIB_MOTOR_ELBOW_RIGHT}", "ELBOW_RIGHT"],
                    ["%{BKY_PIB_MOTOR_LOWER_ARM_RIGHT_ROTATION}", "LOWER_ARM_RIGHT_ROTATION"],
                    ["%{BKY_PIB_MOTOR_WRIST_RIGHT}", "WRIST_RIGHT"],
                    ["%{BKY_PIB_MOTOR_SHOULDER_VERTICAL_RIGHT}", "SHOULDER_VERTICAL_RIGHT"],
                    ["%{BKY_PIB_MOTOR_SHOULDER_HORIZONTAL_RIGHT}", "SHOULDER_HORIZONTAL_RIGHT"],
                    ["%{BKY_PIB_MOTOR_TILT_FORWARD_HEAD}", "TILT_FORWARD_HEAD"],
                    ["%{BKY_PIB_MOTOR_TURN_HEAD}", "TURN_HEAD"],
                ],
            },
            {
                type: "input_dummy",
            },
            {
                type: "field_dropdown",
                name: "MODE",
                options: [
                    ["%{BKY_PIB_MODE_ABSOLUTE}", "ABSOLUTE"],
                    ["%{BKY_PIB_MODE_RELATIVE}", "RELATIVE"],
                ],
            },
            {
                type: "input_value",
                name: "POSITION",
                check: "Number",
                extensions: "number_validation",
            },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: 355,
        tooltip: "",
        helpUrl: "",
    },
]);
