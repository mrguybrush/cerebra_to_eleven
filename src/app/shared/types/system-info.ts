export interface DiskInfo {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
}

export interface MemoryInfo {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usedPercent: number;
}

export interface CpuInfo {
    coreCount: number;
    loadAverage1Min: number;
    loadAverage5Min: number;
    loadAverage15Min: number;
    /** null beim allerersten Poll nach einem Backend-Neustart (kein Delta
     * verfuegbar, siehe system_settings_service.py). */
    usedPercent: number | null;
}

export interface SystemInfo {
    disk: DiskInfo;
    memory: MemoryInfo;
    cpu: CpuInfo;
    /** null wenn keine Temperatursensor-Datei gefunden wurde. */
    temperatureCelsius: number | null;
}
