import { AppView } from "../types";
import type { User, Contact, CalendarEvent, Thread, ArchiveItem } from "../types";
import type { DecisionWithVotes } from "./decisionService";
import type { Task } from "./taskService";
import type { CachedEmail } from "./emailSyncService";
import { invokeAI } from "./ai/aiService";
import { getCurrentWorkspaceId } from "./ai/getWorkspaceId";

// ─── Pulse App Knowledge Base ────────────────────────────────────────────────
// Injected into every AI query so Pulse AI can guide users through the entire app.

const PULSE_APP_KNOWLEDGE = `
## ABOUT PULSE

Pulse is the unified communication and intelligence layer for solo operators and small teams. It pulls email, messaging, async voice (Relay), video glimpses, video meetings, calendar, contacts, decisions, tasks, analytics, and AI into one app. It runs on web and on Android via Capacitor.

## SIDEBAR & SECTIONS

The left sidebar groups sections into five categories. Use these exact labels when guiding the user.

### Overview

- **Dashboard.** Home screen. Daily AI briefing (greeting, focus recommendation, what changed overnight), upcoming events with live countdowns, unread counts, AI nudges for overdue tasks and stalled decisions, weekly briefing surface, and an AI web search bar. The first place to land each morning.

### Communication

- **Messages.** Unified messaging inbox with threaded conversations, pinned messages, smart folders (Priority, Team, Follow-ups, Archived), reactions, conversation highlights (extracted decisions and action items), and bulk actions. The compose box accepts inline tools via "/" (/gif, /file, /task, /poll, /reminder). Bot messages from connected ecosystem apps appear inline.
- **Email.** Full email client over Gmail/Outlook. AI daily briefing with top priority emails, templates with variables ({{first_name}}, {{company}}, {{date}}), send-later scheduling, follow-up reminders, and a 3-step campaign builder (Setup, Compose, Review & Send) with audience segments and auto-action filters.
- **Relay.** Async voice and live audio. Six peer views in a single horizontal nav: **Triage** (AI-sorted inbox of all incoming voice across the other peers, the default landing tab), **Direct** (one-to-one DMs), **Channel** (team/workspace channels with @mentions), **Broadcast** (one-to-many publish, formerly Pulse Radio), **Notes** (personal voice memos), **Live** (real-time voice rooms). One unified Composer is reused across all peers; settings are reached from the gear icon in the nav.
- **Glimpse.** Standalone video messaging (split out from Relay). Record, reply, and thread short video glimpses with AI transcripts, reactions, search, playback speed, and bulk selection. AI reply-draft panel suggests responses.

### Work & People

- **Calendar.** Google + Outlook sync. Year, Month, Week, Day, Agenda, and Timeline views. Create events, set reminders, find free time, manage RSVPs and color overrides. The Calendar AI panel surfaces conflicts, prep briefings, and relationship insights.
- **Meetings.** Pulse Video Room. Start or join meetings, manage upcoming sessions, generate agendas, capture action items, and review post-meeting summaries. Includes templates, bulk invite, device test, recording, breakout rooms, and a meeting analytics dashboard.
- **Contacts.** Contact and CRM hub. Modes: Today (recent activity), People (full list), Circles (groups), Map (location). Sync with HubSpot, Salesforce, Pipedrive, and Zoho. Surfaces relationship health, last interaction, communication history, and AI contact search.
- **Decisions & Tasks.** Unified hub. Decisions support voting (approve/reject/abstain), deadlines, sub-decision decomposition, and a structured Decision Wizard. Tasks have priorities (urgent/high/medium/low), deadlines, statuses (todo, in-progress, done, cancelled), assignees, and dependencies. Includes an AI task prioritizer, retrospective banner for due decisions, and Board / Archive views.

### Intelligence

- **Search.** Unified search across Messages, Emails, Vox, Notes, Tasks, Events, Contacts, and Archives. Natural-language queries, operator syntax (from:, in:, before:), saved searches, geo filters, and detail panels.
- **Analytics.** Observatory-edition dashboard. Time range selector (7d, 30d, 90d, 365d) with views: Overview, Velocity, Sentiment, Network, Relationships, Conflicts, Kudos, and Predictions. Top contacts, AI-generated insights, exportable reports.
- **War Room.** The unified AI workspace (also called Pulse Studio internally). One conversation canvas with inline citations from RAG sources, an agent selector (General, Skeptic, Scribe, Deep Diver), voice and extended-thinking toggles, file context upload, smart suggestions, command autocomplete, and an artifact board ("The Board") to pin outputs. This is where deep AI work happens. The legacy "AI Lab" is gone; its functionality lives here now.
- **Archives.** Archive collections with smart folders, timeline, and Google Drive export. Includes the Memory Overview panel (workspace memory summary), Briefing Sheet, related items, search, and a shortcut overlay (?).
- **User Guide.** In-app docs. Searchable, organized by category, covers features, workflows, tips, shortcuts, and troubleshooting.

### Experimental (collapsed by default in the sidebar)

- **Summit.** Voice-first 1-on-1 AI session for debriefs and prep. Multi-turn voice with the OpenAI Realtime model, structured artifact capture (decisions, tasks, references, open questions), and exports to Markdown, War Room, or Decisions & Tasks.

### Footer (always visible)

- **Theme toggle** (light/dark, both first-class).
- **Settings.** Reached from the footer gear, not from the main nav.
- **User profile.**

## SETTINGS

Settings is a single screen with these categories: My Account (profile, handle, bio, avatar), Appearance, Sessions, AI & Intelligence (model selection, voice agent, knowledge base, audio hardware, quota), Integrations (Google, Outlook, CRM), Ecosystem Bridge (QntmEcos bots: Entomate for tasks, Logos Vision for CRM), Notifications, Features & Labs, War Room settings, Activity Monitor, Organization (legal name, logo, industry, domain, auto-join, archive, delete, transfer), Team Management (invites, roles), Security (2FA, session timeouts, IP allowlist), Compliance (GDPR, audit logs, legal hold), Accessibility (font, contrast, motion), Privacy & Data (analytics opt-out, export, cache), About, Plan & Billing, Developer Tools (API keys, webhooks).

## WORKSPACES & ROLES

A workspace owns all data, contacts, settings, and billing. Users can have multiple and switch via the workspace switcher in the sidebar header. Roles: Owner (full control, can transfer or delete), Admin, Moderator, Member, Guest, Bot. Invites are sent from Settings → Team Management. Transfers and deletion live under Settings → Organization. Deleted workspaces are recoverable for 30 days.

## KEY WORKFLOWS

1. **Morning triage.** Open **Dashboard**, read the daily briefing, then open **Email** for the priority briefing and **Relay → Triage** for incoming voice. Anything that needs a reply gets handled inline; anything that needs deeper thought goes to **War Room**.
2. **Task management.** Decisions & Tasks → New Task. Assign, set priority and deadline. Track on Dashboard. Mark done when complete.
3. **Decision voting.** Decisions & Tasks → New Decision. Team votes approve/reject/abstain. Stale decisions (no activity in 24h) trigger AI nudges. Record the outcome when resolved.
4. **Contact follow-up.** Contacts → sort by last interaction, find lapsed contacts, message via Messages or Email, log the interaction.
5. **Meeting prep.** Open **Meetings** or **Calendar**, ask Pulse AI to prep the next meeting. The AI pulls attendee info from Contacts, recent threads, and action items.
6. **Deep work / research.** Open **War Room**, upload context files, pick an agent, and use extended thinking. Pin outputs to The Board.

## INTEGRATIONS

- **Google:** Gmail, Calendar, Contacts, Drive (archive export).
- **Microsoft:** Outlook mail and calendar.
- **CRM:** HubSpot, Salesforce, Pipedrive, Zoho.
- **Ecosystem Bridge:** QntmEcos apps post bot messages into Pulse. Entomate (tasks/meetings), Logos Vision (CRM). Configure in Settings → Ecosystem Bridge.

## KEYBOARD SHORTCUTS

- **Ctrl+/ or Cmd+/** — Open or close Pulse AI assistant.
- **G then D / M / E / V / C / N / P / T / A** — Navigate (Dashboard, Messages, Email, Relay, Calendar, Meetings, Contacts, Decisions & Tasks, Analytics).
- **T / D / C / B / N / L** — Switch Relay views (Triage, Direct, Channel, Broadcast, Notes, Live) when Relay is open.
- **?** — User Guide / shortcut overlay.
- **Ctrl+Shift+P** — Command palette.
- **/** — Inline tools menu in message compose.
- **Shift+Enter** — New line in inputs.
- **Escape** — Close panel or modal.

## TIPS

- The Daily Briefing on Dashboard is the recommended first stop each morning.
- Pin important message threads to keep them at the top of the inbox.
- Use smart folders in Messages to auto-organize by priority, team, or follow-up.
- Save email templates for repeated replies. Variables ({{first_name}} etc.) personalize sends.
- "/" in any compose box inserts gifs, files, tasks, polls, or reminders.
- Archive completed decisions and tasks to keep the workspace clean.
- Analytics weekly check spots communication and team-health trends.
- Relay Triage is the fastest way to clear voice; Live is for active rooms; Notes is for personal memos.
- Glimpse is for short video updates that are too rich for voice but too small for a meeting.
- War Room is the right surface when a question needs more than a one-shot reply.

## NOT IN PULSE (do not suggest)

- A standalone "AI Lab" or "Tools" section. Removed; functionality is in War Room.
- A standalone "SMS" section in the sidebar. SMS routing exists internally but is not a top-level destination.
- A separate "Admin Dashboard" page. Admin controls live inside Settings (Organization, Team, Security, Compliance).
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
  // Relay recordings (RELAY)
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
  [AppView.RELAY]: 'Relay',
  [AppView.GLIMPSE]: 'Glimpse',
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
  [AppView.LIVE]: 'Summit',
  [AppView.MAP]: 'Map',
  // Legacy alias — kept so existing analytics + deep-links resolve. The
  // canonical section is AppView.MAP; CONTACT_MAP redirects to it in App.tsx.
  [AppView.CONTACT_MAP]: 'Map',
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
  [AppView.RELAY]: [
    { id: 'triage-voice', label: 'Catch me up on Triage', query: 'Summarise what is in my Relay Triage stream and what needs a reply.' },
    { id: 'urgent-voxes', label: 'Any urgent voxes?', query: 'Are there any urgent vox messages I should listen to right away?' },
    { id: 'pick-mode', label: 'Which Relay mode should I use?', query: 'Help me pick the right Relay view (Triage, Direct, Channel, Broadcast, Notes, or Live) for what I want to do.' },
  ],
  [AppView.GLIMPSE]: [
    { id: 'unwatched-glimpses', label: 'Any unwatched glimpses?', query: 'Are there any unwatched video glimpses I should review?' },
    { id: 'glimpse-vs-meeting', label: 'Glimpse or schedule a meeting?', query: 'Help me decide whether to send a quick Glimpse video or schedule a meeting.' },
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
  [AppView.RELAY]: [
    { id: 'go-messages', label: 'Open Messages', targetView: AppView.MESSAGES },
    { id: 'go-glimpse', label: 'Open Glimpse', targetView: AppView.GLIMPSE },
    { id: 'go-contacts', label: 'View Contacts', targetView: AppView.CONTACTS },
  ],
  [AppView.GLIMPSE]: [
    { id: 'go-relay', label: 'Open Relay', targetView: AppView.RELAY },
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
    { id: 'go-relay', label: 'Open Relay', targetView: AppView.RELAY },
    { id: 'go-messages', label: 'Open Messages', targetView: AppView.MESSAGES },
  ],
};

// ─── Section data map (drives section-aware navigation hints) ────────────────
// Maps each AppView to the topics it holds live data for. Used by the system
// prompt so the AI can tell the user "this is in the Messages section — open it
// here" with an inline navigation link instead of bluffing or refusing.
const SECTION_DATA_TOPICS: Partial<Record<AppView, string[]>> = {
  [AppView.DASHBOARD]: ['decisions', 'tasks', 'recent threads (top 8)', 'recent emails (top 5) + unread count', "today's calendar"],
  [AppView.DECISIONS_TASKS]: ['decisions', 'tasks'],
  [AppView.MESSAGES]: ['message threads', 'conversations', 'unread messages', 'pinned threads'],
  [AppView.EMAIL]: ['email inbox', 'unread email count', 'email subjects/senders/snippets'],
  [AppView.CALENDAR]: ["today's events", 'upcoming events (7 days)'],
  [AppView.MEETINGS]: ["today's meetings", 'upcoming meetings'],
  [AppView.CONTACTS]: ['contacts', 'contact details (name, email, company, last seen)'],
  [AppView.RELAY]: ['Relay voice recordings'],
  [AppView.ANALYTICS]: ['productivity metrics (tasks completed, response time, meetings)'],
  [AppView.SETTINGS]: ['workspace info', 'plan', 'members', 'teams', 'theme', 'AI model', 'integrations'],
  [AppView.MULTI_MODAL]: ['recent searches', 'saved searches'],
  [AppView.ARCHIVES]: ['archived items'],
};

// ─── System instruction builder (pure, testable) ─────────────────────────────

function buildSystemInstruction(context: AssistantContext): string {
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

  // Relay recordings
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

  // ─── Section-awareness block ──────────────────────────────────────────────
  // Tell the AI exactly which topics this section's loaded data covers, and
  // where to send the user for topics it doesn't have. The AI emits inline
  // navigation links of the form `[Open Messages](pulse://section/MESSAGES)`
  // which the chat renderer turns into one-click section switches.
  const currentTopics = SECTION_DATA_TOPICS[context.section] ?? [];
  const otherSectionLines = Object.entries(SECTION_DATA_TOPICS)
    .filter(([view]) => view !== context.section)
    .map(([view, topics]) => {
      const label = SECTION_LABELS[view as AppView] ?? view;
      return `- **${label}** (link: pulse://section/${view}) → ${(topics as string[]).join(', ')}`;
    })
    .join('\n');

  return `You are Pulse AI, an intelligent assistant embedded in the Pulse productivity app.

${PULSE_APP_KNOWLEDGE}

---

CURRENT CONTEXT:
- Current section: ${sectionLabel}
- User: ${context.user.name}
- Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

SECTION-AWARE DATA SCOPE:
You are section-aware. You only have live data for the user's CURRENT section.

This section (${sectionLabel}) gives you live data for: ${currentTopics.length > 0 ? currentTopics.join(', ') : 'general guidance only — no live data loaded'}.

Other sections hold data you do NOT currently have access to:
${otherSectionLines}

WHEN THE USER ASKS ABOUT DATA YOU DON'T HAVE:
If the user asks something that requires data from a different section (e.g. asking "who messaged me last?" while in Email, or "what's on my calendar?" while in Messages), DO NOT bluff and DO NOT refuse generically. Instead:
1. Briefly say which section holds that data — one short sentence.
2. Provide an inline markdown link to switch sections, using EXACTLY this format: \`[Open <Section Name>](pulse://section/<APPVIEW>)\`. Example: \`[Open Messages](pulse://section/MESSAGES)\`. The link will switch the user to that section in one click.
3. Optionally add: "Ask me again from there and I'll have the live data."
Do NOT use the pulse://section/ link format for anything else — only for these cross-section navigation hints.

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
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const pulseAssistantService = {
  /**
   * Query the AI with the current section context.
   *
   * Routes through the central `ai-router` edge function which handles
   * provider selection, metering, hard caps, and prompt caching automatically.
   *
   * @param userQuery The user's question.
   * @param context The current app section context (data + user + workspace).
   * @param apiKey DEPRECATED — unused. Retained for backward compatibility during
   *   migration. Will be removed in Phase 3 when all callers are updated.
   * @param history Optional prior conversation turns (last 20 are forwarded).
   * @param onChunk Optional streaming callback. NOTE: the router does not yet
   *   stream, so when provided, the full response is emitted as a single chunk
   *   once available. Kept for API compatibility.
   * @param workspaceId Optional workspace override. Falls back to
   *   `context.workspaceId`, then `getCurrentWorkspaceId()`.
   *
   * @throws {AICapExceededError} When the workspace has hit its AI message cap.
   * @throws {AITrialExpiredError} When the trial has expired.
   * @throws {AIProviderUnavailableError} When all AI providers are down.
   * @throws {AIRouterError} For other router failures (auth, invalid params).
   */
  async query(
    userQuery: string,
    context: AssistantContext,
    apiKey: string | undefined,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    onChunk?: (chunk: string) => void,
    workspaceId?: string,
  ): Promise<string> {
    void apiKey; // deprecated — router handles keys server-side

    const cacheKey = buildCacheKey(userQuery, context);
    const cached = getCached(cacheKey);
    if (cached) {
      // Still invoke the streaming callback so UIs expecting chunks see the cached text.
      if (onChunk) onChunk(cached);
      return cached;
    }

    const wsId = workspaceId ?? context.workspaceId ?? getCurrentWorkspaceId();
    if (!wsId) {
      throw new Error('No active workspace — AI unavailable');
    }

    const systemInstruction = buildSystemInstruction(context);

    // Build multi-turn chat with conversation history (last 20 turns).
    const chatHistory = (history ?? []).slice(-20).map(h => ({
      role: h.role,
      content: h.content,
    }));

    // Router contract: messages[] must include the current user turn at the end.
    const messages = [
      ...chatHistory,
      { role: 'user' as const, content: userQuery },
    ];

    const result = await invokeAI(
      'pulse_assistant_chat',
      {
        messages,
        systemPrompt: systemInstruction,
        temperature: 0.7,
      },
      { workspaceId: wsId },
    );

    const text = result.text || 'I was unable to generate a response. Please try again.';

    // Track token usage for the session stats UI.
    if (result.tokens) {
      trackTokenUsage(result.tokens.input ?? 0, result.tokens.output ?? 0);
    }

    // The router does not yet stream; emit the full response as a single chunk
    // so existing streaming call sites continue to work without modification.
    if (onChunk) {
      onChunk(text);
    }

    setCache(cacheKey, text);
    return text;
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

    if (context.section === AppView.RELAY) {
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
