import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

// Focus Mode Context State Interface
export interface FocusModeContextState {
  // Focus mode state
  isActive: boolean;
  threadId: string | null;
  timerDuration: number; // in seconds
  elapsedTime: number; // in seconds
  breaksDue: number;

  // Focus settings
  focusDigest: string | null;
  setFocusDigest: (digest: string | null) => void;

  // Actions
  startFocusMode: (threadId: string, duration?: number) => void;
  stopFocusMode: () => void;
  pauseFocusMode: () => void;
  resumeFocusMode: () => void;
  resetFocusMode: () => void;
  setTimerDuration: (duration: number) => void;

  // Timer state
  isPaused: boolean;
  isRunning: boolean;
  remainingTime: number;
  progress: number; // 0-100
}

const FocusModeContext = createContext<FocusModeContextState | undefined>(undefined);

export const useFocusMode = () => {
  const context = useContext(FocusModeContext);
  if (!context) {
    throw new Error('useFocusMode must be used within a FocusModeProvider');
  }
  return context;
};

interface FocusModeProviderProps {
  children: ReactNode;
}

export const FocusModeProvider: React.FC<FocusModeProviderProps> = ({ children }) => {
  // Focus mode state
  const [isActive, setIsActive] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [timerDuration, setTimerDuration] = useState(25 * 60); // 25 minutes default (Pomodoro)
  const [elapsedTime, setElapsedTime] = useState(0);
  const [breaksDue, setBreaksDue] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [focusDigest, setFocusDigest] = useState<string | null>(null);

  // Timer interval ref
  const timerRef = useRef<number | null>(null);

  // Calculated values
  const isRunning = isActive && !isPaused;
  const remainingTime = Math.max(0, timerDuration - elapsedTime);
  const progress = timerDuration > 0 ? (elapsedTime / timerDuration) * 100 : 0;

  // Start focus mode
  const startFocusMode = useCallback((focusThreadId: string, duration?: number) => {
    setIsActive(true);
    setThreadId(focusThreadId);
    setElapsedTime(0);
    setIsPaused(false);

    if (duration) {
      setTimerDuration(duration);
    }

    // Optionally save to localStorage for persistence
    localStorage.setItem('focusMode', JSON.stringify({
      isActive: true,
      threadId: focusThreadId,
      timerDuration: duration || timerDuration,
      startedAt: Date.now(),
    }));
  }, [timerDuration]);

  // Stop focus mode
  const stopFocusMode = useCallback(() => {
    setIsActive(false);
    setThreadId(null);
    setElapsedTime(0);
    setIsPaused(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Check if a break is due (after 4 focus sessions, take a longer break)
    if (progress >= 100) {
      setBreaksDue(prev => prev + 1);
    }

    localStorage.removeItem('focusMode');
  }, [progress]);

  // Pause focus mode
  const pauseFocusMode = useCallback(() => {
    setIsPaused(true);
  }, []);

  // Resume focus mode
  const resumeFocusMode = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Reset focus mode
  const resetFocusMode = useCallback(() => {
    setElapsedTime(0);
    setIsPaused(false);
  }, []);

  // Timer effect
  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;

          // Auto-stop when time is up
          if (newTime >= timerDuration) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }

            // Show notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Focus Session Complete!', {
                body: 'Great work! Time to take a break.',
                icon: '/pulse-logo.png',
              });
            }

            return timerDuration;
          }

          return newTime;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive, isPaused, timerDuration]);

  // Restore focus mode from localStorage on mount
  useEffect(() => {
    const savedFocusMode = localStorage.getItem('focusMode');
    if (savedFocusMode) {
      try {
        const data = JSON.parse(savedFocusMode);
        if (data.isActive && data.threadId) {
          const elapsed = Math.floor((Date.now() - data.startedAt) / 1000);
          if (elapsed < data.timerDuration) {
            setIsActive(true);
            setThreadId(data.threadId);
            setTimerDuration(data.timerDuration);
            setElapsedTime(elapsed);
          } else {
            // Session expired, clean up
            localStorage.removeItem('focusMode');
          }
        }
      } catch (error) {
        console.error('Failed to restore focus mode:', error);
        localStorage.removeItem('focusMode');
      }
    }
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const value: FocusModeContextState = {
    isActive,
    threadId,
    timerDuration,
    elapsedTime,
    breaksDue,
    focusDigest,
    setFocusDigest,
    startFocusMode,
    stopFocusMode,
    pauseFocusMode,
    resumeFocusMode,
    resetFocusMode,
    setTimerDuration,
    isPaused,
    isRunning,
    remainingTime,
    progress,
  };

  return <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>;
};
