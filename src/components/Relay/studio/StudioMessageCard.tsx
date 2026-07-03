// StudioMessageCard — the shared flat voice-message row for Path C.
//
// Generalizes the Inbox reference card (RelayTriageStream's InboxCard) so
// Direct, Channel, and Notes render the SAME flat studio-card row the
// playground shows — NOT the bubble layout of RelayVoiceMessage. (Per the
// 2026-05-24 row decision: a new shared flat card, not a restyle of the
// bubble component.)
//
// Anatomy, matching _design-playground/relay-redesign.html → Path C:
//   ┌ studio-card (coral ring when `active`) ───────────────────────────┐
//   │ [avatar/leading]  Title  ‹pills›  · NOW PLAYING ·   when · dur     │
//   │ [▶ play]  ▁▃▅▇▅▃▁ waveform (fills coral on progress when active)    │
//   │           body children — transcript / tags / AI (section-composed)│
//   └────────────────────────────────────────────────────────────────────┘
//
// Coral budget (CLAUDE.md §4): rose is state only — the active ring, the
// now-playing pip, the play-fill on the active row, and the 'me'/needs-reply
// avatar. Body content (transcript, tags, AI digests) is passed as `children`
// so each section keeps full control of its own copy + highlighting while the
// header / transport / active state stay identical across surfaces.

import React from 'react';
import { Play, Pause } from 'lucide-react';

import { Waveform } from './Waveform';
import { StudioCard } from './StudioCard';

export interface StudioCardAvatar {
  /** Initials / single letter glyph. */
  label: string;
  /** Tailwind `bg-*` class for the avatar (use avatarColorForId). Ignored
   *  when `rose` is set. */
  colorClass?: string;
  /** 'me' rows + needs-reply rows get the rose avatar (state, not decoration). */
  rose?: boolean;
  /** Round (people) vs rounded-square (icon tiles). Default 'full'. */
  shape?: 'full' | 'lg';
}

const PLAY_SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
  lg: 'w-10 h-10',
};

const AVATAR_SIZE = 'w-9 h-9';

export interface StudioMessageCardProps {
  // ── playback state (from the shared studio transport) ─────────────────────
  active?: boolean;
  isPlaying?: boolean;
  /** 0 → 1; fills the waveform + draws the playhead line when `active`. */
  progress?: number;
  /** Has a real audio asset → the play button is live. */
  canPlay?: boolean;
  /** Start / toggle playback. */
  onPlay?: () => void;

  // ── leading slot ──────────────────────────────────────────────────────────
  avatar?: StudioCardAvatar;
  /** Custom leading node (e.g. Notes' edit-icon tile). Overrides `avatar`. */
  leadingNode?: React.ReactNode;

  // ── header ──────────────────────────────────────────────────────────────
  title: React.ReactNode;
  /** Type / @MENTION pills after the title. */
  pills?: React.ReactNode;
  /** Right-aligned meta, usually "when · dur". */
  meta?: React.ReactNode;
  /** Extra header content (kept after meta). */
  headerExtras?: React.ReactNode;
  /** Show the "NOW PLAYING" pip when active + playing. Default true. */
  showNowPlaying?: boolean;

  // ── transport ─────────────────────────────────────────────────────────────
  waveSeed: string;
  waveCount?: number;
  playSize?: 'sm' | 'md' | 'lg';

  // ── body ──────────────────────────────────────────────────────────────────
  /** Transcript / tags / AI — section-composed; align with `bodyIndent`. */
  children?: React.ReactNode;
  /** Left padding (px) for the body block, to align it under the waveform.
   *  Playground uses 44 (Direct) / 48 (Channel, Notes) / 52 (Inbox). */
  bodyIndent?: number;

  // ── layout ──────────────────────────────────────────────────────────────
  /** Direct conversation indent: 'me' → ml-12, 'them' → mr-12. */
  indent?: 'me' | 'them';
  padding?: string;
  className?: string;
  onClick?: () => void;

