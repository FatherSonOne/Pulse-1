// src/components/Messages/MeetingBriefingCard.tsx
// Pre-meeting briefing card — shows upcoming meeting context from Entomate MIP

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Clock, Users, AlertTriangle, Sparkles } from 'lucide-react';
import type { BotMessageMetadata, BotAction } from '../../types/messages';

interface MeetingBriefingCardProps {
  content: string;
  metadata: BotMessageMetadata;
  actions: BotAction[];
  onAction?: (action: BotAction) => void;
}

export const MeetingBriefingCard: React.FC<MeetingBriefingCardProps> = ({
  content, metadata, actions, onAction
}) => {
  const [expanded, setExpanded] = useState(true);

  const profileName = metadata.profileName;
  const scheduledAt = metadata.scheduledAt ? new Date(metadata.scheduledAt) : null;
  const participants = metadata.participants || [];
  const openItems = metadata.openActionItems || [];

  // Calculate time until meeting
  const now = new Date();
  let timeLabel = '';
  let urgent = false;
  if (scheduledAt) {
    const diffMin = Math.round((scheduledAt.getTime() - now.getTime()) / 60000);
    if (diffMin <= 0) {
      timeLabel = 'Starting now';
      urgent = true;
    } else if (diffMin < 60) {
      timeLabel = `In ${diffMin} min`;
      urgent = diffMin <= 15;
    } else {
      const hours = Math.floor(diffMin / 60);
      timeLabel = `In ${hours}h ${diffMin % 60}m`;
    }
  }

  // Extract highlights from content (lines starting with bullet)
  const highlights = content
    .split('\n')
    .filter(line => line.trim().startsWith('•'))
    .map(line => line.trim().replace(/^•\s*/, ''));

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 overflow-hidden mt-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/10">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <span className="text-base leading-none">🔮</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-cyan-300">Meeting Briefing</span>
            {profileName && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400/80 bg-cyan-500/15 border border-cyan-500/25 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                {profileName}
              </span>
            )}
            {timeLabel && (
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${
                urgent
                  ? 'bg-amber-500/15 border-amber-500/25 text-amber-400'
                  : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
              }`}>
                <Clock className="w-2.5 h-2.5" />
                {timeLabel}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-500 hover:text-zinc-300 transition"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsed preview */}
      {!expanded && (
        <div className="px-4 py-2 text-xs text-zinc-400 line-clamp-2">
          {participants.length} participant{participants.length !== 1 ? 's' : ''}
          {openItems.length > 0 && ` • ${openItems.length} open item${openItems.length !== 1 ? 's' : ''}`}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {/* Participants */}
          {participants.length > 0 && (
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Participants
              </div>
              <ul className="space-y-1">
                {participants.map((p: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="text-cyan-400 mt-0.5 flex-shrink-0">•</span>
                    <div>
                      <span className="font-medium text-zinc-200">{p.name}</span>
                      {p.role && <span className="text-zinc-500 ml-1">— {p.role}</span>}
                      {p.meetingCount != null && (
                        <span className="text-zinc-600 ml-1">
                          ({p.meetingCount} previous meeting{p.meetingCount !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Context Highlights */}
          {highlights.length > 0 && (
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                Context Highlights
              </div>
              <ul className="space-y-1">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="text-cyan-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Open Action Items */}
          {openItems.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/15 p-3">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Open Items Going In
              </div>
              <ul className="space-y-1.5">
                {openItems.map((item: any, i: number) => {
                  const isDueSoon = item.dueDate && new Date(item.dueDate) <= new Date(Date.now() + 3 * 86400000);
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 flex-shrink-0 ${isDueSoon ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {isDueSoon ? '⚠️' : '•'}
                      </span>
                      <div>
                        <span className="text-zinc-300">{item.description}</span>
                        {item.assignee && (
                          <span className="text-zinc-500 ml-1">→ {item.assignee}</span>
                        )}
                        {item.dueDate && (
                          <span className={`ml-1 ${isDueSoon ? 'text-amber-400' : 'text-zinc-600'}`}>
                            (due {item.dueDate})
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="px-4 py-3 border-t border-cyan-500/10 flex flex-wrap gap-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction?.(action) || (action.url && window.open(action.url, '_blank'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/25 hover:border-cyan-500/40 transition"
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

export default MeetingBriefingCard;
