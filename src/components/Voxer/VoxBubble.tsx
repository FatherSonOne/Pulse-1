// Vox Message Bubble Component
// Enhanced message bubble with waveform, transcription, and AI insights

import React, { useState, useRef, useEffect } from 'react';
import { VoxAnalysis, ActionItem } from '../../services/voxer/voxerTypes';

// ============================================
// TYPES
// ============================================

interface VoxBubbleProps {
  id: string;
  audioUrl: string;
  duration: number;
  timestamp: Date;
  sender: 'me' | 'other';
  senderName?: string;
  type?: 'audio' | 'video';
  
  // Status
  status?: 'sent' | 'delivered' | 'read';
  isPlaying?: boolean;
  
  // Transcription
  transcription?: string;
  isTranscribing?: boolean;
  
  // AI Analysis
  analysis?: VoxAnalysis;
  isAnalyzing?: boolean;
  
  // Organization
  starred?: boolean;
  tags?: string[];
  quality?: string;
  
  // Callbacks
  onPlay?: () => void;
  onPause?: () => void;
  onStar?: () => void;
  onTag?: () => void;
  onAnalyze?: () => void;
  onViewAnalysis?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  
  // Playback
  playbackSpeed?: number;
  onSpeedChange?: () => void;
  
  className?: string;
}

// ============================================
// VOX BUBBLE COMPONENT
// ============================================

