// EnhancedLoadingScreen.tsx
// Beautiful animated loading screen for Pulse app beta launch
// Features: Pulsing waveform logo, circular progress ring, stage-based messaging

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useLoading } from '../contexts/LoadingContext';

interface EnhancedLoadingScreenProps {
  currentStage?: string;
  currentStageLabel?: string;
  progress?: number;
  autoAnimate?: boolean; // If true, auto-animates from 0 to 100
  contained?: boolean; // If true, uses absolute positioning to fill parent container instead of fixed viewport
}

const EnhancedLoadingScreen: React.FC<EnhancedLoadingScreenProps> = ({
  currentStage: propStage,
  currentStageLabel: propLabel,
  progress: propProgress,
  autoAnimate = true, // Enable auto-animation by default
  contained = false
}) => {
  // Use LoadingContext if props are not provided
  const loadingContext = useLoading();

  const currentStage = propStage ?? loadingContext.currentStage;
  const currentStageLabel = propLabel ?? loadingContext.currentStageLabel;
  const contextProgress = propProgress ?? loadingContext.progress;

  // Animated progress value
  const animatedProgress = useMotionValue(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (autoAnimate) {
      // Auto-animate from 0 to 100 over 8 seconds with easing
      // This gives the appearance of loading progress
      const controls = animate(animatedProgress, 100, {
        duration: 8,
        ease: [0.25, 0.1, 0.25, 1], // Custom cubic bezier for realistic loading feel
        onUpdate: (latest) => setDisplayProgress(latest)
      });

      return () => controls.stop();
    } else {
      // Use the context or prop progress directly
      setDisplayProgress(contextProgress);
    }
  }, [autoAnimate, contextProgress, animatedProgress]);

  const progress = autoAnimate ? displayProgress : contextProgress;

  // Calculate stroke-dashoffset for progress ring
  // Circle circumference: 2 * PI * radius (radius = 58)
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`${contained ? 'absolute' : 'fixed'} inset-0 z-50 flex items-center justify-center bg-[#09090b]`}
      role="status"
      aria-live="polite"
      aria-label={`Loading: ${currentStageLabel} - ${Math.round(progress)}% complete`}
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
              stroke="#27272a"
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
              strokeDashoffset={strokeDashoffset}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{
                duration: 0.5,
                ease: "easeInOut"
              }}
            />
          </svg>

          {/* Logo Container */}
          <motion.div
            className="relative w-[140px] h-[140px] bg-[#0f172a] rounded-3xl flex items-center justify-center shadow-2xl"
            style={{
              boxShadow: '0 25px 50px -12px rgba(244, 63, 94, 0.15), 0 0 40px rgba(236, 72, 153, 0.1)'
            }}
          >
            {/* Pulsing Waveform Logo */}
            <motion.svg
              viewBox="0 0 64 64"
              className="w-20 h-20"
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.9, 1, 0.9]
              }}
              transition={{
                duration: 2,
                ease: "easeInOut",
                repeat: Infinity
              }}
              aria-label="Pulse logo"
            >
              <defs>
                <linearGradient id="pulse-grad-enhanced" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f43f5e">
                    <animate
                      attributeName="stop-color"
                      values="#f43f5e; #fb7185; #f43f5e"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </stop>
                  <stop offset="100%" stopColor="#ec4899">
                    <animate
                      attributeName="stop-color"
                      values="#ec4899; #f472b6; #ec4899"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </stop>
                </linearGradient>

                {/* Glow filter for the waveform */}
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Waveform path with glow */}
              <motion.path
                d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32"
                stroke="url(#pulse-grad-enhanced)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter="url(#glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: 1
                }}
                transition={{
                  pathLength: { duration: 1, ease: "easeInOut" },
                  opacity: { duration: 0.5 }
                }}
              />
            </motion.svg>
          </motion.div>
        </div>

        {/* Progress Percentage */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-4xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
            {Math.round(progress)}%
          </div>
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
            <p className="text-[#a1a1aa] text-lg font-medium">
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
          className="absolute bottom-12 left-0 right-0 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#18181b] border border-[#27272a] rounded-full">
            <span className="text-xs font-semibold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              BETA
            </span>
            <span className="text-xs text-[#71717a]">
              Pulse v1.0
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default EnhancedLoadingScreen;
