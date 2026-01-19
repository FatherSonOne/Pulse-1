/**
 * Focus Mode Redesigned - Deep Focus Chamber
 *
 * An immersive, distraction-free interface for deep work.
 * Features: Focus rings, breathing animations, progress tracking, zen mode
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { MarkdownRenderer } from '../../shared/MarkdownRenderer';
import './FocusModeRedesigned.css';

// ============= TYPES =============

interface FocusModeRedesignedProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
  isSpeaking?: boolean;
  voiceEnabled?: boolean;
  voiceMode?: 'push-to-talk' | 'always-on' | 'wake-word';
  onToggleVoiceEnabled?: (enabled: boolean) => void;
  onChangeVoiceMode?: (mode: 'push-to-talk' | 'always-on' | 'wake-word') => void;
  onListeningChange?: (isListening: boolean) => void;
}

interface TimerState {
  mode: 'work' | 'break' | 'idle';
  timeLeft: number;
  totalTime: number;
  isRunning: boolean;
}

// ============= CONSTANTS =============

const WORK_DURATION = 25 * 60; // 25 minutes
const SHORT_BREAK = 5 * 60;   // 5 minutes
const LONG_BREAK = 15 * 60;   // 15 minutes

const FOCUS_PROMPTS = [
  "What's your main objective right now?",
  "What single thing would make today successful?",
  "What are you trying to accomplish?",
  "What needs your attention most?",
  "What's the next important step?",
];

// ============= SUBCOMPONENTS =============

// Breathing Focus Ring
const FocusRing: React.FC<{
  isActive: boolean;
  progress: number;
  mode: 'work' | 'break' | 'idle';
}> = ({ isActive, progress, mode }) => {
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference * (1 - progress);

  const colors = {
    work: { primary: '#8b5cf6', secondary: '#6366f1' },
    break: { primary: '#10b981', secondary: '#14b8a6' },
    idle: { primary: '#6366f1', secondary: '#8b5cf6' },
  };

  return (
    <div className="fm-focus-ring">
      <svg viewBox="0 0 260 260" className="fm-ring-svg">
        {/* Background ring */}
        <circle
          cx="130"
          cy="130"
          r="120"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="fm-ring-bg"
        />
        {/* Progress ring */}
        <circle
          cx="130"
          cy="130"
          r="120"
          fill="none"
          stroke={`url(#focusGradient-${mode})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="fm-ring-progress"
          transform="rotate(-90 130 130)"
        />
        {/* Breathing pulse rings */}
        {isActive && (
          <>
            <circle
              cx="130"
              cy="130"
              r="100"
              fill="none"
              stroke={colors[mode].primary}
              strokeWidth="1"
              className="fm-pulse-ring"
              opacity="0.3"
            />
            <circle
              cx="130"
              cy="130"
              r="80"
              fill="none"
              stroke={colors[mode].secondary}
              strokeWidth="1"
              className="fm-pulse-ring delay-1"
              opacity="0.2"
            />
          </>
        )}
        <defs>
          <linearGradient id={`focusGradient-${mode}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors[mode].primary} />
            <stop offset="100%" stopColor={colors[mode].secondary} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