export const VoxBubble: React.FC<VoxBubbleProps> = ({
  id,
  audioUrl,
  duration,
  timestamp,
  sender,
  senderName,
  type = 'audio',
  status,
  isPlaying = false,
  transcription,
  isTranscribing = false,
  analysis,
  isAnalyzing = false,
  starred = false,
  tags = [],
  quality,
  onPlay,
  onPause,
  onStar,
  onTag,
  onAnalyze,
  onViewAnalysis,
  onReply,
  onForward,
  playbackSpeed = 1,
  onSpeedChange,
  className = '',
}) => {
  const [showActions, setShowActions] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Update current time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'read': return 'fa-check-double text-blue-500';
      case 'delivered': return 'fa-check-double text-zinc-400';
      case 'sent': return 'fa-check text-zinc-400';
      default: return 'fa-check text-zinc-300';
    }
  };

  // Sentiment badge
  const getSentimentBadge = () => {
    if (!analysis?.sentiment) return null;
    const configs = {
      positive: { color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
      negative: { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
      mixed: { color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
      neutral: { color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800' },
    };
    const config = configs[analysis.sentiment];
    return (
      <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${config.bg} ${config.color}`}>
        {analysis.sentiment}
      </span>
    );
  };

  // Urgency badge
  const getUrgencyBadge = () => {
    if (!analysis?.urgency || analysis.urgency === 'low') return null;
    const configs = {
      urgent: { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
      high: { color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
      medium: { color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    };
    const config = configs[analysis.urgency as keyof typeof configs];
    if (!config) return null;
    return (
      <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${config.bg} ${config.color}`}>
        {analysis.urgency}
      </span>
    );
  };

  // Generate waveform visualization
  const waveformBars = Array.from({ length: 40 }, (_, i) => {
    // Create a pseudo-random but consistent pattern
    const height = 20 + Math.sin(i * 0.3) * 30 + Math.cos(i * 0.7) * 20;
    const progress = duration > 0 ? currentTime / duration : 0;
    const barProgress = i / 40;
    const isPlayed = barProgress <= progress;
    return { height, isPlayed };
  });

  // Handle seek
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * duration;
  };

  const isMine = sender === 'me';

  return (
    <div
      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} animate-slide-up ${className}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`
          max-w-[85%] md:max-w-[70%] rounded-2xl overflow-hidden
          border transition-all duration-200
          ${isMine
            ? 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border-orange-200 dark:border-orange-800 rounded-br-md'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-bl-md'
          }
          ${starred ? 'ring-2 ring-yellow-400 ring-offset-2 dark:ring-offset-zinc-950' : ''}
        `}
      >
        {/* Top Bar: Quality, Tags, Badges */}
        <div className="px-3 pt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {quality && (
              <span className="text-[9px] px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 rounded font-mono">
                {quality}
              </span>
            )}
            {getSentimentBadge()}
            {getUrgencyBadge()}
            {tags.map(tag => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                {tag}
              </span>
            ))}
          </div>
          <button
            onClick={onStar}
            className={`w-6 h-6 flex items-center justify-center rounded transition ${starred ? 'text-yellow-500' : 'text-zinc-300 hover:text-yellow-500'}`}
          >
            <i className={`fa-${starred ? 'solid' : 'regular'} fa-star text-xs`} />
          </button>
        </div>

        {/* Waveform / Player */}
        <div className="px-3 py-2">
          <div className="bg-zinc-900 dark:bg-black rounded-xl p-3">
            <div className="flex items-center gap-3">
              {/* Play Button */}
              <button
                onClick={isPlaying ? onPause : onPlay}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0
                  transition-all duration-200 hover:scale-105 active:scale-95
                  ${isPlaying
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                    : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500'
                  }
                `}
              >
                <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} ${!isPlaying ? 'ml-0.5' : ''}`} />
              </button>

              {/* Waveform */}
              <div
                ref={progressRef}
                className="flex-1 h-10 flex items-center gap-0.5 cursor-pointer"
                onClick={handleSeek}
              >
                {waveformBars.map((bar, i) => (
                  <div
                    key={i}
                    className={`
                      flex-1 rounded-full transition-all duration-75
                      ${bar.isPlayed
                        ? 'bg-gradient-to-t from-orange-500 to-amber-400'
                        : 'bg-zinc-700'
                      }
                    `}
                    style={{ height: `${bar.height}%` }}
                  />
                ))}
              </div>

              {/* Duration / Speed */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-mono text-zinc-400">
                  {isPlaying ? formatTime(currentTime) : formatTime(duration)}
                </span>
                <button
                  onClick={onSpeedChange}
                  className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition font-mono"
                >
                  {playbackSpeed}x
                </button>
              </div>
            </div>
          </div>

          {/* Hidden Audio Element */}
          <audio ref={audioRef} src={audioUrl} />
        </div>

        {/* Transcription */}
        <div className="px-3 pb-2">
          {isTranscribing ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400 italic py-2">
              <i className="fa-solid fa-circle-notch fa-spin" />
              Transcribing...
            </div>
          ) : transcription ? (
            <div className="relative">
              <p className={`text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed ${!expanded && transcription.length > 150 ? 'line-clamp-2' : ''}`}>
                {transcription}
              </p>
              {transcription.length > 150 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-orange-500 hover:text-orange-600 mt-1"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 italic py-1">No transcription available</p>
          )}
        </div>

        {/* AI Analysis Badge */}
        {(analysis || isAnalyzing) && (
          <div className="px-3 pb-2">
            {isAnalyzing ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs">
                <i className="fa-solid fa-brain animate-pulse" />
                Analyzing...
              </div>
            ) : analysis && (
              <button
                onClick={onViewAnalysis}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition text-xs w-full"
              >
                <i className="fa-solid fa-robot text-purple-500" />
                <span className="text-purple-700 dark:text-purple-300">
                  {analysis.keyPoints.length} key points
                </span>
                {analysis.actionItems.length > 0 && (
                  <>
                    <span className="text-purple-300">•</span>
                    <span className="text-purple-700 dark:text-purple-300">
                      {analysis.actionItems.length} action{analysis.actionItems.length > 1 ? 's' : ''}
                    </span>
                  </>
                )}
                <i className="fa-solid fa-chevron-right text-purple-400 ml-auto text-[10px]" />
              </button>
            )}
          </div>
        )}

        {/* Action Bar */}
        <div className={`px-3 pb-3 flex items-center gap-2 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
          {!analysis && !isAnalyzing && onAnalyze && (
            <button
              onClick={onAnalyze}
              className="text-[10px] px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition"
            >
              <i className="fa-solid fa-brain mr-1" />
              Analyze
            </button>
          )}
          <button
            onClick={onTag}
            className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            <i className="fa-solid fa-tag mr-1" />
            Tag
          </button>
          <button
            onClick={onReply}
            className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            <i className="fa-solid fa-reply mr-1" />
            Reply
          </button>
          <button
            onClick={onForward}
            className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            <i className="fa-solid fa-share mr-1" />
            Forward
          </button>
        </div>
      </div>

      {/* Timestamp and Status */}
      <div className="flex items-center gap-2 mt-1 px-1">
        <span className="text-[10px] text-zinc-400">
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {isMine && status && (
          <i className={`fa-solid ${getStatusIcon()} text-[10px]`} />
        )}
      </div>
    </div>
  );
};

export default VoxBubble;
