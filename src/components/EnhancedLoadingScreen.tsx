// EnhancedLoadingScreen.tsx
// Beautiful animated loading screen for Pulse app beta launch
// Features: Pulsing waveform logo, circular progress ring, stage-based messaging

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useLoading } from '../contexts/LoadingContext';
import { PulseMark, PULSE_HEARTBEAT_PATH, PULSE_DISC_R } from './brand/PulseMark';

interface EnhancedLoadingScreenProps {
  currentStage?: string;
  currentStageLabel?: string;
  progress?: number;
  autoAnimate?: boolean; // If true, auto-animates from 0 to 100
  contained?: boolean; // If true, uses absolute positioning to fill parent container instead of fixed viewport
  inline?: boolean; // If true, uses h-full w-full flex layout (no fixed/absolute) — safest for section-level use
}

const getInitialDarkMode = () => {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark');
};

const EnhancedLoadingScreen: React.FC<EnhancedLoadingScreenProps> = ({
  currentStage: propStage,
  currentStageLabel: propLabel,
  progress: propProgress,
  autoAnimate = true, // Enable auto-animation by default
  contained = false,
  inline = false
}) => {
  // Use LoadingContext if props are not provided
  const loadingContext = useLoading();

  const currentStage = propStage ?? loadingContext.currentStage;
  const currentStageLabel = propLabel ?? loadingContext.currentStageLabel;
  const contextProgress = propProgress ?? loadingContext.progress;

  // Track current theme so the loading screen matches app appearance
  const [isDarkMode, setIsDarkMode] = useState<boolean>(getInitialDarkMode);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkMode(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Progress is driven entirely by a framer-motion MotionValue so the ring and
  // percentage update off the React render path — no per-frame setState. This
  // matters most during app boot, when this full-viewport overlay is up and the
  // main thread is busy resolving auth/workspace: the old 60fps setState here
  // re-rendered the whole screen every frame and stole paint time (hurting LCP).
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  const animatedProgress = useMotionValue(0);
  const strokeDashoffset = useTransform(
    animatedProgress,
    (v) => circumference - (v / 100) * circumference
  );
  const progressLabel = useTransform(animatedProgress, (v) => `${Math.round(v)}%`);

  useEffect(() => {
    // autoAnimate: fake a 0→100 climb over 8s. Otherwise track the real progress
    // from context/props. Either way the MotionValue animates without re-renders.
    const controls = animate(
      animatedProgress,
      autoAnimate ? 100 : contextProgress,
      autoAnimate
        ? { duration: 8, ease: [0.25, 0.1, 0.25, 1] }
        : { duration: 0.3, ease: 'easeOut' }
    );
    return () => controls.stop();
  }, [autoAnimate, contextProgress, animatedProgress]);

  // Theme-aware palette — keeps the rose/pink accent identical across modes,
  // swaps only surface, ring, text, and pill colors.
  const palette = isDarkMode
    ? {
        screenBg: 'bg-[#09090b]',
        logoPlateBg: 'bg-[#0f172a]',
        logoShadow:
          '0 25px 50px -12px rgba(244, 63, 94, 0.15), 0 0 40px rgba(236, 72, 153, 0.1)',
        ringTrack: '#27272a',
        stageText: 'text-[#a1a1aa]',
        pillBg: 'bg-[#18181b]',
        pillBorder: 'border-[#27272a]',
        pillSubtext: 'text-[#71717a]',
      }
    : {
        screenBg: 'bg-[#fafafa]',
        logoPlateBg: 'bg-white',
        logoShadow:
          '0 25px 50px -12px rgba(244, 63, 94, 0.20), 0 0 40px rgba(236, 72, 153, 0.18), 0 1px 2px rgba(15, 23, 42, 0.04)',
        ringTrack: '#e4e4e7',
        stageText: 'text-[#52525b]',
        pillBg: 'bg-white',
        pillBorder: 'border-[#e4e4e7]',
        pillSubtext: 'text-[#71717a]',
      };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`${inline ? 'h-full w-full' : contained ? 'absolute inset-0 z-50' : 'fixed inset-0 z-50'} flex items-center justify-center ${palette.screenBg}`}
      role="status"
      aria-live="polite"
      aria-label={`Loading: ${currentStageLabel}`}
    >
      <div className="flex flex-col items-center gap-8 px-4">
        {/* Logo Container with Progress Ring */}
        <div className="relative">
          {/* Circular Progress Ring */}
          <svg
            className="absolute inset-0 -rotate-90"
            width="140"
            height="140"
            viewBox="0 0 140 140"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>

            {/* Background ring */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={palette.ringTrack}
              strokeWidth="4"
            />

            {/* Progress ring with gradient */}
            <motion.circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="url(#progress-gradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              style={{ strokeDashoffset }}
            />
          </svg>

          {/* Logo — Globe·Solid heartbeat mark with a live ECG sweep.
              The looping motion is pure CSS (runs off the main thread) so it stays
              buttery even while the app is busy booting. prefers-reduced-motion
              users get the static mark + faint trace, no movement. */}
          <style>{`
            .pulse-glow-halo {
              position: absolute;
              inset: 0;
              margin: auto;
              width: 116px;
              height: 116px;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(244,63,94,0.40) 0%, rgba(236,72,153,0.14) 55%, transparent 72%);
              filter: blur(6px);
              opacity: 0.7;
            }
            .pulse-mark-beat {
              position: relative;
              width: 104px;
              height: 104px;
              filter: drop-shadow(0 8px 22px rgba(244,63,94,0.32));
              animation: pulse-enter 0.45s cubic-bezier(0.23,1,0.32,1) both;
            }
            .pulse-signal-sweep {
              filter: drop-shadow(0 0 4px rgba(251,113,133,0.9));
            }
            @keyframes pulse-enter {
              from { transform: scale(0.92); opacity: 0; }
              to   { transform: scale(1); opacity: 1; }
            }
            /* A real heartbeat is a double beat — lub (strong) then dub (softer). */
            @keyframes pulse-lubdub {
              0%   { transform: scale(1); }
              14%  { transform: scale(1.045); }
              34%  { transform: scale(1); }
              50%  { transform: scale(1.03); }
              100% { transform: scale(1); }
            }
            @keyframes pulse-lubdub-glow {
              0%   { transform: scale(1);    opacity: 0.55; }
              14%  { transform: scale(1.07); opacity: 0.90; }
              34%  { transform: scale(1);    opacity: 0.60; }
              50%  { transform: scale(1.05); opacity: 0.80; }
              100% { transform: scale(1);    opacity: 0.55; }
            }
            @keyframes pulse-sweep {
              from { stroke-dashoffset: 265; }
              to   { stroke-dashoffset: 0; }
            }
            @media (prefers-reduced-motion: no-preference) {
              .pulse-mark-beat {
                animation: pulse-enter 0.45s cubic-bezier(0.23,1,0.32,1) both,
                           pulse-lubdub 1.8s ease-in-out 0.45s infinite;
              }
              .pulse-glow-halo { animation: pulse-lubdub-glow 1.8s ease-in-out infinite; }
              .pulse-signal-sweep { animation: pulse-sweep 1.8s linear infinite; }
            }
            @media (prefers-reduced-motion: reduce) {
              .pulse-signal-sweep { display: none; }
            }
          `}</style>
          <div className="relative w-[140px] h-[140px] flex items-center justify-center">
            <div className="pulse-glow-halo" aria-hidden="true" />
            <div className="pulse-mark-beat">
              <PulseMark size={104} title="Pulse" />
              {/* ECG signal travelling through the heartbeat slit */}
              <svg
                viewBox="0 0 100 100"
                width={104}
                height={104}
                className="absolute inset-0"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="pulse-signal" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fb7185" />
                    <stop offset="100%" stopColor="#f472b6" />
                  </linearGradient>
                  <clipPath id="pulse-disc-clip">
                    <circle cx="50" cy="50" r={PULSE_DISC_R} />
                  </clipPath>
                </defs>
                <g clipPath="url(#pulse-disc-clip)">
                  {/* faint base trace so the slit reads as a live line */}
                  <path
                    d={PULSE_HEARTBEAT_PATH}
                    fill="none"
                    stroke="url(#pulse-signal)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.22"
                  />
                  {/* bright pulse sweeping left → right, once per heartbeat */}
                  <path
                    className="pulse-signal-sweep"
                    d={PULSE_HEARTBEAT_PATH}
                    fill="none"
                    stroke="url(#pulse-signal)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="15 250"
                  />
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* Progress Percentage */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div className="text-4xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
            {progressLabel}
          </motion.div>
        </motion.div>

        {/* Stage Message */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="text-center space-y-2"
          >
            <p className={`${palette.stageText} text-lg font-medium`}>
              {currentStageLabel}
            </p>

            {/* Loading dots animation */}
            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Beta Launch Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={`${inline ? '' : 'absolute bottom-12 left-0 right-0'} text-center`}
        >
          <div className={`inline-flex items-center gap-2 px-4 py-2 ${palette.pillBg} border ${palette.pillBorder} rounded-full`}>
            <span className="text-xs font-semibold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              BETA
            </span>
            <span className={`text-xs ${palette.pillSubtext}`}>
              Pulse v1.0
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default EnhancedLoadingScreen;
