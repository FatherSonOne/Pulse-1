// Enhanced Achievement System with Gamification
import React, { useState, useEffect, useMemo } from 'react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'communication' | 'productivity' | 'engagement' | 'social' | 'milestone';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  unlockedAt?: string;
  xpReward: number;
  secretHint?: string;
}

interface UserStats {
  totalMessages: number;
  decisionsCreated: number;
  tasksCompleted: number;
  reactionsGiven: number;
  reactionsReceived: number;
  consecutiveDays: number;
  responseTimeAvg: number;
  uniqueContacts: number;
  longThreads: number;
  questionsAnswered: number;
}

// Define all available achievements
const ACHIEVEMENTS_CONFIG: Omit<Achievement, 'progress' | 'unlocked' | 'unlockedAt'>[] = [
  // Communication achievements
  { id: 'first-message', title: 'Hello World', description: 'Send your first message', icon: '👋', category: 'communication', rarity: 'common', maxProgress: 1, xpReward: 10 },
  { id: 'chatterbox', title: 'Chatterbox', description: 'Send 100 messages', icon: '💬', category: 'communication', rarity: 'common', maxProgress: 100, xpReward: 50 },
  { id: 'novelist', title: 'Novelist', description: 'Send 1000 messages', icon: '📚', category: 'communication', rarity: 'rare', maxProgress: 1000, xpReward: 200 },
  { id: 'lightning-responder', title: 'Lightning Responder', description: 'Respond to 10 messages within 1 minute', icon: '⚡', category: 'communication', rarity: 'rare', maxProgress: 10, xpReward: 100 },
  { id: 'deep-thinker', title: 'Deep Thinker', description: 'Send 50 messages over 200 characters', icon: '🧠', category: 'communication', rarity: 'rare', maxProgress: 50, xpReward: 150 },

  // Productivity achievements
  { id: 'decision-maker', title: 'Decision Maker', description: 'Create your first decision', icon: '⚖️', category: 'productivity', rarity: 'common', maxProgress: 1, xpReward: 25 },
  { id: 'executive', title: 'The Executive', description: 'Make 50 decisions', icon: '👔', category: 'productivity', rarity: 'epic', maxProgress: 50, xpReward: 300 },
  { id: 'task-master', title: 'Task Master', description: 'Complete 25 tasks', icon: '✅', category: 'productivity', rarity: 'rare', maxProgress: 25, xpReward: 200 },
  { id: 'multitasker', title: 'Multitasker', description: 'Have 5 active threads simultaneously', icon: '🎯', category: 'productivity', rarity: 'common', maxProgress: 5, xpReward: 50 },

  // Engagement achievements
  { id: 'reaction-rookie', title: 'Reaction Rookie', description: 'Give your first reaction', icon: '👍', category: 'engagement', rarity: 'common', maxProgress: 1, xpReward: 5 },
  { id: 'emoji-enthusiast', title: 'Emoji Enthusiast', description: 'Use 50 reactions', icon: '🎉', category: 'engagement', rarity: 'rare', maxProgress: 50, xpReward: 75 },
  { id: 'popular', title: 'Popular', description: 'Receive 100 reactions on your messages', icon: '⭐', category: 'engagement', rarity: 'epic', maxProgress: 100, xpReward: 250 },
  { id: 'question-asker', title: 'Curious Mind', description: 'Ask 20 questions', icon: '❓', category: 'engagement', rarity: 'common', maxProgress: 20, xpReward: 40 },
  { id: 'question-answerer', title: 'Helpful Hand', description: 'Answer 30 questions', icon: '💡', category: 'engagement', rarity: 'rare', maxProgress: 30, xpReward: 120 },

  // Social achievements
  { id: 'social-butterfly', title: 'Social Butterfly', description: 'Chat with 10 different contacts', icon: '🦋', category: 'social', rarity: 'rare', maxProgress: 10, xpReward: 100 },
  { id: 'networker', title: 'Master Networker', description: 'Chat with 50 different contacts', icon: '🕸️', category: 'social', rarity: 'legendary', maxProgress: 50, xpReward: 500 },
  { id: 'thread-weaver', title: 'Thread Weaver', description: 'Have a conversation with 100+ messages', icon: '🧵', category: 'social', rarity: 'epic', maxProgress: 1, xpReward: 200 },

  // Milestone achievements
  { id: 'week-streak', title: 'Weekly Warrior', description: 'Use Pulse for 7 consecutive days', icon: '📅', category: 'milestone', rarity: 'rare', maxProgress: 7, xpReward: 150 },
  { id: 'month-streak', title: 'Monthly Master', description: 'Use Pulse for 30 consecutive days', icon: '📆', category: 'milestone', rarity: 'epic', maxProgress: 30, xpReward: 500 },
  { id: 'centurion', title: 'Centurion', description: 'Use Pulse for 100 days', icon: '🏛️', category: 'milestone', rarity: 'legendary', maxProgress: 100, xpReward: 1000 },

  // Secret achievements
  { id: 'night-owl', title: 'Night Owl', description: 'Send messages after midnight', icon: '🦉', category: 'milestone', rarity: 'rare', maxProgress: 10, xpReward: 75, secretHint: 'The night is dark and full of messages' },
  { id: 'early-bird', title: 'Early Bird', description: 'Send messages before 6 AM', icon: '🐦', category: 'milestone', rarity: 'rare', maxProgress: 10, xpReward: 75, secretHint: 'The early bird catches the worm' },
  { id: 'perfectionist', title: 'Perfectionist', description: 'Edit a message 5 times', icon: '✨', category: 'engagement', rarity: 'epic', maxProgress: 1, xpReward: 100, secretHint: 'Sometimes good enough isn\'t good enough' },
];

