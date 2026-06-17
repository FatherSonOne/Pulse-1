# Edge-Function Fixes Handoff — ai-router 402 + gmail-push-receiver 500 (2026-06-16)

> **Origin:** surfaced while verifying the Meetings recording pipeline
> (`docs/MEETINGS_LAUNCH_FIXES_HANDOFF_2026-06-16.md`). Neither is a Meetings bug;
> both are independent edge-function issues found in the live logs.
> **Status:** read-only investigation (live code read + live DB + live logs,
> project `ucaeuszgoihoyrvhewxk`). **Nothing executed.** Both fixes touch
> sensitive surfaces (billing entitlements / a shared secret) — see the per-item
> gates. Per `CLAUDE.md` Rule A, do not execute destructive/data changes without
> explicit approval of that specific change.

---

## Item 1 — `ai-router` returns 402, blocking meeting summaries (and all AI for ~10 workspaces)

### Symptom
The Meetings test (room `pulse-ace34af35e8d4f22`, 2026-06-16 23:36 UTC) saved its
transcript fine but showed **"No summary available."** The edge log shows the cause:
```
POST | 402 | …/functions/v1/ai-router   (23:36:38, version 46)
```
The client `handleLeave` → `generateMeetingSummary` → `ai-router` call was rejected
with 402, so no summary was generated or persisted.

