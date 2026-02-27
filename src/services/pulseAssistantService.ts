import { GoogleGenAI } from "@google/genai";
import { AppView, User, Contact, CalendarEvent, Thread, ArchiveItem } from "../types";
import { DecisionWithVotes } from "./decisionService";
import { Task } from "./taskService";
import { CachedEmail } from "./emailSyncService";

// ─── 5-minute in-memory cache (same pattern as conversationalAIService) ──────
const AI_CACHE_TTL_MS = 5 * 60 * 1000;
interface CacheEntry { response: string; timestamp: number; }
const responseCache = new Map<string, CacheEntry>();

function buildCacheKey(query: string, context: AssistantContext): string {
  const decSig = (context.decisions ?? []).map(d => d.id + d.updated_at).join(',');
  const taskSig = (context.tasks ?? []).map(t => t.id + t.updated_at).join(',');
  const threadSig = (context.threads ?? []).map(t => t.id).join(',');
  const emailSig = `unread:${context.emailUnreadCount ?? 0}|count:${(context.emails ?? []).length}`;
  const eventSig = (context.events ?? []).map(e => e.id).join(',');
  const contactSig = (context.contacts ?? []).map(c => c.id).join(',');
  const voxSig = `vox:${(context.voxerRecordings ?? []).length}`;
  const analyticsSig = context.analyticsMetrics
    ? `tasks:${context.analyticsMetrics.tasksCompleted}/${context.analyticsMetrics.tasksTotal}`
    : '';
  const archiveSig = `arch:${(context.archives ?? []).length}`;
  return `${context.section}|${query}|${decSig}|${taskSig}|${threadSig}|${emailSig}|${eventSig}|${contactSig}|${voxSig}|${analyticsSig}|${archiveSig}`;
}

function getCached(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > AI_CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.response;
}

function setCache(key: string, response: string): void {
  if (responseCache.size >= 20) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, { response, timestamp: Date.now() });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsMetrics {
  tasksCompleted: number;
  tasksTotal: number;
  messagesSent: number;
  messagesReceived: number;
  meetingsToday: number;
  focusTime: number;
  avgResponseTime: number;
}

export interface AssistantContext {
  section: AppView;
  user: User;
  workspaceId: string;
  // Decisions & Tasks (DASHBOARD, DECISIONS_TASKS)
  decisions?: DecisionWithVotes[];
  tasks?: Task[];
  // Messages (MESSAGES)
  threads?: Thread[];
  // Email (EMAIL)
  emails?: CachedEmail[];
  emailUnreadCount?: number;
  // Calendar / Meetings (CALENDAR, MEETINGS)
  events?: CalendarEvent[];
  // Contacts (CONTACTS)
  contacts?: Contact[];
  // Voxer recordings (VOXER)
  voxerRecordings?: any[];
  // Analytics metrics (ANALYTICS)
  analyticsMetrics?: AnalyticsMetrics;
  // Archives (ARCHIVES)
  archives?: ArchiveItem[];
}

export interface PulseQuickAction {
  id: string;
  label: string;
  query: string;
}

export interface SuggestedAction {
  id: string;
  label: string;
  /** AppView to navigate to, or null for non-nav actions */
  targetView?: AppView;
  /** Custom event name + detail for window.dispatchEvent */
  event?: { name: string; detail?: Record<string, unknown> };
}

// ─── Section metadata ─────────────────────────────────────────────────────────

export const SECTION_LABELS: Partial<Record<AppView, string>> = {
  [AppView.DASHBOARD]: 'Dashboard',
  [AppView.MESSAGES]: 'Messages',
  [AppView.EMAIL]: 'Email',
  [AppView.SMS]: 'SMS',
  [AppView.VOXER]: 'Voxer',
  [AppView.CALENDAR]: 'Calendar',
  [AppView.MEETINGS]: 'Meetings',
  [AppView.CONTACTS]: 'Contacts',
  [AppView.DECISIONS_TASKS]: 'Decisions & Tasks',
  [AppView.ANALYTICS]: 'Analytics',
  [AppView.ARCHIVES]: 'Archives',
  [AppView.LIVE_AI]: 'War Room',
  [AppView.TOOLS]: 'AI Lab',
};

