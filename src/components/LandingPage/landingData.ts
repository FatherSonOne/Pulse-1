// ── Landing Page Static Data ──────────────────────────────────────────────────
// Extracted from the god component to keep LandingPage.tsx focused on rendering.

// Hero stats strip was retired 2026-05-14 (impeccable hero-metric template ban).
// The numbers live in the prose index strip directly below the hero now —
// see "Index strip" comment in LandingPage.tsx. Counts retained here as a
// reference doc against the shipped code:
//   - 5 Relay peers (RelayView in Relay.tsx); Triage is a stream, not a peer
//   - 5 communication surfaces (Messages, Email, Relay, Glimpse, Summit) — in-app SMS gated OFF for v1 (inAppSms, #100)
//   - 3 AI providers (Gemini, Claude, OpenAI) — matches Privacy Policy §5 (#112)
//   - 4 CRMs (HubSpot, Salesforce, Pipedrive, Zoho)
//   - 8 War Room commands (STUDIO_COMMANDS in useStudioCommands.ts)
//   - 5 platform syncs (Slack, Gmail, Outlook+Teams, Zoom, Google Meet)
//   - 14 settings panels (top-level src/components/settings/*.tsx)

// CRM_PLATFORMS, PLATFORMS, STUDIO_FEATURES, EMAIL_FEATURES, MESSAGING_FEATURES,
// CALENDAR_FEATURES, ANALYTICS_FEATURES were never imported by LandingPage.tsx
// (every feature card inline-defined its data). Deleted 2026-05-14 to avoid
// drift between landingData and inline literals. Re-add as a single source of
// truth in a future refactor that extracts feature-section components.

// Relay's six surfaces, mirroring RelayView in src/components/Relay.tsx.
// Triage is the stream-style landing view; Direct/Channel/Broadcast/Notes/Live
// are the five audience peers. Glimpse (video) is a separate top-level section,
// covered elsewhere on the page. Renamed from VOX_MODES on 2026-05-14 to match
// the shipped Voxer → Relay terminology rebrand.
//
// The `key` field is the shipped keyboard shortcut from
// src/hooks/useRelayKeyboardShortcuts.ts — surfaced on the landing page as a
// JetBrains Mono badge on each peer card so the relationship between marketing
// language and in-app behaviour is visible.
export const RELAY_PEERS = [
  { key: 'T', icon: 'fa-solid fa-inbox',           name: 'Triage',    desc: 'Your unified voice-message stream. Every Relay message in one prioritised list, sorted by what needs you now.' },
  { key: 'D', icon: 'fa-solid fa-wave-square',     name: 'Direct',    desc: 'One-to-one voice with waveform visualisation, playback control, and AI transcription on every message.' },
  { key: 'C', icon: 'fa-solid fa-users',           name: 'Channel',   desc: 'Channel-based voice threads with @mentions, group transcription, and topic scoping.' },
  { key: 'B', icon: 'fa-solid fa-tower-broadcast', name: 'Broadcast', desc: 'Push-to-air for the whole team. Stream a voice update to everyone at once with transcript on arrival.' },
  { key: 'N', icon: 'fa-solid fa-note-sticky',     name: 'Notes',     desc: 'Personal voice journaling with AI summary, keyword extraction, and linked tasks.' },
  { key: 'L', icon: 'fa-solid fa-radio',           name: 'Live',      desc: 'Persistent voice rooms. Always-on hangouts for your team, Discord-style, with playback if you miss it.' },
];

