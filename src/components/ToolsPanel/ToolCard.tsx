/**
 * ToolCard Component - Minimalist CMF Nothing Design
 * Clean, high-contrast design inspired by Nothing's aesthetic
 */

import React from 'react';
import { Tool } from './types';
import { getCategoryColor } from './toolsData';

import { BarChart2, Key } from 'lucide-react';

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
        border rounded-lg
        p-4
        cursor-pointer
        transition-colors duration-200
        ${isActive
          ? 'border-[#D71921] dark:border-[#D71921]'
          : `${colors.border} hover:border-zinc-300 dark:hover:border-zinc-700`
        }
      `}
      onClick={() => onSelect(tool.id)}
    >
      {/* Category Indicator Dot (4px) */}
      <div
        className={`absolute top-3 left-3 w-1 h-1 rounded-full ${colors.dot}`}
        aria-hidden="true"
      />

      {/* Pin Button */}
      {onPin && (
        <button
          type="button"
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
              ? 'text-[#D71921] dark:text-[#D71921]'
              : 'text-zinc-400 hover:text-[#D71921] dark:hover:text-[#D71921]'
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
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded">
            New
          </span>
        )}
        {tool.isPro && (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded">
            Pro
          </span>
        )}
      </div>

      {/* Icon - Monochrome with category accent on hover */}
      <div className={`
        w-10 h-10 rounded-lg
        flex items-center justify-center
        mb-3
        ${colors.bg}
        transition-colors duration-200
      `}>
        <i className={`fa-solid ${tool.icon} text-lg text-zinc-600 dark:text-zinc-300 group-hover:${colors.text} transition-colors`}></i>
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-white leading-snug">
          {tool.name}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
          {tool.description}
        </p>
      </div>

      {/* Footer - Minimal indicators */}
      <div className="mt-4 flex items-center justify-between text-xs">
        {/* Usage count */}
        {usageCount > 0 ? (
          <div className="flex items-center gap-1 text-zinc-400">
            <BarChart2 className="text-[10px]" />
            <span>{usageCount}</span>
          </div>
        ) : (
          <div />
        )}

        {/* API Key indicator */}
        {tool.requiresApiKey && (
          <div
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            title={`Requires ${tool.apiKeyName} API key`}
          >
            <Key className="text-[10px]" />
          </div>
        )}
      </div>
    </div>
  );
};
