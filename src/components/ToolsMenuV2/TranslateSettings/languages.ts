// src/components/ToolsMenuV2/TranslateSettings/languages.ts
// PR 3a — Surface 3 · Translate Settings · supported language list.
//
// 16 sensible defaults covering the top languages by speaker count +
// the operational subset that Pulse currently supports in passive
// translate. Adding entries here is a no-op for the rest of the system
// — the value is purely an opaque BCP-47 tag stored in localStorage.

export interface TranslateLanguageOption {
  /** BCP-47 tag — what gets persisted. */
  code: string;
  /** Display label in the dropdown. */
  label: string;
  /** Native-language label shown after the English label for clarity. */
  native?: string;
}

export const TRANSLATE_LANGUAGES: ReadonlyArray<TranslateLanguageOption> = [
  { code: 'en',    label: 'English',    native: 'English' },
  { code: 'es',    label: 'Spanish',    native: 'Español' },
  { code: 'fr',    label: 'French',     native: 'Français' },
  { code: 'de',    label: 'German',     native: 'Deutsch' },
  { code: 'it',    label: 'Italian',    native: 'Italiano' },
  { code: 'pt',    label: 'Portuguese', native: 'Português' },
  { code: 'ja',    label: 'Japanese',   native: '日本語' },
  { code: 'ko',    label: 'Korean',     native: '한국어' },
  { code: 'zh-CN', label: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'zh-TW', label: 'Chinese (Traditional)', native: '繁體中文' },
  { code: 'ar',    label: 'Arabic',     native: 'العربية' },
  { code: 'hi',    label: 'Hindi',      native: 'हिन्दी' },
  { code: 'ru',    label: 'Russian',    native: 'Русский' },
  { code: 'nl',    label: 'Dutch',      native: 'Nederlands' },
  { code: 'sv',    label: 'Swedish',    native: 'Svenska' },
  { code: 'pl',    label: 'Polish',     native: 'Polski' },
];

export const DEFAULT_TRANSLATE_LANGUAGE = 'en';
