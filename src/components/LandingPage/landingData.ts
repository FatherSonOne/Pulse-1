// ── Landing Page Static Data ──────────────────────────────────────────────────
// Extracted from the god component to keep LandingPage.tsx focused on rendering.

export const STATS = [
  { value: '8', label: 'Voice Modes' },
  { value: '7+', label: 'AI Models' },
  { value: '4', label: 'CRM Integrations' },
  { value: '8', label: 'War Room Commands' },
  { value: '5', label: 'Platform Syncs' },
  { value: '12', label: 'Archive Types' },
  { value: '14', label: 'Settings Panels' },
];

export const VOX_MODES = [
  { icon: 'fa-solid fa-wave-square', name: 'Classic Voxer', desc: 'Push-to-talk voice with waveform visualization and playback controls' },
  { icon: 'fa-solid fa-bolt', name: 'Quick Vox', desc: 'One-tap record and send — the fastest way to drop a voice note' },
  { icon: 'fa-solid fa-users', name: 'Team Vox', desc: 'Channel-based voice threads with @mentions and group transcription' },
  { icon: 'fa-solid fa-clock', name: 'Vox Drop', desc: 'Schedule voice messages to deliver at the perfect moment' },
  { icon: 'fa-solid fa-note-sticky', name: 'Vox Notes', desc: 'Personal voice journaling with AI summary and keyword extraction' },
  { icon: 'fa-solid fa-video', name: 'Video Vox', desc: 'Async video messages with face-cam and screen recording' },
  { icon: 'fa-solid fa-radio', name: 'Pulse Radio', desc: 'Live broadcast mode — stream to your entire team simultaneously' },
  { icon: 'fa-solid fa-comments', name: 'Voice Threads', desc: 'Async threaded voice conversations — reply on your schedule, stay in context' },
];

export const CRM_PLATFORMS = [
  { name: 'HubSpot', color: '#f97316', icon: 'fa-brands fa-hubspot', desc: 'Bi-directional sync: tasks, deals, calls, contacts' },
  { name: 'Salesforce', color: '#00a1e0', icon: 'fa-solid fa-cloud', desc: 'SOQL queries, opportunities, activities, leads' },
  { name: 'Pipedrive', color: '#28a745', icon: 'fa-solid fa-filter', desc: 'Activities, deals, persons, organization tracking' },
  { name: 'Zoho CRM', color: '#e42527', icon: 'fa-solid fa-database', desc: 'Full CRUD: tasks, deals, contacts, calls' },
];

export const PLATFORMS = [
  { name: 'Slack', icon: 'fa-brands fa-slack', color: '#E01E5A' },
  { name: 'Gmail', icon: 'fa-brands fa-google', color: '#EA4335' },
  { name: 'Teams', icon: 'fa-brands fa-microsoft', color: '#6264A7' },
  { name: 'Outlook', icon: 'fa-brands fa-microsoft', color: '#0078D4' },
  { name: 'Zoom', icon: 'fa-solid fa-video', color: '#2D8CFF' },
  { name: 'HubSpot', icon: 'fa-brands fa-hubspot', color: '#f97316' },
  { name: 'Salesforce', icon: 'fa-solid fa-cloud', color: '#00a1e0' },
  { name: 'Pipedrive', icon: 'fa-solid fa-filter', color: '#28a745' },
  { name: 'Zoho', icon: 'fa-solid fa-database', color: '#e42527' },
  { name: 'G Meet', icon: 'fa-brands fa-google', color: '#00897B' },
];

export const FAQ_DATA = [
  { q: "What is Pulse?", a: "Pulse is an AI-powered communication and productivity platform that combines messaging, email, voice (Voxer), calendar, contacts with CRM intelligence, an AI research studio, and analytics — all in one interface. Built for high-performance teams." },
  { q: "What AI models does Pulse support?", a: "Pulse integrates multiple AI providers: Google Gemini (primary, with built-in web search grounding), Anthropic Claude, OpenAI GPT-4, ElevenLabs for voice synthesis, OpenAI Whisper and AssemblyAI for transcription. You can switch between models in Settings → AI & Intelligence." },
  { q: "What is the War Room?", a: "The War Room is your AI command center — a research and strategy workspace with 8 slash commands (/brainstorm, /decide, /analyze, /summarize, /plan, /debrief, /risks, /compare), 4 specialized AI agents, RAG document intelligence, voice agent, and session management. Upload your docs and get context-aware AI responses." },
  { q: "What are the 8 Voxer modes?", a: "Classic Voxer (push-to-talk), Quick Vox (one-tap record), Team Vox (channel-based with @mentions), Vox Drop (scheduled delivery), Vox Notes (voice journaling), Video Vox (async video messages), Pulse Radio (live broadcast), and Voice Threads (async threaded conversations). All modes include AI transcription." },
  { q: "Which CRM platforms does Pulse integrate with?", a: "Pulse offers 4 native CRM integrations: HubSpot, Salesforce, Pipedrive, and Zoho CRM. Additionally, Pulse includes Logos Vision — a built-in relationship intelligence system with 0-100 health scoring and bidirectional sync." },
  { q: "What platforms are in the Unified Inbox?", a: "Pulse syncs with Gmail, Slack, Microsoft Outlook/Teams, Zoom, and Google Meet. Each platform connects via OAuth in Settings → Integrations." },
  { q: "Is my data encrypted?", a: "Yes. Pulse stores all data with AES-256 encryption at rest and TLS in transit. Support staff cannot read your message content — only metadata, with your explicit written consent." },
  { q: "What devices is Pulse available on?", a: "Pulse is available as a web app (any browser), Windows desktop app (installer or portable), and Android (Google Play Store or direct APK). iOS and macOS apps are coming soon." },
];

