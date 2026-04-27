// VoxSmartReplies - AI-generated quick reply suggestions
// Shows 3 smart reply options with different tones

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import { SmartReply } from '../../services/relay/relayAIService';

interface VoxSmartRepliesProps {
  replies: SmartReply[];
  onSelectReply: (reply: string) => void;
  isLoading?: boolean;
  isDarkMode?: boolean;
  accentColor?: string;
}

const TONE_ICONS = {
  professional: '💼',
  casual: '😊',
  friendly: '👋',
};

const TONE_LABELS = {
  professional: 'Professional',
  casual: 'Casual',
  friendly: 'Friendly',
};

export const VoxSmartReplies: React.FC<VoxSmartRepliesProps> = ({
  replies,
  onSelectReply,
  isLoading = false,
  isDarkMode = false,
  accentColor = '#8B5CF6',
}) => {
  const tc = {
    bg: isDarkMode ? 'bg-zinc-900' : 'bg-white',
    border: isDarkMode ? 'border-zinc-700' : 'border-zinc-200',
    text: isDarkMode ? 'text-white' : 'text-zinc-900',
    textSecondary: isDarkMode ? 'text-zinc-400' : 'text-zinc-600',
    textMuted: isDarkMode ? 'text-zinc-500' : 'text-zinc-400',
    cardBg: isDarkMode ? 'bg-zinc-800/50' : 'bg-zinc-50',
    hoverBg: isDarkMode ? 'hover:bg-zinc-700' : 'hover:bg-zinc-100',
  };

  if (isLoading) {
    return (
      <div className={`p-4 rounded-xl border ${tc.border} ${tc.bg}`}>
        <div className="flex items-center gap-2 mb-3">
          <AIProvenanceChip vendor="PULSE AI" type="SUGGESTED" />
          <span className={`text-xs ${tc.textMuted}`}>generating…</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-12 rounded-lg ${tc.cardBg} animate-pulse`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (replies.length === 0) {
    return null;
  }

  return (
    <div className={`p-4 rounded-xl border ${tc.border} ${tc.bg}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <AIProvenanceChip vendor="PULSE AI" type="SUGGESTED" />
      </div>

      {/* Reply Options */}
      <div className="space-y-2">
        {replies.map((reply, index) => (
          <button
            key={index}
            onClick={() => onSelectReply(reply.text)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${tc.border} ${tc.cardBg} ${tc.hoverBg}`}
            style={{
              borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg mt-0.5">{TONE_ICONS[reply.tone]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${tc.textMuted}`}>
                    {TONE_LABELS[reply.tone]}
                  </span>
                  <span className={`text-xs ${tc.textMuted}`}>•</span>
                  <span className={`text-xs ${tc.textMuted} capitalize`}>
                    {reply.length}
                  </span>
                </div>
                <p className={`text-sm ${tc.textSecondary} line-clamp-2`}>
                  {reply.text}
                </p>
              </div>
              <MessageCircle className={`w-4 h-4 ${tc.textMuted} flex-shrink-0 mt-0.5`} />
            </div>
          </button>
        ))}
      </div>

      <p className={`text-xs ${tc.textMuted} mt-3 text-center`}>
        Tap a reply to use it as your voice message
      </p>
    </div>
  );
};

export default React.memo(VoxSmartReplies);
