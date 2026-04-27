// VoxConversationSummary - AI-powered conversation summary display
// Shows overview, key points, action items from a conversation

import React from 'react';
import { FileText, CheckCircle, Users, Clock, MessageSquare, Sparkles } from 'lucide-react';
import { ConversationSummary } from '../../services/relay/voxerAIService';

interface VoxConversationSummaryProps {
  summary: ConversationSummary;
  isDarkMode?: boolean;
  accentColor?: string;
  onClose?: () => void;
}

export const VoxConversationSummary: React.FC<VoxConversationSummaryProps> = ({
  summary,
  isDarkMode = false,
  accentColor = '#8B5CF6',
  onClose,
}) => {
  const tc = {
    bg: isDarkMode ? 'bg-zinc-900' : 'bg-white',
    border: isDarkMode ? 'border-zinc-700' : 'border-zinc-200',
    text: isDarkMode ? 'text-white' : 'text-zinc-900',
    textSecondary: isDarkMode ? 'text-zinc-400' : 'text-zinc-600',
    textMuted: isDarkMode ? 'text-zinc-500' : 'text-zinc-400',
    cardBg: isDarkMode ? 'bg-zinc-800/50' : 'bg-zinc-50',
    hoverBg: isDarkMode ? 'hover:bg-zinc-700/50' : 'hover:bg-zinc-100',
  };

  return (
    <div className={`rounded-xl border ${tc.border} ${tc.bg} overflow-hidden shadow-lg`}>
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}05)`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}20` }}
          >
            <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${tc.text}`}>AI Summary</h3>
            <p className={`text-xs ${tc.textMuted}`}>Powered by Gemini</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${tc.hoverBg}`}
          >
            <FileText className={`w-4 h-4 ${tc.textSecondary}`} />
          </button>
        )}
      </div>

      {/* Stats Bar */}
      <div className={`px-4 py-2 border-b ${tc.border} flex items-center gap-4 text-xs ${tc.textMuted}`}>
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{summary.messageCount} messages</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>{summary.duration}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>{summary.participants.join(', ')}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Overview */}
        <div>
          <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${tc.textMuted}`}>
            Overview
          </h4>
          <p className={`text-sm leading-relaxed ${tc.textSecondary}`}>
            {summary.overview}
          </p>
        </div>

        {/* Key Points */}
        {summary.keyPoints.length > 0 && (
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${tc.textMuted}`}>
              Key Points
            </h4>
            <ul className="space-y-2">
              {summary.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: accentColor }}
                  />
                  <span className={`text-sm ${tc.textSecondary}`}>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items */}
        {summary.actionItems.length > 0 && (
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${tc.textMuted}`}>
              Action Items
            </h4>
            <ul className="space-y-2">
              {summary.actionItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: accentColor }}
                  />
                  <span className={`text-sm ${tc.textSecondary}`}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoxConversationSummary;
