/**
 * FocusControls Component
 * Control panel for focus mode with start/pause/skip/stop actions
 * Features: Control buttons, break counter, session stats
 */

import React from 'react';
import { motion } from 'framer-motion';

interface FocusControlsProps {
  mode: 'work' | 'break';
  isActive: boolean;
  isPaused: boolean;
  breakCount: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  onSettings?: () => void;
}

export const FocusControls: React.FC<FocusControlsProps> = ({
  mode,
  isActive,
  isPaused,
  breakCount,
  onStart,
  onPause,
  onResume,
  onSkip,
  onStop,
  onSettings,
}) => {
  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Primary Controls */}
      <div className="flex items-center space-x-4">
        {/* Start/Pause/Resume Button */}
        {!isActive ? (
          <motion.button
            onClick={onStart}
            className="flex items-center space-x-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold text-lg shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Start focus session"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
            <span>Start Focus</span>
          </motion.button>
        ) : isPaused ? (
          <motion.button
            onClick={onResume}
            className="flex items-center space-x-2 px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-full font-semibold text-lg shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Resume focus session"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
            <span>Resume</span>
          </motion.button>
        ) : (
          <motion.button
            onClick={onPause}
            className="flex items-center space-x-2 px-8 py-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full font-semibold text-lg shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-500 focus:ring-opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Pause focus session"
          >
            <svg
              className="w-6 h-6"
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
            <span>Pause</span>
          </motion.button>
        )}

        {/* Stop Button (only when active) */}
        {isActive && (
          <motion.button
            onClick={onStop}
            className="flex items-center space-x-2 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-semibold text-lg shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-red-500 focus:ring-opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            aria-label="Stop focus session"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                clipRule="evenodd"
              />
            </svg>
            <span>Stop</span>
          </motion.button>
        )}
      </div>

      {/* Secondary Controls */}
      {isActive && (
        <motion.div
          className="flex items-center space-x-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Skip Button */}
          <button
            onClick={onSkip}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
            aria-label={`Skip ${mode === 'work' ? 'to break' : 'break'}`}
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
            </svg>
            <span>Skip {mode === 'work' ? 'to Break' : 'Break'}</span>
          </button>
        </motion.div>
      )}

      {/* Break Counter */}
      {breakCount > 0 && (
        <motion.div
          className="flex items-center space-x-2 px-4 py-2 bg-gray-800 rounded-lg"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <svg
            className="w-5 h-5 text-green-400"
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
          <span className="text-sm font-medium text-gray-300">
            {breakCount} {breakCount === 1 ? 'break' : 'breaks'} completed
          </span>
        </motion.div>
      )}

      {/* Settings Button */}
      {onSettings && !isActive && (
        <motion.button
          onClick={onSettings}
          className="flex items-center space-x-2 px-4 py-2 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 rounded-lg"
          whileHover={{ scale: 1.05 }}
          aria-label="Focus mode settings"
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">Settings</span>
        </motion.button>
      )}

      {/* Keyboard Shortcut Hint */}
      <div className="text-xs text-gray-500 flex items-center space-x-2">
        <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-400">
          Shift
        </kbd>
        <span>+</span>
        <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-400">
          F
        </kbd>
        <span>to exit focus mode</span>
      </div>
    </div>
  );
};

export default FocusControls;
