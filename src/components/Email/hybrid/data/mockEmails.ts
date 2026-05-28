// Mock email dataset for Phase 1 (visual port of the Path A playground).
// Phase 2 replaces consumption of these consts with useCockpitData() and the
// real emailStore. Keep this file pure data + types — no React.

export type EmailLane = 'work' | 'admin' | 'tools' | 'news' | 'personal';
export type EmailPriority = 'high' | 'med' | 'low';
export type EmailTone = 'warm' | 'cool' | 'cold' | 'hot';

export type AiActionKind = 'reply' | 'task' | 'snooze' | 'link' | 'meet' | 'rsvp';

export interface AiAction {
  id: string;
  label: string;
  kind: AiActionKind;
}

export interface MockEmail {
  id: string;
  from: string;
  email: string;
  org: string | null;
  subject: string;
  snippet: string;
  body: string;
  when: string;
  whenLong: string;
  unread: boolean;
  starred: boolean;
  lane: EmailLane;
  aiSummary: string | null;
  aiActions: AiAction[];
  tone: EmailTone;
  priority: EmailPriority;
  threadCount: number;
  draft: string | null;
}

export const MOCK_EMAILS: MockEmail[] = [
  {
    id: 'e1', from: 'Maria Schaefer', email: 'maria@northwindstudio.com', org: 'Northwind Studio',
    subject: 'Q2 baseline numbers — need them in slide 4 before Friday',
    snippet: "Frank — pulling together the Friday review deck. Need the Q2 baseline figures we discussed on slide 4 before then. The board is going to ask about the YoY delta first, so let's make sure that's the…",
    body: "Frank — pulling together the Friday review deck.\n\nNeed the Q2 baseline figures we discussed on slide 4 before then. The board is going to ask about the YoY delta first, so let's make sure that's the *headline* number, not the run-rate.\n\nIf the numbers slipped versus our March forecast, flag it in the speaker notes — Theo will dig there.\n\nTalk Friday.",
    when: '2h', whenLong: 'Today · 11:42 AM', unread: true, starred: true, lane: 'work',
    aiSummary: 'Maria needs Q2 baseline figures dropped into slide 4 of the Friday board deck; she wants YoY delta as the headline number, not run-rate. Flag any miss vs. March forecast in speaker notes.',
    aiActions: [
      { id: 'a1', label: 'Open the deck in Drive', kind: 'link' },
      { id: 'a2', label: 'Send Maria the Q2 figures', kind: 'reply' },
      { id: 'a3', label: 'Add "Update slide 4" to Tasks · due Thu', kind: 'task' },
    ],
    tone: 'warm', priority: 'high', threadCount: 3,
    draft: 'Maria — got it. Will have the slide updated by EOD tomorrow with the YoY headline and a footnote on the March variance. Anything specific you want pulled out for Theo?',
  },
  {
    id: 'e2', from: 'Sarah Chen', email: 'sarah.chen@legaltrust.co', org: 'LegalTrust',
    subject: 'NDA option B — one tweak on page 2 and we ship',
    snippet: 'Legal signed off on Option B. There is one small disclosure tweak on page 2 (section 4.3) — once you accept it the doc is ready for signature. No further redlines expected.',
    body: "Hi Frank,\n\nLegal signed off on Option B. There is one small disclosure tweak on page 2 (section 4.3) — once you accept it the doc is ready for signature. No further redlines expected.\n\nPlease confirm by Wed so we can countersign and move to the close.\n\nBest,\nSarah",
    when: '5h', whenLong: 'Today · 8:51 AM', unread: true, starred: false, lane: 'work',
    aiSummary: 'NDA Option B is approved with one disclosure tweak on page 2 §4.3. Sarah needs your confirmation by Wednesday to move to countersign.',
    aiActions: [
      { id: 'a1', label: 'Accept change & confirm', kind: 'reply' },
      { id: 'a2', label: 'Snooze until Wednesday', kind: 'snooze' },
    ],
    tone: 'cool', priority: 'high', threadCount: 7,
    draft: 'Sarah — accepted. Page-2 §4.3 looks correct as drafted. Cleared to countersign on your end.',
  },
  {
    id: 'e3', from: 'Jaylen Park', email: 'jaylen@pulse-design.com', org: 'Pulse · Design',
    subject: 'Onboarding flow review — two broken empty-states',
    snippet: 'Walked through the new onboarding flow this morning. Two empty-states are misfiring (first-run + post-import). I think the fix is one coral CTA instead of two grey buttons — see the screenshot.',
    body: "Hey Frank,\n\nWalked through the new onboarding flow this morning. Two empty-states are misfiring (first-run + post-import). I think the fix is one coral CTA instead of two grey buttons — see the screenshot.\n\nI can spec it if you want, or you can ship the change yourself. Either way, it's a Tuesday-level thing, not a today thing.\n\n—J",
    when: '1d', whenLong: 'Yesterday · 4:12 PM', unread: false, starred: false, lane: 'work',
    aiSummary: 'Jaylen flagged two broken empty-states (first-run, post-import). Proposes one coral CTA instead of two grey buttons. Low urgency — Tuesday-level.',
    aiActions: [
      { id: 'a1', label: 'Reply: "I will spec it"', kind: 'reply' },
      { id: 'a2', label: 'Push to Decisions & Tasks', kind: 'task' },
    ],
    tone: 'warm', priority: 'med', threadCount: 2,
    draft: "J — I'll spec it tomorrow. Coral CTA is the right call. Want me to pair on the post-import state or just ship?",
  },
  {
    id: 'e4', from: 'Theo Bridgewater', email: 'theo@bridgewater-cap.com', org: 'Bridgewater Capital',
    subject: 'Re: Re: Re: Deck draft',
    snippet: 'Following up again — when can I expect the v3 draft? Last note was 9 days ago.',
    body: "Frank,\n\nFollowing up again — when can I expect the v3 draft? Last note was 9 days ago. Happy to jump on a 15-min call if it's faster.\n\nTheo",
    when: '2d', whenLong: '2 days ago', unread: true, starred: false, lane: 'work',
    aiSummary: "Theo's third follow-up on the v3 deck draft — last reply from you was 9 days ago. Relationship signal: cooling.",
    aiActions: [
      { id: 'a1', label: 'Send holding reply with date', kind: 'reply' },
      { id: 'a2', label: 'Schedule a 15-min call', kind: 'meet' },
    ],
    tone: 'cold', priority: 'high', threadCount: 6,
    draft: 'Theo — apologies for the lag. I have the v3 draft sitting at ~80%; sending it by EOD Thursday with the revenue model split out. Want to hold the call until you have read it?',
  },
  {
    id: 'e5', from: 'Aria Vasquez', email: 'receipts@stripe.com', org: 'Stripe',
    subject: 'Receipt from QntmEcos LLC — $148.00',
    snippet: 'Your receipt for May charges is attached. View invoice history in dashboard.',
    body: 'Receipt for your records.\n\nQntmEcos LLC · May 2026 · $148.00',
    when: '3d', whenLong: '3 days ago', unread: false, starred: false, lane: 'admin',
    aiSummary: null, aiActions: [], tone: 'cold', priority: 'low', threadCount: 1, draft: null,
  },
  {
    id: 'e6', from: 'Linear', email: 'notifications@linear.app', org: 'Linear',
    subject: '[PUL-412] Assigned to you — "Glimpse: posters letterboxed on portrait"',
    snippet: 'Mara assigned PUL-412 to you. Priority: High. Cycle: 24 (in progress).',
    body: 'PUL-412 — Glimpse: posters letterboxed on portrait\nAssigned by Mara · Priority High · Cycle 24',
    when: '4h', whenLong: 'Today · 9:18 AM', unread: false, starred: false, lane: 'tools',
    aiSummary: null,
    aiActions: [{ id: 'a1', label: 'Open in Linear', kind: 'link' }],
    tone: 'cold', priority: 'low', threadCount: 1, draft: null,
  },
  {
    id: 'e7', from: 'GitHub', email: 'noreply@github.com', org: 'GitHub',
    subject: 'PR review requested · pulse#1247 — "feat(email): triage queue prototype"',
    snippet: 'Jaylen requested your review on pulse#1247. +1,842 −214 across 18 files.',
    body: '@FatherSonOne, Jaylen requested your review on pulse#1247.',
    when: '6h', whenLong: 'Today · 7:31 AM', unread: false, starred: false, lane: 'tools',
    aiSummary: null,
    aiActions: [{ id: 'a1', label: 'Open PR in GitHub', kind: 'link' }],
    tone: 'cold', priority: 'med', threadCount: 1, draft: null,
  },
  {
    id: 'e8', from: 'WeWork', email: 'billing@wework.com', org: 'WeWork',
    subject: 'Invoice June 2026 — $620.00 due Jun 1',
    snippet: 'Your June 2026 invoice is ready. Payment auto-charges Jun 1 unless updated.',
    body: 'Invoice June 2026 — $620.00 due Jun 1.',
    when: '5d', whenLong: '5 days ago', unread: false, starred: false, lane: 'admin',
    aiSummary: null, aiActions: [], tone: 'cold', priority: 'low', threadCount: 1, draft: null,
  },
  {
    id: 'e9', from: 'Lenny Rachitsky', email: 'lenny@lennysnewsletter.com', org: "Lenny's Newsletter",
    subject: 'The 8 unsexy things every founder must do',
    snippet: 'A guest post from Brian Halligan (HubSpot) on the unglamorous mechanics of company-building.',
    body: 'A guest post from Brian Halligan on the unglamorous mechanics of company-building.',
    when: '8h', whenLong: 'Today · 5:00 AM', unread: false, starred: false, lane: 'news',
    aiSummary: null, aiActions: [], tone: 'cold', priority: 'low', threadCount: 1, draft: null,
  },
  {
    id: 'e10', from: 'Priya Devarajan', email: 'priya@matrixventures.io', org: 'Matrix Ventures',
    subject: 'Quick intro — would love to meet',
    snippet: 'Heard about Pulse from Theo. Are you doing any conversations with seed funds yet? Happy to keep it informal.',
    body: 'Hi Frank,\n\nHeard about Pulse from Theo. Are you doing any conversations with seed funds yet? Happy to keep it informal — coffee or video, your call.\n\nPriya',
    when: '6h', whenLong: 'Today · 7:55 AM', unread: true, starred: false, lane: 'work',
    aiSummary: 'Inbound intro from Priya at Matrix Ventures via Theo. Offering informal seed-fund conversation, no pressure on format.',
    aiActions: [
      { id: 'a1', label: 'Reply: open to a 20-min call', kind: 'reply' },
      { id: 'a2', label: 'Reply: not raising yet, stay in touch', kind: 'reply' },
    ],
    tone: 'warm', priority: 'med', threadCount: 1,
    draft: 'Hi Priya — thanks for the intro from Theo. Not actively raising yet, but happy to keep an informal line open. Mid-June work for a 20-min call?',
  },
  {
    id: 'e11', from: 'Mom', email: 'mom@family.com', org: null,
    subject: 'Sunday dinner?',
    snippet: 'Are you coming Sunday? Your sister is making the lasagna.',
    body: 'Are you coming Sunday? Your sister is making the lasagna. Bring something or just yourself, up to you.',
    when: '1d', whenLong: 'Yesterday · 6:02 PM', unread: true, starred: false, lane: 'personal',
    aiSummary: null, aiActions: [], tone: 'warm', priority: 'med', threadCount: 4, draft: null,
  },
  {
    id: 'e12', from: 'Calendar', email: 'calendar-noreply@google.com', org: 'Google Calendar',
    subject: 'Invitation: Q2 review — Fri May 29, 2:00 PM',
    snippet: 'Maria Schaefer invited you to "Q2 review". 6 attendees · Northwind boardroom + Meet link.',
    body: 'Invitation from Maria Schaefer — Q2 review · Fri May 29 · 2:00 PM',
    when: '5h', whenLong: 'Today · 8:30 AM', unread: false, starred: false, lane: 'admin',
    aiSummary: null,
    aiActions: [
      { id: 'a1', label: 'Accept', kind: 'rsvp' },
      { id: 'a2', label: 'Decline', kind: 'rsvp' },
    ],
    tone: 'cool', priority: 'med', threadCount: 1, draft: null,
  },
];

