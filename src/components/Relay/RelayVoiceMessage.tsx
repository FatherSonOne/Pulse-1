import React from 'react';
import { Play, Pause, MoreVertical, Star, Bookmark, FileText, Reply, Smile } from 'lucide-react';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import { Waveform } from './studio/Waveform';

/**
 * <RelayVoiceMessage> — the shared voice-message primitive for Relay.
 *
 * The Voice Studio bar as one component: a 36px play button (rose only as
 * state — needs-reply / me / now-playing), the shared <Waveform> primitive
 * (fills left→right with playback progress, parity with Inbox + the footer),
 * a senderName-initial avatar, timestamp, AI provenance chip, and a hover
 * action row. Surface-specific affordances enter through named slot props so
 * Direct / Channel / Broadcast / Notes render their own extras without
 * diverging from the bar.
 *
 * Coral budget (CLAUDE.md §4): coral is state, never decoration — play-fill on
 * me / needs-reply / now-playing, the active ring, and AI provenance only.
 *
 * The four mode call-sites pass: isActive + progress (from the shared studio
 * transport), selectionCheckbox (selection mode), statusIndicator (me rows),
 * reactionsDisplay, footerExtras (per-message speed / chapters / tags /
 * linked-items), and onReply/onReact/onMore (which open the mode's own
 * pickers/menus, kept as siblings of the row).
 */

