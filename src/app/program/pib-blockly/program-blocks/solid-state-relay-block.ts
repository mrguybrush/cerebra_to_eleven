import * as Blockly from "blockly";

export const setSolidStateRelay =
    Blockly.common.createBlockDefinitionsFromJsonArray([
        {
            type: "set_solid_state_relay",
            message0: "%{BKY_PIB_SET_RELAY}",
            args0: [
                {
                    type: "field_dropdown",
                    name: "STATUS",
                    options: [
                        ["%{BKY_PIB_ON}", "ON"],
                        ["%{BKY_PIB_OFF}", "OFF"],
                    ],
                },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: 355,
            tooltip: "%{BKY_PIB_SET_RELAY_TOOLTIP}",
            helpUrl: "",
        },
        {
            type: "get_solid_state_relay",
            message0: "%{BKY_PIB_GET_RELAY}",
            output: "Boolean",
            colour: 355,
            tooltip: "%{BKY_PIB_GET_RELAY_TOOLTIP}",
            helpUrl: "",
        },
    ]);
