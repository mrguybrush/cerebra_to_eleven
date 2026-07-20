import {Block} from "blockly/core/block";
import {pythonGenerator} from "blockly/python";

/**
 * Generator fuer den Hat-Block "wenn Programm startet".
 *
 * Jeder Block wird zu einer eigenen Funktion, die als Python-Thread laeuft -
 * mehrere Bloecke = mehrere PARALLELE Handlungsstraenge. Die Threads werden
 * gesammelt (__pib_threads) und am ENDE des generierten Programms gestartet
 * und gejoint (siehe finish-Wrap in custom-generators.ts), damit erst alle
 * Definitionen/Service-Clients aus den Definitionen oben existieren.
 */

const IMPORT_THREADING = "import threading";
const PIB_THREADS_SETUP = "__pib_threads = []";

// Am Programmende angehaengt, wenn mindestens ein Hat-Block existiert
// (Erkennung ueber "__pib_threads" im Code, siehe custom-generators.ts).
export const PIB_THREADS_RUNNER = `
for __pib_thread in __pib_threads:
    __pib_thread.start()
for __pib_thread in __pib_threads:
    __pib_thread.join()
`;

export function when_program_starts(
    block: Block,
    generator: typeof pythonGenerator,
) {
    Object.assign(generator.definitions_, {
        IMPORT_THREADING,
        PIB_THREADS_SETUP,
    });

    let stack = generator.statementToCode(block, "DO");
    if (!stack.trim()) {
        stack = generator.INDENT + "pass\n";
    }

    // Blockly block ids can contain arbitrary characters - sanitize for a
    // valid, unique python identifier per hat block.
    const strandId = block.id.replace(/[^a-zA-Z0-9]/g, "_");
    const functionName = `__pib_strand_${strandId}`;

    return (
        `def ${functionName}():\n` +
        stack +
        `__pib_threads.append(threading.Thread(target=${functionName}, daemon=True))\n`
    );
}

export {pythonGenerator};