### Root cause (verified — two layers)
**`ai-router` 402 = `cap_exceeded` | `trial_expired`** from `checkAICap`
([ai-router/index.ts:96-105](../supabase/functions/ai-router/index.ts#L96-L105)).
The trial-expiry branch
([metering.ts:63-67](../supabase/functions/ai-router/metering.ts#L63-L67)):
```ts
if (ent?.is_trialing && ent.trial_ends_at) {
  if (new Date(ent.trial_ends_at).getTime() < Date.now()) {
    return { allowed: false, reason: 'trial_expired', ... };  // → 402
  }
}
```

**Layer A — stale trial data (the 402 trigger).** The meeting creator
(`29646a2b-…`) belongs to two workspaces; the summary call used the **expired** one:

| workspace_id | max_ai_messages_mo | is_trialing | trial_ends_at | result |
|---|---|---|---|---|
| `bcff3d98-fd66-424c-83d9-99dbc399236f` | 2000 | **true** | **2026-05-23** (past) | **402 trial_expired** |
| `60373be9-5a2b-49fd-8250-541775dedf30` | 10000 | false | NULL | would have passed (usage 694/10000) |

This is **systemic, not a one-off**: **10 workspaces** are stuck `is_trialing=true`
with the identical `trial_ends_at = 2026-05-23 14:47:28+00` (a seed/default that was
never flipped when the trial lapsed). Every AI call routed through any of them 402s.
(For contrast: `bdd071c1` has a *future* trial end `2026-06-28` and is fine; the two
paid workspaces above/`c54f5267` 1500-cap are fine.)

Affected workspace ids (all `trial_ends_at=2026-05-23`, `is_trialing=true`):
`a1a688a5`, `ced89366`, `4a22f1d3`, `6b2fc3ac`, `53bdbd66`, `bcff3d98`, `11e7a688`,
`0080f114`, `66eb3e92`, `5b712108`.

**Layer B — workspace selection (open question).** The user HAS a healthy workspace
(`60373be9`) but the summary call passed the expired `bcff3d98`. Before fixing data,
trace how the meeting-summary path resolves `workspace_id` (client passes it into
`generateMeetingSummary` → `ai-router`). If it's grabbing an arbitrary/first
membership rather than the user's active/primary workspace, that's a separate bug
that will keep biting other AI surfaces. **Do not assume** — read the actual
resolution (`geminiService.generateMeetingSummary`, and whatever supplies its
`workspace_id`) and confirm which workspace is "active" for this user.

### Fix — options (GATED: billing/entitlements data, Rule A)
Pick after confirming Layer B. Verify the real `entitlements` schema before any write
(`CLAUDE.md` §4 — schema-first; columns observed: `workspace_id`,
`max_ai_messages_mo`, `is_trialing`, `trial_ends_at`).

- **Option 1 — flip the lapsed trials (data fix).** For the operational/owned
  workspaces among the 10, set `is_trialing=false` (these are owner/dev workspaces,
  not real paying-trial customers). Removes the `trial_expired` block; the 2000 cap
  still applies. **Pro:** unblocks AI immediately. **Con:** if any of those 10 are
  genuinely someone's expired trial, flipping them grants free AI — triage the list
  first, don't blanket-update. Dry-run in a rolled-back transaction.
- **Option 2 — extend `trial_ends_at`** to a future date for dev workspaces (keeps
  the trial semantics, just not lapsed). Lighter-touch; same triage caveat.
- **Option 3 — fix Layer B only** (route meeting summaries through the user's healthy
  workspace). Fixes *this* symptom but leaves the 10 stale-trial workspaces blocked
  for every other AI surface — partial, not recommended alone.
- **Recommended:** Layer B trace first → then Option 1/2 on the *confirmed-dev*
  subset of the 10. Address the metering.ts note (line 58-60: "Once billing is live,
  this should become trial_expired block") as part of the billing cutover, separately.

### Rule-A — Pros / Cons / Approval gate (data fix)
- **What changes:** `UPDATE entitlements SET is_trialing=false` (or extend
  `trial_ends_at`) for a named subset of the 10 workspace ids.
- **Pros:** unblocks AI (summaries, etc.) for dev/owner workspaces.
- **Cons:** mis-classifying a real customer trial as dev = free AI granted. Must
  enumerate which of the 10 are dev vs. real before touching.
- **Ask:** confirm the exact workspace-id list to modify and which operation
  (flip vs. extend) before applying. Dry-run first.

### Verification
After the fix: re-run a recorded+transcribed meeting → confirm `ai-router` returns
200 and `pulse_video_rooms.summary` populates. Or directly: call `ai-router` with the
previously-failing `workspace_id` and assert non-402.

---

## Item 2 — `gmail-push-receiver` flooding 500s (and leaking the secret in logs)

### Symptom
Dozens of `POST | 500` for `gmail-push-receiver` in minutes (all version 13), each
with the shared secret in the query string:
```
POST | 500 | …/functions/v1/gmail-push-receiver?secret=8ee166…2469f6
```
Two problems: (a) every Google Pub/Sub push delivery fails, so **email push
notifications are 100% down**; (b) the secret is **logged in plaintext** via the URL.

### Root cause (verified from code — high confidence)
The function returns 500 from exactly **one** place
([gmail-push-receiver/index.ts:81](../supabase/functions/gmail-push-receiver/index.ts#L81)):
```ts
if (!PUSH_RECEIVER_SECRET) return json({ error: 'PUSH_RECEIVER_SECRET not configured' }, 500)
```
Everything else either returns 401 (secret mismatch, line 84), 405 (non-POST), or is
wrapped in a try/catch that **always acks 200** (lines 95-192, by design so Pub/Sub
doesn't retry-storm). Since the requests carry `?secret=…` (so it's not the 401
mismatch path) yet still 500, the only possible explanation is that
**`PUSH_RECEIVER_SECRET` is unset/empty on the deployed function (v13)**. The env var
the code reads ([:34](../supabase/functions/gmail-push-receiver/index.ts#L34)) has no
value, so it 500s before the comparison runs.

> Note: a non-secret uncaught throw in the pre-`try` lines 82-93 is theoretically
> possible but unlikely (`new URL`, `req.json().catch`, `createClient` with always-present
> env). The missing-secret guard is by far the most probable cause given the evidence.

### Fix
1. **Set the secret.** `PUSH_RECEIVER_SECRET` must equal the token Pub/Sub sends in
   the push-subscription endpoint URL (the `8ee166…2469f6` value visible in the logs):
   ```
   supabase secrets set PUSH_RECEIVER_SECRET="<the value Pub/Sub uses>" --project-ref ucaeuszgoihoyrvhewxk
   ```
   ⚠️ **Confirm the intended value from the Pub/Sub push-subscription config** before
   setting — don't assume the logged token is canonical vs. rotated. The function reads
   it at runtime; no redeploy needed (a redeploy forces immediate pickup if unsure).
   Cross-check the other required secrets the header documents
   ([:20-22](../supabase/functions/gmail-push-receiver/index.ts#L20-L22)): `CRON_SECRET`,
   `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`.
2. **Stop logging the secret (hygiene, recommended).** The `?secret=` query param is
   captured in Supabase request logs. The function already accepts an
   **`x-receiver-secret` header** ([:83](../supabase/functions/gmail-push-receiver/index.ts#L83)) —
   reconfigure the Pub/Sub push subscription to send the header instead of the query
   param, then the secret stays out of logs. The robust long-term path is Google OIDC
   token verification (noted in-code, [:14-18](../supabase/functions/gmail-push-receiver/index.ts#L14-L18)).
   Since this token has been logged, **rotate it** as part of the fix (update Pub/Sub +
   the function secret together).

### Verification
After setting the secret: watch the edge logs for `gmail-push-receiver` — deliveries
should flip from `500` to `200` (`{ok:true,...}`). Send yourself an email with the tab
closed and confirm a push arrives. Reference `docs/EMAIL_PUSH_PLAN_HANDOFF_2026-06-13.md`
for the full push design.

---

## Sequencing & ownership
1. **Item 2 secret** (XS, unblocks email push immediately; just a secret set + Pub/Sub
   reconfigure — external/owner env).
2. **Item 1 Layer B trace** (S, read-only) → then **Layer 1 data fix** on the
   confirmed-dev subset (gated, dry-run).
3. **Both secret-hygiene rotations** (Item 2 header switch; the Daily secret rotation
   already has `scripts/rotate-daily-webhook.ps1`).

## Open decisions for the user
1. **Item 1:** which of the 10 stale-trial workspaces are dev/owned (flip `is_trialing`)
   vs. real trials (leave)? And: fix Layer B workspace-selection too?
2. **Item 2:** confirm the canonical `PUSH_RECEIVER_SECRET` value, and whether to switch
   Pub/Sub to the `x-receiver-secret` header + rotate the logged token.

---

*Drafted from a read-only investigation (live code + DB + edge logs, project
`ucaeuszgoihoyrvhewxk`, 2026-06-16). No code, schema, secret, or data changed.*
