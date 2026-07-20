import {Block} from "blockly/core/block";
import {pythonGenerator} from "blockly/python";
import {
    CONFIGURE_LOGGING,
    IMPORT_DISPLAY_IMAGE_MESSAGES,
    IMPORT_LOGGING,
    IMPORT_RCLPY,
    IMPORT_SHOW_CUSTOM_FACIAL_EXPRESSION,
    IMPORT_SYS,
    IMPORT_TIME,
    INIT_DISPLAY_IMAGE_PUBLISHER,
    INIT_ROS,
    INIT_SHOW_CUSTOM_FACIAL_EXPRESSION_CLIENT,
} from "./util/definitions";
import {SET_EYES_EMOTION_FUNCTION} from "./util/function-declarations";

export function set_eyes_emotion(
    block: Block,
    generator: typeof pythonGenerator,
) {
    // extract block-input
    const emotion = <string>block.getFieldValue("EMOTION");

    // add definitions to generator
    Object.assign(generator.definitions_, {
        CONFIGURE_LOGGING,
        IMPORT_LOGGING,
        IMPORT_SYS,
        IMPORT_RCLPY,
        IMPORT_TIME,
        IMPORT_DISPLAY_IMAGE_MESSAGES,
        INIT_ROS,
        INIT_DISPLAY_IMAGE_PUBLISHER,
    });

    // "CUSTOM:<id>" (a user-created facial expression) additionally needs
    // the show_custom_facial_expression service client - only pulled in
    // when actually used, so plain fixed-emotion programs don't have to
    // wait on a service they never call.
    if (emotion.startsWith("CUSTOM:")) {
        Object.assign(generator.definitions_, {
            IMPORT_SHOW_CUSTOM_FACIAL_EXPRESSION,
            INIT_SHOW_CUSTOM_FACIAL_EXPRESSION_CLIENT,
        });
    }

    // declare the 'set_eyes_emotion'-function
    const functionName = generator.provideFunction_(
        "set_eyes_emotion",
        SET_EYES_EMOTION_FUNCTION(generator),
    );

    return `${functionName}("${emotion}")\n`;
}

export {pythonGenerator};
