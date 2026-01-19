// Vox Preview Panel Component
// Shows recording preview with AI analysis before sending

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============================================
// TYPES
// ============================================

interface QuickAnalysis {
  pace: 'slow' | 'good' | 'fast';
  clarity: 'unclear' | 'moderate' | 'clear';
  fillerWords: number;
  estimatedFillers: string[];
  completeness: 'incomplete' | 'partial' | 'complete';
  tone: 'neutral' | 'positive' | 'negative' | 'urgent';
  suggestions: string[];
  score: number; // 0-100
}

interface VoxPreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  audioBlob: Blob;
  duration: number;
  transcription: string;
  isTranscribing?: boolean;
  onSend: () => void;
  onReRecord: () => void;
  onOpenFullCoach: () => void;
  recipientName?: string;
  apiKey?: string;
}

// ============================================
// QUICK ANALYSIS HELPER
// ============================================

const analyzeQuickly = (transcription: string, duration: number): QuickAnalysis => {
  const words = transcription.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const wordsPerMinute = duration > 0 ? (wordCount / duration) * 60 : 0;
  
  // Pace analysis
  let pace: 'slow' | 'good' | 'fast' = 'good';
  if (wordsPerMinute < 100) pace = 'slow';
  else if (wordsPerMinute > 160) pace = 'fast';
  
  // Filler word detection
  const fillerPatterns = [
    /\bum+\b/gi, /\buh+\b/gi, /\blike\b/gi, /\byou know\b/gi,
    /\bbasically\b/gi, /\bactually\b/gi, /\bliterally\b/gi,
    /\bso+\b/gi, /\bi mean\b/gi, /\bkind of\b/gi, /\bsort of\b/gi
  ];
  
  let fillerCount = 0;
  const foundFillers: string[] = [];
  fillerPatterns.forEach(pattern => {
    const matches = transcription.match(pattern);
    if (matches) {
      fillerCount += matches.length;
      foundFillers.push(...matches.slice(0, 2));
    }
  });
  
  // Clarity (based on sentence structure)
  const sentences = transcription.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = wordCount / Math.max(sentences.length, 1);
  let clarity: 'unclear' | 'moderate' | 'clear' = 'moderate';
  if (avgSentenceLength > 25 || fillerCount > 5) clarity = 'unclear';
  else if (avgSentenceLength < 20 && fillerCount < 3) clarity = 'clear';
  
  // Completeness check
  const hasGreeting = /\b(hi|hey|hello|good morning|good afternoon)\b/i.test(transcription);
  const hasQuestion = /\?/.test(transcription);
  const hasClosing = /\b(thanks|thank you|let me know|talk soon|bye)\b/i.test(transcription);
  const completenessScore = (hasGreeting ? 1 : 0) + (transcription.length > 50 ? 1 : 0) + (hasClosing || hasQuestion ? 1 : 0);
  let completeness: 'incomplete' | 'partial' | 'complete' = 'partial';
  if (completenessScore >= 2) completeness = 'complete';
  else if (completenessScore === 0 && wordCount < 10) completeness = 'incomplete';
  
  // Tone detection
  const positiveWords = /\b(great|awesome|love|excited|happy|good|excellent|amazing|wonderful)\b/gi;
  const negativeWords = /\b(bad|terrible|hate|angry|frustrated|disappointed|wrong|issue|problem)\b/gi;
  const urgentWords = /\b(urgent|asap|immediately|now|emergency|critical|important)\b/gi;
  
  let tone: 'neutral' | 'positive' | 'negative' | 'urgent' = 'neutral';
  if (urgentWords.test(transcription)) tone = 'urgent';
  else if ((transcription.match(negativeWords) || []).length > (transcription.match(positiveWords) || []).length) tone = 'negative';
  else if ((transcription.match(positiveWords) || []).length > 1) tone = 'positive';
  
  // Generate suggestions
  const suggestions: string[] = [];
  if (pace === 'fast') suggestions.push('Try speaking a bit slower for clarity');
  if (pace === 'slow') suggestions.push('You could pick up the pace slightly');
  if (fillerCount > 3) suggestions.push(`Reduce filler words (found ${fillerCount})`);
  if (completeness === 'incomplete') suggestions.push('Consider adding more context');
  if (clarity === 'unclear') suggestions.push('Try breaking into shorter sentences');
  if (wordCount < 5) suggestions.push('Message might be too brief');
  
  // Calculate score
  let score = 70;
  if (pace === 'good') score += 10;
  if (clarity === 'clear') score += 10;
  if (fillerCount === 0) score += 10;
  if (completeness === 'complete') score += 10;
  score -= fillerCount * 2;
  score -= clarity === 'unclear' ? 15 : 0;
  score = Math.max(0, Math.min(100, score));
  
  return {
    pace,
    clarity,
    fillerWords: fillerCount,
    estimatedFillers: [...new Set(foundFillers)].slice(0, 3),
    completeness,
    tone,
    suggestions: suggestions.slice(0, 3),
    score,
  };
};

