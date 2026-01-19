/**
 * QuickAccessBar Component
 * Floating bar with recently used and pinned tools
 */

import React from 'react';
import { Tool } from './types';
import { getCategoryColor } from './toolsData';

interface QuickAccessBarProps {
  tools: Tool[];
  onToolSelect: (toolId: string) => void;
  className?: string;
}

export const QuickAccessBar: React.FC<QuickAccessBarProps> = ({
  tools,
  onToolSelect,
  className = ''
}) => {
  if (tools.length === 0) {
    return null;
  }

  return (
    <div
      className={`
        fixed bottom-20 right-6
        flex gap-2 p-2
        bg-zinc-900/90 dark:bg-zinc-950/90
        backdrop-blur-xl
        border border-zinc-700/50 dark:border-zinc-800/50
        rounded-2xl shadow-2xl
        z-50
        animate-fade-in
        ${className}
      `}
      role="toolbar"
      aria-label="Quick access tools"
    >
      {tools.slice(0, 3).map((tool) => {
        const colors = getCategoryColor(tool.category);

        return (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            className="
              group relative
              w-12 h-12 rounded-xl
              flex flex-col items-center justify-center
              bg-zinc-800/50 hover:bg-zinc-700
              border border-zinc-700/30 hover:border-zinc-600
              transition-all duration-200
              hover:-translate-y-1 hover:shadow-lg
              focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500
            "
            title={tool.name}
            aria-label={tool.name}
          >
            {/* Icon */}
            <i className={`fa-solid ${tool.icon} text-base text-zinc-300 group-hover:text-white transition-colors`}></i>

            {/* Badge indicator */}
            <div className={`
              absolute -top-1 -right-1
              w-3 h-3 rounded-full
              ${colors.bg.replace('50', '500')}
              border-2 border-zinc-900
            `}></div>

            {/* Tooltip */}
            <div className="
              absolute bottom-full mb-2
              px-2 py-1 rounded-md
              bg-zinc-800 text-white text-xs font-medium whitespace-nowrap
              opacity-0 group-hover:opacity-100
              pointer-events-none
              transition-opacity duration-200
            ">
              {tool.name}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-zinc-800 rotate-45"></div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

/**
 * Mobile Quick Access Bar
 * Optimized for mobile devices with larger touch targets
 */
export const MobileQuickAccessBar: React.FC<QuickAccessBarProps> = ({
  tools,
  onToolSelect,
  className = ''
}) => {
  if (tools.length === 0) {
    return null;
  }

  return (
    <div
      className={`
        fixed bottom-4 right-4
        flex flex-col gap-2 p-1
        bg-zinc-900/90 backdrop-blur-xl
        border border-zinc-700/50
        rounded-2xl shadow-2xl
        z-50
        animate-fade-in
        ${className}
      `}
      role="toolbar"
      aria-label="Quick access tools"
    >
      {tools.slice(0, 3).map((tool) => {
        const colors = getCategoryColor(tool.category);

        return (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            className="
              relative
              w-11 h-11 rounded-xl
              flex items-center justify-center
              bg-zinc-800/50 active:bg-zinc-700
              border border-zinc-700/30
              transition-colors duration-150
              min-w-[44px] min-h-[44px]
            "
            aria-label={tool.name}
          >
            <i className={`fa-solid ${tool.icon} text-base text-zinc-300`}></i>
            <div className={`
              absolute -top-0.5 -right-0.5
              w-2.5 h-2.5 rounded-full
              ${colors.bg.replace('50', '500')}
              border border-zinc-900
            `}></div>
          </button>
        );
      })}
    </div>
  );
};