  // ── slots ──────────────────────────────────────────────────────────────
  /** Selection-mode checkbox at the leading edge. */
  selectionCheckbox?: React.ReactNode;
  /** Hover action cluster, absolutely positioned top-right. */
  actions?: React.ReactNode;
}

export const StudioMessageCard: React.FC<StudioMessageCardProps> = ({
  active = false,
  isPlaying = false,
  progress = 0,
  canPlay = true,
  onPlay,
  avatar,
  leadingNode,
  title,
  pills,
  meta,
  headerExtras,
  showNowPlaying = true,
  waveSeed,
  waveCount = 60,
  playSize = 'md',
  children,
  bodyIndent = 48,
  indent,
  padding = 'p-4',
  className = '',
  onClick,
  selectionCheckbox,
  actions,
}) => {
  const indentClass = indent === 'me' ? 'ml-12' : indent === 'them' ? 'mr-12' : '';

  const avatarNode =
    leadingNode ??
    (avatar ? (
      <div
        className={`shrink-0 ${AVATAR_SIZE} ${
          avatar.shape === 'lg' ? 'rounded-lg' : 'rounded-full'
        } flex items-center justify-center text-sm font-semibold ${
          avatar.rose
            ? 'bg-rose-500 text-white'
            : `${avatar.colorClass || 'bg-zinc-200 dark:bg-zinc-800'} text-white`
        }`}
        aria-hidden="true"
      >
        {avatar.label}
      </div>
    ) : null);

  return (
    <StudioCard
      active={active}
      onClick={onClick}
      className={`relative group ${padding} ${indentClass} ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        {selectionCheckbox}
        {avatarNode}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {title}
            </span>
            {pills}
            {active && isPlaying && showNowPlaying && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-rose-600 dark:text-rose-400">
                <span className="w-1 h-1 rounded-full bg-rose-500 pulse-dot-anim" aria-hidden="true" />
                Now playing
              </span>
            )}
            {meta && (
              // When the card has a hover/focus action cluster (absolutely
              // positioned top-right by the consumer), fade the meta on
              // hover/focus so the two never overlap — mirrors the Inbox card
              // (RelayTriageStream). Cards with no actions keep meta visible.
              <span
                className={`ml-auto font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0${
                  actions ? ' transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0 [@media(hover:none)]:opacity-0' : ''
                }`}
              >
                {meta}
              </span>
            )}
            {headerExtras}
          </div>
        </div>
      </div>

      {/* Transport */}
      <div className="flex items-center gap-3">
        {canPlay && onPlay ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className={`shrink-0 ${PLAY_SIZE[playSize]} rounded-full flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
              active
                ? 'bg-rose-500 text-white'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-rose-500 hover:text-white'
            }`}
            aria-label={active && isPlaying ? 'Pause' : 'Play'}
          >
            <span className="relative w-4 h-4 block">
              <Pause
                className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${
                  active && isPlaying ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <Play
                className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${
                  active && isPlaying ? 'opacity-0' : 'opacity-100'
                }`}
              />
            </span>
          </button>
        ) : (
          <div
            className={`shrink-0 ${PLAY_SIZE[playSize]} rounded-full bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center text-zinc-400`}
            aria-hidden="true"
          >
            <Play className="w-4 h-4 opacity-40" />
          </div>
        )}
        <div className="relative flex-1 min-w-0">
          <span
            style={{ color: active ? 'var(--pulse-rose)' : 'var(--pulse-ink-2)', display: 'block' }}
          >
            <Waveform seed={waveSeed} height={28} count={waveCount} tall progress={active ? progress : 0} />
          </span>
          {active && (
            <span
              className="absolute inset-y-0 pointer-events-none"
              style={{ left: `${Math.round(progress * 100)}%`, width: 2, background: 'var(--pulse-rose)' }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {/* Body — transcript / tags / AI, section-composed */}
      {children && (
        <div className="mt-2.5" style={{ paddingLeft: bodyIndent }}>
          {children}
        </div>
      )}

      {/* Hover actions */}
      {actions}
    </StudioCard>
  );
};

export default StudioMessageCard;
