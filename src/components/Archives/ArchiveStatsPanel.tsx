// src/components/Archives/ArchiveStatsPanel.tsx
// Empty-state / stats panel shown when no archive item is selected

import React, { useMemo } from 'react';
import {
  Activity,
  ArrowRight,
  Eye,
  FileText,
  Folder,
  HardDrive,
  Star,
  TrendingUp,
  Wand2,
  Zap,
} from 'lucide-react';
import { useArchiveStore } from '../../store/archiveStore';
import { getTypeConfig, getTypeLabel } from './archiveHelpers';
import type { ArchiveType } from '../../types';

export const ArchiveStatsPanel: React.FC = () => {
  const {
    items,
    hoveredItem,
    driveConnected,
    setActiveFilter,
    setSidebarMode,
    setViewMode,
    setSelectedItem,
  } = useArchiveStore();

  // Compute statistics from items
  const stats = useMemo(() => {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const byType: Record<string, number> = {};
      let starredCount = 0;
      let thisWeekCount = 0;
      let thisMonthCount = 0;
      let pinnedCount = 0;
      const allTags = new Set<string>();

      if (items && Array.isArray(items)) {
        items.forEach(item => {
          if (!item) return;
          byType[item.type] = (byType[item.type] || 0) + 1;
          if (item.starred) starredCount++;
          if (item.pinned) pinnedCount++;
          try {
            const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
            if (itemDate && !isNaN(itemDate.getTime())) {
              if (itemDate >= weekAgo) thisWeekCount++;
              if (itemDate >= monthAgo) thisMonthCount++;
            }
          } catch (e) {
            // Skip invalid dates
          }
          if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => allTags.add(tag));
          }
          if (item.aiTags && Array.isArray(item.aiTags)) {
            item.aiTags.forEach(tag => allTags.add(tag));
          }
        });
      }

      return {
        total: items?.length || 0,
        byType,
        starred: starredCount,
        thisWeek: thisWeekCount,
        thisMonth: thisMonthCount,
        pinned: pinnedCount,
        uniqueTags: allTags.size,
      };
    } catch (error) {
      console.error('[Archives] Error calculating stats:', error);
      return {
        total: 0,
        byType: {},
        starred: 0,
        thisWeek: 0,
        thisMonth: 0,
        pinned: 0,
        uniqueTags: 0,
      };
    }
  }, [items]);

  const previewItem = hoveredItem || (items && items.length > 0 ? items[0] : null) || null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-zinc-50 dark:bg-zinc-950 min-h-0">
      {/* Top Section: Statistics */}
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="text-red-500" />
          Archive Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200 dark:border-zinc-800">
            <div className="text-2xl font-light text-zinc-900 dark:text-white mb-1">{stats?.total ?? 0}</div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono uppercase tracking-wider">Total Items</div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200 dark:border-zinc-800">
            <div className="text-2xl font-light text-amber-500 mb-1">{stats?.starred ?? 0}</div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono uppercase tracking-wider">Starred</div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200 dark:border-zinc-800">
            <div className="text-2xl font-light text-blue-500 mb-1">{stats?.thisWeek ?? 0}</div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono uppercase tracking-wider">This Week</div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200 dark:border-zinc-800">
            <div className="text-2xl font-light text-purple-500 mb-1">{stats?.uniqueTags ?? 0}</div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono uppercase tracking-wider">Tags</div>
          </div>
        </div>

        {/* Type Breakdown */}
        {stats?.byType && Object.keys(stats.byType).length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-600 mb-2 uppercase tracking-wider">By Type</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([type, count]) => {
                  const config = getTypeConfig(type as ArchiveType);
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveFilter(type as ArchiveType)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition hover:scale-105 ${config.bg} ${config.border}`}
                    >
                      <i className={`fa-solid ${config.icon} ${config.color} text-xs`}></i>
                      <span className={`text-[10px] font-medium ${config.color}`}>{getTypeLabel(type as ArchiveType)}</span>
                      <span className={`text-[10px] ${config.color} opacity-60`}>{count}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Middle Section: Preview */}
      {previewItem ? (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                <Eye className="text-red-500" />
                Preview {hoveredItem ? '(Hovering)' : '(Latest)'}
              </h3>
              <button
                onClick={() => setSelectedItem(previewItem)}
                className="text-xs text-red-500 hover:text-red-400 transition flex items-center gap-1"
                title="View full item"
              >
                View Full <ArrowRight className="text-[10px]" />
              </button>
            </div>
            <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 hover:border-red-500/30 transition">
              <div className="flex items-center gap-3 mb-3">
                {(() => {
                  const config = getTypeConfig(previewItem.type);
                  return (
                    <div className={`px-2.5 py-1 rounded-lg ${config.bg} ${config.border} border flex items-center gap-1.5`}>
                      <i className={`fa-solid ${config.icon} ${config.color} text-xs`}></i>
                      <span className={`text-[10px] font-mono uppercase tracking-wider ${config.color}`}>
                        {getTypeLabel(previewItem.type)}
                      </span>
                    </div>
                  );
                })()}
                <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono">
                  {(() => {
                    try {
                      const date = previewItem.date instanceof Date ? previewItem.date : new Date(previewItem.date);
                      return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                    } catch (e) {
                      return 'Invalid date';
                    }
                  })()}
                </span>
                {previewItem.starred && <Star className="text-amber-500 text-xs" />}
              </div>
              <h4 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">{previewItem.title}</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-4 leading-relaxed">{previewItem.content}</p>
              {(previewItem.tags?.length > 0 || previewItem.aiTags?.length) && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {previewItem.tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-[10px] text-zinc-500 font-mono">
                      #{tag}
                    </span>
                  ))}
                  {previewItem.aiTags?.slice(0, 2).map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-500 font-mono">
                      <Wand2 className="mr-1 text-[8px]" />{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <FileText className="text-2xl text-zinc-400 dark:text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-600">No items to preview</p>
          </div>
        </div>
      )}

      {/* Bottom Section: Quick Actions */}
      <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="text-red-500" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => setActiveFilter('starred')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5 transition group"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition">
              <Star className="text-amber-500" />
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Starred Items</span>
          </button>
          <button
            onClick={() => setSidebarMode('collections')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-red-500/50 hover:bg-red-500/5 transition group"
          >
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition">
              <Folder className="text-red-500" />
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Collections</span>
          </button>
          <button
            onClick={() => setSidebarMode('smart-folders')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50 hover:bg-purple-500/5 transition group"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition">
              <Wand2 className="text-purple-500" />
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Smart Folders</span>
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition group"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition">
              <Activity className="text-blue-500" />
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Timeline View</span>
          </button>
        </div>
        {driveConnected && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2 text-xs text-blue-500">
            <HardDrive />
            <span>Google Drive connected</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchiveStatsPanel;