// ============================================
// WAVEFORM COMPONENT
// ============================================

const MiniWaveform: React.FC<{ audioUrl: string; isPlaying: boolean; progress: number }> = ({ 
  audioUrl, 
  isPlaying, 
  progress 
}) => {
  const bars = 40;
  const [heights, setHeights] = useState<number[]>([]);

  useEffect(() => {
    // Generate random waveform pattern
    const newHeights = Array.from({ length: bars }, () => 20 + Math.random() * 60);
    setHeights(newHeights);
  }, [audioUrl]);

  return (
    <div className="flex items-center gap-0.5 h-12 w-full">
      {heights.map((h, i) => {
        const isPlayed = (i / bars) * 100 < progress;
        return (
          <div
            key={i}
            className={`flex-1 rounded-full transition-all duration-150 ${
              isPlayed ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'
            } ${isPlaying && isPlayed ? 'animate-pulse' : ''}`}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
};

// ============================================
// SCORE RING COMPONENT
// ============================================

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 60 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getColor = () => {
    if (score >= 80) return '#22c55e'; // green
    if (score >= 60) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-zinc-200 dark:text-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold" style={{ color: getColor() }}>{score}</span>
      </div>
    </div>
  );
};

// ============================================
// MAIN PREVIEW PANEL COMPONENT
// ============================================

export const VoxPreviewPanel: React.FC<VoxPreviewPanelProps> = ({
  isOpen,
  onClose,
  audioBlob,
  duration,
  transcription,
  isTranscribing = false,
  onSend,
  onReRecord,
  onOpenFullCoach,
  recipientName,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<QuickAnalysis | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Create audio URL
  useEffect(() => {
    if (audioBlob) {
      audioUrlRef.current = URL.createObjectURL(audioBlob);
      return () => {
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }
      };
    }
  }, [audioBlob]);

  // Run quick analysis when transcription is ready
  useEffect(() => {
    if (transcription && !isTranscribing) {
      const result = analyzeQuickly(transcription, duration);
      setAnalysis(result);
    }
  }, [transcription, isTranscribing, duration]);

  // Handle playback
  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrlRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.src = audioUrlRef.current;
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Update progress
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      const pct = (audio.currentTime / audio.duration) * 100;
      setProgress(pct);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setIsPlaying(false);
      setProgress(0);
      setShowFullAnalysis(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getPaceIcon = (pace: string) => {
    switch (pace) {
      case 'slow': return 'fa-turtle';
      case 'fast': return 'fa-rabbit-running';
      default: return 'fa-gauge';
    }
  };

  const getPaceColor = (pace: string) => {
    switch (pace) {
      case 'slow': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
      case 'fast': return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
      default: return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30';
    }
  };

  const getToneEmoji = (tone: string) => {
    switch (tone) {
      case 'positive': return '😊';
      case 'negative': return '😔';
      case 'urgent': return '⚡';
      default: return '😐';
    }
  };

  return (
    <>
      {/* Backdrop - covers the content area, respects sidebar width */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] animate-fadeIn"
        style={{ left: 'var(--sidebar-width, 0)' }}
        onClick={onClose}
      />
      
      {/* Panel - positioned after sidebar */}
      <div 
        className="fixed bottom-0 right-0 z-[9999] animate-slideUp"
        style={{ left: 'var(--sidebar-width, 0)' }}
      >
        <div className="bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl border-t border-zinc-200 dark:border-zinc-800 max-h-[85vh] overflow-hidden">
          
          {/* Handle */}
          <div className="flex justify-center py-2">
            <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg dark:text-white">Preview Your Vox</h3>
              {recipientName && (
                <p className="text-sm text-zinc-500">To: {recipientName}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400"
            >
              <i className="fa-solid fa-times"></i>
            </button>
          </div>

          {/* Audio Player */}
          <div className="px-5 pb-4">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-4">
              <div className="flex items-center gap-4">
                {/* Play Button */}
                <button
                  onClick={togglePlayback}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition transform hover:scale-105 active:scale-95 ${
                    isPlaying ? 'bg-orange-500' : 'bg-zinc-900 dark:bg-white dark:text-zinc-900'
                  }`}
                >
                  <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl`}></i>
                </button>

                {/* Waveform */}
                <div className="flex-1">
                  <MiniWaveform 
                    audioUrl={audioUrlRef.current || ''} 
                    isPlaying={isPlaying} 
                    progress={progress} 
                  />
                </div>

                {/* Duration */}
                <div className="text-right">
                  <div className="text-lg font-mono font-bold dark:text-white">
                    {Math.floor(duration)}s
                  </div>
                  <div className="text-xs text-zinc-500">duration</div>
                </div>
              </div>
            </div>
            <audio ref={audioRef} className="hidden" />
          </div>

          {/* Transcription */}
          <div className="px-5 pb-4">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Transcription
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 max-h-24 overflow-y-auto">
              {isTranscribing ? (
                <div className="flex items-center gap-2 text-zinc-500">
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span className="text-sm">Transcribing...</span>
                </div>
              ) : (
                <p className="text-sm dark:text-zinc-300 leading-relaxed">
                  {transcription || <span className="italic text-zinc-400">No transcription available</span>}
                </p>
              )}
            </div>
          </div>

          {/* Quick Analysis */}
          {analysis && (
            <div className="px-5 pb-4">
              <button
                onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <i className="fa-solid fa-wand-magic-sparkles text-purple-500"></i>
                    Quick Analysis
                  </div>
                  <i className={`fa-solid fa-chevron-${showFullAnalysis ? 'up' : 'down'} text-zinc-400 text-xs`}></i>
                </div>

                {/* Summary Row */}
                <div className="flex items-center gap-4">
                  <ScoreRing score={analysis.score} size={56} />
                  
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    {/* Pace */}
                    <div className={`rounded-lg px-2 py-1.5 text-center ${getPaceColor(analysis.pace)}`}>
                      <i className={`fa-solid ${getPaceIcon(analysis.pace)} text-xs`}></i>
                      <div className="text-[10px] font-medium capitalize mt-0.5">{analysis.pace}</div>
                    </div>
                    
                    {/* Clarity */}
                    <div className={`rounded-lg px-2 py-1.5 text-center ${
                      analysis.clarity === 'clear' ? 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30' :
                      analysis.clarity === 'unclear' ? 'text-red-500 bg-red-100 dark:bg-red-900/30' :
                      'text-amber-500 bg-amber-100 dark:bg-amber-900/30'
                    }`}>
                      <i className="fa-solid fa-sparkles text-xs"></i>
                      <div className="text-[10px] font-medium capitalize mt-0.5">{analysis.clarity}</div>
                    </div>
                    
                    {/* Tone */}
                    <div className="rounded-lg px-2 py-1.5 text-center bg-zinc-100 dark:bg-zinc-800">
                      <span className="text-sm">{getToneEmoji(analysis.tone)}</span>
                      <div className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 capitalize mt-0.5">{analysis.tone}</div>
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded Analysis */}
              {showFullAnalysis && (
                <div className="mt-4 space-y-3 animate-slideDown">
                  {/* Filler Words */}
                  {analysis.fillerWords > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <i className="fa-solid fa-comment-dots text-amber-600 text-sm"></i>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          {analysis.fillerWords} filler word{analysis.fillerWords > 1 ? 's' : ''} detected
                        </div>
                        {analysis.estimatedFillers.length > 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            Found: {analysis.estimatedFillers.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {analysis.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-zinc-400 uppercase">Suggestions</div>
                      {analysis.suggestions.map((suggestion, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                          <i className="fa-solid fa-lightbulb text-yellow-500 mt-0.5"></i>
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Full Coach Button */}
                  <button
                    onClick={onOpenFullCoach}
                    className="w-full py-2.5 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-user-graduate"></i>
                    Open Full AI Voice Coach
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="px-5 pb-6 pt-2 flex gap-3">
            {/* Re-record */}
            <button
              onClick={onReRecord}
              className="flex-1 py-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-semibold text-zinc-700 dark:text-zinc-300 transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-rotate-left"></i>
              Re-record
            </button>
            
            {/* Send */}
            <button
              onClick={onSend}
              className="flex-[2] py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-paper-plane"></i>
              Send Vox
            </button>
          </div>

          {/* Safe Area Padding for iOS */}
          <div className="h-safe-area-inset-bottom" />
        </div>
      </div>
    </>
  );
};

export default VoxPreviewPanel;
