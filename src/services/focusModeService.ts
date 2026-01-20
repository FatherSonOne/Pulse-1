/**
 * Focus Mode Service
 * Manages focus sessions with Pomodoro-style timer (25min work, 5min break)
 * Tracks session analytics and handles backend API integration
 */

import { supabase } from './supabase';

// Types
export interface FocusSession {
  id: string;
  user_id: string;
  thread_id: string;
  duration_minutes: number;
  actual_duration_minutes: number | null;
  completed: boolean;
  started_at: string;
  ended_at: string | null;
  break_count: number;
  created_at: string;
}

export interface FocusPreferences {
  workDuration: number; // minutes (default: 25)
  breakDuration: number; // minutes (default: 5)
  soundEnabled: boolean;
  soundVolume: number; // 0-1
  autoStartBreaks: boolean;
  autoStartWork: boolean;
}

export interface FocusTimerState {
  mode: 'work' | 'break';
  timeRemaining: number; // seconds
  isActive: boolean;
  isPaused: boolean;
  sessionId: string | null;
  breakCount: number;
}

export interface FocusSessionStats {
  totalSessions: number;
  completedSessions: number;
  totalFocusTime: number; // minutes
  completionRate: number; // 0-100
  averageSessionLength: number; // minutes
  longestStreak: number; // days
  currentStreak: number; // days
  sessionsThisWeek: number;
  focusTimeThisWeek: number; // minutes
}

// Default preferences
const DEFAULT_PREFERENCES: FocusPreferences = {
  workDuration: 25,
  breakDuration: 5,
  soundEnabled: true,
  soundVolume: 0.5,
  autoStartBreaks: false,
  autoStartWork: false,
};

// LocalStorage keys
const STORAGE_KEY_PREFERENCES = 'pulse_focus_preferences';
const STORAGE_KEY_TIMER_STATE = 'pulse_focus_timer_state';

