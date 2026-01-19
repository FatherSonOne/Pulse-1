// AI Mediator Panel - Conflict Detection and Resolution Assistant
import React, { useState, useEffect } from 'react';

interface ConflictSignal {
  id: string;
  type: 'tension' | 'disagreement' | 'frustration' | 'miscommunication';
  severity: 'low' | 'medium' | 'high';
  message: string;
  context: string;
  timestamp: Date;
}

interface MediationSuggestion {
  id: string;
  type: 'rephrase' | 'clarify' | 'acknowledge' | 'pause' | 'escalate';
  title: string;
  description: string;
  suggestedText?: string;
  actionLabel: string;
}

interface AIMediatorPanelProps {
  messages: Array<{ id: string; text: string; sender: string; timestamp: Date }>;
  contactName: string;
  onApplySuggestion: (suggestion: MediationSuggestion) => void;
  onDismiss: () => void;
  apiKey?: string;
}

// Conflict detection helper
const detectConflicts = (messages: AIMediatorPanelProps['messages']): ConflictSignal[] => {
  const signals: ConflictSignal[] = [];

  const tensionWords = ['but', 'however', 'actually', 'wrong', 'no', 'disagree', 'problem'];
  const frustrationWords = ['again', 'always', 'never', 'still', 'waiting', 'frustrated', 'annoyed'];
  const escalationWords = ['urgent', 'immediately', 'unacceptable', 'disappointed', 'concerned'];

  messages.slice(-10).forEach((msg, index) => {
    const text = msg.text?.toLowerCase() || '';

    // Check for tension
    const tensionCount = tensionWords.filter(w => text.includes(w)).length;
    if (tensionCount >= 2) {
      signals.push({
        id: `tension-${msg.id}`,
        type: 'tension',
        severity: tensionCount >= 3 ? 'high' : 'medium',
        message: 'Potential tension detected in this message',
        context: msg.text.slice(0, 100),
        timestamp: msg.timestamp
      });
    }

    // Check for frustration
    const frustrationCount = frustrationWords.filter(w => text.includes(w)).length;
    if (frustrationCount >= 1) {
      signals.push({
        id: `frustration-${msg.id}`,
        type: 'frustration',
        severity: frustrationCount >= 2 ? 'high' : 'low',
        message: 'Signs of frustration in this message',
        context: msg.text.slice(0, 100),
        timestamp: msg.timestamp
      });
    }

    // Check for escalation language
    const escalationCount = escalationWords.filter(w => text.includes(w)).length;
    if (escalationCount >= 1) {
      signals.push({
        id: `escalation-${msg.id}`,
        type: 'disagreement',
        severity: 'high',
        message: 'Elevated language detected',
        context: msg.text.slice(0, 100),
        timestamp: msg.timestamp
      });
    }

    // Check for question followed by no response (miscommunication)
    if (msg.text?.includes('?') && index < messages.length - 1) {
      const nextMsg = messages[index + 1];
      if (nextMsg && nextMsg.sender === msg.sender) {
        signals.push({
          id: `miscomm-${msg.id}`,
          type: 'miscommunication',
          severity: 'low',
          message: 'Question may not have been addressed',
          context: msg.text.slice(0, 100),
          timestamp: msg.timestamp
        });
      }
    }
  });

  return signals;
};

// Generate mediation suggestions
const generateSuggestions = (signals: ConflictSignal[], contactName: string): MediationSuggestion[] => {
  const suggestions: MediationSuggestion[] = [];

  const highSeverityCount = signals.filter(s => s.severity === 'high').length;
  const hasTension = signals.some(s => s.type === 'tension');
  const hasFrustration = signals.some(s => s.type === 'frustration');
  const hasMiscommunication = signals.some(s => s.type === 'miscommunication');

  if (highSeverityCount >= 2) {
    suggestions.push({
      id: 'pause',
      type: 'pause',
      title: 'Take a Strategic Pause',
      description: 'The conversation seems heated. Consider stepping back for a moment.',
      suggestedText: `I want to make sure we're on the same page. Let me take a moment to gather my thoughts, and I'll get back to you shortly.`,
      actionLabel: 'Send Pause Message'
    });
  }

  if (hasTension) {
    suggestions.push({
      id: 'acknowledge',
      type: 'acknowledge',
      title: 'Acknowledge Their Perspective',
      description: 'Show that you understand their point of view, even if you disagree.',
      suggestedText: `I hear what you're saying, and I appreciate you sharing your perspective. Let me address your concerns...`,
      actionLabel: 'Use This Opening'
    });
  }

  if (hasFrustration) {
    suggestions.push({
      id: 'empathize',
      type: 'clarify',
      title: 'Express Empathy',
      description: `${contactName} seems frustrated. Acknowledging their feelings can help.`,
      suggestedText: `I understand this has been frustrating, and I appreciate your patience. Here's what I'm doing to help...`,
      actionLabel: 'Use Empathetic Response'
    });
  }

  if (hasMiscommunication) {
    suggestions.push({
      id: 'clarify',
      type: 'clarify',
      title: 'Seek Clarification',
      description: 'Some questions may have been missed. Help ensure alignment.',
      suggestedText: `Just to make sure I haven't missed anything - could you help me understand what you meant by...?`,
      actionLabel: 'Ask for Clarification'
    });
  }

  if (signals.length > 0) {
    suggestions.push({
      id: 'rephrase',
      type: 'rephrase',
      title: 'Soften Your Message',
      description: 'Consider rephrasing to reduce potential friction.',
      actionLabel: 'Get Rephrasing Help'
    });
  }

  if (highSeverityCount >= 3) {
    suggestions.push({
      id: 'escalate',
      type: 'escalate',
      title: 'Consider a Call',
      description: 'Complex issues are often better resolved through a quick call.',
      suggestedText: `I think this might be easier to discuss over a quick call. Would you have 15 minutes today?`,
      actionLabel: 'Suggest a Call'
    });
  }

  return suggestions;
};

