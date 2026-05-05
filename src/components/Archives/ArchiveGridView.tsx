// src/components/Archives/ArchiveGridView.tsx
// 2-column grid of archive item cards

import React from 'react';
import { Check, Star } from 'lucide-react';
import type { ArchiveItem } from '../../types';
import { useArchiveStore } from '../../store/archiveStore';
import { getTypeConfig } from './archiveHelpers';

interface ArchiveGridViewProps {
  items: ArchiveItem[];
}

export const ArchiveGridView: React.FC<ArchiveGridViewProps> = ({ items }) => {
  const { selectedItem, selectedItems, setSelectedItem, setHoveredItem, toggleSelectItem } = useArchiveStore();

  const handleSelectItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelectItem(id);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(item => {
        const config = getTypeConfig(item.type);
        const isSelected = selectedItems.has(item.id);
        return (
          <div
            key={item.id}
            onClick={() => { setSelectedItem(item); setHoveredItem(null); }}
            onMouseEnter={() => setHoveredItem(item)}
            onMouseLeave={() => setHoveredItem(null)}
            className={`p-4 rounded-xl cursor-pointer transition-all border group relative ${
              selectedItem?.id === item.id
                ? 'bg-rose-500/5 border-rose-500/30'
                : isSelected
                ? 'bg-blue-500/5 border-blue-500/30'
                : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            <button
              onClick={(e) => handleSelectItem(item.id, e)}
              className={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition ${
                isSelected
                  ? 'bg-rose-500 border-rose-500 text-white'
                  : 'border-zinc-300 dark:border-zinc-700 opacity-0 group-hover:opacity-100'
              }`}
            >
              {isSelected && <Check className="text-[10px]" />}
            </button>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                <config.Icon className={`${config.color} w-4 h-4`} />
              </div>
              {item.starred && <Star className="text-amber-500 text-xs" />}
            </div>
            <h3 className="font-medium text-xs text-zinc-900 dark:text-white mb-1 line-clamp-2">{item.title}</h3>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono">{item.date.toLocaleDateString()}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ArchiveGridView;
