// src/components/Messages/MeetingRecapCard.tsx
// Rich meeting summary card for Entomate bot messages
// Supports MIP (Meeting Intelligence Profiles) enriched recaps

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, CheckSquare, MessageSquare, Star, Sparkles } from 'lucide-react';
import { AIProvenanceTag } from '../shared/AIProvenanceTag';
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

  const profile = metadata.intelligenceProfile;
  const hasProfile = !!profile;

  const sentimentConfig = {
    positive: { emoji: '😊', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    negative: { emoji: '😔', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
    neutral: { emoji: '😐', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
  };

  const sentiment = metadata.sentiment || 'neutral';
  const sentConf = sentimentConfig[sentiment] || sentimentConfig.neutral;

  // Quality score as filled/empty stars (0-1 scale → 1-5 stars)
  const qualityScore = metadata.outputQualityScore;
  const filledStars = qualityScore != null ? Math.round(qualityScore * 5) : 0;

  // Extract summary text (strip markdown headers for display)
  const summaryText = content
    .split('\n')
    .filter(line => !line.startsWith('##') && !line.startsWith('**') && line.trim())
    .slice(0, 3)
    .join(' ')
    .slice(0, 200);

  return (
    <div className="rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[rgba(255,255,255,0.03)] overflow-hidden mt-1">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(244,63,94,0.10)]">
            {hasProfile ? (
              <span className="text-base leading-none">{profile.icon || '📋'}</span>
            ) : (
              <MessageSquare className="w-4 h-4 text-[#f43f5e]" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AIProvenanceTag source="pulse-ai" kind="recap" />
            {hasProfile && (
              <span className="text-sm font-semibold text-zinc-200 dark:text-zinc-100">{profile.name}</span>
            )}
            {/* Sentiment badge */}
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${sentConf.bg} ${sentConf.color}`}>
              <span>{sentConf.emoji}</span>
              <span className="capitalize">{sentiment}</span>
            </div>
            {/* Quality score */}
            {qualityScore != null && (
              <div className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-xs">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`w-2.5 h-2.5 ${
                      i < filledStars ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'
                    }`}
                  />
                ))}
              </div>
            )}
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
          {/* Profile sections (MIP-enriched) — rendered as structured blocks */}
          {hasProfile && metadata.profileSections?.length ? (
            <div className="space-y-3">
              {metadata.profileSections.map((section, i) => (
                <div key={i} className="rounded-lg bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.03)] border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] p-3">
                  <div className="text-[10px] font-mono font-medium text-[#52525b] dark:text-[#b4b4b8] uppercase tracking-[0.1em] mb-1.5">
                    {section.title}
                  </div>
                  <div className="text-sm text-[#0f0f0f] dark:text-[#fafafa] leading-relaxed whitespace-pre-wrap">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Generic markdown content */
            <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {renderMarkdown(content)}
            </div>
          )}

          {/* Key Decisions */}
          {metadata.keyDecisions?.length && (
            <div className="rounded-lg bg-[rgba(244,63,94,0.06)] dark:bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.15)] p-3">
              <div className="text-[10px] font-mono font-medium text-[#e11d48] dark:text-[#fb7185] uppercase tracking-[0.1em] mb-2">
                Key Decisions
              </div>
              <ul className="space-y-1">
                {metadata.keyDecisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#0f0f0f] dark:text-[#fafafa]">
                    <span className="text-[#f43f5e] mt-0.5 flex-shrink-0">•</span>
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

          {/* Context usage footer (MIP only) */}
          {hasProfile && metadata.contextUsed && (
            <div className="flex items-center gap-3 text-[11px] text-zinc-500 pt-1">
              <span>{metadata.contextUsed.participantCount || 0} contacts</span>
              <span className="text-zinc-700">•</span>
              <span>{metadata.contextUsed.pastMeetingsReferenced || 0} past meetings</span>
              <span className="text-zinc-700">•</span>
              <span>{metadata.contextUsed.conversationThreadsUsed || 0} Pulse threads</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="px-4 py-3 border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] flex flex-wrap gap-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction?.(action) || (action.url && window.open(action.url, '_blank'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition bg-[rgba(244,63,94,0.10)] hover:bg-[rgba(244,63,94,0.15)] text-[#e11d48] dark:text-[#fb7185] border border-[rgba(244,63,94,0.20)] hover:border-[rgba(244,63,94,0.35)]"
            >
              {action.action === 'rate_meeting' ? (
                <Star className="w-3 h-3" />
              ) : action.action === 'view_profile' ? (
                <Sparkles className="w-3 h-3" />
              ) : action.url ? (
                <ExternalLink className="w-3 h-3" />
              ) : null}
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
      return <hr key={i} className="border-[rgba(255,255,255,0.10)]/50 my-2" />;
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
