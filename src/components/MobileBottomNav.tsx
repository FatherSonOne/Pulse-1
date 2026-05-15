import React from 'react';
import { Home, Mic, MessageSquare, ListChecks, Menu } from 'lucide-react';
import { AppView } from '../types';

interface MobileBottomNavProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  onOpenMore: () => void;
  isDarkMode?: boolean;
}

type NavItem =
  | { kind: 'view'; view: AppView; label: string; icon: React.ComponentType<{ className?: string }> }
  | { kind: 'more'; label: string; icon: React.ComponentType<{ className?: string }> };

const ITEMS: NavItem[] = [
  { kind: 'view', view: AppView.DASHBOARD,       label: 'Home',      icon: Home },
  { kind: 'view', view: AppView.RELAY,           label: 'Relay',     icon: Mic },
  { kind: 'view', view: AppView.MESSAGES,        label: 'Messages',  icon: MessageSquare },
  { kind: 'view', view: AppView.DECISIONS_TASKS, label: 'Decisions', icon: ListChecks },
  { kind: 'more',                                label: 'More',      icon: Menu },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  view,
  onNavigate,
  onOpenMore,
  isDarkMode = false,
}) => {
  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className={`md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t ${
        isDarkMode
          ? 'bg-zinc-950/95 border-zinc-800'
          : 'bg-white/95 border-zinc-200'
      } backdrop-blur supports-[backdrop-filter]:bg-opacity-90 pb-[env(safe-area-inset-bottom)]`}
    >
      {ITEMS.map(item => {
        const Icon = item.icon;
        const isActive = item.kind === 'view' && item.view === view;
        const handleClick = item.kind === 'view'
          ? () => onNavigate(item.view)
          : onOpenMore;

        return (
          <button
            key={item.kind === 'view' ? item.view : 'more'}
            type="button"
            onClick={handleClick}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors ${
              isActive
                ? 'text-rose-500'
                : isDarkMode
                  ? 'text-zinc-400'
                  : 'text-zinc-600'
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-medium truncate max-w-full px-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
