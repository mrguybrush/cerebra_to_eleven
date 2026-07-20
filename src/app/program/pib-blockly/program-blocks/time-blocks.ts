import * as Blockly from "blockly";

export const time_blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
    {
        type: "sleep_for_seconds",
        message0: "%{BKY_PIB_SLEEP_FOR}",
        args0: [
            {
                type: "field_number",
                name: "SECONDS",
                value: 0.1,
                min: 0.001,
                max: 9999,
                precision: 0.001,
            },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: 60,
        tooltip: "%{BKY_PIB_SLEEP_TOOLTIP}",
        helpUrl: "",
    },
    {
        type: "get_system_time",
        message0: "%{BKY_PIB_GET_SYSTEM_TIME}",
        output: "Number",
        colour: 60,
        tooltip: "%{BKY_PIB_GET_SYSTEM_TIME_TOOLTIP}",
        helpUrl: "",
    },
]);