export interface RelayVoiceMessageProps {
  // Core
  id: string;
  audioUrl: string;
  duration: number;
  timestamp: string | Date;
  sender: 'me' | 'other';
  senderName: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  /** This row is the now-playing voice → coral ring + waveform fill. */
  isActive?: boolean;
  /** 0 → 1 playback progress; fills the waveform when isActive. */
  progress?: number;
  // Optional content
  transcript?: string;
  analysis?: {
    summary?: string;
    actionItems?: string[];
    sentiment?: string;
    vendor?: string;
  };
  status?: 'sent' | 'delivered' | 'read' | 'needs-reply';
  starred?: boolean;
  bookmarked?: boolean;
  // Surface slots
  leadingAudienceLabel?: React.ReactNode;
  messageTypePill?: React.ReactNode;
  episodeChip?: React.ReactNode;
  replyToContext?: React.ReactNode;
  audienceMeta?: React.ReactNode;
  /** Extra header content, after the timestamp. */
  headerExtras?: React.ReactNode;
  /** Extra footer content in the action row (per-message speed control,
   *  chapter button, tag chips, linked-items — whatever a surface needs). */
  footerExtras?: React.ReactNode;
  /** Selection-mode checkbox, rendered at the leading edge of the row. */
  selectionCheckbox?: React.ReactNode;
  /** Sent / delivered / read indicator (me rows), shown next to the time. */
  statusIndicator?: React.ReactNode;
  /** Reactions row, rendered under the bubble. */
  reactionsDisplay?: React.ReactNode;
  // Hooks
  onStar?: () => void;
  onBookmark?: () => void;
  onMore?: () => void;
  onReply?: () => void;
  onReact?: () => void;
  onTranscriptClick?: () => void;
  // Waveform
  waveformSeed?: string;
  // Layout
  isDarkMode?: boolean;
  maxWidth?: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimestamp(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const RelayVoiceMessage: React.FC<RelayVoiceMessageProps> = ({
  id,
  audioUrl: _audioUrl,
  duration,
  timestamp,
  sender,
  senderName,
  isPlaying,
  onPlay,
  onPause,
  isActive = false,
  progress = 0,
  transcript,
  analysis,
  status,
  starred,
  bookmarked,
  leadingAudienceLabel,
  messageTypePill,
  episodeChip,
  replyToContext,
  audienceMeta,
  headerExtras,
  footerExtras,
  selectionCheckbox,
  statusIndicator,
  reactionsDisplay,
  onStar,
  onBookmark,
  onMore,
  onReply,
  onReact,
  onTranscriptClick,
  waveformSeed,
  isDarkMode: _isDarkMode = false,
  maxWidth = '75%',
}) => {
  const isMe = sender === 'me';
  const needsReply = status === 'needs-reply';
  const initial = (senderName || '?').charAt(0).toUpperCase();

  const bubbleClasses = isMe
    ? 'bg-rose-50 dark:bg-[rgba(244,63,94,0.08)] rounded-2xl rounded-br-md'
    : 'bg-white dark:bg-white/[0.03] rounded-2xl rounded-bl-md border border-zinc-200/60 dark:border-white/[0.06]';
  // Active = now-playing → coral ring. State, not decoration (Coral budget).
  const activeRing = isActive ? 'ring-2 ring-rose-500/35' : '';

  return (
    <div
      className={`flex flex-col gap-1.5 ${isMe ? 'items-end' : 'items-start'}`}
      style={{ maxWidth }}
      data-active={isActive || undefined}
    >
      {leadingAudienceLabel && <div className="px-2">{leadingAudienceLabel}</div>}

      <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} w-full`}>
        {/* Selection checkbox slot — leading edge of the row. */}
        {selectionCheckbox}

        {/* Avatar — neutral background, coral only for 'me' state */}
        <div
          className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-sm font-medium ${
            isMe
              ? 'bg-rose-500 text-white'
              : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300'
          }`}
          aria-hidden="true"
        >
          {initial}
        </div>

        <div className={`min-w-0 flex-1 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
          {/* Header line — name + surface chips + time + status */}
          <div className={`flex items-center gap-2 px-1 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
            <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {senderName}
            </span>
            {episodeChip}
            {messageTypePill}
            <span className="font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-500">
              {formatTimestamp(timestamp)}
            </span>
            {statusIndicator}
            {headerExtras}
          </div>

          {/* Bubble */}
          <div className={`px-3 py-2.5 ${bubbleClasses} ${activeRing} w-full`}>
            {replyToContext && <div className="mb-2">{replyToContext}</div>}

            <div className="flex items-center gap-3">
              {/* Play button — 36px, coral when needs-reply / me, neutral else */}
              <button
                onClick={isPlaying ? onPause : onPlay}
                className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center transition-colors ${
                  needsReply || isMe
                    ? 'bg-rose-500 text-white hover:bg-rose-600'
                    : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/[0.1]'
                }`}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                type="button"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              {/* Shared Waveform — fills left→right with progress when this row
                  is the active voice (parity with Inbox + the footer).
                  currentColor (via the text-* class) drives the bar color. */}
              <Waveform
                seed={waveformSeed || id}
                count={36}
                height={28}
                progress={isActive ? progress : 0}
                className={`flex-1 min-w-[80px] ${
                  isActive ? 'text-rose-500' : isMe ? 'text-rose-400' : 'text-zinc-400 dark:text-zinc-500'
                }`}
              />

              {/* Duration */}
              <span className="font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-400 shrink-0">
                {formatDuration(duration)}
              </span>
            </div>

            {audienceMeta && <div className="mt-2">{audienceMeta}</div>}

            {/* Transcript with provenance chip */}
            {transcript && (
              <div className="mt-2.5 pt-2.5 border-t border-zinc-200/60 dark:border-white/[0.06]">
                <div className="flex items-center gap-2 mb-1.5">
                  <AIProvenanceChip vendor="WHISPER" type="TRANSCRIPT" />
                </div>
                <button
                  onClick={onTranscriptClick}
                  className="text-left text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-3"
                  type="button"
                >
                  <FileText className="w-3 h-3 inline mr-1.5 text-zinc-400" aria-hidden="true" />
                  {transcript}
                </button>
              </div>
            )}

            {/* Analysis with provenance chip */}
            {analysis?.summary && (
              <div className="mt-2.5 pt-2.5 border-t border-zinc-200/60 dark:border-white/[0.06]">
                <div className="flex items-center gap-2 mb-1.5">
                  <AIProvenanceChip vendor={analysis.vendor || 'PULSE AI'} type="SUMMARY" />
                </div>
                <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {analysis.summary}
                </p>
              </div>
            )}
          </div>

          {/* Reactions slot — under the bubble */}
          {reactionsDisplay && (
            <div className={`px-1 mt-1 ${isMe ? 'self-end' : 'self-start'}`}>{reactionsDisplay}</div>
          )}

          {/* Action row — revealed on hover/focus by the parent's `group` */}
          <div className={`flex items-center gap-0.5 px-1 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${isMe ? 'flex-row-reverse' : ''}`}>
            {onStar && (
              <button
                onClick={onStar}
                className={`p-1 rounded transition-colors ${
                  starred
                    ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
                }`}
                aria-label={starred ? 'Unstar' : 'Star'}
                type="button"
              >
                <Star className="w-3.5 h-3.5" fill={starred ? 'currentColor' : 'none'} />
              </button>
            )}
            {onBookmark && (
              <button
                onClick={onBookmark}
                className={`p-1 rounded transition-colors ${
                  bookmarked
                    ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
                }`}
                aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
                type="button"
              >
                <Bookmark className="w-3.5 h-3.5" fill={bookmarked ? 'currentColor' : 'none'} />
              </button>
            )}
            {onReply && (
              <button
                onClick={onReply}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
                aria-label="Reply"
                type="button"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
            )}
            {onReact && (
              <button
                onClick={onReact}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
                aria-label="Add reaction"
                type="button"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
            )}
            {onMore && (
              <button
                onClick={onMore}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
                aria-label="More actions"
                type="button"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            )}
            {footerExtras}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelayVoiceMessage;
