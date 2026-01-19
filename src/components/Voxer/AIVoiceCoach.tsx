// AI Voice Coach Component
// Pre-send analysis with speaking metrics and improvements

import React, { useState, useEffect, useCallback } from 'react';
import { VoiceCoachAnalysis, VoiceImprovement } from '../../services/voxer/advancedVoxerTypes';
import { processWithModel } from '../../services/geminiService';

// ============================================
// TYPES
// ============================================

interface AIVoiceCoachProps {
  isOpen: boolean;
  onClose: () => void;
  transcription: string;
  audioDuration: number;
  audioBlob?: Blob;
  apiKey: string;
  onSendAnyway: () => void;
  onReRecord: () => void;
  recipientName?: string;
}

// ============================================
// SCORE METER COMPONENT
// ============================================

interface ScoreMeterProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const ScoreMeter: React.FC<ScoreMeterProps> = ({ score, label, size = 'md' }) => {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-emerald-500';
    if (s >= 60) return 'text-yellow-500';
    if (s >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getBgColor = (s: number) => {
    if (s >= 80) return 'bg-emerald-500';
    if (s >= 60) return 'bg-yellow-500';
    if (s >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const sizeClasses = {
    sm: { container: 'w-12 h-12', text: 'text-lg', label: 'text-[9px]' },
    md: { container: 'w-16 h-16', text: 'text-xl', label: 'text-[10px]' },
    lg: { container: 'w-24 h-24', text: 'text-3xl', label: 'text-xs' },
  };

  const circumference = 2 * Math.PI * 40; // radius = 40
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${sizeClasses[size].container}`}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-zinc-200 dark:text-zinc-800"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={getBgColor(score)}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center font-bold ${sizeClasses[size].text} ${getColor(score)}`}>
          {score}
        </div>
      </div>
      <span className={`mt-1 text-zinc-500 font-medium ${sizeClasses[size].label}`}>{label}</span>
    </div>
  );
};

// ============================================
// IMPROVEMENT CARD COMPONENT
// ============================================

interface ImprovementCardProps {
  improvement: VoiceImprovement;
}

const ImprovementCard: React.FC<ImprovementCardProps> = ({ improvement }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50 dark:bg-red-900/10';
      case 'medium': return 'border-orange-500 bg-orange-50 dark:bg-orange-900/10';
      default: return 'border-blue-500 bg-blue-50 dark:bg-blue-900/10';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pace': return 'fa-gauge-high';
      case 'filler': return 'fa-comment-dots';
      case 'clarity': return 'fa-bullseye';
      case 'confidence': return 'fa-shield';
      case 'tone': return 'fa-masks-theater';
      case 'energy': return 'fa-bolt';
      case 'structure': return 'fa-list-check';
      default: return 'fa-lightbulb';
    }
  };

  return (
    <div className={`p-3 rounded-xl border-l-4 ${getPriorityColor(improvement.priority)}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 shadow-sm">
          <i className={`fa-solid ${getTypeIcon(improvement.type)} text-sm text-zinc-600 dark:text-zinc-400`}></i>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 capitalize">{improvement.type}</span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
              improvement.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
              improvement.priority === 'medium' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
              'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
              {improvement.priority}
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">{improvement.issue}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            <i className="fa-solid fa-lightbulb mr-1"></i>
            {improvement.suggestion}
          </p>
          {improvement.example && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 italic">
              Example: "{improvement.example}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN AI VOICE COACH COMPONENT
// ============================================

export const AIVoiceCoach: React.FC<AIVoiceCoachProps> = ({
  isOpen,
  onClose,
  transcription,
  audioDuration,
  audioBlob,
  apiKey,
  onSendAnyway,
  onReRecord,
  recipientName,
}) => {
  const [analysis, setAnalysis] = useState<VoiceCoachAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'rewrite'>('overview');

  // Analyze the transcription
  const analyzeVox = useCallback(async () => {
    if (!transcription || !apiKey) return;

    setIsAnalyzing(true);

    const wordsPerMinute = Math.round((transcription.split(/\s+/).length / audioDuration) * 60);

    const prompt = `You are an expert communication coach. Analyze this voice message transcription and provide detailed feedback.

Transcription: "${transcription}"
Duration: ${audioDuration} seconds
Words per minute: ${wordsPerMinute}
${recipientName ? `Recipient: ${recipientName}` : ''}

Analyze and return a JSON object with these exact fields:
{
  "overallScore": <number 0-100>,
  "speakingPace": {
    "wordsPerMinute": ${wordsPerMinute},
    "rating": "<too_slow|slow|good|fast|too_fast>",
    "suggestion": "<optional suggestion>"
  },
  "fillerWords": {
    "count": <number>,
    "words": [{"word": "<filler>", "count": <number>}],
    "percentageOfSpeech": <number>,
    "suggestion": "<optional suggestion>"
  },
  "clarity": {
    "score": <number 0-100>,
    "issues": ["<issue1>", "<issue2>"],
    "suggestion": "<optional suggestion>"
  },
  "confidence": {
    "score": <number 0-100>,
    "indicators": ["<indicator1>"],
    "suggestion": "<optional suggestion>"
  },
  "tone": {
    "primary": "<professional|casual|urgent|friendly|formal|uncertain>",
    "appropriateness": "<good|adjust|reconsider>",
    "suggestion": "<optional suggestion>"
  },
  "energy": {
    "level": "<low|moderate|high>",
    "consistency": <boolean>,
    "suggestion": "<optional suggestion>"
  },
  "improvements": [
    {
      "type": "<pace|filler|clarity|confidence|tone|energy|structure>",
      "priority": "<low|medium|high>",
      "issue": "<specific issue>",
      "suggestion": "<actionable suggestion>",
      "example": "<optional example>"
    }
  ],
  "rephrasedVersion": "<improved version of the message>"
}

Return ONLY valid JSON, no markdown or extra text.`;

    try {
      const result = await processWithModel(apiKey, prompt);
      if (result) {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setAnalysis({
            id: `analysis-${Date.now()}`,
            recordingId: `rec-${Date.now()}`,
            timestamp: new Date(),
            ...parsed,
          });
        }
      }
    } catch (error) {
      console.error('Voice coach analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [transcription, audioDuration, apiKey, recipientName]);

  useEffect(() => {
    if (isOpen && transcription && !analysis) {
      analyzeVox();
    }
  }, [isOpen, transcription, analysis, analyzeVox]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setAnalysis(null);
      setActiveTab('overview');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-scaleIn">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-blue-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white">
              <i className="fa-solid fa-user-graduate"></i>
            </div>
            <div>
              <h2 className="font-bold text-lg dark:text-white">AI Voice Coach</h2>
              <p className="text-xs text-zinc-500">Pre-send analysis & suggestions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition"
          >
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                <i className="fa-solid fa-wand-magic-sparkles text-2xl text-purple-500 animate-pulse"></i>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 font-medium">Analyzing your message...</p>
              <p className="text-xs text-zinc-400 mt-1">Checking pace, clarity, tone & more</p>
            </div>
          ) : analysis ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6">
                {(['overview', 'details', 'rewrite'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition capitalize ${
                      activeTab === tab
                        ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Overall Score */}
                    <div className="flex items-center justify-center">
                      <ScoreMeter score={analysis.overallScore} label="Overall Score" size="lg" />
                    </div>

                    {/* Metric Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <ScoreMeter score={analysis.clarity?.score || 0} label="Clarity" />
                      <ScoreMeter score={analysis.confidence?.score || 0} label="Confidence" />
                      <ScoreMeter 
                        score={analysis.speakingPace?.rating === 'good' ? 85 : 
                               analysis.speakingPace?.rating === 'fast' || analysis.speakingPace?.rating === 'slow' ? 65 : 45} 
                        label="Pace" 
                      />
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                        <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                          {analysis.speakingPace?.wordsPerMinute || 0}
                        </div>
                        <div className="text-xs text-zinc-500">Words per minute</div>
                        <div className={`text-xs mt-1 capitalize ${
                          analysis.speakingPace?.rating === 'good' ? 'text-emerald-500' :
                          analysis.speakingPace?.rating === 'too_fast' || analysis.speakingPace?.rating === 'too_slow' ? 'text-red-500' :
                          'text-orange-500'
                        }`}>
                          {analysis.speakingPace?.rating?.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                        <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                          {analysis.fillerWords?.count || 0}
                        </div>
                        <div className="text-xs text-zinc-500">Filler words</div>
                        {analysis.fillerWords?.words && analysis.fillerWords.words.length > 0 && (
                          <div className="text-xs text-zinc-400 mt-1">
                            {analysis.fillerWords.words.slice(0, 3).map(w => w.word).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tone & Energy */}
                    <div className="flex gap-3">
                      <div className="flex-1 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 flex items-center gap-3">
                        <i className="fa-solid fa-masks-theater text-purple-500"></i>
                        <div>
                          <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Tone</div>
                          <div className="text-sm text-zinc-700 dark:text-zinc-300 capitalize">{analysis.tone?.primary}</div>
                        </div>
                      </div>
                      <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 flex items-center gap-3">
                        <i className="fa-solid fa-bolt text-yellow-500"></i>
                        <div>
                          <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Energy</div>
                          <div className="text-sm text-zinc-700 dark:text-zinc-300 capitalize">{analysis.energy?.level}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                      <i className="fa-solid fa-list-check text-purple-500"></i>
                      Improvement Suggestions
                    </h3>
                    {analysis.improvements && analysis.improvements.length > 0 ? (
                      <div className="space-y-3">
                        {analysis.improvements.map((imp, i) => (
                          <ImprovementCard key={i} improvement={imp} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-zinc-500">
                        <i className="fa-solid fa-check-circle text-3xl text-emerald-500 mb-2"></i>
                        <p>No major improvements needed!</p>
                      </div>
                    )}

                    {/* Individual Metric Details */}
                    {analysis.clarity?.suggestion && (
                      <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 mt-4">
                        <div className="font-medium text-sm text-blue-700 dark:text-blue-300 mb-1">
                          <i className="fa-solid fa-bullseye mr-2"></i>Clarity
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">{analysis.clarity.suggestion}</p>
                      </div>
                    )}

                    {analysis.confidence?.suggestion && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-4">
                        <div className="font-medium text-sm text-emerald-700 dark:text-emerald-300 mb-1">
                          <i className="fa-solid fa-shield mr-2"></i>Confidence
                        </div>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{analysis.confidence.suggestion}</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'rewrite' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                      <i className="fa-solid fa-pen-fancy text-purple-500"></i>
                      Suggested Rewrite
                    </h3>
                    
                    {/* Original */}
                    <div>
                      <div className="text-xs font-medium text-zinc-500 mb-2">Your Original:</div>
                      <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4 text-sm text-zinc-600 dark:text-zinc-400">
                        "{transcription}"
                      </div>
                    </div>

                    {/* Improved */}
                    {analysis.rephrasedVersion && (
                      <div>
                        <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2">
                          <i className="fa-solid fa-wand-magic-sparkles"></i>
                          AI-Improved Version:
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-sm text-emerald-700 dark:text-emerald-300">
                          "{analysis.rephrasedVersion}"
                        </div>
                        <button className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline">
                          <i className="fa-solid fa-copy mr-1"></i>
                          Copy to use as script
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
              <i className="fa-solid fa-circle-exclamation text-3xl mb-2"></i>
              <p>No transcription available to analyze</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
          <button
            onClick={onReRecord}
            className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-semibold text-zinc-700 dark:text-zinc-300 transition flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-redo"></i>
            Re-record
          </button>
          <button
            onClick={onSendAnyway}
            className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-paper-plane"></i>
            Send Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIVoiceCoach;
