import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Trash2,
  Send,
  Sparkles,
  Loader2,
  X,
  RotateCcw,
  Mic,
  Check
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import type { RecordingData } from '../../hooks/useVoxRecording';
import './Voxer.css';

interface RecordingPreviewProps {
  recordingData: RecordingData;
  onSend: () => void;
  onCancel: () => void;
  onRetry: () => void;
  isAnalyzing?: boolean;
  transcript?: string;
  analysis?: {
    sentiment?: string;
    topics?: string[];
    actionItems?: string[];
  };
  color?: string;
  progressColor?: string;
  showAnalysis?: boolean;
  isDarkMode?: boolean;
}

const SENTIMENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  positive: { icon: '😊', color: '#10b981', label: 'Positive' },
  negative: { icon: '😔', color: '#ef4444', label: 'Negative' },
  neutral: { icon: '😐', color: '#6b7280', label: 'Neutral' },
  mixed: { icon: '🤔', color: '#f59e0b', label: 'Mixed' },
};

const RecordingPreview: React.FC<RecordingPreviewProps> = ({
  recordingData,
  onSend,
  onCancel,
  onRetry,
  isAnalyzing = false,
  transcript,
  analysis,
  color = '#6366f1',
  progressColor = '#818cf8',
  showAnalysis = true,
  isDarkMode = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && recordingData.url) {
      audioRef.current.src = recordingData.url;
    }
  }, [recordingData.url]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (position: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = position * recordingData.duration;
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    await onSend();
    setIsSending(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sentimentConfig = analysis?.sentiment ? SENTIMENT_CONFIG[analysis.sentiment] || SENTIMENT_CONFIG.neutral : null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: isDarkMode
          ? 'linear-gradient(135deg, rgba(20,20,30,0.95), rgba(15,15,22,0.98))'
          : 'linear-gradient(135deg, #ffffff, #f8fafc)',
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: isDarkMode
          ? '0 20px 40px rgba(0,0,0,0.4)'
          : '0 20px 40px rgba(0,0,0,0.1)',
      }}
    >
      {/* Preview Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{
          background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${color}, ${color}dd)`,
              boxShadow: `0 4px 12px ${color}40`,
            }}
          >
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Recording Preview
            </span>
            <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {formatDuration(recordingData.duration)} duration
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className={`p-2 rounded-xl transition-colors ${
            isDarkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-black/5 text-gray-500'
          }`}
          title="Discard recording"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Audio Player */}
      <div className="p-5">
        <div className="flex items-center gap-4">
          {/* Play Button */}
          <button
            type="button"
            onClick={handlePlayPause}
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${color}, ${color}dd)`,
              boxShadow: `0 8px 20px ${color}40`,
            }}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" />
            ) : (
              <Play className="w-6 h-6 text-white ml-0.5" />
            )}
          </button>

          {/* Waveform Visualizer */}
          <div className="flex-1 min-w-0">
            <VoxAudioVisualizer
              analyser={null}
              isActive={false}
              isPlaying={isPlaying}
              playbackProgress={playbackProgress}
              audioBuffer={recordingData.audioBuffer}
              duration={recordingData.duration}
              mode="waveform"
              color={color}
              progressColor={progressColor}
              height={56}
              isDarkMode={isDarkMode}
              showGlow={false}
              onSeek={handleSeek}
            />
          </div>
        </div>
      </div>

      {/* Analysis Section */}
      {showAnalysis && (
        <div className="px-5 pb-5">
          {isAnalyzing ? (
            <div
              className="p-4 rounded-xl flex items-center gap-3"
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${color}20` }}
              >
                <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />
              </div>
              <div>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Analyzing your recording...
                </span>
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Transcribing and extracting insights
                </p>
              </div>
            </div>
          ) : transcript ? (
            <div className="space-y-4">
              {/* Transcript */}
              <div
                className="p-4 rounded-xl"
                style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                }}
              >
                <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  Transcript
                </h4>
                <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {transcript}
                </p>
              </div>

              {/* AI Analysis */}
              {analysis && (
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${color}08, ${color}04)`,
                    border: `1px solid ${color}15`,
                  }}
                >
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color }}>
                    <Sparkles className="w-3 h-3" />
                    AI Analysis
                  </h4>

                  <div className="space-y-3">
                    {/* Sentiment */}
                    {sentimentConfig && (
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{sentimentConfig.icon}</span>
                        <div>
                          <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            Sentiment
                          </span>
                          <p className="text-sm font-medium" style={{ color: sentimentConfig.color }}>
                            {sentimentConfig.label}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Topics */}
                    {analysis.topics && analysis.topics.length > 0 && (
                      <div>
                        <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          Topics
                        </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {analysis.topics.map((topic, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg"
                              style={{ backgroundColor: `${color}15`, color }}
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Items */}
                    {analysis.actionItems && analysis.actionItems.length > 0 && (
                      <div>
                        <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          Action Items
                        </span>
                        <ul className="mt-1 space-y-1">
                          {analysis.actionItems.map((item, i) => (
                            <li key={i} className={`flex items-start gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="p-4 rounded-xl text-center"
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              }}
            >
              <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Ready to send! Click send to deliver or re-record to try again.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div
        className="px-5 py-4 flex gap-3"
        style={{
          background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all flex-1 ${
            isDarkMode
              ? 'bg-white/5 hover:bg-white/10 text-gray-300'
              : 'bg-black/5 hover:bg-black/10 text-gray-600'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          Discard
        </button>
        <button
          type="button"
          onClick={onRetry}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all flex-1 ${
            isDarkMode
              ? 'bg-white/5 hover:bg-white/10 text-gray-300'
              : 'bg-black/5 hover:bg-black/10 text-gray-600'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Re-record
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={isAnalyzing || isSending}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all flex-1 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, ${color}, ${color}dd)`,
            boxShadow: `0 4px 15px ${color}40`,
          }}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => {
          const audio = e.target as HTMLAudioElement;
          if (audio.duration) {
            setPlaybackProgress(audio.currentTime / audio.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setPlaybackProgress(0);
        }}
      />
    </div>
  );
};

export default RecordingPreview;
