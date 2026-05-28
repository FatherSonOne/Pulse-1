// Mock email dataset — kept for design-reference and Storybook-style local
// testing. Production data flows through useCockpitData() (Phase 2). The
// canonical view-model type lives in ./emailRow; this file maps onto it.

import type { AiAction, EmailLane, EmailRow, EmailTone } from './emailRow';

// Re-export shared types so older imports keep working during the transition.
export type { AiAction, EmailLane, EmailTone } from './emailRow';
export type AiActionKind = AiAction['kind'];

/** Legacy alias for callers still importing MockEmail. */
export type MockEmail = EmailRow & {
  /** Inline body — mock data is plain text matching the playground. */
  snippet: string;
  email: string; // raw address
};

function row(opts: {
  id: string; from: string; email: string; org: string | null;
  subject: string; snippet: string; body: string;
  when: string; whenLong: string; unread: boolean; starred: boolean;
  lane: EmailLane; aiSummary: string | null; aiActions: AiAction[];
  tone: EmailTone; threadCount: number; draft: string | null;
}): MockEmail {
  return {
    id: opts.id,
    from: opts.from,
    fromEmail: opts.email,
    org: opts.org,
    subject: opts.subject,
    body: opts.body,
    when: opts.when,
    whenLong: opts.whenLong,
    unread: opts.unread,
    starred: opts.starred,
    lane: opts.lane,
    tone: opts.tone,
    aiSummary: opts.aiSummary,
    aiActions: opts.aiActions,
    threadCount: opts.threadCount,
    threadId: null,
    draft: opts.draft,
    snippet: opts.snippet,
    email: opts.email,
  };
}

export const MOCK_EMAILS: MockEmail[] = [
  row({
    id: 'e1', from: 'Maria Schaefer', email: 'maria@northwindstudio.com', org: 'Northwind Studio',
    subject: 'Q2 baseline numbers — need them in slide 4 before Friday',
    snippet: "Frank — pulling together the Friday review deck. Need the Q2 baseline figures we discussed on slide 4 before then.",
    body: "Frank — pulling together the Friday review deck.\n\nNeed the Q2 baseline figures we discussed on slide 4 before then. The board is going to ask about the YoY delta first, so let's make sure that's the *headline* number, not the run-rate.\n\nIf the numbers slipped versus our March forecast, flag it in the speaker notes — Theo will dig there.\n\nTalk Friday.",
    when: '2h', whenLong: 'Today · 11:42 AM', unread: true, starred: true, lane: 'work',
    aiSummary: 'Maria needs Q2 baseline figures dropped into slide 4 of the Friday board deck; she wants YoY delta as the headline number, not run-rate. Flag any miss vs. March forecast in speaker notes.',
    aiActions: [
      { id: 'a1', label: 'Open the deck in Drive', kind: 'link' },
      { id: 'a2', label: 'Send Maria the Q2 figures', kind: 'reply' },
      { id: 'a3', label: 'Add "Update slide 4" to Tasks · due Thu', kind: 'task' },
    ],
    tone: 'warm', threadCount: 3,
    draft: 'Maria — got it. Will have the slide updated by EOD tomorrow with the YoY headline and a footnote on the March variance. Anything specific you want pulled out for Theo?',
  }),
  row({
    id: 'e2', from: 'Sarah Chen', email: 'sarah.chen@legaltrust.co', org: 'LegalTrust',
    subject: 'NDA option B — one tweak on page 2 and we ship',
    snippet: 'Legal signed off on Option B. There is one small disclosure tweak on page 2 (section 4.3).',
    body: "Hi Frank,\n\nLegal signed off on Option B. There is one small disclosure tweak on page 2 (section 4.3) — once you accept it the doc is ready for signature. No further redlines expected.\n\nPlease confirm by Wed so we can countersign and move to the close.\n\nBest,\nSarah",
    when: '5h', whenLong: 'Today · 8:51 AM', unread: true, starred: false, lane: 'work',
    aiSummary: 'NDA Option B is approved with one disclosure tweak on page 2 §4.3. Sarah needs your confirmation by Wednesday to move to countersign.',
    aiActions: [
      { id: 'a1', label: 'Accept change & confirm', kind: 'reply' },
      { id: 'a2', label: 'Snooze until Wednesday', kind: 'snooze' },
    ],
    tone: 'cool', threadCount: 7,
    draft: 'Sarah — accepted. Page-2 §4.3 looks correct as drafted. Cleared to countersign on your end.',
  }),
  row({
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
    tone: 'cold', threadCount: 6,
    draft: 'Theo — apologies for the lag. I have the v3 draft sitting at ~80%; sending it by EOD Thursday with the revenue model split out. Want to hold the call until you have read it?',
  }),
  row({
    id: 'e10', from: 'Priya Devarajan', email: 'priya@matrixventures.io', org: 'Matrix Ventures',
    subject: 'Quick intro — would love to meet',
    snippet: 'Heard about Pulse from Theo. Are you doing any conversations with seed funds yet?',
    body: 'Hi Frank,\n\nHeard about Pulse from Theo. Are you doing any conversations with seed funds yet? Happy to keep it informal — coffee or video, your call.\n\nPriya',
    when: '6h', whenLong: 'Today · 7:55 AM', unread: true, starred: false, lane: 'work',
    aiSummary: 'Inbound intro from Priya at Matrix Ventures via Theo. Offering informal seed-fund conversation, no pressure on format.',
    aiActions: [
      { id: 'a1', label: 'Reply: open to a 20-min call', kind: 'reply' },
      { id: 'a2', label: 'Reply: not raising yet, stay in touch', kind: 'reply' },
    ],
    tone: 'warm', threadCount: 1,
    draft: 'Hi Priya — thanks for the intro from Theo. Not actively raising yet, but happy to keep an informal line open. Mid-June work for a 20-min call?',
  }),
];

export const TRIAGE_QUEUE_IDS = ['e1', 'e2', 'e4', 'e10'];

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
    'Pulse AI scanned 42 emails this morning. Everything else can wait — or has been drafted, archived, or filed into a lane below.',
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
