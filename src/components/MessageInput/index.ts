// src/components/MessageInput/index.ts
// Barrel export for MessageInput components

export { default as MessageInput } from './MessageInput';
export { default as AIComposer } from './AIComposer';
export { default as ToneAnalyzer } from './ToneAnalyzer';
export { default as FormattingToolbar } from './FormattingToolbar';
export { default as AttachmentPreview } from './AttachmentPreview';

export type {
  MessageInputProps,
  AISuggestion,
  ToneAnalysis,
  FormattingAction,
  AttachmentFile,
  DraftState,
  AIComposerProps,
  ToneAnalyzerProps,
  FormattingToolbarProps,
  AttachmentPreviewProps,
  KeyboardShortcut,
} from './types';
