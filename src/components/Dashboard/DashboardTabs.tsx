import React from 'react';

export type DashboardTab = 'today' | 'week' | 'team';

interface DashboardTabsProps {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
  counts?: { today?: number };
}

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'today', label: 'TODAY' },
  { id: 'week', label: 'WEEK' },
  { id: 'team', label: 'TEAM' },
];

const DashboardTabs: React.FC<DashboardTabsProps> = ({ active, onChange, counts }) => (
  <div
    role="tablist"
    aria-label="Dashboard view"
    className="flex items-center gap-1 border-b border-zinc-200 dark:border-white/[0.06] -mx-1"
  >
    {TABS.map(tab => {
      const isActive = active === tab.id;
      const badge = tab.id === 'today' && counts?.today ? counts.today : null;
      return (
        <button
          key={tab.id}
          role="tab"
          aria-selected={isActive}
          aria-controls={`dashboard-panel-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={`
            relative px-3 py-2.5 pulse-label transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded-sm
            ${isActive
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}
          `}
        >
          <span className="flex items-baseline gap-2">
            {tab.label}
            {badge !== null && (
              <span className={`pulse-label ${isActive ? 'text-rose-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                · {badge}
              </span>
            )}
          </span>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute left-2 right-2 -bottom-px h-px bg-rose-500"
            />
          )}
        </button>
      );
    })}
  </div>
);

export default DashboardTabs;
