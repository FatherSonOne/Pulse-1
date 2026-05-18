// src/components/ToolsMenuV2/types.ts
// PR 3a — Messages Tools Redesign · Surface 3 · Slim Tools menu.
//
// Type contract for the new tools menu. Coral budget: ZERO in PR 3a.
// PR 3b will add the Summary + Insights tiles (the only coral consumers
// across the whole redesign — six instances total). Do not introduce
// coral tokens in any PR 3a file.

import type { LucideIcon } from 'lucide-react';

/**
 * Discriminated union of every tile shipped in PR 3a. Summary + Insights
 * are deliberately absent — they ship in PR 3b after the Gemini routing
 * for thread summarisation lands. Keep this list narrow so the search
 * box and the tile keyboard navigation stay deterministic.
 */
export type ToolsMenuTileId = 'thread-audit' | 'translate-settings';

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
