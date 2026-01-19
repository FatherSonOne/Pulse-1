// Enhanced AI Conversation Coach with Real-time Analysis
import React, { useState, useEffect, useMemo } from 'react';
import type { AICoachSuggestion } from '../../types/messageEnhancements';

interface EnhancedCoachSuggestion extends AICoachSuggestion {
  category: 'tone' | 'clarity' | 'timing' | 'structure' | 'empathy' | 'action';
  priority: number;
  quickFix?: string;
}

interface AICoachEnhancedProps {
  draftText: string;
  recentMessages: Array<{ text: string; sender: string; timestamp: Date }>;
  contactName: string;
  onApplySuggestion: (newText: string) => void;
  onDismiss: () => void;
  compact?: boolean;
}

// Analyze draft for potential issues
const analyzeDraft = (
  draft: string,
  recentMessages: AICoachEnhancedProps['recentMessages'],
  contactName: string
): EnhancedCoachSuggestion[] => {
  if (!draft || draft.length < 5) return [];

  const suggestions: EnhancedCoachSuggestion[] = [];
  const lowerDraft = draft.toLowerCase();

  // Check for aggressive language
  const aggressiveWords = ['wrong', 'terrible', 'stupid', 'always', 'never', 'worst'];
  const aggressiveCount = aggressiveWords.filter(w => lowerDraft.includes(w)).length;
  if (aggressiveCount > 0) {
    suggestions.push({
      type: 'tone',
      category: 'tone',
      severity: aggressiveCount >= 2 ? 'critical' : 'warning',
      priority: 1,
      message: 'Your message may sound confrontational',
      suggestion: 'Consider softer alternatives to maintain a positive relationship',
      alternativeText: draft
        .replace(/wrong/gi, 'not quite right')
        .replace(/terrible/gi, 'could be improved')
        .replace(/always/gi, 'often')
        .replace(/never/gi, 'rarely'),
      quickFix: 'Soften language'
    });
  }

  // Check for missing greeting (first message in a while)
  const lastMessageFromMe = recentMessages.filter(m => m.sender === 'me').slice(-1)[0];
  const timeSinceLastMessage = lastMessageFromMe
    ? Date.now() - new Date(lastMessageFromMe.timestamp).getTime()
    : Infinity;
  const daysSinceLastMessage = timeSinceLastMessage / (1000 * 60 * 60 * 24);

  if (daysSinceLastMessage > 3 && !lowerDraft.match(/^(hi|hey|hello|good morning|good afternoon)/)) {
    suggestions.push({
      type: 'tone',
      category: 'empathy',
      severity: 'info',
      priority: 3,
      message: `You haven't messaged ${contactName} in ${Math.floor(daysSinceLastMessage)} days`,
      suggestion: 'Consider adding a greeting to reconnect',
      alternativeText: `Hi ${contactName}! ${draft}`,
      quickFix: 'Add greeting'
    });
  }

  // Check for very long message
  if (draft.length > 500) {
    suggestions.push({
      type: 'clarity',
      category: 'structure',
      severity: 'info',
      priority: 4,
      message: 'Long message detected',
      suggestion: 'Consider breaking this into multiple shorter messages or bullet points for better readability',
      quickFix: 'Format as bullets'
    });
  }

  // Check for questions without question marks
  const questionWords = ['what', 'when', 'where', 'why', 'how', 'can you', 'could you', 'would you', 'do you'];
  const hasQuestionWord = questionWords.some(w => lowerDraft.includes(w));
  if (hasQuestionWord && !draft.includes('?')) {
    suggestions.push({
      type: 'clarity',
      category: 'clarity',
      severity: 'info',
      priority: 5,
      message: 'This seems like a question',
      suggestion: 'Adding a question mark makes it clearer',
      alternativeText: draft.trim() + '?',
      quickFix: 'Add ?'
    });
  }

  // Check for missing action items when discussing tasks
  const taskWords = ['need to', 'should', 'must', 'have to', 'will'];
  const hasTaskLanguage = taskWords.some(w => lowerDraft.includes(w));
  if (hasTaskLanguage && !lowerDraft.includes('by') && !lowerDraft.includes('deadline') && !lowerDraft.includes('when')) {
    suggestions.push({
      type: 'follow-up',
      category: 'action',
      severity: 'info',
      priority: 6,
      message: 'You mentioned a task but no timeline',
      suggestion: 'Adding a deadline helps ensure follow-through',
      quickFix: 'Add deadline'
    });
  }

  // Check for too many "I" statements
  const iCount = (draft.match(/\bi\b/gi) || []).length;
  const youCount = (draft.match(/\byou\b/gi) || []).length;
  if (iCount > 5 && iCount > youCount * 2) {
    suggestions.push({
      type: 'tone',
      category: 'empathy',
      severity: 'info',
      priority: 7,
      message: 'Message is very self-focused',
      suggestion: 'Balancing with "you" language shows you value their perspective'
    });
  }

  // Check for all caps (shouting)
  const capsWords = draft.split(' ').filter(w => w.length > 3 && w === w.toUpperCase());
  if (capsWords.length > 2) {
    suggestions.push({
      type: 'tone',
      category: 'tone',
      severity: 'warning',
      priority: 2,
      message: 'Multiple words in ALL CAPS',
      suggestion: 'This can be perceived as shouting',
      alternativeText: draft.split(' ').map(w =>
        w.length > 3 && w === w.toUpperCase()
          ? w.charAt(0) + w.slice(1).toLowerCase()
          : w
      ).join(' '),
      quickFix: 'Fix caps'
    });
  }

  // Check for double negatives
  if (lowerDraft.includes("don't not") || lowerDraft.includes("can't not") || lowerDraft.includes("won't not")) {
    suggestions.push({
      type: 'clarity',
      category: 'clarity',
      severity: 'warning',
      priority: 3,
      message: 'Double negative detected',
      suggestion: 'Rephrase for clarity'
    });
  }

  // Sort by priority
  return suggestions.sort((a, b) => a.priority - b.priority);
};

