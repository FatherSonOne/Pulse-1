// Achievement Toast Component - Rose Theme
// Professional notifications for milestones
import React, { useEffect, useState } from 'react';
import { TrendingUp, X } from 'lucide-react';
import type { Achievement } from '../../types/messageEnhancements';

interface AchievementToastProps {
  achievement: Achievement;
  onDismiss: () => void;
  autoHide?: boolean;
  duration?: number;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  onDismiss,
  autoHide = true,
  duration = 5000
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    setTimeout(() => setVisible(true), 100);

    if (autoHide) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, onDismiss]);

  // Professional rose-based color scheme
  const getCategoryColor = (category: Achievement['category']) => {
    switch (category) {
      case 'productivity':
        return 'bg-rose-500';
      case 'communication':
        return 'bg-pink-500';
      case 'collaboration':
        return 'bg-rose-600';
      case 'social':
        return 'bg-pink-600';
      default:
        return 'bg-rose-500';
    }
  };

  const getCategoryBg = (category: Achievement['category']) => {
    switch (category) {
      case 'productivity':
        return 'bg-rose-50 dark:bg-rose-900/20';
      case 'communication':
        return 'bg-pink-50 dark:bg-pink-900/20';
      case 'collaboration':
        return 'bg-rose-50 dark:bg-rose-900/20';
      case 'social':
        return 'bg-pink-50 dark:bg-pink-900/20';
      default:
        return 'bg-rose-50 dark:bg-rose-900/20';
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] transform transition-all duration-300 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden w-80 sm:w-96">
        {/* Solid Rose Header Bar */}
        <div className={`h-1 ${getCategoryColor(achievement.category)}`} />

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="relative">
              <div className={`w-10 h-10 rounded-lg ${getCategoryBg(achievement.category)} flex items-center justify-center`}>
                <TrendingUp className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Milestone Reached
                </span>
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-0.5">
                {achievement.title}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                {achievement.description}
              </div>
              <div className="mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                  {achievement.category}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                setVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Achievement Progress Bar Component - Professional Style
interface AchievementProgressProps {
  achievement: Achievement;
  onClick?: () => void;
}

export const AchievementProgress: React.FC<AchievementProgressProps> = ({
  achievement,
  onClick
}) => {
  const progress = Math.min(100, (achievement.progress / achievement.maxProgress) * 100);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 hover:border-rose-300 dark:hover:border-rose-600 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center ${achievement.unlocked ? '' : 'opacity-50'}`}>
          <TrendingUp className="text-rose-500 text-sm" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {achievement.title}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {achievement.progress}/{achievement.maxProgress}
            </span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5 mb-1">
            <div
              className="bg-rose-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            {achievement.description}
          </div>
        </div>
      </div>
    </button>
  );
};
