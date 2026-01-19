// Achievement Service
// Manages gamification and achievement tracking

import type { Achievement } from '../types/messageEnhancements';

class AchievementService {
  private readonly STORAGE_KEY = 'pulse_achievements';
  private readonly STATS_KEY = 'pulse_user_stats';
  
  // Track user statistics
  private stats = {
    messagesSent: 0,
    fastResponses: 0,
    tasksCreated: 0,
    decisionsMade: 0,
    peopleHelped: new Set<string>(),
    activeConversations: new Set<string>(),
    loginStreak: 0,
    lastLoginDate: new Date()
  };
  
  constructor() {
    this.loadStats();
  }
  
  private loadStats() {
    try {
      const saved = localStorage.getItem(this.STATS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.stats = {
          ...parsed,
          peopleHelped: new Set(parsed.peopleHelped),
          activeConversations: new Set(parsed.activeConversations),
          lastLoginDate: new Date(parsed.lastLoginDate)
        };
      }
    } catch (error) {
      console.error('Failed to load achievement stats:', error);
    }
  }
  
  private saveStats() {
    try {
      const toSave = {
        ...this.stats,
        peopleHelped: Array.from(this.stats.peopleHelped),
        activeConversations: Array.from(this.stats.activeConversations),
        lastLoginDate: this.stats.lastLoginDate.toISOString()
      };
      localStorage.setItem(this.STATS_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save achievement stats:', error);
    }
  }
  
  // Track events
  trackMessageSent() {
    this.stats.messagesSent++;
    this.saveStats();
    return this.checkAchievements();
  }
  
  trackFastResponse() {
    this.stats.fastResponses++;
    this.saveStats();
    return this.checkAchievements();
  }
  
  trackTaskCreated() {
    this.stats.tasksCreated++;
    this.saveStats();
    return this.checkAchievements();
  }
  
  trackDecisionMade() {
    this.stats.decisionsMade++;
    this.saveStats();
    return this.checkAchievements();
  }
  
  trackConversation(contactId: string) {
    this.stats.activeConversations.add(contactId);
    this.saveStats();
    return this.checkAchievements();
  }
  
  trackHelpedPerson(contactId: string) {
    this.stats.peopleHelped.add(contactId);
    this.saveStats();
    return this.checkAchievements();
  }
  
  // Check for newly unlocked achievements
  private checkAchievements(): Achievement[] {
    const definitions = this.getAchievementDefinitions();
    const unlocked: Achievement[] = [];
    const existing = this.getUnlockedAchievements();
    const existingIds = new Set(existing.map(a => a.id));
    
    definitions.forEach(def => {
      const progress = this.getProgress(def.id);
      if (progress >= def.maxProgress && !existingIds.has(def.id)) {
        const achievement: Achievement = {
          ...def,
          progress,
          unlocked: true,
          unlockedAt: new Date()
        };
        unlocked.push(achievement);
        this.saveAchievement(achievement);
      }
    });
    
    return unlocked;
  }
  
  private getProgress(achievementId: string): number {
    switch (achievementId) {
      case 'first-message': return this.stats.messagesSent >= 1 ? 1 : 0;
      case 'chatty-cathy': return this.stats.messagesSent;
      case 'lightning-fast': return this.stats.fastResponses;
      case 'task-master': return this.stats.tasksCreated;
      case 'decision-maker': return this.stats.decisionsMade;
      case 'social-butterfly': return this.stats.activeConversations.size;
      case 'helpful-hero': return this.stats.peopleHelped.size;
      case 'week-warrior': return this.stats.loginStreak;
      default: return 0;
    }
  }
  
  private getAchievementDefinitions(): Omit<Achievement, 'progress' | 'unlocked' | 'unlockedAt'>[] {
    return [
      // Starter achievements
      {
        id: 'first-message',
        title: 'First Steps',
        description: 'Send your first message',
        icon: '🌟',
        category: 'communication',
        maxProgress: 1,
        rarity: 'common'
      },
      {
        id: 'chatty-cathy',
        title: 'Chatty Cathy',
        description: 'Send 100 messages',
        icon: '💬',
        category: 'communication',
        maxProgress: 100,
        rarity: 'common'
      },
      {
        id: 'communication-master',
        title: 'Communication Master',
        description: 'Send 1000 messages',
        icon: '🏆',
        category: 'communication',
        maxProgress: 1000,
        rarity: 'legendary'
      },
      
      // Speed achievements
      {
        id: 'lightning-fast',
        title: 'Lightning Fast',
        description: 'Respond within 1 hour 50 times',
        icon: '⚡',
        category: 'communication',
        maxProgress: 50,
        rarity: 'rare'
      },
      {
        id: 'instant-responder',
        title: 'Instant Responder',
        description: 'Respond within 5 minutes 20 times',
        icon: '🚀',
        category: 'communication',
        maxProgress: 20,
        rarity: 'epic'
      },
      
      // Productivity achievements
      {
        id: 'task-master',
        title: 'Task Master',
        description: 'Create 50 tasks from conversations',
        icon: '✅',
        category: 'productivity',
        maxProgress: 50,
        rarity: 'rare'
      },
      {
        id: 'decision-maker',
        title: 'Decision Maker',
        description: 'Make 25 decisions',
        icon: '⚖️',
        category: 'productivity',
        maxProgress: 25,
        rarity: 'epic'
      },
      {
        id: 'productivity-pro',
        title: 'Productivity Pro',
        description: 'Create 100 tasks AND make 50 decisions',
        icon: '🎯',
        category: 'productivity',
        maxProgress: 150,
        rarity: 'legendary'
      },
      
      // Social achievements
      {
        id: 'social-butterfly',
        title: 'Social Butterfly',
        description: 'Have active conversations with 20 people',
        icon: '🦋',
        category: 'social',
        maxProgress: 20,
        rarity: 'rare'
      },
      {
        id: 'helpful-hero',
        title: 'Helpful Hero',
        description: 'Help 15 different people',
        icon: '🦸',
        category: 'collaboration',
        maxProgress: 15,
        rarity: 'epic'
      },
      {
        id: 'team-player',
        title: 'Team Player',
        description: 'Active in 50+ conversations',
        icon: '🤝',
        category: 'collaboration',
        maxProgress: 50,
        rarity: 'legendary'
      },
      
      // Streak achievements
      {
        id: 'week-warrior',
        title: 'Week Warrior',
        description: '7-day login streak',
        icon: '🔥',
        category: 'communication',
        maxProgress: 7,
        rarity: 'rare'
      },
      {
        id: 'month-master',
        title: 'Month Master',
        description: '30-day login streak',
        icon: '📅',
        category: 'communication',
        maxProgress: 30,
        rarity: 'legendary'
      }
    ];
  }
  
  // Save unlocked achievement
  private saveAchievement(achievement: Achievement) {
    try {
      const existing = this.getUnlockedAchievements();
      existing.push(achievement);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existing));
    } catch (error) {
      console.error('Failed to save achievement:', error);
    }
  }
  
  // Get all unlocked achievements
  getUnlockedAchievements(): Achievement[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((a: any) => ({
          ...a,
          unlockedAt: a.unlockedAt ? new Date(a.unlockedAt) : undefined
        }));
      }
    } catch (error) {
      console.error('Failed to load achievements:', error);
    }
    return [];
  }
  
  // Get all achievements with progress
  getAllAchievements(): Achievement[] {
    const definitions = this.getAchievementDefinitions();
    const unlocked = this.getUnlockedAchievements();
    const unlockedMap = new Map(unlocked.map(a => [a.id, a]));
    
    return definitions.map(def => {
      const existing = unlockedMap.get(def.id);
      if (existing) return existing;
      
      return {
        ...def,
        progress: this.getProgress(def.id),
        unlocked: false
      };
    });
  }
  
  // Get achievement stats
  getStats() {
    return {
      ...this.stats,
      peopleHelped: this.stats.peopleHelped.size,
      activeConversations: this.stats.activeConversations.size
    };
  }
  
  // Update login streak
  updateLoginStreak() {
    const now = new Date();
    const lastLogin = this.stats.lastLoginDate;
    const daysDiff = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      // Consecutive day
      this.stats.loginStreak++;
    } else if (daysDiff > 1) {
      // Streak broken
      this.stats.loginStreak = 1;
    }
    // else: same day, no change
    
    this.stats.lastLoginDate = now;
    this.saveStats();
    return this.checkAchievements();
  }
}

export const achievementService = new AchievementService();
