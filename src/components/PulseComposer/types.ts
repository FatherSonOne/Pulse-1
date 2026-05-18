// src/components/PulseComposer/types.ts
// PR 1 — Messages Tools Redesign · Surface 1 · Compose bar.
//
// Type contract for the new compose bar family. All consumers depend on
// these names; the spec at docs/messages-tools-redesign.md §1.x is the
// source of truth.
//
// Coral budget: ZERO. Surface 1 carries no coral whatsoever. If a future
// patch adds coral to this module, the reviewer must reject the PR.

import type { LucideIcon } from 'lucide-react';

/** Stub attachment payload — wiring shape only. Real upload lives outside PR 1. */
export interface ComposerAttachment {
  id: string;
  file: File;
  kind: 'file' | 'photo' | 'camera';
  /** Local-only preview URL (for images). */
  preview?: string;
}

/**
 * Outbound send contract for PR 1. Mirrors the legacy `MessageInput.onSend`
 * surface so wiring sites can swap with zero behavioural change.
 */
export interface PulseComposerSendPayload {
  text: string;
  attachments: ComposerAttachment[];
}

/**
 * Suggestion shape consumed by useSmartCompose. The hook is currently
 * stub-driven; the `suggestionProvider` prop lets a future PR plug a
 * server-side Gemini route in.
 */
export interface SmartComposeSuggestion {
  /** The portion appended to the current text (does NOT echo current input). */
  completion: string;
  /** Stable id so the live-region announcer doesn't re-announce identical strings. */
  id: string;
}

/**
 * Provider signature. Returning `null` means "no suggestion right now"
 * — the hook treats it as silent failure per spec.
 */
export type SmartComposeProvider = (
  current: string,
  signal: AbortSignal,
) => Promise<SmartComposeSuggestion | null>;

/** Format-popover action vocabulary (mock 1.4). */
export type FormatActionId =
  | 'bold'
  | 'italic'
  | 'code'
  | 'list'
  | 'quote'
  | 'link';

export interface FormatActionDescriptor {
  id: FormatActionId;
  label: string;
  icon: LucideIcon;
  shortcut: string;
  /** Wrap-style markdown delimiters (start, end). For block formats see `linePrefix`. */
  wrap?: { start: string; end: string };
  /** Line-prefix style (lists, quote). */
  linePrefix?: string;
}

/** Selection rect in viewport coords — used to anchor the format popover. */
export interface SelectionAnchor {
  /** Center-x of the selection bbox. */
  x: number;
  /** Top edge of the selection bbox (the popover floats above). */
  y: number;
  /** Length of the selected substring (≥ 1 char to show the popover). */
  length: number;
  /** Start/end offsets in the textarea value. */
  start: number;
  end: number;
}

/**
 * Generic slash-command item — used both for `/t` templates and `/`
 * generic commands. The `body` is what gets inserted into the textarea,
 * replacing the entire slash trigger.
 */
export interface SlashItem {
  id: string;
  /** Display label shown in the listbox. */
  label: string;
  /** Optional secondary text rendered muted (e.g. category, hint). */
  hint?: string;
  /** What to insert when the user accepts the item. */
  body: string;
}

/**
 * Source of the slash autocomplete: which catalogue is being filtered.
 * `'templates'` = `/t <q>` mode (filtered against template list).
 * `'commands'`  = `/` generic-commands mode (filtered against /help, /shrug, ...).
 */
export type SlashSource = 'templates' | 'commands' | null;

/** Open/closed state for the slash autocomplete listbox. */
export interface SlashState {
  source: SlashSource;
  /** Current query (everything after the trigger prefix). */
  query: string;
  /** Start offset in the textarea value (position of the leading `/`). */
  triggerStart: number;
  /** End offset in the textarea value (where the caret is now). */
  triggerEnd: number;
}

/** Props consumed by the top-level `<PulseComposer>` component. */
export interface PulseComposerProps {
  /** Send handler. Receives final text + any staged attachments. */
  onSend: (payload: PulseComposerSendPayload) => void;
  /** Typing indicator hook (optional — wired by caller). */
  onTyping?: (isTyping: boolean) => void;
  /** Placeholder text shown when the textarea is empty. */
  placeholder?: string;
  /** Maximum character length for the textarea. */
  maxLength?: number;
  /** Disabled state — locks input + send. */
  disabled?: boolean;
  /** Initial value (draft restoration). */
  initialValue?: string;
  /**
   * Smart Compose provider. When omitted, an internal stub returns a
   * canned completion to demonstrate the wiring (see useSmartCompose).
   */
  suggestionProvider?: SmartComposeProvider;
  /** Dark-mode hint — defaults to detecting `html.dark`. */
  isDarkMode?: boolean;
  /** Force mobile (sheet) vs desktop (popover) layout. Defaults to width detection. */
  forceMobile?: boolean;
  /**
   * Active thread / conversation id. Forwarded to ToolsMenuPlaceholder so
   * the slim Tools menu (`toolsMenuV2`) can scope per-thread settings
   * (Translate Settings localStorage key, Thread Audit Pace stats).
   * Omit when no thread is active — the menu falls back to a placeholder id.
   */
  threadId?: string;
  /**
   * Message count for the active thread. Drives the tile visibility state
   * machine in ToolsMenuV2 (Summary hidden &lt;10 / disabled 10-49 / active 50+;
   * Insights hidden &lt;20 / active 20+; Thread Audit disabled &lt;5).
   */
  messageCount?: number;
}

/** Touch-target floor per WCAG 2.2 AA + spec. */
export const TOUCH_TARGET_PX = 44;

/** Mobile breakpoint shared with MessageContextMenu. */
export const DESKTOP_BREAKPOINT = 768;
