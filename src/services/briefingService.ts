/**
 * Comprehensive Briefing Service
 * Aggregates data from all sources to generate rich AI briefings
 */

import { dataService } from './dataService';
import { unifiedSearchService } from './unifiedSearchService';
import { GmailService } from './gmailService';
import { googleCalendarService } from './googleCalendarService';
import { supabase } from './supabase';

export interface BriefingContext {
  // Time context
  currentTime: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';

  // Calendar & Meetings
  todayEvents: string;
  upcomingMeetings: string;

  // Tasks & Priorities
  pendingTasks: string;
  urgentTasks: string;
  overdueTasks: string;

  // Messages & Communications
  unreadMessages: string;
  recentEmails: string;
  unreadEmailCount: number;

  // Contacts
  recentContacts: string;

  // Voxer/Voice Messages
  unplayedVoxes: string;

  // Recent Searches
  recentSearches: string;

  // Pulse Chat
  unreadPulseChats: string;

  // War Room / Projects
  activeProjects: string;

  // Journal & Archives
  recentJournalEntries: string;
  recentDecisions: string;

  // Analytics Summary
  productivitySummary: string;
}

export interface BriefingData {
  greeting: string;
  summary: string;
  highlights: Array<{
    category: 'calendar' | 'task' | 'message' | 'email' | 'vox' | 'contact' | 'project';
    title: string;
    detail: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    actionType?: string;
  }>;
  suggestions: Array<{
    action: string;
    reason: string;
    type: 'message' | 'event' | 'task' | 'email' | 'vox' | 'contact';
    priority: 'urgent' | 'high' | 'medium' | 'low';
  }>;
  stats: {
    unreadMessages: number;
    pendingTasks: number;
    todayMeetings: number;
    unplayedVoxes: number;
  };
}

class BriefingService {
  private userId: string | null = null;
  private gmailService: GmailService | null = null;

  setUserId(userId: string) {
    this.userId = userId;
  }

