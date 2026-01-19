import React, { useState, useEffect, useCallback, useRef } from 'react';

interface PomodoroTimerProps {
  onSessionComplete?: (type: 'work' | 'break') => void;
  onTimerStart?: () => void;
  onTimerPause?: () => void;
  workDuration?: number; // minutes
  breakDuration?: number; // minutes
  className?: string;
  compact?: boolean;
}

type TimerState = 'idle' | 'work' | 'break' | 'paused';

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  onSessionComplete,
  onTimerStart,
  onTimerPause,
  workDuration = 25,
  breakDuration = 5,
  className = '',
  compact = false
}) => {
  const [state, setState] = useState<TimerState>('idle');
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [pausedState, setPausedState] = useState<'work' | 'break' | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const getProgress = (): number => {
    const totalSeconds = (state === 'break' || pausedState === 'break')
      ? breakDuration * 60
      : workDuration * 60;
    return ((totalSeconds - timeLeft) / totalSeconds) * 100;
  };

  // Play notification sound
  const playNotification = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleH4aaJbAw3dhNA5OofLxn1lABzGF6PWfblEJHHDR8rN9WxQXXb3rsIxoGBpNr+i2lXMeDkek5LuhgWgSIV+36byUfCgPJn3W7bl+ZhgOP8rpsotxJglJt+K7i3IdBz2p6bmIaxEKVrfksYViFg5Jt+i3h2UUC0ux5baDYBQPT7nptoRfEhJSwOO4g10QFVvI6bWCWgwVYMvotYBXChhl0+y2f1QIGmnX7rV8TgUdcdzwtXlIAyB44/SzdkMBInvl9bNzPv8jgOr5s28+/CSV7/yzaz3+Jpnx/rJpPf8pnfL+sGY6/yqd8v6vZTn/K570/q5kOP8sn/X+rWI3/y2g9v6sYDb/LaD2/qxgNv8toP');
      audioRef.current.volume = 0.5;
    }
    audioRef.current.play().catch(() => {});
  }, []);

  // Timer tick
  useEffect(() => {
    if (state === 'work' || state === 'break') {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer complete
            playNotification();

            if (state === 'work') {
              setSessionsCompleted((s) => s + 1);
              onSessionComplete?.('work');
              setState('break');
              return breakDuration * 60;
            } else {
              onSessionComplete?.('break');
              setState('idle');
              return workDuration * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state, workDuration, breakDuration, onSessionComplete, playNotification]);

  const startTimer = () => {
    if (pausedState) {
      setState(pausedState);
      setPausedState(null);
    } else {
      setState('work');
      setTimeLeft(workDuration * 60);
    }
    onTimerStart?.();
  };

  const pauseTimer = () => {
    setPausedState(state === 'work' ? 'work' : 'break');
    setState('paused');
    onTimerPause?.();
  };

  const resetTimer = () => {
    setState('idle');
    setTimeLeft(workDuration * 60);
    setPausedState(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const skipBreak = () => {
    if (state === 'break') {
      setState('idle');
      setTimeLeft(workDuration * 60);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`font-mono text-lg font-bold ${
          state === 'work' ? 'text-rose-500' :
          state === 'break' ? 'text-emerald-500' :
          'war-room-text-secondary'
        }`}>
          {formatTime(timeLeft)}
        </div>

        {state === 'idle' || state === 'paused' ? (
          <button
            onClick={startTimer}
            className="war-room-btn war-room-btn-primary war-room-btn-icon-sm"
            title="Start focus session"
          >
            <i className="fa fa-play text-xs"></i>
          </button>
        ) : (
          <button
            onClick={pauseTimer}
            className="war-room-btn war-room-btn-icon-sm"
            title="Pause"
          >
            <i className="fa fa-pause text-xs"></i>
          </button>
        )}

        {state !== 'idle' && (
          <button
            onClick={resetTimer}
            className="war-room-btn war-room-btn-icon-sm text-red-500"
            title="Reset"
          >
            <i className="fa fa-rotate-left text-xs"></i>
          </button>
        )}

        {sessionsCompleted > 0 && (
          <span className="war-room-badge text-xs">
            {sessionsCompleted}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`war-room-panel p-4 ${className}`}>
      {/* Timer Display */}
      <div className="text-center mb-4">
        <div className={`text-4xl font-mono font-bold mb-2 ${
          state === 'work' ? 'text-rose-500' :
          state === 'break' ? 'text-emerald-500' :
          'war-room-text-primary'
        }`}>
          {formatTime(timeLeft)}
        </div>

        <div className="text-sm war-room-text-secondary">
          {state === 'idle' && 'Ready to focus'}
          {state === 'work' && 'Focus time'}
          {state === 'break' && 'Take a break'}
          {state === 'paused' && 'Paused'}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="war-room-progress mb-4">
        <div
          className={`war-room-progress-bar transition-all duration-1000 ${
            state === 'break' ? 'bg-emerald-500' : ''
          }`}
          style={{ width: `${getProgress()}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        {state === 'idle' || state === 'paused' ? (
          <button
            onClick={startTimer}
            className="war-room-btn war-room-btn-primary px-6 py-2"
          >
            <i className="fa fa-play mr-2"></i>
            {pausedState ? 'Resume' : 'Start Focus'}
          </button>
        ) : (
          <>
            <button
              onClick={pauseTimer}
              className="war-room-btn px-4 py-2"
            >
              <i className="fa fa-pause mr-2"></i>
              Pause
            </button>

            {state === 'break' && (
              <button
                onClick={skipBreak}
                className="war-room-btn px-4 py-2"
              >
                <i className="fa fa-forward mr-2"></i>
                Skip Break
              </button>
            )}
          </>
        )}

        {state !== 'idle' && (
          <button
            onClick={resetTimer}
            className="war-room-btn war-room-btn-icon text-red-500"
            title="Reset timer"
          >
            <i className="fa fa-rotate-left"></i>
          </button>
        )}
      </div>

      {/* Session Counter */}
      {sessionsCompleted > 0 && (
        <div className="mt-4 text-center">
          <span className="war-room-badge">
            <i className="fa fa-fire mr-1"></i>
            {sessionsCompleted} session{sessionsCompleted !== 1 ? 's' : ''} completed
          </span>
        </div>
      )}

      {/* Settings */}
      {state === 'idle' && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-center gap-4 text-xs war-room-text-secondary">
            <div className="flex items-center gap-2">
              <i className="fa fa-brain"></i>
              <span>{workDuration}m work</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fa fa-coffee"></i>
              <span>{breakDuration}m break</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
