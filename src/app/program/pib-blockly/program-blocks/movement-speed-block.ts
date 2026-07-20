import * as Blockly from "blockly";

// Global "Bewegungstempo" - scales every motor's own configured
// velocity/acceleration/deceleration (see pib_motors.motor.Motor.
// movement_speed_percent), so this block can be placed before a
// "move to pose"/"move motor(s)" block to slow the following movement(s)
// down (or speed them back up to 100%) without touching each motor's
// persisted base settings.
export const movement_speed_block = Blockly.common.createBlockDefinitionsFromJsonArray(
    [
        {
            type: "set_movement_speed",
            message0: "%{BKY_PIB_SET_MOVEMENT_SPEED}",
            args0: [
                {
                    type: "field_number",
                    name: "SPEED_PERCENT",
                    value: 100,
                    min: 10,
                    max: 100,
                    precision: 1,
                },
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: 355,
            tooltip: "%{BKY_PIB_SET_MOVEMENT_SPEED_TOOLTIP}",
            helpUrl: "",
        },
    ],
);
