export interface PinInfo {
    pin: number;
    motorName: string | null;
    defective: boolean;
}

export interface BrickletPinGroup {
    brickletId: number;
    brickletNumber: number;
    uid: string | null;
    pins: PinInfo[];
}

export interface PinGrid {
    bricklets: BrickletPinGroup[];
    allMotorNames: string[];
}
