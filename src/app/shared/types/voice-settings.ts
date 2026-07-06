// Typen fuer die globalen TTS-Einstellungen (lokale Piper-Stimme).

export interface VoiceSettings {
    localVoiceEnabled: boolean;
    localVoiceModel: string;
}

// Eine auswaehlbare deutsche Piper-Stimme.
export interface PiperVoice {
    id: string; // Datei-Praefix, z.B. "de_DE-thorsten-low"
    visualName: string; // Anzeigename in der UI
    gender: "male" | "female" | "neutral";
}
