/**
 * TranscriptBreathing — the visualization that replaced the orb.
 *
 * Vertical column of JetBrains Mono lines that breathe in coral. Older lines
 * fade by recency. The newest line modulates with audio level. At idle this
 * column is the session identity strip (model · voice · status).
 */

import React from 'react';

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

export interface RailLine {
  id: string;
  text: string;
  role: 'user' | 'assistant';
}

interface TranscriptBreathingProps {
  voiceState: VoiceState;
  audioLevel: number;
  isPaused: boolean;
  recentLines: RailLine[];
  modelLabel: string;
  sessionTimer?: string;
}

const MAX_LINES = 5;

const stateLabel = (s: VoiceState, paused: boolean): string => {
  if (paused) return 'PAUSED';
  switch (s) {
    case 'connecting': return 'CONNECTING';
    case 'listening':  return 'LISTENING';
    case 'thinking':   return 'THINKING';
    case 'speaking':   return 'SPEAKING';
    default:           return 'READY';
  }
};

const TranscriptBreathing: React.FC<TranscriptBreathingProps> = ({
  voiceState,
  audioLevel,
  isPaused,
  recentLines,
  modelLabel,
  sessionTimer,
}) => {
  const isActive =
    voiceState === 'listening' ||
    voiceState === 'thinking' ||
    voiceState === 'speaking';

  const lines = isActive ? recentLines.slice(-MAX_LINES) : [];
  const audioPulse = Math.min(1, Math.max(0, audioLevel) * 1.6);

  return (
    <aside
      className="pvc-rail"
      data-state={voiceState}
      data-paused={isPaused || undefined}
      style={{ ['--audio-pulse' as string]: audioPulse } as React.CSSProperties}
      aria-label="Pulse voice transcript"
    >
      <header className="pvc-rail-head">
        <span className="pvc-rail-id">PULSE · VOICE</span>
        <span className="pvc-rail-meta">{modelLabel}</span>
      </header>

      <div className="pvc-rail-divider" aria-hidden="true" />

      <div className="pvc-rail-state">
        <span className="pvc-rail-state-dot" aria-hidden="true" />
        <span className="pvc-rail-state-text">{stateLabel(voiceState, isPaused)}</span>
        {sessionTimer && (
          <span className="pvc-rail-state-timer" aria-label="Session length">
            {sessionTimer}
          </span>
        )}
      </div>

      <div className="pvc-rail-transcript" role="log" aria-live="polite">
        {isActive && lines.length > 0 ? (
          lines.map((line, i) => {
            const recency = lines.length === 1 ? 1 : i / (lines.length - 1);
            return (
              <p
                key={line.id}
                className={`pvc-rail-line pvc-rail-line--${line.role}`}
                style={{ ['--recency' as string]: recency.toFixed(3) } as React.CSSProperties}
              >
                {line.text}
              </p>
            );
          })
        ) : (
          <p className="pvc-rail-line pvc-rail-line--placeholder">
            {voiceState === 'idle'
              ? 'Press SPACE to begin.'
              : voiceState === 'connecting'
              ? 'Opening secure channel.'
              : 'Awaiting voice.'}
          </p>
        )}
      </div>
    </aside>
  );
};

export default TranscriptBreathing;
