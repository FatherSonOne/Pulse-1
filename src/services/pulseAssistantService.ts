import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AppView, User, Contact, CalendarEvent, Thread, ArchiveItem } from "../types";
import { DecisionWithVotes } from "./decisionService";
import { Task } from "./taskService";
import { CachedEmail } from "./emailSyncService";
import { settingsService } from "./settingsService";

// ─── Pulse App Knowledge Base ────────────────────────────────────────────────
// Injected into every AI query so Pulse AI can guide users through the entire app.

const PULSE_APP_KNOWLEDGE = `
## ABOUT PULSE

Pulse is a unified communication and productivity platform that combines email, messaging, SMS, async voice (Voxer), video meetings, calendar, task management, team decisions, CRM integrations, analytics, and AI — all in a single app. It runs on web and Android.

## APP SECTIONS

### Overview
- **Dashboard** — Your home screen. Shows a daily AI briefing with greeting, summary, and focus recommendation. Includes upcoming events with live countdowns, unread message count, quick scheduler, and AI nudges for overdue tasks, stalled decisions, and follow-ups. Also has an AI web search bar.

### Communication
- **Messages** — Unified messaging inbox. Supports threads, pinned messages, smart folders (Priority, Team, Follow-ups, Archived), inline tools (type / to access: /gif, /file, /task, /poll, /reminder), conversation highlights (decisions, action items), bulk actions, and ecosystem bot messages from connected apps.
- **Email** — Full email client (Gmail/Outlook). Features include AI daily briefing with top 5 priority emails, email templates with variables ({{first_name}}, {{company}}, {{date}}), scheduling (Tomorrow, Monday 9 AM, etc.), follow-up reminders, email campaigns (3-step builder: Setup, Compose, Review & Send), audience segments (All, Recent, VIP, Important), and filters with auto-actions.
- **SMS** — Text messaging. Send and receive SMS/text messages directly within Pulse.
- **Voxer** — Async voice messaging with 8 modes: Pulse Radio (broadcast), Voice Threads (threaded conversations), Team Vox (team channels with @mentions), Vox Notes (personal recordings), Quick Vox (fast send), Vox Drop (scheduled delivery), Classic Voxer (walkie-talkie style), and AI transcription.

### Work & People
- **Calendar** — Calendar management with Google Calendar sync. View events, create new ones, set reminders, and find free time. AI helps identify scheduling conflicts and suggest optimal meeting times.
- **Meetings** — Pulse Video Room for virtual meetings. Start or join meetings, view upcoming meetings, get AI-generated agendas, and track meeting action items.
- **Contacts** — Contact management with groups, relationship tracking, and CRM integration. View contact details, communication history, and relationship health. Filter by status, company, or last interaction.
- **Decisions & Tasks** — Team decision-making and task management. Create decisions with voting (approve/reject/abstain), set deadlines, and track outcomes. Create tasks, assign to team members, set priorities (urgent/high/medium/low), set deadlines, and track progress. Filter by status (todo/in-progress/done/cancelled).

### Intelligence
- **Search** — Unified search across all sections. Search messages, emails, contacts, tasks, decisions, calendar events, and archives from one search bar. Supports natural language queries.
- **Analytics** — Communication and productivity analytics. View message volume, response times, task completion rates, team health scores, and AI-generated insights. Export reports.
- **Archives** — Archive collections with smart folders, timeline view, and export to Google Drive. Archive old messages, emails, decisions, and tasks for reference.
- **User Guide** — In-app help documentation covering all features, workflows, tips, keyboard shortcuts, and troubleshooting. Searchable and organized by category.

### Experimental
- **War Room** (AI Lab) — Live collaborative sessions with real-time AI assistance. Start sessions, invite team members, and work together with AI support.
- **Pulse Chat** — Voice-first AI chat experience with real-time visualization. Connect via voice, take auto-notes, export transcripts, and add context files for RAG.

### Settings & Admin
- **Settings** — Personal profile (display name, handle, bio, avatar), appearance (dark/light mode), session management, AI & Intelligence configuration (model selection, voice agent settings, knowledge base), integrations (Google, CRM), ecosystem bridge, notifications, workspace management, team management, accessibility, privacy & data, plan & billing, and developer tools.
- **Admin Dashboard** — Admin-only user and workspace management tools.
- **Test Matrix** — Developer testing and debugging dashboard.

## WORKSPACES & TEAMS

- **Workspace** — An isolated environment in Pulse. All data, contacts, settings, and billing belong to a workspace. Users can create multiple workspaces and switch between them.
- **Creating a workspace:** Go to Settings → Workspace, or use the workspace switcher in the sidebar header.
- **Roles:** Owner (full control, can transfer ownership or delete), Admin (elevated permissions), Moderator (content moderation), Member (standard access), Guest (limited access), Bot (automated integrations).
- **Inviting members:** Go to Settings → Team Management → Invite. Send invites by email or share an invite link.
- **Transferring ownership:** Settings → Workspace → Transfer Ownership. Select a team member to transfer to.
- **Deleting a workspace:** Settings → Workspace → Danger Zone. Soft-deletes (recoverable for 30 days), then permanent.

## KEY WORKFLOWS

1. **Task management:** Create a task (Decisions & Tasks → New Task) → Assign to a team member → Set priority and deadline → Track progress on Dashboard → Mark complete when done.
2. **Decision voting:** Create a decision (Decisions & Tasks → New Decision) → Team members vote (approve/reject/abstain) → View results → Record outcome. Stale decisions (no activity in 24h) trigger AI nudges.
3. **Email triage:** Open Email → Review AI Daily Briefing (top 5 priorities) → Read and reply to important emails → Use templates for common responses → Schedule follow-ups → Archive processed emails.
4. **Contact follow-up:** Check Contacts → Sort by "last interaction" → Identify contacts you haven't reached out to → Send a message or email → Log the interaction.
5. **Meeting preparation:** Check Calendar or Meetings → Review upcoming meetings → Ask Pulse AI "Help me prepare for my next meeting" → Review attendee info from Contacts → Take notes during the meeting.

## INTEGRATIONS

- **Google:** Gmail (email sync), Google Calendar (event sync), Google Contacts, Google Drive (archive export).
- **CRM:** HubSpot, Salesforce, Pipedrive, Zoho — sync contacts, deals, and activity.
- **Ecosystem Bridge:** Receive bot messages from connected QntmEcos apps (Entomate for task management, Logos Vision for CRM). Configure in Settings → Ecosystem Bridge.

## KEYBOARD SHORTCUTS

- **Ctrl+/** (or Cmd+/) — Open/close Pulse AI assistant
- **G then D** — Go to Dashboard
- **G then M** — Go to Messages
- **G then E** — Go to Email
- **G then V** — Go to Voxer
- **G then C** — Go to Calendar
- **G then N** — Go to Meetings
- **G then P** — Go to Contacts
- **G then T** — Go to Decisions & Tasks
- **G then A** — Go to Analytics
- **?** — Open User Guide
- **Ctrl+Shift+P** — Open Command Palette
- **/** — Open inline tools menu (while composing a message)
- **Shift+Enter** — New line in message input
- **Escape** — Close current panel or modal

## TIPS

- Use the Daily Briefing on the Dashboard every morning — it summarizes overnight activity and recommends focus areas.
- Pin important message threads to keep them at the top of your inbox.
- Use smart folders in Messages to automatically organize by priority, team, or follow-up status.
- Set up email templates for common responses to save time.
- Use the / command in message compose to quickly insert GIFs, files, tasks, polls, or reminders.
- Archive completed decisions and tasks to keep your workspace clean.
- Check Analytics weekly to spot communication patterns and team health trends.
- Use Voxer Quick Vox for fast voice messages when typing is inconvenient.
`.trim();