const SECTION_QUICK_ACTIONS: Partial<Record<AppView, PulseQuickAction[]>> = {
  [AppView.DASHBOARD]: [
    { id: 'summarise-day', label: 'Summarise my day', query: 'Give me a summary of my day and what needs attention.' },
    { id: 'whats-urgent', label: "What's urgent?", query: 'What is most urgent and needs my immediate attention right now?' },
    { id: 'top-priorities', label: 'Top priorities', query: 'What are my top priorities today based on my tasks and decisions?' },
  ],
  [AppView.DECISIONS_TASKS]: [
    { id: 'needs-vote', label: "What needs my vote?", query: 'Which decisions are waiting for my vote?' },
    { id: 'blocking', label: "What's blocking me?", query: 'What tasks or decisions are blocking my progress?' },
    { id: 'overdue', label: 'Overdue items', query: 'What tasks are overdue or at risk of missing deadlines?' },
    { id: 'next-action', label: 'What to work on next?', query: 'Based on my tasks and decisions, what should I work on next?' },
  ],
  [AppView.MESSAGES]: [
    { id: 'catch-up', label: 'Catch me up on unread', query: 'Catch me up on my unread messages and what needs a reply.' },
    { id: 'draft-reply', label: 'Help draft a reply', query: 'Help me draft a professional reply to a message.' },
    { id: 'urgent-msg', label: 'Any urgent messages?', query: 'Are there any urgent or important messages I should respond to first?' },
  ],
  [AppView.EMAIL]: [
    { id: 'inbox-summary', label: 'Summarise inbox', query: 'Give me a summary of my email inbox and the most important emails.' },
    { id: 'unread-highlights', label: 'Unread highlights', query: 'What are the most important unread emails I should read first?' },
    { id: 'find-email', label: 'Find an email', query: 'Help me find an email about a specific topic. What topic should I search for?' },
  ],
  [AppView.CALENDAR]: [
    { id: 'today', label: "What's on today?", query: "What meetings and events do I have today?" },
    { id: 'free-time', label: 'Find free time', query: 'When do I have free time this week for focused deep work?' },
    { id: 'conflicts', label: 'Any scheduling conflicts?', query: 'Do I have any scheduling conflicts or back-to-back meetings I should know about?' },
  ],
  [AppView.MEETINGS]: [
    { id: 'upcoming-mtg', label: 'Upcoming meetings', query: 'What meetings do I have coming up and what should I prepare?' },
    { id: 'action-items', label: 'Meeting action items', query: 'What action items came out of my recent meetings that I need to follow up on?' },
    { id: 'meeting-prep', label: 'Help me prepare', query: 'Help me prepare for my next meeting. What do I need to know?' },
  ],
  [AppView.CONTACTS]: [
    { id: 'follow-up', label: 'Who should I follow up with?', query: 'Who should I follow up with and why? Who have I not contacted recently?' },
    { id: 'relationship-health', label: 'Relationship health check', query: 'Which contact relationships might need attention or re-engagement?' },
  ],
  [AppView.VOXER]: [
    { id: 'urgent-voxes', label: 'Any urgent voxes?', query: 'Are there any urgent vox messages I should listen to right away?' },
    { id: 'summarise-threads', label: 'Summarise threads', query: 'Summarise the activity in my vox message threads.' },
  ],
  [AppView.ANALYTICS]: [
    { id: 'analyse-week', label: 'Analyse my week', query: 'Analyse my communication and productivity patterns this week.' },
    { id: 'anomalies', label: 'Any anomalies?', query: 'Are there any unusual patterns or anomalies in my analytics I should know about?' },
  ],
  [AppView.ARCHIVES]: [
    { id: 'recent-archives', label: 'What was recently archived?', query: 'What has been recently archived and why?' },
    { id: 'find-archive', label: 'Find archived item', query: 'Help me find a specific archived item. What are you looking for?' },
  ],
};

