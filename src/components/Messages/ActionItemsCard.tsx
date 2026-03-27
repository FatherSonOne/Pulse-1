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
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden mt-1">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-500/10">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-lg">
          ✅
        </div>
        <div>
          <span className="text-sm font-semibold text-emerald-300">Task Assigned</span>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/25 hover:border-emerald-500/40 transition"
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