class FocusModeService {
  private preferences: FocusPreferences = DEFAULT_PREFERENCES;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.loadPreferences();
  }

  // ==================== Preferences ====================

  /**
   * Load preferences from localStorage
   */
  loadPreferences(): FocusPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREFERENCES);
      if (stored) {
        this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[FocusMode] Error loading preferences:', error);
    }
    return this.preferences;
  }

  /**
   * Save preferences to localStorage
   */
  savePreferences(preferences: Partial<FocusPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
    try {
      localStorage.setItem(
        STORAGE_KEY_PREFERENCES,
        JSON.stringify(this.preferences)
      );
    } catch (error) {
      console.error('[FocusMode] Error saving preferences:', error);
    }
  }

  /**
   * Get current preferences
   */
  getPreferences(): FocusPreferences {
    return { ...this.preferences };
  }

  /**
   * Reset preferences to defaults
   */
  resetPreferences(): void {
    this.preferences = { ...DEFAULT_PREFERENCES };
    localStorage.removeItem(STORAGE_KEY_PREFERENCES);
  }

  // ==================== Timer State ====================

  /**
   * Save timer state to localStorage (for persistence across refreshes)
   */
  saveTimerState(state: Partial<FocusTimerState>): void {
    try {
      const stored = this.loadTimerState();
      const newState = { ...stored, ...state, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY_TIMER_STATE, JSON.stringify(newState));
    } catch (error) {
      console.error('[FocusMode] Error saving timer state:', error);
    }
  }

  /**
   * Load timer state from localStorage
   */
  loadTimerState(): Partial<FocusTimerState> | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TIMER_STATE);
      if (stored) {
        const state = JSON.parse(stored);
        // Check if state is recent (within 1 hour)
        if (state.timestamp && Date.now() - state.timestamp < 3600000) {
          return state;
        }
      }
    } catch (error) {
      console.error('[FocusMode] Error loading timer state:', error);
    }
    return null;
  }

  /**
   * Clear timer state from localStorage
   */
  clearTimerState(): void {
    localStorage.removeItem(STORAGE_KEY_TIMER_STATE);
  }

  // ==================== Session Management ====================

  /**
   * Start a new focus session
   */
  async startSession(
    userId: string,
    threadId: string,
    durationMinutes?: number
  ): Promise<FocusSession | null> {
    try {
      const duration = durationMinutes || this.preferences.workDuration;
      const now = new Date();
      const endTime = new Date(now.getTime() + duration * 60000);

      // Create session in database
      const { data, error } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: userId,
          thread_id: threadId,
          duration_minutes: duration,
          started_at: now.toISOString(),
          ended_at: endTime.toISOString(),
          break_count: 0,
          completed: false,
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[FocusMode] Session started:', data);
      return data;
    } catch (error) {
      console.error('[FocusMode] Error starting session:', error);
      return null;
    }
  }

  /**
   * End a focus session
   */
  async endSession(
    sessionId: string,
    actualDurationMinutes: number,
    completed: boolean
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('focus_sessions')
        .update({
          actual_duration_minutes: actualDurationMinutes,
          completed: completed,
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;

      console.log('[FocusMode] Session ended:', {
        sessionId,
        actualDurationMinutes,
        completed,
      });
      return true;
    } catch (error) {
      console.error('[FocusMode] Error ending session:', error);
      return false;
    }
  }

  /**
   * Update session break count
   */
  async updateBreakCount(sessionId: string, breakCount: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('focus_sessions')
        .update({ break_count: breakCount })
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('[FocusMode] Error updating break count:', error);
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<FocusSession | null> {
    try {
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[FocusMode] Error getting session:', error);
      return null;
    }
  }

  /**
   * Get user's recent sessions
   */
  async getUserSessions(
    userId: string,
    limit: number = 10
  ): Promise<FocusSession[]> {
    try {
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[FocusMode] Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Get session statistics for a user
   */
  async getSessionStats(userId: string): Promise<FocusSessionStats> {
    try {
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const sessions = data || [];
      const completedSessions = sessions.filter((s) => s.completed);
      const totalFocusTime = completedSessions.reduce(
        (sum, s) => sum + (s.actual_duration_minutes || 0),
        0
      );

      // Calculate this week's stats
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const sessionsThisWeek = sessions.filter(
        (s) => new Date(s.started_at) >= oneWeekAgo
      );
      const focusTimeThisWeek = sessionsThisWeek.reduce(
        (sum, s) => sum + (s.actual_duration_minutes || 0),
        0
      );

      // Calculate streaks (simplified - counts consecutive days with at least one session)
      const currentStreak = this.calculateCurrentStreak(sessions);
      const longestStreak = this.calculateLongestStreak(sessions);

      return {
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        totalFocusTime,
        completionRate:
          sessions.length > 0
            ? (completedSessions.length / sessions.length) * 100
            : 0,
        averageSessionLength:
          completedSessions.length > 0
            ? totalFocusTime / completedSessions.length
            : 0,
        longestStreak,
        currentStreak,
        sessionsThisWeek: sessionsThisWeek.length,
        focusTimeThisWeek,
      };
    } catch (error) {
      console.error('[FocusMode] Error getting session stats:', error);
      return {
        totalSessions: 0,
        completedSessions: 0,
        totalFocusTime: 0,
        completionRate: 0,
        averageSessionLength: 0,
        longestStreak: 0,
        currentStreak: 0,
        sessionsThisWeek: 0,
        focusTimeThisWeek: 0,
      };
    }
  }

  /**
   * Calculate current streak (consecutive days with sessions)
   */
  private calculateCurrentStreak(sessions: FocusSession[]): number {
    if (sessions.length === 0) return 0;

    const sortedSessions = [...sessions].sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let checkDate = new Date(today);

    for (const session of sortedSessions) {
      const sessionDate = new Date(session.started_at);
      sessionDate.setHours(0, 0, 0, 0);

      if (sessionDate.getTime() === checkDate.getTime()) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (sessionDate.getTime() < checkDate.getTime()) {
        // Gap in streak
        break;
      }
    }

    return streak;
  }

  /**
   * Calculate longest streak (consecutive days with sessions)
   */
  private calculateLongestStreak(sessions: FocusSession[]): number {
    if (sessions.length === 0) return 0;

    const sortedSessions = [...sessions].sort(
      (a, b) =>
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );

    let longestStreak = 1;
    let currentStreak = 1;
    let lastDate = new Date(sortedSessions[0].started_at);
    lastDate.setHours(0, 0, 0, 0);

    for (let i = 1; i < sortedSessions.length; i++) {
      const sessionDate = new Date(sortedSessions[i].started_at);
      sessionDate.setHours(0, 0, 0, 0);

      const dayDiff = Math.floor(
        (sessionDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (dayDiff === 0) {
        // Same day, continue
        continue;
      } else if (dayDiff === 1) {
        // Consecutive day
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        // Gap, reset streak
        currentStreak = 1;
      }

      lastDate = sessionDate;
    }

    return longestStreak;
  }

  // ==================== Sound Notifications ====================

  /**
   * Initialize audio context (required for Web Audio API)
   */
  private initAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
  }

  /**
   * Play a notification sound (simple beep using Web Audio API)
   */
  playNotificationSound(type: 'work' | 'break' = 'break'): void {
    if (!this.preferences.soundEnabled) return;

    try {
      this.initAudioContext();
      if (!this.audioContext) return;

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Different frequencies for work/break
      oscillator.frequency.value = type === 'break' ? 440 : 523.25; // A4 or C5
      oscillator.type = 'sine';

      // Volume
      gainNode.gain.setValueAtTime(
        this.preferences.soundVolume,
        this.audioContext.currentTime
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.5
      );

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('[FocusMode] Error playing notification sound:', error);
    }
  }

  /**
   * Play a success sound (for completed sessions)
   */
  playSuccessSound(): void {
    if (!this.preferences.soundEnabled) return;

    try {
      this.initAudioContext();
      if (!this.audioContext) return;

      // Play a pleasant chord
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
      const duration = 0.8;

      frequencies.forEach((freq, index) => {
        const oscillator = this.audioContext!.createOscillator();
        const gainNode = this.audioContext!.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext!.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        const startTime =
          this.audioContext!.currentTime + index * 0.1;
        gainNode.gain.setValueAtTime(
          this.preferences.soundVolume * 0.3,
          startTime
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          startTime + duration
        );

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });
    } catch (error) {
      console.error('[FocusMode] Error playing success sound:', error);
    }
  }

  // ==================== Browser Notifications ====================

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('[FocusMode] Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  /**
   * Show browser notification
   */
  showNotification(title: string, body: string, icon?: string): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'focus-mode',
        requireInteraction: false,
      });
    } catch (error) {
      console.error('[FocusMode] Error showing notification:', error);
    }
  }

  // ==================== Time Formatting ====================

  /**
   * Format seconds to MM:SS display
   */
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format duration in minutes to human-readable string
   */
  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

// Export singleton instance
export const focusModeService = new FocusModeService();
export default focusModeService;
