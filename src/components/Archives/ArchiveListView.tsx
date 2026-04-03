// src/components/Archives/ArchiveListView.tsx
// List view with items grouped by date

import React from 'react';
import { Check, HardDrive, Star, Wand2 } from 'lucide-react';
import type { ArchiveItem } from '../../types';
import { useArchiveStore } from '../../store/archiveStore';
import { getTypeConfig, getTypeLabel } from './archiveHelpers';

interface ArchiveListViewProps {
  groupedItems: Record<string, ArchiveItem[]>;
}

export const ArchiveListView: React.FC<ArchiveListViewProps> = ({ groupedItems }) => {
  const { selectedItem, selectedItems, hoveredItem, setSelectedItem, setHoveredItem, toggleSelectItem } = useArchiveStore();

  const handleSelectItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelectItem(id);
  };

  return (
    <>
      {Object.entries(groupedItems).map(([dateLabel, groupItems]) => (
        <div key={dateLabel} className="mb-6">
          <div className="px-3 py-2 text-[10px] font-mono text-zinc-500 dark:text-zinc-600 uppercase tracking-widest sticky top-0 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm z-10 flex items-center gap-2">
            <div className="w-1 h-1 bg-red-500 rounded-full"></div>
            {dateLabel}
          </div>
          {(groupItems as ArchiveItem[]).map(item => {
            const config = getTypeConfig(item.type);
            const isSelected = selectedItems.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => { setSelectedItem(item); setHoveredItem(null); }}
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`p-4 rounded-xl cursor-pointer transition-all mb-2 border group ${
                  selectedItem?.id === item.id
                    ? 'bg-red-500/5 border-red-500/30'
                    : isSelected
                    ? 'bg-blue-500/5 border-blue-500/30'
                    : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Selection checkbox */}
                  <button
                    onClick={(e) => handleSelectItem(item.id, e)}
                    className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition ${
                      isSelected
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'border-zinc-300 dark:border-zinc-700 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isSelected && <Check className="text-[10px]" />}
                  </button>
                  <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <i className={`fa-solid ${config.icon} ${config.color} text-sm`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-mono uppercase tracking-wider ${selectedItem?.id === item.id ? 'text-red-400' : 'text-zinc-500 dark:text-zinc-600'}`}>
                        {getTypeLabel(item.type)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {item.starred && <Star className="text-amber-500 text-[10px]" />}
                        {item.driveFileId && <HardDrive className="text-blue-500 text-[10px]" />}
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono">
                          {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-medium text-sm text-zinc-900 dark:text-white mb-1 line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{item.content}</p>
                    {(item.tags?.length > 0 || item.aiTags?.length) && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {item.tags?.slice(0, 2).map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] text-zinc-500 font-mono">
                            #{tag}
                          </span>
                        ))}
                        {item.aiTags?.slice(0, 2).map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 bg-red-500/10 rounded text-[9px] text-red-500 font-mono">
                            <Wand2 className="mr-0.5" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
};

export default ArchiveListView;
