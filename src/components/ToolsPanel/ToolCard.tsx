/**
 * ToolCard Component
 * Individual tool card with hover effects and badge indicators
 */

import React from 'react';
import { Tool } from './types';
import { getCategoryColor } from './toolsData';

interface ToolCardProps {
  tool: Tool;
  isActive?: boolean;
  isPinned?: boolean;
  usageCount?: number;
  onSelect: (toolId: string) => void;
  onPin?: (toolId: string) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  isActive = false,
  isPinned = false,
  usageCount = 0,
  onSelect,
  onPin
}) => {
  const colors = getCategoryColor(tool.category);

  return (
    <div
      className={`
        relative group
        bg-white dark:bg-zinc-900
        border rounded-xl
        p-4
        cursor-pointer
        transition-all duration-200
        hover:shadow-lg hover:-translate-y-0.5
        ${isActive ? 'ring-2 ring-purple-500 shadow-lg' : ''}
        ${colors.border}
      `}
      onClick={() => onSelect(tool.id)}
    >
      {/* Pin Button */}
      {onPin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPin(tool.id);
          }}
          className={`
            absolute top-2 right-2
            w-6 h-6 rounded-md
            flex items-center justify-center
            opacity-0 group-hover:opacity-100
            transition-opacity duration-200
            ${isPinned
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400'
            }
          `}
          title={isPinned ? 'Unpin tool' : 'Pin tool'}
          aria-label={isPinned ? 'Unpin tool' : 'Pin tool'}
        >
          <i className={`fa-solid ${isPinned ? 'fa-thumbtack' : 'fa-thumbtack'} text-xs`}></i>
        </button>
      )}

      {/* Badges */}
      <div className="absolute top-2 left-2 flex gap-1">
        {tool.isNew && (
          <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-green-500 text-white rounded-md">
            New
          </span>
        )}
        {tool.isPro && (
          <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-purple-500 text-white rounded-md">
            Pro
          </span>
        )}
      </div>

      {/* Icon */}
      <div className={`
        w-12 h-12 rounded-xl
        flex items-center justify-center
        mb-3 mt-6
        ${colors.bg}
        group-hover:scale-110 transition-transform duration-200
      `}>
        <i className={`fa-solid ${tool.icon} text-xl ${colors.text}`}></i>
      </div>

      {/* Content */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          {tool.name}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
          {tool.description}
        </p>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        {/* Usage count */}
        {usageCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <i className="fa-solid fa-chart-simple"></i>
            <span>{usageCount}</span>
          </div>
        )}

        {/* API Key indicator */}
        {tool.requiresApiKey && (
          <div className="flex items-center gap-1 text-xs text-amber-500" title={`Requires ${tool.apiKeyName} API key`}>
            <i className="fa-solid fa-key"></i>
          </div>
        )}
      </div>

      {/* Hover Arrow */}
      <div className="absolute bottom-3 right-3 w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200">
        <i className="fa-solid fa-arrow-right text-zinc-500 dark:text-zinc-400 text-xs"></i>
      </div>
    </div>
  );
};
