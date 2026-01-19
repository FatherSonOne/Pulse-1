// AI Feedback Modal Component
// Shows AI feedback on voice messages before sending

import React, { useState } from 'react';
import {
  VoxFeedback,
  FeedbackIssue,
  FeedbackSuggestion,
  FeedbackSeverity,
} from '../../services/voxer/voxerTypes';

// ============================================
// TYPES
// ============================================

interface AIFeedbackModalProps {
  isOpen: boolean;
  feedback: VoxFeedback | null;
  transcription: string;
  isLoading?: boolean;
  onClose: () => void;
  onSendAnyway: () => void;
  onReRecord: () => void;
  onEditTranscription?: (newText: string) => void;
  onApplySuggestion?: (suggestion: FeedbackSuggestion) => void;
}

// ============================================
// AI FEEDBACK MODAL COMPONENT
// ============================================

export const AIFeedbackModal: React.FC<AIFeedbackModalProps> = ({
  isOpen,
  feedback,
  transcription,
  isLoading = false,
  onClose,
  onSendAnyway,
  onReRecord,
  onEditTranscription,
  onApplySuggestion,
}) => {
  const [showImproved, setShowImproved] = useState(false);
  const [editedText, setEditedText] = useState(transcription);
  const [isEditing, setIsEditing] = useState(false);

  if (!isOpen) return null;

  // Severity icons and colors
  const getSeverityConfig = (severity: FeedbackSeverity) => {
    const configs = {
      critical: { icon: 'fa-circle-exclamation', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
      warning: { icon: 'fa-triangle-exclamation', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
      info: { icon: 'fa-circle-info', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
    };
    return configs[severity] || configs.info;
  };

  // Score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  // Score background
  const getScoreBg = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-green-500';
    if (score >= 60) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  // All issues combined
  const allIssues = feedback ? [
    ...feedback.contentIssues,
    ...feedback.toneIssues,
    ...feedback.clarityIssues,
  ] : [];

  // Critical issues count
  const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-scaleIn max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <i className="fa-solid fa-robot text-white" />
              </div>
              <div>
                <h3 className="font-bold dark:text-white">AI Review</h3>
                <p className="text-xs text-zinc-500">Before you send...</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-white/50 dark:hover:bg-zinc-800 flex items-center justify-center transition"
            >
              <i className="fa-solid fa-times text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            // Loading State
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <i className="fa-solid fa-brain text-purple-500 text-2xl animate-pulse" />
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Analyzing your message...</p>
              <div className="mt-4 flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
          ) : feedback ? (
            <>
              {/* Score Card */}
              <div className="p-4">
                <div className="flex items-center gap-4">
                  {/* Score Circle */}
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="none"
                        className="text-zinc-200 dark:text-zinc-700"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke="url(#scoreGradient)"
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${feedback.overallScore * 2.26} 226`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" className={`${feedback.overallScore >= 80 ? 'text-emerald-500' : feedback.overallScore >= 60 ? 'text-amber-500' : 'text-red-500'}`} stopColor="currentColor" />
                          <stop offset="100%" className={`${feedback.overallScore >= 80 ? 'text-green-500' : feedback.overallScore >= 60 ? 'text-orange-500' : 'text-pink-500'}`} stopColor="currentColor" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-2xl font-bold ${getScoreColor(feedback.overallScore)}`}>
                        {feedback.overallScore}
                      </span>
                    </div>
                  </div>

                  {/* Score Summary */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {feedback.isReadyToSend ? (
                        <>
                          <i className="fa-solid fa-circle-check text-emerald-500" />
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Ready to Send</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-circle-exclamation text-amber-500" />
                          <span className="font-semibold text-amber-600 dark:text-amber-400">Review Suggested</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>{feedback.wordCount} words</span>
                      <span>•</span>
                      <span>~{Math.ceil(feedback.estimatedDuration)}s</span>
                      {feedback.hasQuestions && (
                        <>
                          <span>•</span>
                          <span className="text-amber-500">Has questions</span>
                        </>
                      )}
                    </div>
                    {(criticalCount > 0 || warningCount > 0) && (
                      <div className="flex items-center gap-2 mt-2">
                        {criticalCount > 0 && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 rounded">
                            {criticalCount} critical
                          </span>
                        )}
                        {warningCount > 0 && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded">
                            {warningCount} warnings
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Transcription Preview */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Your Message
                  </span>
                  {feedback.improvedTranscription && (
                    <button
                      onClick={() => setShowImproved(!showImproved)}
                      className="text-xs text-purple-500 hover:text-purple-600"
                    >
                      <i className={`fa-solid ${showImproved ? 'fa-eye-slash' : 'fa-wand-magic-sparkles'} mr-1`} />
                      {showImproved ? 'Show original' : 'Show improved'}
                    </button>
                  )}
                </div>
                
                {isEditing ? (
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm dark:text-white resize-none"
                    rows={3}
                    autoFocus
                  />
                ) : (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {showImproved && feedback.improvedTranscription ? (
                      <div className="text-emerald-700 dark:text-emerald-300">
                        <i className="fa-solid fa-sparkles text-emerald-500 mr-2" />
                        {feedback.improvedTranscription}
                      </div>
                    ) : (
                      `"${transcription}"`
                    )}
                  </div>
                )}

                {onEditTranscription && (
                  <div className="flex justify-end mt-2">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="text-xs text-zinc-500 hover:text-zinc-700 px-2 py-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            onEditTranscription(editedText);
                            setIsEditing(false);
                          }}
                          className="text-xs text-purple-500 hover:text-purple-600 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded"
                        >
                          <i className="fa-solid fa-check mr-1" />
                          Apply
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditedText(transcription);
                          setIsEditing(true);
                        }}
                        className="text-xs text-zinc-500 hover:text-zinc-700"
                      >
                        <i className="fa-solid fa-pen mr-1" />
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Issues */}
              {allIssues.length > 0 && (
                <div className="px-4 pb-4">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                    Feedback
                  </span>
                  <div className="space-y-2">
                    {allIssues.map((issue) => {
                      const config = getSeverityConfig(issue.severity);
                      return (
                        <div
                          key={issue.id}
                          className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
                        >
                          <div className="flex items-start gap-2">
                            <i className={`fa-solid ${config.icon} ${config.color} mt-0.5`} />
                            <div className="flex-1">
                              <p className="text-sm text-zinc-700 dark:text-zinc-300">{issue.message}</p>
                              {issue.suggestion && (
                                <p className="text-xs text-zinc-500 mt-1">
                                  <i className="fa-solid fa-lightbulb text-amber-500 mr-1" />
                                  {issue.suggestion}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {feedback.suggestions.length > 0 && (
                <div className="px-4 pb-4">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                    Suggestions
                  </span>
                  <div className="space-y-2">
                    {feedback.suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        onClick={() => onApplySuggestion?.(suggestion)}
                        className="w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition group"
                      >
                        <div className="flex items-start gap-2">
                          <i className="fa-solid fa-wand-magic-sparkles text-purple-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                              {suggestion.suggestedText}
                            </p>
                            <p className="text-xs text-zinc-500 mt-1">{suggestion.reason}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            // No feedback state
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-robot text-zinc-400 text-2xl" />
              </div>
              <p className="text-sm text-zinc-500">No feedback available</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex gap-3">
            <button
              onClick={onReRecord}
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-rotate-left" />
              Re-record
            </button>
            <button
              onClick={onSendAnyway}
              className={`flex-1 py-2.5 px-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
                feedback?.isReadyToSend
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
              }`}
            >
              <i className="fa-solid fa-paper-plane" />
              {feedback?.isReadyToSend ? 'Send' : 'Send Anyway'}
            </button>
          </div>
          
          {!feedback?.isReadyToSend && (
            <p className="text-[10px] text-center text-zinc-400 mt-2">
              <i className="fa-solid fa-info-circle mr-1" />
              Review the feedback above before sending
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIFeedbackModal;