export const SHORTCUT_GROUPS = [
  { label: 'Global', icon: 'fa-solid fa-globe', shortcuts: [
    { keys: ['Ctrl', 'K'], desc: 'Unified search' },
    { keys: ['Ctrl', '/'], desc: 'Pulse AI Assistant' },
    { keys: ['Ctrl', 'Shift', 'P'], desc: 'Command palette' },
    { keys: ['Esc'], desc: 'Close modal / panel' },
    { keys: ['?'], desc: 'Contextual help' },
  ]},
  { label: 'Navigate', icon: 'fa-solid fa-compass', shortcuts: [
    { keys: ['G', 'D'], desc: 'Dashboard' },
    { keys: ['G', 'M'], desc: 'Messages' },
    { keys: ['G', 'E'], desc: 'Email' },
    { keys: ['G', 'V'], desc: 'Voxer' },
    { keys: ['G', 'C'], desc: 'Calendar' },
    { keys: ['G', 'T'], desc: 'Contacts' },
  ]},
  { label: 'Voxer', icon: 'fa-solid fa-microphone', shortcuts: [
    { keys: ['Space'], desc: 'Toggle recording' },
    { keys: ['1–8'], desc: 'Switch Vox mode' },
    { keys: ['Ctrl', 'S'], desc: 'AI summarize' },
    { keys: ['Esc'], desc: 'Cancel recording' },
  ]},
  { label: 'Email', icon: 'fa-solid fa-envelope', shortcuts: [
    { keys: ['C'], desc: 'Compose new' },
    { keys: ['R'], desc: 'Reply' },
    { keys: ['F'], desc: 'Forward' },
    { keys: ['E'], desc: 'Archive' },
    { keys: ['Ctrl', 'Enter'], desc: 'Send' },
  ]},
  { label: 'Messaging', icon: 'fa-solid fa-comment', shortcuts: [
    { keys: ['Enter'], desc: 'Send message' },
    { keys: ['Shift', 'Enter'], desc: 'New line' },
    { keys: ['@'], desc: '@mention picker' },
    { keys: ['#'], desc: 'Topic picker' },
    { keys: ['Ctrl', 'B'], desc: 'Bold' },
  ]},
  { label: 'Calendar', icon: 'fa-solid fa-calendar', shortcuts: [
    { keys: ['T'], desc: 'Jump to today' },
    { keys: ['N'], desc: 'New event' },
    { keys: ['D'], desc: 'Day view' },
    { keys: ['W'], desc: 'Week view' },
    { keys: ['M'], desc: 'Month view' },
  ]},
];

export const STUDIO_FEATURES = [
  {
    title: '8 Slash Commands',
    desc: '/brainstorm, /decide, /analyze, /summarize, /plan, /debrief, /risks, /compare — structured AI outputs for every workflow.',
    tags: ['Brainstorm', 'Decide', 'Analyze', 'Plan'],
  },
  {
    title: '4 AI Agent Personas',
    desc: '@general for balanced analysis, @skeptic to challenge assumptions, @scribe for documentation, @deep-diver for thorough research.',
    tags: ['General', 'Skeptic', 'Scribe', 'Deep-Diver'],
  },
  {
    title: 'RAG Document Intelligence',
    desc: 'Upload PDFs, docs, and data sources. Every AI response draws from your uploaded context — grounded, not hallucinated.',
    tags: ['PDF Upload', 'Vector Search', 'Context-Aware'],
  },
  {
    title: 'Realtime Voice Agent',
    desc: 'Have live voice conversations with the AI agent. Ask questions, dictate, and get spoken responses in real time.',
    tags: ['Voice Input', 'Live Response', 'Hands-Free'],
  },
  {
    title: 'Session Management',
    desc: 'Save sessions by project. Revisit past research, export to Markdown or PDF, and collaborate with team members in real time.',
    tags: ['Projects', 'Export', 'Collaboration'],
  },
  {
    title: 'Artifact Rendering',
    desc: 'Tables, code blocks, comparison matrices, and structured outputs render inline — not just text walls.',
    tags: ['Tables', 'Code', 'Charts'],
  },
];

