// Pulse User's Guide — Full Rich Section Data
// Version 25.1.2 · March 9, 2026
// Auto-maintained by the /users-guide slash command.

export interface Shortcut {
  key: string;
  action: string;
}

export interface GuideTable {
  title?: string;
  columns: string[];
  rows: string[][];
}

export interface UseCase {
  id: string;
  title: string;
  scenario: string;
  steps: string[];
}

export interface SubSection {
  id: string;
  title: string;
  description?: string;
  steps: string[];
  note?: string;
}

export interface AdvancedBlock {
  id: string;
  title: string;
  items: string[];
}

export interface GuideSection {
  id: string;
  title: string;
  icon: string;
  summary: string;
  steps: string[];
  subsections?: SubSection[];
  tables?: GuideTable[];
  shortcuts?: Shortcut[];
  tips: string[];
  useCases?: UseCase[];
  advanced?: AdvancedBlock[];
  badge?: 'New' | 'Updated';
}

// ─── CATEGORY DEFINITIONS ────────────────────────────────────────────────────

export const CATEGORIES: { label: string; ids: string[] }[] = [
  { label: 'Start Here',         ids: ['introduction', 'getting-started', 'dashboard'] },
  { label: 'Communication',      ids: ['messaging', 'email', 'sms', 'voxer'] },
  { label: 'Meetings & Time',    ids: ['meetings', 'calendar'] },
  { label: 'People & Decisions', ids: ['contacts', 'decisions-tasks'] },
  { label: 'AI & Intelligence',  ids: ['ai-features', 'analytics'] },
  { label: 'Integrations',       ids: ['crm', 'tools', 'search'] },
  { label: 'App & Settings',     ids: ['settings', 'mobile', 'shortcuts', 'troubleshooting'] },
];

// ─── SECTION DATA ─────────────────────────────────────────────────────────────