// Suggested actions that appear after AI responses — navigate to the relevant section
const SECTION_SUGGESTED_ACTIONS: Partial<Record<AppView, SuggestedAction[]>> = {
  [AppView.DASHBOARD]: [
    { id: 'go-tasks', label: 'Open Tasks', targetView: AppView.DECISIONS_TASKS },
    { id: 'go-calendar', label: 'Check Calendar', targetView: AppView.CALENDAR },
    { id: 'go-messages', label: 'Open Messages', targetView: AppView.MESSAGES },
  ],
  [AppView.DECISIONS_TASKS]: [
    { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
    { id: 'go-calendar', label: 'Check Calendar', targetView: AppView.CALENDAR },
    { id: 'go-contacts', label: 'View Contacts', targetView: AppView.CONTACTS },
  ],
  [AppView.MESSAGES]: [
    { id: 'go-email', label: 'Check Email', targetView: AppView.EMAIL },
    { id: 'go-contacts', label: 'View Contacts', targetView: AppView.CONTACTS },
    { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
  ],
  [AppView.EMAIL]: [
    { id: 'go-messages', label: 'Open Messages', targetView: AppView.MESSAGES },
    { id: 'go-contacts', label: 'View Contacts', targetView: AppView.CONTACTS },
    { id: 'go-calendar', label: 'Check Calendar', targetView: AppView.CALENDAR },
  ],
  [AppView.CALENDAR]: [
    { id: 'go-meetings', label: 'View Meetings', targetView: AppView.MEETINGS },
    { id: 'go-tasks', label: 'Open Tasks', targetView: AppView.DECISIONS_TASKS },
    { id: 'go-contacts', label: 'View Contacts', targetView: AppView.CONTACTS },
  ],
  [AppView.MEETINGS]: [
    { id: 'go-calendar', label: 'Open Calendar', targetView: AppView.CALENDAR },
    { id: 'go-tasks', label: 'Open Tasks', targetView: AppView.DECISIONS_TASKS },
    { id: 'go-contacts', label: 'View Contacts', targetView: AppView.CONTACTS },
  ],
  [AppView.CONTACTS]: [
    { id: 'go-messages', label: 'Open Messages', targetView: AppView.MESSAGES },
    { id: 'go-email', label: 'Check Email', targetView: AppView.EMAIL },
    { id: 'go-tasks', label: 'Open Tasks', targetView: AppView.DECISIONS_TASKS },
  ],
  [AppView.VOXER]: [
    { id: 'go-messages', label: 'Open Messages', targetView: AppView.MESSAGES },
    { id: 'go-contacts', label: 'View Contacts', targetView: AppView.CONTACTS },
  ],
  [AppView.ANALYTICS]: [
    { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
    { id: 'go-tasks', label: 'Open Tasks', targetView: AppView.DECISIONS_TASKS },
  ],
  [AppView.ARCHIVES]: [
    { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
    { id: 'go-tasks', label: 'Open Tasks', targetView: AppView.DECISIONS_TASKS },
  ],
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const pulseAssistantService = {
  /**
   * Query the AI with the current section context.
   * API key resolution: localStorage → VITE_GEMINI_API_KEY → VITE_API_KEY
   */
  async query(
    userQuery: string,
    context: AssistantContext,
    apiKey: string,
  ): Promise<string> {
    const cacheKey = buildCacheKey(userQuery, context);
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const sectionLabel = SECTION_LABELS[context.section] ?? context.section;

      const contextBlocks: string[] = [];

      // Decisions & Tasks
      const decisionsData = (context.decisions ?? []).slice(0, 15).map(d => ({
        id: d.id,
        title: d.title,
        status: d.status,
        type: d.decision_type,
        votes: d.votes?.length ?? 0,
        vote_counts: d.vote_counts,
        created_at: d.created_at,
      }));
      const tasksData = (context.tasks ?? []).slice(0, 15).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee_id: t.assignee_id,
        deadline: t.deadline,
      }));
      if (decisionsData.length > 0) {
        contextBlocks.push(`Decisions (${decisionsData.length} total):\n${JSON.stringify(decisionsData, null, 2)}`);
      }
      if (tasksData.length > 0) {
        contextBlocks.push(`Tasks (${tasksData.length} total):\n${JSON.stringify(tasksData, null, 2)}`);
      }

      // Threads / Messages
      const threadsData = (context.threads ?? []).slice(0, 10).map(t => ({
        id: t.id,
        contact: t.contactName,
        message_count: t.messages?.length ?? 0,
        unread: t.unread,
        pinned: t.pinned,
      }));
      if (threadsData.length > 0) {
        contextBlocks.push(`Message Threads (${threadsData.length} total):\n${JSON.stringify(threadsData, null, 2)}`);
      }

      // Emails
      if (context.emailUnreadCount !== undefined || (context.emails ?? []).length > 0) {
        const emailsData = (context.emails ?? []).slice(0, 10).map(e => ({
          id: e.id,
          subject: e.subject,
          from: e.from,
          date: e.date,
          read: e.read,
          starred: e.starred,
          snippet: e.snippet?.slice(0, 120),
        }));
        const unreadStr = context.emailUnreadCount !== undefined
          ? `Unread count: ${context.emailUnreadCount}\n`
          : '';
        if (emailsData.length > 0 || unreadStr) {
          contextBlocks.push(`Email Inbox:\n${unreadStr}${JSON.stringify(emailsData, null, 2)}`);
        }
      }

      // Calendar Events
      const eventsData = (context.events ?? []).slice(0, 15).map(e => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        location: e.location,
        type: e.type,
        attendees: Array.isArray(e.attendeesDetailed) ? e.attendeesDetailed.length : 0,
      }));
      if (eventsData.length > 0) {
        contextBlocks.push(`Calendar Events (${eventsData.length}):\n${JSON.stringify(eventsData, null, 2)}`);
      }

      // Contacts
      const contactsData = (context.contacts ?? []).slice(0, 20).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        company: c.company,
        lastSeen: c.lastSeen,
        status: c.status,
      }));
      if (contactsData.length > 0) {
        contextBlocks.push(`Contacts (${contactsData.length} total):\n${JSON.stringify(contactsData, null, 2)}`);
      }

      // Voxer recordings
      const voxData = (context.voxerRecordings ?? []).slice(0, 10).map((v: any) => ({
        id: v.id,
        title: v.title ?? v.type ?? 'Vox',
        duration: v.duration,
        listened: v.listened,
        created_at: v.created_at,
        sender: v.sender_name ?? v.user_id,
      }));
      if (voxData.length > 0) {
        const unlistened = voxData.filter(v => !v.listened).length;
        contextBlocks.push(`Vox Messages (${voxData.length} total, ${unlistened} unlistened):\n${JSON.stringify(voxData, null, 2)}`);
      }

      // Analytics metrics
      if (context.analyticsMetrics) {
        const m = context.analyticsMetrics;
        contextBlocks.push(`Analytics Metrics (today):\n${JSON.stringify({
          tasks_completed_today: m.tasksCompleted,
          tasks_total: m.tasksTotal,
          completion_rate: m.tasksTotal > 0 ? `${Math.round(m.tasksCompleted / m.tasksTotal * 100)}%` : '0%',
          messages_sent: m.messagesSent,
          messages_received: m.messagesReceived,
          meetings_today: m.meetingsToday,
          avg_response_time_minutes: m.avgResponseTime,
        }, null, 2)}`);
      }

      // Archives
      const archiveData = (context.archives ?? []).slice(0, 15).map(a => ({
        id: a.id,
        title: a.title,
        type: a.type,
        archived_at: a.archivedAt,
      }));
      if (archiveData.length > 0) {
        contextBlocks.push(`Archived Items (${archiveData.length} total):\n${JSON.stringify(archiveData, null, 2)}`);
      }

      const hasRealData = contextBlocks.length > 0;
      if (!hasRealData) {
        contextBlocks.push('(No data loaded for this section yet.)');
      }

      const prompt = `You are Pulse AI, an intelligent assistant embedded in the Pulse productivity app.

${hasRealData
  ? `CRITICAL INSTRUCTION: You have been given the user's REAL, LIVE data from their ${sectionLabel} section. You MUST:
