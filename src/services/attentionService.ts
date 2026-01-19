import { supabase } from './supabaseClient';
import { AttentionBudget, BatchedNotification } from '../types';

/**
 * Attention Service
 * Manages attention budget, notification batching, and focus time protection.
 * Helps users maintain healthy notification habits and protect deep work time.
 */

export interface AttentionSettings {
  id?: string;
  user_id: string;
  max_daily_notifications: number;
  batch_interval_minutes: number;
  focus_hours_start: string; // HH:MM format
  focus_hours_end: string;
  high_priority_bypass: boolean;
  weekly_attention_goal: number; // hours of focus time
  created_at?: string;
  updated_at?: string;
}

export interface AttentionLog {
  id: string;
  user_id: string;
  event_type: 'notification' | 'focus_start' | 'focus_end' | 'interrupt' | 'batch_viewed';
  source?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface FocusSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  planned_duration_minutes: number;
  actual_duration_minutes?: number;
  interruption_count: number;
  topic?: string;
  status: 'active' | 'completed' | 'interrupted';
}

// In-memory state for the current session
let currentBudget: AttentionBudget = {
  currentLoad: 0,
  maxLoad: 100,
  status: 'healthy',
  batchedCount: 0
};

let batchedNotifications: BatchedNotification[] = [];
let focusMode: FocusSession | null = null;
let settings: AttentionSettings | null = null;