export const guideSections: GuideSection[] = [

  // ── 1. INTRODUCTION ──────────────────────────────────────────────────────
  {
    id: 'introduction',
    title: 'Introduction',
    icon: '✨',
    summary: 'What Pulse is, who it is for, and how everything fits together.',
    steps: [
      'Pulse is your all-in-one communication and productivity hub — email, SMS, voice, video, calendar, tasks, decisions, CRM, and AI in a single app.',
      'Instead of juggling Gmail, Slack, Zoom, a task manager, a CRM, and a calendar, Pulse brings every channel into one unified workspace.',
      'Every message, meeting, task, and contact is searchable from one search bar — no tab-switching.',
      'AI is woven throughout: it summarizes threads, drafts replies, transcribes voice messages, extracts tasks from emails, and answers questions about your data.',
      'Pulse works on web and Android. Your data syncs instantly across all devices.',
    ],
    subsections: [
      {
        id: 'who-its-for',
        title: 'Who Pulse is for',
        steps: [
          'Professionals managing high email, message, and meeting volume who need one unified view.',
          'Teams that need to vote on decisions, track tasks, and communicate across time zones.',
          'Customer-facing roles that rely on CRM data (HubSpot, Salesforce, Pipedrive, Zoho).',
          'Remote workers who need voice, video, and async messaging without switching apps.',
          'Managers who need visibility into team workload, communication health, and decisions.',
        ],
      },
      {
        id: 'key-concepts',
        title: 'Key Concepts',
        steps: [
          'Workspace — your isolated environment in Pulse. All data, contacts, and settings belong to it.',
          'Unified Inbox — a single inbox showing messages from every connected channel.',
          'Channel — a source of messages: Email, SMS, Slack, or internal Pulse messages.',
          'Contact — any person you communicate with, imported from all connected accounts.',
          'Voxer — Pulse\'s async voice messaging system with 8 modes and AI transcription.',
          'Pulse AI — the context-aware assistant accessible from anywhere with Ctrl+/.',
        ],
      },
    ],
    tables: [
      {
        title: 'Quick Start Paths',
        columns: ['I am…', 'Start with…'],
        rows: [
          ['Individual user', 'Connect email → explore Unified Inbox → try Pulse AI'],
          ['Team admin', 'Create workspace → invite members → set up Team Vox channels → Decisions'],
          ['Sales professional', 'Connect CRM → set up Contact Circles → enable Relationship Autopilot'],
          ['Remote worker', 'Set up Voxer modes → Team Vox for async standups → Calendar sync'],
          ['Manager', 'Connect accounts → view Workload Heatmap → set up Analytics reports'],
        ],
      },
    ],
    tips: [
      'Sign in with Google or Microsoft to auto-import contacts and calendar in seconds.',
      'Press Ctrl+/ from anywhere to open the Pulse AI Assistant — it loads your current section\'s data automatically.',
      'Press G then a letter to jump to any section instantly (G+D = Dashboard, G+M = Messages, etc.).',
    ],
  },

  // ── 2. GETTING STARTED ────────────────────────────────────────────────────
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    summary: 'Create your account, connect your apps, set up your profile, and learn how to navigate Pulse.',
    steps: [
      'Open Pulse in your browser or install the Android app from the Google Play Store.',
      'Click Sign Up on the welcome screen.',
      'Choose your sign-in method: Google (recommended), Microsoft (for M365 users), or Email & Password.',
      'Verify your email if signing up manually — then you land on your Dashboard.',
      'Connect your accounts immediately: go to Settings → Connected Accounts and connect Google, Microsoft, CRM, and SMS.',
      'Set up your profile: click your avatar → Settings → Profile → add name, photo, title, and time zone → Save.',
    ],
    subsections: [
      {
        id: 'sidebar-navigation',
        title: 'Navigating the Sidebar',
        description: 'The left sidebar is your main navigation, organized into sections.',
        steps: [
          'Primary section (top): Dashboard, Messages, Email, SMS, Voxer, Calendar, Meetings.',
          'Secondary section (middle): Contacts, Decisions & Tasks, Tools, Analytics.',
          'Bottom: AI Assistant (ECG icon), Settings, Your Profile.',
          'Click the arrow button at the top of the sidebar to collapse it for more screen space.',
          'Click the ? button in the sidebar header to open the User\'s Guide at any time. On mobile, the ? button appears between the notifications bell and the menu icon.',
          'Press G + a letter to jump instantly: G→D = Dashboard, G→M = Messages, G→E = Email, G→V = Voxer, G→C = Calendar, G→N = Meetings, G→P = Contacts, G→T = Tasks, G→A = Analytics.',
        ],
      },
      {
        id: 'connecting-accounts',
        title: 'Connecting Your Accounts',
        steps: [
          'Go to Settings → Connected Accounts.',
          'Click Connect next to Google to sync Gmail, Google Calendar, and Google Contacts.',
          'Click Connect next to Microsoft to sync Outlook email, MS Calendar, and MS contacts.',
          'Click Connect SMS to verify your phone number for text messaging.',
          'Click Connect under CRM to link HubSpot, Salesforce, Pipedrive, or Zoho.',
          'Each connected account shows a green "Connected" badge when active.',
        ],
      },
    ],
    tips: [
      'Using Sign in with Google or Microsoft auto-connects your contacts and calendar — saving significant setup time.',
      'A complete profile with a photo helps teammates recognize you in decisions, tasks, and meeting invites.',
      'Connect all your accounts on day one — Pulse gets smarter the more context it has.',
      'Click the ? button in the sidebar header to open the User\'s Guide instantly from anywhere in the app.',
    ],
    badge: 'Updated',
    useCases: [
      {
        id: 'uc-new-employee',
        title: 'New Employee First-Day Setup',
        scenario: 'You just joined a company and your manager asks you to get set up on Pulse.',
        steps: [
          'Create your account using your company email.',
          'Connect your work Google or Microsoft account — contacts and calendar sync instantly.',
          'Accept the workspace invite from your manager to join the team workspace.',
          'Explore the sidebar: click through Dashboard, Messages, and Contacts.',
          'Set notification preferences so you\'re not overwhelmed (Settings → Notifications).',
          'Check the Today Feed in Contacts for any pending relationship reminders.',
        ],
      },
    ],
  },

  // ── 3. DASHBOARD ─────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: '🏠',
    summary: 'Your home screen — a live snapshot of messages, tasks, meetings, and AI-powered nudges for what needs your attention right now.',
    steps: [
      'Click Dashboard in the sidebar (or press G→D) to open your home view.',
      'Quick Stats Cards at the top show: unread messages, pending tasks, today\'s meetings, and recent activity. Click any card to jump to that section.',
      'Upcoming Meetings shows your next 3 meetings with one-click join links.',
      'Priority Messages shows your most important unread messages, ranked by AI urgency.',
      'Quick Scheduler lets you create a meeting or appointment without leaving the Dashboard.',
      'AI Nudges appear as banners for overdue tasks, stalled decisions, unread priority emails, and meeting prep alerts.',
    ],
    subsections: [
      {
        id: 'quick-scheduler',
        title: 'Quick Scheduler',
        steps: [
          'Click + Schedule in the Quick Scheduler widget.',
          'Enter a title, date, time, and invite guests by name or email.',
          'Click Create — the event is added to your calendar and guests receive invites.',
        ],
      },
      {
        id: 'ai-nudges',
        title: 'AI Dashboard Nudges',
        steps: [
          'Overdue tasks appear with a red badge — click to go directly to the task.',
          'Stalled decisions appear when a vote is waiting for you — click to vote.',
          'Follow-up reminders appear for contacts you haven\'t reached recently.',
          'Meeting prep alerts appear for meetings starting within the next hour.',
          'Click Dismiss to clear a nudge, or Snooze to be reminded later.',
        ],
      },
    ],
    tips: [
      'The Dashboard refreshes automatically — no need to reload.',
      'Open Pulse AI (Ctrl+/) and type "summarize my day" for an instant daily brief.',
      'Click any Quick Stats card to jump directly to that section with context loaded.',
    ],
    useCases: [
      {
        id: 'uc-morning-routine',
        title: 'Starting Your Morning with Pulse',
        scenario: 'You open Pulse at 8 AM and want to know what your day looks like in under 3 minutes.',
        steps: [
          'Scan the Quick Stats: 12 unread emails, 3 pending tasks, 2 meetings today.',
          'Press Ctrl+/ and type "summarize my day" — Pulse AI reads your calendar and tasks.',
          'Click the Upcoming Meetings widget — your 10 AM standup has a one-click join.',
          'Click the Priority Messages card — respond to your manager\'s deadline change email.',
          'Check the AI nudges — a decision you need to vote on by today is highlighted. Click to vote.',
          'Done in under 3 minutes with complete situational awareness.',
        ],
      },
    ],
  },

  // ── 4. UNIFIED MESSAGING ─────────────────────────────────────────────────
  {
    id: 'messaging',
    title: 'Unified Messaging',
    icon: '💬',
    summary: 'One inbox for all conversations — internal messages, direct messages, threads, reactions, smart folders, and powerful message enhancements.',
    steps: [
      'Click Messages in the sidebar to open your unified inbox.',
      'All conversations across all channels appear sorted by most recent. Unread messages have a blue dot.',
      'Click any conversation to open it in the reading panel on the right.',
      'Type in the text box at the bottom and press Enter to reply, or Shift+Enter for a new line.',
      'Click the Compose button (pencil icon) to start a new message — type a recipient name or email.',
      'Press / while typing to open the Inline Tools menu: GIFs, files, tasks, polls, reminders.',
      'Hover over any message to: react with emoji, pin it, reply in a thread, or bookmark it.',
      'Click the clock icon next to send to schedule a message for a future date and time.',
    ],
    subsections: [
      {
        id: 'inline-tools',
        title: 'Inline Tools — The / Command Menu',
        description: 'Press / while typing in any message box to open quick-insert tools.',
        steps: [
          '/gif — Insert a GIF from the built-in library',
          '/file — Attach a file from your device',
          '/task — Create a task directly from the message without leaving the conversation',
          '/poll — Insert a quick poll for your team to respond to',
          '/reminder — Set a reminder for yourself about this message',
        ],
      },
      {
        id: 'threads-pins',
        title: 'Threads and Pinned Messages',
        steps: [
          'Click Reply in Thread on any message to start a side conversation without cluttering the main channel.',
          'Thread replies are visible in the sidebar and the thread panel.',
          'You are notified when someone replies to a thread you\'re following.',
          'Hover over a message and click the pin icon to pin it — pinned messages appear at the top of the conversation.',
          'Click View Pinned to see all pinned items at once.',
        ],
      },
      {
        id: 'smart-folders',
        title: 'Smart Folders & Labels',
        steps: [
          'Priority — messages flagged as urgent by AI.',
          'Team — messages from your workspace team members.',
          'Follow-ups — messages that need a response from you.',
          'Archived — conversations you\'ve filed away.',
          'Create custom labels: right-click any conversation → Add Label. Labels can be color-coded.',
        ],
      },
      {
        id: 'message-enhancements',
        title: 'Message Enhancements',
        steps: [
          'Conversation Highlights — click Highlights on any conversation to see AI-extracted decisions, action items, commitments, and important dates.',
          'Sentiment Timeline — click Insights → Sentiment Timeline to see a graph of how the conversation tone has changed over time.',
          'Message Bookmarks — bookmark any message with the bookmark icon. Access all bookmarks from the Bookmarks panel.',
          'Natural Language Search — search in plain English: "messages from David last week about the proposal".',
          'Smart Suggestions — Pulse suggests completions based on your communication patterns. Accept with Tab.',
          'Achievement System — Pulse tracks communication milestones and shows achievement badges (optional, togglable in Settings).',
        ],
      },
      {
        id: 'bulk-actions',
        title: 'Bulk Actions',
        steps: [
          'Check the box next to multiple conversations (or press Ctrl+A to select all visible).',
          'Choose from: Archive, Mark as Read, Delete, or Add Label.',
          'Bulk actions are ideal for cleaning up your inbox after a busy period.',
        ],
      },
    ],
    tips: [
      'Use quotes in search for exact phrases: "quarterly review" — finds only that exact text.',
      'Press Ctrl+A to select all conversations, then use Bulk Actions to archive or label them.',
      'Type @ to @mention a teammate — they receive an immediate notification.',
      'Press Ctrl+Shift+P to open the Quick Actions Command Palette for rapid operations.',
    ],
    useCases: [
      {
        id: 'uc-vacation-catchup',
        title: 'Catching Up After Vacation',
        scenario: 'You returned from a 3-day trip with 200+ unread messages.',
        steps: [
          'Open Messages → Priority smart folder — Pulse has identified the ~15 that need your attention.',
          'Click Summarize on the longest thread — AI gives a 3-sentence recap.',
          'Use Conversation Highlights to see decisions and action items without reading everything.',
          'Select all non-priority conversations → bulk Archive.',
          'Use Extract Action Items on messages with tasks — adds them directly to your task list.',
          'Back under control in 20 minutes instead of 2 hours.',
        ],
      },
      {
        id: 'uc-project-channel',
        title: 'Running a Clean Project Channel',
        scenario: 'You\'re managing a product launch and need an organized team channel.',
        steps: [
          'Create a new conversation with your whole team.',
          'Pin the project brief as the first pinned message — everyone finds it at the top.',
          'Use Reply in Thread for off-topic discussions so the main channel stays clean.',
          'Use /task whenever someone commits to an action item.',
          'Schedule Friday afternoon update messages using the message scheduler.',
          'Use Conversation Highlights weekly to pull out commitments.',
        ],
      },
    ],
    advanced: [
      {
        id: 'adv-contact-groups',
        title: 'Contact Groups for Power Messaging',
        items: [
          'Group your most-messaged contacts so you can compose group messages without re-selecting recipients each time.',
          'Contact Groups appear in the Compose recipient selector after you create them in Contacts.',
          'Combine Contact Groups with scheduled messages for recurring team broadcasts.',
        ],
      },
    ],
  },

  // ── 5. EMAIL ─────────────────────────────────────────────────────────────
  {
    id: 'email',
    title: 'Email',
    icon: '📧',
    badge: 'Updated',
    summary: 'A full-featured email client with AI daily briefing, smart compose, templates, scheduling, follow-up reminders, action item extraction, and email campaigns with audience segments.',
    steps: [
      'Go to Settings → Connected Accounts → Connect Email. Choose Google (Gmail) or Microsoft (Outlook).',
      'Click Email in the sidebar. Your inbox is on the left — click any email to read it on the right.',
      'The AI Daily Briefing appears at the top of your inbox each morning — your top priorities summarized.',
      'Click Compose (pencil icon) to write a new email with rich text formatting.',
      'Click Send, or click the clock icon to Schedule it for a future time.',
      'Click Extract Action Items on any email to pull tasks into your task list with source context.',
      'Click Campaigns in Email to send bulk emails to audience segments — with AI drafting and scheduling.',
    ],
    subsections: [
      {
        id: 'daily-briefing',
        title: 'AI Daily Briefing',
        description: 'Every morning, Pulse generates a smart briefing at the top of your inbox.',
        steps: [
          'Your top 5 priority emails needing a response — ranked by urgency.',
          'Action items extracted from recent emails across all threads.',
          'Important senders who haven\'t heard back from you.',
          'Meetings referenced in email threads.',
          'Click any item in the briefing to jump directly to that email.',
        ],
      },
      {
        id: 'email-templates',
        title: 'Email Templates',
        steps: [
          'While composing, click the Templates icon in the toolbar to choose a saved template.',
          'Templates support variables: {{first_name}}, {{company}}, {{date}} — auto-personalized on insert.',
          'Create new templates: Settings → Email Templates → New Template.',
          'Use templates for: proposals, status updates, follow-ups, meeting confirmations.',
        ],
      },
      {
        id: 'email-scheduling',
        title: 'Scheduling Emails',
        steps: [
          'Click the clock icon next to Send while composing.',
          'Choose a smart option: Tomorrow Morning, Monday 9 AM, Next Week — or pick a custom date/time.',
          'Scheduled emails appear in the Scheduled folder — edit or cancel at any time before they send.',
          'Configure an Undo Send window (5, 10, or 30 seconds) in Settings → Email.',
        ],
      },
      {
        id: 'email-filters',
        title: 'Email Filters & Folders',
        steps: [
          'Go to Settings → Email Filters → New Filter.',
          'Set conditions: From a specific address, Subject contains a keyword, To a specific recipient.',
          'Set actions: Move to folder, Apply label, Mark as Important, Forward to teammate.',
          'Save — the filter runs automatically on all new matching emails.',
          'Example: All emails from @client.com → Label "Client" + Move to Priority.',
        ],
      },
      {
        id: 'follow-up-reminders',
        title: 'Follow-up Reminders',
        steps: [
          'When reading any email, click Set Follow-up Reminder.',
          'Pick a time: In 1 hour, Tomorrow, In 2 days, or a custom date.',
          'If the thread is still quiet when the reminder fires, Pulse notifies you to reply.',
          'Dismiss the reminder if you\'ve already handled it.',
        ],
      },
      {
        id: 'email-campaigns',
        title: 'Email Campaigns',
        description: 'Send a single email to an audience of contacts — with AI drafting, templates, scheduling, and auto-save.',
        steps: [
          'Click Email in the sidebar, then Campaigns to open the Campaigns dashboard.',
          'Click New Campaign to open the 3-step Campaign Builder.',
          'Step 1 — Setup: name your campaign, set your From Name, and choose an Audience Segment.',
          'Step 2 — Compose: write your subject and body, or use AI Draft to generate it. Templates are also available.',
          'Step 3 — Review & Send: preview the final email, then send immediately or schedule for a future time.',
          'Your draft auto-saves every few seconds — you will never lose your work.',
          'From the dashboard, use the ⋮ menu on any campaign to Duplicate or Delete it.',
        ],
        note: 'New in this release',
      },
      {
        id: 'audience-segments',
        title: 'Audience Segments',
        description: 'Saved groups of contacts for targeting campaigns — dynamic and reusable.',
        steps: [
          'Built-in segments are ready to use: All Contacts, Recent (30 days), VIP Contacts, Important Contacts.',
          'Create a custom segment: in Campaign Setup, click + New Segment.',
          'Choose a rule: Active in last N days, Relationship strength ≥ N, or Marked Important.',
          'Click Preview to see the live contact count — updates instantly as you adjust the rule.',
          'Save your segment — it appears in the segment picker for all future campaigns.',
          'When you select a segment, Pulse automatically populates the recipient list.',
        ],
        note: 'New in this release',
      },
    ],
    tips: [
      'Snooze emails: right-click → Snooze to hide until a chosen time — they reappear at the top of your inbox.',
      'Enable read receipts in Settings → Privacy to know when recipients open your emails.',
      'Right-click any email → Send as Voice Message to forward it as a Vox note — richer than a reply.',
      'Use {{first_name}} in email templates for automatic personalization.',
      'Audience segments are dynamic — VIP Contacts updates automatically as relationship scores change.',
      'Use CRM Quick Actions (Create Task, View Contact) when reading any email to log follow-ups without leaving the inbox.',
    ],
    useCases: [
      {
        id: 'uc-client-email',
        title: 'Managing Client Email Communications',
        scenario: 'You\'re an account manager with 8 active clients who email frequently.',
        steps: [
          'Create an email filter for each client\'s domain applying their label automatically.',
          'Create a "Client VIP" folder rule to highlight emails from key decision-makers.',
          'Use email templates for standard responses: proposals, status updates, weekly check-ins.',
          'Set follow-up reminders on every proposal — 2-day follow-up if no reply.',
          'Read the Daily Briefing each morning to see which clients need attention.',
          'Use AI Action Items on client emails to auto-create follow-up tasks with context.',
        ],
      },
      {
        id: 'uc-inbox-zero',
        title: 'Reaching Inbox Zero with AI',
        scenario: 'Your inbox has 500 unread emails. You want to get to zero.',
        steps: [
          'Open the Daily Briefing — AI highlights the 10 that actually need your attention.',
          'Create filters for newsletters and auto-notifications to archive them automatically.',
          'Bulk select irrelevant emails → Archive in one click.',
          'Snooze important emails you can\'t deal with now — bring them back tomorrow.',
          'Reply to priority emails using AI Smart Compose to draft faster.',
          'For task-related emails, Extract Action Items then archive the email.',
        ],
      },
      {
        id: 'uc-email-campaign',
        title: 'Sending a Newsletter to VIP Contacts',
        scenario: 'You want to send a monthly product update to your top clients without manually listing addresses.',
        steps: [
          'Go to Email → Campaigns → New Campaign.',
          'In Setup, name it "April Newsletter", choose the VIP Contacts segment — Pulse auto-loads 23 recipients.',
          'In Compose, click AI Draft. Describe: "Monthly product roadmap update", tone: Professional. Review the draft.',
          'Add your subject line and optional preview text.',
          'In Review & Send, click Schedule and set it for Tuesday 9 AM.',
          'The campaign sends automatically — all 23 VIPs receive the email at the scheduled time.',
        ],
      },
    ],
    advanced: [
      {
        id: 'adv-email-power',
        title: 'Advanced Email Features',
        items: [
          'Connect multiple email accounts (work Gmail + personal Outlook) and switch between them in the Email view.',
          'Inline image preview — click any image in an email to open it full-screen without downloading.',
          'Confidential mode — click the lock icon while composing to mark an email confidential.',
          'AI Compose — click the AI icon in any composer to auto-complete your draft based on context.',
          'Forward as Vox — right-click any email and select "Send as Voice Message" to reply with nuance.',
        ],
      },
    ],
  },

  // ── 6. SMS ───────────────────────────────────────────────────────────────
  {
    id: 'sms',
    title: 'SMS',
    icon: '📱',
    summary: 'Send and receive text messages from inside Pulse — with templates, scheduling, and smart suggestions.',
    steps: [
      'Go to Settings → Connected Accounts → Connect SMS. Follow the steps to verify your phone number.',
      'Click SMS in the sidebar to see your text conversations sorted by most recent.',
      'Click New Message, enter a phone number or contact name, type your message, and send.',
      'Create SMS Templates in Settings → SMS Templates for commonly sent texts.',
      'Schedule a text by clicking the clock icon next to Send — it queues in the Scheduled folder.',
      'Use the search bar at the top of the SMS panel to search all your text history.',
    ],
    subsections: [
      {
        id: 'sms-templates',
        title: 'SMS Templates',
        steps: [
          'Go to Settings → SMS Templates → New Template.',
          'Write your template text — use {{first_name}} for personalization.',
          'While composing an SMS, click the Template icon to insert a saved template.',
          'Common templates: appointment reminders, meeting confirmations, follow-ups, "running late" messages.',
        ],
      },
      {
        id: 'sms-smart-suggestions',
        title: 'Smart SMS Suggestions',
        steps: [
          'Pulse learns your common phrases with each contact and suggests completions while composing.',
          'Relevant templates are suggested based on context — e.g., a meeting confirmation if you have a meeting with them today.',
          'Quick emoji reactions common in your conversations with each contact are surfaced.',
        ],
      },
    ],
    tips: [
      'All SMS history is stored in Pulse and fully searchable — find any text by keyword or contact name.',
      'Combine SMS Templates with Automation Rules to send timed reminder texts automatically.',
      'SMS scheduling is ideal for appointment reminders sent the night before.',
    ],
    useCases: [
      {
        id: 'uc-sms-reminders',
        title: 'Automated Appointment Reminder Texts',
        scenario: 'You run a business with client appointments and want automatic reminder texts.',
        steps: [
          'Create an SMS template: "Hi {{first_name}}, reminder about your appointment tomorrow at {{time}}. Reply YES to confirm."',
          'Set up an Automation Rule triggered by a calendar event the day before.',
          'The rule automatically sends your template to the contact linked to that event.',
          'Replies come directly into your SMS inbox — you see confirmations instantly.',
        ],
      },
    ],
  },

  // ── 7. VOXER ─────────────────────────────────────────────────────────────
  {
    id: 'voxer',
    title: 'Voxer — Voice Messaging',
    icon: '🎙️',
    summary: 'Eight voice modes for every situation — quick notes to scheduled broadcasts — all with AI transcription, summaries, and smart replies.',
    steps: [
      'Click Voxer in the sidebar to open the voice messaging hub.',
      'Pick a mode from the toolbar at the top, or press keys 1–8 to switch instantly.',
      'Every voice message is automatically transcribed to text — read it when you can\'t listen.',
      'Use the AI toolbar (Summarize, Smart Replies, Meeting Notes) at the top of every mode.',
      'Hover over any message → click ... to Archive, Download, or Delete.',
      'Press Ctrl+A or click Select to enter selection mode for bulk Archive or Download.',
    ],
    subsections: [
      {
        id: 'quick-vox',
        title: 'Quick Vox (Key: 6) — Fastest Voice Notes',
        description: 'The fastest way to send a voice note — no preview step.',
        steps: [
          'Select Quick Vox or press 6.',
          'Choose a recipient from your contacts.',
          'Hold the record button and speak.',
          'Release to send instantly — no review step.',
        ],
        note: 'Best for: quick check-ins, fast answers, "hey did you see this?" moments.',
      },
      {
        id: 'classic-voxer',
        title: 'Classic Voxer (Key: 1) — Full Control',
        description: 'Traditional voice messaging with preview and editing.',
        steps: [
          'Select Classic Voxer or press 1.',
          'Press Record, speak your message, press Stop.',
          'Preview your recording — re-record if needed.',
          'Optionally trim the beginning and end before sending.',
          'Click Send.',
        ],
        note: 'Best for: thoughtful messages where you want to review before sending.',
      },
      {
        id: 'team-vox',
        title: 'Team Vox (Key: 4) — Team Voice Channel',
        description: 'Voice messaging for your whole team in a shared channel.',
        steps: [
          'Select Team Vox or press 4.',
          'Choose or create a team channel.',
          'Record and send — everyone in the channel receives the message.',
          'Press @ while composing to use @mentions and notify specific team members.',
          'Click the settings icon to rename the channel, manage members, and set notifications.',
        ],
        note: 'Best for: async team standups, team announcements, replacing group text chains.',
      },
      {
        id: 'voice-threads',
        title: 'Voice Threads (Key: 3) — Conversational Voice',
        description: 'Back-and-forth voice discussions organized as threads.',
        steps: [
          'Select Voice Threads or press 3.',
          'Start a new thread or open an existing one.',
          'Record your voice reply — it\'s added to the thread chronologically.',
          'The AI summary at the top of each thread updates as new replies come in.',
        ],
        note: 'Best for: discussions where tone and nuance matter, replacing phone calls.',
      },
      {
        id: 'vox-drop',
        title: 'Vox Drop (Key: 7) — Scheduled Voice',
        description: 'Record now, deliver at the perfect time.',
        steps: [
          'Select Vox Drop or press 7.',
          'Choose a recipient.',
          'Record your message.',
          'Click Schedule Delivery and pick a date and time.',
          'The message sends automatically. View or cancel it from the Scheduled panel.',
        ],
        note: 'Best for: time-zone-aware messages, Monday morning updates, meeting prep reminders.',
      },
      {
        id: 'pulse-radio',
        title: 'Pulse Radio (Key: 2) — Broadcast Voice',
        description: 'One recording, many inboxes.',
        steps: [
          'Select Pulse Radio or press 2.',
          'Choose your audience: a team, a Contact Circle, or individual contacts.',
          'Record your broadcast message.',
          'Click Broadcast — each recipient receives it individually in their Voxer inbox.',
        ],
        note: 'Best for: company-wide announcements, all-hands updates, client list broadcasts.',
      },
      {
        id: 'vox-notes',
        title: 'Vox Notes (Key: 5) — Personal Voice Memos',
        description: 'Record thoughts and ideas for yourself.',
        steps: [
          'Select Vox Notes or press 5.',
          'Record your note.',
          'It saves to your personal Vox Notes library — not sent to anyone.',
          'All Vox Notes are transcribed and searchable by keyword.',
        ],
        note: 'Best for: capturing ideas on the go, meeting reminders, personal voice journal.',
      },
      {
        id: 'video-vox',
        title: 'Video Vox (Key: 8) — Video Messages',
        description: 'Face-to-face without scheduling a call.',
        steps: [
          'Select Video Vox or press 8.',
          'Allow camera access when prompted.',
          'Press Record — you see yourself in the preview window.',
          'Record your video message (up to the configured maximum length).',
          'Review the preview and click Send.',
        ],
        note: 'Best for: personal messages where body language matters, client introductions.',
      },
      {
        id: 'time-capsule',
        title: 'Time Capsule Vox — Time-Locked Messages',
        steps: [
          'Select Time Capsule Vox from the mode selector.',
          'Record your message.',
          'Set an unlock date — the recipient cannot open the message before this date.',
          'Send it — it appears locked in their inbox until the unlock date.',
        ],
        note: 'Best for: birthday/anniversary messages, milestone celebrations, future reviews.',
      },
      {
        id: 'ai-toolbar',
        title: 'AI Toolbar',
        description: 'Every Voxer mode includes an AI toolbar at the top.',
        steps: [
          'Summarize (Ctrl+S) — generates a written summary of the full conversation.',
          'Smart Replies — suggests 3 quick voice reply options based on context.',
          'Meeting Notes — extracts a structured document: agenda items, decisions, action items.',
        ],
      },
      {
        id: 'playback-controls',
        title: 'Playback Controls',
        steps: [
          'Speed — adjust playback: 0.75x, 1x, 1.5x, 2x.',
          'Skip — skip forward or back 10 seconds.',
          'Bookmarks — click the bookmark icon while listening to mark an important moment.',
          'Transcript — every message shows its AI-generated text transcript below the audio player.',
        ],
      },
    ],
    shortcuts: [
      { key: 'Space', action: 'Toggle recording (when not typing)' },
      { key: 'Escape', action: 'Stop recording / cancel' },
      { key: '1', action: 'Switch to Classic Voxer' },
      { key: '2', action: 'Switch to Pulse Radio' },
      { key: '3', action: 'Switch to Voice Threads' },
      { key: '4', action: 'Switch to Team Vox' },
      { key: '5', action: 'Switch to Vox Notes' },
      { key: '6', action: 'Switch to Quick Vox' },
      { key: '7', action: 'Switch to Vox Drop' },
      { key: '8', action: 'Switch to Video Vox' },
      { key: 'Ctrl+S', action: 'AI Summarize conversation' },
      { key: 'Ctrl+A', action: 'Select all / enter selection mode' },
      { key: 'Ctrl+D', action: 'Download selected message' },
      { key: '?', action: 'Show all Voxer keyboard shortcuts' },
    ],
    tips: [
      'Press Space to start/stop recording without clicking — keep your hands on the keyboard.',
      'Press ? in any Voxer mode to see the full context-specific keyboard shortcut list.',
      'Adjust playback to 1.5x or 2x to listen to long voice messages much faster.',
      'The AI transcript appears below every message — read it when you\'re in a quiet space.',
    ],
    useCases: [
      {
        id: 'uc-async-standup',
        title: 'Async Team Standup Across Time Zones',
        scenario: 'Your team spans 3 time zones. A daily 9 AM call doesn\'t work for everyone.',
        steps: [
          'Create a Team Vox channel called "Daily Standup".',
          'Each team member records a 60–90 second Vox each morning: yesterday / today / blockers.',
          'Team members listen when they start their day, regardless of time zone.',
          'Click AI Summarize to get a written summary of all standups in one paragraph.',
          'Reply in the thread if someone raises a blocker — @mention the right person.',
        ],
      },
      {
        id: 'uc-client-voice-update',
        title: 'Personal Client Voice Updates',
        scenario: 'You want to give clients personalized project updates without spending time on calls.',
        steps: [
          'Use Quick Vox to record a 2-minute personal project update for each client.',
          'The client receives it in their Pulse inbox or via a shareable link.',
          'They listen on their own time, read the transcript, and reply with their own voice.',
          'No scheduling. No calendar conflicts. More personal than an email.',
        ],
      },
    ],
    advanced: [
      {
        id: 'adv-voxer-async',
        title: 'Async Communication Best Practices',
        items: [
          'Use Team Vox + AI Summary as a complete standup replacement — one paragraph covers the whole team.',
          'For project handoffs, record a Vox Drop explaining context, nuances, and gotchas — richer than a doc.',
          'Voice-first reviews: record feedback as a Voice Thread reply instead of written comments — tone comes through.',
          'Archive finalized project Vox threads — all transcripts remain searchable for future reference.',
          'Set Vox Drop delivery for Monday 8 AM so your team starts the week with context.',
        ],
      },
    ],
    badge: 'Updated',
  },

  // ── 8. MEETINGS HUB ──────────────────────────────────────────────────────
  {
    id: 'meetings',
    title: 'Meetings Hub',
    icon: '📹',
    summary: 'Full video meeting platform — templates, agenda builder, action items, recordings, breakout rooms, analytics, and multi-platform support.',
    steps: [
      'Click Meetings in the sidebar to open the Meetings Dashboard.',
      'Paste a meeting link or enter a code in the join field at the top and click Join.',
      'Click New Meeting to start an instant Pulse Video call — share the generated code (abc-defg-hij format).',
      'Use Meeting Templates for pre-built agendas: Daily Standup, 1:1, Sprint Planning, Brainstorm.',
      'Use Agenda Builder to structure meetings with timed blocks and presenters before the call.',
      'Add Action Items during or after a meeting — they sync automatically to Decisions & Tasks.',
      'Access Recordings to rewatch past Pulse Video meetings with transcripts and AI summaries.',
    ],
    subsections: [
      {
        id: 'meeting-platforms',
        title: 'Supported Platforms',
        description: 'Pulse Meetings supports four platforms from a single interface.',
        steps: [
          'Pulse Video — native, built-in. Full AI integration: transcription, notes, action items. Badge: Native.',
          'Google Meet — opens in Google Meet. Calendar sync available.',
          'Zoom — opens in Zoom. Requires a Zoom account.',
          'Microsoft Teams — opens in Teams. Requires Microsoft 365.',
        ],
        note: 'Pulse Video is recommended — it has the deepest AI integration.',
      },
      {
        id: 'meeting-templates',
        title: 'Meeting Templates',
        steps: [
          'Click Meeting Templates on the Meetings Dashboard.',
          'Daily Standup (15 min): Yesterday / Today / Blockers.',
          '1:1 Meeting (30 min): Check-in / Projects / Goals / Feedback.',
          'Sprint Planning (60 min): Review / Backlog / Capacity / Goals.',
          'Brainstorm (45 min): Problem / Ideation / Discussion / Next steps.',
          'Select a template — the agenda is pre-populated and editable.',
        ],
      },
      {
        id: 'agenda-builder',
        title: 'Agenda Builder',
        steps: [
          'Click Agenda Builder on the Meetings Dashboard.',
          'Add agenda items with: Title, Duration (minutes), Presenter, and Notes.',
          'Share the agenda with participants before the meeting.',
          'During the meeting, check off agenda items as they are completed.',
        ],
      },
      {
        id: 'action-items',
        title: 'Meeting Action Items',
        steps: [
          'During or after any meeting, click Action Items.',
          'Add each item with: Title, Assignee, and Due Date.',
          'Action items sync to the Decisions & Tasks section automatically.',
          'Assignees receive notifications and can track progress.',
        ],
      },
      {
        id: 'recordings',
        title: 'Recordings & Transcripts',
        steps: [
          'Click Recordings on the Meetings Dashboard.',
          'Browse by date or search by meeting title.',
          'Each recording includes: full video, auto-generated transcript, AI summary, and extracted action items.',
          'Share a recording link with anyone who missed the meeting.',
        ],
        note: 'Recordings are available for Pulse Video meetings only.',
      },
      {
        id: 'breakout-rooms',
        title: 'Breakout Rooms',
        steps: [
          'During an active Pulse Video meeting, click Breakout Rooms.',
          'Set the number of rooms and assign participants (or randomize).',
          'Click Open Rooms — participants move to their assigned rooms.',
          'Set a timer for when rooms close and participants return to the main session.',
          'Broadcast a message to all breakout rooms simultaneously.',
        ],
      },
      {
        id: 'meeting-analytics',
        title: 'Meeting Analytics',
        steps: [
          'Click Meeting Analytics on the Meetings Dashboard.',
          'Total meetings this month and total time spent in meetings.',
          'Average meeting duration vs. scheduled duration — are your meetings running over?',
          'Meeting frequency by day and time of week.',
          'Attendance rates for recurring meetings.',
          'Week-over-week comparison trends.',
        ],
      },
      {
        id: 'meeting-settings',
        title: 'Meeting Settings',
        steps: [
          'Click Meeting Settings on the Meetings Dashboard.',
          'Default video/audio device selection.',
          'Background blur or virtual backgrounds.',
          'Auto-record or manual recording preference.',
          'Default meeting duration.',
          'Waiting room on/off.',
        ],
      },
    ],
    tables: [
      {
        title: 'Meeting Templates at a Glance',
        columns: ['Template', 'Duration', 'Default Agenda'],
        rows: [
          ['Daily Standup', '15 min', 'Yesterday · Today · Blockers'],
          ['1:1 Meeting', '30 min', 'Check-in · Projects · Goals · Feedback'],
          ['Sprint Planning', '60 min', 'Review · Backlog · Capacity · Goals'],
          ['Brainstorm', '45 min', 'Problem · Ideation · Discussion · Next steps'],
        ],
      },
    ],
    tips: [
      'Pulse Video is recommended — it includes AI Scribe for automatic transcription and note generation.',
      'Share the agenda with participants 30 minutes before the meeting using Agenda Builder.',
      'Use Bulk Invite to send a meeting invitation to an entire Contact Circle at once.',
      'Past meeting recordings are searchable by transcript content — find any moment by keyword.',
    ],
    useCases: [
      {
        id: 'uc-sprint-planning',
        title: 'Running an Effective Sprint Planning Session',
        scenario: 'You\'re a scrum master running bi-weekly sprint planning with 8 people.',
        steps: [
          'Click Meeting Templates → Sprint Planning — agenda is pre-built.',
          'Customize the agenda: add sprint items, assign presenters.',
          'Send the agenda to all participants 30 minutes before.',
          'Start the Pulse Video meeting — AI Scribe transcribes automatically.',
          'Check off agenda items as you progress.',
          'When someone commits to a task, add it to Action Items with their name and due date.',
          'After: click Meeting Notes — AI generates a structured summary in seconds.',
          'All action items automatically appear in Decisions & Tasks for each assignee.',
        ],
      },
      {
        id: 'uc-client-discovery',
        title: 'Client Discovery Call',
        scenario: 'You\'re a consultant running a 45-minute discovery call with a new prospect.',
        steps: [
          'Start a Pulse Video meeting — everything is transcribed automatically.',
          'Use the Brainstorm template as your base agenda structure.',
          'Take notes directly in the agenda builder during the call.',
          'After: Extract Action Items — Pulse pulls out all commitments made.',
          'Click AI Summary — get a concise brief to share internally.',
          'Send the recording link to your client as a follow-up resource.',
        ],
      },
    ],
    badge: 'New',
  },

  // ── 9. CALENDAR ──────────────────────────────────────────────────────────
  {
    id: 'calendar',
    title: 'Calendar & Scheduling',
    icon: '📅',
    summary: 'Connect Google or Microsoft Calendar, drag to reschedule, find times for all attendees, and use Meeting Deflector to protect your focus time.',
    steps: [
      'Connect your calendar: Settings → Connected Accounts → Connect Calendar. Choose Google or Microsoft.',
      'Click Calendar in the sidebar and toggle between Day, Week, and Month views.',
      'Click any empty time slot on the calendar to create a new event.',
      'Drag and drop any event to a new time slot to reschedule — attendees are notified automatically.',
      'Accept or decline calendar invites from your inbox: Accept, Maybe, or Decline.',
      'Use Meeting Deflector on any invite to get AI analysis and a draft decline message.',
      'Click Find Time in the event editor to see open slots that work for all attendees.',
    ],
    subsections: [
      {
        id: 'creating-events',
        title: 'Creating Events',
        steps: [
          'Click any empty time slot.',
          'Enter an event title.',
          'Set date, time, and duration.',
          'Add guests by name or email — Pulse suggests from your contacts.',
          'Add a video meeting link: choose Pulse Video, Google Meet, or Zoom.',
          'Add agenda or notes for the event.',
          'Click Create Event — guests receive email invites automatically.',
        ],
      },
      {
        id: 'meeting-deflector',
        title: 'Meeting Deflector — Protect Your Time',
        steps: [
          'Open any event on your calendar.',
          'Click Meeting Deflector.',
          'Pulse analyzes: who requested it, the agenda, your existing schedule, your historical attendance.',
          'Pulse recommends: Attend, Send a Delegate, or Decline.',
          'If you want to decline, click Generate Decline Message — a professional, polite response is drafted.',
          'Review and send the response.',
        ],
        note: 'Use Meeting Deflector proactively on every new invite — it takes 5 seconds and can save hours per week.',
      },
      {
        id: 'smart-scheduling',
        title: 'Smart Scheduling',
        steps: [
          'When inviting someone to a meeting, click Find Time in the event editor.',
          'Pulse checks attendees\' calendars (if shared) and suggests 3 available slots.',
          'Click a slot to set it as the meeting time.',
        ],
      },
      {
        id: 'reminders',
        title: 'Reminders & Notifications',
        steps: [
          'When creating or editing an event, click Add Reminder.',
          'Choose timing: 5 minutes, 15 minutes, 30 minutes, 1 hour, 1 day, or custom.',
          'Add multiple reminders to the same event for critical meetings.',
          'Reminders appear as in-app notifications and as push notifications on mobile.',
        ],
      },
    ],
    shortcuts: [
      { key: 'T', action: 'Jump to Today' },
      { key: 'D', action: 'Switch to Day view' },
      { key: 'W', action: 'Switch to Week view' },
      { key: 'M', action: 'Switch to Month view' },
      { key: 'N', action: 'Create new event' },
      { key: '←', action: 'Navigate to previous period' },
      { key: '→', action: 'Navigate to next period' },
    ],
    tips: [
      'Connect multiple calendars (Work and Personal) — Pulse displays them with color coding.',
      'Meeting Deflector takes 5 seconds and can reclaim hours per week — use it on every invite.',
      'Add two reminders to important meetings: 1 day before and 15 minutes before.',
    ],
    useCases: [
      {
        id: 'uc-reclaim-time',
        title: 'Reclaiming Focus Time with Meeting Deflector',
        scenario: 'Your calendar is overwhelmed with meeting invites and you have no time for actual work.',
        steps: [
          'Open your calendar and review next week\'s meetings.',
          'For each optional meeting, click Meeting Deflector.',
          'Pulse flags meetings where your presence isn\'t critical.',
          'Click Generate Decline Message for each — customized polite responses are drafted.',
          'Review and send — you\'ve reclaimed hours of focus time in minutes.',
        ],
      },
      {
        id: 'uc-timezone-meeting',
        title: 'Multi-Timezone Team Meeting',
        scenario: 'Your team spans New York, London, and Singapore. Finding meeting times is painful.',
        steps: [
          'Create a new event and add all attendees.',
          'Click Find Time — Pulse checks everyone\'s calendars.',
          'Pulse highlights overlapping windows where everyone is available during business hours.',
          'Select the best window — it minimizes unsociable hours for all time zones.',
          'Use a Meeting Template to pre-build the agenda.',
          'Everyone receives invites with their local time shown.',
        ],
      },
    ],
  },

  // ── 10. CONTACTS ─────────────────────────────────────────────────────────
  {
    id: 'contacts',
    title: 'Contacts & Relationships',
    icon: '👥',
    summary: 'Full relationship management — AI insights, health scores, contact circles, autopilot reminders, network visualization, and meeting prep cards.',
    steps: [
      'Click Contacts in the sidebar — contacts are imported from all your connected accounts.',
      'Click any contact to open their full profile: history, CRM data, notes, goals, and relationship score.',
      'Assign contacts to categories: Team, Clients, Volunteers, or Vendors.',
      'Enable Relationship Autopilot on any contact to get recurring check-in reminders.',
      'Check the Today Feed for relationship actions that need attention today.',
      'Create Contact Circles to group related contacts (e.g., "Q1 Prospects") — visualized as a bubble chart.',
    ],
    subsections: [
      {
        id: 'contact-profiles',
        title: 'Contact Profiles',
        steps: [
          'Name, photo, company, title, and contact information.',
          'Communication history — recent messages, emails, and calls.',
          'Upcoming meetings with this person.',
          'CRM data — deals and activity history (if CRM connected).',
          'Notes — personal notes you\'ve added.',
          'Relationship health score — AI-generated, updated daily.',
          'Contact goals — what you want to accomplish with this person.',
        ],
      },
      {
        id: 'ai-insights',
        title: 'AI Contact Insights',
        steps: [
          'Talking Points — suggested topics based on recent interactions.',
          'Relationship Score (1–100) — strength of your relationship, updated daily.',
          'Communication Patterns — when they respond and their preferred communication method.',
          'Sentiment Trend — whether recent interactions have been positive, neutral, or tense.',
        ],
        note: 'Relationship Score below 40 means the relationship is going cold — a signal to reach out.',
      },
      {
        id: 'meeting-prep',
        title: 'Meeting Prep Cards',
        steps: [
          'Before any meeting, click the attendee\'s name in the Calendar or Dashboard.',
          'The Meeting Prep Card shows: key facts, recent exchanges, pending tasks, and AI-suggested talking points.',
          'Review before entering the meeting to show up fully prepared.',
        ],
      },
      {
        id: 'today-feed',
        title: 'Today Feed — Relationship Reminders',
        steps: [
          'Click Today Feed view in the Contacts section.',
          'See contacts you haven\'t spoken with recently.',
          'People celebrating work anniversaries or birthdays (if in their profile).',
          'Follow-up reminders you\'ve set.',
          'Autopilot check-in suggestions.',
        ],
      },
      {
        id: 'contact-circles',
        title: 'Contact Circles',
        steps: [
          'Click New Circle in the Contacts sidebar.',
          'Name your circle: "Q1 Prospects", "Conference Connections", "Board Members".',
          'Add contacts by searching and clicking Add to Circle.',
          'View circles as a bubble chart — larger bubbles = more recent contact.',
          'Bulk message an entire circle for group outreach.',
        ],
      },
      {
        id: 'autopilot',
        title: 'Relationship Autopilot',
        steps: [
          'Open a contact\'s profile.',
          'Toggle Autopilot on.',
          'Set a check-in frequency: Weekly, Monthly, or Quarterly.',
          'Pulse reminds you to reach out at that interval — the contact appears in Today Feed.',
        ],
      },
      {
        id: 'network-view',
        title: 'Network Visualization',
        steps: [
          'Click Network View at the top of the Contacts section.',
          'See a visual map of your connections and how contacts relate to each other.',
          'Identify bridges — people who connect different parts of your network.',
          'Spot gaps — people you haven\'t spoken to in a long time.',
        ],
      },
      {
        id: 'smart-lists',
        title: 'Smart Contact Lists',
        steps: [
          'Click New List in the Contacts sidebar.',
          'Set filters: "All Clients in California", "Leads with no contact in 30 days".',
          'Save — the list updates automatically as contacts change.',
        ],
      },
      {
        id: 'merge-duplicates',
        title: 'Merging Duplicates',
        steps: [
          'Go to Contacts → Tools → Find Duplicates.',
          'Pulse flags potential duplicates based on name, email, and phone.',
          'Click Merge on any pair — data from both records is preserved.',
        ],
      },
    ],
    tips: [
      'Use Meeting Prep Cards before every client call — takes 30 seconds and dramatically improves conversations.',
      'Smart Lists update automatically — set filters once and they stay current without maintenance.',
      'On mobile, scan business cards with the camera to create contacts instantly after conferences.',
    ],
    useCases: [
      {
        id: 'uc-sales-pipeline',
        title: 'Sales Pipeline Relationship Management',
        scenario: 'You\'re a sales rep managing 50 active prospects.',
        steps: [
          'Create Contact Circles: "Hot Prospects", "Warm Leads", "Closed - Won", "Closed - Lost".',
          'Enable Relationship Autopilot on all Hot Prospects with weekly check-in reminders.',
          'Set Contact Goals: "Close by March 31" or "Schedule product demo".',
          'Each morning, check the Today Feed — it shows which prospects need attention.',
          'Before every sales call, open the Meeting Prep Card for context and talking points.',
          'After each call, add a Note with what was discussed and next steps.',
        ],
      },
      {
        id: 'uc-conference-followup',
        title: 'Conference Networking Follow-up',
        scenario: 'You returned from a conference with 40 new business cards.',
        steps: [
          'Scan each business card on mobile to create contacts instantly.',
          'Create a Circle: "Conference 2026 Connections".',
          'Add all new contacts to the circle.',
          'Bulk message the circle: "Great meeting you at the conference last week…"',
          'Set Relationship Autopilot (monthly) on promising contacts.',
          'Set Contact Goals on the top 5: "Arrange a discovery call in 2 weeks."',
        ],
      },
    ],
    badge: 'Updated',
  },

  // ── 11. DECISIONS & TASKS ─────────────────────────────────────────────────
  {
    id: 'decisions-tasks',
    title: 'Decisions & Tasks',
    icon: '✅',
    summary: 'Collaborative voting, AI decomposition, Kanban board, workload heatmap, decision-to-task pipeline, proactive nudges, and an in-context AI assistant.',
    steps: [
      'Click Decisions & Tasks in the sidebar.',
      'Click New Decision — write a clear question as the title (e.g., "Should we migrate to new CRM in Q2?").',
      'Team members vote Yes, No, or Abstain — results update in real time.',
      'Click New Task to create a task — assign it, set priority and deadline, add subtasks.',
      'Use Board View to drag tasks between To Do, In Progress, and Done.',
      'Use Heatmap View to see team workload per person per day — red = overloaded.',
    ],
    subsections: [
      {
        id: 'decisions',
        title: 'Creating & Managing Decisions',
        steps: [
          'Click New Decision. Enter a question-format title, description, and optional deadline.',
          'Team members vote Yes, No, or Abstain — voters can leave a comment explaining their vote.',
          'The vote tally updates in real time.',
          'When all votes are in or the deadline passes, mark the decision finalized.',
          'Click Archive to move completed decisions to Archives — searchable but out of the way.',
        ],
      },
      {
        id: 'decision-templates',
        title: 'Decision Templates',
        steps: [
          'Click New Decision → Use a Template.',
          'Pros & Cons — simple two-sided analysis.',
          'Priority Matrix — comparing options on two axes (impact vs. effort).',
          'Go/No-Go — binary decision with clear criteria.',
          'RACI — decisions requiring role assignment (Responsible, Accountable, Consulted, Informed).',
        ],
      },
      {
        id: 'decompose',
        title: 'AI Decomposition',
        steps: [
          'Open a complex decision.',
          'Click Decompose.',
          'Pulse AI breaks it into ordered sub-decisions with dependencies.',
          'Each sub-decision can be voted on independently.',
        ],
      },
      {
        id: 'decision-to-task',
        title: 'Decision-to-Task Pipeline',
        steps: [
          'Open a finalized decision.',
          'Click Convert to Tasks.',
          'Pulse creates tasks pre-populated with context from the decision.',
          'Suggested assignees are based on who was involved in the decision.',
          'Review and adjust, then click Create All Tasks.',
        ],
      },
      {
        id: 'tasks',
        title: 'Creating & Managing Tasks',
        steps: [
          'Click New Task. Enter an action-oriented title (e.g., "Write proposal for client X").',
          'Assign it to a team member — they are notified immediately.',
          'Set priority: Low, Medium, High, or Urgent.',
          'Set a deadline date.',
          'Add Subtasks — the parent shows a completion progress bar.',
          'Comment in the thread with @mentions to notify specific people.',
        ],
      },
      {
        id: 'board-view',
        title: 'Board View — Kanban',
        steps: [
          'Click Board View in the tasks toolbar.',
          'Three columns: To Do, In Progress, Done.',
          'Drag task cards between columns to update status.',
          'Task cards show: assignee avatar, priority color, and deadline.',
          'Filter by assignee or tag to focus on specific work.',
        ],
      },
      {
        id: 'heatmap',
        title: 'Workload Heatmap',
        steps: [
          'Click Heatmap View in the tasks toolbar.',
          'A color-coded grid shows task load per team member per day.',
          'Red cells = overloaded. Green cells = available capacity.',
          'Click any cell to see the specific tasks for that person on that day.',
          'Drag a task in the heatmap to reassign it and balance the load.',
        ],
        note: 'Review the Heatmap before assigning new tasks to avoid overwhelming anyone.',
      },
      {
        id: 'ai-prioritize',
        title: 'AI Task Prioritization',
        steps: [
          'Click AI Prioritize in the task list.',
          'Pulse analyzes all tasks considering: deadlines, urgency, dependencies, and workload.',
          'A suggested order is presented with a brief explanation for each task.',
          'Accept the full suggestion or adjust manually.',
        ],
      },
      {
        id: 'proactive-nudges',
        title: 'Proactive Nudges',
        steps: [
          'Overdue tasks — tasks past their deadline with no completion.',
          'Unresolved votes — a decision with votes pending from specific members.',
          'Overloaded team member — someone with too many high-priority tasks.',
          'Stale decision — a decision with no activity in several days.',
          'Click Dismiss to clear a nudge, or Snooze to be reminded later.',
        ],
      },
      {
        id: 'ai-assistant-tasks',
        title: 'In-Context AI Assistant',
        steps: [
          'Click the Bot button in the top toolbar of Decisions & Tasks.',
          'Ask questions in plain language: "Which tasks are overdue?", "Who has the most tasks?", "Summarize open decisions".',
          'The assistant has full awareness of your workspace\'s current decisions and tasks.',
          'Tell it to take actions: "Create a task for Sarah to review the proposal by Friday."',
        ],
      },
    ],
    tables: [
      {
        title: 'Decision Templates',
        columns: ['Template', 'Best For'],
        rows: [
          ['Pros & Cons', 'Simple two-sided analysis'],
          ['Priority Matrix', 'Comparing multiple options on impact vs. effort'],
          ['Go/No-Go', 'Clear binary decisions with defined criteria'],
          ['RACI', 'Decisions requiring explicit role assignment'],
        ],
      },
    ],
    tips: [
      'Always use Convert to Tasks after finalizing a decision — this closes the loop from decision to action.',
      'Archive completed decisions — they become searchable institutional knowledge.',
      'Drag tasks in the Heatmap View to reassign and balance load visually.',
      'Use the Task Activity Feed for a full log of who changed what and when.',
    ],
    useCases: [
      {
        id: 'uc-roadmap-prioritization',
        title: 'Product Roadmap Prioritization',
        scenario: 'Your product team needs to decide which 5 features to build in Q2 from 20 candidates.',
        steps: [
          'Create a decision: "Q2 Feature Prioritization — which 5 features should we build?"',
          'Use the Priority Matrix template — axes: customer impact vs. build effort.',
          'Invite product, engineering, and design leads to vote.',
          'Use Decompose to break it into sub-decisions: "Is this a Q2 feature or Q3?" per feature.',
          'After voting, finalize the 5 winners.',
          'Click Convert to Tasks — each chosen feature becomes a task with suggested owners.',
          'Open Board View and start sprint planning.',
        ],
      },
      {
        id: 'uc-cross-functional',
        title: 'Managing a Cross-Functional Project',
        scenario: 'You\'re running a product launch across 4 teams.',
        steps: [
          'Create tasks for each team and assign them to team leads.',
          'Use the Workload Heatmap to ensure no team is overwhelmed in the same week.',
          'Create decisions for open questions: vendor choice, launch date, pricing.',
          'Use AI Prioritize weekly to re-sequence tasks based on updated deadlines.',
          'Ask the AI Assistant daily: "What\'s blocking the launch?"',
          'After launch, archive all decisions — the archive becomes a launch playbook.',
        ],
      },
    ],
    advanced: [
      {
        id: 'adv-decisions-best-practices',
        title: 'Decision-Making Best Practices',
        items: [
          'Always use a question format for titles: "Should we X?" or "Which option: A or B?"',
          'Attach supporting materials before asking for votes — not during.',
          'Set a voting deadline to prevent decisions from languishing for weeks.',
          'Use Decompose for any decision with more than 3 significant factors.',
          'Add a Summary Note when archiving a decision — it becomes institutional knowledge.',
        ],
      },
    ],
    badge: 'Updated',
  },

  // ── 12. AI FEATURES ────────────────────────────────────────────────────────
  {
    id: 'ai-features',
    title: 'AI Features',
    icon: '🤖',
    summary: 'AI woven into every part of Pulse — global assistant, smart compose, translation in 90+ languages, tone analysis, action extraction, AI Lab workspaces, and the full War Room with 7 modes and 6 guided missions.',
    badge: 'Updated',
    steps: [
      'Press Ctrl+/ (or ⌘/ on Mac) or click the animated ECG icon in the sidebar to open the Pulse AI Assistant.',
      'The assistant loads your current section\'s data automatically — ask it anything about your workspace.',
      'A badge on the ECG button means Pulse has a proactive suggestion ready.',
      'AI Message Suggestions appear while typing — click to accept a suggestion.',
      'Translate any message: hover → click the globe icon → choose from 90+ languages.',
      'Click Summarize on any long thread to get a 2–4 sentence written summary.',
      'Click Extract Action Items on any email or message to pull tasks into your task list.',
      'Click War Room in the sidebar for deep-work AI research, planning, and decision-making.',
    ],
    subsections: [
      {
        id: 'pulse-ai-assistant',
        title: 'Pulse AI Global Assistant',
        steps: [
          'Open with Ctrl+/ or the animated ECG waveform button in the sidebar.',
          'The assistant is context-aware — it loads data from your current section when you open it.',
          'Chat history is preserved across section switches during your session.',
          'Ask questions: "What meetings do I have this week?", "Summarize my emails from today."',
          'Give it actions: "Create a task for Sarah to review the proposal by Friday."',
          'Chain actions: "Summarize the overdue tasks, then draft a message to each assignee."',
          'A badge on the ECG button means a proactive suggestion is waiting for you.',
        ],
      },
      {
        id: 'smart-compose',
        title: 'Smart Compose & Suggestions',
        steps: [
          'AI Message Suggestions appear while typing — click to insert a suggestion.',
          'In any message or email composer, click the AI (sparkle) icon to auto-complete your draft.',
          'The Tone indicator below the text box shows how your message reads: Friendly, Formal, Neutral, Aggressive.',
          'Click the Tone indicator for suggestions on adjusting your tone.',
          'Accept auto-complete fully, partially, or ignore it entirely.',
        ],
      },
      {
        id: 'translation',
        title: 'Translation (90+ Languages)',
        steps: [
          'Hover over any message and click the Translate icon (globe).',
          'Choose your target language — 90+ languages are supported.',
          'The translated text appears below the original.',
          'Click Translate My Reply to compose your response in the original sender\'s language.',
        ],
      },
      {
        id: 'action-extraction',
        title: 'Action Item Extraction',
        steps: [
          'Click Extract Action Items on any email or message.',
          'Pulse reads the full thread and finds all tasks, requests, and commitments.',
          'Review the extracted list.',
          'Click Add to Tasks to save selected items — each includes the source message as context.',
        ],
      },
      {
        id: 'ai-lab',
        title: 'AI Lab — Specialized Workspaces',
        steps: [
          'Open from Tools → AI Lab in the sidebar.',
          'AI Studio — draft, refine, and enhance written content with AI assistance.',
          'Mission Control — build and coordinate multi-step AI workflows.',
          'Intelligence Hub — research and synthesize information from multiple sources.',
          'Quick Actions — fast one-click AI: summarize, rewrite, translate, extract.',
          'Proposal Builder — create structured proposals and presentations with AI guidance.',
          'Channel Digest — generate summaries of your channels and conversations automatically.',
          'Stand-up Briefing — create daily stand-up summaries from your recent activity.',
        ],
      },
      {
        id: 'war-room',
        title: 'War Room — Strategic AI Workspace',
        description: 'Click War Room in the sidebar to enter Pulse\'s deep-work AI hub with 7 modes and 6 guided missions.',
        steps: [
          'Switch modes using the Mode Switcher or press number keys 1–7.',
          'Mode 1 — Command Center: tactical operations and real-time coordination.',
          'Mode 2 — Intel: research, intelligence gathering, and investigation.',
          'Mode 3 — Deep Focus: distraction-free writing and long-form thinking.',
          'Mode 4 — Data Analyst: structured data analysis and pattern recognition.',
          'Mode 5 — Strategist: strategic planning and big-picture thinking.',
          'Mode 6 — Brainstorm: creative ideation and idea generation.',
          'Mode 7 — Debrief: post-project retrospectives and lessons learned.',
          'Launch a Mission from the Missions tab: Research, Decision, Brainstorm, Plan, Analyze, or Create.',
          'Use The Board to pin notes (Findings, Insights, Action Items, Questions, Decisions) that persist across sessions.',
          'Press Ctrl+K / Cmd+K to open the Action Palette — a searchable command menu for quick War Room actions.',
        ],
      },
    ],
    tables: [
      {
        title: 'War Room Guided Missions',
        columns: ['Mission', 'Guides You Through'],
        rows: [
          ['Research', 'Define question → Explore perspectives → Analyze findings → Conclude'],
          ['Decision', 'Define choice → List options → Set criteria → Evaluate → AI recommendation'],
          ['Brainstorm', 'Set challenge → Generate ideas → Cluster → Converge → Refine top picks'],
          ['Plan', 'Define goals → Scope → Milestones → Risks → Final plan'],
          ['Analyze', 'Set goal → Collect data → Analyze → Extract insights → Report'],
          ['Create', 'Set brief → Outline → Draft → Refine → Export'],
        ],
      },
      {
        title: 'AI Lab Workspaces',
        columns: ['Workspace', 'Best For'],
        rows: [
          ['AI Studio', 'Drafting and refining written content'],
          ['Mission Control', 'Multi-step AI workflow coordination'],
          ['Intelligence Hub', 'Research and information synthesis'],
          ['Quick Actions', 'Fast one-click AI operations'],
          ['Proposal Builder', 'Structured proposals and presentations'],
          ['Channel Digest', 'Auto-summaries of channels and conversations'],
          ['Stand-up Briefing', 'Daily stand-up summaries from recent activity'],
        ],
      },
    ],
    tips: [
      'The AI Assistant can take real actions — don\'t just ask questions, tell it what to do.',
      'Be specific: "Draft a reply to Sarah\'s last email" is far more powerful than "help me write an email".',
      'In the War Room, press 1–7 to switch between modes instantly without reaching for the mouse.',
      'The Board in the War Room saves notes across sessions — use it to build a running intelligence file.',
      'Chat history persists across sections during your session — pick up right where you left off.',
    ],
    useCases: [
      {
        id: 'uc-out-of-office',
        title: 'Catching Up After a Week Out of Office',
        scenario: 'You were on vacation for a week. You open Pulse Monday morning.',
        steps: [
          'Press Ctrl+/ to open the Pulse AI Assistant.',
          'Ask: "What happened while I was away? Summarize important emails, messages, and decisions."',
          'Ask: "Which tasks are now overdue?" — get a list instantly.',
          'Ask: "Draft replies to the 3 most urgent emails" — the AI drafts all three for review.',
          'Ask: "Add a task to follow up with each person who messaged me about the Q1 report."',
          'Back up to speed in 15 minutes instead of 2 hours.',
        ],
      },
      {
        id: 'uc-brainstorm-marketing',
        title: 'Marketing Campaign Brainstorming',
        scenario: 'You need campaign ideas for your company\'s new product.',
        steps: [
          'Open Tools → AI Lab.',
          'Enter: "Marketing campaign ideas for our project management software targeting mid-size teams."',
          'Choose SCAMPER — Pulse generates variations: Substitute, Combine, Adapt the typical approach.',
          'Switch to Six Thinking Hats — get creative, critical, optimistic, and data views in one session.',
          'Export the best ideas as a document to share with your marketing team.',
        ],
      },
    ],
    advanced: [
      {
        id: 'adv-ai-power-usage',
        title: 'Getting the Most from the Pulse AI Assistant',
        items: [
          'Specific context wins: "Draft a reply to Sarah\'s last email" > "help me write an email".',
          'Research queries: "What has John said about the pricing discussion?" — AI searches your messages.',
          'Chain commands: "Summarize the overdue tasks, then draft a message to each assignee for an update."',
          'Section awareness: in Decisions & Tasks, the assistant loads your decisions and tasks automatically.',
          'Session memory: chat history persists across sections — start in Email, continue in Tasks seamlessly.',
        ],
      },
    ],
    badge: 'Updated',
  },

  // ── 13. CRM ────────────────────────────────────────────────────────────────
  {
    id: 'crm',
    title: 'CRM Integrations',
    icon: '🔗',
    summary: 'Two-way sync with HubSpot, Salesforce, Pipedrive, or Zoho — contacts, deals, tasks, and activities stay in sync automatically.',
    steps: [
      'Go to Settings → Connected Accounts → CRM.',
      'Click Connect next to your CRM and sign in with your CRM credentials.',
      'Grant read and write permissions — Pulse runs an initial sync (may take a few minutes).',
      'Open any contact in Pulse to see their CRM deals, pipeline stage, and activity history.',
      'Go to Settings → Connected Accounts → CRM → Sync Settings to control what syncs.',
      'Click Sync Now to force an immediate sync, or check for errors in the sync panel.',
    ],
    subsections: [
      {
        id: 'crm-two-way-sync',
        title: 'Two-Way Data Sync',
        steps: [
          'CRM → Pulse: new contacts, updated deal stages, CRM notes appear in Pulse automatically.',
          'Pulse → CRM: messages, tasks, and calls logged in Pulse create activities in the CRM.',
          'Deal data appears in the side panel when composing a message to a CRM contact.',
          'Tasks created in Pulse can sync back to the CRM as activities.',
        ],
      },
      {
        id: 'crm-sync-settings',
        title: 'Sync Settings',
        steps: [
          'Go to Settings → Connected Accounts → CRM → Sync Settings.',
          'Toggle individual data types: contacts, deals, tasks, calls.',
          'Set sync frequency: Real-time, Every 15 minutes, or Daily.',
          'Error messages in the sync panel describe exactly what failed.',
        ],
      },
    ],
    tables: [
      {
        title: 'CRM Integration Coverage',
        columns: ['CRM', 'What Syncs'],
        rows: [
          ['HubSpot', 'Contacts, Deals, Tasks, Calls, Notes'],
          ['Salesforce', 'Contacts, Opportunities, Activities, Leads, Cases'],
          ['Pipedrive', 'Contacts, Deals, Activities, Notes'],
          ['Zoho CRM', 'Contacts, Deals, Tasks, Calls, Notes'],
        ],
      },
    ],
    tips: [
      'Two-way sync means changes in either system flow both ways — no manual data entry between tools.',
      'Set sync frequency to Real-time for sales teams who need instant CRM updates.',
      'Messages and calls logged in Pulse create activity timeline entries in the CRM automatically.',
    ],
    useCases: [
      {
        id: 'uc-crm-sales-team',
        title: 'Keeping HubSpot and Pulse in Sync for a Sales Team',
        scenario: 'Your sales team uses HubSpot for CRM but Pulse for daily communication.',
        steps: [
          'Connect HubSpot in Settings — contacts and deals sync immediately.',
          'Every contact shows their HubSpot deal stage directly in their Pulse profile.',
          'Sales reps compose emails in Pulse — emails log automatically to HubSpot\'s activity timeline.',
          'When a rep creates a task in Pulse, it syncs to HubSpot as a CRM activity.',
          'When a deal stage changes in HubSpot, the contact\'s Pulse profile updates automatically.',
        ],
      },
    ],
  },

  // ── 14. ANALYTICS ─────────────────────────────────────────────────────────
  {
    id: 'analytics',
    title: 'Analytics',
    icon: '📊',
    summary: 'Communication analytics, relationship health, team health, task completion, predictions, conflicts, kudos, and exportable reports.',
    steps: [
      'Click Analytics in the sidebar.',
      'Review Message Analytics: volume, response rates, and busiest communication hours.',
      'Check Relationship Health to see which contacts are active vs. going cold.',
      'Review Team Communication Health for cross-team collaboration patterns.',
      'Check Task Completion Rates: on-time percentage and trends by team member.',
      'Read AI Predictions for forward-looking alerts.',
      'Export any report as PDF, CSV, or Excel from the Export button.',
    ],
    subsections: [
      {
        id: 'message-analytics',
        title: 'Message Analytics',
        steps: [
          'Total message volume over time (daily, weekly, monthly).',
          'Average response time — how quickly you reply to messages.',
          'Busiest communication hours in your day.',
          'Most active conversations and channels.',
        ],
      },
      {
        id: 'relationship-health',
        title: 'Relationship Health',
        steps: [
          'Contact relationship scores across your entire network.',
          'Contacts with declining engagement — relationships going cold.',
          'Top relationships by interaction frequency.',
          'Network health trend over time.',
        ],
      },
      {
        id: 'team-health',
        title: 'Team Communication Health',
        steps: [
          'Team-wide message volume and trends.',
          'Cross-team communication patterns — who talks to whom.',
          'Response time by team member.',
          'Collaboration density visualization.',
        ],
      },
      {
        id: 'predictions',
        title: 'AI Predictions',
        steps: [
          '"Based on current pace, you\'ll miss the March deadline for Project X."',
          '"Response rates are declining with Client Y — consider a personal outreach."',
          'Predictions are based on historical patterns and current trajectory.',
        ],
      },
      {
        id: 'conflicts-kudos',
        title: 'Conflicts & Kudos Views',
        steps: [
          'Conflicts View — scheduling conflicts, overlapping task deadlines, competing priorities.',
          'Kudos View — team recognition sent and received, morale indicators, top contributors.',
        ],
      },
    ],
    tips: [
      'Use Team Communication Health monthly to spot bottlenecks and redistribute workload.',
      'Schedule weekly analytics digests to your email from the Export settings.',
      'Relationship Health below 40 for a key contact is your signal to reach out before the relationship fades.',
    ],
    useCases: [
      {
        id: 'uc-monthly-review',
        title: 'Monthly Manager Communication Review',
        scenario: 'You\'re a team manager preparing for your monthly review meeting.',
        steps: [
          'Open Analytics → Team Communication Health — review team message volume and response times.',
          'Open Task Completion Rates — see which team members are on-time vs. behind.',
          'Open Relationship Health — check if any key client relationships are going cold.',
          'Export a PDF report of all three views.',
          'Share the report in your monthly team meeting as a performance dashboard.',
          'Use the data to identify bottlenecks: one team member has 90% of tasks — redistribute.',
        ],
      },
    ],
  },

  // ── 15. TOOLS ─────────────────────────────────────────────────────────────
  {
    id: 'tools',
    title: 'Tools Panel',
    icon: '🛠️',
    summary: 'Automation rules, bulk operations, webhook manager, AI Lab, and AI War Room — power features for advanced workflows.',
    steps: [
      'Click Tools in the sidebar to access the Tools Panel.',
      'Use Automation Rules to create trigger-action rules that run automatically.',
      'Use Bulk Operations to apply actions to many messages or contacts at once.',
      'Use Webhook Manager to send Pulse events to external systems via HTTP.',
      'Access AI Lab for the full brainstorming workspace.',
      'Access AI War Room for multi-model collaborative analysis.',
    ],
    subsections: [
      {
        id: 'automation-rules',
        title: 'Automation Rules',
        steps: [
          'Click Tools → Automation Rules → New Rule.',
          'Name your rule.',
          'Set a Trigger: message received, email with keyword, task due in X days, new contact added.',
          'Set one or more Actions: move to folder, apply label, send notification, create task, forward, send webhook.',
          'Click Save Rule — it runs automatically from this moment on.',
        ],
      },
      {
        id: 'webhook-manager',
        title: 'Webhook Manager',
        steps: [
          'Click Tools → Webhook Manager → New Webhook.',
          'Enter a destination URL (your external system\'s webhook endpoint).',
          'Select which Pulse events trigger it: new message, task changed, decision finalized, new contact.',
          'Click Save.',
          'Click Test to send a sample payload and verify the connection.',
        ],
      },
    ],
    tables: [
      {
        title: 'Example Automation Rules',
        columns: ['Rule Name', 'Trigger', 'Action'],
        rows: [
          ['Client email prioritizer', 'Email from @clientdomain.com', 'Label "Client" + Move to Priority'],
          ['Invoice alert', 'Email subject contains "Invoice"', 'Create task "Review invoice" + notify finance'],
          ['Task deadline reminder', 'Task due in 2 days', 'Send notification to assignee'],
          ['New lead welcome', 'New contact tagged "Lead"', 'Send welcome message template'],
        ],
      },
    ],
    tips: [
      'Automation rules run silently in the background — set them once and forget them.',
      'Combine a New Contact trigger with a webhook to start your external onboarding workflow automatically.',
      'Webhook Manager works with any system that has an HTTP endpoint: Zapier, n8n, custom APIs.',
    ],
    useCases: [
      {
        id: 'uc-client-onboarding',
        title: 'Automating Client Onboarding',
        scenario: 'When a new client is added to Pulse, you want a series of actions to trigger automatically.',
        steps: [
          'Create Automation Rule 1: Trigger = New contact tagged "Client" → Create task "Send welcome email" assigned to account manager.',
          'Create Automation Rule 2: Trigger = New contact tagged "Client" → Send webhook to your onboarding CRM.',
          'Result: Adding a new client triggers your entire onboarding process — zero manual steps.',
        ],
      },
    ],
  },

  // ── 16. SEARCH ────────────────────────────────────────────────────────────
  {
    id: 'search',
    title: 'Search',
    icon: '🔍',
    summary: 'Unified search across every channel — messages, email, contacts, tasks, decisions, calendar, and Voxer transcripts — with natural language, filters, saved searches, and alerts.',
    steps: [
      'Press Ctrl+K (or Cmd+K on Mac) to open search from anywhere in Pulse.',
      'Type any keyword, name, or phrase — results appear from all sources simultaneously.',
      'Click Filter to narrow by: source, date range, sender, recipient.',
      'Use natural language: "emails from John last Tuesday about the proposal".',
      'Click Save Search to save a query — access saved searches from the search bar dropdown.',
      'Click Set Alert on any search to be notified when new results match it.',
    ],
    subsections: [
      {
        id: 'search-syntax',
        title: 'Advanced Search Syntax',
        steps: [
          '"exact phrase" — finds only that exact phrase.',
          'from:Name — messages or emails sent by Name.',
          'to:Name — messages sent to Name.',
          'after:2026-01-01 — content created after that date.',
          'before:2026-03-01 — content created before that date.',
          'type:email — email results only.',
          'type:task — tasks only.',
          'type:message — messages only.',
          '#tag — content with that label or tag.',
          'has:attachment — emails or messages with file attachments.',
        ],
      },
      {
        id: 'saved-searches',
        title: 'Saved Searches & Alerts',
        steps: [
          'Run a search, apply your filters, then click Save Search.',
          'Name the saved search (e.g., "Unread emails from clients this week").',
          'Access saved searches from the search bar dropdown.',
          'Click Set Alert on any search to be notified when new matching results appear.',
          'Alert delivery options: Real-time, Daily digest, or Weekly digest.',
        ],
      },
    ],
    tables: [
      {
        title: 'Search Query Reference',
        columns: ['Query', 'What it finds'],
        rows: [
          ['"quarterly review"', 'Only results with that exact phrase'],
          ['from:John', 'Messages or emails sent by John'],
          ['to:sarah', 'Messages sent to Sarah'],
          ['after:2026-01-01', 'Content created after that date'],
          ['type:email', 'Email results only'],
          ['type:task', 'Tasks only'],
          ['#client', 'Content with the "client" label'],
          ['has:attachment', 'Emails/messages with file attachments'],
        ],
      },
    ],
    tips: [
      'Search covers SMS, Email, Messages, Contacts, Tasks, Calendar, and Voxer transcripts simultaneously.',
      'Natural language works: "messages from David last week about the proposal" — Pulse understands intent.',
      'Set a search alert for "from:bigclient.com" — be notified instantly when your key client emails you.',
    ],
  },

  // ── 17. SETTINGS ─────────────────────────────────────────────────────────
  {
    id: 'settings',
    title: 'Settings & Customization',
    icon: '⚙️',
    summary: 'Appearance, accessibility, AI model configuration, War Room, notification preferences, connected accounts, Features & Labs, workspace management, API keys, privacy controls, and data export.',
    steps: [
      'Click the gear icon at the bottom of the sidebar, or click your avatar → Settings.',
      'Go to Appearance to toggle Dark Mode, choose an accent color (7 brand presets or custom hex), set font size, and toggle High Contrast or Reduced Motion.',
      'Go to AI & Intelligence to choose your AI model, configure voice agent behavior, and select microphone and speaker devices.',
      'Go to War Room to set the default mode, AI depth, and streaming behavior.',
      'Go to Notifications to configure per-channel alert preferences and Quiet Hours.',
      'Go to Connected Accounts to add or remove Google, Microsoft, Slack, CRM, and SMS.',
      'Go to Features & Labs to enable or disable individual features and toggle Advanced Mode.',
      'Go to Privacy to control online status, read receipts, and data retention.',
      'Go to Data Management to export or delete your data.',
    ],
    subsections: [
      {
        id: 'appearance',
        title: 'Appearance & Accessibility',
        steps: [
          'Toggle Dark Mode — applies immediately across all of Pulse.',
          'Choose an Accent Color: 7 brand presets (Pulse Rose, Pulse Pink, Heartbeat Coral, Vision Purple, Entomate Teal, Ocean Blue, Warm Amber) or enter a custom hex code.',
          'Choose Font Size: Small, Default, or Large.',
          'Toggle High Contrast for sharper text separation on all backgrounds.',
          'Toggle Reduced Motion to minimize animations throughout the app.',
        ],
      },
      {
        id: 'ai-intelligence',
        title: 'AI & Intelligence',
        description: 'Configure the AI engine that powers your Pulse workspace — model selection, voice agent, and device setup.',
        steps: [
          'Go to Settings → AI & Intelligence.',
          'Under AI Model, choose your primary model (e.g., Gemini Flash for speed, or a deeper reasoning model for complex tasks).',
          'Toggle Advanced Reasoning to have the AI think longer before answering complex questions.',
          'Under Voice Agent, configure: agent voice character, turn detection mode (Semantic or Server VAD), voice activity eagerness, and interaction mode (VAD or Push-to-Talk).',
          'Under Knowledge Base, set your default search scope and toggle automatic document analysis.',
          'Under Devices, select your preferred microphone, speaker, and camera. Use Test Devices to confirm hardware.',
          'Enable Quota Notifications to get an alert when your AI quota recovers or fallback mode activates.',
        ],
        note: 'The AI Health Monitor at the top of this page shows real-time status of all AI services.',
      },
      {
        id: 'war-room-settings',
        title: 'War Room Settings',
        steps: [
          'Go to Settings → War Room.',
          'Set Default Mode — the view that opens when you launch War Room.',
          'Set AI Depth: Fast (quick answers), Balanced (default), or Deep (thorough multi-step reasoning).',
          'Toggle Token Streaming to see responses appear word-by-word rather than waiting for the full response.',
          'Toggle Thinking Panel to show or hide the AI\'s internal reasoning steps.',
          'Toggle Annotations to enable inline notes and highlights on War Room documents.',
        ],
      },
      {
        id: 'notifications',
        title: 'Notification Preferences',
        steps: [
          'For each channel (Messages, Email, Voxer, Tasks, Decisions) choose: All Notifications, Mentions Only, or Off.',
          'Set Quiet Hours — a time range with zero notifications (e.g., 10 PM to 7 AM).',
          'Toggle Sound on/off for desktop notifications.',
          'Choose delivery: in-app only, or in-app + email digest.',
        ],
      },
      {
        id: 'activity-monitor',
        title: 'Activity Monitor & Presence',
        steps: [
          'Go to Settings → Activity Monitor.',
          'Toggle Live Presence to show or hide your online status from teammates.',
          'Toggle Leaderboard Participation to include or exclude your activity from the workspace leaderboard.',
          'Set your Activity Data Retention period: 30, 60, or 90 days.',
        ],
        note: 'Admins see a full workspace-wide Activity Monitor under Settings → Admin Dashboard.',
      },
      {
        id: 'features-labs',
        title: 'Features & Labs',
        steps: [
          'Go to Settings → Features & Labs.',
          'Toggle Advanced Mode to instantly enable all advanced and experimental features.',
          'Scroll through feature categories and toggle individual features on or off. Changes apply immediately.',
        ],
        note: 'If a documented feature isn\'t visible, check here — it may be toggled off.',
      },
      {
        id: 'workspace-settings',
        title: 'Workspace Settings (Admins)',
        steps: [
          'Go to Settings → Workspace.',
          'Manage workspace name and logo.',
          'Member list — invite, remove, or change roles: Owner, Admin, Member, Guest.',
          'Role permissions — control what each role can see and do.',
          'Data retention policies — configure how long messages and data are stored.',
          'Security — enable SSO (SAML 2.0, Google Workspace, Microsoft Entra, Okta).',
        ],
      },
      {
        id: 'admin-activity-monitor',
        title: 'Admin Dashboard & Activity Monitor',
        description: 'Workspace admins have access to a full Admin Dashboard with six tabs, including the live Activity Monitor.',
        steps: [
          'Click Settings → Admin Dashboard (visible to Admin and Owner roles only).',
          'Click the Activity tab to open the real-time Activity Monitor.',
          'Five header KPIs: Total Users, Online Now, Away/Busy, New This Week, Messages Sent (7-day).',
          'Live Presence Panel — lists all users sorted by status (online first). Updates every 30 seconds and instantly on status change.',
          'Recent Signups Panel — shows users who joined in the last 24 hours and the last 7 days.',
          'Message Leaderboard — ranks users by messages sent in the past 7 days with a visual bar chart.',
          'Event Feed — live log of the 40 most recent admin actions (logins, role changes, deletions, setting updates) with timestamps.',
        ],
        note: 'The Activity Monitor refreshes automatically every 30 seconds — no page reload needed.',
      },
      {
        id: 'api-keys',
        title: 'API Keys',
        steps: [
          'Go to Settings → API Keys → Generate New Key.',
          'Name the key (e.g., "Zapier integration") and set permissions: read-only or read-write.',
          'Copy the key — it is shown only once. Store it securely.',
          'Keys can be revoked at any time from the same screen.',
        ],
      },
      {
        id: 'privacy',
        title: 'Privacy Controls',
        steps: [
          'Online Status — control who can see when you\'re active.',
          'Read Receipts — toggle whether sent receipts are shared.',
          'Data Retention — set how long your messages are stored (7 days to indefinitely).',
          'Analytics Opt-out — opt out of usage analytics.',
        ],
      },
      {
        id: 'data-export',
        title: 'Exporting Your Data',
        steps: [
          'Go to Settings → Data Management → Export My Data.',
          'Choose what to include: messages, contacts, tasks, calendar, decisions.',
          'Choose format: JSON (full) or CSV (contacts and tasks only).',
          'Download the export file within 24 hours of the request.',
        ],
      },
    ],
    tables: [
      {
        title: 'Connected Accounts',
        columns: ['Account', 'What it connects'],
        rows: [
          ['Google', 'Gmail, Google Calendar, Google Contacts'],
          ['Microsoft', 'Outlook, MS Calendar, MS Contacts'],
          ['Slack', 'Slack messages in your Unified Inbox'],
          ['HubSpot', 'CRM contacts, deals, and activities'],
          ['Salesforce', 'CRM contacts, opportunities, and leads'],
          ['Pipedrive', 'CRM contacts and deals'],
          ['Zoho CRM', 'CRM contacts, deals, and tasks'],
          ['SMS', 'Text messaging via your verified phone number'],
        ],
      },
      {
        title: 'Workspace Roles',
        columns: ['Role', 'What they can do'],
        rows: [
          ['Owner', 'Full access, billing management, can delete workspace'],
          ['Admin', 'Member management, settings, no billing access'],
          ['Member', 'Standard access to all features'],
          ['Guest', 'Limited access, cannot see internal team messages'],
        ],
      },
    ],
    tips: [
      'Choose 7 brand accent color presets or enter any custom hex code to match your personal or company style.',
      'Use Settings → AI & Intelligence to pick your AI model and configure the Voice Agent — different voices and turn-detection modes feel very different in practice.',
      'Settings → Features & Labs lets you enable or disable any individual feature. If something is missing, check here first.',
      'Quiet Hours prevents all notifications during your chosen hours — critical for work-life balance.',
      'Generate scoped API keys (read-only vs. read-write) and revoke them individually at any time.',
      'Admins: the Activity Monitor tab gives you a live view of who is online, new signups, and recent admin events — no page reload needed.',
    ],
    badge: 'Updated',
  },

  // ── 18. MOBILE ────────────────────────────────────────────────────────────
  {
    id: 'mobile',
    title: 'Mobile & Desktop Apps',
    icon: '📲',
    badge: 'Updated',
    summary: 'Pulse runs on Windows (desktop installer), Android (mobile), and any web browser. Everything syncs instantly across all platforms.',
    steps: [
      'Windows Desktop: visit the Pulse website → Downloads → Windows PC → run the .exe installer.',
      'Android: open Google Play Store → search Pulse → tap Install.',
      'Sign in with your existing Pulse account on any platform — your workspace syncs instantly.',
      'Grant required permissions on mobile: notifications, microphone (Voxer), camera (Video Vox, card scanning).',
      'Enable Biometric Login on Android: Settings → Security → Biometric Login.',
      'Add the Android home screen widget for quick stats and message preview.',
    ],
    subsections: [
      {
        id: 'windows-desktop',
        title: 'Windows Desktop App',
        steps: [
          'Go to the Pulse website and click Downloads in the top navigation.',
          'Click Download Desktop Installer under Windows PC.',
          'Run the downloaded .exe file and follow the installer prompts.',
          'Open Pulse from your Start menu or desktop shortcut.',
          'Sign in — your full workspace loads automatically.',
          'The desktop app runs natively: persistent notifications, faster load times, and a dedicated window.',
        ],
      },
      {
        id: 'mobile-features',
        title: 'Android Mobile Features',
        steps: [
          'Push Notifications — instant alerts for messages, tasks, and events even when the app is closed.',
          'Business Card Scanner — tap the camera icon in Contacts to scan a card and create a contact instantly.',
          'Biometric Login — fingerprint or face ID instead of a password.',
          'Camera Integration — attach photos directly from your camera in any message or email.',
          'Home Screen Widget — quick stats, unread count, and message preview without opening the app.',
          'Quick Reply — reply to Pulse notifications directly from the Android notification shade.',
        ],
      },
      {
        id: 'offline-mode',
        title: 'Offline Mode',
        steps: [
          'Read cached messages and emails without an internet connection.',
          'Draft messages and emails offline — they send automatically when you reconnect.',
          'Tasks and contacts are cached for offline viewing.',
          'The app shows an Offline banner when it can\'t reach the server.',
          'Open Pulse before entering an area with poor signal to pre-cache your latest data.',
        ],
      },
      {
        id: 'mobile-notifications',
        title: 'Managing Mobile Notifications',
        steps: [
          'Open Settings → Notifications in the app.',
          'Toggle individual notification types on or off.',
          'Set Quiet Hours to avoid notifications during sleep or focused work.',
          'Long-press a Pulse notification → Notification Preferences to configure sound, vibration, and urgency per type.',
        ],
      },
    ],
    tips: [
      'The Windows desktop app gives you native notifications and a persistent window separate from your browser.',
      'Open Pulse before going into an area with poor signal — it pre-caches your latest data for offline reading.',
      'Use Quick Vox on mobile for fast voice replies — much faster than typing on a small keyboard.',
      'Set Quiet Hours in the mobile app to avoid late-night notifications.',
    ],
    useCases: [
      {
        id: 'uc-on-the-go',
        title: 'Staying Responsive While Traveling',
        scenario: 'You\'re traveling all day but need to stay on top of critical communications.',
        steps: [
          'Enable push notifications for Mentions Only in Messages and All for Email from key contacts (via filters).',
          'Use Voxer Quick Vox on mobile for fast replies — faster than typing.',
          'Use AI Smart Compose on mobile to draft email replies quickly with one tap.',
          'When in a meeting, enable Do Not Disturb mode — only urgent items get through.',
          'Review your Pulse widget on your home screen during breaks for a 5-second status check.',
        ],
      },
    ],
  },

  // ── 19. KEYBOARD SHORTCUTS ────────────────────────────────────────────────
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    icon: '⌨️',
    summary: 'Every keyboard shortcut in Pulse — navigation, messaging, email, calendar, Voxer, and search.',
    steps: [
      'Press ? in any section to see context-specific keyboard shortcuts for that section.',
      'All shortcuts listed below work on Windows (Ctrl) and Mac (Cmd) unless otherwise noted.',
    ],
    tables: [
      {
        title: 'Global Shortcuts',
        columns: ['Shortcut', 'Action'],
        rows: [
          ['Ctrl+K / ⌘K', 'Open unified search'],
          ['Ctrl+/ / ⌘/', 'Toggle Pulse AI Assistant'],
          ['Ctrl+Shift+P', 'Open command palette'],
          ['Esc', 'Close any open modal or panel'],
          ['?', 'Show contextual shortcut help'],
        ],
      },
      {
        title: 'Navigation (Go to...)',
        columns: ['Shortcut', 'Destination'],
        rows: [
          ['G then D', 'Dashboard'],
          ['G then M', 'Messages'],
          ['G then E', 'Email'],
          ['G then S', 'SMS'],
          ['G then V', 'Voxer'],
          ['G then C', 'Calendar'],
          ['G then N', 'Meetings'],
          ['G then P', 'Contacts'],
          ['G then T', 'Tasks / Decisions'],
          ['G then A', 'Analytics'],
        ],
      },
      {
        title: 'Messaging',
        columns: ['Shortcut', 'Action'],
        rows: [
          ['Enter', 'Send message'],
          ['Shift+Enter', 'New line without sending'],
          ['Ctrl+B / ⌘B', 'Bold text'],
          ['Ctrl+I / ⌘I', 'Italic text'],
          ['Ctrl+U / ⌘U', 'Underline text'],
          ['↑ (Up arrow)', 'Edit your last sent message'],
          ['/', 'Open Inline Tools menu'],
          ['@', 'Open @mention picker'],
        ],
      },
      {
        title: 'Email',
        columns: ['Shortcut', 'Action'],
        rows: [
          ['C', 'Compose new email'],
          ['R', 'Reply to selected email'],
          ['F', 'Forward selected email'],
          ['E', 'Archive selected email'],
          ['#', 'Delete selected email'],
          ['U', 'Mark as unread'],
          ['S', 'Star / flag'],
        ],
      },
      {
        title: 'Calendar',
        columns: ['Shortcut', 'Action'],
        rows: [
          ['T', 'Jump to Today'],
          ['D', 'Day view'],
          ['W', 'Week view'],
          ['M', 'Month view'],
          ['N', 'New event'],
          ['← / →', 'Previous / next period'],
        ],
      },
      {
        title: 'Voxer',
        columns: ['Shortcut', 'Action'],
        rows: [
          ['Space', 'Toggle recording (when not typing)'],
          ['Escape', 'Stop recording / cancel'],
          ['1–8', 'Switch Voxer mode (1=Classic, 2=Radio, 3=Threads, 4=Team, 5=Notes, 6=Quick, 7=Drop, 8=Video)'],
          ['Ctrl+S', 'AI Summarize conversation'],
          ['Ctrl+A', 'Enter selection mode'],
          ['Ctrl+D', 'Download selected message'],
          ['?', 'Show Voxer shortcuts'],
        ],
      },
    ],
    tips: [
      'G + letter shortcuts work from anywhere in Pulse — you don\'t need to click the sidebar.',
      'Press Ctrl+/ to toggle the AI Assistant open and closed without taking your hands off the keyboard.',
      'In Voxer, press Space to start/stop recording — keep your hands ready to type a follow-up.',
    ],
  },

  // ── 20. TROUBLESHOOTING ───────────────────────────────────────────────────
  {
    id: 'troubleshooting',
    title: 'Troubleshooting & FAQ',
    icon: '🛟',
    summary: 'Common issues and fixes — messages, email sync, notifications, Voxer audio, calendar, CRM, and account questions.',
    steps: [
      'For any issue: first try refreshing the page (F5), then log out and log back in.',
      'For sync issues: go to Settings → Connected Accounts, check the connection status, and click Reconnect.',
      'For performance issues: close unused browser tabs and disable browser extensions temporarily.',
      'For persistent issues: report a bug via Settings → Help & Support → Report a Bug.',
    ],
    subsections: [
      {
        id: 'messages-not-loading',
        title: 'Messages aren\'t loading',
        steps: [
          'Check your internet connection — try opening another website.',
          'Refresh the page: F5 or Ctrl+R.',
          'Log out and log back in.',
          'Clear your browser cache: Ctrl+Shift+R (hard refresh).',
          'Try a different browser — Chrome is recommended.',
          'If it continues, check the Pulse status page.',
        ],
      },
      {
        id: 'email-not-syncing',
        title: 'Email isn\'t syncing',
        steps: [
          'Go to Settings → Connected Accounts → Email.',
          'Check the sync status — it should say "Connected."',
          'If it shows Error or Disconnected, click Reconnect.',
          'Re-authenticate with your Google or Microsoft account — do not skip any permission dialog.',
          'If reconnecting fails, disconnect fully, wait 30 seconds, then reconnect from scratch.',
        ],
      },
      {
        id: 'no-notifications',
        title: 'Not receiving notifications',
        steps: [
          'Go to Settings → Notifications — verify notifications are enabled for the relevant channel.',
          'Check that your browser allows notifications: address bar → Site settings → Notifications → Allow.',
          'Check that Quiet Hours aren\'t active during the time you expect notifications.',
          'On mobile: System Settings → Apps → Pulse → Notifications → ensure they\'re enabled.',
        ],
      },
      {
        id: 'voxer-audio',
        title: 'Can\'t hear Voxer messages',
        steps: [
          'Check that your device volume is not muted.',
          'Check browser audio/microphone permissions: address bar → Site settings → Microphone → Allow.',
          'Try a different browser — Chrome is recommended.',
          'Close other browser tabs that may be using the microphone.',
          'On Windows: Settings → Privacy → Microphone → ensure your browser is allowed.',
        ],
      },
      {
        id: 'calendar-issues',
        title: 'Calendar events not showing',
        steps: [
          'Go to Settings → Connected Accounts → Calendar — confirm your calendar is connected.',
          'Click Sync Now to force an immediate sync.',
          'Check that you\'re viewing the correct calendar — click the calendar filter.',
          'Make sure no calendars are hidden in the view filter.',
        ],
      },
      {
        id: 'duplicate-contacts',
        title: 'A contact appears twice',
        steps: [
          'Go to Contacts → Tools → Find Duplicates.',
          'Locate the duplicate pair and click Merge.',
          'Data from both records is preserved in the merged profile.',
        ],
      },
      {
        id: 'delete-account',
        title: 'How to delete your account',
        steps: [
          'Export your data first: Settings → Data Management → Export My Data.',
          'Go to Settings → Data Management → Delete Account.',
          'Type DELETE to confirm.',
          'Your account and all data are permanently deleted within 30 days.',
        ],
        note: 'Warning: Deleting your account is permanent and cannot be undone.',
      },
      {
        id: 'get-help',
        title: 'Getting Help',
        steps: [
          'Click the ? icon in the sidebar for in-app contextual help.',
          'Go to Settings → Help & Support → Contact Support to email the support team.',
          'Go to Settings → Help & Support → Report a Bug to submit a bug report.',
          'When reporting a bug, include: what happened, what you expected, and a screenshot if possible.',
        ],
      },
    ],
    advanced: [
      {
        id: 'adv-performance',
        title: 'Performance & Slow Loading',
        items: [
          'Pulse works best with at least 4 GB RAM available to the browser. Close unused tabs.',
          'Some browser extensions (ad blockers, VPNs) interfere with real-time updates. Try disabling them.',
          'Opening conversations with many large attachments can slow loading — download and remove attachments.',
          'A VPN with high latency can cause delays. Try disabling the VPN temporarily.',
          'Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac) clears cached resources.',
        ],
      },
      {
        id: 'adv-security-faq',
        title: 'Security & Privacy FAQ',
        items: [
          'Data storage: Pulse data is stored in PostgreSQL (Supabase) with encryption at rest (AES-256) and in transit (TLS).',
          'Employee access: Pulse support staff cannot read your message content — only metadata, and only with your explicit written consent.',
          'Old data: Settings → Privacy → Data Retention for automatic deletion, or Settings → Data Management → Delete Specific Data.',
          'SSO: Enterprise workspaces can configure SAML 2.0, Google Workspace, Microsoft Entra, or Okta.',
          'Two-Factor Authentication: Settings → Security → 2FA. Strongly recommended for all users.',
        ],
      },
    ],
    tips: [
      'Always try a hard refresh (Ctrl+Shift+R) before reporting a bug — it clears stale cached assets.',
      'Export your data before contacting support so you have a local backup: Settings → Data Management → Export.',
      'The in-app Help & Support chat connects you directly to the Pulse team during business hours.',
    ],
  },
];

export const guideVersion = '25.1.1';
export const guideUpdated = 'March 5, 2026';
