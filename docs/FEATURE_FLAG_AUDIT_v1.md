# Feature-Flag Audit — v1 launch (Issue #104)

**Date:** 2026-05-26
**Owner issue:** [#104](https://github.com/FatherSonOne/Pulse-1/issues/104) — Feature-flag audit: gate every non-real UI surface for v1
**Status:** Audit complete. **No new surfaces gated this run** (every stub is either
already flagged or owned by another issue — see [What we gated this run](#what-we-gated-this-run)).

---

## Purpose & guiding principle

**Truth-in-product.** The biggest launch risk is showing a user a surface that
*advertises* a capability the product cannot actually deliver — a fake SMS inbox,
a "send campaign" button that fires an unsafe loop, an AI panel with no model
behind it. A reviewer (and a real user) must be able to click every visible v1
surface and hit only real functionality. Anything that can't honor that promise
is hidden behind the **single** feature-flag mechanism (`src/lib/featureFlags.ts`)
until it is real.

This doc is the evidence-based inventory backing that guarantee. Every status
below cites `file:line`. The default disposition is **leave visible** — a surface
is hidden **only** when there is concrete code evidence it is mocked, stubbed, or
unwired. Hiding a working surface is a worse failure than leaving a questionable
one up, so ambiguous cases are listed under
[Needs human decision](#needs-human-decision), not gated.

### The one flag mechanism

`src/lib/featureFlags.ts` — `useFeatureFlag(flagName, userId?, defaultValue?)` is a
**synchronous** read with this precedence: `VITE_FEATURE_<NAME>` env var →
`?ff_<flag>=on|off` URL param → `localStorage` → `featureFlagsConfig` default.
A surface is gated by:
1. A config entry in `featureFlagsConfig` (`enabled:false, rolloutPercentage:0,
   targetUsers:['internal']`) with a comment explaining what's mocked, the unhide
   condition, the owning issue, and the `?ff_<flag>=on` dev override.
2. Hiding the nav entry in `src/components/Sidebar/Sidebar.tsx` (and
   `src/components/MobileBottomNav.tsx` where applicable).
3. A belt-and-suspenders route-guard redirect to Dashboard in `src/App.tsx`.

The canonical worked example is `inAppSms` (`src/lib/featureFlags.ts:160-173`,
`src/App.tsx:336-344` redirect + `src/App.tsx:886` render-guard).

---

## Master inventory — top-level `AppView` surfaces

`AppView` enum: `src/types.ts:9-34`. Nav config: `src/components/Sidebar/Sidebar.tsx:73-130`.
Render switch: `src/App.tsx:~858-963`. Mobile bottom nav: `src/components/MobileBottomNav.tsx:16-22`.

| Surface (`AppView`) | In v1 nav? | Status | Evidence (`file:line`) | Flag | Owning issue | v1 action |
|---|---|---|---|---|---|---|
| `DASHBOARD` | ✅ Sidebar + mobile | ✅ REAL | `Dashboard.tsx` wires `dailyBriefingService`, `dataService`, `captureService`, `pulseService`, `teamHealthService`, `geminiService` (`Dashboard.tsx:6,9,11,26,32,33`) | none | — | leave visible |
| `MESSAGES` | ✅ Sidebar + mobile | ✅ REAL (legacy surface live) | Legacy `Messages.tsx` mounted (`App.tsx:880-881`); v2 entry frozen behind `pulseMessagesV2` flag (`featureFlags.ts:152-158`) | `pulseMessagesV2` (v2 only — legacy unflagged) | — | leave visible (legacy) |
| `EMAIL` | ✅ Sidebar | 🟡 PARTIAL | Inbox + per-message send real (Gmail). **Campaigns sub-surface reachable** (`PulseEmailClientRedesign.tsx:551-555`) and its `send()` loops per-recipient (`emailCampaignService.ts:148-204`) → **#105** | none | **#105** (campaign send loop) | leave visible; campaign send loop deferred to #105 |
| `SMS` | ❌ hidden | 🔴 STUB (mock) | `smsService.isMockMode() => true` (`smsService.ts:40`); render-guarded (`App.tsx:886`), redirect (`App.tsx:336-344`) | **`inAppSms` (OFF)** | #100 / #109 / #99 | already gated — keep OFF |
| `RELAY` | ✅ Sidebar + mobile | ✅ REAL | Voice surfaces wired to real services (Direct/Channel/Broadcast/Notes); see roadmap Capability Matrix | none | — | leave visible |
| `GLIMPSE` | ✅ Sidebar | ✅ REAL | `glimpseService`, `relayAIService`, `useGlimpseMessages`, `relayArchiveService` (`Glimpse.tsx:49,60,64,810`) | none | — | leave visible |
| `CALENDAR` | ✅ Sidebar | ✅ REAL | Google Calendar; token refresh via Render backend (#99 DONE) | none | — | leave visible |
| `MEETINGS` | ✅ Sidebar | 🟡 PARTIAL | Daily.co video real; Entomate export / post-meeting AI handoff = **#106** (`Meetings.tsx:831-841`, `MeetingsComponents.tsx:931-933`); Breakout Rooms honestly `disabled` + "Coming Soon" (`MeetingsComponents.tsx:1566-1578`) | none | **#106** (post-meeting AI) | leave visible; AI handoff deferred to #106 |
| `CONTACTS` | ✅ Sidebar | ✅ REAL | `Contacts` wired; Relationship Autopilot uses real `askAI` w/ template fallback (`relationshipAutopilotService.ts:8-55`); "enrichment" = real signature-parse + dedup (`contactEnrichmentService.ts:6-7,34`), mislabel only → **#107** | none | **#107** (enrichment relabel), **#108** (CRM sync pagination) | leave visible; relabel + pagination deferred |
| `MAP` | ✅ Sidebar (Experimental, collapsible) | 🟡 PARTIAL→REAL | AI route strip is real: `useMapAiProposals` → `mapAIService` (`proposeRoute`/`proposeWeekPlan`/`proposeAtlasInsight`) + Google `DirectionsService` (`useMapAiProposals.ts:128-160,215-235`); ETA *share* real via `etaShareService` (supabase RPCs, `etaShareService.ts:15,123,176`). Already de-emphasized in Experimental section (`Sidebar.tsx:114-125`) | none | — | leave visible (already in Experimental) |
| `LIVE` (Summit) | ✅ Sidebar (Experimental) | ✅ REAL | `realtimeAgentService`, `byoKeyService`, `summit-session-end` edge fn (`Summit.tsx:78,286-287,1001-1002`) | none | — | leave visible |
| `LIVE_AI` (War Room) | ✅ Sidebar | ✅ REAL | `ragService`, `geminiService`, `warRoomRealtimeService`, `openai-realtime-token` edge fn (`LiveDashboard.tsx:5,6,27,151-152`) | none | — | leave visible |
| `ARCHIVES` | ✅ Sidebar | ✅ REAL | `archiveStore` + `CapturesView` (Memory/Notes tabs) (`Archives.tsx:2,8,184-198`) | none | — | leave visible |
| `SETTINGS` | ✅ footer | ✅ REAL | Real settings; SSO/SAML + some integrations honestly labeled "Coming Soon" (`BillingSettings.tsx:49`, `integrations/ComingSoonIntegrations.tsx`) | none | — | leave visible |
| `MESSAGE_ANALYTICS` | ❌ not in nav | ✅ REAL | `messageService.getActiveMessages/getMessageMetrics/getRetentionByExposure` (`MessageAnalytics.tsx:7,46,61,72`). Reachable only programmatically | none | — | leave visible (not in nav anyway) |
| `MULTI_MODAL` (Search) | ✅ Sidebar ("Search") | ✅ REAL | `unifiedSearchService`, `searchClipboardService`, `savedSearchesService`, `searchExport` (`UnifiedSearchRedesign.tsx:34-39`) | none | — | leave visible |
| `ANALYTICS` | ✅ Sidebar | ✅ REAL | `Analytics/AnalyticsDashboard` + views (Conflicts/Kudos/Predictions/Relationships); no mock/`Math.random` data signals found | none | — | leave visible |
| `DECISIONS_TASKS` | ✅ Sidebar + mobile | ✅ REAL | `decisionService`, `taskService`, `decisionAnalyticsService`, `dependenciesService`, `decisionActivityService` (`DecisionTaskHub.tsx:21-27`). Proposal-mode voting is the only paused piece (`proposalMode` flag, `featureFlags.ts:114-120`) | `proposalMode` (sub-feature only) | — | leave visible |
| `USERS_GUIDE` | ✅ Sidebar | ✅ REAL | Static guide content (`UsersGuide`) | none | — | leave visible |
| `CONTACT_MAP` | ❌ deprecated | n/a redirect | Redirects to `MAP` (`App.tsx:910-913`) | none | — | leave (compat redirect) |

---

## What we gated this run

**Nothing.** No new feature flags were added, and no nav entries or routes were
hidden. This is a deliberate and valid outcome of the conservative-gating rule.

Reasoning, restated against the acceptance criteria:

- The **only** service in the codebase with a hard-coded mock switch is
  `smsService` (`smsService.ts:40` — `isMockMode() => true`), and its surface
  (`AppView.SMS`) **is already gated OFF** via `inAppSms` (#100). No grep hit for
  `isMockMode`, `MOCK_MODE`, or `USE_MOCK` exists in any other service.
- Every other 🔴 / 🟡 surface is **owned by another open issue** (#105–#109),
  which this run must not touch — only cross-reference. See
  [Deferred to owning issues](#deferred-to-owning-issues).
- Every remaining top-level surface in the v1 nav wires to a **real** backing
  service (evidence above), so gating any of them would hide working
  functionality — the worse failure.
- The scattered "coming soon" strings across the app are **honest in-context
  micro-labels on disabled or conditional controls** (e.g. Breakout Rooms toggle
  `disabled`, `MeetingsComponents.tsx:1566-1578`; campaign open-rate cells that
  read "coming soon" until `stats.sent > 0`, `EmailCampaignsDashboard.tsx:410-415`;
  ThreadAudit Flow/Sentiment sub-tab empty states, `FlowTab.tsx:23`,
  `SentimentTab.tsx:24`; integration cards literally labeled "Coming Soon",
  `ComingSoonIntegrations.tsx`). None is a top-level surface masquerading as
  functional, so none qualifies for gating.

If a future change introduces a user-visible orphan stub, gate it with a new
`featureFlagsConfig` entry following the `inAppSms` pattern
(`featureFlags.ts:160-173`) plus the `App.tsx` redirect/render-guard
(`App.tsx:336-344`, `App.tsx:886`) and the Sidebar nav-hide.

---

## Needs human decision — RESOLVED 2026-05-26

All three were decided by the operator on 2026-05-26:

1. **Email → Campaigns sub-surface** (`PulseEmailClientRedesign.tsx:551-555`).
   **DECISION: HIDE for v1** ("likely going to be cut from Pulse anyway").
   Shipped via **#105** (`0767141`) — new `emailCampaigns` flag (OFF), the email
   sidebar's whole "Tools" section hidden, the `currentView === 'campaigns'`
   render gated, and a reset effect bouncing stale state to `'inbox'`. The unsafe
   per-recipient `send()` loop (`emailCampaignService.ts:148-204`) is now
   unreachable. Dev preview: `?ff_emailCampaigns=on`.

2. **`MAP` placement.** **DECISION: leave as-is for now — "may not make the cut
   either; don't abandon, circle back."** Map stays in the collapsible
   "Experimental" section (`Sidebar.tsx:114-126`); it's real (AI route strip +
   ETA-share) and honestly labeled, so **not** gated. Revisit its v1 inclusion
   later (no code this run).

3. **`MESSAGE_ANALYTICS`** (real-but-orphaned: render switch handled it at
   `App.tsx:926-927`, no nav entry). **DECISION: WIRE.** Shipped (`3d51235`) — a
   "Message Analytics" entry added to the Intelligence section
   (`Sidebar.tsx`, MailOpen icon). Backed by real deployed schema
   (`in_app_messages` + `get_message_metrics` / `get_retention_by_message_exposure`
   RPCs), so it shows real data or honest empty states.

---

## Deferred to owning issues

These surfaces are 🟡/🔴 but have a dedicated owner; **not touched** this run.

| Concern | Surface / evidence | Owning issue |
|---|---|---|
| Email campaigns — unsafe per-recipient send loop | `emailCampaignService.ts:148-204`; reachable at `PulseEmailClientRedesign.tsx:551-555` | **#105** |
| Post-meeting AI / Entomate handoff | `Meetings.tsx:831-841`, `MeetingsComponents.tsx:931-933,1033-1107` | **#106** |
| "Contact enrichment" → relabel (it's signature-parse + internal dedup, not third-party enrichment) | `contactEnrichmentService.ts:1-7,34` | **#107** |
| CRM sync — no pagination, server-side OAuth refactor pending | `crmService.ts`, `logosVisionService.ts` (roadmap Capability Matrix) | **#108** |
| In-app SMS — 100% mocked; A2P 10DLC + TCPA compliance | `smsService.ts:40` (`isMockMode`); **already gated** via `inAppSms` | **#109** (compliance), #100 (gate), #99 (backend) |

> **Push notifications are REAL** (verified live `sent:1`, #101 DONE) — explicitly
> NOT flagged off, per roadmap ground truth.

---

## How to verify (acceptance #3 — click-through QA)

The acceptance criterion "a reviewer can click every visible v1 surface and hit
only real functionality" is a **human/QA click-through** (ties to **#115**). This
checklist is the script:

1. **Sidebar walk** (`Sidebar.tsx:73-130`): Dashboard → Messages → Email → Relay →
   Glimpse → Calendar → Meetings → Contacts → Decisions & Tasks → Search →
   Analytics → War Room → Archives → User Guide → (Experimental) Summit, Map →
   Settings. Each should load real data or a genuine empty state — **no mock
   inbox, no fake send confirmation, no AI panel without a model behind it.**
2. **Mobile bottom nav** (`MobileBottomNav.tsx:16-22`): Home, Relay, Messages,
   Decisions, More. Confirm parity.
3. **Confirm SMS is unreachable:** there is no SMS nav entry; deep-linking
   `?view=SMS` (or stale state) must bounce to Dashboard (`App.tsx:336-344`) and
   render nothing (`App.tsx:886`). Dev override `?ff_inAppSms=on` should reveal
   the mock — verify it does NOT appear without the override.
4. **Email campaigns:** opening Campaigns is fine (real dashboard); **do not send
   a campaign** in QA until #105 hardens the loop. Note its state for #105.
5. **Meetings:** join a real Daily.co room; the Entomate "Export" button only
   appears when `entomateConnected` (`MeetingsComponents.tsx:895,1033`). Breakout
   Rooms is correctly `disabled` — confirm it can't be toggled.
6. **Spot-check "coming soon" labels** are on disabled/conditional controls only,
   never on a primary action that looks live.

### Quick dev overrides (for testing hidden surfaces)

- `?ff_inAppSms=on` — reveal the (mock) SMS surface
- `?ff_pulseMessagesV2=on` — reveal the frozen v2 Messages entry
- `?ff_proposalMode=on` — reveal proposal-mode voting
- `?ff_workspaceGroups=on` — reveal the Groups card

Each persists to `localStorage` (`featureFlags.ts:258-280`); append `=off` to clear.
