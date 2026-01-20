/**
 * FocusTimer Component
 * Displays a circular progress timer with time remaining
 * Features: Progress ring animation, mode indicator, time display
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { focusModeService } from '../../services/focusModeService';

interface FocusTimerProps {
  mode: 'work' | 'break';
  timeRemaining: number; // seconds
  totalTime: number; // seconds
  isActive: boolean;
  isPaused: boolean;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  mode,
  timeRemaining,
  totalTime,
  isActive,
  isPaused,
}) => {
  // Calculate progress (0-1)
  const progress = useMemo(() => {
    if (totalTime === 0) return 0;
    return 1 - timeRemaining / totalTime;
  }, [timeRemaining, totalTime]);

  // SVG circle parameters
  const size = 280;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // Colors based on mode
  const colors = {
    work: {
      primary: '#3b82f6', // blue-500
      secondary: '#60a5fa', // blue-400
      bg: '#1e3a8a', // blue-900
      text: '#dbeafe', // blue-100
    },
    break: {
      primary: '#10b981', // green-500
      secondary: '#34d399', // green-400
      bg: '#065f46', // green-900
      text: '#d1fae5', // green-100
    },
  };

  const currentColors = colors[mode];

  // Format time display
  const timeDisplay = focusModeService.formatTime(timeRemaining);
  const [minutes, seconds] = timeDisplay.split(':');

  // Status text
  const statusText = isPaused
    ? 'Paused'
    : isActive
    ? mode === 'work'
      ? 'Focus Time'
      : 'Break Time'
    : 'Ready';

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Circular Progress Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background Circle */}
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
          />
          {/* Progress Circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={currentColors.primary}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </svg>

        {/* Center Content */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Mode Badge */}
          <motion.div
            className="px-3 py-1 rounded-full text-xs font-medium mb-2"
            style={{
              backgroundColor: currentColors.bg,
              color: currentColors.text,
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            key={mode}
          >
            {statusText}
          </motion.div>

          {/* Time Display */}
          <div className="flex items-baseline space-x-1">
            <span
              className="text-6xl font-bold tabular-nums"
              style={{ color: currentColors.primary }}
              aria-label={`${minutes} minutes ${seconds} seconds remaining`}
            >
              {minutes}
            </span>
            <span
              className="text-6xl font-bold"
              style={{ color: currentColors.primary }}
              aria-hidden="true"
            >
              :
            </span>
            <span
              className="text-6xl font-bold tabular-nums"
              style={{ color: currentColors.primary }}
            >
              {seconds}
            </span>
          </div>

          {/* Progress Percentage */}
          <div className="mt-2 text-sm text-gray-400">
            {Math.round(progress * 100)}% complete
          </div>

          {/* Pause Indicator */}
          {isPaused && (
            <motion.div
              className="mt-2 flex items-center space-x-2 text-yellow-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs font-medium">Paused</span>
            </motion.div>
          )}
        </div>

        {/* Animated Pulse Effect (only when active) */}
        {isActive && !isPaused && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: `2px solid ${currentColors.primary}`,
              opacity: 0.3,
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.1, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>

      {/* Mode Indicator Pills */}
      <div className="mt-6 flex items-center space-x-4">
        <div
          className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
            mode === 'work'
              ? 'bg-blue-900 text-blue-100 shadow-lg scale-110'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">Work</span>
        </div>

        <div
          className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
            mode === 'break'
              ? 'bg-green-900 text-green-100 shadow-lg scale-110'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">Break</span>
        </div>
      </div>

      {/* Accessibility: Screen reader only time announcement */}
      <div className="sr-only" role="timer" aria-live="off">
        {mode === 'work' ? 'Focus session' : 'Break time'}: {timeDisplay}{' '}
        remaining
      </div>
    </div>
  );
};

export default FocusTimer;