export const attentionService = {
  // Initialize attention service for a user
  async initialize(userId: string): Promise<void> {
    await this.loadSettings(userId);
    await this.loadCurrentBudget(userId);
  },

  // Load user's attention settings
  async loadSettings(userId: string): Promise<AttentionSettings | null> {
    const { data, error } = await supabase
      .from('attention_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading attention settings:', error);
      return null;
    }

    if (data) {
      settings = data;
      return data;
    }

    // Create default settings if none exist
    const defaultSettings: AttentionSettings = {
      user_id: userId,
      max_daily_notifications: 50,
      batch_interval_minutes: 30,
      focus_hours_start: '09:00',
      focus_hours_end: '12:00',
      high_priority_bypass: true,
      weekly_attention_goal: 20
    };

    const { data: newSettings, error: insertError } = await supabase
      .from('attention_settings')
      .insert(defaultSettings)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating default settings:', insertError);
      // Return in-memory defaults
      settings = defaultSettings;
      return defaultSettings;
    }

    settings = newSettings;
    return newSettings;
  },

  // Update user's attention settings
  async updateSettings(userId: string, updates: Partial<AttentionSettings>): Promise<boolean> {
    const { error } = await supabase
      .from('attention_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating attention settings:', error);
      return false;
    }

    // Refresh in-memory settings
    await this.loadSettings(userId);
    return true;
  },

  // Get current attention budget
  async loadCurrentBudget(userId: string): Promise<AttentionBudget> {
    const today = new Date().toISOString().split('T')[0];

    // Count today's notifications
    const { count, error } = await supabase
      .from('attention_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'notification')
      .gte('created_at', `${today}T00:00:00`);

    if (error) {
      console.error('Error loading attention budget:', error);
    }

    const notificationCount = count || 0;
    const maxNotifications = settings?.max_daily_notifications || 50;
    const loadPercentage = Math.min((notificationCount / maxNotifications) * 100, 100);

    currentBudget = {
      currentLoad: Math.round(loadPercentage),
      maxLoad: 100,
      status: loadPercentage < 50 ? 'healthy' : loadPercentage < 80 ? 'strained' : 'overloaded',
      batchedCount: batchedNotifications.length
    };

    return currentBudget;
  },

  // Get current budget (synchronous, uses cached value)
  getCurrentBudget(): AttentionBudget {
    return { ...currentBudget };
  },

  // Log a notification and update budget
  async logNotification(
    userId: string,
    source: string,
    message: string,
    priority: 'low' | 'medium' | 'high'
  ): Promise<{ batched: boolean; notification?: BatchedNotification }> {
    const now = new Date();

    // Check if in focus mode and priority doesn't bypass
    if (focusMode && focusMode.status === 'active') {
      if (priority !== 'high' || !settings?.high_priority_bypass) {
        // Batch the notification
        const batchedNotification: BatchedNotification = {
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source,
          message,
          time: now,
          priority: priority === 'high' ? 'medium' : priority
        };

        batchedNotifications.push(batchedNotification);
        currentBudget.batchedCount = batchedNotifications.length;

        return { batched: true, notification: batchedNotification };
      }
    }

    // Check if within focus hours
    if (this.isWithinFocusHours()) {
      if (priority !== 'high' || !settings?.high_priority_bypass) {
        const batchedNotification: BatchedNotification = {
          id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source,
          message,
          time: now,
          priority: priority === 'high' ? 'medium' : priority
        };

        batchedNotifications.push(batchedNotification);
        currentBudget.batchedCount = batchedNotifications.length;

        return { batched: true, notification: batchedNotification };
      }
    }

    // Log the notification
    await supabase.from('attention_logs').insert({
      user_id: userId,
      event_type: 'notification',
      source,
      metadata: { message, priority }
    });

    // Update budget
    await this.loadCurrentBudget(userId);

    return { batched: false };
  },

  // Check if current time is within focus hours
  isWithinFocusHours(): boolean {
    if (!settings) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return currentTime >= settings.focus_hours_start && currentTime <= settings.focus_hours_end;
  },

  // Get batched notifications
  getBatchedNotifications(): BatchedNotification[] {
    return [...batchedNotifications];
  },

  // Clear batched notifications
  async clearBatchedNotifications(userId: string): Promise<void> {
    // Log that batch was viewed
    await supabase.from('attention_logs').insert({
      user_id: userId,
      event_type: 'batch_viewed',
      metadata: { count: batchedNotifications.length }
    });

    batchedNotifications = [];
    currentBudget.batchedCount = 0;
  },

  // Start a focus session
  async startFocusSession(
    userId: string,
    durationMinutes: number,
    topic?: string
  ): Promise<FocusSession | null> {
    const session: Omit<FocusSession, 'id'> = {
      user_id: userId,
      started_at: new Date().toISOString(),
      planned_duration_minutes: durationMinutes,
      interruption_count: 0,
      topic,
      status: 'active'
    };

    const { data, error } = await supabase
      .from('focus_sessions')
      .insert(session)
      .select()
      .single();

    if (error) {
      console.error('Error starting focus session:', error);
      // Return in-memory session
      focusMode = {
        id: `local-${Date.now()}`,
        ...session
      };
      return focusMode;
    }

    focusMode = data;

    // Log focus start
    await supabase.from('attention_logs').insert({
      user_id: userId,
      event_type: 'focus_start',
      metadata: { session_id: data.id, duration_minutes: durationMinutes, topic }
    });

    return data;
  },

  // End a focus session
  async endFocusSession(userId: string, sessionId?: string): Promise<boolean> {
    const id = sessionId || focusMode?.id;
    if (!id) return false;

    const now = new Date();
    const startedAt = focusMode?.started_at ? new Date(focusMode.started_at) : now;
    const actualDuration = Math.round((now.getTime() - startedAt.getTime()) / 60000);

    const { error } = await supabase
      .from('focus_sessions')
      .update({
        ended_at: now.toISOString(),
        actual_duration_minutes: actualDuration,
        status: 'completed'
      })
      .eq('id', id);

    if (error) {
      console.error('Error ending focus session:', error);
    }

    // Log focus end
    await supabase.from('attention_logs').insert({
      user_id: userId,
      event_type: 'focus_end',
      metadata: {
        session_id: id,
        actual_duration_minutes: actualDuration,
        interruption_count: focusMode?.interruption_count || 0
      }
    });

    focusMode = null;
    return true;
  },

  // Record an interruption during focus
  async recordInterruption(userId: string, source: string): Promise<void> {
    if (!focusMode) return;

    focusMode.interruption_count++;

    await supabase
      .from('focus_sessions')
      .update({ interruption_count: focusMode.interruption_count })
      .eq('id', focusMode.id);

    await supabase.from('attention_logs').insert({
      user_id: userId,
      event_type: 'interrupt',
      source,
      metadata: { session_id: focusMode.id }
    });
  },

  // Get current focus session
  getCurrentFocusSession(): FocusSession | null {
    return focusMode ? { ...focusMode } : null;
  },

  // Check if user is in focus mode
  isInFocusMode(): boolean {
    return focusMode !== null && focusMode.status === 'active';
  },

  // Get attention analytics
  async getAnalytics(userId: string, days: number = 7): Promise<{
    averageDailyNotifications: number;
    totalFocusMinutes: number;
    completedSessions: number;
    averageInterruptions: number;
    topInterruptionSources: { source: string; count: number }[];
    dailyBreakdown: { date: string; notifications: number; focusMinutes: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // Get notification logs
    const { data: logs } = await supabase
      .from('attention_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDateStr);

    // Get focus sessions
    const { data: sessions } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', startDateStr);

    const notifications = logs?.filter(l => l.event_type === 'notification') || [];
    const interruptions = logs?.filter(l => l.event_type === 'interrupt') || [];
    const completedSessions = sessions?.filter(s => s.status === 'completed') || [];

    // Calculate top interruption sources
    const sourceCount: Record<string, number> = {};
    interruptions.forEach(i => {
      const source = i.source || 'unknown';
      sourceCount[source] = (sourceCount[source] || 0) + 1;
    });

    const topInterruptionSources = Object.entries(sourceCount)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate daily breakdown
    const dailyBreakdown: { date: string; notifications: number; focusMinutes: number }[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayNotifications = notifications.filter(n =>
        n.created_at?.startsWith(dateStr)
      ).length;

      const dayFocusMinutes = completedSessions
        .filter(s => s.started_at?.startsWith(dateStr))
        .reduce((sum, s) => sum + (s.actual_duration_minutes || 0), 0);

      dailyBreakdown.push({
        date: dateStr,
        notifications: dayNotifications,
        focusMinutes: dayFocusMinutes
      });
    }

    return {
      averageDailyNotifications: Math.round(notifications.length / days),
      totalFocusMinutes: completedSessions.reduce((sum, s) => sum + (s.actual_duration_minutes || 0), 0),
      completedSessions: completedSessions.length,
      averageInterruptions: completedSessions.length > 0
        ? Math.round(completedSessions.reduce((sum, s) => sum + s.interruption_count, 0) / completedSessions.length * 10) / 10
        : 0,
      topInterruptionSources,
      dailyBreakdown: dailyBreakdown.reverse()
    };
  },

  // Get suggested focus time based on calendar and patterns
  async getSuggestedFocusTime(userId: string): Promise<{
    suggested: string;
    duration: number;
    reason: string;
  } | null> {
    const now = new Date();
    const hour = now.getHours();

    // Simple heuristics - can be enhanced with calendar integration
    if (hour >= 9 && hour < 12) {
      return {
        suggested: 'Now',
        duration: 90,
        reason: 'Morning focus hours - optimal for deep work'
      };
    } else if (hour >= 14 && hour < 16) {
      return {
        suggested: 'Now',
        duration: 60,
        reason: 'Post-lunch focus window'
      };
    } else if (hour < 9) {
      return {
        suggested: '9:00 AM',
        duration: 90,
        reason: 'Start your day with focused work'
      };
    } else {
      return {
        suggested: 'Tomorrow 9:00 AM',
        duration: 90,
        reason: 'Schedule focus time for tomorrow morning'
      };
    }
  },

  // Calculate attention health score
  calculateHealthScore(): number {
    const budget = this.getCurrentBudget();

    // Base score from load (inverse relationship)
    let score = 100 - budget.currentLoad;

    // Penalty for batched notifications
    score -= Math.min(budget.batchedCount * 2, 20);

    // Bonus for being in focus mode
    if (this.isInFocusMode()) {
      score += 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }
};