- Reference specific items by their ACTUAL names and titles from the data below
- Cite exact counts, deadlines, and statuses from the data
- Name real tasks, decisions, contacts, or events — do NOT speak in generalities when specifics are available
- If asked "what's overdue?" list the ACTUAL overdue items by name
- If asked "who should I follow up with?" name ACTUAL contacts from the data`
  : `No data was loaded for this section. Give helpful general guidance about what this section contains and how to use it.`}

FORMATTING RULES:
- Use **bold** for names and key terms
- Use bullet lists for multiple items
- Use numbered lists for steps or priorities
- Use ## headings if answer spans multiple topics
- Keep paragraphs short (2-3 sentences)
- Lead with a direct answer, then expand with specifics from the data

Current section: ${sectionLabel}
User: ${context.user.name}
Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

--- LIVE DATA ---
${contextBlocks.join('\n\n')}
--- END DATA ---

User question: "${userQuery}"

Answer:`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.4 },
      });

      const result = response.text ?? 'I was unable to generate a response. Please try again.';
      setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('PulseAssistant query failed:', error);
      return 'I encountered an error processing your request. Please check your API key and try again.';
    }
  },

  /**
   * Returns a one-line status summary for the context chip below the header.
   */
  getSectionSummary(context: AssistantContext): string {
    const decisions = context.decisions ?? [];
    const tasks = context.tasks ?? [];

    if (context.section === AppView.DECISIONS_TASKS) {
      const voting = decisions.filter(d => d.status === 'voting').length;
      const overdue = tasks.filter(
        t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done',
      ).length;
      const parts: string[] = [];
      if (voting > 0) parts.push(`${voting} pending vote${voting > 1 ? 's' : ''}`);
      if (overdue > 0) parts.push(`${overdue} overdue`);
      if (parts.length === 0) parts.push(`${tasks.length} task${tasks.length !== 1 ? 's' : ''}`);
      return parts.join(' · ');
    }

    if (context.section === AppView.DASHBOARD) {
      const active = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length;
      const voting = decisions.filter(d => d.status === 'voting').length;
      const parts: string[] = [];
      if (active > 0) parts.push(`${active} active task${active !== 1 ? 's' : ''}`);
      if (voting > 0) parts.push(`${voting} decision${voting !== 1 ? 's' : ''} need attention`);
      return parts.length > 0 ? parts.join(' · ') : 'All caught up';
    }

    if (context.section === AppView.MESSAGES) {
      const count = context.threads?.length ?? 0;
      return count > 0 ? `${count} thread${count !== 1 ? 's' : ''}` : '';
    }

    if (context.section === AppView.EMAIL) {
      const unread = context.emailUnreadCount ?? 0;
      const total = context.emails?.length ?? 0;
      const parts: string[] = [];
      if (unread > 0) parts.push(`${unread} unread`);
      if (total > 0) parts.push(`${total} in inbox`);
      return parts.join(' · ');
    }

    if (context.section === AppView.CALENDAR || context.section === AppView.MEETINGS) {
      const today = new Date();
      const todayStr = today.toDateString();
      const todayCount = (context.events ?? []).filter(
        e => new Date(e.start).toDateString() === todayStr,
      ).length;
      const total = context.events?.length ?? 0;
      const parts: string[] = [];
      if (todayCount > 0) parts.push(`${todayCount} today`);
      if (total > todayCount) parts.push(`${total - todayCount} upcoming`);
      return parts.length > 0 ? parts.join(' · ') : '';
    }

    if (context.section === AppView.CONTACTS) {
      const count = context.contacts?.length ?? 0;
      return count > 0 ? `${count} contact${count !== 1 ? 's' : ''}` : '';
    }

    if (context.section === AppView.VOXER) {
      const total = context.voxerRecordings?.length ?? 0;
      const unlistened = (context.voxerRecordings ?? []).filter((v: any) => !v.listened).length;
      const parts: string[] = [];
      if (unlistened > 0) parts.push(`${unlistened} unlistened`);
      if (total > 0 && !unlistened) parts.push(`${total} vox message${total !== 1 ? 's' : ''}`);
      return parts.join(' · ');
    }

    if (context.section === AppView.ANALYTICS) {
      const m = context.analyticsMetrics;
      if (!m) return '';
      const rate = m.tasksTotal > 0 ? Math.round(m.tasksCompleted / m.tasksTotal * 100) : 0;
      return `${m.tasksCompleted} tasks done · ${rate}% completion`;
    }

    if (context.section === AppView.ARCHIVES) {
      const count = context.archives?.length ?? 0;
      return count > 0 ? `${count} archived item${count !== 1 ? 's' : ''}` : '';
    }

    return '';
  },

  /**
   * Returns context-sensitive quick-action chips for the current section.
   */
  getQuickActions(section: AppView): PulseQuickAction[] {
    return SECTION_QUICK_ACTIONS[section] ?? [
      { id: 'how-help', label: 'How can you help?', query: 'What can you help me with in this section of the app?' },
      { id: 'summarise', label: 'Summarise this section', query: 'Give me a summary of what is in this section.' },
    ];
  },

  /**
   * Returns suggested navigation/action chips shown after an AI response.
   * These execute real app actions via window.dispatchEvent.
   */
  getSuggestedActions(section: AppView): SuggestedAction[] {
    return SECTION_SUGGESTED_ACTIONS[section] ?? [
      { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
      { id: 'go-tasks', label: 'Open Tasks', targetView: AppView.DECISIONS_TASKS },
    ];
  },
};
