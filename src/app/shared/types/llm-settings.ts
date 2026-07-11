// Verbindungsdaten fuer Chat-LLMs ohne tryb-Smart-API-Token: Gemini
// (eigener API-Key) und ein LLM im lokalen Netzwerk (OpenAI-kompatibel).

export interface LlmSettings {
    geminiApiKey: string | null;
    localLlmUrl: string;
    localLlmModel: string;
}
