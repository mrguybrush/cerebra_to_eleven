import {Block} from "blockly/core/block";
import {Order, pythonGenerator} from "blockly/python";
import {
    CONFIGURE_LOGGING,
    IMPORT_DIAGNOSTIC_STATUS_MESSAGE,
    IMPORT_LOGGING,
    IMPORT_RCLPY,
    IMPORT_SYS,
    IMPORT_TIME,
    INIT_ROS,
} from "./util/definitions";
import {GET_MOTOR_CURRENT_FUNCTION} from "./util/function-declarations";

// Matches motor-generators.ts's motorOptionToMotorName exactly, minus the
// "all fingers" aggregate entries (no single current reading for those).
const motorOptionToMotorName = new Map()
    .set("THUMB_LEFT_OPPOSITION", "thumb_left_opposition")
    .set("THUMB_LEFT_STRETCH", "thumb_left_stretch")
    .set("INDEX_LEFT_STRETCH", "index_left_stretch")
    .set("MIDDLE_LEFT_STRETCH", "middle_left_stretch")
    .set("RING_LEFT_STRETCH", "ring_left_stretch")
    .set("PINKY_LEFT_STRETCH", "pinky_left_stretch")
    .set("THUMB_RIGHT_OPPOSITION", "thumb_right_opposition")
    .set("THUMB_RIGHT_STRETCH", "thumb_right_stretch")
    .set("INDEX_RIGHT_STRETCH", "index_right_stretch")
    .set("MIDDLE_RIGHT_STRETCH", "middle_right_stretch")
    .set("RING_RIGHT_STRETCH", "ring_right_stretch")
    .set("PINKY_RIGHT_STRETCH", "pinky_right_stretch")
    .set("UPPER_ARM_LEFT_ROTATION", "upper_arm_left_rotation")
    .set("ELBOW_LEFT", "elbow_left")
    .set("LOWER_ARM_LEFT_ROTATION", "lower_arm_left_rotation")
    .set("WRIST_LEFT", "wrist_left")
    .set("SHOULDER_VERTICAL_LEFT", "shoulder_vertical_left")
    .set("SHOULDER_HORIZONTAL_LEFT", "shoulder_horizontal_left")
    .set("UPPER_ARM_RIGHT_ROTATION", "upper_arm_right_rotation")
    .set("ELBOW_RIGHT", "elbow_right")
    .set("LOWER_ARM_RIGHT_ROTATION", "lower_arm_right_rotation")
    .set("WRIST_RIGHT", "wrist_right")
    .set("SHOULDER_VERTICAL_RIGHT", "shoulder_vertical_right")
    .set("SHOULDER_HORIZONTAL_RIGHT", "shoulder_horizontal_right")
    .set("TILT_FORWARD_HEAD", "tilt_forward_motor")
    .set("TURN_HEAD", "turn_head_motor");

export function get_motor_current(
    block: Block,
    generator: typeof pythonGenerator,
) {
    // extract block-input
    const motorOption = <string>block.getFieldValue("MOTORNAME");
    const selectedMotorName = motorOptionToMotorName.get(motorOption);
    if (selectedMotorName === undefined) {
        throw new Error(
            `'${motorOption}' is not a valid value for 'MOTORNAME'.`,
        );
    }

    // add definitions to generator
    Object.assign(generator.definitions_, {
        IMPORT_RCLPY,
        IMPORT_SYS,
        IMPORT_LOGGING,
        IMPORT_TIME,
        IMPORT_DIAGNOSTIC_STATUS_MESSAGE,
        CONFIGURE_LOGGING,
        INIT_ROS,
    });

    // declare the 'get_motor_current'-function
    const functionName = generator.provideFunction_(
        "get_motor_current",
        GET_MOTOR_CURRENT_FUNCTION(generator),
    );

    return [`${functionName}("${selectedMotorName}")`, Order.FUNCTION_CALL];
}

export {pythonGenerator};
