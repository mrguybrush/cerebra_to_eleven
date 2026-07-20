import {Block} from "blockly/core/block";
import {pythonGenerator} from "blockly/python";
import {
    CONFIGURE_LOGGING,
    IMPORT_APPLY_MOVEMENT_SETTINGS,
    IMPORT_MOVEMENT_SETTINGS_MESSAGE,
    IMPORT_LOGGING,
    IMPORT_RCLPY,
    IMPORT_SYS,
    INIT_APPLY_MOVEMENT_SETTINGS_CLIENT,
    INIT_ROS,
} from "./util/definitions";
import {SET_MOVEMENT_SPEED_FUNCTION} from "./util/function-declarations";

export function set_movement_speed(
    block: Block,
    generator: typeof pythonGenerator,
) {
    // extract block-input
    const speedPercent = block.getFieldValue("SPEED_PERCENT");

    // add definitions to generator
    Object.assign(generator.definitions_, {
        IMPORT_RCLPY,
        IMPORT_SYS,
        IMPORT_LOGGING,
        IMPORT_APPLY_MOVEMENT_SETTINGS,
        IMPORT_MOVEMENT_SETTINGS_MESSAGE,
        CONFIGURE_LOGGING,
        INIT_ROS,
        INIT_APPLY_MOVEMENT_SETTINGS_CLIENT,
    });

    // declare the 'set_movement_speed'-function
    const functionName = generator.provideFunction_(
        "set_movement_speed",
        SET_MOVEMENT_SPEED_FUNCTION(generator),
    );

    return `${functionName}(${speedPercent})\n`;
}

export {pythonGenerator};