export const FAQ_DATA = [
  { q: "What is Pulse?", a: "Pulse is one screen for every work conversation: messaging, voice (Relay), async video (Glimpse), calendar, contacts, and decisions, plus email and Slack as opt-in connectors, with one cross-surface AI that reads across all of them, summarizes, drafts, and triages, and labels every word it writes so you always know what's yours. Built for the overloaded solo operator (and the team they pull in)." },
  { q: "What AI models does Pulse support?", a: "Pulse integrates Google Gemini (primary, with built-in web search grounding), Anthropic Claude, and OpenAI. You can switch between models in Settings → AI & Intelligence." },
  { q: "What is the War Room?", a: "The War Room is your AI command center, a research and strategy workspace with 8 slash commands (/brainstorm, /decide, /analyze, /summarize, /plan, /debrief, /risks, /compare), 4 specialized AI agents, RAG document intelligence, voice agent, and session management. Upload your docs and get context-aware AI responses." },
  { q: "What are the Relay peers?", a: "Triage (your unified voice-message stream, the default landing view), Direct (one-to-one voice with AI transcription), Channel (voice threads with @mentions), Broadcast (push-to-air for the whole team), Notes (personal voice journaling), and Live (persistent voice rooms, Discord-style). Glimpse, async video messaging with face-cam and screen recording, is a separate top-level section. AI transcription runs on every voice and video message." },
  { q: "Which CRM platforms does Pulse integrate with?", a: "Pulse offers 4 native CRM integrations: HubSpot, Salesforce, Pipedrive, and Zoho CRM. Additionally, Pulse includes Logos Vision, a built-in relationship intelligence system with 0-100 health scoring and bidirectional sync." },
  { q: "What platforms are in the Unified Inbox?", a: "Pulse messaging (channels and DMs) is the core inbox. Slack can be connected as an opt-in beta to mirror your DMs and channels, and Microsoft Outlook, Zoom, and Google Meet connect for calendar and meetings. Each platform connects via OAuth in Settings → Integrations." },
  { q: "Is my data encrypted?", a: "Pulse encrypts your data in transit (TLS) and at rest (AES-256), and isolates every workspace with row-level security. Pulse does not offer end-to-end encryption: to power AI features like summaries, smart compose, and decision extraction, your content is processed server-side at the time of your request. We treat your content as confidential and restrict internal access through access controls and policy, but unlike an end-to-end-encrypted messenger, there is no cryptographic barrier that makes content unreadable to us. We never use your content to train AI models." },
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
    { keys: ['G', 'V'], desc: 'Relay' },
    { keys: ['G', 'C'], desc: 'Calendar' },
    { keys: ['G', 'T'], desc: 'Contacts' },
  ]},
  { label: 'Relay', icon: 'fa-solid fa-microphone', shortcuts: [
    { keys: ['Space'], desc: 'Toggle recording' },
    { keys: ['T'], desc: 'Triage stream' },
    { keys: ['D', 'C', 'B'], desc: 'Direct / Channel / Broadcast' },
    { keys: ['N', 'L'], desc: 'Notes / Live' },
    { keys: ['Ctrl', 'S'], desc: 'AI summarise' },
    { keys: ['Esc'], desc: 'Cancel recording' },
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

// ── Pricing — Pulse Solo tier ───────────────────────────────────────────────
// The Lane-A entry tier (#119/#126): the overloaded solo operator. One seat,
// the full cross-surface AI moat. TrialExpiredBlock.tsx + the landing pricing
// section consume these as the single source of truth.
export const PULSE_SOLO_FEATURES = [
  'Just you, 1 seat',
  'Cross-surface AI: summaries, drafts, triage',
  'Relay voice + Glimpse video',
  'Decisions & tasks, contacts, calendar',
  '1,500 AI messages / 25 GB / mo',
];

export const PULSE_SOLO_PRICING = {
  monthly: 20,       // $/mo billed monthly
  yearly: 200,       // $/yr billed annually (2 months free vs. monthly)
  yearlyMonthlyEquiv: Math.round(200 / 12), // ≈ $17/mo display value
  trialDays: 30,
};

// ── Pricing — Pulse Team tier ───────────────────────────────────────────────
// Per-seat (#119/#126): $15/user/mo, minimum 2 seats. The yearly figure is the
// per-seat annual price. TrialExpiredBlock.tsx imports this list directly —
// single source of truth.
export const PULSE_TEAM_FEATURES = [
  'Per-seat: $15/user/mo, min 2 seats',
  'All 5 Relay peers + Triage stream',
  'Glimpse async video + Studio RAG',
  'Email, calendar, messaging, meetings',
  'Maps with geofence alerts and ETA sharing',
  'Advanced analytics + full ecosystem bridge',
  '2,000 AI messages / 50 GB storage / mo',
];

export const PULSE_TEAM_PRICING = {
  monthly: 15,       // $/user/mo billed monthly (per-seat, min 2 seats)
  yearly: 150,       // $/user/yr billed annually (2 months free vs. monthly)
  yearlyMonthlyEquiv: Math.round(150 / 12), // ≈ $13/seat/mo display value
  trialDays: 30,
  perSeat: true,
};

// ── Pricing — Pulse Growth tier ─────────────────────────────────────────────
// Flat-rate org tier with 5× Team caps for AI/Relay, 10× storage, plus
// premium-only unlocks. Prices wired to Stripe test-mode product
// (price_1TYGWNGb3AGXe9w8PjNHmR8L monthly, price_1TYGWOGb3AGXe9w8rfCzjg4k
// yearly). Keep in sync with the plans table.
export const PULSE_GROWTH_FEATURES = [
  'Everything in Team, plus:',
  '10,000 AI messages / 500 GB / 2,500 Relay min / mo',
  'SSO / SAML, coming soon',
  'API access with rate-limited keys',
  'Audit log retention: 365 days',
  'Custom branding on emails and exports',
  'Advanced AI budget controls (per-user caps)',
  'Priority support, 1 business day SLA',
];

export const PULSE_GROWTH_PRICING = {
  monthly: 300,      // $/mo billed monthly (Stripe price_1TYGWNGb3AGXe9w8PjNHmR8L)
  yearly: 3000,      // $/yr billed annually, 2 months free vs. monthly (price_1TYGWOGb3AGXe9w8rfCzjg4k)
  yearlyMonthlyEquiv: Math.round(3000 / 12), // ≈ $250/mo display value
  trialDays: 30,
};
