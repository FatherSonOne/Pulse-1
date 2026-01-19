/**
 * CategoryTabs Component
 * Navigation tabs for tool categories with keyboard support
 */

import React from 'react';
import { ToolCategory } from './types';
import { CATEGORIES } from './toolsData';

interface CategoryTabsProps {
  activeCategory: ToolCategory | 'all';
  onCategoryChange: (category: ToolCategory | 'all') => void;
  toolCounts?: Record<string, number>;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  activeCategory,
  onCategoryChange,
  toolCounts = {}
}) => {
  const allCategories = [
    { id: 'all' as const, name: 'All Tools', icon: 'fa-grid', color: 'zinc' },
    ...CATEGORIES
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    if (isActive) {
      const colorMap: Record<string, string> = {
        purple: 'bg-purple-500 text-white',
        blue: 'bg-blue-500 text-white',
        green: 'bg-green-500 text-white',
        amber: 'bg-amber-500 text-white',
        zinc: 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
      };
      return colorMap[color] || colorMap.zinc;
    }

    return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700';
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1" role="tablist">
      {allCategories.map((category, index) => {
        const isActive = activeCategory === category.id;
        const count = category.id === 'all'
          ? Object.values(toolCounts).reduce((sum, count) => sum + count, 0)
          : toolCounts[category.id] || 0;

        return (
          <button
            key={category.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${category.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onCategoryChange(category.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' && index < allCategories.length - 1) {
                onCategoryChange(allCategories[index + 1].id);
              } else if (e.key === 'ArrowLeft' && index > 0) {
                onCategoryChange(allCategories[index - 1].id);
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCategoryChange(category.id);
              }
            }}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl
              font-medium text-sm whitespace-nowrap
              transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2
              ${isActive ? 'shadow-lg scale-105' : 'hover:scale-102'}
              ${getColorClasses(category.color, isActive)}
            `}
          >
            <i className={`fa-solid ${category.icon}`}></i>
            <span>{category.name}</span>
            {count > 0 && (
              <span className={`
                min-w-[20px] h-5 px-1.5 rounded-full
                flex items-center justify-center
                text-xs font-bold
                ${isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
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
