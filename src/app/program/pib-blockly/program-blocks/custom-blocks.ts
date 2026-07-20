import * as Blockly from "blockly";

import {time_blocks} from "./time-blocks";
import {face_detector_blocks} from "./detectors-blocks";
import {motor_blocks} from "./motor-blocks";
import {playAudioFromSpeech} from "./play-audio-from-speech-block";
import {moveToPose} from "./pose-block";
import {setSolidStateRelay} from "./solid-state-relay-block";
import {runScriptBlocks} from "./run-script-block";
import {button_blocks} from "./button-block";
import {display_blocks} from "./display-block";
import {playWav} from "./play-wav-block";
import {motor_current_block} from "./motor-current-block";
import {movement_speed_block} from "./movement-speed-block";
import {whenProgramStarts} from "./when-program-starts-block";

export function customBlockDefinition() {
    Blockly.common.defineBlocks(time_blocks);
    Blockly.common.defineBlocks(face_detector_blocks);
    Blockly.common.defineBlocks(motor_blocks);
    Blockly.common.defineBlocks(playAudioFromSpeech);
    Blockly.common.defineBlocks(moveToPose);
    Blockly.common.defineBlocks(setSolidStateRelay);
    Blockly.common.defineBlocks(runScriptBlocks);
    Blockly.common.defineBlocks(button_blocks);
    Blockly.common.defineBlocks(display_blocks);
    Blockly.common.defineBlocks(playWav);
    Blockly.common.defineBlocks(motor_current_block);
    Blockly.common.defineBlocks(movement_speed_block);
    Blockly.common.defineBlocks(whenProgramStarts);

    face_detector_blocks["face_detector_running"].editable_ = false;
}
