import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Types
interface TimerSession {
  id: string;
  type: 'focus' | 'short_break' | 'long_break';
  duration: number; // seconds
  startedAt: Date;
  completedAt?: Date;
  interrupted: boolean;
  messagesBlocked: number;
}

interface PomodoroSettings {
  focusDuration: number; // minutes
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  blockNotifications: boolean;
  playSound: boolean;
  showProgressInTitle: boolean;
}

interface FocusStats {
  todaySessions: number;
  todayFocusTime: number; // minutes
  weekSessions: number;
  weekFocusTime: number;
  currentStreak: number;
  longestStreak: number;
  messagesBlockedToday: number;
}

interface FocusTimerProps {
  onTimerStart?: (type: TimerSession['type']) => void;
  onTimerComplete?: (session: TimerSession) => void;
  onTimerPause?: () => void;
  onSettingsChange?: (settings: PomodoroSettings) => void;
}

// Preset timer durations
const PRESETS = [
  { label: '25/5', focus: 25, shortBreak: 5, longBreak: 15 },
  { label: '50/10', focus: 50, shortBreak: 10, longBreak: 30 },
  { label: '90/20', focus: 90, shortBreak: 20, longBreak: 45 }
];

export const FocusTimer: React.FC<FocusTimerProps> = ({
  onTimerStart,
  onTimerComplete,
  onTimerPause,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<PomodoroSettings>({
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    autoStartFocus: false,
    blockNotifications: true,
    playSound: true,
    showProgressInTitle: true
  });

  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [currentType, setCurrentType] = useState<TimerSession['type']>('focus');
  const [timeRemaining, setTimeRemaining] = useState(settings.focusDuration * 60);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [messagesBlocked, setMessagesBlocked] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  const stats = useMemo((): FocusStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todaySessions = sessions.filter(s =>
      s.type === 'focus' && s.completedAt && new Date(s.startedAt) >= today && !s.interrupted
    );
    const weekSessions = sessions.filter(s =>
      s.type === 'focus' && s.completedAt && new Date(s.startedAt) >= weekAgo && !s.interrupted
    );

    return {
      todaySessions: todaySessions.length,
      todayFocusTime: Math.round(todaySessions.reduce((sum, s) => sum + s.duration, 0) / 60),
      weekSessions: weekSessions.length,
      weekFocusTime: Math.round(weekSessions.reduce((sum, s) => sum + s.duration, 0) / 60),
      currentStreak: completedSessions,
      longestStreak: Math.max(completedSessions, 8), // Mock longest streak
      messagesBlockedToday: messagesBlocked
    };
  }, [sessions, completedSessions, messagesBlocked]);

  const totalDuration = useMemo(() => {
    switch (currentType) {
      case 'focus': return settings.focusDuration * 60;
      case 'short_break': return settings.shortBreakDuration * 60;
      case 'long_break': return settings.longBreakDuration * 60;
    }
  }, [currentType, settings]);

  const progress = useMemo(() =>
    ((totalDuration - timeRemaining) / totalDuration) * 100,
    [totalDuration, timeRemaining]
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTypeColor = (type: TimerSession['type']): string => {
    switch (type) {
      case 'focus': return 'text-rose-500';
      case 'short_break': return 'text-green-500';
      case 'long_break': return 'text-blue-500';
    }
  };

  const getTypeBgColor = (type: TimerSession['type']): string => {
    switch (type) {
      case 'focus': return 'bg-rose-500';
      case 'short_break': return 'bg-green-500';
      case 'long_break': return 'bg-blue-500';
    }
  };

  const getTypeLabel = (type: TimerSession['type']): string => {
    switch (type) {
      case 'focus': return 'Focus Time';
      case 'short_break': return 'Short Break';
      case 'long_break': return 'Long Break';
    }
  };

  const startTimer = useCallback((type?: TimerSession['type']) => {
    const timerType = type || currentType;
    setCurrentType(timerType);
    setTimerState('running');
    sessionStartRef.current = new Date();

    const duration = type === 'focus'
      ? settings.focusDuration * 60
      : type === 'short_break'
        ? settings.shortBreakDuration * 60
        : type === 'long_break'
          ? settings.longBreakDuration * 60
          : timeRemaining;

    if (type) {
      setTimeRemaining(duration);
    }

    onTimerStart?.(timerType);
  }, [currentType, settings, timeRemaining, onTimerStart]);

  const pauseTimer = useCallback(() => {
    setTimerState('paused');
    onTimerPause?.();
  }, [onTimerPause]);

  const resetTimer = useCallback(() => {
    setTimerState('idle');
    setTimeRemaining(settings.focusDuration * 60);
    setCurrentType('focus');
    sessionStartRef.current = null;
  }, [settings.focusDuration]);

  const completeSession = useCallback(() => {
    if (!sessionStartRef.current) return;

    const session: TimerSession = {
      id: Date.now().toString(),
      type: currentType,
      duration: totalDuration,
      startedAt: sessionStartRef.current,
      completedAt: new Date(),
      interrupted: false,
      messagesBlocked: currentType === 'focus' ? Math.floor(Math.random() * 5) : 0
    };

    setSessions(prev => [...prev, session]);
    onTimerComplete?.(session);

    if (currentType === 'focus') {
      const newCompleted = completedSessions + 1;
      setCompletedSessions(newCompleted);
      setMessagesBlocked(prev => prev + session.messagesBlocked);

      // Determine next break type
      const nextType = newCompleted % settings.sessionsBeforeLongBreak === 0
        ? 'long_break'
        : 'short_break';

      setCurrentType(nextType);
      setTimeRemaining(nextType === 'long_break'
        ? settings.longBreakDuration * 60
        : settings.shortBreakDuration * 60
      );

      if (settings.autoStartBreaks) {
        startTimer(nextType);
      } else {
        setTimerState('idle');
      }
    } else {
      // Break completed, start focus
      setCurrentType('focus');
      setTimeRemaining(settings.focusDuration * 60);

      if (settings.autoStartFocus) {
        startTimer('focus');
      } else {
        setTimerState('idle');
      }
    }

    // Play completion sound
    if (settings.playSound) {
      // Would play sound here
    }
  }, [currentType, totalDuration, completedSessions, settings, onTimerComplete, startTimer]);

  // Timer tick effect
  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            completeSession();
            return 0;
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
  }, [timerState, completeSession]);

  // Update page title with timer
  useEffect(() => {
    if (settings.showProgressInTitle && timerState === 'running') {
      document.title = `${formatTime(timeRemaining)} - ${getTypeLabel(currentType)}`;
    }

    return () => {
      document.title = 'Pulse';
    };
  }, [timeRemaining, timerState, currentType, settings.showProgressInTitle]);

  const updateSetting = useCallback(<K extends keyof PomodoroSettings>(
    key: K,
    value: PomodoroSettings[K]
  ) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      onSettingsChange?.(updated);
      return updated;
    });
  }, [onSettingsChange]);

  const applyPreset = useCallback((preset: typeof PRESETS[0]) => {
    setSettings(prev => ({
      ...prev,
      focusDuration: preset.focus,
      shortBreakDuration: preset.shortBreak,
      longBreakDuration: preset.longBreak
    }));
    if (timerState === 'idle') {
      setTimeRemaining(preset.focus * 60);
    }
  }, [timerState]);

  return (
    <div className="space-y-4">
      {/* Timer Display */}
      <div className="bg-gradient-to-br from-rose-500/10 via-orange-500/10 to-amber-500/10 dark:from-rose-900/20 dark:via-orange-900/20 dark:to-amber-900/20 rounded-xl p-6 border border-rose-200 dark:border-rose-800 text-center">
        {/* Session Indicators */}
        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: settings.sessionsBeforeLongBreak }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition ${
                i < completedSessions % settings.sessionsBeforeLongBreak
                  ? 'bg-rose-500'
                  : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Timer Label */}
        <p className={`text-sm font-medium uppercase tracking-wide ${getTypeColor(currentType)}`}>
          {getTypeLabel(currentType)}
        </p>

        {/* Circular Progress */}
        <div className="relative w-48 h-48 mx-auto my-6">
          {/* Background Circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-zinc-200 dark:text-zinc-700"
            />
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 88}`}
              strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
              className={getTypeColor(currentType)}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>

          {/* Time Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-zinc-900 dark:text-white font-mono">
              {formatTime(timeRemaining)}
            </span>
            {timerState === 'running' && settings.blockNotifications && (
              <span className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                <i className="fa-solid fa-bell-slash" />
                Notifications blocked
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {timerState === 'idle' && (
            <button
              onClick={() => startTimer()}
              className={`px-6 py-3 rounded-xl font-medium text-white ${getTypeBgColor(currentType)} hover:opacity-90 transition shadow-lg`}
            >
              <i className="fa-solid fa-play mr-2" />
              Start {currentType === 'focus' ? 'Focus' : 'Break'}
            </button>
          )}

          {timerState === 'running' && (
            <>
              <button
                onClick={pauseTimer}
                className="px-6 py-3 rounded-xl font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition"
              >
                <i className="fa-solid fa-pause mr-2" />
                Pause
              </button>
              <button
                onClick={resetTimer}
                className="px-4 py-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <i className="fa-solid fa-rotate-left" />
              </button>
            </>
          )}

          {timerState === 'paused' && (
            <>
              <button
                onClick={() => startTimer()}
                className={`px-6 py-3 rounded-xl font-medium text-white ${getTypeBgColor(currentType)} hover:opacity-90 transition shadow-lg`}
              >
                <i className="fa-solid fa-play mr-2" />
                Resume
              </button>
              <button
                onClick={resetTimer}
                className="px-4 py-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <i className="fa-solid fa-rotate-left" />
              </button>
            </>
          )}
        </div>

        {/* Quick Session Buttons */}
        {timerState === 'idle' && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => startTimer('focus')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentType === 'focus'
                  ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              Focus
            </button>
            <button
              onClick={() => startTimer('short_break')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentType === 'short_break'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              Short Break
            </button>
            <button
              onClick={() => startTimer('long_break')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentType === 'long_break'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              Long Break
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <p className="text-xs text-zinc-500 mb-1">Today</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-zinc-900 dark:text-white">{stats.todaySessions}</span>
            <span className="text-xs text-zinc-500">sessions</span>
          </div>
          <p className="text-xs text-zinc-400">{stats.todayFocusTime} min focused</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <p className="text-xs text-zinc-500 mb-1">This Week</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-zinc-900 dark:text-white">{stats.weekSessions}</span>
            <span className="text-xs text-zinc-500">sessions</span>
          </div>
          <p className="text-xs text-zinc-400">{stats.weekFocusTime} min focused</p>
        </div>
      </div>

      {/* Settings Toggle */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="w-full flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-rose-300 dark:hover:border-rose-700 transition"
      >
        <span className="text-sm font-medium text-zinc-900 dark:text-white">
          <i className="fa-solid fa-gear mr-2 text-zinc-400" />
          Timer Settings
        </span>
        <i className={`fa-solid fa-chevron-${showSettings ? 'up' : 'down'} text-zinc-400`} />
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-4">
          {/* Presets */}
          <div>
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Quick Presets</p>
            <div className="flex gap-2">
              {PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                    settings.focusDuration === preset.focus
                      ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Sliders */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-500">Focus Duration</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{settings.focusDuration} min</span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={settings.focusDuration}
                onChange={(e) => {
                  updateSetting('focusDuration', Number(e.target.value));
                  if (timerState === 'idle' && currentType === 'focus') {
                    setTimeRemaining(Number(e.target.value) * 60);
                  }
                }}
                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-500">Short Break</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{settings.shortBreakDuration} min</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={settings.shortBreakDuration}
                onChange={(e) => updateSetting('shortBreakDuration', Number(e.target.value))}
                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-500">Long Break</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{settings.longBreakDuration} min</span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                value={settings.longBreakDuration}
                onChange={(e) => updateSetting('longBreakDuration', Number(e.target.value))}
                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          {/* Toggle Settings */}
          <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            {[
              { key: 'autoStartBreaks' as const, label: 'Auto-start breaks' },
              { key: 'autoStartFocus' as const, label: 'Auto-start focus after break' },
              { key: 'blockNotifications' as const, label: 'Block notifications during focus' },
              { key: 'playSound' as const, label: 'Play sound when complete' },
              { key: 'showProgressInTitle' as const, label: 'Show timer in page title' }
            ].map(setting => (
              <div key={setting.key} className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{setting.label}</span>
                <button
                  onClick={() => updateSetting(setting.key, !settings[setting.key])}
                  className={`w-10 h-5 rounded-full transition-colors ${settings[setting.key] ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[setting.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Compact Timer Widget
interface TimerWidgetProps {
  isRunning: boolean;
  timeRemaining: number;
  type: 'focus' | 'short_break' | 'long_break';
  onToggle: () => void;
}

export const TimerWidget: React.FC<TimerWidgetProps> = ({
  isRunning,
  timeRemaining,
  type,
  onToggle
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getColor = (): string => {
    switch (type) {
      case 'focus': return 'bg-rose-500 text-white';
      case 'short_break': return 'bg-green-500 text-white';
      case 'long_break': return 'bg-blue-500 text-white';
    }
  };

  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        isRunning ? getColor() : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
      }`}
    >
      <i className={`fa-solid ${isRunning ? 'fa-pause' : 'fa-play'}`} />
      <span className="font-mono">{formatTime(timeRemaining)}</span>
    </button>
  );
};
