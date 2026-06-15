// Unified Record Button Component for Relay
// Wraps PTTButton with mode toggle (hold/tap) functionality
// Provides consistent recording UI across all Relay modes

import React from 'react';
import { PTTButton, PTTState, MediaMode } from './PTTButton';
import { ToggleLeft, ToggleRight } from 'lucide-react';

export interface RecordButtonProps {
  // State
  state: 'idle' | 'recording' | 'processing';
  recordingMode: 'hold' | 'tap';
  duration: number;

  // Handlers
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onToggleRecording?: () => void;
  onModeToggle: () => void;

  // Customization
  accentColor: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showModeToggle?: boolean;
  showTimer?: boolean;
  isDarkMode?: boolean;
  mode?: 'audio' | 'video';

  // Optional
  audioLevel?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Unified Record Button with Hold/Tap mode toggle
 *
 * Usage:
 * - Hold mode: Press and hold button to record, release to stop
 * - Tap mode: Tap once to start, tap again to stop
 * - Mode toggle always visible below button for easy switching
 */
export const RecordButton: React.FC<RecordButtonProps> = ({
  state,
  recordingMode,
  duration,
  onPointerDown,
  onPointerUp,
  onToggleRecording,
  onModeToggle,
  accentColor,
  size = 'lg',
  showModeToggle = true,
  showTimer = true,
  isDarkMode = false,
  mode = 'audio',
  audioLevel = 0,
  disabled = false,
  className = '',
}) => {
  // Map our state to PTT state
  const pttState: PTTState = state === 'idle' ? 'idle' :
    state === 'recording' ? 'recording' : 'processing';

  // Handlers for PTT button
  const handleStart = () => {
    if (recordingMode === 'hold') {
      onPointerDown?.();
    } else {
      onToggleRecording?.();
    }
  };

  const handleStop = () => {
    if (recordingMode === 'hold') {
      onPointerUp?.();
    } else {
      onToggleRecording?.();
    }
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Main PTT Button */}
      <PTTButton
        state={pttState}
        mode={mode as MediaMode}
        recordingMode={recordingMode}
        disabled={disabled}
        duration={duration}
        audioLevel={audioLevel}
        onStart={handleStart}
        onStop={handleStop}
        size={size}
        showTimer={showTimer}
        showWaveform={true}
        enableHaptics={true}
        color={accentColor}
        isDarkMode={isDarkMode}
      />

      {/* Mode Toggle (Hold/Tap Switcher) */}
      {showModeToggle && (
        <button
          type="button"
          onClick={onModeToggle}
          disabled={disabled || state === 'recording'}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium
            transition duration-200 ease-pulse focus:outline-none focus-visible:ring-2
            ${disabled || state === 'recording' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}
            ${isDarkMode
              ? 'bg-white/5 hover:bg-white/10 text-gray-300'
              : 'bg-zinc-950/5 hover:bg-zinc-950/10 text-gray-600'
            }
          `}
          style={{
            boxShadow: isDarkMode
              ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
          aria-label={`Switch to ${recordingMode === 'hold' ? 'tap' : 'hold'} mode`}
        >
          {/* Toggle Icon */}
          {recordingMode === 'hold' ? (
            <ToggleLeft className="w-4 h-4" style={{ color: accentColor }} />
          ) : (
            <ToggleRight className="w-4 h-4" style={{ color: accentColor }} />
          )}

          {/* Mode Label */}
          <span className="uppercase tracking-wider font-mono">
            {recordingMode === 'hold' ? 'Hold to Talk' : 'Tap to Talk'}
          </span>
        </button>
      )}

      {/* Mode Description (Small helper text) */}
      {showModeToggle && state === 'idle' && (
        <p className={`text-[10px] text-center max-w-[180px] ${
          isDarkMode ? 'text-gray-500' : 'text-gray-400'
        }`}>
          {recordingMode === 'hold'
            ? 'Press and hold button to record, release to stop'
            : 'Tap once to start, tap again to stop recording'
          }
        </p>
      )}
    </div>
  );
};

export default RecordButton;
