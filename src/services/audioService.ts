import { Blob } from '@google/genai';

export const PCM_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;

// Helper to decode Base64 string to byte array
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to encode byte array to Base64
function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decode raw PCM data from Gemini into an AudioBuffer
export async function decodeAudioData(
  base64String: string,
  ctx: AudioContext,
  sampleRate: number = OUTPUT_SAMPLE_RATE,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const bytes = decodeBase64(base64String);
  const dataInt16 = new Int16Array(bytes.buffer);
  
  // Create an empty buffer
  const buffer = ctx.createBuffer(numChannels, dataInt16.length, sampleRate);
  
  // Fill the channel data
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    // Convert int16 (-32768 to 32767) to float32 (-1.0 to 1.0)
    channelData[i] = dataInt16[i] / 32768.0;
  }
  
  return buffer;
}

// Create a Blob-like object for Gemini Live Input from raw float32 mic data
export function createPcmBlob(data: Float32Array): Blob {
  // Downsample or process if necessary, but here we assume the input context 
  // is already set to or resampled to the desired rate (usually 16kHz for input).
  
  const l = data.length;
  const int16 = new Int16Array(l);
  
  for (let i = 0; i < l; i++) {
    // Clamp values to [-1, 1] to avoid distortion before converting
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 32768 : s * 32767;
  }
  
  return {
    data: encodeBase64(new Uint8Array(int16.buffer)),
    mimeType: `audio/pcm;rate=${PCM_SAMPLE_RATE}`,
  };
}

// Convert a Blob (e.g. from Canvas) to Base64 string
export function blobToBase64(blob: globalThis.Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
