// Pro-Installation-Override von gesture_control/retargeting.DEFAULT_ASSIGNMENT:
// welche erkannte Koerperseite welchen Robotermotor treibt, und wie der
// erkannte Winkel in eine Motor-Zielposition uebersetzt wird. Siehe
// Zuordnungstabelle auf der Motion-Capture-Seite.

export type JointSide = "left" | "right";

export interface JointMappingEntry {
    motorName: string;
    sourceSide: JointSide;
    invert: boolean;
    // Zwei-Punkt-Kalibrierung: rohe Kamera-Ablesung (gleiche Einheit wie
    // candidateLeft/Right in der Tabelle) am unteren/oberen physischen
    // Anschlag des Gelenks. Wird linear auf die volle Servo-Spanne
    // (rotation_range_min/max) abgebildet. null = noch nicht kalibriert.
    candidateLowDeg: number | null;
    candidateHighDeg: number | null;
    // Absolute Ziel-Grenze in Motor-Grad (nach der Kalibrierung), um den
    // vollen Servo-Bereich bei Bedarf einzudaemmen. null = keine Begrenzung.
    minDeg: number | null;
    maxDeg: number | null;
    // Bewegungsgeschwindigkeit dieses Gelenks in Prozent (0-100).
    speedPercent: number;
}
