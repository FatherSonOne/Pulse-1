import React, { useMemo } from 'react';
import { Play, Pause, MoreVertical, Star, Bookmark, FileText } from 'lucide-react';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';

/**
 * <RelayVoiceMessage> — the shared voice-message primitive for Relay.
 *
 * Replaces 4 divergent inline implementations (Direct/ClassicMode bubble,
 * Channel/TeamVoxMode message, Broadcast/PulseRadio episode, Notes/VoxNotesMode
 * detail). The chrome — play button, waveform, avatar, timestamp, action menu,
 * AI provenance chip — is standardized; surface-specific extras enter through
 * named slot props.
 *
 * TODO(impeccable phase 3 task 6 — surface migration):
 * The component shape is complete for basic chrome, but the 4 call-site
 * migrations are still pending. Each surface needs one or more slot props
 * added before migration is non-regressive:
 *   - Direct (ClassicMode): onReply trigger, onReact + reaction picker
 *     state, selectionCheckbox slot, statusIcon slot (sent/delivered/read),
 *     reactionsDisplay slot, chapterButton slot (footerExtras), per-message
 *     PlaybackSpeedControl slot.
 *   - Channel (TeamVoxMode): meeting-notes button slot, chapters button,
 *     mention-mark slot inside transcript.
 *   - Broadcast (PulseRadio): episode-number badge (already covered by
 *     episodeChip slot), broadcast-listener-count slot.
 *   - Notes (VoxNotesMode): tag-chip row slot, linked-items button slot
 *     in the footerExtras area.
 * The minimal additive expansion: `footerExtras`, `headerExtras`,
 * `selectionCheckbox`, `statusIndicator`, `reactionsDisplay`, and
 * `onReply`/`onReact` callbacks. Once added, migrate Direct first (smallest
 * surface), then verify visually before Channel/Broadcast/Notes.
 *
 * **Standardized chrome:**
 * - 36px play button. Rose-500 fill when status === 'needs-reply', neutral
 *   surface otherwise. Coral as state, not decoration.
 * - Deterministic peak-driven waveform. Pass `audioBuffer` for real peaks, or
 *   `waveformSeed` for a hash-derived stable pattern (no Math.random in render).
 * - 36px senderName-initial avatar with neutral background. No coral on
 *   avatars unless 'me'.
 * - <AIProvenanceChip> for transcript and analysis. Always.
 * - <MoreVertical> trigger for the action menu; surfaces wire onMore.
 *
 * **Surface slots (each surface fills 0-2):**
 * - leadingAudienceLabel — Triage row identity chip
 * - messageTypePill      — Channel message type
 * - episodeChip          — Broadcast episode number
 * - replyToContext       — Direct reply indicator
 * - audienceMeta         — Channel mentions / member count
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
  // Hooks
  onStar?: () => void;
  onBookmark?: () => void;
  onMore?: () => void;
  onTranscriptClick?: () => void;
  // Waveform data
  audioBuffer?: AudioBuffer;
  waveformSeed?: string;
  // Layout
  isDarkMode?: boolean;
  maxWidth?: string;
}

const WAVEFORM_BARS = 40;

function seedToHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicPeaks(seed: string, bars: number): number[] {
  let h = seedToHash(seed);
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    h = Math.imul(h, 1664525) + 1013904223;
    const t = (h >>> 0) / 0xffffffff;
    peaks.push(0.25 + 0.6 * t);
  }
  return peaks;
}

function bufferToPeaks(buffer: AudioBuffer, bars: number): number[] {
  const data = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(data.length / bars));
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    let sum = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, data.length);
    for (let j = start; j < end; j++) sum += Math.abs(data[j]);
    const avg = sum / (end - start || 1);
    peaks.push(Math.min(1, Math.max(0.1, avg * 3)));
  }
  return peaks;
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
  onStar,
  onBookmark,
  onMore,
  onTranscriptClick,
  audioBuffer,
  waveformSeed,
  isDarkMode: _isDarkMode = false,
  maxWidth = '75%',
}) => {
  const isMe = sender === 'me';
  const needsReply = status === 'needs-reply';

  const peaks = useMemo(() => {
    if (audioBuffer) return bufferToPeaks(audioBuffer, WAVEFORM_BARS);
    return deterministicPeaks(waveformSeed || id, WAVEFORM_BARS);
  }, [audioBuffer, waveformSeed, id]);

  const initial = (senderName || '?').charAt(0).toUpperCase();

  const bubbleClasses = isMe
    ? 'bg-rose-50 dark:bg-[rgba(244,63,94,0.08)] rounded-2xl rounded-br-md'
    : 'bg-white dark:bg-white/[0.03] rounded-2xl rounded-bl-md border border-zinc-200/60 dark:border-white/[0.06]';

  return (
    <div
      className={`flex flex-col gap-1.5 ${isMe ? 'items-end' : 'items-start'}`}
      style={{ maxWidth }}
    >
      {leadingAudienceLabel && <div className="px-2">{leadingAudienceLabel}</div>}

      <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} w-full`}>
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
          {/* Header line — name + surface chips */}
          <div className={`flex items-center gap-2 px-1 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
            <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {senderName}
            </span>
            {episodeChip}
            {messageTypePill}
            <span className="font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-500">
              {formatTimestamp(timestamp)}
            </span>
          </div>

          {/* Bubble */}
          <div className={`px-3 py-2.5 ${bubbleClasses} w-full`}>
            {replyToContext && <div className="mb-2">{replyToContext}</div>}

            <div className="flex items-center gap-3">
              {/* Play button — 36px, coral when needs-reply, neutral otherwise */}
              <button
                onClick={isPlaying ? onPause : onPlay}
                className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center transition-colors ${
                  needsReply
                    ? 'bg-rose-500 text-white hover:bg-rose-600'
                    : isMe
                    ? 'bg-rose-500 text-white hover:bg-rose-600'
                    : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/[0.1]'
                }`}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                type="button"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              {/* Waveform — deterministic peaks, no Math.random() */}
              <div className="flex-1 flex items-center gap-[2px] h-7 min-w-[80px]">
                {peaks.map((p, i) => (
                  <span
                    key={i}
                    className={`w-[3px] rounded-full ${
                      isMe ? 'bg-rose-400/60' : 'bg-zinc-400 dark:bg-zinc-500'
                    }`}
                    style={{ height: `${Math.max(15, p * 100)}%` }}
                  />
                ))}
              </div>

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

          {/* Action row — revealed on hover by parent; here always-present low-key */}
          <div className={`flex items-center gap-0.5 px-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'flex-row-reverse' : ''}`}>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelayVoiceMessage;
