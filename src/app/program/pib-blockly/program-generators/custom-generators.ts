import {pythonGenerator} from "blockly/python";

import * as face_detector_blocks from "./detectors-generators";
import * as time_blocks from "./time-generators";
import * as motor_blocks from "./motor-generators";
import * as playAudioFromSpeech from "./play-audio-from-speech-generator";
import * as moveToPose from "./pose-generator";
import * as setSolidStateRelay from "./solid-state-relay-generator";
import * as runScript from "./run-script-generator";
import * as buttonGen from "./button-generator";
import * as displayGen from "./display-generator";
import * as playWavGen from "./play-wav-generator";
import * as motorCurrentGen from "./motor-current-generator";
import * as movementSpeedGen from "./movement-speed-generator";
import * as whenProgramStartsGen from "./when-program-starts-generator";
import {PIB_THREADS_RUNNER} from "./when-program-starts-generator";
import {RESERVED_WORDS} from "./util/reserved-words";

export * from "blockly/python";

pythonGenerator.addReservedWords(RESERVED_WORDS);

const generators: typeof pythonGenerator.forBlock = {
    ...face_detector_blocks,
    ...time_blocks,
    ...motor_blocks,
    ...playAudioFromSpeech,
    ...moveToPose,
    ...setSolidStateRelay,
    ...runScript,
    ...buttonGen,
    ...displayGen,
    ...playWavGen,
    ...motorCurrentGen,
    ...movementSpeedGen,
    ...whenProgramStartsGen,
};

for (const name in generators) {
    pythonGenerator.forBlock[name] = generators[name];
}

pythonGenerator.forBlock["play_audio_from_speech"] =
    generators["playAudioFromSpeechGenerator"];

pythonGenerator.forBlock["move_to_pose"] = generators["moveToPoseGenerator"];
pythonGenerator.forBlock["play_wav"] = generators["playWavGenerator"];

// "wenn Programm startet"-Hat-Bloecke sammeln ihre Straenge als Threads in
// __pib_threads (siehe when-program-starts-generator.ts). Die Threads
// duerfen erst NACH dem gesamten uebrigen Top-Level-Code starten - daher
// haengt dieser finish-Wrap den Runner ans Programmende an, sobald
// mindestens ein Hat-Block verwendet wurde. Identisch zum Compile-Server
// (pib_blockly_server), beide Seiten synchron halten.
const originalFinish = pythonGenerator.finish.bind(pythonGenerator);
pythonGenerator.finish = function (code: string): string {
    const result = originalFinish(code);
    if (result.includes("__pib_threads.append(")) {
        return result + PIB_THREADS_RUNNER;
    }
    return result;
};