interface AchievementSystemEnhancedProps {
  stats: UserStats;
  onAchievementUnlock?: (achievement: Achievement) => void;
}

export const AchievementSystemEnhanced: React.FC<AchievementSystemEnhancedProps> = ({
  stats,
  onAchievementUnlock
}) => {
  const [selectedCategory, setSelectedCategory] = useState<Achievement['category'] | 'all'>('all');
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);

  // Calculate achievements based on stats
  const achievements = useMemo((): Achievement[] => {
    return ACHIEVEMENTS_CONFIG.map(config => {
      let progress = 0;

      switch (config.id) {
        case 'first-message':
          progress = stats.totalMessages >= 1 ? 1 : 0;
          break;
        case 'chatterbox':
          progress = Math.min(stats.totalMessages, 100);
          break;
        case 'novelist':
          progress = Math.min(stats.totalMessages, 1000);
          break;
        case 'decision-maker':
          progress = stats.decisionsCreated >= 1 ? 1 : 0;
          break;
        case 'executive':
          progress = Math.min(stats.decisionsCreated, 50);
          break;
        case 'task-master':
          progress = Math.min(stats.tasksCompleted, 25);
          break;
        case 'reaction-rookie':
          progress = stats.reactionsGiven >= 1 ? 1 : 0;
          break;
        case 'emoji-enthusiast':
          progress = Math.min(stats.reactionsGiven, 50);
          break;
        case 'popular':
          progress = Math.min(stats.reactionsReceived, 100);
          break;
        case 'social-butterfly':
          progress = Math.min(stats.uniqueContacts, 10);
          break;
        case 'networker':
          progress = Math.min(stats.uniqueContacts, 50);
          break;
        case 'week-streak':
          progress = Math.min(stats.consecutiveDays, 7);
          break;
        case 'month-streak':
          progress = Math.min(stats.consecutiveDays, 30);
          break;
        case 'centurion':
          progress = Math.min(stats.consecutiveDays, 100);
          break;
        case 'thread-weaver':
          progress = stats.longThreads >= 1 ? 1 : 0;
          break;
        case 'question-answerer':
          progress = Math.min(stats.questionsAnswered, 30);
          break;
        default:
          progress = 0;
      }

      const unlocked = progress >= config.maxProgress;

      return {
        ...config,
        progress,
        unlocked,
        unlockedAt: unlocked ? new Date().toISOString() : undefined
      };
    });
  }, [stats]);

  // Check for newly unlocked achievements
  useEffect(() => {
    const unlockedIds = achievements.filter(a => a.unlocked).map(a => a.id);
    const newUnlocks = unlockedIds.filter(id => !newlyUnlocked.includes(id));

    if (newUnlocks.length > 0) {
      setNewlyUnlocked(prev => [...prev, ...newUnlocks]);
      newUnlocks.forEach(id => {
        const achievement = achievements.find(a => a.id === id);
        if (achievement) {
          onAchievementUnlock?.(achievement);
        }
      });
    }
  }, [achievements, newlyUnlocked, onAchievementUnlock]);

  // Calculate total XP and level
  const totalXP = achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.xpReward, 0);
  const level = Math.floor(totalXP / 500) + 1;
  const xpToNextLevel = 500 - (totalXP % 500);

  const categories: Array<{ id: Achievement['category'] | 'all'; label: string; icon: string }> = [
    { id: 'all', label: 'All', icon: 'fa-trophy' },
    { id: 'communication', label: 'Chat', icon: 'fa-comment' },
    { id: 'productivity', label: 'Productivity', icon: 'fa-check-circle' },
    { id: 'engagement', label: 'Engagement', icon: 'fa-heart' },
    { id: 'social', label: 'Social', icon: 'fa-users' },
    { id: 'milestone', label: 'Milestones', icon: 'fa-flag' },
  ];

  const filteredAchievements = achievements.filter(a => {
    if (selectedCategory !== 'all' && a.category !== selectedCategory) return false;
    if (showUnlockedOnly && !a.unlocked) return false;
    return true;
  });

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'legendary': return 'from-amber-400 to-orange-500 border-amber-400';
      case 'epic': return 'from-purple-400 to-pink-500 border-purple-400';
      case 'rare': return 'from-blue-400 to-cyan-500 border-blue-400';
      default: return 'from-zinc-400 to-zinc-500 border-zinc-400';
    }
  };

  const getRarityBadge = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'legendary': return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
      case 'epic': return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      case 'rare': return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
      default: return 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header with Level */}
      <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-indigo-500 to-purple-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold text-white">
              {level}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Level {level}</h3>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${((500 - xpToNextLevel) / 500) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-white/80">{xpToNextLevel} XP to next</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{totalXP}</div>
            <div className="text-xs text-white/80">Total XP</div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center">
          <div className="text-lg font-bold text-zinc-800 dark:text-white">
            {achievements.filter(a => a.unlocked).length}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Unlocked</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-amber-500">
            {achievements.filter(a => a.unlocked && a.rarity === 'legendary').length}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Legendary</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-purple-500">
            {achievements.filter(a => a.unlocked && a.rarity === 'epic').length}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Epic</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-500">
            {achievements.filter(a => a.unlocked && a.rarity === 'rare').length}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Rare</div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-1 p-2 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              selectedCategory === cat.id
                ? 'bg-indigo-500 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }`}
          >
            <i className={`fa-solid ${cat.icon}`} />
            {cat.label}
          </button>
        ))}
        <button
          onClick={() => setShowUnlockedOnly(!showUnlockedOnly)}
          className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
            showUnlockedOnly
              ? 'bg-emerald-500 text-white'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
          }`}
        >
          <i className="fa-solid fa-filter" />
          Unlocked
        </button>
      </div>

      {/* Achievements Grid */}
      <div className="p-3 max-h-80 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {filteredAchievements.map(achievement => (
            <div
              key={achievement.id}
              className={`relative p-3 rounded-lg border-2 transition-all ${
                achievement.unlocked
                  ? `bg-gradient-to-br ${getRarityColor(achievement.rarity).split(' ').slice(0, 2).join(' ')} bg-opacity-10 border-opacity-50 ${getRarityColor(achievement.rarity).split(' ')[2]}`
                  : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 opacity-60'
              }`}
            >
              {/* Rarity Badge */}
              <div className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${getRarityBadge(achievement.rarity)}`}>
                {achievement.rarity}
              </div>

              <div className="flex items-start gap-2">
                <div className={`text-2xl ${achievement.unlocked ? '' : 'grayscale'}`}>
                  {achievement.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-zinc-800 dark:text-white truncate">
                    {achievement.secretHint && !achievement.unlocked ? '???' : achievement.title}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {achievement.secretHint && !achievement.unlocked ? achievement.secretHint : achievement.description}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {!achievement.unlocked && (
                <div className="mt-2">
                  <div className="flex justify-between text-[9px] text-zinc-500 dark:text-zinc-400 mb-0.5">
                    <span>{achievement.progress}/{achievement.maxProgress}</span>
                    <span>+{achievement.xpReward} XP</span>
                  </div>
                  <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Unlocked Checkmark */}
              {achievement.unlocked && (
                <div className="absolute bottom-1 right-1">
                  <i className="fa-solid fa-check-circle text-emerald-500" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Compact achievement badge for display elsewhere
export const AchievementBadge: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'legendary': return 'ring-amber-400 bg-amber-100 dark:bg-amber-900/40';
      case 'epic': return 'ring-purple-400 bg-purple-100 dark:bg-purple-900/40';
      case 'rare': return 'ring-blue-400 bg-blue-100 dark:bg-blue-900/40';
      default: return 'ring-zinc-300 bg-zinc-100 dark:bg-zinc-800';
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ring-2 ${getRarityColor(achievement.rarity)}`}
      title={achievement.description}
    >
      <span>{achievement.icon}</span>
      <span className="font-medium text-zinc-800 dark:text-white">{achievement.title}</span>
    </div>
  );
};

export default AchievementSystemEnhanced;
