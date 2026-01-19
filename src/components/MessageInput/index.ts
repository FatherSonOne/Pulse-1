// src/components/MessageInput/index.ts
// Barrel export for MessageInput components

// Default export for main component
export { default } from './MessageInput';

// Named exports for other components
export { default as AIComposer } from './AIComposer';
export { default as ToneAnalyzer } from './ToneAnalyzer';
export { default as FormattingToolbar } from './FormattingToolbar';
export { default as AttachmentPreview } from './AttachmentPreview';

// Type exports
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
