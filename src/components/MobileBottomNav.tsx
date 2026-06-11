import React from 'react';
import { Menu, Plus } from 'lucide-react';
import { AppView } from '../types';
import { VIEW_LABELS } from './MobileChrome/mobileNavConfig';

interface MobileBottomNavProps {
  view: AppView;
  onOpenNav: () => void;
  onOpenActions: () => void;
  isDarkMode?: boolean;
}

// Slim two-affordance bar (was a 5-tab bar): ☰ opens the navigation sheet,
// "+" opens the quick-actions sheet, and the center mono label names the
// current section (rose = you-are-here state signal, the bar's only coral)
// while doubling as a second, bigger target for the nav sheet. Bar height is
// 48px + safe area; <main> reserves exactly that via its mobile padding —
// keep the two in lockstep (App.tsx <main>
// pb-[calc(48px+env(safe-area-inset-bottom))]).
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  view,
  onOpenNav,
  onOpenActions,
  isDarkMode = false,
}) => {
  const label = VIEW_LABELS[view] ?? 'Pulse';
  const cornerClass = `shrink-0 min-w-[48px] min-h-[48px] px-4 flex items-center justify-center transition-colors ${
    isDarkMode ? 'text-zinc-400 active:bg-zinc-800' : 'text-zinc-600 active:bg-zinc-100'
  }`;

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
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        aria-haspopup="dialog"
        className={cornerClass}
      >
        <Menu className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={onOpenNav}
        aria-label={`Current section: ${label}. Open navigation`}
        aria-haspopup="dialog"
        className={`flex-1 min-w-0 min-h-[48px] flex items-center justify-center font-mono text-[11px] font-medium tracking-[0.1em] uppercase transition-colors ${
          isDarkMode ? 'text-rose-400 active:bg-zinc-800' : 'text-rose-600 active:bg-zinc-100'
        }`}
      >
        <span className="truncate">{label}</span>
      </button>
      <button
        type="button"
        onClick={onOpenActions}
        aria-label="Quick actions"
        aria-haspopup="dialog"
        className={cornerClass}
      >
        <Plus className="w-5 h-5" />
      </button>
    </nav>
  );
};

export default MobileBottomNav;
