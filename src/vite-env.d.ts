/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare module 'lamejs' {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  }
}

interface ImportMetaEnv {
  readonly VITE_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_SLACK_BOT_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
