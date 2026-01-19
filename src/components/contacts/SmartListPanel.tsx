// ============================================
// SMART LIST PANEL COMPONENT
// Functional smart lists for the contacts sidebar
// ============================================

import React from 'react';
import { SmartListType, SYSTEM_SMART_LISTS } from '../../types/relationshipTypes';

interface SmartListPanelProps {
  activeList: SmartListType | null;
  counts: Partial<Record<SmartListType, number>>;
  onSelectList: (listType: SmartListType | null) => void;
  isLoading?: boolean;
  compact?: boolean;
}

export const SmartListPanel: React.FC<SmartListPanelProps> = ({
  activeList,
  counts,
  onSelectList,
  isLoading = false,
  compact = false,
}) => {
  // Filter to show main smart lists
  const mainLists = SYSTEM_SMART_LISTS.filter(list =>
    ['needs_follow_up', 'warm_leads', 'inactive_30_days', 'vip', 'hot_leads', 'at_risk'].includes(list.id)
  );

  return (
    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex-1 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Smart Lists (AI)
        </h2>
        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded font-bold">
          BETA
        </span>
      </div>

      <div className="space-y-1">
        {mainLists.map((list) => {
          const count = counts[list.id] || 0;
          const isActive = activeList === list.id;

          return (
            <button
              key={list.id}
              onClick={() => onSelectList(isActive ? null : list.id)}
              disabled={isLoading}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between group transition ${
                isActive
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white ring-1 ring-purple-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
                  style={{ backgroundColor: `${list.color}20`, color: list.color }}
                >
                  <i className={list.icon}></i>
                </span>
                <span className="truncate">{list.name}</span>
              </span>

              {count > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full transition ${
                    isActive
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-white dark:group-hover:bg-zinc-700'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick stats at bottom */}
      <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <i className="fa-solid fa-fire text-orange-500 text-xs"></i>
              <span className="text-xs text-orange-700 dark:text-orange-400 font-medium">Hot</span>
            </div>
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {counts.hot_leads || 0}
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/10 dark:to-rose-900/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <i className="fa-solid fa-triangle-exclamation text-red-500 text-xs"></i>
              <span className="text-xs text-red-700 dark:text-red-400 font-medium">At Risk</span>
            </div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {counts.at_risk || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartListPanel;
