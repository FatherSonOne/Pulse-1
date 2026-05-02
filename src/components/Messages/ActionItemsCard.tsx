// src/components/Messages/ActionItemsCard.tsx
// Task/action item card for Entomate bot messages

import React from 'react';
import { ExternalLink, Calendar, User, Flag } from 'lucide-react';
import type { BotMessageMetadata, BotAction } from '../../types/messages';

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
    normal: { color: 'text-blue-400', dot: 'bg-blue-500' },
    low: { color: 'text-zinc-400', dot: 'bg-zinc-500' },
  };

  const priority = (metadata.actionItems?.[0]?.priority || 'normal').toLowerCase();
  const pConf = priorityConfig[priority] || priorityConfig.normal;
  const assignee = metadata.actionItems?.[0]?.assignee;
  const dueDate = metadata.actionItems?.[0]?.dueDate;

  return (
    <div className="rounded-xl ring-1 ring-emerald-500/30 bg-emerald-500/[0.06] overflow-hidden mt-1">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-500/10">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/[0.08] ring-1 ring-emerald-500/20 flex items-center justify-center text-lg">
          ✅
        </div>
        <div className="flex-1">
          <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium text-emerald-700 dark:text-emerald-400 mb-0.5">
            PULSE AI · ACTION ITEMS
          </div>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Task Assigned</span>
          <div className="flex items-center gap-1 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${pConf.dot}`} />
            <span className={`text-xs capitalize ${pConf.color}`}>{priority} priority</span>
          </div>
        </div>
      </div>

      {/* Task details */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm font-medium text-white leading-snug">
          {metadata.actionItems?.[0]?.description || content.split('\n').find(l => l.startsWith('**') && !l.includes('Assigned')) || 'Task'}
        </p>

        <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
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

      {/* Actions */}
      {actions.length > 0 && (
        <div className="px-4 py-3 border-t border-emerald-500/10 flex flex-wrap gap-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction?.(action) || (action.url && window.open(action.url, '_blank'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-[0.1em] font-medium bg-transparent hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30 hover:ring-emerald-500/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
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
