# Pulse — North Star Metric, Retention, and the Aha Funnel

**Status:** Live as of 2026-05-27 (PR landing issue #117). PostHog event
emits wired and shipping with this PR. Dashboards must be built in PostHog
from the events listed below — they don't exist yet on the UI side.

**Owner of this doc:** the operator. Update it when you add or rename an
analytics event. The events catalogued here are the ground truth for every
PostHog insight; if the event isn't on this page, it isn't real.

---

## 1. The North Star Metric (NSM)

> **Weekly Active Collaborative Workspaces** —
> *the count of workspaces where, in the trailing 7 days, **≥2 distinct
> members** were active AND **≥50 messages** were sent.*

```
NSM(week_w) = COUNT(DISTINCT workspace_id)
              WHERE messages_sent_in_week_w >= 50
                AND distinct_active_members_in_week_w >= 2
```

### Why this and not "MAU" or "messages sent"

Vanity counts don't survive contact with retention reality. The framing
above is anchored in the Slack finding — the one that's been re-validated
across every multiplayer SaaS retention study since 2014:

> *Workspaces that send ~2,000 messages within their first weeks
> retain at ~93% weekly. Workspaces that don't, churn.*
> *(referenced in `docs/PULSE_PRELAUNCH_ROADMAP.md`, audit summary point 3)*

The mechanism: communication tools earn retention through **network
density**, not user count. A solo user with 10,000 messages will still
churn — there's no one on the other end to lock them in. Two users
exchanging 50 messages a week is the smallest unit of "this tool is
load-bearing." Below that threshold, you have an experiment; above it,
you have an account.

### Threshold calibration

50 messages/week is a launch-phase placeholder. Calibrate against the
real distribution once we have ≥100 workspaces in PostHog:

- Plot the weekly-message histogram for retained vs. churned workspaces
  at week 4 of their lifecycle.
- The threshold that maximises retention separation (typically the 60th
  percentile of retained-week-4 cohort) is the new target. Slack's
  internal number was ~2,000 over the trial — proportional to a longer
  evaluation window than Pulse's first week.

### What the NSM explicitly excludes

- **Solo workspaces.** `distinct_active_members >= 2` filter. A single
  founder messaging themselves doesn't move the needle.
- **Spam/automation bursts.** If we ever introduce bots that fire `Message
  Sent` events, we'll need a `is_bot` property on the event so this can
  filter them out. Not a problem today — bots aren't wired through
  `pulseService.sendMessage`.
- **Read-only workspaces.** Even a 100-member workspace where nobody
  posts is not active by this definition.

---

## 2. Supporting metrics

These are the second-tier metrics. They diagnose *why* the NSM moves;
don't substitute them for it.

### 2.1 DAU / WAU / MAU + stickiness

- **Definition (DAU):** distinct `distinct_id` that fired any `Message
  Sent` event today.
- **WAU / MAU:** distinct users over trailing 7d / 30d.
- **Stickiness ratio:** `DAU / MAU`. Target: **0.5–0.7** for a messaging
  product. Below 0.3 means you have a "tool people install" not a "tool
  people live in."

### 2.2 D1 / D7 / D30 cohort retention

- **Starting event:** user identified (effectively signup — fires the
  first time `identifyUser` runs for a distinct_id post-init).
- **Returning event:** `Message Sent`.
- **Cohort grain:** weekly buckets for D7+; daily for D1.

Read the curve, not a single number. The interesting shape is whether
the curve flattens by D30 (the product has stuck) or asymptotes to zero
(it hasn't).

### 2.3 Activation funnel

The post-Stripe "aha moment" funnel — what we ship in this PR:

```
signup
  -> onboarding.surface_shown
  -> onboarding.first_message_sent
  -> onboarding.teammate_invited
```

Watch the **drop-off between steps 2 and 3**. That's the "moment of
truth" gap — users who saw the post-Stripe surface but never sent. If
that drop is >50%, the surface is failing.

The teammate-invited step is the network-effects pivot — workspaces that
hit step 3 are dramatically more likely to clear the NSM threshold than
those that don't.

---

## 3. PostHog setup (rebuild instructions)

These insights don't auto-generate. After the PostHog project is
provisioned, build them once and pin to a dashboard.

### Insight A — Stickiness trend

Insight type: **Trends**, with formula.

- Series A: `Message Sent`, unique users, last 90 days, interval = day.
- Series B: `Message Sent`, unique users, last 90 days, interval = day,
  date range modifier = trailing 30d (use PostHog's "rolling window"
  filter, not a separate insight).
- Formula: `A / B`. Display as line chart with 0.5 and 0.7 as visual
  reference bands.

### Insight B — D1/D7/D30 cohort retention

Insight type: **Retention**.

- Starting event: `$identify` (built-in PostHog event, fired by
  `identifyUser` in `analytics.ts:71`).
- Returning event: `Message Sent`.
- Period: **Weekly**, 12 weeks visible.
- Also clone with period = **Daily**, 30 days visible — that's the D1/D7
  shape.

### Insight C — Activation funnel

Insight type: **Funnel**.

Steps, in order:

1. `$identify` (signup proxy).
2. `onboarding.surface_shown`.
3. `onboarding.first_message_sent`.
4. `onboarding.teammate_invited`.

Conversion window: **7 days**. Display drop-off bars; the chart is the
"aha moment" diagram.

### Insight D — NSM (Weekly Active Collaborative Workspaces)

This one isn't buildable as a single PostHog insight today — it needs a
GROUP-BY on `workspace_id` with a HAVING clause on both message count
and distinct-member count. Two ways to build it:

1. **PostHog Group Analytics.** Set up `workspace` as a group type
   ([docs.posthog.com/product-analytics/group-analytics](https://posthog.com/docs/product-analytics/group-analytics)),
   ensure every `Message Sent` and `onboarding.*` event carries
   `workspace_id`, then build a Trend insight on "Active workspaces"
   filtered by `messages_count >= 50` and `member_count >= 2`. Group
   analytics is a paid feature — see PostHog pricing.
2. **Supabase cron + materialized view.** Write a weekly cron in
   `supabase/functions/` that aggregates `pulse_messages` → per-workspace
   counts → emits a single `NSM Snapshot` event to PostHog with
   `value`, `week`, and `total_workspaces`. Then chart that one event in
   a Trend insight. Cheaper and gives you the historical series for
   free. **This is the recommended path** — defer Group Analytics until
   the workspace count justifies the cost.

The cron isn't shipped in this PR; it's the v1 follow-up. See "Known
gaps" below.

---

## 4. Aha event reference

The exact event names emitted by this PR, with file:line so you can grep
when one stops firing.

| Event | What it means | Fires at |
|---|---|---|
| `Application Loaded` | App entry, monitoring booted | `src/lib/monitoring/index.ts:49` (via `initializeMonitoring()` from `src/main.tsx:23`) |
| `$identify` (PostHog built-in) | User session bound to PostHog distinct_id | `src/contexts/AuthContext.tsx:106` (in `onAuthStateChange` SIGNED_IN branch) |
| `Message Sent` | DAU/WAU/MAU trunk event — every Pulse-DM send | `src/services/pulseService.ts:386` (post-RPC success) |
| `onboarding.surface_shown` | Post-Stripe onboarding modal mounted | `src/components/settings/OrgOnboardingModal.tsx:87` (pre-existing) |
| `onboarding.first_message_sent` | Primary activation — first message in legacy Messages thread | `src/components/Messages.tsx:2460` (alongside the in-app `triggerMessage` rule engine) |
| `onboarding.teammate_invited` | Network activation — invite sent via Resend or Gmail | `src/services/inviteService.ts:144` (Resend path) and `src/services/inviteService.ts:197` (Gmail path) |

`identifyUser` properties currently sent: `email`, `google_connected`,
`microsoft_connected`, plus the global `app_version` and `environment`
that `analytics.ts:78` always attaches. Add more to the call site in
`AuthContext.tsx` if you need them — but only properties already on the
mapped `User` object. Don't add a Supabase round-trip just to enrich
identify.

---

## 5. Known gaps

Things explicitly **not done** in PR #117 — the next iteration's work.

### 5.1 NSM aggregation cron

The NSM as defined requires a weekly aggregation over `pulse_messages`
grouped by `workspace_id`. Today, PostHog has the events but not the
group-by capability without Group Analytics. **Recommended:** ship a
Supabase scheduled function that runs `Sun 00:05 UTC`, computes the NSM
for the previous ISO-week, and emits one `NSM Snapshot` event per
workspace_id. Until that lands, the NSM is computable by hand from a
PostHog Events Explorer export.

### 5.2 First-capture activation

`OnboardingEvent.FirstCaptureMade` is defined in `onboardingEvents.ts:30`
but **not emitted**. "Capture" in Pulse is ambiguous — there are at least
three surfaces (`CaptureModal`, voice captures, screenshot captures), and
the issue (#117) flagged the message-send moment as the primary aha. Wire
the chokepoint only if a single dominant capture surface emerges as a
clear retention predictor.

### 5.3 New Messages surface (`MessagesSplitView`)

The activation event fires in legacy `Messages.tsx` only. When
`MessagesSplitView` becomes the production surface (per the
`@deprecated` banner at the top of `Messages.tsx`), the same emit needs
to migrate. Grep for `OnboardingEvent.FirstMessageSent` before
deleting any code in that file.

### 5.4 Channel / Broadcast / Glimpse send tracking

The `trackMessageSent` trunk event only fires for the Pulse-DM canonical
path (`pulseService.sendMessage`). Channel posts, Broadcast sends, and
Glimpse video-vox sends go through their own RPCs and **don't** emit
`Message Sent`. For DAU/WAU/MAU purposes this is acceptable for v1 —
DMs are the dominant volume. For NSM purposes, we'll undercount
collaborative workspaces that are channel-heavy. Add per-surface
`trackMessageSent` calls when the surface volume justifies it (or
re-route them all through a single `sendAnyMessage` shim — preferred
long-term).

### 5.5 Stale Sentry / PostHog DSN guards

Both SDKs are gated on env vars **and** `VITE_APP_MODE !== 'development'`.
In a production build with `VITE_APP_MODE=production` but a missing
`VITE_POSTHOG_API_KEY`, you'll get the `console.log('Analytics disabled
in development')` line — which is misleading. Fix the log copy when
convenient.

### 5.6 Workspace_id on `Message Sent`

The current `trackMessageSent` call in `pulseService.sendMessage`
doesn't pass `workspace_id` (Pulse-DMs aren't workspace-scoped at the
RPC level — they're user-to-user). For NSM aggregation we'll need to
resolve the workspace at the `pulse_conversations` level. Solve as part
of 5.1 (the cron does the join server-side; the client emit doesn't
need to know).

---

## 6. Operational notes

- **PostHog kill switch.** Both SDKs are no-ops in dev (`VITE_APP_MODE
  === 'development'` short-circuits `initializeAnalytics`). To
  temporarily silence in prod, unset `VITE_POSTHOG_API_KEY` on Vercel
  and redeploy.
- **User opt-out.** `optOutTracking()` / `optInTracking()` helpers in
  `analytics.ts:230-241` are wired but not surfaced in settings UI. Add
  a checkbox in `src/components/settings/PrivacySettings.tsx` when GDPR
  consent UX lands (issue #111 covered erasure; consent banner is the
  sibling).
- **Session recording.** Enabled by default with `maskAllInputs: true`
  and `[data-sensitive]` mask selector. Add `data-sensitive` to any
  new input that handles secrets or PII before merging.
