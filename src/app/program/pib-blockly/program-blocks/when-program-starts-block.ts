import * as Blockly from "blockly";

/**
 * Hat-Block "wenn Programm startet": kann MEHRFACH in einem Programm
 * verwendet werden - jeder Block startet seinen Inhalt als eigenen,
 * PARALLELEN Handlungsstrang (Python-Thread, siehe
 * when-program-starts-generator.ts). So laesst sich z.B. ein langer
 * Sprechtext abspielen, waehrend zeitlich versetzte Posen parallel laufen.
 */
export const whenProgramStarts =
    Blockly.common.createBlockDefinitionsFromJsonArray([
        {
            type: "when_program_starts",
            message0: "%{BKY_PIB_WHEN_PROGRAM_STARTS}",
            message1: "%1",
            args1: [
                {
                    type: "input_statement",
                    name: "DO",
                },
            ],
            colour: 20,
            hat: "cap",
            tooltip: "%{BKY_PIB_WHEN_PROGRAM_STARTS_TOOLTIP}",
            helpUrl: "",
        },
    ]);
