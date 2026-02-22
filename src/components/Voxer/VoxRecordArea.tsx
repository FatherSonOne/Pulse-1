import React from 'react';
import RecordButton from './RecordButton';

interface VoxRecordAreaProps {
  modeColor: string;
  isDarkMode?: boolean;
  isRecording: boolean;
  isPreviewing: boolean;
  recordingMode: 'hold' | 'tap';
  onToggleRecordingMode: () => void;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onToggleRecording: () => void;
  children?: React.ReactNode; // Optional controls like playback, visualizers, etc.
}

/**
 * VoxRecordArea - Themed recording area for Voxer modes
 *
 * Features:
 * - Mode-specific color theming
 * - Consistent layout with gradient backgrounds
 * - Integrated RecordButton
 * - Hold/Tap mode toggle
 * - Optional custom controls
 */
const VoxRecordArea: React.FC<VoxRecordAreaProps> = ({
  modeColor,
  isDarkMode = false,
  isRecording,
  isPreviewing,
  recordingMode,
  onToggleRecordingMode,
  onPointerDown,
  onPointerUp,
  onToggleRecording,
  children,
}) => {
  // Theme classes
  const tc = {
    cardBg: isDarkMode
      ? 'bg-gray-800/40 backdrop-blur-sm'
      : 'bg-white/60 backdrop-blur-sm',
    border: isDarkMode ? 'border-gray-700/50' : 'border-gray-200/60',
  };

  // Convert hex color to RGB for opacity
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 99, g: 102, b: 241 };
  };

  const rgb = hexToRgb(modeColor);
  const glowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDarkMode ? '0.2' : '0.15'})`;

  return (
    <div
      className={`relative p-6 rounded-2xl border ${tc.border} ${tc.cardBg} transition-all duration-300`}
      style={{
        background: isRecording
          ? isDarkMode
            ? `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`
            : `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`
          : undefined,
      }}
    >
      {/* Optional Custom Controls (Visualizers, Playback, etc.) */}
      {children && (
        <div className="mb-6">
          {children}
        </div>
      )}

      {/* Record Button */}
      <div className="flex justify-center">
        <RecordButton
          isRecording={isRecording}
          isPreviewing={isPreviewing}
          recordingMode={recordingMode}
          modeColor={modeColor}
          onToggleRecordingMode={onToggleRecordingMode}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onToggleRecording={onToggleRecording}
        />
      </div>

      {/* Recording Mode Indicator */}
      <div className="mt-4 text-center">
        <button
          onClick={onToggleRecordingMode}
          className={`text-xs font-medium transition-colors duration-200 ${
            isDarkMode
              ? 'text-gray-400 hover:text-gray-300'
              : 'text-gray-600 hover:text-gray-700'
          }`}
        >
          {recordingMode === 'hold' ? '⏺ Hold to Record' : '⏺ Tap to Record'}
          <span className="ml-1 text-[10px] opacity-60">(tap to switch)</span>
        </button>
      </div>
    </div>
  );
};

export default VoxRecordArea;
