// PlaybackSpeedControl - UI control for adjusting audio playback speed
// Shows current speed and allows cycling through 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x

import React from 'react';
import { Gauge } from 'lucide-react';
import { PlaybackSpeed, PLAYBACK_SPEEDS } from '../../hooks/usePlaybackSpeed';

interface PlaybackSpeedControlProps {
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  isDarkMode?: boolean;
  compact?: boolean;
}

export const PlaybackSpeedControl: React.FC<PlaybackSpeedControlProps> = ({
  speed,
  onSpeedChange,
  isDarkMode = false,
  compact = false,
}) => {
  const cycleSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(speed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    onSpeedChange(PLAYBACK_SPEEDS[nextIndex]);
  };

  const getSpeedLabel = (s: PlaybackSpeed): string => {
    return s === 1 ? '1×' : `${s}×`;
  };

  const getSpeedColor = (s: PlaybackSpeed): string => {
    if (s < 1) return isDarkMode ? '#60a5fa' : '#3b82f6'; // Blue for slow
    if (s === 1) return isDarkMode ? '#9ca3af' : '#6b7280'; // Gray for normal
    return isDarkMode ? '#f97316' : '#ea580c'; // Orange for fast
  };

  if (compact) {
    // Compact mode - just a button
    return (
      <button
        onClick={cycleSpeed}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition duration-200 ease-pulse hover:scale-105 active:scale-95"
        style={{
          background: isDarkMode ? '#374151' : '#e5e7eb',
          color: getSpeedColor(speed),
        }}
        title={`Playback speed: ${getSpeedLabel(speed)}`}
      >
        <Gauge className="w-3.5 h-3.5" />
        <span>{getSpeedLabel(speed)}</span>
      </button>
    );
  }

  // Full mode - dropdown with all options
  return (
    <div className="relative group">
      <button
        onClick={cycleSpeed}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition duration-200 ease-pulse hover:scale-105 active:scale-95"
        style={{
          background: isDarkMode ? '#374151' : '#e5e7eb',
          color: getSpeedColor(speed),
        }}
        title="Click to cycle playback speed"
      >
        <Gauge className="w-4 h-4" />
        <span>{getSpeedLabel(speed)}</span>
      </button>

      {/* Dropdown on hover */}
      <div
        className="absolute bottom-full left-0 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition duration-200 ease-pulse origin-bottom-left scale-95 group-hover:scale-100 z-50"
        style={{
          pointerEvents: 'none',
        }}
      >
        <div
          className="rounded-xl shadow-xl border p-2 min-w-[100px]"
          style={{
            background: isDarkMode ? '#1f2937' : '#fafafa',
            borderColor: isDarkMode ? '#374151' : '#e5e7eb',
          }}
        >
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              onClick={(e) => {
                e.stopPropagation();
                onSpeedChange(s);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ease-pulse"
              style={{
                background: s === speed
                  ? (isDarkMode ? '#374151' : '#f3f4f6')
                  : 'transparent',
                color: s === speed
                  ? getSpeedColor(s)
                  : (isDarkMode ? '#d1d5db' : '#6b7280'),
                pointerEvents: 'auto',
              }}
            >
              {getSpeedLabel(s)}
              {s === speed && <span className="ml-2">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PlaybackSpeedControl);
