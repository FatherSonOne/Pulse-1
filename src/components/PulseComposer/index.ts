// src/components/PulseComposer/index.ts
// Barrel export for PR-1 compose bar (Messages Tools Redesign - Surface 1).

export { default } from './PulseComposer';
export { default as PulseComposer } from './PulseComposer';
export { default as AttachSheet } from './AttachSheet';
export { default as FormatPopover, applyFormat, FORMAT_ACTIONS } from './FormatPopover';
export { default as SlashAutocomplete } from './SlashAutocomplete';
export { default as ToolsMenuPlaceholder } from './ToolsMenuPlaceholder';
export { useSmartCompose } from './useSmartCompose';
export { useTextSelection } from './useTextSelection';
export {
  STUB_TEMPLATES,
  STUB_SLASH_COMMANDS,
  filterSlashItems,
} from './templates';
export { TOUCH_TARGET_PX, DESKTOP_BREAKPOINT } from './types';
export type {
  ComposerAttachment,
  FormatActionDescriptor,
  FormatActionId,
  PulseComposerProps,
  PulseComposerSendPayload,
  SelectionAnchor,
  SlashItem,
  SlashSource,
  SlashState,
  SmartComposeProvider,
  SmartComposeSuggestion,
} from './types';
export type { UseSmartComposeResult } from './useSmartCompose';
