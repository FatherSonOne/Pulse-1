# Slack-Grounded Messages — Backlog Handoff (resume point)

> **Created:** 2026-06-08 · **Type:** continuation handoff. The feature is **shipped and the
> two-way loop is LIVE-VERIFIED end-to-end.** This doc is the remaining backlog + the hard-won
> operational facts so the next session resumes without re-discovering them.
> **Read first:** `docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md` (the contract),
> `docs/SLACK_PUBLIC_DISTRIBUTION_SCOPE_2026-06-07.md` (distribution work-item),
> memory `project_pulse_slack_messages_grounding` + `reference_pulse_messages_auth_fks`.

---

## 1. DONE (shipped + verified) — do not rebuild

| Piece | State | Anchor |
|---|---|---|
| Shadow `auth.users` mint (4 trigger guards + `ensure_slack_shadow_user`) | applied | migrations `20260607061411`, `20260607061845` |
| P2 send-as-you (endpoint + `get_or_create_slack_conversation` + UI) | **live-verified** | `server.js` `POST /api/slack/send`; migration `20260607124444`; `Messages.tsx` `sendPulseMessage` slack branch |
| P4 rendering (identity synthesis + gating + plum chip) | shipped | `pulseService.getConversations` synthesis; `Messages.tsx` `isSlackConv`; `ConversationSidebar.tsx` |
| P3 inbound Events edge fn + atomic ingest | **live-verified** | `supabase/functions/slack-events/index.ts` (**ACTIVE v4**, verify_jwt=false); `ingest_slack_inbound_message` (migrations `20260607134149` + `20260607135538`) |
| P5 graduation **DB** (resolver + conditional MERGE + graduation-aware ingest) | applied, adversarial-reviewed | `resolve_pulse_user_by_email` (`20260607142338`), `graduate_slack_conversation` (`20260607143750`), fixes (`20260607143842`) |
| Front-door (start a Slack DM + realtime conv sub) | shipped | `server.js` `POST /api/slack/conversation`; `slackUserConnect.ts` `startSlackUserConversation`/`sendSlackUserMessage`; `Messages.tsx` `startSlackConversationByEmail` + conversation realtime `useEffect`; `MessagesTopModals.tsx` `SlackDmStarter`; `pulseService.subscribeToConversations` |

**Commits (all on `origin/main`):** `e68744c`, `18acc23`, `6db5f30`, `9c34533`, `fdc1c14`,
`6de821c`, `809064f`, `ef17b70` (front-door), `6f85645` (distribution doc), `3861dc7` (redeploy),
plus `9c451fd` (**3.1 graduation prompt UI — client half**, 2026-06-08).
**Flag:** `slackMessagesGrounding` (FeatureContext, surfaced as **Settings → Features & Labs →
Integrations (Beta) → "Slack in Messages (Beta)"**). Must be ON for the front-door UI.
**Diagnostics removed:** the temporary `slack_inbound_debug` table is DROPPED; `slack-events` is the
clean committed build (v4). Working tree clean.

---

## 2. Live environment facts (verified this session — don't re-derive)

- **Connected Slack:** workspace **Qntmecos**, team **`T0B63H511LJ`**, user **`U0B5X67Q7A7`**
  (display "Frank Messana", email `fm1@qntmecos.com`). The **"Pulse Smoke"** app is installed **only
  in Qntmecos**. A second workspace "Quantum Ecosystems" exists with FM2 but **no Pulse app** there.
- **Slack app config (correct):** Event Subscriptions → `message.im` under **"Subscribe to events on
  behalf of users"** (scope `im:history`); Request URL
  `https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/slack-events`; `SLACK_SIGNING_SECRET` set as
  the Supabase **edge** secret. All confirmed working (real inbound ingested).
- **Two Pulse logins are connected to the SAME FM1@Qntmecos token** (`user_slack_tokens`):
  `feedaa8d-1f48-4ad1-b757-11c7b79b7510` (original, `jehovahsneaky83@gmail.com`) + `0bea47c3-…`
  (newer). The edge fn routes inbound to the **oldest** (`feedaa8d`) via `.order(created_at).limit(1)`
  — so **test/view in the `jehovahsneaky83@gmail.com` Pulse login.** (Proper fix = item 4.2.)
