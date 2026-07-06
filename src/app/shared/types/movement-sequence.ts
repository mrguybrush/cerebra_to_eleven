export interface MovementSequenceFrameDTO {
    timestampMs: number;
    positions: {[motorName: string]: number};
}

export interface MovementSequenceDTO {
    name: string;
    sequenceId: string;
    deletable: boolean;
    sampleRateHz: number;
}

export class MovementSequence {
    name: string;
    sequenceId: string;
    deletable: boolean = true;
    sampleRateHz: number = 10;

    constructor(
        name: string,
        sequenceId: string,
        deletable: boolean = true,
        sampleRateHz: number = 10,
    ) {
        this.name = name;
        this.sequenceId = sequenceId;
        this.deletable = deletable;
        this.sampleRateHz = sampleRateHz;
    }
}
