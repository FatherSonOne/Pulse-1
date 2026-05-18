// ============================================
// TODAY EMPTY STATE
// Celebratory + educational empty state: teaches feed vocabulary by showing
// an inert preview of the six item types that will appear here over time.
// ============================================

import React, { useState, useEffect } from 'react';

import { Bell, Check, Clock, Flame, Mail, RotateCw, Star, Wifi } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface TodayEmptyStateProps {
  onRefresh?: () => void;
}

// Type-preview rows — the inert "what shows up here" teaching card.
// Icons map 1:1 to the FILTER_CHIPS used in the live feed so users build
// recognition without surface duplication.
interface PreviewRow {
  Icon: LucideIcon;
  label: string;
  description: string;
}

const PREVIEW_ROWS: PreviewRow[] = [
  { Icon: Bell,  label: 'Follow-ups',   description: 'Conversations waiting on your reply' },
  { Icon: Flame, label: 'Hot leads',    description: 'Warming contacts ready to advance' },
  { Icon: Star,  label: 'Birthdays',    description: 'Quick personal touches to send' },
  { Icon: Wifi,  label: 'Cooling',      description: 'Relationships losing momentum' },
  { Icon: Mail,  label: 'Awaiting',     description: 'Messages you sent that never got an answer' },
  { Icon: Clock, label: 'Time-sensitive', description: 'Items with a deadline today' },
];

export const TodayEmptyState: React.FC<TodayEmptyStateProps> = ({ onRefresh }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in on mount
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center h-full py-12 px-6 text-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Animated checkmark. Ping ring is decorative — guarded by
          prefers-reduced-motion so the static check still anchors the
          empty state for users who opt out of motion. Dark-mode opacity
          dropped from 30% to 20% per Palette plan. */}
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Check className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
        </div>
        <div
          className="absolute inset-0 rounded-full border-2 border-emerald-300 dark:border-emerald-600 opacity-30 dark:opacity-20 motion-safe:animate-ping motion-reduce:hidden"
          aria-hidden="true"
        />
      </div>

      {/* Headline */}
      <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">
        All caught up!
      </h2>

      {/* Subtext */}
      <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">
        No relationship actions need attention right now. Pulse will surface new items here as your network warms up or cools down.
      </p>

      {/* Type-preview card — replaces the rotating tip. Dimmed so it reads
          as informational rather than an active feed. */}
      <div className="w-full max-w-sm mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-3 opacity-75">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 text-left px-1">
          What shows up here
        </p>
        <ul className="space-y-1.5">
          {PREVIEW_ROWS.map(({ Icon, label, description }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left"
            >
              <span
                className="flex-shrink-0 w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500"
                aria-hidden="true"
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {label}
                </span>
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-500 truncate">
                  {description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Refresh CTA */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Check for new items
        </button>
      )}
    </div>
  );
};

export default TodayEmptyState;
