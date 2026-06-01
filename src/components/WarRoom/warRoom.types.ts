/**
 * Shared War Room domain types.
 *
 * Relocated here from the (now-deleted) orphaned ModeSwitcher component so the
 * store and panes can consume them without importing a dead UI module
 * (handoff Phase 9). The mode/mission/room model is retained for the
 * warRoomStore mode slice; the switcher UI itself was removed.
 */

// War Room Modes — strategy and deep-work modes.
export type WarRoomMode =
  // ── Canonical modes (Phase 1+) ──────────────────────────────
  | 'command-center' // Default home — overview, comms, quick actions
  | 'intel' // Source-grounded Q&A with strict citations
  // ── Existing modes ───────────────────────────────────────────
  | 'focus' // Deep work, distraction-free
  | 'analyst' // Data-driven analysis with citations
  | 'strategist' // Decision trees, pro/con
  | 'brainstorm' // Idea clustering
  | 'debrief' // Session summary
  // ── Legacy (kept for backward compatibility) ─────────────────
  | 'tactical' // @deprecated — maps to command-center
  | 'elegant-interface'; // @deprecated — maps to command-center

// Mission Types — guided workflows.
export type MissionType =
  | 'research'
  | 'decision'
  | 'brainstorm'
  | 'plan'
  | 'analyze'
  | 'create';

// Combined room selector type.
export type RoomType = 'war-room' | 'missions';
