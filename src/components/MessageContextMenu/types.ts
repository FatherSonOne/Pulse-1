// src/components/MessageContextMenu/types.ts
// PR 2 — Messages Tools Redesign · Surface 2 · Message context-menu.
//
// Type contract for the message context-menu family. All consumers depend
// on these names; the spec at docs/messages-tools-redesign.md §2.x is
// the source of truth.

import type { LucideIcon } from 'lucide-react';

/** Quick-reaction emoji shown ABOVE the menu. Locked set per spec. */
export const QUICK_REACTIONS: ReadonlyArray<string> = [
  '\u{1F44D}', // 👍
  '❤️', // ❤️
  '\u{1F602}', // 😂
  '\u{1F62E}', // 😮
  '\u{1F622}', // 😢
  '\u{1F64F}', // 🙏
];

/** 15 minutes in ms — the edit window per locked decision #4. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Long-press threshold per spec (iOS-aligned). */
export const LONG_PRESS_MS = 350;

/**
 * Canonical identifier for every action the context-menu can dispatch.
 * Whatever component owns the message list provides a single handler
 * (`onAction`) that switches on this id.
 */
export type ContextMenuActionId =
  | 'reply'
  | 'react' // opens full picker
  | 'copy'
  | 'edit'
  | 'forward'
  | 'save'
  | 'mention'
  | 'create-task' // Pulse: create a task linked to this message
  | 'propose-decision' // Pulse: propose a decision linked to this message
  | 'share'
  | 'delete';

/**
 * Per-message viewpoint passed into the menu so it can render the
 * correct top-5 + overflow set without coupling to message storage.
 */
export interface MessageViewpoint {
  /** Stable message id (used as `data-message-id`). */
  messageId: string;
  /** Whether the message belongs to the current user. */
  isOwn: boolean;
  /** Group thread vs 1:1. Pulse Messages is 1:1 only today; future-proofed. */
  isGroup: boolean;
  /**
   * Whether the message is currently within the edit window. Prefer
   * server-provided `edit_until` when available; client computes from
   * `createdAt + EDIT_WINDOW_MS` as a fallback. The boolean is computed
   * once at menu-open and not re-evaluated mid-render.
   */
  isEditable: boolean;
  /** True if the bubble has any text content to copy. */
  hasText: boolean;
  /** True if auto-translate is already applied to this message. */
  isAutoTranslated: boolean;
  /** True if the message originated in a non-default language. */
  isTranslatable: boolean;
  /**
   * Permissions the menu uses to hide actions. Each is optional — if
   * undefined, the menu assumes the safest (most-restrictive) default.
   */
  canDelete?: boolean;
  canMention?: boolean;
  /** True when the user is in a workspace, so Pulse task/decision
   *  creation from a message is available. */
  canCreateTask?: boolean;
}

export interface ContextMenuItemDescriptor {
  id: ContextMenuActionId;
  label: string;
  icon: LucideIcon;
  /** Keyboard shortcut hint shown on the desktop popover. */
  shortcut?: string;
  /** Destructive items render in danger color + a top divider. */
  destructive?: boolean;
}

/** Trigger point for the popover/sheet — viewport-relative coords. */
export interface ContextMenuAnchor {
  x: number;
  y: number;
  /** Optional reference element to restore focus on close. */
  source?: HTMLElement | null;
}

export interface MessageContextMenuProps {
  /** Open / closed flag. Parent owns the state. */
  open: boolean;
  /** Triggering anchor (mouse position or keyboard target rect midpoint). */
  anchor: ContextMenuAnchor | null;
  /** Message context this menu is acting on. */
  viewpoint: MessageViewpoint | null;
  /** Existing reactions for the message (used to highlight selected emoji). */
  myReactions?: ReadonlyArray<string>;
  /** Action dispatcher — parent decides what each action does. */
  onAction: (id: ContextMenuActionId) => void;
  /** Tap-to-react in the quick bar. */
  onQuickReact: (emoji: string) => void;
  /** Dismiss request — parent must set `open=false` synchronously. */
  onClose: () => void;
  /** Optional override for the "More…" picker. Defaults to in-menu expansion. */
  onOpenMorePicker?: () => void;
  /** Force mobile (sheet) vs desktop (popover). Defaults to width detection. */
  forceMobile?: boolean;
  isDarkMode?: boolean;
}

export interface EditedBadgeProps {
  /** Whether the badge should render. */
  edited: boolean;
  /** Original text to show on hover/tap. */
  originalText?: string | null;
  isDarkMode?: boolean;
}
