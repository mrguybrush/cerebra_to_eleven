import {Block} from "blockly/core/block";
import {Order, pythonGenerator} from "blockly/python";
import {
    CONFIGURE_LOGGING,
    IMPORT_LOGGING,
    IMPORT_URLLIB_REQUEST,
} from "./util/definitions";
import {CALL_URL_FUNCTION} from "./util/function-declarations";

export function call_url(block: Block, generator: typeof pythonGenerator) {
    // extract block-input - plugged-in value expression, e.g. a literal
    // text block or something built from a variable
    const url = generator.valueToCode(block, "URL", Order.NONE) || "''";

    // add definitions to generator
    Object.assign(generator.definitions_, {
        CONFIGURE_LOGGING,
        IMPORT_LOGGING,
        IMPORT_URLLIB_REQUEST,
    });

    // declare the 'call_url'-function
    const functionName = generator.provideFunction_(
        "call_url",
        CALL_URL_FUNCTION(generator),
    );

    return `${functionName}(${url})\n`;
}

export {pythonGenerator};
