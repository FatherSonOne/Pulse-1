/**
 * FocusTimer — Floating Pomodoro timer widget for War Room.
 *
 * Replaces the full-screen Focus Mode with a minimal, draggable widget
 * that sits in the corner of the canvas. Users can work + chat while
 * the timer runs.
 *
 * 25min work → 5min break → 25min work → ... → 15min long break (every 4th)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pause, Play, RotateCcw, SkipForward, Timer, X, Minimize2, Maximize2 } from 'lucide-react';

// ── Durations ──────────────────────────────────────────────────────────────────

const WORK_DURATION = 25 * 60;
const SHORT_BREAK = 5 * 60;
const LONG_BREAK = 15 * 60;

// ── Types ──────────────────────────────────────────────────────────────────────

type TimerMode = 'work' | 'break' | 'idle';

interface TimerState {
  mode: TimerMode;
  timeLeft: number;
  totalTime: number;
  isRunning: boolean;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface FocusTimerProps {
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const FocusTimer: React.FC<FocusTimerProps> = ({ onClose }) => {
  const [timer, setTimer] = useState<TimerState>({
    mode: 'idle',
    timeLeft: WORK_DURATION,
    totalTime: WORK_DURATION,
    isRunning: false,
  });
  const [sessions, setSessions] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Timer tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timer.isRunning) return;

    timerRef.current = setTimeout(() => {
      setTimer(prev => {
        if (prev.timeLeft <= 1) {
          // Timer completed
          if (prev.mode === 'work') {
            const newSessions = sessions + 1;
            setSessions(newSessions);
            const isLong = newSessions % 4 === 0;
            const breakTime = isLong ? LONG_BREAK : SHORT_BREAK;
            return { mode: 'break', timeLeft: breakTime, totalTime: breakTime, isRunning: true };
          } else {
            // Break completed → back to work (paused)
            return { mode: 'idle', timeLeft: WORK_DURATION, totalTime: WORK_DURATION, isRunning: false };
          }
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearTimeout(timerRef.current);
  }, [timer.isRunning, timer.timeLeft, sessions]);

  const start = useCallback(() => {
    setTimer(prev => ({
      ...prev,
      mode: prev.mode === 'idle' ? 'work' : prev.mode,
      isRunning: true,
    }));
  }, []);

  const pause = useCallback(() => {
    setTimer(prev => ({ ...prev, isRunning: false }));
  }, []);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    setTimer({ mode: 'idle', timeLeft: WORK_DURATION, totalTime: WORK_DURATION, isRunning: false });
  }, []);

  const skip = useCallback(() => {
    clearTimeout(timerRef.current);
    if (timer.mode === 'work') {
      setTimer({ mode: 'break', timeLeft: SHORT_BREAK, totalTime: SHORT_BREAK, isRunning: true });
    } else {
      setTimer({ mode: 'idle', timeLeft: WORK_DURATION, totalTime: WORK_DURATION, isRunning: false });
    }
  }, [timer.mode]);

  // ── Render ────────────────────────────────────────────────────────────────

  const minutes = Math.floor(timer.timeLeft / 60);
  const seconds = timer.timeLeft % 60;
  const progress = timer.totalTime > 0 ? (timer.totalTime - timer.timeLeft) / timer.totalTime : 0;

  const modeLabel = timer.mode === 'work' ? 'Focus' : timer.mode === 'break' ? 'Break' : 'Ready';
  const modeColor = timer.mode === 'work' ? '#f43f5e' : timer.mode === 'break' ? '#10b981' : 'var(--ps-text-muted)';

  // Ring SVG params
  const ringSize = minimized ? 32 : 56;
  const ringR = (ringSize / 2) - 3;
  const ringC = 2 * Math.PI * ringR;

  if (minimized) {
    return (
      <button
        className="ps-focus-timer-mini"
        onClick={() => setMinimized(false)}
        title={`${modeLabel} — ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
      >
        <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke="var(--ps-border)" strokeWidth={2.5} />
          <circle
            cx={ringSize/2} cy={ringSize/2} r={ringR}
            fill="none" stroke={modeColor} strokeWidth={2.5}
            strokeDasharray={ringC} strokeDashoffset={ringC * (1 - progress)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span className="ps-focus-timer-mini-time" style={{ color: modeColor }}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </button>
    );
  }

  return (
    <div className="ps-focus-timer">
      {/* Header */}
      <div className="ps-focus-timer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Timer size={13} style={{ color: modeColor }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: modeColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {modeLabel}
          </span>
          {sessions > 0 && (
            <span style={{ fontSize: 10, color: 'var(--ps-text-muted)', padding: '1px 5px', background: 'var(--ps-bg-surface)', borderRadius: 'var(--ps-radius-full)' }}>
              {sessions} done
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="ps-icon-btn" onClick={() => setMinimized(true)} title="Minimize" style={{ width: 24, height: 24 }}>
            <Minimize2 size={12} />
          </button>
          <button className="ps-icon-btn" onClick={onClose} title="Close timer" style={{ width: 24, height: 24 }}>
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Timer ring + display */}
      <div className="ps-focus-timer-body">
        <div style={{ position: 'relative', width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke="var(--ps-border)" strokeWidth={3} />
            <circle
              cx={ringSize/2} cy={ringSize/2} r={ringR}
              fill="none" stroke={modeColor} strokeWidth={3}
              strokeDasharray={ringC} strokeDashoffset={ringC * (1 - progress)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="ps-focus-timer-time">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="ps-focus-timer-controls">
        <button className="ps-icon-btn" onClick={reset} title="Reset" style={{ width: 28, height: 28 }}>
          <RotateCcw size={13} />
        </button>
        {timer.isRunning ? (
          <button className="ps-focus-timer-playpause" onClick={pause} title="Pause" style={{ background: modeColor }}>
            <Pause size={16} />
          </button>
        ) : (
          <button className="ps-focus-timer-playpause" onClick={start} title="Start" style={{ background: modeColor }}>
            <Play size={16} style={{ marginLeft: 2 }} />
          </button>
        )}
        <button className="ps-icon-btn" onClick={skip} title="Skip" style={{ width: 28, height: 28 }}>
          <SkipForward size={13} />
        </button>
      </div>
    </div>
  );
};

export default FocusTimer;