export const EMAIL_FEATURES = [
  { title: 'Gmail Integration', desc: 'Real-time bidirectional sync with full thread support, labels, filters, snooze, and schedule-send.', tags: ['OAuth', 'Realtime Sync', 'Labels'] },
  { title: 'AI Daily Briefing', desc: 'Every morning, get an AI-generated summary of priorities, pending decisions, urgent threads, and upcoming meetings.', tags: ['Priorities', 'Decisions', 'Meetings'] },
  { title: 'Smart Compose & Templates', desc: 'AI-assisted email drafting with reusable templates, tone adjustment, and signature management.', tags: ['AI Draft', 'Templates', 'Signatures'] },
  { title: 'Campaign Builder', desc: 'Create email campaigns with audience segmentation, template editor, and delivery scheduling.', tags: ['Segments', 'Scheduling', 'Analytics'] },
  { title: 'Follow-Up Nudges', desc: 'AI detects threads going cold and nudges you before relationships slip through the cracks.', tags: ['Auto-Detect', 'Reminders', 'Health Score'] },
  { title: 'Action Item Extraction', desc: 'AI identifies tasks, commitments, and deadlines buried in email threads and surfaces them as actionable items.', tags: ['Tasks', 'Deadlines', 'Tracking'] },
];

export const MESSAGING_FEATURES = [
  { title: 'Channels & Threads', desc: 'Organized conversations with split-view layout, thread nesting, and channel categories for every team.', tags: ['Split View', 'Threads', 'Categories'] },
  { title: 'Focus Mode', desc: 'Distraction blocking with a Pomodoro-style timer, stats dashboard, and productivity tracking.', tags: ['Timer', 'Block Distractions', 'Stats'] },
  { title: 'AI Summarization', desc: 'Missed a long thread? Get an instant AI summary of key points, decisions, and action items.', tags: ['Key Points', 'Decisions', 'Actions'] },
  { title: 'Smart Auto-Response', desc: 'AI drafts contextual replies based on conversation history and your communication style.', tags: ['Context-Aware', 'Style Match', 'Quick Reply'] },
  { title: 'Rich Text & Reactions', desc: 'Bold, code blocks, links, file attachments, emoji reactions, stars, and @mentions built in.', tags: ['Markdown', 'Reactions', 'Mentions'] },
  { title: 'Unified Inbox', desc: 'Slack, Gmail, Outlook, and internal messages flow into one prioritized stream. No tab-switching.', tags: ['Slack', 'Gmail', 'Outlook'] },
];

export const CALENDAR_FEATURES = [
  { title: 'Dual Calendar Sync', desc: 'Bidirectional sync with Google Calendar and Outlook. Changes in Pulse reflect instantly in your native calendar.', tags: ['Google', 'Outlook', 'Realtime'] },
  { title: 'AI Calendar Assistant', desc: 'Natural language scheduling, smart insights, analytics, and goal tracking — all in a 4-tab AI panel.', tags: ['NLP', 'Insights', 'Goals'] },
  { title: 'Booking Pages', desc: 'Share availability links for easy scheduling. Invitees pick a slot, and the event creates itself.', tags: ['Share Link', 'Auto-Create', 'Availability'] },
  { title: 'Video Conferencing', desc: 'One-click links for Pulse Meet, Google Meet, Zoom, or Microsoft Teams attached to any event.', tags: ['Zoom', 'Meet', 'Teams'] },
  { title: 'Conflict Detection', desc: 'Smart alerts when events overlap, double-book, or clash with focus time blocks.', tags: ['Overlap Alert', 'Focus Time', 'Auto-Suggest'] },
  { title: 'Meeting Prep', desc: 'AI-generated briefings before every meeting — attendee context, agenda items, and past discussion notes.', tags: ['Briefing', 'Attendees', 'Context'] },
];

export const ANALYTICS_FEATURES = [
  { title: 'Predictive Analytics', desc: 'AI forecasts trends and flags risks before they become problems.', tags: ['Forecasting', 'Risk Alerts'] },
  { title: 'Sentiment Analysis', desc: 'Track communication health, tone shifts, and relationship strength across your network.', tags: ['Tone', 'Health Score'] },
  { title: 'Team Velocity', desc: 'Monitor productivity, task completion rates, conflicts, and kudos in real time.', tags: ['Productivity', 'Conflicts', 'Kudos'] },
  { title: '8 View Modes', desc: 'Overview, velocity, sentiment, network, relationships, conflicts, kudos, and predictions — all interactive.', tags: ['Dashboards', 'Export'] },
];

// ── Pricing — Pulse Team tier ───────────────────────────────────────────────
// Keep in sync with src/components/billing/TrialExpiredBlock.tsx FEATURES.
export const PULSE_TEAM_FEATURES = [
  'Unlimited team seats',
  'All 6 Voxer modes (Quick, Team, Drop, Threads, Radio, Notes)',
  'Video Vox + Studio RAG',
  'Email, calendar, messaging, meetings',
  'Advanced analytics + full ecosystem bridge',
  '2,000 AI messages / 500 SMS / 50 GB storage / mo',
];

export const PULSE_TEAM_PRICING = {
  monthly: 100,      // $/mo billed monthly
  yearly: 1000,      // $/yr billed annually (2 months free vs. monthly)
  yearlyMonthlyEquiv: Math.round(1000 / 12), // ≈ $83/mo display value
  trialDays: 30,
};