export const AIMediatorPanel: React.FC<AIMediatorPanelProps> = ({
  messages,
  contactName,
  onApplySuggestion,
  onDismiss
}) => {
  const [signals, setSignals] = useState<ConflictSignal[]>([]);
  const [suggestions, setSuggestions] = useState<MediationSuggestion[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const detectedSignals = detectConflicts(messages);
    setSignals(detectedSignals);
    setSuggestions(generateSuggestions(detectedSignals, contactName));
  }, [messages, contactName]);

  if (signals.length === 0 || dismissed) return null;

  const highSeverityCount = signals.filter(s => s.severity === 'high').length;
  const alertLevel = highSeverityCount >= 2 ? 'high' : highSeverityCount >= 1 ? 'medium' : 'low';

  const alertColors = {
    high: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20',
    medium: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20',
    low: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
  };

  const alertIcons = {
    high: 'fa-triangle-exclamation text-red-500',
    medium: 'fa-circle-info text-amber-500',
    low: 'fa-lightbulb text-blue-500'
  };

  return (
    <div className={`rounded-xl border-2 ${alertColors[alertLevel]} overflow-hidden animate-slide-up`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            alertLevel === 'high' ? 'bg-red-100 dark:bg-red-900/40' :
            alertLevel === 'medium' ? 'bg-amber-100 dark:bg-amber-900/40' :
            'bg-blue-100 dark:bg-blue-900/40'
          }`}>
            <i className={`fa-solid ${alertIcons[alertLevel]}`} />
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-800 dark:text-white flex items-center gap-2">
              AI Mediator
              {alertLevel === 'high' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-200 uppercase font-bold">
                  Needs Attention
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              {signals.length} signal{signals.length !== 1 ? 's' : ''} detected in conversation
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
              onDismiss();
            }}
            className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-black/20 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <i className="fa-solid fa-times text-xs" />
          </button>
          <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-xs text-zinc-400`} />
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Signals summary */}
          <div className="flex flex-wrap gap-2">
            {signals.slice(0, 3).map(signal => (
              <div
                key={signal.id}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                  signal.severity === 'high' ? 'border-red-300 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                  signal.severity === 'medium' ? 'border-amber-300 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                  'border-blue-300 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}
              >
                <i className={`fa-solid ${
                  signal.type === 'tension' ? 'fa-bolt' :
                  signal.type === 'frustration' ? 'fa-face-frown' :
                  signal.type === 'disagreement' ? 'fa-arrows-left-right' :
                  'fa-question-circle'
                } mr-1.5`} />
                {signal.type}
              </div>
            ))}
          </div>

          {/* Suggestions */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
              Suggestions
            </div>
            {suggestions.map(suggestion => (
              <div
                key={suggestion.id}
                className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-800 dark:text-white">
                      {suggestion.title}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      {suggestion.description}
                    </div>
                    {suggestion.suggestedText && (
                      <div className="mt-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 italic">
                        "{suggestion.suggestedText}"
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onApplySuggestion(suggestion)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                      suggestion.type === 'pause' || suggestion.type === 'escalate'
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-300'
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 dark:text-blue-300'
                    }`}
                  >
                    {suggestion.actionLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick tips */}
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
            <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
              <i className="fa-solid fa-lightbulb text-amber-500" />
              Quick Tips
            </div>
            <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500">•</span>
                Use "I" statements instead of "you" to reduce defensiveness
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500">•</span>
                Acknowledge their point before presenting yours
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500">•</span>
                Ask clarifying questions when unsure
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact indicator for thread list
export const MediatorIndicator: React.FC<{
  messages: Array<{ text: string; sender: string }>;
}> = ({ messages }) => {
  const hasConflict = messages.some(msg => {
    const text = msg.text?.toLowerCase() || '';
    const words = ['frustrated', 'disappointed', 'unacceptable', 'wrong', 'problem', 'issue'];
    return words.filter(w => text.includes(w)).length >= 2;
  });

  if (!hasConflict) return null;

  return (
    <div
      className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
      title="Conflict signals detected"
    />
  );
};

export default AIMediatorPanel;
