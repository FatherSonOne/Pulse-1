// Achievement Toast Component
import React, { useEffect, useState } from 'react';
import { Trophy, X, Sparkles } from 'lucide-react';
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
  
  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'legendary':
        return 'from-yellow-400 to-orange-500';
      case 'epic':
        return 'from-purple-400 to-pink-500';
      case 'rare':
        return 'from-blue-400 to-cyan-500';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };
  
  return (
    <div
      className={`fixed top-4 right-4 z-[9999] transform transition-all duration-300 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden w-80 sm:w-96">
        {/* Gradient Header */}
        <div className={`h-1 bg-gradient-to-r ${getRarityColor(achievement.rarity)}`} />
        
        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="relative">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${getRarityColor(achievement.rarity)} flex items-center justify-center text-2xl shadow-lg`}>
                {achievement.icon}
              </div>
              <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 animate-pulse" />
            </div>
            
            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Achievement Unlocked!
                </span>
              </div>
              <div className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                {achievement.title}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {achievement.description}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                  achievement.rarity === 'legendary' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                  achievement.rarity === 'epic' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                  achievement.rarity === 'rare' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {achievement.rarity}
                </span>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={() => {
                setVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Achievement Progress Bar Component
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
      className="w-full text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`text-2xl ${achievement.unlocked ? 'grayscale-0' : 'grayscale opacity-50'}`}>
          {achievement.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {achievement.title}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {achievement.progress}/{achievement.maxProgress}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {achievement.description}
          </div>
        </div>
      </div>
    </button>
  );
};
