// src/components/Messages/ActionItemsCard.tsx
// Task/action item card for Entomate bot messages.
//
// PR 4.4: header chip migrated to the shared `AIProvenanceTag`
// (coral, kind="action"). The surrounding card chrome dropped from
// emerald to neutral because emerald is reserved for status
// (completion, "DONE" chips) under the post-PR-4.4 color vocabulary.
// Priority dot + Flag icon keep their status colors — those are
// genuine urgency signals, not provenance signals.

import React from 'react';
import { ExternalLink, Calendar, User, Flag } from 'lucide-react';
import type { BotMessageMetadata, BotAction } from '../../types/messages';
import { AIProvenanceTag } from '../shared/AIProvenanceTag';

interface ActionItemsCardProps {
  content: string;
  metadata: BotMessageMetadata;
  actions: BotAction[];
  onAction?: (action: BotAction) => void;
}

export const ActionItemsCard: React.FC<ActionItemsCardProps> = ({
  content, metadata, actions, onAction
}) => {
  const priorityConfig: Record<string, { color: string; dot: string }> = {
    high: { color: 'text-rose-400', dot: 'bg-rose-500' },
    medium: { color: 'text-amber-400', dot: 'bg-amber-500' },
    normal: { color: 'text-zinc-300', dot: 'bg-zinc-400' },
    low: { color: 'text-zinc-400', dot: 'bg-zinc-500' },
  };

  const priority = (metadata.actionItems?.[0]?.priority || 'normal').toLowerCase();
  const pConf = priorityConfig[priority] || priorityConfig.normal;
  const assignee = metadata.actionItems?.[0]?.assignee;
  const dueDate = metadata.actionItems?.[0]?.dueDate;

  return (
    <div className="rounded-xl ring-1 ring-zinc-200 dark:ring-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] overflow-hidden mt-1">
      {/* Header — coral provenance chip + task title + priority dot */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/[0.04] ring-1 ring-zinc-200 dark:ring-white/[0.06] flex items-center justify-center text-lg">
          ✅
        </div>
        <div className="flex-1">
          <AIProvenanceTag source="pulse-ai" kind="action" className="mb-1" />
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Task Assigned</div>
          <div className="flex items-center gap-1 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${pConf.dot}`} />
            <span className={`text-xs capitalize ${pConf.color}`}>{priority} priority</span>
          </div>
        </div>
      </div>

      {/* Task details */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-white leading-snug">
          {metadata.actionItems?.[0]?.description || content.split('\n').find(l => l.startsWith('**') && !l.includes('Assigned')) || 'Task'}
        </p>

        <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          {assignee && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{assignee}</span>
            </div>
          )}
          {dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{dueDate}</span>
            </div>
          )}
          {priority !== 'normal' && (
            <div className={`flex items-center gap-1 ${pConf.color}`}>
              <Flag className="w-3 h-3" />
              <span className="capitalize">{priority}</span>
            </div>
          )}
        </div>

        {/* Source note */}
        {metadata.sourceUrl && (
          <div className="text-xs text-zinc-500">
            Via Entomate
          </div>
        )}
      </div>

      {/* Actions — ghost buttons, neutral. The original emerald
          coloring read as "task status"; under the new vocabulary,
          status colors are reserved for actual completion / urgency
          state, not for "click here to act on this." */}
      {actions.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-white/[0.06] flex flex-wrap gap-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction?.(action) || (action.url && window.open(action.url, '_blank'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-[0.1em] font-medium bg-transparent hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200 dark:ring-white/[0.08] hover:ring-zinc-300 dark:hover:ring-white/[0.12] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
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

export default ActionItemsCard;