- **Seed test thread still exists:** `pulse_conversations` `536ae76a-8fcc-407c-aded-32989cf019c4`
  (operator ↔ a shadow of the operator's OWN slack id = a self-loop). Safe to delete (it only ever
  confuses testing). The real verified inbound thread is `e7380c8c-…` (jehovahsneaky83 `U0B675R9D44`).

### The test recipe that actually works (write this on a sticky note)
Inbound only fires for a DM **to the connected account (FM1/`U0B5X67Q7A7`), INSIDE Qntmecos
(`T0B63H511LJ`), from a DIFFERENT user.** Self-DMs are echo-filtered; cross-workspace (e.g. FM2 in
"Quantum Ecosystems") never reaches Pulse. Verified path: as **jehovahsneaky83** in Qntmecos → DM FM1.

---

## 3. Backlog (the work to finish, priority order)

### 3.1 — Graduation prompt UI (P5 client half) — ✅ SHIPPED (commit `9c451fd`, pushed) · live-verify pending
**Goal:** when a Slack counterpart is also a Pulse user (matched by email), offer one-tap
"X is now on Pulse — switch to native?" and flip the thread.

**What shipped (2026-06-08):** an emerald (not-coral) banner under the slack-thread chat header,
gated on `slackMessagesGrounding`, per-session dismissible. On opening a `transport='slack'` thread
it resolves the candidate (`resolveGraduationCandidate` → `resolve_pulse_user_by_email`); on confirm
it calls `graduateSlackConversation` → `graduate_slack_conversation`, re-points
`activePulseConversation` to the returned surviving id (CASE A == same id, CASE B == native id),
reloads messages, and toasts "Now on Pulse — messages are native". Service wrappers live in
`slackUserConnect.ts`; UI + effect + handler in `Messages.tsx`. tsc: no new errors.
**Deferred:** the "Now on Pulse" history divider (still §10 below — needs a per-message watermark).
L2 auto-after-prompted needs **no** client logic — `ingest_slack_inbound_message` already routes
post-graduation inbound into the native thread, so no second slack thread is ever forked.
**STILL TO DO — live-verify:** seed a graduatable case (a slack thread whose `external_email` matches
a real Pulse user) and confirm the flip swaps live + preserves history both sides, for BOTH CASE A
(flip-in-place) and CASE B (a native thread already existed → merge-then-delete). Engine dry-run
already proved the DB MERGE; the client swap (active-id re-point + message reload) is type-checked
but not yet runtime-confirmed.

---
**Original notes (reference):**
- **On opening a `transport='slack'` thread:** call the resolver
  `supabase.rpc('resolve_pulse_user_by_email', { p_email: conv.external_email })`. If it returns a
  uuid (non-null), the counterpart is on Pulse → show the prompt. (Resolver is oracle-guarded: the
  caller must own a contact with that email — the L3 auto-created slack contact satisfies this.)
- **On confirm:** `supabase.rpc('graduate_slack_conversation', { p_shadow_conversation_id: conv.id })`.
  It returns the **surviving conversation id** — in CASE B (a native thread already existed) that id
  **differs** from the shadow conv id, so **re-point `activePulseConversation` to the returned id**
  (the shadow conv is deleted).
- **Live swap:** `pulseService.subscribeToConversations` (already wired in `Messages.tsx`) fires on the
  UPDATE/INSERT and refetches — so the thread re-renders native (plum chip drops, presence/typing/
  receipts re-enable) without a refresh. Add a subtle "Now on Pulse · messages are native" divider
  above the migrated history (scope §10).
- **Auto-after-prompted (L2):** once confirmed for a person, auto-graduate thereafter (persisted via
  `contacts.pulse_user_id`, which `graduate_slack_conversation` already sets).
- **Files:** `Messages.tsx` (a banner/affordance in the slack-thread header near `isSlackConv`), a thin
  client call. **Rule A:** touches the live Messages render path — additive only.
