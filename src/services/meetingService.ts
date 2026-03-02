import { supabase } from './supabase';
import { dataService } from './dataService';

// ============================================
// TYPES
// ============================================

export interface MeetingAnalyticsData {
  totalMeetings: number;
  totalHours: number;
  avgDuration: number;
  weeklyTrend: { label: string; count: number; hours: number }[];
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  topTopics: { topic: string; count: number }[];
  topDecisions: { decision: string; meetingTitle: string; date: Date }[];
  topAttendees: { name: string; meetingCount: number }[];
}

export interface MeetingRecording {
  id: string;
  title: string;
  startTime: Date | null;
  durationMinutes: number | null;
  audioFileUrl: string;
  transcript: string | null;
  summary: string | null;
  attendees: string[];
}

export interface MeetingSettings {
  defaultDuration: number;
  autoMuteOnJoin: boolean;
  autoRecording: boolean;
  aiScribeDefault: boolean;
  calendarSync: 'none' | 'google' | 'microsoft';
  breakoutRoomsEnabled: boolean;
  joinSoundEnabled: boolean;
  hostVideoDefault: boolean;
}

// ============================================
// CONSTANTS
// ============================================

export const DEFAULT_MEETING_SETTINGS: MeetingSettings = {
  defaultDuration: 30,
  autoMuteOnJoin: false,
  autoRecording: false,
  aiScribeDefault: true,
  calendarSync: 'google',
  breakoutRoomsEnabled: false,
  joinSoundEnabled: true,
  hostVideoDefault: true,
};

const MEETING_SETTINGS_KEY = 'pulse_meeting_settings';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============================================
// ANALYTICS
// ============================================

export const fetchMeetingAnalytics = async (): Promise<MeetingAnalyticsData> => {
  const empty: MeetingAnalyticsData = {
    totalMeetings: 0,
    totalHours: 0,
    avgDuration: 0,
    weeklyTrend: Array.from({ length: 8 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (7 - i) * 7);
      return { label: `W${i + 1}`, count: 0, hours: 0 };
    }),
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    topTopics: [],
    topDecisions: [],
    topAttendees: [],
  };

  try {
    const userId = dataService.getUserId();
    if (!userId) return empty;

    const { data: rows, error } = await supabase
      .from('meetings')
      .select('id, title, duration_minutes, sentiment_label, key_points, decisions, attendees, topics, created_at, start_time')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error || !rows || rows.length === 0) return empty;

    // Basic stats
    const totalMeetings = rows.length;
    const totalMinutes = rows.reduce((sum: number, r: any) => sum + (r.duration_minutes || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const avgDuration = totalMeetings > 0 ? Math.round(totalMinutes / totalMeetings) : 0;

    // 8-week trend
    const now = new Date();
    const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (7 - i) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const weekRows = rows.filter((r: any) => {
        const d = new Date(r.created_at);
        return d >= weekStart && d < weekEnd;
      });
      return {
        label: `W${i + 1}`,
        count: weekRows.length,
        hours: Math.round(weekRows.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0) / 60 * 10) / 10,
      };
    });

    // Sentiment
    const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
    rows.forEach((r: any) => {
      const s = (r.sentiment_label || '').toLowerCase();
      if (s === 'positive') sentimentBreakdown.positive++;
      else if (s === 'negative') sentimentBreakdown.negative++;
      else sentimentBreakdown.neutral++;
    });

    // Topics
    const topicCounts: Record<string, number> = {};
    rows.forEach((r: any) => {
      const topics = Array.isArray(r.topics) ? r.topics : [];
      topics.forEach((t: string) => {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
    });
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    // Decisions
    const topDecisions: MeetingAnalyticsData['topDecisions'] = [];
    rows.slice(0, 10).forEach((r: any) => {
      const decisions = Array.isArray(r.decisions) ? r.decisions : [];
      decisions.slice(0, 2).forEach((d: string) => {
        topDecisions.push({
          decision: d,
          meetingTitle: r.title,
          date: new Date(r.created_at),
        });
      });
    });

    // Attendees
    const attendeeCounts: Record<string, number> = {};
    rows.forEach((r: any) => {
      const attendees = Array.isArray(r.attendees) ? r.attendees : [];
      attendees.forEach((name: string) => {
        attendeeCounts[name] = (attendeeCounts[name] || 0) + 1;
      });
    });
    const topAttendees = Object.entries(attendeeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, meetingCount]) => ({ name, meetingCount }));

    return {
      totalMeetings,
      totalHours,
      avgDuration,
      weeklyTrend,
      sentimentBreakdown,
      topTopics,
      topDecisions,
      topAttendees,
    };
  } catch (err) {
    console.error('fetchMeetingAnalytics error:', err);
    return empty;
  }
};

// ============================================
// RECORDINGS
// ============================================

export const getMeetingRecordings = async (): Promise<MeetingRecording[]> => {
  try {
    const userId = dataService.getUserId();
    if (!userId) return [];

    const { data: rows, error } = await supabase
      .from('meetings')
      .select('id, title, start_time, duration_minutes, audio_file_url, transcript, summary, attendees')
      .eq('created_by', userId)
      .not('audio_file_url', 'is', null)
      .order('start_time', { ascending: false });

    if (error || !rows) return [];

    return rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      startTime: r.start_time ? new Date(r.start_time) : null,
      durationMinutes: r.duration_minutes,
      audioFileUrl: r.audio_file_url,
      transcript: r.transcript,
      summary: r.summary,
      attendees: Array.isArray(r.attendees) ? r.attendees : [],
    }));
  } catch (err) {
    console.error('getMeetingRecordings error:', err);
    return [];
  }
};

// ============================================
// SETTINGS
// ============================================

export const getMeetingSettings = (): MeetingSettings => {
  try {
    const stored = localStorage.getItem(MEETING_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_MEETING_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_MEETING_SETTINGS };
};

export const saveMeetingSettings = (settings: MeetingSettings): void => {
  try {
    localStorage.setItem(MEETING_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('saveMeetingSettings error:', err);
  }
};
