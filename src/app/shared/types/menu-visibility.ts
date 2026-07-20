// Sichtbarkeit der Hauptmenuepunkte in der linken Navigation (true =
// ausgeblendet). Ausgeblendete Seiten bleiben ueber die direkte URL
// weiterhin erreichbar, es fehlt nur der Link.
export interface MenuVisibility {
    jointControl: boolean;
    pose: boolean;
    camera: boolean;
    motionCapture: boolean;
    voiceRecording: boolean;
    voiceAssistant: boolean;
    program: boolean;
    system: boolean;
}
