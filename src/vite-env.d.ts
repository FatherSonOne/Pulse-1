/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_SLACK_BOT_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