// Timer Display
const TimerDisplay: React.FC<{
  timer: TimerState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
  sessionsCompleted: number;
}> = ({ timer, onStart, onPause, onReset, onSkip, sessionsCompleted }) => {
  const minutes = Math.floor(timer.timeLeft / 60);
  const seconds = timer.timeLeft % 60;

  const modeLabels = {
    work: 'DEEP FOCUS',
    break: 'RECHARGE',
    idle: 'READY',
  };

  return (
    <div className="fm-timer">
      <div className="fm-timer-mode">{modeLabels[timer.mode]}</div>
      <div className="fm-timer-display">
        <span className="fm-timer-digits">{String(minutes).padStart(2, '0')}</span>
        <span className="fm-timer-colon">:</span>
        <span className="fm-timer-digits">{String(seconds).padStart(2, '0')}</span>
      </div>
      <div className="fm-timer-controls">
        {!timer.isRunning ? (
          <button onClick={onStart} className="fm-timer-btn fm-timer-btn-primary">
            <i className="fa fa-play" />
            <span>Start</span>
          </button>
        ) : (
          <button onClick={onPause} className="fm-timer-btn">
            <i className="fa fa-pause" />
            <span>Pause</span>
          </button>
        )}
        <button onClick={onReset} className="fm-timer-btn">
          <i className="fa fa-redo" />
        </button>
        {timer.mode !== 'idle' && (
          <button onClick={onSkip} className="fm-timer-btn">
            <i className="fa fa-forward" />
          </button>
        )}
      </div>
      {sessionsCompleted > 0 && (
        <div className="fm-sessions-badge">
          <i className="fa fa-fire" />
          <span>{sessionsCompleted} session{sessionsCompleted !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
};

// Topic Lock Input
const TopicInput: React.FC<{
  topic: string;
  isLocked: boolean;
  onTopicChange: (topic: string) => void;
  onLock: () => void;
  onUnlock: () => void;
}> = ({ topic, isLocked, onTopicChange, onLock, onUnlock }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`fm-topic ${isLocked ? 'locked' : ''}`}>
      {isLocked ? (
        <div className="fm-topic-locked">
          <div className="fm-topic-icon">
            <i className="fa fa-crosshairs" />
          </div>
          <span className="fm-topic-text">{topic}</span>
          <button onClick={onUnlock} className="fm-topic-unlock">
            <i className="fa fa-lock" />
          </button>
        </div>
      ) : (
        <div className="fm-topic-input-wrapper">
          <i className="fa fa-bullseye fm-topic-input-icon" />
          <input
            ref={inputRef}
            type="text"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="Set your focus topic..."
            className="fm-topic-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && topic.trim()) {
                onLock();
              }
            }}
          />
          {topic.trim() && (
            <button onClick={onLock} className="fm-topic-lock-btn">
              <i className="fa fa-lock" />
              <span>Lock</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Response Card
const ResponseCard: React.FC<{
  message: AIMessage;
  isZenMode: boolean;
}> = ({ message, isZenMode }) => (
  <div className={`fm-response ${isZenMode ? 'zen' : ''}`}>
    <div className="fm-response-content">
      <MarkdownRenderer
        content={message.content}
        className="fm-response-text"
      />
    </div>
    {message.citations && message.citations.length > 0 && (
      <div className="fm-response-citations">
        {message.citations.map((cite: any, i: number) => (
          <span key={i} className="fm-citation">
            <i className="fa fa-bookmark" />
            {typeof cite === 'string' ? cite : cite.title}
          </span>
        ))}
      </div>
    )}
  </div>
);

// Thinking State
const ThinkingState: React.FC = () => (
  <div className="fm-thinking">
    <div className="fm-thinking-orb">
      <div className="fm-thinking-pulse" />
      <i className="fa fa-brain" />
    </div>
    <span>Processing...</span>
  </div>
);

// Message History
const MessageHistory: React.FC<{
  messages: AIMessage[];
  isZenMode: boolean;
}> = ({ messages, isZenMode }) => {
  if (messages.length === 0 || isZenMode) return null;

  return (
    <div className="fm-history">
      <div className="fm-history-header">
        <i className="fa fa-clock-rotate-left" />
        <span>Recent</span>
      </div>
      <div className="fm-history-list">
        {messages.slice(-4).map((msg, idx) => (
          <div key={idx} className={`fm-history-item fm-history-${msg.role}`}>
            <div className="fm-history-avatar">
              <i className={`fa fa-${msg.role === 'user' ? 'user' : 'robot'}`} />
            </div>
            <div className="fm-history-content">
              {msg.content.slice(0, 120)}{msg.content.length > 120 ? '...' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============= MAIN COMPONENT =============

export const FocusModeRedesigned: React.FC<FocusModeRedesignedProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Focus Session',
  documents = [],
  isSpeaking = false,
  voiceEnabled = false,
  voiceMode = 'push-to-talk',
  onToggleVoiceEnabled,
  onChangeVoiceMode,
  onListeningChange,
}) => {
  // State
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState('');
  const [isTopicLocked, setIsTopicLocked] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [timer, setTimer] = useState<TimerState>({
    mode: 'idle',
    timeLeft: WORK_DURATION,
    totalTime: WORK_DURATION,
    isRunning: false,
  });
  const [showHistory, setShowHistory] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Random focus prompt
  const focusPrompt = useMemo(() =>
    FOCUS_PROMPTS[Math.floor(Math.random() * FOCUS_PROMPTS.length)],
    []
  );

  // Last assistant message
  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  // Timer progress
  const timerProgress = timer.totalTime > 0
    ? (timer.totalTime - timer.timeLeft) / timer.totalTime
    : 0;

  // Timer logic
  useEffect(() => {
    if (timer.isRunning && timer.timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimer(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
    } else if (timer.isRunning && timer.timeLeft === 0) {
      // Timer completed
      if (timer.mode === 'work') {
        setSessionsCompleted(s => s + 1);
        const isLongBreak = (sessionsCompleted + 1) % 4 === 0;
        setTimer({
          mode: 'break',
          timeLeft: isLongBreak ? LONG_BREAK : SHORT_BREAK,
          totalTime: isLongBreak ? LONG_BREAK : SHORT_BREAK,
          isRunning: true,
        });
      } else if (timer.mode === 'break') {
        setTimer({
          mode: 'work',
          timeLeft: WORK_DURATION,
          totalTime: WORK_DURATION,
          isRunning: false,
        });
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timer.isRunning, timer.timeLeft, timer.mode, sessionsCompleted]);

  // Timer controls
  const handleStartTimer = useCallback(() => {
    if (timer.mode === 'idle') {
      setTimer({
        mode: 'work',
        timeLeft: WORK_DURATION,
        totalTime: WORK_DURATION,
        isRunning: true,
      });
    } else {
      setTimer(prev => ({ ...prev, isRunning: true }));
    }
  }, [timer.mode]);

  const handlePauseTimer = useCallback(() => {
    setTimer(prev => ({ ...prev, isRunning: false }));
  }, []);

  const handleResetTimer = useCallback(() => {
    setTimer({
      mode: 'idle',
      timeLeft: WORK_DURATION,
      totalTime: WORK_DURATION,
      isRunning: false,
    });
  }, []);

  const handleSkipTimer = useCallback(() => {
    if (timer.mode === 'work') {
      setTimer({
        mode: 'break',
        timeLeft: SHORT_BREAK,
        totalTime: SHORT_BREAK,
        isRunning: true,
      });
    } else {
      setTimer({
        mode: 'work',
        timeLeft: WORK_DURATION,
        totalTime: WORK_DURATION,
        isRunning: false,
      });
    }
  }, [timer.mode]);

  // Send message
  const handleSend = useCallback(() => {
    const message = input.trim();
    if (!message || isLoading) return;
    onSendMessage(message);
    setInput('');
  }, [input, isLoading, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Topic lock
  const handleLockTopic = useCallback(() => {
    if (topic.trim()) {
      setIsTopicLocked(true);
    }
  }, [topic]);

  const handleUnlockTopic = useCallback(() => {
    setIsTopicLocked(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Escape to toggle zen mode
      if (e.key === 'Escape') {
        setIsZenMode(prev => !prev);
      }
      // Space to toggle timer (when not focused on input)
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        if (timer.isRunning) {
          handlePauseTimer();
        } else {
          handleStartTimer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [timer.isRunning, handleStartTimer, handlePauseTimer]);

  return (
    <div className={`fm-container ${isZenMode ? 'zen' : ''} ${timer.mode}`}>
      {/* Ambient Background */}
      <div className="fm-ambient">
        <div className="fm-gradient-orb fm-orb-1" />
        <div className="fm-gradient-orb fm-orb-2" />
        <div className="fm-noise-overlay" />
      </div>

      {/* Header - Hidden in Zen Mode */}
      {!isZenMode && (
        <header className="fm-header">
          <div className="fm-header-left">
            <TopicInput
              topic={topic}
              isLocked={isTopicLocked}
              onTopicChange={setTopic}
              onLock={handleLockTopic}
              onUnlock={handleUnlockTopic}
            />
          </div>

          <div className="fm-header-right">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`fm-header-btn ${showHistory ? 'active' : ''}`}
              title="Toggle History"
            >
              <i className="fa fa-clock-rotate-left" />
            </button>
            <button
              onClick={() => setIsZenMode(true)}
              className="fm-header-btn"
              title="Zen Mode (Esc)"
            >
              <i className="fa fa-moon" />
            </button>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="fm-main">
        {/* Focus Ring with Timer */}
        <div className="fm-focus-center">
          <FocusRing
            isActive={timer.isRunning}
            progress={timerProgress}
            mode={timer.mode}
          />
          <div className="fm-center-content">
            <TimerDisplay
              timer={timer}
              onStart={handleStartTimer}
              onPause={handlePauseTimer}
              onReset={handleResetTimer}
              onSkip={handleSkipTimer}
              sessionsCompleted={sessionsCompleted}
            />
          </div>
        </div>

        {/* Response Area */}
        <div className="fm-response-area">
          {isLoading ? (
            <ThinkingState />
          ) : lastAssistant ? (
            <ResponseCard message={lastAssistant} isZenMode={isZenMode} />
          ) : (
            <div className="fm-empty">
              <p className="fm-empty-prompt">{focusPrompt}</p>
            </div>
          )}
        </div>

        {/* Message History Panel */}
        {showHistory && !isZenMode && (
          <MessageHistory messages={messages} isZenMode={isZenMode} />
        )}
      </main>

      {/* Input Area */}
      <footer className={`fm-footer ${isZenMode ? 'zen' : ''}`}>
        <div className="fm-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isTopicLocked ? `Ask about ${topic}...` : "What's on your mind?"}
            className="fm-input"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="fm-send-btn"
          >
            <i className="fa fa-arrow-up" />
          </button>
        </div>

        {/* Zen Mode Exit */}
        {isZenMode && (
          <button
            onClick={() => setIsZenMode(false)}
            className="fm-zen-exit"
          >
            <i className="fa fa-sun" />
            <span>Exit Zen Mode</span>
          </button>
        )}

        {/* Keyboard Hints */}
        {!isZenMode && (
          <div className="fm-hints">
            <span><kbd>Enter</kbd> Send</span>
            <span><kbd>Space</kbd> Timer</span>
            <span><kbd>Esc</kbd> Zen</span>
          </div>
        )}
      </footer>
    </div>
  );
};

export default FocusModeRedesigned;
