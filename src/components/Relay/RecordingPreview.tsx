import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Trash2,
  Send,
  Loader2,
  X,
  RotateCcw,
  Mic,
  Check
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import type { RecordingData } from '../../hooks/useVoxRecording';
import './Relay.css';

// Brand-only — Coral-As-Signal. No per-mode color parameter; every preview is
// coral. The deprecated `color` / `progressColor` / `modeColor` props were
// silently dropped by React's unknown-prop handling, leaving the preview
// stuck on the old indigo default. Removed for good.
const ROSE = '#f43f5e';
const ROSE_PROGRESS = '#fb7185';

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

  const textPrimary = isDarkMode ? 'text-[#fafafa]' : 'text-[#0f0f0f]';
  const textSecondary = isDarkMode ? 'text-[#b4b4b8]' : 'text-[#52525b]';
  const textMuted = 'text-[#6b7280]';

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: isDarkMode ? '#0a0a0a' : '#ffffff',
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: isDarkMode
          ? '0 20px 40px rgba(0,0,0,0.6)'
          : '0 20px 40px rgba(0,0,0,0.08)',
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
              background: `linear-gradient(135deg, ${ROSE} 0%, #ec4899 100%)`,
              boxShadow: `0 4px 12px rgba(244, 63, 94, 0.30)`,
            }}
          >
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className={`text-sm font-semibold ${textPrimary}`}>
              Recording Preview
            </span>
            <div className={`text-xs ${textMuted}`}>
              {formatDuration(recordingData.duration)} duration
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className={`p-2 rounded-xl transition-colors ${
            isDarkMode
              ? 'hover:bg-[rgba(255,255,255,0.055)] text-[#b4b4b8]'
              : 'hover:bg-[#f2f2f2] text-[#52525b]'
          }`}
          title="Discard recording"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Audio Player */}
      <div className="p-5">
        <div className="flex items-center gap-4">
          {/* Play Button — brand coral, no scale lift */}
          <button
            type="button"
            onClick={handlePlayPause}
            className="btn-brand-primary w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
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
              color={ROSE}
              progressColor={ROSE_PROGRESS}
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
                style={{ background: 'rgba(244, 63, 94, 0.12)' }}
              >
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: ROSE }} />
              </div>
              <div>
                <span className={`text-sm font-medium ${textPrimary}`}>
                  Analyzing your recording...
                </span>
                <p className={`text-xs ${textMuted}`}>
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
                <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-2 font-mono ${textMuted}`}>
                  Transcript
                </h4>
                <p className={`text-sm leading-relaxed ${textSecondary}`}>
                  {transcript}
                </p>
              </div>

              {/* AI Analysis — Pulse "AI provenance" panel: coral provenance tag */}
              {analysis && (
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: 'rgba(244, 63, 94, 0.05)',
                    border: '1px solid rgba(244, 63, 94, 0.15)',
                  }}
                >
                  <h4
                    className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 font-mono"
                    style={{ color: isDarkMode ? '#fb7185' : '#e11d48' }}
                  >
                    AI Analysis
                  </h4>

                  <div className="space-y-3">
                    {/* Sentiment */}
                    {sentimentConfig && (
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{sentimentConfig.icon}</span>
                        <div>
                          <span className={`text-xs ${textMuted}`}>
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
                        <span className={`text-xs ${textMuted}`}>
                          Topics
                        </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {analysis.topics.map((topic, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg"
                              style={{
                                backgroundColor: 'rgba(244, 63, 94, 0.10)',
                                color: isDarkMode ? '#fb7185' : '#e11d48',
                              }}
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
                        <span className={`text-xs ${textMuted}`}>
                          Action Items
                        </span>
                        <ul className="mt-1 space-y-1">
                          {analysis.actionItems.map((item, i) => (
                            <li key={i} className={`flex items-start gap-2 text-sm ${textSecondary}`}>
                              <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: ROSE }} />
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
              <p className={`text-sm ${textMuted}`}>
                Ready to send. Click send to deliver or re-record to try again.
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
              ? 'bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.055)] text-[#b4b4b8]'
              : 'bg-[#f2f2f2] hover:bg-[#e8e8e8] text-[#52525b]'
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
              ? 'bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.055)] text-[#b4b4b8]'
              : 'bg-[#f2f2f2] hover:bg-[#e8e8e8] text-[#52525b]'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Re-record
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={isAnalyzing || isSending}
          className="btn-brand-primary flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
