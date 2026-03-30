import { supabase } from './supabase';
import { dataService } from './dataService';
import { ECOSYSTEM_APPS } from '../config/ecosystem';

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
  autoExportToEntomate: boolean;
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
  autoExportToEntomate: false,
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

    // Primary: read from pulse_video_rooms (Daily.co cloud recordings)
    const { data: videoRooms, error: vrError } = await supabase
      .from('pulse_video_rooms')
      .select('id, title, created_at, duration_seconds, recording_url, transcript, summary')
      .eq('created_by', userId)
      .eq('status', 'ended')
      .order('created_at', { ascending: false });

    const dailyRecordings: MeetingRecording[] = (videoRooms ?? []).map((r: any) => {
      // Parse structured summary JSON if available
      let summaryText: string | null = null;
      if (r.summary) {
        try {
          const parsed = JSON.parse(r.summary);
          summaryText = parsed.aiSummary ?? r.summary;
        } catch {
          summaryText = r.summary;
        }
      }
      return {
        id: r.id,
        title: r.title ?? 'Pulse Meeting',
        startTime: r.created_at ? new Date(r.created_at) : null,
        durationMinutes: r.duration_seconds ? Math.round(r.duration_seconds / 60) : null,
        audioFileUrl: r.recording_url ?? '',
        transcript: r.transcript ?? null,
        summary: summaryText,
        attendees: [],
      };
    }).filter((r: MeetingRecording) => r.audioFileUrl || r.transcript);

    // Fallback: legacy meetings table (AI Scribe recordings)
    const { data: legacyRows } = await supabase
      .from('meetings')
      .select('id, title, start_time, duration_minutes, audio_file_url, transcript, summary, attendees')
      .eq('created_by', userId)
      .not('audio_file_url', 'is', null)
      .order('start_time', { ascending: false });

    const legacyRecordings: MeetingRecording[] = (legacyRows ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      startTime: r.start_time ? new Date(r.start_time) : null,
      durationMinutes: r.duration_minutes,
      audioFileUrl: r.audio_file_url,
      transcript: r.transcript,
      summary: r.summary,
      attendees: Array.isArray(r.attendees) ? r.attendees : [],
    }));

    // Merge: Daily recordings first (most recent), then legacy
    return [...dailyRecordings, ...legacyRecordings];
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

// ============================================
// ENTOMATE EXPORT
// ============================================

export type ExportStatus = 'idle' | 'exporting' | 'exported' | 'error';

/**
 * Fetch a single recording by ID (for bot action export).
 */
export const getMeetingRecordingById = async (
  recordingId: string,
  source: 'pulse_video' | 'ai_scribe'
): Promise<MeetingRecording | null> => {
  try {
    if (source === 'pulse_video') {
      const { data } = await supabase
        .from('pulse_video_rooms')
        .select('id, title, created_at, duration_seconds, recording_url, transcript')
        .eq('id', recordingId)
        .single();
      if (!data) return null;
      return {
        id: data.id,
        title: data.title || 'Pulse Meeting',
        startTime: data.created_at ? new Date(data.created_at) : null,
        durationMinutes: data.duration_seconds ? Math.round(data.duration_seconds / 60) : null,
        audioFileUrl: data.recording_url || '',
        transcript: data.transcript || null,
        summary: null,
        attendees: [],
      };
    } else {
      const { data } = await supabase
        .from('meetings')
        .select('id, title, start_time, duration_minutes, audio_file_url, transcript, attendees')
        .eq('id', recordingId)
        .single();
      if (!data) return null;
      return {
        id: data.id,
        title: data.title,
        startTime: data.start_time ? new Date(data.start_time) : null,
        durationMinutes: data.duration_minutes,
        audioFileUrl: data.audio_file_url || '',
        transcript: data.transcript || null,
        summary: null,
        attendees: Array.isArray(data.attendees) ? data.attendees : [],
      };
    }
  } catch (err) {
    console.error('getMeetingRecordingById error:', err);
    return null;
  }
};

/**
 * Check if a meeting has already been exported to Entomate
 * by looking for a prior meeting.export event in ecosystem_events.
 */
export const checkEntomateExportStatus = async (meetingId: string): Promise<boolean> => {
  try {
    const { data } = await supabase
      .from('ecosystem_events')
      .select('id')
      .eq('event_type', 'meeting.export')
      .eq('direction', 'outbound')
      .eq('status', 'processed')
      .contains('payload', { meetingId })
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
};

/**
 * Check if Entomate ecosystem connection is configured and enabled.
 */
export const isEntomateConnected = async (): Promise<boolean> => {
  try {
    const { data } = await supabase
      .from('ecosystem_config')
      .select('enabled')
      .eq('app_name', 'entomate')
      .single();
    return data?.enabled === true;
  } catch {
    return false;
  }
};

/**
 * Export a Pulse meeting recording to Entomate for AI processing.
 * Sends via the ecosystem-outbound edge function.
 */
/**
 * Auto-export a just-ended meeting to Entomate if the setting is enabled.
 * Called from meeting end handlers — fires and forgets (logs errors, never throws).
 */
export const autoExportIfEnabled = async (meeting: {
  id?: string;
  title: string;
  transcript?: string | null;
  audioUrl?: string | null;
  attendees?: string[];
  durationMinutes?: number;
  source?: 'pulse_video' | 'ai_scribe' | 'voxer';
}): Promise<void> => {
  try {
    const settings = getMeetingSettings();
    if (!settings.autoExportToEntomate) return;

    const connected = await isEntomateConnected();
    if (!connected) return;

    const recording: MeetingRecording = {
      id: meeting.id || crypto.randomUUID(),
      title: meeting.title,
      startTime: new Date(),
      durationMinutes: meeting.durationMinutes || null,
      audioFileUrl: meeting.audioUrl || '',
      transcript: meeting.transcript || null,
      summary: null,
      attendees: meeting.attendees || [],
    };

    const result = await exportMeetingToEntomate(recording, meeting.source || 'ai_scribe');
    if (result.success) {
      console.log(`[autoExport] Meeting "${meeting.title}" exported to Entomate`);
    } else {
      console.warn(`[autoExport] Export failed: ${result.error}`);
    }
  } catch (err) {
    console.error('[autoExport] Error:', err);
  }
};

export const exportMeetingToEntomate = async (
  recording: MeetingRecording,
  source: 'pulse_video' | 'ai_scribe' | 'voxer' = 'pulse_video'
): Promise<{ success: boolean; error?: string }> => {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return { success: false, error: 'Not authenticated' };

    const outboundUrl = ECOSYSTEM_APPS.pulse.inboundUrl.replace('ecosystem-inbound', 'ecosystem-outbound');

    const resp = await fetch(outboundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        eventType: 'meeting.export',
        targetApp: 'entomate',
        entityType: 'meeting',
        entityId: recording.id,
        data: {
          meetingId: recording.id,
          title: recording.title,
          audioUrl: recording.audioFileUrl || null,
          transcript: recording.transcript || null,
          attendees: recording.attendees.map(name => ({ name })),
          durationMinutes: recording.durationMinutes || 0,
          recordedAt: recording.startTime?.toISOString() || new Date().toISOString(),
          source,
        },
      }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      return { success: false, error: body.error || `Export failed (${resp.status})` };
    }

    return { success: true };
  } catch (err) {
    console.error('exportMeetingToEntomate error:', err);
    return { success: false, error: (err as Error).message };
  }
};
