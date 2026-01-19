// Push-to-Talk Button Component
// Enhanced with premium visual design, animations, and multiple states

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Video, Square, Check, AlertTriangle, Loader2 } from 'lucide-react';
import './Voxer.css';

// ============================================
// TYPES
// ============================================

export type PTTState = 'idle' | 'recording' | 'processing' | 'sent' | 'error';
export type RecordingMode = 'hold' | 'tap';
export type MediaMode = 'audio' | 'video';

interface PTTButtonProps {
  state?: PTTState;
  mode?: MediaMode;
  recordingMode?: RecordingMode;
  disabled?: boolean;
  duration?: number;
  audioLevel?: number;
  onStart?: () => void;
  onStop?: () => void;
  onCancel?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTimer?: boolean;
  showWaveform?: boolean;
  enableHaptics?: boolean;
  color?: string;
  isDarkMode?: boolean;
  className?: string;
}

// ============================================
// PTT BUTTON COMPONENT
// ============================================

export const PTTButton: React.FC<PTTButtonProps> = ({
  state = 'idle',
  mode = 'audio',
  recordingMode = 'hold',
  disabled = false,
  duration = 0,
  audioLevel = 0,
  onStart,
  onStop,
  onCancel,
  size = 'lg',
  showTimer = true,
  showWaveform = true,
  enableHaptics = true,
  color = '#f97316',
  isDarkMode = false,
  className = '',
}) => {
  const [internalState, setInternalState] = useState<PTTState>(state);
  const [isPressed, setIsPressed] = useState(false);
  const [showSentAnimation, setShowSentAnimation] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setInternalState(state);
    if (state === 'sent') {
      setShowSentAnimation(true);
      setTimeout(() => setShowSentAnimation(false), 1500);
    }
  }, [state]);

  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy') => {
    if (!enableHaptics || !navigator.vibrate) return;
    const durations = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(durations[type]);
  }, [enableHaptics]);

  // Size configurations
  const sizeConfig = {
    sm: { button: 56, icon: 20, ring: 68, ripple: 72 },
    md: { button: 72, icon: 24, ring: 88, ripple: 96 },
    lg: { button: 88, icon: 28, ring: 108, ripple: 120 },
    xl: { button: 104, icon: 32, ring: 128, ripple: 144 },
  };

  const config = sizeConfig[size];

  const handleStart = useCallback(() => {
    if (disabled || internalState === 'recording') return;
    setIsPressed(true);
    triggerHaptic('medium');
    onStart?.();
  }, [disabled, internalState, onStart, triggerHaptic]);

  const handleStop = useCallback(() => {
    if (!isPressed && recordingMode === 'hold') return;
    setIsPressed(false);
    triggerHaptic('light');
    onStop?.();
  }, [isPressed, recordingMode, onStop, triggerHaptic]);

  const handleTapToggle = useCallback(() => {
    if (disabled) return;
    if (internalState === 'recording') {
      handleStop();
    } else {
      handleStart();
    }
  }, [disabled, internalState, handleStart, handleStop]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current || internalState !== 'recording') return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);

    if (distance > 100) {
      triggerHaptic('heavy');
      onCancel?.();
      setIsPressed(false);
      touchStartPos.current = null;
    }
  }, [internalState, onCancel, triggerHaptic]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    if (recordingMode === 'hold') {
      handleStart();
    }
  }, [recordingMode, handleStart]);

  const handleTouchEnd = useCallback(() => {
    touchStartPos.current = null;
    if (recordingMode === 'hold') {
      handleStop();
    }
  }, [recordingMode, handleStop]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getIcon = () => {
    if (showSentAnimation) return <Check className="text-white" style={{ width: config.icon, height: config.icon }} />;
    if (internalState === 'processing') return <Loader2 className="text-white animate-spin" style={{ width: config.icon, height: config.icon }} />;
    if (internalState === 'error') return <AlertTriangle className="text-white" style={{ width: config.icon, height: config.icon }} />;
    if (internalState === 'recording') return <Square className="text-white" style={{ width: config.icon * 0.6, height: config.icon * 0.6 }} />;
    return mode === 'video'
      ? <Video style={{ width: config.icon, height: config.icon }} />
      : <Mic style={{ width: config.icon, height: config.icon }} />;
  };

  // Generate waveform bars for visualization
  const waveformBars = Array.from({ length: 16 }, (_, i) => {
    const baseHeight = 30 + Math.sin(i * 0.5 + Date.now() / 200) * 20;
    const levelMultiplier = 0.4 + audioLevel * 0.6;
    return baseHeight * levelMultiplier;
  });

  const isRecording = internalState === 'recording';
  const bgGradient = isRecording
    ? `linear-gradient(135deg, ${color} 0%, #dc2626 100%)`
    : showSentAnimation
      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      : internalState === 'error'
        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
        : isDarkMode
          ? 'linear-gradient(135deg, #2a2a3a 0%, #1a1a25 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)';

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      {/* Cancel Zone Indicator */}
      {isRecording && (
        <div className={`absolute -top-14 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 animate-pulse ${
          isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'
        }`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          Drag to cancel
        </div>
      )}

      {/* Waveform Visualizer */}
      {showWaveform && isRecording && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-end gap-[2px] h-8">
          {waveformBars.map((height, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full transition-all duration-75"
              style={{
                height: `${height}%`,
                background: `linear-gradient(to top, ${color}, ${color}88)`,
                boxShadow: `0 0 8px ${color}40`,
              }}
            />
          ))}
        </div>
      )}

      {/* Ripple Effects */}
      {isRecording && (
        <>
          <div
            className="absolute rounded-full animate-ping opacity-30"
            style={{
              width: config.ripple,
              height: config.ripple,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: color,
            }}
          />
          <div
            className="absolute rounded-full border-2 animate-pulse"
            style={{
              width: config.ring,
              height: config.ring,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              borderColor: `${color}50`,
            }}
          />
        </>
      )}

      {/* Main Button */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || internalState === 'processing'}
        onClick={recordingMode === 'tap' ? handleTapToggle : undefined}
        onMouseDown={recordingMode === 'hold' ? handleStart : undefined}
        onMouseUp={recordingMode === 'hold' ? handleStop : undefined}
        onMouseLeave={recordingMode === 'hold' && isPressed ? handleStop : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className={`
          relative z-10 rounded-full flex items-center justify-center
          transition-all duration-200 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isRecording ? 'scale-110' : 'hover:scale-105 active:scale-95'}
        `}
        style={{
          width: config.button,
          height: config.button,
          background: bgGradient,
          boxShadow: isRecording
            ? `0 8px 30px ${color}50, 0 0 60px ${color}30`
            : showSentAnimation
              ? '0 8px 30px rgba(16, 185, 129, 0.4)'
              : isDarkMode
                ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                : '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          color: isRecording || showSentAnimation || internalState === 'error'
            ? 'white'
            : isDarkMode ? '#94a3b8' : '#64748b',
          focusRingColor: color,
        }}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {getIcon()}

        {/* Recording Indicator Dot */}
        {isRecording && (
          <div
            className="absolute top-2 right-2 w-3 h-3 rounded-full animate-pulse"
            style={{
              backgroundColor: '#ef4444',
              boxShadow: '0 0 12px rgba(239, 68, 68, 0.6)',
            }}
          />
        )}
      </button>

      {/* Timer / Status Text */}
      {showTimer && (
        <div className="mt-3 text-center min-h-[24px]">
          {isRecording && (
            <span
              className="text-sm font-mono font-bold tabular-nums"
              style={{ color }}
            >
              {formatDuration(duration)}
            </span>
          )}
          {internalState === 'processing' && (
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Processing...
            </span>
          )}
          {internalState === 'idle' && !showSentAnimation && (
            <span className={`text-[10px] uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {recordingMode === 'hold' ? 'Hold to record' : 'Tap to record'}
            </span>
          )}
          {showSentAnimation && (
            <span className="text-xs font-semibold text-emerald-500">
              Sent!
            </span>
          )}
          {internalState === 'error' && (
            <span className="text-xs text-red-500">
              Error - Try again
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// MINI PTT BUTTON (For inline use)
// ============================================

interface MiniPTTButtonProps {
  isRecording: boolean;
  onToggle: () => void;
  mode?: MediaMode;
  disabled?: boolean;
  color?: string;
  isDarkMode?: boolean;
}

export const MiniPTTButton: React.FC<MiniPTTButtonProps> = ({
  isRecording,
  onToggle,
  mode = 'audio',
  disabled = false,
  color = '#f97316',
  isDarkMode = false,
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`
        w-10 h-10 rounded-xl flex items-center justify-center
        transition-all duration-200 focus:outline-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      style={{
        background: isRecording
          ? `linear-gradient(135deg, ${color}, #dc2626)`
          : isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        boxShadow: isRecording ? `0 4px 15px ${color}40` : undefined,
        color: isRecording ? 'white' : isDarkMode ? '#94a3b8' : '#64748b',
      }}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording ? (
        <Square className="w-4 h-4" />
      ) : mode === 'video' ? (
        <Video className="w-4 h-4" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </button>
  );
};

export default PTTButton;