- **Verify:** seed a graduatable case (a slack thread whose `external_email` matches a real Pulse
  user) and confirm the flip swaps the thread live + preserves history both sides; dry-run already
  proved the DB MERGE (both CASE A flip-in-place and CASE B merge-then-delete).

### 3.2 — Multi-login / multi-tenant inbound routing fix
**Problem:** `processInboundEvent` resolves the owner by `team_id` + oldest token — ambiguous once
>1 Pulse user connects (already true: two `feedaa8d`/`0bea47c3` rows for FM1).
**Fix:** route by the Events envelope's **`payload.authorizations[0].user_id`** (the Slack user the
event was delivered for) → `user_slack_tokens.slack_user_id` → owner, falling back to `team_id`.
Verify the envelope shape (`authorizations: [{ team_id, user_id, is_bot }]`; org-wide installs may
need `apps.event.authorizations.list`). **File:** `supabase/functions/slack-events/index.ts`. Also
decide whether to dedup the two existing FM1 tokens. (Same change is a prerequisite for 3.3.)

### 3.3 — Public distribution (open Slack-connect beyond Qntmecos)
Full scope in **`docs/SLACK_PUBLIC_DISTRIBUTION_SCOPE_2026-06-07.md`**. Summary: Slack dashboard
→ **Activate Public Distribution**; ship the 3.2 routing fix; per-workspace install re-check;
2-tenant test; (Marketplace listing only if you want to be listed). ~½–1 day + review-gated listing.

### 3.4 — P6 hardening
- 429 / `Retry-After` backoff on the send path (`server.js` `/api/slack/send`) before any volume.
- Audit: confirm no `xoxp-` ever routes through the open bot proxy (`server.js:139`, D7).
- Channels/threads/history-backfill stay OUT (their own flags) — L4 go-forward only.

### 3.5 — Small cleanups (optional)
- Delete the seed self-loop thread `536ae76a` (+ its messages + the shadow if orphaned).
- Front-door "that's you" guard: if `POST /api/slack/conversation` resolves the email to the
  operator's own connected `slack_user_id`, reject with a friendly "that's your own account" (the user
  hit this confusion — messaging fm1 from the fm1-connected Pulse login made a self-loop thread).

---

## 4. Gotchas this session paid for (don't relearn them)

1. **Workspace mismatch was the #1 time-sink.** Pulse only sees the workspace it's installed +
   token-connected to (Qntmecos). Testing in any other Slack workspace silently produces nothing.
2. **Echo filter:** the operator's OWN slack id is skipped on inbound (so send-as-you doesn't double).
   → you can never test inbound by messaging yourself / a self-DM.
3. **"Connect Slack" uses the browser's active Slack session** + the app is single-workspace, so it
   only offers the Qntmecos account. Multi-account testing needs a separate browser/incognito session.
4. **Repo `tsc` globs the Deno edge functions** → `slack-events` adds ~5 "Cannot find name 'Deno' /
   module" false-positives (baseline went 917 → 922). Gate on **no NEW** errors; the edge fn's real
   gate is a successful `deploy_edge_function` (it bundles/validates) + live probes.
5. **Diagnose with a debug table, don't keep guessing.** The empty/then-populated `slack_inbound_debug`
   trace is what finally pinpointed "no event arriving" vs "arriving but skipped." Re-create it the
   same way if inbound ever regresses (insert at each decision point; service-role; drop after).
6. **`docs/*.md` is gitignored** — commit docs with `git add -f` (allowlisted name patterns incl.
   `_HANDOFF_`). **`server.js` not in tsc/vitest** — verify with `node --check`.

---

## 5. Start-here for the next session
1. Read the contract + this doc + memory `project_pulse_slack_messages_grounding`.
2. **3.1 (graduation prompt UI) is SHIPPED** (`9c451fd`). First task: **live-verify the flip** (seed a
   graduatable slack thread, confirm CASE A + CASE B swap live — see 3.1's "STILL TO DO"). Then pick up
   **3.2 (multi-login inbound routing)**, the prerequisite for 3.3 public distribution.
3. Each piece: flag-gated, tsc-no-new-errors, commit independently with explicit paths (a parallel
   command-palette session also commits to `main`).
