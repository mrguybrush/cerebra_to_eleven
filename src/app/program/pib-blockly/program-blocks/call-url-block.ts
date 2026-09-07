import * as Blockly from "blockly";

// Sends a plain HTTP GET request to a URL, ignoring the response - built
// for controlling other network devices from a Blockly program (e.g. a
// Shelly smart plug's http://<ip>/relay/0?turn=on). URL is an input_value
// (not a fixed field) so it can be a literal text block or something built
// dynamically (e.g. joined from a stored device-IP variable), matching how
// run_script's SCRIPT input works (run-script-block.ts).
export const callUrlBlocks = Blockly.common.createBlockDefinitionsFromJsonArray(
    [
        {
            type: "call_url",
            message0: "%{BKY_PIB_CALL_URL}",
            args0: [
                {
                    type: "input_value",
                    name: "URL",
                    check: "String",
                },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: 45,
            tooltip: "%{BKY_PIB_CALL_URL_TOOLTIP}",
            helpUrl: "",
        },
    ],
);
