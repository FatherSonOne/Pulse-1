// src/components/Messages/MeetingRecapCard.tsx
// Rich meeting summary card for Entomate bot messages

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, CheckSquare, MessageSquare } from 'lucide-react';
import type { BotMessageMetadata, BotAction } from '../../types/messages';

interface MeetingRecapCardProps {
  content: string;
  metadata: BotMessageMetadata;
  actions: BotAction[];
  onAction?: (action: BotAction) => void;
}

export const MeetingRecapCard: React.FC<MeetingRecapCardProps> = ({
  content, metadata, actions, onAction
}) => {
  const [expanded, setExpanded] = useState(true);

  const sentimentConfig = {
    positive: { emoji: '😊', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    negative: { emoji: '😔', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
    neutral: { emoji: '😐', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
  };

  const sentiment = metadata.sentiment || 'neutral';
  const sentConf = sentimentConfig[sentiment] || sentimentConfig.neutral;

  // Extract summary text (strip markdown headers for display)
  const summaryText = content
    .split('\n')
    .filter(line => !line.startsWith('##') && !line.startsWith('**') && line.trim())
    .slice(0, 3)
    .join(' ')
    .slice(0, 200);

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden mt-1">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-violet-500/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <span className="text-sm font-semibold text-violet-300">Meeting Recap</span>
            <div className={`inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full border text-xs ${sentConf.bg} ${sentConf.color}`}>
              <span>{sentConf.emoji}</span>
              <span className="capitalize">{sentiment}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-500 hover:text-zinc-300 transition"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsed preview */}
      {!expanded && (
        <div className="px-4 py-2 text-xs text-zinc-400 line-clamp-2">
          {summaryText}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {/* Markdown content rendered simply */}
          <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {renderMarkdown(content)}
          </div>

          {/* Key Decisions */}
          {metadata.keyDecisions?.length && (
            <div className="rounded-lg bg-violet-500/10 border border-violet-500/15 p-3">
              <div className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">
                Key Decisions
              </div>
              <ul className="space-y-1">
                {metadata.keyDecisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="text-violet-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items summary */}
          {metadata.actionItems?.length && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/15 p-3">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <CheckSquare className="w-3 h-3" />
                Action Items ({metadata.actionItems.length})
              </div>
              <ul className="space-y-1.5">
                {metadata.actionItems.slice(0, 5).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                    <div>
                      <span className="text-zinc-300">{item.description}</span>
                      {item.assignee && (
                        <span className="text-zinc-500 ml-2">→ {item.assignee}</span>
                      )}
                    </div>
                  </li>
                ))}
                {metadata.actionItems.length > 5 && (
                  <li className="text-xs text-zinc-500">
                    +{metadata.actionItems.length - 5} more action items
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="px-4 py-3 border-t border-violet-500/10 flex flex-wrap gap-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction?.(action) || (action.url && window.open(action.url, '_blank'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/25 hover:border-violet-500/40 transition"
            >
              {action.url && <ExternalLink className="w-3 h-3" />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Minimal markdown → React elements for bot message content */
function renderMarkdown(text: string): React.ReactNode {
  // Simple line-by-line rendering — not a full parser
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <div key={i} className="text-base font-bold text-white mb-1 mt-2 first:mt-0">
          {line.replace('## ', '')}
        </div>
      );
    }
    if (line.startsWith('### ')) {
      return (
        <div key={i} className="text-sm font-semibold text-zinc-200 mb-1 mt-1">
          {line.replace('### ', '')}
        </div>
      );
    }
    if (line.startsWith('---')) {
      return <hr key={i} className="border-zinc-700/50 my-2" />;
    }
    if (!line.trim()) return <div key={i} className="h-1" />;

    // Bold text
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={i} className="text-sm text-zinc-300 leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>
            : part
        )}
      </div>
    );
  });
}

export default MeetingRecapCard;
