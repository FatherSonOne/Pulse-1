// src/components/MessageContextMenu/index.ts
// Barrel export for PR-2 message context-menu (Messages Tools Redesign
// — Surface 2).

export { default } from './MessageContextMenu';
export { default as MessageContextMenu } from './MessageContextMenu';
export { default as QuickReactionsBar } from './QuickReactionsBar';
export { default as ContextMenuItem } from './ContextMenuItem';
export { default as EditedBadge } from './EditedBadge';
export { useLongPress } from './useLongPress';
export { useMessageContextMenu } from './useMessageContextMenu';
export { buildTop5, buildOverflow, computeIsEditable } from './menuConfig';
export {
  QUICK_REACTIONS,
  EDIT_WINDOW_MS,
  LONG_PRESS_MS,
} from './types';
export type {
  ContextMenuActionId,
  ContextMenuAnchor,
  ContextMenuItemDescriptor,
  MessageContextMenuProps,
  MessageViewpoint,
  EditedBadgeProps,
} from './types';
