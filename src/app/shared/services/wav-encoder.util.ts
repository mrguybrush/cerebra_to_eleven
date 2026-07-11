/**
 * Encodes recorded browser audio as a canonical 16-bit PCM WAV file.
 *
 * MediaRecorder (used to capture the microphone) never outputs WAV
 * directly - browsers only support compressed formats like webm/opus or
 * mp4/aac for it. But the robot's playback path (audio_player.py's
 * play_audio_from_file service) uses Python's 'wave' module, which can
 * only read plain PCM WAV. So whatever MediaRecorder hands us has to be
 * decoded and re-encoded here before upload.
 */

/** Decodes an arbitrary audio Blob (e.g. from MediaRecorder) into a
 * standard 16-bit PCM WAV Blob, via the Web Audio API. */
export async function toWavBlob(sourceBlob: Blob): Promise<Blob> {
    const arrayBuffer = await sourceBlob.arrayBuffer();
    const AudioContextClass =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext: typeof AudioContext})
            .webkitAudioContext;
    const audioContext = new AudioContextClass();
    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return encodeWav(audioBuffer);
    } finally {
        await audioContext.close();
    }
}

/** Manual WAV (RIFF/PCM) encoder - no external dependency needed for
 * something this small and stable a format. */
function encodeWav(audioBuffer: AudioBuffer): Blob {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const numFrames = audioBuffer.length;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = numFrames * blockAlign;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    writeAsciiString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeAsciiString(view, 8, "WAVE");
    writeAsciiString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true); // bits per sample
    writeAsciiString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    // Interleave channels and convert float32 [-1,1] samples to int16.
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
        channelData.push(audioBuffer.getChannelData(ch));
    }
    let offset = 44;
    for (let frame = 0; frame < numFrames; frame++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const clamped = Math.max(-1, Math.min(1, channelData[ch][frame]));
            const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
            view.setInt16(offset, int16, true);
            offset += 2;
        }
    }

    return new Blob([buffer], {type: "audio/wav"});
}

function writeAsciiString(view: DataView, offset: number, text: string): void {
    for (let i = 0; i < text.length; i++) {
        view.setUint8(offset + i, text.charCodeAt(i));
    }
}
