// Pro-Installation-Override von gesture_control/retargeting.DEFAULT_ASSIGNMENT:
// welche erkannte Koerperseite welchen Robotermotor treibt. Siehe
// Kalibrierungs-Assistent auf der Motion-Capture-Seite.

export type JointSide = "left" | "right";

export interface JointMappingEntry {
    motorName: string;
    sourceSide: JointSide;
    invert: boolean;
}
