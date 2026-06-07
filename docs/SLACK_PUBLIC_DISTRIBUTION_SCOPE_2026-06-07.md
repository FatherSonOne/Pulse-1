# Slack Public Distribution — Scope (let any user connect their own Slack)

> **Created:** 2026-06-07 · **Type:** scope / work-item for a post-launch fast-follow.
> **Context:** Slack-grounded Messages shipped single-tenant (L1). This doc scopes opening
> Slack-connect beyond the one Qntmecos workspace so **any Pulse user connects their own Slack**.
> **Prereq reading:** `docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md` (L1 lock), memory
> `project_pulse_slack_messages_grounding`.

---

## 1. Why this is needed

Today the "Pulse Smoke" Slack app (App ID `A0B6SUJDAUX`, workspace **Qntmecos** `T0B63H511LJ`)
is **"Not distributed"** — a single-workspace app. A non-distributed Slack app can **only be
authorized by members of the workspace it was created in.** So every "Connect Slack" in Pulse
resolves to a Qntmecos account; a user in any other workspace literally cannot complete OAuth.

This was the deliberate L1 launch posture (no Slack review, keeps the higher internal-app rate
limits). Opening it up is the fast-follow.

## 2. What already works (no change)

- **Per-user token broker.** `user_slack_tokens` is keyed by `user_id`, one row per Pulse user,
  storing that user's `xoxp-` + `slack_team_id` + `slack_user_id`. Multi-user is already the model.
- **Signed-state OAuth callback** (`server.js` `/api/slack/auth/*`) — public redirect, HMAC state,
  no workspace pinned in the authorize URL (no `team` param), so the consent screen already lets a
  user pick their workspace **once the app is distributed**.
- **One signing secret per app** — shared across all installs; the `slack-events` HMAC verify is
  unchanged for multi-workspace.
- **No history/backfill** (L4 go-forward only) — so the May-2025 distributed-app rate-limit cliff
  (`conversations.history` 1 req/min) is largely moot for the 1:1 send/receive path.

## 3. The Slack-dashboard step (the actual unlock)

1. api.slack.com/apps → **Pulse Smoke** → **Manage Distribution** → **Activate Public Distribution**.
   - Requires: redirect URL(s) set (already are), no client secret in client code (✓), and the
     "Add to Slack" hardening checklist Slack shows.
   - This enables OAuth for **any** workspace (the "Add to Slack" / install-to-your-workspace flow).
2. **Broad/listed reach (optional, later): Slack Marketplace** review — security review + scope
   justification + branding. Only needed to be *listed*; direct-install via the Add-to-Slack URL
   works without listing once Public Distribution is on. NOTE: a *distributed, non-Marketplace* app
   hits the rate-limit cliff for `conversations.history` — fine for us (no backfill), but re-check
   before adding any channel/history features.

## 4. Code/back-end changes required (the real engineering)

Most of the stack is multi-tenant-ready; the **one load-bearing change** is owner resolution in the
inbound Events fn:

- **`supabase/functions/slack-events/index.ts` — resolve the operator by the AUTHED user, not by
  team_id alone.** Today `processInboundEvent` does
  `.from('user_slack_tokens').eq('slack_team_id', teamId).limit(1)` — correct for one operator per
  workspace, but **ambiguous/wrong once two users connect the same workspace or many workspaces
  exist.** Fix: use the Events envelope's `authorizations[0].user_id` (the Slack user the event was
  delivered for) → look up `user_slack_tokens` by **`slack_user_id`** (falling back to team_id), so
  each event routes to the exact operator whose subscription delivered it. (Verify the envelope
  shape: `payload.authorizations` is an array of `{ team_id, user_id, is_bot, … }`; for org-wide
  installs you may need `apps.event.authorizations.list`.)
- **OAuth callback — handle the per-workspace install** (`server.js`): already stores team_id; just
  confirm a user re-connecting from a different workspace upserts cleanly (the unique key is
  `user_id`, so one Slack identity per Pulse user — decide if multi-workspace-per-user is allowed or
  one-at-a-time; v1 = one).
- **`ensure_slack_shadow_user` / `get_or_create_slack_conversation`** — already keyed by
  `(team_id, slack_user_id)` and `(pulse_user, shadow)`, so they're naturally multi-tenant. No change.
- **Rate-limit handling (P6 carry-over):** add 429 / `Retry-After` backoff to the send path before
  any volume; not required for low-volume 1:1.

## 5. Test plan

1. Activate Public Distribution.
2. From a **second, unrelated Slack workspace**, a different Pulse user clicks Connect Slack →
   completes OAuth → `user_slack_tokens` gets their row (their team_id, their slack_user_id).
3. Inbound: someone DMs that user in *their* workspace → the Events fn routes via
   `authorizations[].user_id` to the right Pulse user → lands in *their* Messages (not the operator's).
4. Outbound: that user sends from Pulse → posts as them in their workspace.
5. Confirm no cross-tenant leakage (user A never sees user B's Slack threads — guaranteed by the
   per-user participant + RLS, but verify with two real tenants).

## 6. Effort estimate

- Slack dashboard: minutes (Activate Public Distribution).
- Code: the `authorizations[].user_id` owner-resolution change in `slack-events` + a callback
  re-check + a 2-tenant test pass. ~½–1 day. Marketplace listing (if pursued) is separate + review-gated.

## 7. Not in scope here

Channel/multi-party mirroring, history backfill, token rotation/refresh, Marketplace listing copy —
each tracked under its own flag/decision in the grounding scope doc §6.
