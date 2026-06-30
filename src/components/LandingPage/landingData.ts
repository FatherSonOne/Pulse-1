// ── Landing Page Static Data ──────────────────────────────────────────────────
// Extracted from the god component to keep LandingPage.tsx focused on rendering.

import { Globe, Compass, Mic, MessageSquare, Calendar } from 'lucide-react';

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
  { q: "Which CRM platforms does Pulse integrate with?", a: "Pulse offers 4 native CRM integrations: HubSpot, Salesforce, Pipedrive, and Zoho CRM. Additionally, Pulse includes Logos Vision, a built-in relationship intelligence system with 0-100 health scoring." },
  { q: "What platforms are in the Unified Inbox?", a: "Pulse messaging (channels and DMs) is the core inbox. Slack can be connected as an opt-in beta to mirror your DMs and channels, and Microsoft Outlook, Zoom, and Google Meet connect for calendar and meetings. Each platform connects via OAuth in Settings → Integrations." },
  { q: "Is my data encrypted?", a: "Pulse encrypts your data in transit (TLS) and at rest (AES-256), and isolates every workspace with row-level security. Pulse does not offer end-to-end encryption: to power AI features like summaries, smart compose, and decision extraction, your content is processed server-side at the time of your request. We treat your content as confidential and restrict internal access through access controls and policy, but unlike an end-to-end-encrypted messenger, there is no cryptographic barrier that makes content unreadable to us. We never use your content to train AI models." },
  { q: "What devices is Pulse available on?", a: "Pulse is available as a web app (any browser), Windows desktop app (installer or portable), and Android (Google Play early access or direct APK). iOS and macOS apps are coming soon." },
];

