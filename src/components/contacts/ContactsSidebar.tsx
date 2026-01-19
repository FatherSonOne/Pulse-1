import React from 'react';
import { Contact } from '../../types';
import { SmartListPanel } from './SmartListPanel';
import { SmartListType, SmartListCounts } from '../../types/relationshipTypes';

interface ContactsSidebarProps {
  filters: {
    status: string | null;
    tag: string | null;
    type: string | null;
  };
  onFilterChange: (type: 'status' | 'tag' | 'type', value: string | null) => void;
  contactGroups: string[];
  counts: {
    total: number;
    online: number;
    offline: number;
  };
  // New relationship intelligence props
  smartListCounts?: SmartListCounts;
  activeSmartList?: SmartListType | null;
  onSmartListSelect?: (listType: SmartListType | null) => void;
  alertCount?: number;
  onViewAlerts?: () => void;
}

export const ContactsSidebar: React.FC<ContactsSidebarProps> = ({
  filters,
  onFilterChange,
  contactGroups,
  counts,
  smartListCounts,
  activeSmartList,
  onSmartListSelect,
  alertCount = 0,
  onViewAlerts,
}) => {
  const PREDEFINED_TAGS = [
    { id: 'vip', label: 'VIP', color: 'bg-amber-500' },
    { id: 'prospect', label: 'Prospect', color: 'bg-blue-500' },
    { id: 'customer', label: 'Customer', color: 'bg-emerald-500' },
    { id: 'partner', label: 'Partner', color: 'bg-purple-500' },
    { id: 'vendor', label: 'Vendor', color: 'bg-cyan-500' },
  ];

  return (
    <div className="w-64 h-full border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col hidden md:flex">
      <div className="p-4">
        <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
          Overview
        </h2>
        <div className="space-y-1">
          <button
            onClick={() => onFilterChange('status', null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between group transition ${
              !filters.status ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-users text-zinc-400"></i>
              All Contacts
            </span>
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-500 group-hover:bg-white dark:group-hover:bg-zinc-700 transition">
              {counts.total}
            </span>
          </button>
          
          <button
            onClick={() => onFilterChange('status', 'online')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between group transition ${
              filters.status === 'online' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Online Now
            </span>
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-500 group-hover:bg-white dark:group-hover:bg-zinc-700 transition">
              {counts.online}
            </span>
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
          Tags & Groups
        </h2>
        <div className="space-y-1">
          {PREDEFINED_TAGS.map(tag => (
            <button
              key={tag.id}
              onClick={() => onFilterChange('tag', filters.tag === tag.id ? null : tag.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                filters.tag === tag.id 
                  ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' 
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${tag.color}`}></div>
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Banner (when there are active alerts) */}
      {alertCount > 0 && onViewAlerts && (
        <div className="px-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onViewAlerts}
            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg border border-orange-200 dark:border-orange-900/30 hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/30 dark:hover:to-amber-900/30 transition"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <i className="fa-solid fa-bell text-orange-500"></i>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-orange-900 dark:text-orange-200">
                  {alertCount} Alert{alertCount !== 1 ? 's' : ''}
                </div>
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  Needs attention
                </div>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-orange-400 text-xs"></i>
          </button>
        </div>
      )}

      {/* Smart Lists Panel */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex-1 overflow-y-auto">
        <SmartListPanel
          counts={smartListCounts || {
            needs_follow_up: 0,
            warm_leads: 0,
            inactive_30_days: 0,
            vip: 0,
            cold_leads: 0,
            recent_contacts: 0,
          }}
          activeList={activeSmartList || null}
          onSelectList={(listType) => {
            // When selecting a smart list, clear other filters
            if (listType) {
              onFilterChange('status', null);
              onFilterChange('tag', null);
              onFilterChange('type', null);
            }
            onSmartListSelect?.(listType);
          }}
          compact={true}
        />
      </div>
    </div>
  );
};
