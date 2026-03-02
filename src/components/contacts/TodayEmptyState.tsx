// ============================================
// TODAY EMPTY STATE
// Celebratory empty state shown when the Today feed has no items.
// ============================================

import React, { useState, useEffect } from 'react';
import { AnimatedIcon } from '../ui/AnimatedIcon';

interface TodayEmptyStateProps {
  onRefresh?: () => void;
}

const TIPS = [
  'Staying in touch consistently is the #1 driver of strong relationships. Even a quick message goes a long way.',
  'Tip: Set a "Keep in Touch" goal on your most important contacts to get proactive reminders.',
  'Strong relationships are built in small moments. A birthday message or quick check-in matters more than you think.',
  'Tip: The best time to reach out is before someone goes cold — not after.',
  'Your network is your net worth. Today is a great day to say hi to someone you haven\'t spoken to in a while.',
];

export const TodayEmptyState: React.FC<TodayEmptyStateProps> = ({ onRefresh }) => {
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in on mount
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center h-full py-16 px-6 text-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Animated checkmark */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <i className="fa-solid fa-check text-3xl text-emerald-500 dark:text-emerald-400" />
        </div>
        {/* Subtle pulse ring */}
        <div className="absolute inset-0 rounded-full border-2 border-emerald-300 dark:border-emerald-600 animate-ping opacity-30" />
      </div>

      {/* Headline */}
      <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">
        All caught up!
      </h2>

      {/* Subtext */}
      <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-sm mb-8 leading-relaxed">
        No relationship actions needed right now. We'll surface new items as they come up — check back later or pull to refresh.
      </p>

      {/* Tip of the day */}
      <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 max-w-sm mb-6">
        <div className="flex items-start gap-3">
          <AnimatedIcon icon="lightbulb" size={18} />
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed text-left">
            {tip}
          </p>
        </div>
      </div>

      {/* Refresh button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
        >
          <i className="fa-solid fa-rotate-right text-xs" />
          Check for new items
        </button>
      )}
    </div>
  );
};

export default TodayEmptyState;
