/**
 * CategoryTabs Component - Minimalist CMF Nothing Design
 * Clean navigation tabs with subtle category indicators
 */

import React from 'react';
import { ToolCategory } from './types';
import { CATEGORIES, getCategoryColor } from './toolsData';

interface CategoryTabsProps {
  activeCategory: ToolCategory | 'all';
  onCategoryChange: (category: ToolCategory | 'all') => void;
  toolCounts?: Record<string, number>;
}

const CategoryTabsBase: React.FC<CategoryTabsProps> = ({
  activeCategory,
  onCategoryChange,
  toolCounts = {}
}) => {
  const allCategories = [
    { id: 'all' as const, name: 'ALL', icon: 'fa-grid', color: 'zinc', dot: 'bg-zinc-400' },
    ...CATEGORIES.map(cat => ({
      ...cat,
      dot: getCategoryColor(cat.id as ToolCategory).dot
    }))
  ];

  return (
    <div className="space-y-3" role="tablist">
      {allCategories.map((category, index) => {
        const isActive = activeCategory === category.id;
        const count = category.id === 'all'
          ? Object.values(toolCounts).reduce((sum, count) => sum + count, 0)
          : toolCounts[category.id] || 0;

        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={isActive ? 'true' : 'false'}
            aria-controls={`tabpanel-${String(category.id)}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onCategoryChange(category.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && index < allCategories.length - 1) {
                e.preventDefault();
                onCategoryChange(allCategories[index + 1].id);
              } else if (e.key === 'ArrowUp' && index > 0) {
                e.preventDefault();
                onCategoryChange(allCategories[index - 1].id);
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCategoryChange(category.id);
              }
            }}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5
              text-sm font-medium text-left
              border-l-2 transition-colors duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2
              ${isActive
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-800/50'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200'
              }
            `}
          >
            {/* Category Dot Indicator */}
            <div className={`w-1 h-1 rounded-full ${category.dot} flex-shrink-0`} />

            {/* Category Name */}
            <span className="flex-1 tracking-wide text-xs uppercase font-bold">
              {category.name}
            </span>

            {/* Count Badge */}
            {count > 0 && (
              <span className={`
                min-w-[20px] h-5 px-1.5 rounded
                flex items-center justify-center
                text-[10px] font-bold
                ${isActive
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }
              `}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export const CategoryTabs = React.memo(CategoryTabsBase);
CategoryTabs.displayName = 'CategoryTabs';
