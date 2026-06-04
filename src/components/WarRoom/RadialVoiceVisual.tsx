/**
 * RadialVoiceVisual — the War Room "Live" voice centerpiece.
 *
 * A ring of bars radiating from a center point, reacting to the realtime
 * agent's audio signal: idle breathes gently, listening ripples with the
 * caller's level, speaking flows as the agent talks. Presentational only —
 * it consumes the signal + control callbacks that RealtimeVoiceAgent already
 * exposes (one voice implementation, custom presentation).
 *
 * Coral is on-budget here: this IS an AI-output surface (CLAUDE.md §4).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, PhoneOff, Hand, Keyboard } from 'lucide-react';

export interface RadialVoiceVisualProps {
  audioLevel: number;          // 0..1
  isListening: boolean;
  isSpeaking: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  onConnect: () => void;
  onToggleMute: () => void;
  onInterrupt: () => void;
  onEnd: () => void;
  onTypeInstead: () => void;
}

const BAR_COUNT = 44;
const INNER_R = 46;   // ring inner radius
const MAX_LEN = 34;   // max bar length past the inner radius
const SIZE = (INNER_R + MAX_LEN + 8) * 2;

export const RadialVoiceVisual: React.FC<RadialVoiceVisualProps> = ({
  audioLevel,
  isListening,
  isSpeaking,
  isConnected,
  isConnecting,
  isMuted,
  onConnect,
  onToggleMute,
  onInterrupt,
  onEnd,
  onTypeInstead,
}) => {
  // Local animation phase so the ring lives even when audioLevel is static
  // (idle breathing + the agent's speaking flow). Smoothed level avoids jitter.
  const [phase, setPhase] = useState(0);
  const levelRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      // ease the displayed level toward the incoming audioLevel
      levelRef.current += (audioLevel - levelRef.current) * 0.25;
      setPhase((p) => p + 0.06);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [audioLevel]);

  const center = SIZE / 2;
  const level = levelRef.current;

  const stateColor = isSpeaking
    ? 'var(--pulse-coral-fg)'
    : isListening
    ? 'var(--pulse-rose)'
    : isConnected
    ? 'var(--pulse-rose)'
    : 'var(--pulse-ink-3)';

  const stateLabel = isConnecting
    ? 'Connecting…'
    : isSpeaking
    ? 'Speaking'
    : isListening
    ? 'Listening'
    : isConnected
    ? 'Ready — just talk'
    : 'Tap to start';

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const angle = (i / BAR_COUNT) * Math.PI * 2;
    // Per-state length: idle = gentle breath; listening = audio ripple;
    // speaking = travelling wave around the ring.
    let len: number;
    if (isSpeaking) {
      len = 0.30 + 0.5 * (0.5 + 0.5 * Math.sin(phase * 1.6 + i * 0.5)) + level * 0.5;
    } else if (isListening) {
      len = 0.14 + level * (0.7 + 0.3 * Math.sin(phase + i * 0.6));
    } else if (isConnected) {
      len = 0.12 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 0.7 + i * 0.4)); // breathe
    } else {
      len = 0.10;
    }
    len = Math.max(0.06, Math.min(1, len)) * MAX_LEN;
    const x1 = center + Math.cos(angle) * INNER_R;
    const y1 = center + Math.sin(angle) * INNER_R;
    const x2 = center + Math.cos(angle) * (INNER_R + len);
    const y2 = center + Math.sin(angle) * (INNER_R + len);
    return { x1, y1, x2, y2 };
  });

  // Center orb scales subtly with the eased level for a "breathing" core.
  const orbScale = 1 + (isConnected ? level * 0.18 + 0.02 * Math.sin(phase * 0.7) : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '8px 0 4px' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} aria-hidden style={{ overflow: 'visible' }}>
          {bars.map((b, i) => (
            <line
              key={i}
              x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
              stroke={stateColor}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={isConnected ? 0.9 : 0.45}
              style={{ transition: 'stroke 200ms var(--pulse-ease)' }}
            />
          ))}
        </svg>

        {/* Center orb / state */}
        <button
          onClick={!isConnected && !isConnecting ? onConnect : onToggleMute}
          title={!isConnected ? 'Start voice' : isMuted ? 'Unmute' : 'Mute'}
          aria-label={!isConnected ? 'Start voice' : isMuted ? 'Unmute' : 'Mute'}
          style={{
            position: 'absolute', inset: 0, margin: 'auto',
            width: INNER_R * 1.5, height: INNER_R * 1.5, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer',
            background: 'var(--pulse-coral-bg-12)', color: stateColor,
            transform: `scale(${orbScale})`,
            boxShadow: isConnected ? '0 0 0 1px var(--pulse-rose-soft)' : 'none',
          }}
        >
          {isConnecting ? <Loader2 size={26} className="animate-spin" /> : isMuted ? <MicOff size={26} /> : <Mic size={26} />}
        </button>
      </div>

      <div style={{ ...mono, color: stateColor }}>{stateLabel}</div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!isConnected ? (
          <button onClick={onConnect} disabled={isConnecting} className="war-room-btn-primary" style={ctaBtn}>
            <Mic size={15} /> {isConnecting ? 'Connecting…' : 'Start voice'}
          </button>
        ) : (
          <>
            <button onClick={onToggleMute} title={isMuted ? 'Unmute' : 'Mute'} aria-label={isMuted ? 'Unmute' : 'Mute'} style={iconBtn(isMuted)}>
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            {isSpeaking && (
              <button onClick={onInterrupt} title="Interrupt" aria-label="Interrupt" style={iconBtn(false)}>
                <Hand size={16} />
              </button>
            )}
            <button onClick={onEnd} title="End voice" aria-label="End voice" style={{ ...iconBtn(false), color: '#ef4444' }}>
              <PhoneOff size={16} />
            </button>
          </>
        )}
      </div>

      <button onClick={onTypeInstead} style={typeLink}>
        <Keyboard size={13} /> Type instead
      </button>
    </div>
  );
};

const mono: React.CSSProperties = {
  fontFamily: 'var(--pulse-font-mono)', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.12em', textTransform: 'uppercase',
};

const ctaBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '9px 16px', borderRadius: 10, fontSize: 14, fontWeight: 500,
};

const iconBtn = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
  border: '1px solid var(--pulse-border)',
  background: active ? 'var(--pulse-coral-bg-12)' : 'var(--pulse-surface-raised)',
  color: active ? 'var(--pulse-coral-fg)' : 'var(--pulse-ink-2)',
});

const typeLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--pulse-ink-3)', fontSize: 12,
};

export default RadialVoiceVisual;
