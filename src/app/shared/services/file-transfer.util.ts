/**
 * Small browser helpers for import/export of programs, gestures and
 * movement sequences as JSON files - no backend involved, everything runs
 * client-side via a temporary download link / file input.
 */

/** Triggers a download of `data` as a pretty-printed .json file. */
export function downloadJson(filename: string, data: unknown): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** Opens a file picker and resolves with the parsed JSON, or null if the
 * user cancels. Rejects if the chosen file isn't valid JSON. */
export function pickJsonFile(): Promise<unknown | null> {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    resolve(JSON.parse(String(reader.result)));
                } catch (err) {
                    reject(new Error("Datei ist kein gültiges JSON: " + String(err)));
                }
            };
            reader.onerror = () => reject(reader.error ?? new Error("read error"));
            reader.readAsText(file);
        };
        input.click();
    });
}

/** Makes a string safe to use as a filename. */
export function safeFilename(name: string): string {
    return name.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "") || "export";
}