const AICoachEnhancedComponent: React.FC<AICoachEnhancedProps> = ({
  draftText,
  recentMessages,
  contactName,
  onApplySuggestion,
  onDismiss,
  compact = false
}) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const suggestions = useMemo(() =>
    analyzeDraft(draftText, recentMessages, contactName)
      .filter((_, idx) => !dismissedIds.has(`${idx}`)),
    [draftText, recentMessages, contactName, dismissedIds]
  );

  const visibleSuggestions = showAll ? suggestions : suggestions.slice(0, 2);
  const hiddenCount = suggestions.length - visibleSuggestions.length;

  if (suggestions.length === 0) return null;

  const handleDismiss = (index: number) => {
    setDismissedIds(prev => new Set([...prev, `${index}`]));
  };

  const getCategoryIcon = (category: EnhancedCoachSuggestion['category']) => {
    switch (category) {
      case 'tone': return 'fa-face-smile';
      case 'clarity': return 'fa-magnifying-glass';
      case 'timing': return 'fa-clock';
      case 'structure': return 'fa-list';
      case 'empathy': return 'fa-heart';
      case 'action': return 'fa-check-square';
      default: return 'fa-lightbulb';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20';
      case 'warning': return 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20';
      default: return 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
          <i className="fa-solid fa-wand-magic-sparkles" />
          <span>{suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}</span>
        </div>
        {suggestions[0]?.quickFix && (
          <button
            onClick={() => suggestions[0].alternativeText && onApplySuggestion(suggestions[0].alternativeText)}
            className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-colors"
          >
            {suggestions[0].quickFix}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 mb-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <i className="fa-solid fa-robot text-purple-500" />
          <span className="font-bold text-zinc-600 dark:text-zinc-300">AI Coach</span>
          <span className="text-zinc-400">•</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
        >
          <i className="fa-solid fa-times text-xs" />
        </button>
      </div>

      {/* Suggestions */}
      {visibleSuggestions.map((suggestion, index) => (
        <div
          key={index}
          className={`border rounded-lg p-3 ${getSeverityColor(suggestion.severity)} animate-fade-in`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              suggestion.severity === 'critical' ? 'bg-red-200 dark:bg-red-800' :
              suggestion.severity === 'warning' ? 'bg-amber-200 dark:bg-amber-800' :
              'bg-blue-200 dark:bg-blue-800'
            }`}>
              <i className={`fa-solid ${getCategoryIcon(suggestion.category)} text-xs ${
                suggestion.severity === 'critical' ? 'text-red-700 dark:text-red-300' :
                suggestion.severity === 'warning' ? 'text-amber-700 dark:text-amber-300' :
                'text-blue-700 dark:text-blue-300'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-zinc-800 dark:text-white">
                    {suggestion.message}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {suggestion.suggestion}
                  </div>
                </div>
                <button
                  onClick={() => handleDismiss(index)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5"
                >
                  <i className="fa-solid fa-times text-[10px]" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-2">
                {suggestion.alternativeText && (
                  <button
                    onClick={() => onApplySuggestion(suggestion.alternativeText!)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex items-center gap-1"
                  >
                    <i className="fa-solid fa-wand-sparkles text-[10px]" />
                    {suggestion.quickFix || 'Apply fix'}
                  </button>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                  {suggestion.category}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Show more */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full text-center text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 py-1"
        >
          Show {hiddenCount} more suggestion{hiddenCount !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
};

export const AICoachEnhanced = React.memo(AICoachEnhancedComponent);

// Compact inline coach tip
export const InlineCoachTip: React.FC<{
  tip: string;
  onApply?: () => void;
  onDismiss: () => void;
}> = ({ tip, onApply, onDismiss }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg animate-fade-in">
      <i className="fa-solid fa-wand-magic-sparkles text-purple-500 text-xs" />
      <span className="text-xs text-purple-700 dark:text-purple-300 flex-1">{tip}</span>
      {onApply && (
        <button
          onClick={onApply}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
        >
          Apply
        </button>
      )}
      <button
        onClick={onDismiss}
        className="text-purple-400 hover:text-purple-600 dark:hover:text-purple-300"
      >
        <i className="fa-solid fa-times text-[10px]" />
      </button>
    </div>
  );
};

export default AICoachEnhanced;
