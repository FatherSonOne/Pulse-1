// AI Analysis Panel Component
// Displays comprehensive AI analysis of voice messages

import React, { useState } from 'react';
import {
  VoxAnalysis,
  ActionItem,
  SuggestedResponse,
  SentimentType,
  UrgencyLevel,
} from '../../services/voxer/voxerTypes';

// ============================================
// TYPES
// ============================================

interface AIAnalysisPanelProps {
  analysis: VoxAnalysis | null;
  isLoading?: boolean;
  onActionItemToggle?: (itemId: string) => void;
  onActionItemClick?: (item: ActionItem) => void;
  onResponseSelect?: (response: SuggestedResponse) => void;
  onFollowUpSelect?: (followUp: string) => void;
  onClose?: () => void;
  compact?: boolean;
  className?: string;
}

// ============================================
// AI ANALYSIS PANEL COMPONENT
// ============================================

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  analysis,
  isLoading = false,
  onActionItemToggle,
  onActionItemClick,
  onResponseSelect,
  onFollowUpSelect,
  onClose,
  compact = false,
  className = '',
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'actionItems', 'responses'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Sentiment colors
  const getSentimentConfig = (sentiment: SentimentType) => {
    const configs = {
      positive: { color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'fa-face-smile', label: 'Positive' },
      negative: { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', icon: 'fa-face-frown', label: 'Negative' },
      neutral: { color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800', icon: 'fa-face-meh', label: 'Neutral' },
      mixed: { color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'fa-face-meh-blank', label: 'Mixed' },
    };
    return configs[sentiment] || configs.neutral;
  };

  // Urgency colors
  const getUrgencyConfig = (urgency: UrgencyLevel) => {
    const configs = {
      urgent: { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', icon: 'fa-circle-exclamation', label: 'Urgent' },
      high: { color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: 'fa-triangle-exclamation', label: 'High' },
      medium: { color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: 'fa-circle-info', label: 'Medium' },
      low: { color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800', icon: 'fa-circle', label: 'Low' },
    };
    return configs[urgency] || configs.low;
  };

  // Priority colors
  const getPriorityColor = (priority: string) => {
    const colors = {
      high: 'text-red-500 bg-red-50 dark:bg-red-900/20',
      medium: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
      low: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800',
    };
    return colors[priority as keyof typeof colors] || colors.low;
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden ${className}`}>
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 animate-pulse" />
            <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className={`bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center ${className}`}>
        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
          <i className="fa-solid fa-robot text-purple-500 text-xl" />
        </div>
        <p className="text-sm text-zinc-500">No analysis available</p>
        <p className="text-xs text-zinc-400 mt-1">Select a vox to see AI insights</p>
      </div>
    );
  }

  const sentimentConfig = getSentimentConfig(analysis.sentiment);
  const urgencyConfig = getUrgencyConfig(analysis.urgency);

  // Section header component
  const SectionHeader: React.FC<{
    icon: string;
    title: string;
    sectionKey: string;
    count?: number;
    color?: string;
  }> = ({ icon, title, sectionKey, count, color = 'text-zinc-700 dark:text-zinc-300' }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between py-2 text-left group"
    >
      <div className="flex items-center gap-2">
        <i className={`fa-solid ${icon} text-sm ${color}`} />
        <span className={`text-sm font-semibold ${color}`}>{title}</span>
        {count !== undefined && count > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded">
            {count}
          </span>
        )}
      </div>
      <i className={`fa-solid fa-chevron-${expandedSections.has(sectionKey) ? 'up' : 'down'} text-xs text-zinc-400 group-hover:text-zinc-600`} />
    </button>
  );

  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <i className="fa-solid fa-robot text-white text-sm" />
            </div>
            <div>
              <h3 className="font-bold text-sm dark:text-white">AI Analysis</h3>
              <p className="text-[10px] text-zinc-500">
                Analyzed {new Date(analysis.analyzedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-white/50 dark:hover:bg-zinc-800 flex items-center justify-center transition"
            >
              <i className="fa-solid fa-times text-zinc-400" />
            </button>
          )}
        </div>

        {/* Sentiment & Urgency Badges */}
        <div className="flex gap-2 mt-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sentimentConfig.bg} ${sentimentConfig.color}`}>
            <i className={`fa-solid ${sentimentConfig.icon}`} />
            {sentimentConfig.label}
          </div>
          {analysis.urgency !== 'low' && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${urgencyConfig.bg} ${urgencyConfig.color}`}>
              <i className={`fa-solid ${urgencyConfig.icon}`} />
              {urgencyConfig.label}
            </div>
          )}
          {analysis.emotion && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-500">
              <i className="fa-solid fa-heart-pulse" />
              {analysis.emotion}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`divide-y divide-zinc-100 dark:divide-zinc-800 ${compact ? 'max-h-96 overflow-y-auto' : ''}`}>
        {/* Summary */}
        <div className="p-4">
          <SectionHeader icon="fa-align-left" title="Summary" sectionKey="summary" color="text-purple-600" />
          {expandedSections.has('summary') && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-2 pl-6">
              {analysis.summary}
            </p>
          )}
        </div>

        {/* Key Points */}
        {analysis.keyPoints.length > 0 && (
          <div className="p-4">
            <SectionHeader icon="fa-list-check" title="Key Points" sectionKey="keyPoints" count={analysis.keyPoints.length} color="text-blue-600" />
            {expandedSections.has('keyPoints') && (
              <ul className="mt-2 pl-6 space-y-1.5">
                {analysis.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="text-blue-500 mt-1">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Action Items */}
        {analysis.actionItems.length > 0 && (
          <div className="p-4">
            <SectionHeader icon="fa-tasks" title="Action Items" sectionKey="actionItems" count={analysis.actionItems.length} color="text-emerald-600" />
            {expandedSections.has('actionItems') && (
              <ul className="mt-2 pl-6 space-y-2">
                {analysis.actionItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2 group cursor-pointer"
                    onClick={() => onActionItemClick?.(item)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onActionItemToggle?.(item.id);
                      }}
                      className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition ${
                        item.completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-600 group-hover:border-emerald-500'
                      }`}
                    >
                      {item.completed && <i className="fa-solid fa-check text-[8px]" />}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm ${item.completed ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {item.text}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                        {item.assignedTo && (
                          <span className="text-[9px] text-zinc-400">
                            <i className="fa-solid fa-user mr-1" />
                            {item.assignedTo}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Questions */}
        {analysis.questions.length > 0 && (
          <div className="p-4">
            <SectionHeader icon="fa-circle-question" title="Questions Asked" sectionKey="questions" count={analysis.questions.length} color="text-amber-600" />
            {expandedSections.has('questions') && (
              <ul className="mt-2 pl-6 space-y-1.5">
                {analysis.questions.map((question, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <i className="fa-solid fa-question-circle text-amber-500 mt-0.5" />
                    {question}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Suggested Responses */}
        {analysis.suggestedResponses.length > 0 && (
          <div className="p-4">
            <SectionHeader icon="fa-reply" title="Suggested Responses" sectionKey="responses" count={analysis.suggestedResponses.length} color="text-pink-600" />
            {expandedSections.has('responses') && (
              <div className="mt-2 pl-6 space-y-2">
                {analysis.suggestedResponses.map((response) => (
                  <button
                    key={response.id}
                    onClick={() => onResponseSelect?.(response)}
                    className="w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-pink-300 dark:hover:border-pink-700 hover:bg-pink-50 dark:hover:bg-pink-900/10 transition group"
                  >
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-pink-700 dark:group-hover:text-pink-300">
                      "{response.text}"
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 capitalize">
                        {response.tone}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 capitalize">
                        {response.intent}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Follow-up Suggestions */}
        {analysis.suggestedFollowUps.length > 0 && (
          <div className="p-4">
            <SectionHeader icon="fa-lightbulb" title="Follow-up Ideas" sectionKey="followups" count={analysis.suggestedFollowUps.length} color="text-cyan-600" />
            {expandedSections.has('followups') && (
              <div className="mt-2 pl-6 flex flex-wrap gap-2">
                {analysis.suggestedFollowUps.map((followUp, i) => (
                  <button
                    key={i}
                    onClick={() => onFollowUpSelect?.(followUp)}
                    className="px-3 py-1.5 text-xs bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 rounded-full hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Topics */}
        {analysis.topics.length > 0 && (
          <div className="p-4">
            <SectionHeader icon="fa-tags" title="Topics" sectionKey="topics" count={analysis.topics.length} />
            {expandedSections.has('topics') && (
              <div className="mt-2 pl-6 flex flex-wrap gap-1.5">
                {analysis.topics.map((topic, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mentions */}
        {(analysis.mentions.people.length > 0 || analysis.mentions.dates.length > 0 || analysis.mentions.locations.length > 0) && (
          <div className="p-4">
            <SectionHeader icon="fa-at" title="Mentions" sectionKey="mentions" />
            {expandedSections.has('mentions') && (
              <div className="mt-2 pl-6 space-y-2">
                {analysis.mentions.people.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">People:</span>
                    {analysis.mentions.people.map((person, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded">
                        <i className="fa-solid fa-user mr-1" />
                        {person}
                      </span>
                    ))}
                  </div>
                )}
                {analysis.mentions.dates.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Dates:</span>
                    {analysis.mentions.dates.map((date, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded">
                        <i className="fa-solid fa-calendar mr-1" />
                        {date.text}
                      </span>
                    ))}
                  </div>
                )}
                {analysis.mentions.locations.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Places:</span>
                    {analysis.mentions.locations.map((loc, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded">
                        <i className="fa-solid fa-location-dot mr-1" />
                        {loc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <p className="text-[10px] text-zinc-400 text-center">
          <i className="fa-solid fa-sparkles mr-1" />
          Analysis took {analysis.processingTime}ms
        </p>
      </div>
    </div>
  );
};

// ============================================
// COMPACT ANALYSIS BADGE (For message bubbles)
// ============================================

interface AnalysisBadgeProps {
  analysis: VoxAnalysis;
  onClick?: () => void;
}

export const AnalysisBadge: React.FC<AnalysisBadgeProps> = ({ analysis, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition text-xs"
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
    </button>
  );
};

export default AIAnalysisPanel;
