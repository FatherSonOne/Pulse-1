// src/components/ToolsMenuV2/types.ts
// PR 3a + 3b — Messages Tools Redesign · Surface 3 · Slim Tools menu.
//
// Type contract for the new tools menu. Coral budget across the whole
// redesign = EXACTLY 4 token consumers (Summary tile chip, Insights tile
// chip, Summary card chip, Insights card chip — all in PR 3b). Do not
// introduce coral tokens in any other file or for any other surface.

import type { LucideIcon } from 'lucide-react';

/**
 * Discriminated union of every tile shipped in Surface 3. Order in the
 * shell is Summary → Insights → Audit → Translate Settings (mock 3.1/3.2).
 * Summary + Insights are added in PR 3b; Audit + Translate Settings
 * shipped in PR 3a.
 */
export type ToolsMenuTileId =
  | 'thread-summary'
  | 'insights'
  | 'thread-audit'
  | 'translate-settings';

/**
 * Descriptor for a single tile in the slim menu. `purpose` doubles as
 * (a) the muted secondary line in the tile body and (b) the matchable
 * payload for the search box (in addition to `title`).
 */
export interface ToolsMenuTileDescriptor {
  id: ToolsMenuTileId;
  title: string;
  purpose: string;
  icon: LucideIcon;
  /** Aria label override — defaults to `${title} — ${purpose}` if omitted. */
  ariaLabel?: string;
}

/** Props the shell forwards to every tile body. */
export interface ToolsMenuTileBodyProps {
  threadId: string;
  messageCount: number;
  isDarkMode: boolean;
  /** Back-to-list handler for inline accordion behaviour. */
  onBack: () => void;
}

/** Props for the top-level <ToolsMenuV2> shell. */
export interface ToolsMenuV2Props {
  open: boolean;
  /** Thread id — drives per-thread localStorage keys and message-count math. */
  threadId: string;
  /**
   * Message count for the active thread — drives empty-state copy on
   * Thread Audit. Wire to the real message store at the call site;
   * pass a stub for now if unavailable.
   */
  messageCount: number;
  /**
   * Force-mobile override (testing / Storybook). When omitted, layout
   * derives from window width like every other Surface in this redesign.
   */
  forceMobile?: boolean;
  isDarkMode?: boolean;
  onClose: () => void;
}

/** Shape of the persisted translate-settings record (per thread). */
export interface TranslateSettings {
  /** Auto-translate received messages into `targetLanguage`. */
  enabled: boolean;
  /** BCP-47 language tag (en / es / fr / de / zh-CN / ...). */
  targetLanguage: string;
  /** Show original message body by default (chip remains either way). */
  showOriginalDefault: boolean;
}

/** Touch-target floor — matches PulseComposer / MessageContextMenu. */
export const TOUCH_TARGET_PX = 44;

/** Tile floor (mobile) — well over the 44px touch target. */
export const TILE_MIN_HEIGHT_PX = 72;

/** Desktop side-panel width per spec mock 3.1. */
export const DESKTOP_PANEL_WIDTH = 380;

/** Mobile bottom-sheet share of viewport height per spec mock 3.2. */
export const MOBILE_SHEET_VH = 60;

/** Shared mobile breakpoint. */
export const DESKTOP_BREAKPOINT = 768;

/** Threshold below which Thread Audit shows the empty-state message. */
export const AUDIT_MIN_MESSAGES = 5;

/** Below this count the Thread Summary tile is hidden entirely. */
export const SUMMARY_HIDE_BELOW = 10;
/** At or above this count the Thread Summary tile is active. */
export const SUMMARY_ACTIVE_AT = 50;
/** Below this count the Insights tile is hidden entirely. */
export const INSIGHTS_HIDE_BELOW = 20;
/**
 * Above this message count the Summary generation flow renders a
 * determinate progress bar ("Reading {N} messages…") per spec §3.4.
 */
export const SUMMARY_DETERMINATE_THRESHOLD = 200;

/** Stub-provider latency for the PR 3b dev fixture (real wiring = edge fn). */
export const STUB_AI_DELAY_MS = 1500;

/**
 * State machine for the Thread Summary tile body. The shell drives
 * `idle → generating → generated | error → idle (regenerate)`. Cancel
 * during `generating` returns to `idle`.
 */
export type ThreadSummaryState =
  | { kind: 'idle' }
  | { kind: 'generating'; startedAt: number; progress: number; totalMessages: number }
  | { kind: 'generated'; summary: string; sourceMessages: number; generatedAt: number }
  | { kind: 'error'; message: string };

/**
 * Insights state machine. Same shape as Summary but the payload is a
 * structured chip list + highlight cards instead of free prose.
 */
export interface InsightChip {
  id: string;
  label: string;
}
export interface InsightHighlight {
  id: string;
  title: string;
  detail: string;
}
export type InsightsState =
  | { kind: 'idle' }
  | { kind: 'generating'; startedAt: number }
  | {
      kind: 'generated';
      chips: ReadonlyArray<InsightChip>;
      highlights: ReadonlyArray<InsightHighlight>;
      sourceMessages: number;
      generatedAt: number;
    }
  | { kind: 'error'; message: string };

/**
 * AI provider contract — mirrors PulseComposer's SmartComposeProvider.
 * Real implementation routes through the Pulse Gemini edge function;
 * PR 3b ships a deterministic stub.
 */
export interface ThreadSummaryProvider {
  (
    input: { threadId: string; messageCount: number },
    signal: AbortSignal,
  ): Promise<{ summary: string; sourceMessages: number }>;
}
export interface InsightsProvider {
  (
    input: { threadId: string; messageCount: number },
    signal: AbortSignal,
  ): Promise<{
    chips: ReadonlyArray<InsightChip>;
    highlights: ReadonlyArray<InsightHighlight>;
    sourceMessages: number;
  }>;
}
