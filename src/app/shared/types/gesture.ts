export interface GestureDTO {
    name: string;
    gestureId: string;
    deletable: boolean;
}

export class Gesture {
    name: string;
    gestureId: string;
    deletable: boolean = true;

    constructor(name: string, gestureId: string, deletable: boolean = true) {
        this.name = name;
        this.gestureId = gestureId;
        this.deletable = deletable;
    }
}
