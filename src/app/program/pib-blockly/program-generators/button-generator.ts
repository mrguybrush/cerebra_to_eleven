import {Block} from "blockly/core/block";
import {Order, pythonGenerator} from "blockly/python";
import {
    CONFIGURE_LOGGING,
    IMPORT_LOGGING,
    IMPORT_SYS,
    IMPORT_RCLPY,
    IMPORT_SET_RGB_BUTTON_COLOR,
    IMPORT_GET_RGB_BUTTON_STATE,
    INIT_ROS,
    INIT_SET_RGB_BUTTON_COLOR_CLIENT,
    INIT_GET_RGB_BUTTON_STATE_CLIENT,
} from "./util/definitions";
import {
    SET_RGB_BUTTON_COLOR_FUNCTION,
    GET_RGB_BUTTON_STATE_FUNCTION,
} from "./util/function-declarations";

export function set_rgb_button_color(
    block: Block,
    generator: typeof pythonGenerator,
) {
    const buttonNumber = <string>block.getFieldValue("BUTTON");
    const colour = generator.valueToCode(block, "COLOUR", Order.NONE) || "'#000000'";

    Object.assign(generator.definitions_, {
        CONFIGURE_LOGGING,
        IMPORT_LOGGING,
        IMPORT_SYS,
        IMPORT_RCLPY,
        IMPORT_SET_RGB_BUTTON_COLOR,
        INIT_ROS,
        INIT_SET_RGB_BUTTON_COLOR_CLIENT,
    });

    const functionName = generator.provideFunction_(
        "set_rgb_button_color",
        SET_RGB_BUTTON_COLOR_FUNCTION(generator),
    );

    return `${functionName}(${buttonNumber}, ${colour})\n`;
}

export function button_is_pressed(
    block: Block,
    generator: typeof pythonGenerator,
) {
    const buttonNumber = <string>block.getFieldValue("BUTTON");

    Object.assign(generator.definitions_, {
        CONFIGURE_LOGGING,
        IMPORT_LOGGING,
        IMPORT_SYS,
        IMPORT_RCLPY,
        IMPORT_GET_RGB_BUTTON_STATE,
        INIT_ROS,
        INIT_GET_RGB_BUTTON_STATE_CLIENT,
    });

    const functionName = generator.provideFunction_(
        "button_is_pressed",
        GET_RGB_BUTTON_STATE_FUNCTION(generator),
    );

    return [`${functionName}(${buttonNumber})`, Order.FUNCTION_CALL];
}

export {pythonGenerator};
