// src/components/Archives/memoryDemoSeed.ts
// Deterministic demo data for visualizing the Memory section without real ingest.
// All synthetic; held in memory only — never written to the database.

import type { ArchiveItem, ArchiveType } from '../../types';

export interface DemoContact {
  id: string;
  displayName: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  avatarUrl: null;
}

const C: Record<string, DemoContact> = {
  sarah: { id: 'demo-c-sarah', displayName: 'Sarah Chen', fullName: 'Sarah Chen', email: 'sarah@helio.app', phoneNumber: '+1 (415) 555-0142', avatarUrl: null },
  marcus: { id: 'demo-c-marcus', displayName: 'Marcus Lee', fullName: 'Marcus Lee', email: 'marcus@example.com', phoneNumber: '+1 (415) 555-0188', avatarUrl: null },
  alex:   { id: 'demo-c-alex', displayName: 'Alex Rivera', fullName: 'Alex Rivera', email: 'alex.rivera@studio.co', phoneNumber: '+1 (646) 555-0117', avatarUrl: null },
  priya:  { id: 'demo-c-priya', displayName: 'Priya Patel', fullName: 'Priya Patel', email: 'priya@nimbus.io', phoneNumber: '+1 (212) 555-0204', avatarUrl: null },
  jordan: { id: 'demo-c-jordan', displayName: 'Jordan Kim', fullName: 'Jordan Kim', email: 'jordan@arc.vc', phoneNumber: '+1 (415) 555-0331', avatarUrl: null },
  theo:   { id: 'demo-c-theo', displayName: 'Theo Müller', fullName: 'Theo Müller', email: 'theo@muller-legal.de', phoneNumber: '+49 30 5550 1834', avatarUrl: null },
};

export const generateDemoContacts = (): DemoContact[] => Object.values(C);