// ─── 5-minute in-memory cache (same pattern as conversationalAIService) ──────
const AI_CACHE_TTL_MS = 5 * 60 * 1000;
interface CacheEntry { response: string; timestamp: number; }
const responseCache = new Map<string, CacheEntry>();

function buildCacheKey(rawQuery: string, context: AssistantContext): string {
  const query = rawQuery.trim().toLowerCase();
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

// ─── Token usage tracking ────────────────────────────────────────────────────
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  queryCount: number;
  sessionStart: number;
}

const SESSION_TOKEN_KEY = 'pulse-ai-token-usage';

function getTokenUsage(): TokenUsage {
  try {
    const raw = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Reset if session is older than 24h
      if (Date.now() - parsed.sessionStart > 24 * 60 * 60 * 1000) {
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
        return { promptTokens: 0, completionTokens: 0, totalTokens: 0, queryCount: 0, sessionStart: Date.now() };
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, queryCount: 0, sessionStart: Date.now() };
}

function trackTokenUsage(promptTokens: number, completionTokens: number): void {
  const usage = getTokenUsage();
  usage.promptTokens += promptTokens;
  usage.completionTokens += completionTokens;
  usage.totalTokens += (promptTokens + completionTokens);
  usage.queryCount += 1;
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify(usage));
  } catch { /* ignore */ }
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
  voxerRecordings?: Record<string, unknown>[];
  // Analytics metrics (ANALYTICS)
  analyticsMetrics?: AnalyticsMetrics;
  // Archives (ARCHIVES)
  archives?: ArchiveItem[];
  // Settings context (SETTINGS)
  settingsContext?: {
    workspaceName?: string;
    workspacePlan?: string;
    memberCount?: number;
    teamCount?: number;
    theme?: string;
    aiModel?: string;
    integrationsActive?: string[];
  };
  // Search context (MULTI_MODAL / SEARCH)
  searchContext?: {
    recentSearches?: string[];
    savedSearchCount?: number;
  };
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
  [AppView.SETTINGS]: 'Settings',
  [AppView.MULTI_MODAL]: 'Search',
  [AppView.USERS_GUIDE]: 'User Guide',
  [AppView.LIVE]: 'Pulse Chat',
  [AppView.CONTACT_MAP]: 'Contacts',
  [AppView.TEST_MATRIX]: 'Test Matrix',
  [AppView.MESSAGE_ADMIN]: 'Admin Dashboard',
  [AppView.MESSAGE_ANALYTICS]: 'Message Analytics',
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
  [AppView.SETTINGS]: [
    { id: 'change-theme', label: 'How do I change my theme?', query: 'How do I switch between dark mode and light mode in Pulse?' },
    { id: 'ai-settings', label: 'Configure AI settings', query: 'How do I configure AI and voice agent settings in Pulse?' },
    { id: 'manage-workspace', label: 'Manage workspace', query: 'How do I manage my workspace — invite members, change roles, or transfer ownership?' },
    { id: 'update-profile', label: 'Update my profile', query: 'How do I update my display name, handle, bio, or avatar?' },
  ],
  [AppView.TOOLS]: [
    { id: 'ai-tools', label: 'What tools are available?', query: 'What AI tools and features are available in the AI Lab?' },
    { id: 'ai-studio', label: 'How to use AI Studio', query: 'How do I use AI Studio to generate content or work with AI?' },
    { id: 'ai-generate', label: 'Generate content with AI', query: 'Help me generate content using AI — what options do I have?' },
  ],
  [AppView.LIVE_AI]: [
    { id: 'start-session', label: 'How to start a live session', query: 'How do I start a War Room live session with my team?' },
    { id: 'invite-team', label: 'Invite team members', query: 'How do I invite team members to a War Room session?' },
    { id: 'warroom-features', label: 'War Room features', query: 'What features are available in the War Room?' },
  ],
  [AppView.MULTI_MODAL]: [
    { id: 'search-tips', label: 'Search tips', query: 'What are some tips for searching effectively in Pulse?' },
    { id: 'find-something', label: 'Help me find something', query: 'Help me find something specific in Pulse. What are you looking for?' },
    { id: 'search-scope', label: 'What can I search for?', query: 'What types of content can I search for in Pulse?' },
  ],
  [AppView.USERS_GUIDE]: [
    { id: 'getting-started', label: 'Getting started with Pulse', query: 'I am new to Pulse. Give me a quick getting-started overview of the key features.' },
    { id: 'show-around', label: 'Show me around', query: 'Give me a guided tour of the main sections in Pulse and what each one does.' },
    { id: 'shortcuts', label: 'Keyboard shortcuts', query: 'What are the most useful keyboard shortcuts in Pulse?' },
  ],
  [AppView.SMS]: [
    { id: 'send-sms', label: 'How to send an SMS', query: 'How do I send an SMS message in Pulse?' },
    { id: 'sms-features', label: 'SMS features', query: 'What SMS features are available in Pulse?' },
  ],
  [AppView.LIVE]: [
    { id: 'start-voice', label: 'How to start a voice chat', query: 'How do I start a voice chat session with Pulse AI?' },
    { id: 'voice-features', label: 'Voice chat features', query: 'What features are available in the Pulse Voice Chat?' },
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
  [AppView.SETTINGS]: [
    { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
    { id: 'go-guide', label: 'Open User Guide', targetView: AppView.USERS_GUIDE },
  ],
  [AppView.TOOLS]: [
    { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
    { id: 'go-analytics', label: 'View Analytics', targetView: AppView.ANALYTICS },
    { id: 'go-warroom', label: 'Open War Room', targetView: AppView.LIVE_AI },
  ],
  [AppView.LIVE_AI]: [
    { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
    { id: 'go-tasks', label: 'Open Tasks', targetView: AppView.DECISIONS_TASKS },
    { id: 'go-contacts', label: 'View Contacts', targetView: AppView.CONTACTS },
  ],
  [AppView.MULTI_MODAL]: [
    { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
    { id: 'go-messages', label: 'Open Messages', targetView: AppView.MESSAGES },
    { id: 'go-email', label: 'Check Email', targetView: AppView.EMAIL },
  ],
  [AppView.USERS_GUIDE]: [
    { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
    { id: 'go-settings', label: 'Open Settings', targetView: AppView.SETTINGS },
  ],
  [AppView.SMS]: [
    { id: 'go-messages', label: 'Open Messages', targetView: AppView.MESSAGES },
    { id: 'go-contacts', label: 'View Contacts', targetView: AppView.CONTACTS },
  ],
  [AppView.LIVE]: [
    { id: 'go-dashboard', label: 'Go to Dashboard', targetView: AppView.DASHBOARD },
    { id: 'go-voxer', label: 'Open Voxer', targetView: AppView.VOXER },
    { id: 'go-messages', label: 'Open Messages', targetView: AppView.MESSAGES },
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
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    const cacheKey = buildCacheKey(userQuery, context);
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const sectionLabel = SECTION_LABELS[context.section] ?? context.section;

      // Read model from user settings, fallback to default
      let modelName = 'gemini-2.5-flash';
      try {
        const savedModel = await settingsService.get('primaryAIModel');
        if (savedModel) modelName = savedModel;
      } catch { /* use default */ }

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
      const voxData = (context.voxerRecordings ?? []).slice(0, 10).map((v) => ({
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

      // Settings context
      if (context.settingsContext) {
        const s = context.settingsContext;
        const parts: string[] = [];
        if (s.workspaceName) parts.push(`Workspace: ${s.workspaceName}`);
        if (s.workspacePlan) parts.push(`Plan: ${s.workspacePlan}`);
        if (s.memberCount !== undefined) parts.push(`Members: ${s.memberCount}`);
        if (s.teamCount !== undefined) parts.push(`Teams: ${s.teamCount}`);
        if (s.theme) parts.push(`Theme: ${s.theme}`);
        if (s.aiModel) parts.push(`AI model: ${s.aiModel}`);
        if (s.integrationsActive && s.integrationsActive.length > 0) parts.push(`Active integrations: ${s.integrationsActive.join(', ')}`);
        if (parts.length > 0) contextBlocks.push(`Settings & Workspace Info:\n${parts.join('\n')}`);
      }

      // Search context
      if (context.searchContext) {
        const sc = context.searchContext;
        const parts: string[] = [];
        if (sc.recentSearches && sc.recentSearches.length > 0) parts.push(`Recent searches: ${sc.recentSearches.join(', ')}`);
        if (sc.savedSearchCount !== undefined) parts.push(`Saved searches: ${sc.savedSearchCount}`);
        if (parts.length > 0) contextBlocks.push(`Search Context:\n${parts.join('\n')}`);
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

      // Build system instruction with app knowledge + section context
      const systemInstruction = `You are Pulse AI, an intelligent assistant embedded in the Pulse productivity app.

${PULSE_APP_KNOWLEDGE}

---

CURRENT CONTEXT:
- Current section: ${sectionLabel}
- User: ${context.user.name}
- Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

${hasRealData
  ? `CRITICAL INSTRUCTION: You have been given the user's REAL, LIVE data from their ${sectionLabel} section. You MUST:
- Reference specific items by their ACTUAL names and titles from the data below
- Cite exact counts, deadlines, and statuses from the data
- Name real tasks, decisions, contacts, or events — do NOT speak in generalities when specifics are available
- If asked "what's overdue?" list the ACTUAL overdue items by name
- If asked "who should I follow up with?" name ACTUAL contacts from the data`
  : `No data was loaded for this section. Give helpful general guidance about what this section contains and how to use it. Use your knowledge of Pulse (provided above) to answer accurately.`}

WORKFLOW WIZARD MODE:
When the user asks "how do I..." or "help me set up..." or any multi-step process, switch to step-by-step wizard mode:
1. Break the process into numbered steps
2. Explain each step clearly with the exact navigation path (e.g., "Go to **Settings** → **Workspace** → **Invite Members**")
3. After listing all steps, ask "Would you like me to walk you through step 1?" or "Which step would you like help with?"
4. If the user says "yes" or picks a step, elaborate on that specific step with detailed instructions
5. After each step, prompt "Ready for the next step?" to guide them through the entire workflow

FORMATTING RULES:
- Use **bold** for names and key terms
- Use bullet lists for multiple items
- Use numbered lists for steps or priorities
- Use ## headings if answer spans multiple topics
- Keep paragraphs short (2-3 sentences)
- Lead with a direct answer, then expand with specifics from the data

--- LIVE DATA ---
${contextBlocks.join('\n\n')}
--- END DATA ---`;

      // Build multi-turn chat with conversation history
      const chatHistory = (history ?? []).slice(-20).map(h => ({
        role: (h.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
        parts: [{ text: h.content }],
      }));

      const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ];

      const chat = ai.chats.create({
        model: modelName,
        systemInstruction,
        history: chatHistory,
        safetySettings,
      });

      let result: string;

      if (onChunk) {
        // Streaming mode — send chunks to callback as they arrive
        const stream = await chat.sendMessageStream({ message: userQuery });
        let accumulated = '';
        for await (const chunk of stream) {
          const text = chunk.text ?? '';
          if (text) {
            accumulated += text;
            onChunk(accumulated);
          }
          // Track token usage from last chunk
          if (chunk.usageMetadata) {
            trackTokenUsage(chunk.usageMetadata.promptTokenCount ?? 0, chunk.usageMetadata.candidatesTokenCount ?? 0);
          }
        }
        result = accumulated || 'I was unable to generate a response. Please try again.';
      } else {
        // Non-streaming mode — wait for full response
        const response = await chat.sendMessage({ message: userQuery });
        result = response.text ?? 'I was unable to generate a response. Please try again.';
        if (response.usageMetadata) {
          trackTokenUsage(response.usageMetadata.promptTokenCount ?? 0, response.usageMetadata.candidatesTokenCount ?? 0);
        }
      }

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
      const unlistened = (context.voxerRecordings ?? []).filter((v) => !v.listened).length;
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

    if (context.section === AppView.SETTINGS) {
      const s = context.settingsContext;
      if (!s) return '';
      const parts: string[] = [];
      if (s.workspaceName) parts.push(s.workspaceName);
      if (s.workspacePlan) parts.push(s.workspacePlan);
      if (s.memberCount !== undefined) parts.push(`${s.memberCount} member${s.memberCount !== 1 ? 's' : ''}`);
      return parts.join(' · ');
    }

    if (context.section === AppView.MULTI_MODAL) {
      const sc = context.searchContext;
      if (!sc) return '';
      const parts: string[] = [];
      if (sc.recentSearches && sc.recentSearches.length > 0) parts.push(`${sc.recentSearches.length} recent`);
      if (sc.savedSearchCount) parts.push(`${sc.savedSearchCount} saved`);
      return parts.join(' · ');
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

  /**
   * Returns current session token usage stats.
   */
  getTokenUsage,

  /**
   * Returns a time-based greeting with contextual suggestion.
   */
  getTimeBasedGreeting(userName: string): { greeting: string; suggestion: PulseQuickAction } {
    const hour = new Date().getHours();
    const lastVisit = sessionStorage.getItem('pulse-ai-last-visit');
    const now = Date.now();
    sessionStorage.setItem('pulse-ai-last-visit', String(now));

    // After long absence (>4 hours)
    if (lastVisit && (now - Number(lastVisit)) > 4 * 60 * 60 * 1000) {
      return {
        greeting: `Welcome back, ${userName}! Let me catch you up on what you missed.`,
        suggestion: { id: 'catch-up', label: "What did I miss?", query: 'What happened since I was last active? Summarize any overdue tasks, new messages, and pending decisions.' },
      };
    }

    if (hour >= 5 && hour < 12) {
      return {
        greeting: `Good morning, ${userName}! Ready to start the day?`,
        suggestion: { id: 'morning-brief', label: 'Morning briefing', query: 'Give me a morning briefing — summarize my priorities, upcoming events, and anything that needs attention today.' },
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        greeting: `Good afternoon, ${userName}!`,
        suggestion: { id: 'afternoon-check', label: 'Afternoon check-in', query: "How's my day going? What have I completed, and what still needs attention this afternoon?" },
      };
    }
    if (hour >= 17 && hour < 21) {
      return {
        greeting: `Good evening, ${userName}! Wrapping up for the day?`,
        suggestion: { id: 'wrap-up', label: 'Wrap up my day', query: "Help me wrap up — what's still open, what can I defer to tomorrow, and what needs to be handled before end of day?" },
      };
    }
    return {
      greeting: `Hey ${userName}, burning the midnight oil?`,
      suggestion: { id: 'quick-status', label: 'Quick status', query: 'Give me a quick status check — any urgent items, overdue tasks, or messages that need immediate attention?' },
    };
  },

  /**
   * Export conversation as markdown text.
   */
  exportConversation(messages: Array<{ role: string; content: string; timestamp: Date }>, format: 'markdown' | 'text' = 'markdown'): string {
    const header = `# Pulse AI Conversation\n**Exported:** ${new Date().toLocaleString()}\n**Messages:** ${messages.length}\n\n---\n\n`;
    const body = messages.map(m => {
      const time = m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const speaker = m.role === 'user' ? 'You' : 'Pulse AI';
      if (format === 'markdown') {
        return `### ${speaker} — ${time}\n\n${m.content}\n`;
      }
      return `[${time}] ${speaker}: ${m.content}`;
    }).join(format === 'markdown' ? '\n---\n\n' : '\n\n');
    return format === 'markdown' ? header + body : body;
  },
};
