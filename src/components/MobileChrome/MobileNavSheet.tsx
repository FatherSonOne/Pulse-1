// MobileNavSheet — the slim bar's section navigation, rising from the bottom
// edge where the thumb already is. Hot row = the four destinations the old
// 5-tab bar carried; below it, the full section list mirrors the desktop
// Sidebar's grouping and flag gating (Slack Channels hidden without its
// flag, Email carries an OFF caption, Experimental greyed until enabled).
// The Sidebar's left drawer remains the account/workspace surface
// (workspace switcher, billing, theme, sign-out); this sheet owns going
// places.

import React from 'react';
import { AppView } from '../../types';
import { useFeatures } from '../../contexts/FeatureContext';
import MobileSheet from './MobileSheet';
import { HOT_ITEMS, NAV_SECTIONS } from './mobileNavConfig';

interface MobileNavSheetProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  onClose: () => void;
}

export const MobileNavSheet: React.FC<MobileNavSheetProps> = ({ view, onNavigate, onClose }) => {
  const { features } = useFeatures();

  return (
    <MobileSheet title="Navigate" onClose={onClose}>
      <nav aria-label="Sections" className="pb-2">
        <div className="grid grid-cols-4 gap-2 px-3 pt-3">
          {HOT_ITEMS.map(item => {
            const active = item.view === view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.view)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1.5 min-h-[64px] rounded-xl border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                  active
                    ? 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/[0.04] dark:bg-rose-500/[0.06]'
                    : 'border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/[0.04] active:bg-zinc-100 dark:active:bg-white/[0.06]'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
        {NAV_SECTIONS.map(section => {
          const items = section.items.filter(
            item => !(item.requiresFlag === 'slackChannelsGrounding' && !features.slackChannelsGrounding)
          );
          if (items.length === 0) return null;
          const locked = !!section.experimental && !features.experimentalEnabled;
          return (
            <div key={section.label}>
              <div className="px-4 pt-4 pb-1 font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-zinc-500 dark:text-zinc-400">
                {section.label}
              </div>
              <ul>
                {items.map(item => {
                  const active = item.view === view;
                  const emailOff = !!item.showsEmailGate && !features.emailEnabled;
                  return (
                    <li key={item.view}>
                      <button
                        type="button"
                        onClick={() => onNavigate(item.view)}
                        disabled={locked}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center gap-3 px-4 min-h-[48px] text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-white/[0.04] ${
                          locked
                            ? 'opacity-40 cursor-not-allowed text-zinc-500 dark:text-zinc-400'
                            : active
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/[0.04] active:bg-zinc-100 dark:active:bg-white/[0.06]'
                        }`}
                      >
                        <item.icon
                          className={`w-4 h-4 shrink-0 ${active && !locked ? '' : 'text-zinc-400 dark:text-zinc-500'}`}
                        />
                        <span className="truncate">{item.label}</span>
                        {emailOff && (
                          <span className="ml-auto font-mono text-[9px] tracking-[0.1em] uppercase text-zinc-500 dark:text-zinc-400">
                            Off
                          </span>
                        )}
                        {locked && (
                          <span className="ml-auto font-mono text-[9px] tracking-[0.1em] uppercase text-zinc-500 dark:text-zinc-400">
                            v2.0
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </MobileSheet>
  );
};

export default MobileNavSheet;