  private getUserId(): string {
    if (!this.userId) {
      const stored = localStorage.getItem('pulse_user_id');
      if (stored) {
        this.userId = stored;
        return stored;
      }
      this.userId = crypto.randomUUID();
      localStorage.setItem('pulse_user_id', this.userId);
    }
    return this.userId;
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Gather comprehensive context from all data sources
   */
  async gatherBriefingContext(): Promise<BriefingContext> {
    const userId = this.getUserId();
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    // Gather all data in parallel for performance
    const [
      events,
      tasks,
      threads,
      unifiedMessages,
      contacts,
      voxerRecordings,
      archives,
      outcomes,
      recentSearches,
      gmailData,
      googleCalendarData,
    ] = await Promise.all([
      dataService.getEvents(today, tomorrow),
      dataService.getTasks(),
      dataService.getThreads(),
      dataService.getUnifiedMessages({ limit: 50 }),
      dataService.getContacts(),
      dataService.getVoxerRecordings(),
      dataService.getArchives(),
      dataService.getOutcomes(),
      this.getRecentSearches(userId),
      this.getGmailSummary().catch(() => ({ unread: 0, emails: [] })),
      this.getGoogleCalendarEvents().catch(() => []),
    ]);

    // Process Calendar Events (combine local + Google Calendar)
    const allEvents = [...events];
    if (googleCalendarData.length > 0) {
      // Add Google Calendar events that aren't already in local
      const localEventTitles = new Set(events.map(e => e.title.toLowerCase()));
      googleCalendarData.forEach(ge => {
        if (!localEventTitles.has(ge.title.toLowerCase())) {
          allEvents.push(ge);
        }
      });
    }

    const todayEvents = allEvents
      .filter(e => {
        const eventDate = new Date(e.start);
        return eventDate >= today && eventDate < tomorrow;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 10)
      .map(e => {
        const time = new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const type = e.type === 'meet' ? '[MEETING]' : '[EVENT]';
        return `${time} ${type} ${e.title}${e.location ? ` @ ${e.location}` : ''}${e.attendees?.length ? ` (${e.attendees.length} attendees)` : ''}`;
      })
      .join('\n') || 'No events scheduled for today.';

    const upcomingMeetings = allEvents
      .filter(e => e.type === 'meet' && new Date(e.start) > now)
      .slice(0, 5)
      .map(e => {
        const time = new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${time}: ${e.title}`;
      })
      .join('\n') || 'No upcoming meetings.';

    // Process Tasks
    const incompleteTasks = tasks.filter(t => !t.completed);
    const urgentTasks = incompleteTasks
      .filter(t => t.priority === 'urgent' || t.priority === 'high')
      .slice(0, 5)
      .map(t => `[${t.priority?.toUpperCase()}] ${t.title}${t.dueDate ? ` (Due: ${new Date(t.dueDate).toLocaleDateString()})` : ''}`)
      .join('\n') || 'No urgent tasks.';

    const overdueTasks = incompleteTasks
      .filter(t => t.dueDate && new Date(t.dueDate) < now)
      .map(t => `OVERDUE: ${t.title} (Was due: ${new Date(t.dueDate!).toLocaleDateString()})`)
      .join('\n') || 'No overdue tasks.';

    const pendingTasks = incompleteTasks
      .slice(0, 10)
      .map(t => `- ${t.title}${t.priority ? ` [${t.priority}]` : ''}${t.dueDate ? ` (Due: ${new Date(t.dueDate).toLocaleDateString()})` : ''}`)
      .join('\n') || 'No pending tasks.';

    // Process Messages/Threads
    const unreadThreads = threads.filter(t => t.unread);
    const unreadMessages = unreadThreads
      .slice(0, 10)
      .map(t => {
        const lastMsg = t.messages[t.messages.length - 1];
        return `From ${t.contactName}: "${lastMsg?.text?.substring(0, 100) || 'No message'}"${lastMsg?.text?.length > 100 ? '...' : ''}`;
      })
      .join('\n') || 'No unread messages.';

    // Process Unified Messages (Slack, etc.)
    const unreadUnified = unifiedMessages
      .filter(m => !m.isRead)
      .slice(0, 10)
      .map(m => `[${m.source?.toUpperCase()}] ${m.senderName}: ${m.content?.substring(0, 80)}${m.content?.length > 80 ? '...' : ''}`)
      .join('\n');

    // Process Gmail
    const recentEmails = gmailData.emails
      .slice(0, 10)
      .map((e: any) => `From ${e.from}: ${e.subject}`)
      .join('\n') || 'No recent emails.';

    // Process Contacts - recently active
    const recentContacts = contacts
      .slice(0, 5)
      .map(c => `${c.name} (${c.role || 'Contact'})${c.company ? ` at ${c.company}` : ''}`)
      .join('\n') || 'No recent contacts.';

    // Process Voxer Recordings
    const unplayedVoxes = voxerRecordings
      .filter((v: any) => !v.played)
      .slice(0, 5)
      .map((v: any) => `Voice message from ${v.contact_name || 'Unknown'} (${Math.round(v.duration / 60)}min)${v.transcript ? `: "${v.transcript.substring(0, 50)}..."` : ''}`)
      .join('\n') || 'No unplayed voice messages.';

    // Process Recent Searches
    const recentSearchesStr = recentSearches
      .slice(0, 5)
      .map((s: any) => s.query)
      .join(', ') || 'No recent searches.';

    // Process Archives/Journal
    const recentJournal = archives
      .filter(a => a.type === 'journal')
      .slice(0, 3)
      .map(a => `${new Date(a.date).toLocaleDateString()}: ${a.title}`)
      .join('\n') || 'No recent journal entries.';

    const recentDecisions = archives
      .filter(a => a.type === 'decision_log')
      .slice(0, 3)
      .map(a => `${a.title} - ${a.decisionStatus || 'pending'}`)
      .join('\n') || 'No recent decisions.';

    // Process Outcomes/Projects
    const activeProjects = outcomes
      .filter(o => o.status === 'active' || o.status === 'blocked')
      .slice(0, 5)
      .map(o => `${o.title} - ${o.progress}% complete${o.status === 'blocked' ? ' [BLOCKED]' : ''}`)
      .join('\n') || 'No active projects.';

    // Productivity Summary
    const completedToday = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;
    const meetingsToday = allEvents.filter(e => e.type === 'meet').length;
    const productivitySummary = `Tasks: ${completedToday}/${totalTasks} completed | Meetings today: ${meetingsToday} | Unread messages: ${unreadThreads.length + gmailData.unread}`;

    return {
      currentTime: now.toLocaleString(),
      timeOfDay: this.getTimeOfDay(),
      todayEvents,
      upcomingMeetings,
      pendingTasks,
      urgentTasks,
      overdueTasks,
      unreadMessages: unreadMessages + (unreadUnified ? '\n\n--- Other Channels ---\n' + unreadUnified : ''),
      recentEmails,
      unreadEmailCount: gmailData.unread,
      recentContacts,
      unplayedVoxes,
      recentSearches: recentSearchesStr,
      unreadPulseChats: unreadUnified || 'No unread chats.',
      activeProjects,
      recentJournalEntries: recentJournal,
      recentDecisions,
      productivitySummary,
    };
  }

  /**
   * Get recent searches from saved searches table
   */
  private async getRecentSearches(userId: string): Promise<any[]> {
    try {
      // Try with last_used column first (newer schema)
      let result = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', userId)
        .order('last_used', { ascending: false })
        .limit(10);

      // If last_used column doesn't exist, fall back to created_at or updated_at
      if (result.error?.code === '42703' || result.error?.message?.includes('column')) {
        result = await supabase
          .from('saved_searches')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);
      }

      if (result.error) return [];
      return result.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Get Gmail summary using the Gmail service
   */
  private async getGmailSummary(): Promise<{ unread: number; emails: any[] }> {
    try {
      if (!this.gmailService) {
        this.gmailService = new GmailService();
      }

      const messages = await this.gmailService.getMessages(20, 'INBOX');
      const unreadCount = messages.filter((m) => !m.isRead).length;

      return {
        unread: unreadCount,
        emails: messages.slice(0, 10).map((m) => ({
          from: m.senderName || m.senderEmail || 'Unknown',
          subject: m.metadata?.subject || 'No Subject',
          snippet: m.content?.substring(0, 100) || '',
        })),
      };
    } catch (error) {
      console.log('Gmail not available for briefing');
      return { unread: 0, emails: [] };
    }
  }

  /**
   * Get Google Calendar events
   */
  private async getGoogleCalendarEvents(): Promise<any[]> {
    try {
      const events = await googleCalendarService.getTodayEvents();
      return events.map(e => ({
        ...e,
        source: 'google',
      }));
    } catch (error) {
      console.log('Google Calendar not available for briefing');
      return [];
    }
  }

  /**
   * Build the context string for AI consumption
   */
  buildContextString(context: BriefingContext): string {
    return `
=== PULSE DAILY BRIEFING CONTEXT ===
Current Time: ${context.currentTime}
Time of Day: ${context.timeOfDay}

=== TODAY'S CALENDAR ===
${context.todayEvents}

=== UPCOMING MEETINGS ===
${context.upcomingMeetings}

=== URGENT & HIGH PRIORITY TASKS ===
${context.urgentTasks}

=== OVERDUE TASKS ===
${context.overdueTasks}

=== PENDING TASKS ===
${context.pendingTasks}

=== UNREAD MESSAGES ===
${context.unreadMessages}

=== RECENT EMAILS (${context.unreadEmailCount} unread) ===
${context.recentEmails}

=== UNPLAYED VOICE MESSAGES ===
${context.unplayedVoxes}

=== ACTIVE PROJECTS/OUTCOMES ===
${context.activeProjects}

=== RECENT JOURNAL ENTRIES ===
${context.recentJournalEntries}

=== RECENT DECISIONS ===
${context.recentDecisions}

=== KEY CONTACTS ===
${context.recentContacts}

=== RECENT SEARCHES ===
${context.recentSearches}

=== PRODUCTIVITY SUMMARY ===
${context.productivitySummary}

=== END CONTEXT ===
    `.trim();
  }

  /**
   * Get quick stats for the briefing header
   */
  async getQuickStats(): Promise<BriefingData['stats']> {
    const userId = this.getUserId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [threads, tasks, events, voxes, gmailData] = await Promise.all([
      dataService.getThreads(),
      dataService.getTasks(),
      dataService.getEvents(today, tomorrow),
      dataService.getVoxerRecordings(),
      this.getGmailSummary().catch(() => ({ unread: 0, emails: [] })),
    ]);

    return {
      unreadMessages: threads.filter(t => t.unread).length + gmailData.unread,
      pendingTasks: tasks.filter(t => !t.completed).length,
      todayMeetings: events.filter(e => e.type === 'meet').length,
      unplayedVoxes: voxes.filter((v: any) => !v.played).length,
    };
  }
}

export const briefingService = new BriefingService();