export const SHORTCUT_GROUPS = [
  { label: 'Global', icon: Globe, shortcuts: [
    { keys: ['Ctrl', 'K'], desc: 'Unified search' },
    { keys: ['Ctrl', '/'], desc: 'Pulse AI Assistant' },
    { keys: ['Ctrl', 'Shift', 'P'], desc: 'Command palette' },
    { keys: ['Esc'], desc: 'Close modal / panel' },
    { keys: ['?'], desc: 'Contextual help' },
  ]},
  { label: 'Navigate', icon: Compass, shortcuts: [
    { keys: ['G', 'D'], desc: 'Dashboard' },
    { keys: ['G', 'M'], desc: 'Messages' },
    { keys: ['G', 'V'], desc: 'Relay' },
    { keys: ['G', 'C'], desc: 'Calendar' },
    { keys: ['G', 'T'], desc: 'Contacts' },
  ]},
  { label: 'Relay', icon: Mic, shortcuts: [
    { keys: ['Space'], desc: 'Toggle recording' },
    { keys: ['T'], desc: 'Triage stream' },
    { keys: ['D', 'C', 'B'], desc: 'Direct / Channel / Broadcast' },
    { keys: ['N', 'L'], desc: 'Notes / Live' },
    { keys: ['Ctrl', 'S'], desc: 'AI summarise' },
    { keys: ['Esc'], desc: 'Cancel recording' },
  ]},
  { label: 'Messaging', icon: MessageSquare, shortcuts: [
    { keys: ['Enter'], desc: 'Send message' },
    { keys: ['Shift', 'Enter'], desc: 'New line' },
    { keys: ['@'], desc: '@mention picker' },
    { keys: ['#'], desc: 'Topic picker' },
    { keys: ['Ctrl', 'B'], desc: 'Bold' },
  ]},
  { label: 'Calendar', icon: Calendar, shortcuts: [
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
  'AI across every tool: summaries, drafts, triage',
  'Voice messages (Relay) + async video (Glimpse)',
  'Decisions, tasks, contacts, and calendar',
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
  'Everything in Solo, plus:',
  'All 5 voice channels (Relay) + priority inbox (Triage)',
  'Async video (Glimpse) + AI document search (Studio)',
  'Shared calendar, messaging, and meetings',
  'Field maps with location alerts and live ETA sharing',
  'Advanced analytics + cross-app sync',
  '2,000 AI messages / 50 GB / mo, shared across seats',
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
  '10,000 AI messages / 500 GB / 2,500 voice minutes / mo, shared',
  'API access with rate-limited keys',
  'Audit log retention: 365 days',
  'Priority support, 2 business day SLA',
  // Roadmap, not shipped — rendered as a muted "Soon" row, never a checkmark.
  'SSO / SAML, coming soon',
];

// ── Plan comparison matrix ───────────────────────────────────────────────────
// Every row is backed by an enforced limit in the tier migrations (pulse_solo /
// pulse_team / pulse_growth). No invented specs: values map 1:1 to plans.*.
// `true` → check, `false` → not included, string → literal value.
export const PULSE_PLAN_MATRIX: {
  tiers: readonly string[];
  rows: { label: string; values: (string | boolean)[] }[];
} = {
  tiers: ['Solo', 'Team', 'Growth'],
  rows: [
    { label: 'AI messages / mo',     values: ['1,500', '2,000', '10,000'] },
    { label: 'Storage',              values: ['25 GB', '50 GB', '500 GB'] },
    { label: 'Voice minutes / mo',   values: ['300', '500', '2,500'] },
    { label: 'API access',           values: [false, false, true] },
    { label: 'Audit log retention',  values: [false, false, '365 days'] },
    { label: 'Priority support SLA', values: [false, false, '2 business days'] },
    { label: 'SSO / SAML',           values: [false, false, 'Soon'] },
  ],
};

export const PULSE_GROWTH_PRICING = {
  monthly: 300,      // $/mo billed monthly (Stripe price_1TYGWNGb3AGXe9w8PjNHmR8L)
  yearly: 3000,      // $/yr billed annually, 2 months free vs. monthly (price_1TYGWOGb3AGXe9w8rfCzjg4k)
  yearlyMonthlyEquiv: Math.round(3000 / 12), // ≈ $250/mo display value
  trialDays: 30,
};

// ── Landing capability strip + /features clusters ───────────────────────────
// Single source of truth shared by the quiet home (CAPABILITY_CELLS breadth
// grid) and the /features route (FEATURE_CLUSTERS sub-nav). Added 2026-06-25 in
// the landing restructure to kill the inline-literal drift that caused the Relay
// icon mismatch. `anchor` = the in-page section id on /features; `cluster` keys
// match FEATURE_CLUSTERS.
export const CAPABILITY_CELLS = [
  { name: 'Relay',     blurb: 'Voice messaging, reimagined as triage.', stat: '5 peers + Triage stream',        cluster: 'communicate', anchor: 'section-relay' },
  { name: 'Glimpse',   blurb: 'Async video with face-cam and screen.',  stat: 'AI transcript on every clip',     cluster: 'communicate', anchor: 'section-glimpse' },
  { name: 'Messaging', blurb: 'Channels, DMs, and @mentions.',          stat: 'Slack mirror, opt-in',            cluster: 'communicate', anchor: 'section-messaging' },
  { name: 'War Room',  blurb: 'AI research and strategy desk.',         stat: '8 slash commands',                cluster: 'decide',      anchor: 'section-warroom' },
  { name: 'CRM',       blurb: 'Relationship intelligence, built in.',   stat: '4 native CRMs + health scores',   cluster: 'relate',      anchor: 'section-crm' },
  { name: 'Maps',      blurb: 'Field ops with live ETA sharing.',       stat: 'Geofence alerts',                 cluster: 'operate',     anchor: 'section-maps' },
] as const;

export const FEATURE_CLUSTERS = [
  { key: 'communicate', label: 'Communicate', blurb: 'Every conversation — voice, video, and text — on one surface.',     sections: ['section-relay', 'section-glimpse', 'section-messaging'] },
  { key: 'decide',      label: 'Decide',      blurb: 'Turn signal into decisions with AI research, tasks, and analytics.', sections: ['section-warroom', 'section-decisions', 'section-analytics'] },
  { key: 'relate',      label: 'Relate',      blurb: 'Keep every relationship warm with intelligence built in.',           sections: ['section-crm'] },
  { key: 'operate',     label: 'Operate',     blurb: 'Run the day — calendar, field ops, and workspaces.',                 sections: ['section-calendar', 'section-maps', 'section-workspaces'] },
] as const;

// ── /features "Journey" gallery — flat ordered source of truth ──────────────
// Added 2026-06-29 for the /features sliding-gallery redesign (see
// _design-playground/HANDOFF-features-gallery.md + features-gallery-lab-v2.html).
// The downward-scrolling stack of feature sections is replaced by a horizontal
// "scroll journey": one feature per viewport, advanced by a sticky-pin scroll on
// desktop / a native swipe carousel on mobile, with a breadcrumb spine grouped by
// cluster. Order here IS the journey order; `cluster` drives the spine grouping
// and per-cluster accent.
//
// `id` MUST stay identical to the legacy `section-<id>` anchors so existing deep
// links (/features#section-crm), the footer, home-nav, and the scrollToSection
// allow-list all keep resolving to the right feature.

// Per-cluster accent pair (--accent / --accent-2). Matches the themed sections that
// already shipped: Relay=rose, War Room=purple, CRM=indigo. Operate gains emerald
// (NEW) so the breadcrumb is legible cluster-to-cluster.
export const CLUSTER_ACCENTS: Record<
  (typeof FEATURE_CLUSTERS)[number]['key'],
  { num: string; accent: string; accent2: string }
> = {
  communicate: { num: '01', accent: '#f43f5e', accent2: '#ec4899' }, // rose
  decide:      { num: '02', accent: '#a855f7', accent2: '#c084fc' }, // purple
  relate:      { num: '03', accent: '#6366f1', accent2: '#818cf8' }, // indigo
  operate:     { num: '04', accent: '#10b981', accent2: '#34d399' }, // emerald (new)
};

export type JourneyVisual =
  | 'wave' | 'play' | 'chat' | 'research' | 'list' | 'chart' | 'cards' | 'cal' | 'map' | 'grid';

export interface JourneyFeature {
  /** Matches the existing section-<id> anchor — deep-link contract. */
  id: string;
  cluster: (typeof FEATURE_CLUSTERS)[number]['key'];
  eyebrow: string;
  title: string;
  blurb: string;
  stat: string;
  bullets: string[];
  visual: JourneyVisual;
}

export const FEATURE_JOURNEY: JourneyFeature[] = [
  {
    id: 'section-relay', cluster: 'communicate', eyebrow: 'Relay', visual: 'wave',
    title: 'Five peers, one stream.',
    blurb: 'Voice messaging, reimagined as triage. Direct, Channel, Broadcast, Notes, Live — every message lands in one Triage stream with AI transcript, summary, and next action attached.',
    stat: '5 peers + Triage stream',
    bullets: ['Real-time transcription', 'AI summary + next action', 'Direct · Channel · Broadcast'],
  },
  {
    id: 'section-glimpse', cluster: 'communicate', eyebrow: 'Glimpse', visual: 'play',
    title: '30-second video replaces a 30-minute call.',
    blurb: 'Async video with face-cam and screen. Record, send, move on — every clip ships with an AI transcript so nobody has to watch at 1×.',
    stat: 'AI transcript on every clip',
    bullets: ['Face-cam + screen', 'Auto transcript', 'Threaded replies'],
  },
  {
    id: 'section-messaging', cluster: 'communicate', eyebrow: 'Messaging', visual: 'chat',
    title: 'Conversations that convert.',
    blurb: 'Channels, DMs, and @mentions on one surface — with an opt-in Slack mirror so the rest of the org never loses the thread.',
    stat: 'Slack mirror, opt-in',
    bullets: ['Channels + DMs', '@mentions', 'Slack mirror'],
  },
  {
    id: 'section-warroom', cluster: 'decide', eyebrow: 'War Room', visual: 'research',
    title: 'Your AI War Room.',
    blurb: 'An AI research and strategy desk. Eight slash commands turn raw signal into briefs, comparisons, and decisions — without leaving the conversation.',
    stat: '8 slash commands',
    bullets: ['/research · /compare · /brief', 'Cited sources', 'Decision-ready output'],
  },
  {
    id: 'section-decisions', cluster: 'decide', eyebrow: 'Decisions & Tasks', visual: 'list',
    title: 'From signal to action.',
    blurb: 'Every decision becomes a tracked task with an owner and a due date — captured the moment it’s made, never lost in scrollback.',
    stat: 'Owner + due on every call',
    bullets: ['Decision log', 'Auto-tasked', 'Owner + due date'],
  },
  {
    id: 'section-analytics', cluster: 'decide', eyebrow: 'Analytics', visual: 'chart',
    title: 'See the whole pulse.',
    blurb: 'Communication and decision analytics in one view — response times, decision velocity, and exactly where the team is getting stuck.',
    stat: 'Response + decision velocity',
    bullets: ['Response times', 'Decision velocity', 'Bottleneck spotting'],
  },
  {
    id: 'section-crm', cluster: 'relate', eyebrow: 'Relationships & CRM', visual: 'cards',
    title: 'Relationship intelligence, built in.',
    blurb: 'Four native CRMs with health scores that surface the relationships going cold — before they actually do.',
    stat: '4 native CRMs + health scores',
    bullets: ['4 native CRMs', 'Health scores', 'Warm-up nudges'],
  },
  {
    id: 'section-calendar', cluster: 'operate', eyebrow: 'Calendar', visual: 'cal',
    title: 'Time, orchestrated.',
    blurb: 'A calendar that schedules around the way you actually work — with AI that protects focus and clears the busywork.',
    stat: 'AI scheduling assist',
    bullets: ['Focus protection', 'AI scheduling', 'One shared view'],
  },
  {
    id: 'section-maps', cluster: 'operate', eyebrow: 'Maps', visual: 'map',
    title: 'Pulse, in the real world.',
    blurb: 'Field ops with live ETA sharing and geofence alerts — know who’s where, and exactly when they’ll arrive.',
    stat: 'Geofence alerts',
    bullets: ['Live ETA sharing', 'Geofence alerts', 'Team locations'],
  },
  {
    id: 'section-workspaces', cluster: 'operate', eyebrow: 'Workspaces', visual: 'grid',
    title: 'One surface, every context.',
    blurb: 'Switch between teams, clients, and projects without losing your place — each workspace keeps its own channels, tasks, and people.',
    stat: 'Unlimited contexts',
    bullets: ['Per-context channels', 'Isolated data', 'Instant switch'],
  },
];
