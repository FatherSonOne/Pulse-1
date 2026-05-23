/**
 * SessionCompletionCelebration — focus session "done" surface.
 *
 * PR 3.2 rewrite: dropped the kids-app reward register the critique
 * flagged as the most off-brand surface in Messages. Gone are:
 *  - 24×24 golden trophy with sparkle SVGs
 *  - 150-particle confetti canvas + success chord
 *  - A+/B/C/D letter grades with traffic-light tinting
 *  - Yellow/orange gradient blob decorations
 *  - "Day streak" banner with pulsing badge
 *
 * What's here now is a Linear-class outcome card: a mono ribbon
 * `SESSION · {N} MIN · COMPLETE` and a 2-stat row (duration,
 * messages deferred). One coral attractor — the Start Another CTA.
 * Close + View Stats sit as quiet ghosts. Canvas + tokens match the
 * rest of Pulse (`var(--pulse-canvas)`, `var(--pulse-border)`).
 *
 * Props are unchanged from the prior implementation so callers in
 * `Messages.tsx` and `FocusModePlugin` keep compiling — `streak`,
 * `breaksTaken`, `focusScore` are still accepted, just not rendered.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface SessionStats {
  duration: number; // minutes
  messagesBlocked: number;
  breaksTaken: number;
  focusScore: number; // 0-100 (no longer rendered, kept for API compat)
}

interface StreakInfo {
  currentStreak: number; // days (no longer rendered, kept for API compat)
  isNewRecord: boolean;
  longestStreak: number;
}

interface SessionCompletionCelebrationProps {
  isVisible: boolean;
  stats: SessionStats;
  streak: StreakInfo;
  onStartAnother: () => void;
  onClose: () => void;
  onViewStats: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const DURATION = 0.22;

// Animated counter — counts from 0 to value on mount. Plain text node
// because the entire card already shares a single fade-in transition.
const AnimatedCounter: React.FC<{ value: number; suffix?: string }> = ({
  value,
  suffix = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const total = 600;
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / total, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span>
      {displayValue}
      {suffix}
    </span>
  );
};

export const SessionCompletionCelebration: React.FC<
  SessionCompletionCelebrationProps
> = ({ isVisible, stats, onStartAnother, onClose, onViewStats }) => {
  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: isVisible,
    onEscape: onClose,
  });

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Focus session complete"
            className="relative w-full max-w-md rounded-2xl bg-[var(--pulse-canvas)] border border-[var(--pulse-border)] shadow-2xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: DURATION, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative p-7">
              {/* Dismiss */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-8 h-8 rounded-md inline-flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                aria-label="Close"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              {/* Mono ribbon — `SESSION · {N} MIN · COMPLETE`. The whole
                  emotional register lives in this one line of mono
                  typography. */}
              <div className="mb-7 pt-1">
                <p
                  className="font-mono uppercase tracking-[0.1em] text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-2 flex-wrap"
                  aria-live="polite"
                >
                  <span>SESSION</span>
                  <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                    <AnimatedCounter value={stats.duration} suffix=" MIN" />
                  </span>
                  <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-medium">COMPLETE</span>
                </p>
              </div>

              {/* 2-stat row — duration + messages deferred. Same mono
                  labels as the ribbon to keep one typographic voice. */}
              <div className="grid grid-cols-2 gap-6 mb-7">
                <div>
                  <p className="font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-500 dark:text-zinc-500 mb-1">
                    Duration
                  </p>
                  <p className="text-2xl font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                    <AnimatedCounter value={stats.duration} suffix="m" />
                  </p>
                </div>
                <div>
                  <p className="font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-500 dark:text-zinc-500 mb-1">
                    Deferred
                  </p>
                  <p className="text-2xl font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                    <AnimatedCounter value={stats.messagesBlocked} />
                  </p>
                </div>
              </div>

              {/* Actions — single coral CTA, two ghost buttons. The CTA
                  is the only attractor on this surface, which is the
                  point: come back, do another. */}
              <div className="space-y-2">
                <button
                  onClick={onStartAnother}
                  className="w-full py-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                >
                  Start Another Session
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onViewStats}
                    className="flex-1 py-2.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04] font-mono uppercase tracking-[0.1em] text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                  >
                    View Stats
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04] font-mono uppercase tracking-[0.1em] text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionCompletionCelebration;
