/**
 * DistractionBlockingOverlay Component
 * Semi-transparent overlay displayed during focus sessions
 * Features: Blocks sidebar and notifications, shows session info, emergency exit
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { focusModeService } from '../../services/focusModeService';

interface DistractionBlockingOverlayProps {
  isActive: boolean;
  mode: 'work' | 'break';
  timeRemaining: number; // seconds
  totalTime: number; // seconds
  breakCount: number;
  sessionGoal?: string;
  onEmergencyEnd: () => void;
  blockedNotifications?: number;
}

// Animation variants
const overlayVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 1, 1],
    },
  },
};

const infoCardVariants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      delay: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
    },
  },
};

const pulseAnimation = {
  scale: [1, 1.05, 1],
  opacity: [0.6, 0.8, 0.6],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

const breathingAnimation = {
  scale: [1, 1.02, 1],
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

export const DistractionBlockingOverlay: React.FC<DistractionBlockingOverlayProps> = ({
  isActive,
  mode,
  timeRemaining,
  totalTime,
  breakCount,
  sessionGoal,
  onEmergencyEnd,
  blockedNotifications = 0,
}) => {
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [confirmHold, setConfirmHold] = useState(0);
  const [holdInterval, setHoldInterval] = useState<NodeJS.Timeout | null>(null);

  // Progress calculation
  const progress = totalTime > 0 ? 1 - timeRemaining / totalTime : 0;
  const progressPercent = Math.round(progress * 100);

  // Format time
  const formattedTime = focusModeService.formatTime(timeRemaining);

  // Colors based on mode
  const modeColors = {
    work: {
      primary: 'from-blue-600/30 to-purple-600/30',
      accent: 'text-blue-400',
      accentBg: 'bg-blue-500',
      glow: 'shadow-blue-500/20',
      border: 'border-blue-500/30',
    },
    break: {
      primary: 'from-green-600/30 to-emerald-600/30',
      accent: 'text-green-400',
      accentBg: 'bg-green-500',
      glow: 'shadow-green-500/20',
      border: 'border-green-500/30',
    },
  };

  const colors = modeColors[mode];

  // Handle hold-to-confirm end
  const startHold = () => {
    setShowConfirmEnd(true);
    const interval = setInterval(() => {
      setConfirmHold((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          onEmergencyEnd();
          setShowConfirmEnd(false);
          return 0;
        }
        return prev + 5;
      });
    }, 50);
    setHoldInterval(interval);
  };

  const endHold = () => {
    if (holdInterval) {
      clearInterval(holdInterval);
      setHoldInterval(null);
    }
    setConfirmHold(0);
    setTimeout(() => setShowConfirmEnd(false), 300);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (holdInterval) {
        clearInterval(holdInterval);
      }
    };
  }, [holdInterval]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-40 pointer-events-none"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Gradient Overlay for Sidebar Area */}
          <motion.div
            className={`absolute left-0 top-0 bottom-0 w-80 bg-gradient-to-r ${colors.primary} to-transparent backdrop-blur-md`}
            style={{
              WebkitMaskImage: 'linear-gradient(to right, black 60%, transparent)',
              maskImage: 'linear-gradient(to right, black 60%, transparent)',
            }}
            animate={breathingAnimation}
          />

          {/* Ambient Glow Effects */}
          <motion.div
            className={`absolute -left-20 top-1/4 w-96 h-96 rounded-full ${colors.accentBg} opacity-10 blur-3xl`}
            animate={pulseAnimation}
          />
          <motion.div
            className={`absolute -left-10 bottom-1/4 w-64 h-64 rounded-full ${colors.accentBg} opacity-5 blur-2xl`}
            animate={{
              ...pulseAnimation,
              transition: { ...pulseAnimation.transition, delay: 1.5 },
            }}
          />

          {/* Session Info Card - Fixed Position */}
          <motion.div
            className={`fixed left-6 bottom-6 pointer-events-auto`}
            variants={infoCardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div
              className={`relative overflow-hidden rounded-2xl bg-gray-900/90 backdrop-blur-xl border ${colors.border} shadow-2xl ${colors.glow} w-72`}
            >
              {/* Subtle Animated Border */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <motion.div
                  className={`absolute inset-[-100%] ${colors.accentBg} opacity-20`}
                  style={{
                    background: `conic-gradient(from 0deg, transparent, ${mode === 'work' ? '#3b82f6' : '#10b981'}, transparent)`,
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />
              </div>

              <div className="relative p-5">
                {/* Mode Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${mode === 'work' ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
                    <motion.div
                      className={`w-2 h-2 rounded-full ${colors.accentBg}`}
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [1, 0.7, 1],
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className={`text-xs font-semibold uppercase tracking-wider ${colors.accent}`}>
                      {mode === 'work' ? 'Focus Time' : 'Break Time'}
                    </span>
                  </div>

                  {/* Blocked Notifications Badge */}
                  {blockedNotifications > 0 && (
                    <motion.div
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-800"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <span className="text-xs text-gray-400">{blockedNotifications}</span>
                    </motion.div>
                  )}
                </div>

                {/* Timer Display */}
                <div className="text-center mb-4">
                  <motion.div
                    className="text-4xl font-bold text-white font-mono tracking-tight"
                    key={formattedTime}
                    initial={{ opacity: 0.5, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {formattedTime}
                  </motion.div>
                  <p className="text-sm text-gray-400 mt-1">
                    {progressPercent}% complete
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden mb-4">
                  <motion.div
                    className={`absolute inset-y-0 left-0 ${colors.accentBg} rounded-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  <motion.div
                    className={`absolute inset-y-0 left-0 ${colors.accentBg} rounded-full blur-sm`}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>

                {/* Session Goal */}
                {sessionGoal && (
                  <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Session Goal</p>
                    <p className="text-sm text-gray-300 line-clamp-2">{sessionGoal}</p>
                  </div>
                )}

                {/* Break Count */}
                {breakCount > 0 && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {Array.from({ length: Math.min(breakCount, 4) }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-green-500"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                      />
                    ))}
                    {breakCount > 4 && (
                      <span className="text-xs text-gray-500">+{breakCount - 4}</span>
                    )}
                    <span className="text-xs text-gray-500 ml-1">
                      {breakCount === 1 ? 'break' : 'breaks'}
                    </span>
                  </div>
                )}

                {/* Emergency End Button */}
                <div className="relative">
                  <button
                    className="w-full py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-red-500/50 text-gray-400 hover:text-red-400 text-sm font-medium transition-all duration-200"
                    onMouseDown={startHold}
                    onMouseUp={endHold}
                    onMouseLeave={endHold}
                    onTouchStart={startHold}
                    onTouchEnd={endHold}
                  >
                    {showConfirmEnd ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Hold to end session...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        End Focus Session
                      </span>
                    )}
                  </button>

                  {/* Hold Progress */}
                  <AnimatePresence>
                    {showConfirmEnd && confirmHold > 0 && (
                      <motion.div
                        className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-red-500/30"
                          style={{ width: `${confirmHold}%` }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Keyboard Shortcut Hint */}
                <div className="mt-3 text-center">
                  <p className="text-xs text-gray-600">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono text-xs">Esc</kbd> to view full timer
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Top Notification Bar */}
          <motion.div
            className="fixed top-0 left-0 right-0 h-1 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={`h-full ${colors.accentBg}`} style={{ width: `${progressPercent}%` }} />
          </motion.div>

          {/* Subtle Pattern Overlay */}
          <div
            className="absolute inset-0 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DistractionBlockingOverlay;
