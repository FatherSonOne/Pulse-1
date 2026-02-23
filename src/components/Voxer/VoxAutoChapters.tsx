// VoxAutoChapters - Display AI-generated chapters for long voice messages
// Allows jumping to specific topics within a recording

import React from 'react';
import { PlayCircle, Clock, List, Sparkles } from 'lucide-react';
import { Chapter, formatChapterTime } from '../../services/voxer/voxerAIService';

interface VoxAutoChaptersProps {
  chapters: Chapter[];
  currentTime?: number;
  onSeek?: (time: number) => void;
  isDarkMode?: boolean;
  accentColor?: string;
}

export const VoxAutoChapters: React.FC<VoxAutoChaptersProps> = ({
  chapters,
  currentTime = 0,
  onSeek,
  isDarkMode = false,
  accentColor = '#8B5CF6',
}) => {
  const tc = {
    bg: isDarkMode ? 'bg-zinc-900' : 'bg-white',
    border: isDarkMode ? 'border-zinc-700' : 'border-zinc-200',
    text: isDarkMode ? 'text-white' : 'text-zinc-900',
    textSecondary: isDarkMode ? 'text-zinc-400' : 'text-zinc-600',
    textMuted: isDarkMode ? 'text-zinc-500' : 'text-zinc-400',
    cardBg: isDarkMode ? 'bg-zinc-800/50' : 'bg-zinc-50',
    hoverBg: isDarkMode ? 'hover:bg-zinc-700/50' : 'hover:bg-zinc-100',
    activeBg: isDarkMode ? 'bg-zinc-700' : 'bg-zinc-100',
  };

  if (chapters.length === 0) {
    return null;
  }

  // Determine which chapter is currently active
  const activeChapterIndex = chapters.findIndex(
    (chapter, index) =>
      currentTime >= chapter.startTime &&
      (index === chapters.length - 1 || currentTime < chapters[index + 1].startTime)
  );

  return (
    <div className={`rounded-xl border ${tc.border} ${tc.bg} overflow-hidden`}>
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          background: `linear-gradient(135deg, ${accentColor}12, ${accentColor}05)`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}20` }}
          >
            <List className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div>
            <h4 className={`text-sm font-semibold ${tc.text}`}>Chapters</h4>
            <p className={`text-xs ${tc.textMuted}`}>
              {chapters.length} topics • AI-generated
            </p>
          </div>
        </div>
        <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
      </div>

      {/* Chapters List */}
      <div className="p-2">
        <div className="space-y-1">
          {chapters.map((chapter, index) => {
            const isActive = index === activeChapterIndex;
            const isClickable = !!onSeek;

            return (
              <button
                key={index}
                onClick={() => onSeek && onSeek(chapter.startTime)}
                disabled={!isClickable}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  isActive
                    ? tc.activeBg
                    : isClickable
                    ? tc.hoverBg
                    : ''
                } ${!isClickable && 'cursor-default'}`}
                style={
                  isActive
                    ? {
                        borderLeft: `3px solid ${accentColor}`,
                        paddingLeft: '11px',
                      }
                    : {}
                }
              >
                <div className="flex items-start gap-3">
                  {/* Chapter Number */}
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: isActive
                        ? accentColor
                        : `${accentColor}15`,
                      color: isActive ? 'white' : accentColor,
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Chapter Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h5
                        className={`text-sm font-semibold ${
                          isActive ? tc.text : tc.textSecondary
                        }`}
                      >
                        {chapter.title}
                      </h5>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Clock className={`w-3 h-3 ${tc.textMuted}`} />
                        <span className={`text-xs font-mono ${tc.textMuted}`}>
                          {formatChapterTime(chapter.startTime)}
                        </span>
                      </div>
                    </div>
                    <p className={`text-xs ${tc.textMuted} line-clamp-2`}>
                      {chapter.summary}
                    </p>
                  </div>

                  {/* Play Icon (if clickable) */}
                  {isClickable && (
                    <PlayCircle
                      className={`w-5 h-5 ${
                        isActive ? tc.text : tc.textMuted
                      } flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity`}
                    />
                  )}
                </div>

                {/* Progress Bar */}
                {isActive && (
                  <div className="mt-2 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        background: accentColor,
                        width: `${
                          ((currentTime - chapter.startTime) /
                            (chapter.endTime - chapter.startTime)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Tip */}
      {onSeek && (
        <div
          className={`px-4 py-2 border-t ${tc.border} text-center`}
          style={{
            borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          }}
        >
          <p className={`text-xs ${tc.textMuted}`}>
            Click any chapter to jump to that section
          </p>
        </div>
      )}
    </div>
  );
};

export default VoxAutoChapters;