const daysAgo = (days: number, hours = 12, minutes = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

interface SeedItem {
  type: ArchiveType;
  title: string;
  content: string;
  daysAgo: number;
  hour?: number;
  contact?: DemoContact;
  tags?: string[];
  aiTags?: string[];
  aiSummary?: string;
  starred?: boolean;
  pinned?: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

const SEEDS: SeedItem[] = [
  // ── Recent · this week ─────────────────────────────────────────────
  { type: 'message', daysAgo: 0, hour: 9, contact: C.sarah,
    title: 'Quick check on Q2 pricing tiers',
    content: '"Hey, can we revisit the $299 tier? Two of my customers asked for an annual plan in the last 24 hours."',
    tags: ['pricing'], aiTags: ['urgent', 'q2-launch'], sentiment: 'neutral', pinned: true },

  { type: 'email', daysAgo: 0, hour: 11, contact: C.marcus,
    title: 'Re: API rate limit increase request',
    content: 'Marcus: I bumped /search to 1200 req/min for your workspace. Two-week trial — happy to make permanent if usage stays under.',
    tags: ['engineering'], sentiment: 'positive' },

  { type: 'relay_message', daysAgo: 0, hour: 14, contact: C.alex,
    title: 'Voice memo on the new homepage hero',
    content: '[3:24 voice message] Alex on first reactions to the hero section. Likes the "every word" line, suggests bigger sparkline.',
    tags: ['design'], aiTags: ['hero', 'v2'], sentiment: 'positive', starred: true },

  { type: 'relay_note', daysAgo: 1, hour: 22,
    title: 'Late-night thoughts on tiered pricing',
    content: 'Voice note to self: the tiered model only works if onboarding sells the upgrade path within first 14 days. Check funnel data tomorrow.',
    tags: ['pricing', 'reflection'], aiTags: ['action-item'], sentiment: 'neutral' },

  { type: 'glimpse', daysAgo: 1, hour: 16, contact: C.marcus,
    title: 'Demo: search prefetch in action (1:42)',
    content: '[1:42 glimpse] Marcus walks through the prefetch optimization. Median latency down from 240ms to 38ms.',
    tags: ['engineering', 'launch-q2'], aiTags: ['perf-win'] },

  // ── Last week ──────────────────────────────────────────────────────
  { type: 'relay_live', daysAgo: 4, hour: 10, contact: C.sarah,
    title: 'Live call: pricing review (28 min)',
    content: 'Live conversation with Sarah on the proposed pricing structure. Key: she pushed for a $99 starter to widen the funnel; agreed to test for 60 days.',
    tags: ['pricing'], aiTags: ['decision-pending'], sentiment: 'neutral', starred: true,
    aiSummary: 'Sarah and the operator aligned on testing a $99 starter tier for 60 days, with the option to consolidate back to $299 if conversion is below 12%.' },

  { type: 'meeting_note', daysAgo: 4, hour: 11, contact: C.sarah,
    title: 'Q2 planning · pricing strategy alignment',
    content: 'Action items from the call: (1) draft new pricing page by Fri, (2) prepare migration email for current $299 users, (3) check legal on grandfathering clause.',
    tags: ['pricing', 'q2-launch'], aiTags: ['action-items'], starred: true },

  { type: 'transcript', daysAgo: 4, hour: 14, contact: C.sarah,
    title: 'Transcript · pricing review · 2026-04-30',
    content: 'Full transcript of the 28-minute call. 6,300 words. Highlights: Sarah\'s framing of the "good/better/best" model, customer-quoting throughout.',
    tags: ['pricing'], aiSummary: 'Pricing call where Sarah Chen advocated for a 3-tier good/better/best model, citing 4 customer quotes. Operator agreed in principle pending margin analysis.' },

  { type: 'decision_log', daysAgo: 3, hour: 9, contact: C.sarah,
    title: 'Approved tiered pricing: $99 / $299 / $899',
    content: 'Decision: proceed with 3-tier good/better/best pricing. Live test starts 2026-05-15. Reviewer: Sarah Chen. Owner: pricing team.',
    tags: ['pricing', 'q2-launch'], aiTags: ['decision'], sentiment: 'positive' },

  { type: 'summary', daysAgo: 3, hour: 16,
    title: 'AI Summary: pricing thread (4 conversations)',
    content: 'Cross-conversation summary covering: initial customer feedback (Sarah, May 02), live pricing review (May 04), follow-up SMS (May 04), and the decision log. Net: tiered pricing approved with $99 starter as the experiment lever.',
    tags: ['pricing', 'summary'], aiTags: ['cross-thread'] },

  // ── 1-2 weeks ago ──────────────────────────────────────────────────
  { type: 'message', daysAgo: 7, hour: 13, contact: C.priya,
    title: 'Onboarding question about CSV import',
    content: 'Priya: "Stuck on the CSV step — my date column has mixed formats. Is there a fix or should I clean it up before upload?"',
    tags: ['onboarding'], sentiment: 'negative' },

  { type: 'email', daysAgo: 8, hour: 10, contact: C.priya,
    title: 'Re: onboarding feedback (long thread)',
    content: 'Priya\'s detailed onboarding write-up. Three sticking points: CSV import errors, unclear step 4 in the wizard, and the lack of an undo button. Offered to walk through fixes.',
    tags: ['onboarding', 'feedback'], aiTags: ['friction'], sentiment: 'negative' },

  { type: 'relay_note', daysAgo: 9, hour: 21,
    title: 'Idea: weekly onboarding tips email',
    content: 'Voice note: send weekly tips to anyone in onboarding for the first 14 days. Example: "5 minutes to your first AI summary." Test with next 50 signups.',
    tags: ['onboarding', 'idea'] },

  { type: 'journal', daysAgo: 10, hour: 23,
    title: 'Reflection on Sarah\'s pricing pushback',
    content: 'Sarah\'s instinct on pricing has been right twice now. Worth noting: she pushes for simpler/lower entry points but defends premium ceilings hard. Useful pattern.',
    tags: ['reflection', 'pricing'] },

  // ── 2-3 weeks ago ──────────────────────────────────────────────────
  { type: 'message', daysAgo: 14, hour: 17, contact: C.jordan,
    title: 'Catch up next week?',
    content: 'Jordan: "Want to grab 30 min next week? Curious where you landed on Series A timing."',
    tags: ['investor'], aiTags: ['follow-up'] },

  { type: 'email', daysAgo: 15, hour: 9, contact: C.jordan,
    title: 'Investor update · Q2',
    content: 'Quarterly update sent to Jordan and 6 other angels. Key numbers: ARR $1.4M (up 38%), churn 2.1%, runway 18 months at current burn.',
    tags: ['investor', 'q2-launch'] },

  { type: 'relay_message', daysAgo: 16, hour: 11, contact: C.jordan,
    title: 'Voice update on Series B timing',
    content: '[2:18 voice message] Jordan\'s read on the market: wait until Q3 for Series B if metrics hold. Suggests we line up 3 lead candidates over the summer.',
    tags: ['investor'], aiTags: ['action-item'], sentiment: 'positive' },

  { type: 'meeting_note', daysAgo: 17, hour: 14, contact: C.jordan,
    title: 'Investor sync · April 24',
    content: 'Walked Jordan through the Q2 forecast. He flagged the AI-cost line as the metric most likely to slip. Suggested adding a "cost-per-summary" KPI to the next update.',
    tags: ['investor'], aiTags: ['kpi'], starred: true },

  { type: 'decision_log', daysAgo: 18, hour: 16,
    title: 'Decision: postpone Series A by 60 days',
    content: 'Decision: hold Series A. Rationale: need 2 more months of post-pricing-launch data. Reviewer: self + Jordan. Revisit: 2026-07-01.',
    tags: ['investor'], aiTags: ['decision'] },

  // ── 3-4 weeks ago ──────────────────────────────────────────────────
  { type: 'message', daysAgo: 21, hour: 9, contact: C.theo,
    title: 'Final compliance docs sent',
    content: 'Theo: "Signed ToS v3 and the DPA in your Drive. Ready when you are."',
    tags: ['compliance'], sentiment: 'positive' },

  { type: 'email', daysAgo: 22, hour: 11, contact: C.theo,
    title: 'Compliance review · ToS v3 attached',
    content: 'Theo\'s legal review of ToS v3. Three changes flagged: data retention clause needs 30-day specificity, cookie banner needs DE/FR translations, deletion endpoint must be one-click.',
    tags: ['compliance'], aiTags: ['action-items'] },

  { type: 'document', daysAgo: 24, hour: 16,
    title: 'ToS v3 · final draft',
    content: '[12-page legal document] Final draft of Terms of Service v3, incorporating Theo\'s redlines and the new DSAR flow.',
    tags: ['compliance'], starred: true },

  { type: 'war_room_session', daysAgo: 25, hour: 14,
    title: 'Compliance war room · April 28',
    content: '90-minute session with Theo, the engineering lead, and the customer-facing team. Output: a 12-item checklist before we can ship in EU.',
    tags: ['compliance', 'launch-q2'], aiTags: ['blocking'] },

  // ── 5-6 weeks ago ──────────────────────────────────────────────────
  { type: 'relay_live', daysAgo: 32, hour: 10, contact: C.marcus,
    title: 'Hiring sync · candidate pipeline',
    content: 'Live call with Marcus on the engineering pipeline. 4 candidates in final round, 1 likely offer this week.',
    tags: ['hiring'], aiTags: ['pipeline'] },

  { type: 'message', daysAgo: 35, hour: 15, contact: C.alex,
    title: 'New design system brief',
    content: 'Alex: "Finishing the spec for the new tokenization. Want a preview before I send it Wed?"',
    tags: ['design'] },

  { type: 'glimpse', daysAgo: 36, hour: 17, contact: C.alex,
    title: 'Walkthrough of the new sidebar (45s)',
    content: '[0:45 glimpse] Alex demoing the redesigned sidebar with the mono labels and coral active state.',
    tags: ['design', 'launch-q2'], aiTags: ['preview'], sentiment: 'positive' },

  { type: 'summary', daysAgo: 37, hour: 12,
    title: 'AI Summary: hiring conversations (3 channels)',
    content: 'Cross-channel summary of the engineering hiring thread: 4 candidates in pipeline, 1 likely offer (Marcus is sponsor), 2 declined after final round, salary expectations clustering around $185k base.',
    tags: ['hiring', 'summary'], aiTags: ['cross-thread'] },

  // ── 8-12 weeks ago ─────────────────────────────────────────────────
  { type: 'relay_note', daysAgo: 56, hour: 23,
    title: 'Reminder: follow up with Theo on contract',
    content: 'Voice note: ping Theo about the addendum on Tuesday if I haven\'t heard back.',
    tags: ['compliance'] },

  { type: 'transcript', daysAgo: 63, hour: 14, contact: C.marcus,
    title: 'Pair programming · search refactor',
    content: 'Pairing transcript on the search service refactor. Decision points: switching to MeiliSearch from Postgres FTS, cache invalidation strategy.',
    tags: ['engineering'], aiTags: ['decision'] },

  { type: 'decision_log', daysAgo: 70, hour: 11,
    title: 'Decision: ship Glimpse limit at 60 seconds',
    content: 'Decision: cap Glimpse video length at 60 seconds for v1. Rationale: keeps storage costs predictable, forces creators to be specific. Revisit at 100 daily Glimpses.',
    tags: ['design', 'engineering'], aiTags: ['decision'] },
];

export function generateDemoMemoryItems(): ArchiveItem[] {
  return SEEDS.map((seed, i) => {
    const date = daysAgo(seed.daysAgo, seed.hour ?? 12, 0);
    return {
      id: `demo-item-${String(i + 1).padStart(3, '0')}`,
      type: seed.type,
      title: seed.title,
      content: seed.content,
      date,
      tags: seed.tags || [],
      relatedContactId: seed.contact?.id,
      starred: seed.starred || false,
      pinned: seed.pinned || false,
      sentiment: seed.sentiment,
      aiTags: seed.aiTags,
      aiSummary: seed.aiSummary,
      visibility: 'private' as const,
      viewCount: 0,
    };
  });
}
