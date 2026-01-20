/**
 * FocusMode Component
 * Full-screen overlay that provides distraction-free environment
 * Features: Pomodoro timer, minimal UI, hide sidebar/threads, session tracking
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FocusTimer } from './FocusTimer';
import { FocusControls } from './FocusControls';
import {
  focusModeService,
  FocusPreferences,
  FocusTimerState,
} from '../../services/focusModeService';

interface FocusModeProps {
  isActive: boolean;
  threadId: string;
  threadName?: string;
  userId: string;
  onClose: () => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({
  isActive,
  threadId,
  threadName = 'Conversation',
  userId,
  onClose,
}) => {
  // Preferences
  const [preferences, setPreferences] = useState<FocusPreferences>(
    focusModeService.getPreferences()
  );

  // Timer state
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [timeRemaining, setTimeRemaining] = useState(
    preferences.workDuration * 60
  ); // seconds
  const [totalTime, setTotalTime] = useState(preferences.workDuration * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [breakCount, setBreakCount] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Session tracking
  const sessionStartTime = useRef<Date | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Load saved timer state on mount
  useEffect(() => {
    const savedState = focusModeService.loadTimerState();
    if (savedState && savedState.sessionId) {
      setMode(savedState.mode || 'work');
      setTimeRemaining(savedState.timeRemaining || preferences.workDuration * 60);
      setIsTimerActive(savedState.isActive || false);
      setIsPaused(savedState.isPaused || false);
      setBreakCount(savedState.breakCount || 0);
      setSessionId(savedState.sessionId);
      setTotalTime(
        savedState.mode === 'work'
          ? preferences.workDuration * 60
          : preferences.breakDuration * 60
      );
    }
  }, [preferences.workDuration, preferences.breakDuration]);

  // Save timer state periodically
  useEffect(() => {
    if (isTimerActive && sessionId) {
      focusModeService.saveTimerState({
        mode,
        timeRemaining,
        isActive: isTimerActive,
        isPaused,
        sessionId,
        breakCount,
      });
    }
  }, [mode, timeRemaining, isTimerActive, isPaused, sessionId, breakCount]);

  // Timer countdown effect
  useEffect(() => {
    if (isTimerActive && !isPaused) {
      timerInterval.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [isTimerActive, isPaused]);

  // Request notification permission on mount
  useEffect(() => {
    focusModeService.requestNotificationPermission();
  }, []);

  // Handle timer completion
  const handleTimerComplete = useCallback(() => {
    setIsTimerActive(false);

    if (mode === 'work') {
      // Work session completed - start break
      focusModeService.playNotificationSound('break');
      focusModeService.showNotification(
        'Focus Session Complete!',
        'Great work! Time for a break.',
        '/favicon.ico'
      );

      // Update break count
      const newBreakCount = breakCount + 1;
      setBreakCount(newBreakCount);

      if (sessionId) {
        focusModeService.updateBreakCount(sessionId, newBreakCount);
      }

      // Switch to break mode
      if (preferences.autoStartBreaks) {
        startBreak();
      } else {
        setMode('break');
        setTimeRemaining(preferences.breakDuration * 60);
        setTotalTime(preferences.breakDuration * 60);
      }
    } else {
      // Break completed - ready for work
      focusModeService.playNotificationSound('work');
      focusModeService.showNotification(
        'Break Complete!',
        'Ready to focus again?',
        '/favicon.ico'
      );

      if (preferences.autoStartWork) {
        startWork();
      } else {
        setMode('work');
        setTimeRemaining(preferences.workDuration * 60);
        setTotalTime(preferences.workDuration * 60);
      }
    }
  }, [
    mode,
    breakCount,
    sessionId,
    preferences.autoStartBreaks,
    preferences.autoStartWork,
    preferences.workDuration,
    preferences.breakDuration,
  ]);

  // Start work session
  const startWork = useCallback(async () => {
    setMode('work');
    setTimeRemaining(preferences.workDuration * 60);
    setTotalTime(preferences.workDuration * 60);
    setIsTimerActive(true);
    setIsPaused(false);
    sessionStartTime.current = new Date();

    // Create session in database
    const session = await focusModeService.startSession(
      userId,
      threadId,
      preferences.workDuration
    );

    if (session) {
      setSessionId(session.id);
    }
  }, [userId, threadId, preferences.workDuration]);

  // Start break
  const startBreak = useCallback(() => {
    setMode('break');
    setTimeRemaining(preferences.breakDuration * 60);
    setTotalTime(preferences.breakDuration * 60);
    setIsTimerActive(true);
    setIsPaused(false);
  }, [preferences.breakDuration]);

  // Handle start button
  const handleStart = useCallback(() => {
    startWork();
  }, [startWork]);

  // Handle pause
  const handlePause = useCallback(() => {
    setIsPaused(true);
  }, []);

  // Handle resume
  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Handle skip
  const handleSkip = useCallback(() => {
    if (mode === 'work') {
      // Skip to break
      setIsTimerActive(false);
      if (preferences.autoStartBreaks) {
        startBreak();
      } else {
        setMode('break');
        setTimeRemaining(preferences.breakDuration * 60);
        setTotalTime(preferences.breakDuration * 60);
      }
    } else {
      // Skip break
      setIsTimerActive(false);
      if (preferences.autoStartWork) {
        startWork();
      } else {
        setMode('work');
        setTimeRemaining(preferences.workDuration * 60);
        setTotalTime(preferences.workDuration * 60);
      }
    }
  }, [
    mode,
    preferences.autoStartBreaks,
    preferences.autoStartWork,
    preferences.workDuration,
    preferences.breakDuration,
    startBreak,
    startWork,
  ]);

  // Handle stop
  const handleStop = useCallback(async () => {
    setIsTimerActive(false);
    setIsPaused(false);

    // Calculate actual duration
    if (sessionId && sessionStartTime.current) {
      const actualDuration = Math.floor(
        (Date.now() - sessionStartTime.current.getTime()) / 60000
      );
      const completed = mode === 'work' && timeRemaining === 0;

      await focusModeService.endSession(sessionId, actualDuration, completed);

      if (completed) {
        focusModeService.playSuccessSound();
      }
    }

    // Clear state
    focusModeService.clearTimerState();
    setSessionId(null);
    setBreakCount(0);
    setMode('work');
    setTimeRemaining(preferences.workDuration * 60);
    setTotalTime(preferences.workDuration * 60);
  }, [sessionId, mode, timeRemaining, preferences.workDuration]);

  // Handle close (with confirmation if session active)
  const handleClose = useCallback(() => {
    if (isTimerActive) {
      const confirmed = window.confirm(
        'You have an active focus session. Are you sure you want to exit?'
      );
      if (!confirmed) return;

      // Stop the session
      handleStop();
    }

    onClose();
  }, [isTimerActive, handleStop, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift+F to exit focus mode
      if (e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handleClose();
      }
      // Space to pause/resume
      if (e.code === 'Space' && isTimerActive) {
        e.preventDefault();
        if (isPaused) {
          handleResume();
        } else {
          handlePause();
        }
      }
      // Escape to exit
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isActive,
    isTimerActive,
    isPaused,
    handleClose,
    handlePause,
    handleResume,
  ]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="focus-mode-title"
        >
          {/* Background Pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage:
                'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '40px 40px',
            }}
            aria-hidden="true"
          />

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 p-3 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-gray-600"
            aria-label="Exit focus mode"
          >
            <svg
              className="w-6 h-6"
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

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center space-y-8 px-8 max-w-4xl w-full">
            {/* Header */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1
                id="focus-mode-title"
                className="text-3xl font-bold text-white mb-2"
              >
                Focus Mode
              </h1>
              <p className="text-gray-400 text-lg">{threadName}</p>
            </motion.div>

            {/* Timer */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <FocusTimer
                mode={mode}
                timeRemaining={timeRemaining}
                totalTime={totalTime}
                isActive={isTimerActive}
                isPaused={isPaused}
              />
            </motion.div>

            {/* Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <FocusControls
                mode={mode}
                isActive={isTimerActive}
                isPaused={isPaused}
                breakCount={breakCount}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onSkip={handleSkip}
                onStop={handleStop}
                onSettings={
                  !isTimerActive ? () => setShowSettings(true) : undefined
                }
              />
            </motion.div>

            {/* Tips */}
            {!isTimerActive && (
              <motion.div
                className="text-center text-sm text-gray-500 max-w-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <p>
                  Focus mode helps you concentrate by hiding distractions and
                  using the Pomodoro technique. Work for{' '}
                  {preferences.workDuration} minutes, then take a{' '}
                  {preferences.breakDuration}-minute break.
                </p>
              </motion.div>
            )}
          </div>

          {/* Settings Modal */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSettings(false)}
              >
                <motion.div
                  className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-xl font-bold text-white mb-4">
                    Focus Settings
                  </h2>

                  <div className="space-y-4">
                    {/* Work Duration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Work Duration (minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={preferences.workDuration}
                        onChange={(e) => {
                          const newPrefs = {
                            ...preferences,
                            workDuration: parseInt(e.target.value) || 25,
                          };
                          setPreferences(newPrefs);
                          focusModeService.savePreferences(newPrefs);
                        }}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Break Duration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Break Duration (minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={preferences.breakDuration}
                        onChange={(e) => {
                          const newPrefs = {
                            ...preferences,
                            breakDuration: parseInt(e.target.value) || 5,
                          };
                          setPreferences(newPrefs);
                          focusModeService.savePreferences(newPrefs);
                        }}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Sound Enabled */}
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-300">
                        Sound Notifications
                      </label>
                      <button
                        onClick={() => {
                          const newPrefs = {
                            ...preferences,
                            soundEnabled: !preferences.soundEnabled,
                          };
                          setPreferences(newPrefs);
                          focusModeService.savePreferences(newPrefs);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          preferences.soundEnabled
                            ? 'bg-blue-600'
                            : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            preferences.soundEnabled
                              ? 'translate-x-6'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Auto-start */}
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-300">
                        Auto-start Breaks
                      </label>
                      <button
                        onClick={() => {
                          const newPrefs = {
                            ...preferences,
                            autoStartBreaks: !preferences.autoStartBreaks,
                          };
                          setPreferences(newPrefs);
                          focusModeService.savePreferences(newPrefs);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          preferences.autoStartBreaks
                            ? 'bg-blue-600'
                            : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            preferences.autoStartBreaks
                              ? 'translate-x-6'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowSettings(false)}
                    className="mt-6 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Done
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FocusMode;
