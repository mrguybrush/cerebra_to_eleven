import {Block} from "blockly/core/block";
import {pythonGenerator} from "blockly/python";
import {
    CONFIGURE_LOGGING,
    IMPORT_LOGGING,
    IMPORT_PLAY_AUDIO_FROM_FILE,
    IMPORT_RCLPY,
    IMPORT_SYS,
    INIT_PLAY_AUDIO_FROM_FILE_CLIENT,
    INIT_ROS,
    VOICE_RECORDINGS_DIR,
} from "./util/definitions";
import {PLAY_AUDIO_FROM_FILE_FUNCTION} from "./util/function-declarations";

export function playWavGenerator(
    block: Block,
    generator: typeof pythonGenerator,
) {
    // extract block-input
    const filename = <string>block.getFieldValue("FILENAME");

    // add definitions to generator
    Object.assign(generator.definitions_, {
        IMPORT_RCLPY,
        IMPORT_SYS,
        IMPORT_LOGGING,
        IMPORT_PLAY_AUDIO_FROM_FILE,
        CONFIGURE_LOGGING,
        INIT_ROS,
        INIT_PLAY_AUDIO_FROM_FILE_CLIENT,
    });

    // declare the 'play_wav'-function
    const functionName = generator.provideFunction_(
        "play_wav",
        PLAY_AUDIO_FROM_FILE_FUNCTION(generator, VOICE_RECORDINGS_DIR),
    );

    return `${functionName}("${filename}")\n`;
}

export {pythonGenerator};
