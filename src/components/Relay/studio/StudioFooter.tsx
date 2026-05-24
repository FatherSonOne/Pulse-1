// Persistent player at the bottom of the Relay pane. Three states:
//   1. idle      — nothing playing, no recording. Renders a quiet hint row.
//   2. playing   — nowPlaying card with progress, playhead, scrub waveform,
//                  AI / bookmark / volume controls + 1.0× speed.
//   3. recording — red top border, RECORDING badge, mm:ss timer, animated
//                  red waveform, Cancel + Stop & send buttons.
//
// State source is RelayStudioContext — this component just renders what's
// there and dispatches actions back through the same context.

import React from 'react';
import { Play, Pause, Sparkles, Bookmark, Volume2 } from 'lucide-react';

import { useRelayStudio } from './RelayStudioContext';
import { Waveform } from './Waveform';

import './studio-footer.css';

/** "0:19" → 19 (seconds). Used for footer progress timestamp. */
function parseDur(d: string | undefined): number {
  if (!d) return 0;
  const [m, s] = d.split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
}

/** Format seconds back to "m:ss". */
function fmtTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export interface StudioFooterProps {
  /** Suppress the passive idle hint row. Source views that own an in-pane
   *  record block (Direct / Channel / Broadcast / Notes) pass this so the
   *  footer is a pure transport — it surfaces only while a voice is playing
   *  (or recording) and never shows a "hit space to record" hint redundant
   *  with the in-pane recorder. Inbox (no in-pane recorder) keeps the hint. */
  suppressIdle?: boolean;
}

export const StudioFooter: React.FC<StudioFooterProps> = ({ suppressIdle = false }) => {
  const {
    nowPlaying,
    isPlaying,
    progress,
    currentTime,
    duration,
    playbackRate,
    isRecording,
    recordingSec,
    togglePlay,
    seek,
    cyclePlaybackRate,
    cancelRecording,
    stopAndSendRecording,
  } = useRelayStudio();

  if (isRecording) {
    return <RecordingFooter sec={recordingSec} onCancel={cancelRecording} onStopAndSend={stopAndSendRecording} />;
  }

  if (!nowPlaying) {
    if (suppressIdle) return null;
    return (
      <div className="pulse-studio-footer pulse-studio-footer--idle">
        <span className="pulse-studio-footer__idle-dot" aria-hidden="true" />
        <span className="pulse-studio-footer__idle-text">
          Nothing playing — hit space to record, or pick a voice from the rail.
        </span>
      </div>
    );
  }

  // Prefer real audio metadata; fall back to the display dur string before
  // the element has loaded (or for voices with no real audio).
  const realDur = duration > 0 ? duration : parseDur(nowPlaying.dur);
  const cur     = fmtTime(Math.floor(currentTime || realDur * progress));
  const total   = duration > 0 ? fmtTime(Math.round(duration)) : nowPlaying.dur;
  const pct      = Math.round(progress * 100);

  // Scrub: translate a click x-position on the wave track to a 0→1 seek.
  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    seek((e.clientX - rect.left) / rect.width);
  };

  return (
    <div className="pulse-studio-footer pulse-studio-footer--playing">
      <button
        type="button"
        onClick={togglePlay}
        className="pulse-studio-footer__play"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </button>

      <div className="pulse-studio-footer__center">
        <div className="pulse-studio-footer__meta">
          <span className="pulse-studio-footer__sender">{nowPlaying.sender}</span>
          <span className="pulse-studio-footer__type">{nowPlaying.type.toUpperCase()}</span>
          {isPlaying && (
            <span className="pulse-studio-footer__playing-pill">
              <span className="pulse-dot-anim pulse-studio-footer__playing-dot" aria-hidden="true" />
              PLAYING
            </span>
          )}
          <span className="pulse-studio-footer__time">{cur} / {total}</span>
        </div>
        <div
          className="pulse-studio-footer__wave-wrap"
          onClick={handleScrub}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') seek(progress + 0.05);
            if (e.key === 'ArrowLeft') seek(progress - 0.05);
          }}
        >
          <span style={{ color: 'var(--pulse-rose)', display: 'block' }}>
            <Waveform seed={nowPlaying.id} height={22} count={120} progress={progress} />
          </span>
          <span
            className="pulse-studio-footer__playhead"
            style={{ left: `${pct}%`, opacity: isPlaying ? 1 : 0.5 }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="pulse-studio-footer__actions">
        <button type="button" onClick={cyclePlaybackRate} className="pulse-studio-footer__speed" aria-label={`Playback speed ${playbackRate}×, tap to change`}>{playbackRate}×</button>
        <button type="button" className="pulse-studio-footer__action pulse-studio-footer__action--ai" title="Pulse AI summary" aria-label="AI summary">
          <Sparkles className="w-4 h-4" />
        </button>
        <button type="button" className="pulse-studio-footer__action" title="Bookmark" aria-label="Bookmark">
          <Bookmark className="w-4 h-4" />
        </button>
        <button type="button" className="pulse-studio-footer__action" title="Volume" aria-label="Volume">
          <Volume2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface RecordingFooterProps {
  sec: number;
  onCancel: () => void;
  onStopAndSend: () => void;
}

const RecordingFooter: React.FC<RecordingFooterProps> = ({ sec, onCancel, onStopAndSend }) => (
  <div className="pulse-studio-footer pulse-studio-footer--recording" role="status" aria-live="polite">
    <div className="pulse-studio-footer__rec-badge">
      <span className="pulse-studio-footer__rec-dot pulse-dot-anim" aria-hidden="true" />
      <span>RECORDING</span>
    </div>

    <div className="pulse-studio-footer__rec-body">
      <span className="pulse-studio-footer__rec-time">{fmtTime(sec)}</span>
      <div className="pulse-studio-footer__rec-wave">
        {Array.from({ length: 60 }).map((_, i) => (
          <i
            key={i}
            className="pulse-wf-live-bar"
            style={{
              width: 2,
              height: `${30 + (Math.sin((i + sec) * 0.5) * 0.5 + 0.5) * 70}%`,
              background: '#ef4444',
              animationDelay: `${(i % 6) * 0.08}s`,
            }}
          />
        ))}
      </div>
    </div>

    <div className="pulse-studio-footer__rec-actions">
      <button type="button" onClick={onCancel} className="pulse-studio-footer__rec-cancel">
        Cancel
      </button>
      <button type="button" onClick={onStopAndSend} className="pulse-studio-footer__rec-stop">
        <Pause className="w-3.5 h-3.5" />
        Stop & send
      </button>
    </div>
  </div>
);

export default StudioFooter;