export const TRIAGE_QUEUE_IDS = ['e1', 'e2', 'e4', 'e10', 'e3', 'e11'];

export interface MockBriefingMeta {
  greeting: string;
  dateStr: string;
  newSinceMorning: number;
  needsYou: number;
  batched: number;
  headlineLead: string;
  headlineNames: string;
  body: string;
}

export const MOCK_BRIEFING: MockBriefingMeta = {
  greeting: 'Daily briefing',
  dateStr: 'Wed May 27',
  newSinceMorning: 42,
  needsYou: 7,
  batched: 35,
  headlineLead: 'Three things move today.',
  headlineNames: "Maria's deck, Sarah's NDA, Priya's reply.",
  body:
    'Claude scanned 42 emails this morning. Everything else can wait — or has been drafted, archived, or filed into a lane below.',
};

export interface MockLane {
  id: EmailLane;
  label: string;
  desc: string;
}

export const MOCK_LANES: MockLane[] = [
  { id: 'work',     label: 'Work',        desc: 'Clients, colleagues, investors' },
  { id: 'admin',    label: 'Admin',       desc: 'Receipts, invoices, calendar' },
  { id: 'tools',    label: 'Tools',       desc: 'GitHub, Linear, Stripe webhooks' },
  { id: 'news',     label: 'Newsletters', desc: 'Skimmable later' },
  { id: 'personal', label: 'Personal',    desc: 'Family & friends' },
];

export interface MockAwaitingReply {
  name: string;
  subject: string;
  days: number;
  cold?: boolean;
}

export const MOCK_AWAITING: MockAwaitingReply[] = [
  { name: 'Mara Velasquez', subject: 'Cycle 24 — what stays in',  days: 3 },
  { name: 'Devon Reyes',    subject: 'Reviewer feedback on §3',    days: 6 },
  { name: 'Lina Park',      subject: 'Q3 roadmap PoV',             days: 9, cold: true },
  { name: 'Calvin Tate',    subject: 'Re: contract terms',         days: 2 },
];

export interface MockCalendarEvent {
  time: string;
  title: string;
  linked?: boolean;
}

export const MOCK_CALENDAR: MockCalendarEvent[] = [
  { time: '2:00 PM', title: 'Q2 review · Maria Schaefer', linked: true },
  { time: '4:30 PM', title: '1:1 with Jaylen' },
  { time: '6:00 PM', title: 'Block · deck v3' },
];
