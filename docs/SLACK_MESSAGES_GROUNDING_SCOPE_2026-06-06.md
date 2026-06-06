# Slack-Grounded Messages — Locked Scope & Phased Plan

> **Created:** 2026-06-06 · **Type:** locked scope doc + phased implementation plan.
> **Predecessor handoff (the input):** `docs/SLACK_MESSAGES_GROUNDING_HANDOFF_2026-06-06.md`.
> **Prior shipped work:** Slack send + per-contact identity (contactsHybrid Phase 8) — `docs/SLACK_PHASE8_SCOPE_2026-06-05.md`, commits `65609aa → 5e1c271`.
> **Status:** Investigation COMPLETE (grounded, adversarially verified). Decisions LOCKED. **No implementation code yet.** This doc is the contract for the build.
> **Feature flag (new):** `slackMessagesGrounding` (FeatureContext, **default OFF**). Everything below ships behind it; Messages Path D is preserved (CLAUDE.md Rule A).

---

## 0. How this was produced (provenance)

A multi-agent investigation workflow (7 parallel readers over the surface / data model / unified-inbox / OAuth / Events API / identity-graduation / cold-start, → 5 adversarial verifiers on the load-bearing claims → 1 synthesizer) ran against the **real code + live schema** (project `pulse-chat`, ref `ucaeuszgoihoyrvhewxk`). Every claim below carries `path:line` or a live `pg_catalog` query as evidence. The adversarial layer **caught and corrected a load-bearing schema error in the original handoff** (see §2). Confidence is marked HIGH/MEDIUM per claim; MEDIUM items are flagged "verify at implementation."

---

## 1. The four launch decisions (locked by the user, 2026-06-06)

| # | Decision | Locked answer |
|---|----------|---------------|
| L1 | **Distribution posture** | **Single-tenant for v1** — operator installs the Slack app to their OWN workspace. No Slack review; retains the internal-app rate limits. Public "Add to Slack" is a post-Marketplace-approval fast-follow. |
| L2 | **Graduation behavior** | **Prompted first, then auto** — one-tap "X is now on Pulse — switch to native?" on first detection; auto thereafter. Guards against wrong email matches. |
| L3 | **Unknown inbound** | **Auto-create a contact** (keyed by `slack_user_id`) so the thread renders immediately. Keeps Messages non-empty — the whole point. |
| L4 | **DM history** | **Go-forward only (no backfill)** — ingest only DMs that arrive after connect (via Events). No bulk `conversations.history` pull → smaller privacy surface + lower rate-limit exposure. |

These compound on the strategic lock from the handoff §9: **full two-way mirroring · Slack user-OAuth · at launch.**

---

## 2. Corrected assumptions (the handoff was wrong on the crux — fixed here)

> **Read this before designing anything.** The original handoff's "VERIFIED SCHEMA" note was wrong on the single most load-bearing fact, and the whole transport mechanism changes as a result.

| Handoff claim | Verified reality (live `pg_constraint`, 2026-06-06) |
|---|---|
| "**NO FK** on `user1_id`/`user2_id`; a synthetic uuid would NOT violate any FK." | **FALSE.** All four participant columns carry a **validated FK → `auth.users(id) ON DELETE CASCADE`**: `pulse_conversations_user1_id_fkey`, `pulse_conversations_user2_id_fkey`, `pulse_messages_sender_id_fkey`, `pulse_messages_recipient_id_fkey`. Also live: `different_users` CHECK (`user1_id<>user2_id`), `no_self_message` CHECK (`sender_id<>recipient_id`), and `idx_pulse_conversations_unique_pair` UNIQUE on `(LEAST(user1_id,user2_id), GREATEST(user1_id,user2_id))`. **A bare synthetic uuid fails `foreign_key_violation` — `service_role` bypasses RLS but NOT foreign keys.** *Why the handoff missed it:* `information_schema.constraint_column_usage` silently omits FKs whose referenced table is in the `auth` schema. **Always query `pg_constraint` for auth-referencing FKs.** (Memory: `reference_pulse_messages_auth_fks`.) |
| "metadata-only (option c) is viable." | `pulse_messages.metadata jsonb DEFAULT '{}'` is real and is the correct **per-message** provenance seam (`{transport:'slack', slack_ts, slack_channel}`), but it is a **complement**, not a substitute: `getConversations` resolves the other party via `user_profiles` by participant uuid (`pulseService.ts:276-289`) — there is no place to render an external identity in the conversation list from message metadata alone. |
| "Re-point existing rows is a clean default for graduation." | It is a **conditional MERGE, not a plain re-point.** The unique-pair index throws if a native conversation already exists for `(owner, real-counterpart)`. See §10. |
| "Scope set `{chat:write, im:history, im:read, users:read, users:read.email}` is correct & minimal." | Neither minimal nor complete: the endorsed send flow calls `conversations.open` (`slackService.ts:236`), which requires **`im:write`** (missing); `im:read` is NOT required to receive `message.im` or read DM history (`im:history` suffices). Corrected set in §8. *(MEDIUM confidence — Slack-platform claim; verify against the Slack app config at implementation.)* |
| "Distribution review is a days–weeks AT-LAUNCH dependency." | Overstated for L1. Own-workspace/undistributed install needs **no Slack review**; only Marketplace listing is reviewed. The real reason to ship single-tenant is the **May-2025 rate-limit cliff**: non-Marketplace *distributed* apps are throttled to `conversations.history` 1 req/min / 15 objects, while *internal single-workspace* apps keep 50+/min / 1,000 objects. *(MEDIUM — verify.)* |
| "There's somewhere to persist a contact's Pulse identity after graduation." | **`contacts.pulse_user_id` does not exist** (live: column absent; only `platform`, `external_id`, `slack_user_id`). Graduation persistence **requires an additive `contacts.pulse_user_id uuid` column** + `dbToContact` mapping, else `pulseUserId` reverts to External on every refetch. |
| "`webhookService.ts` could be the Slack inbound entry point." | **Do NOT use it.** Dormant, zero production callers, browser-side, and WRONG HMAC (signs over `JSON.stringify(payload)`, `===` compare). Slack signs the RAW body via `v0:{timestamp}:{rawBody}`. |

---

## 3. Crux verdict (the central feasibility question)

**YES — the Messages model can carry a Slack-backed thread end-to-end, via this corrected mechanism:**

- Represent the **Slack counterpart as a real shadow `auth.users` row** — deterministic id = `uuidv5('slack:' + team_id + ':' + slack_user_id)`, minted **once** via service-role (`auth.admin.createUser` or a service-role insert). Feasible because the only NOT NULL / no-default columns on `auth.users` are `id`, `is_sso_user` (default `false`), `is_anonymous` (default `false`) — live-verified. The shadow id then satisfies **all four FKs**, both NOT NULL participant columns, and both CHECKs (shadow id ≠ Pulse id).
- The **Pulse user always occupies their own side** (`user1_id`/`user2_id` and `sender_id`/`recipient_id`), so existing **RLS** (`auth.uid()`-keyed) and the existing client read paths (`getConversations`/`getMessages`/`subscribeToMessages`) work **verbatim** — no read-path change.
- **Inbound** (sender = the Slack human) is written by a **service-role Events edge function**. The user's own client cannot write it — double-locked by `pulse_messages` `INSERT WITH CHECK (sender_id=auth.uid())` AND `send_pulse_message`'s `_assert_caller_is`. Both tables are in the `supabase_realtime` publication, and `postgres_changes` is RLS-filtered on the **subscriber** (the Pulse user as `recipient_id`), so the service-role insert **broadcasts live to the open thread with no refetch.** (HIGH confidence — verified against migrations + Supabase's documented per-subscriber RLS-read model.)
- **Outbound** flows through the existing `send_pulse_message` RPC (Pulse user = `p_sender_id`, shadow uuid = `p_recipient_id`); a new authenticated server endpoint then relays the text to Slack as the human (see §7/§8).

---

## 4. Verified as-is (the architecture this layers onto)

**Messages surface (Reader A — HIGH):**
- One conversation list `pulseConversations`, loaded exclusively from `pulseService.getConversations()` (`Messages.tsx:805`, set ~9 places). Filtered to rows WITH `other_user` (`Messages.tsx:2798-2801` `validPulseConversations`), virtualized, rendered by `ConversationSidebar.tsx` which `return null`s without `other_user` (`:246-247`).
- Active Pulse-DM composer = **`PulseComposer`** inside `MessageInputPortal(usePortal=false)` (`Messages.tsx:4824-4851`); `onSend → sendPulseMessage → pulseService.sendMessage(other_user.id, content) → RPC send_pulse_message` (`pulseService.ts:360-379`). `MessageInputSection` is the *separate* legacy Thread/SMS composer — not the Pulse-DM path.
- **10 seams hard-wire a Pulse participant** and must be branched on a `transport` discriminator (all additive, no deletions): identity/name (`:4160`,`:3696`), avatar (`:3680-3684`, `ConversationSidebar:268-272`), presence `OnlineIndicator` (`:3686`, `ConversationSidebar:275`), me/them via `sender_id !== other_user.id` (`:4140`), typing (`:1131-1156`,`:4840`), READ/DELIVERED receipts (`:4493-4497`), verified badge/role (`ConversationSidebar:277-299`), contact-panel open (`:3670-3676`), list filter (`:2798`), send transport (`:1342-1377`), realtime ingest (`pulseService.ts:710-730`).

**Data model & write paths (Reader B + verifiers — HIGH):**
- No raw TS inserts — both writes are SECURITY DEFINER RPCs (`get_or_create_conversation`, `send_pulse_message`) hardened in `20260503000003_definer_lockdown.sql` (null-safe `auth.uid()` guards; `_assert_caller_is` at `:39-44,:64`). `send_pulse_message` has **no metadata param** (`:51-57`).
- `subscribeToMessages` (`pulseService.ts:704-730`) is an **unfiltered** whole-table `pulse_messages` INSERT subscription with a **client-side** filter at `:728` (`sender_id !== user.id && recipient_id !== user.id → return`); dedup lives in `Messages.tsx`, not here. An inbound row with `recipient_id = the Pulse user` passes `:728`.

**Unified Inbox (Reader C — HIGH): WRONG live store.** `unified_messages` is flat-inbox-shaped (the only thread structure, `buildConversationGraph`, is in-memory + never persisted/read), has a live **write/read schema split** (`unifiedInboxDb` writes `platform/is_starred/content_type`; `dataService` reads `source/starred/message_type`), and its `(user_id,platform,external_id)` upsert key has **no backing unique constraint** (only the `id` PK) → re-sync can't dedup. **Reuse only as a one-time cold-start contacts/identity import**, never as the runtime message store. Reply there is a `console.log` stub (`UnifiedInbox.tsx:367-371`).

**OAuth landscape (Reader D — HIGH):** No Slack OAuth exists (`server.js` has only the bot proxy at `:139`). The pattern to mirror is the **Gmail per-user block** (`server.js:476-663`): HMAC signed-state for the public callback (`signGmailState/verifyGmailState :500-516`), service-role `tokenStoreClient()` (`:299-301`), `onConflict:'user_id'`. logos-vision (hardcoded `localhost:5176`) and CRM (base64-in-URL, no DB) are the WRONG templates.

**Events receiver pattern (Reader E — HIGH):** Mirror **`billing-webhook`** (raw `await req.text()` BEFORE parse, then verify) for the security model; mirror `daily-webhook` only for the service-role client + json helper skeleton. `daily-webhook` declares but never verifies its signature — not a security model. Service-role client = `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`. No existing constant-time comparator — net-new helper.

**Identity & graduation (Reader F — HIGH):** "On Pulse" is `Contact.pulseUserId` (in-memory, only set by the workspace `discover_pulse_users` RPC; **`contacts` has no `pulse_user_id` column** and `dbToContact` never maps one). The email→Slack primitive is `slackService.lookupUserByEmail → contacts.slack_user_id` (Phase 8). The only email→Pulse-user resolver (`discover_pulse_users`) is workspace-gated + email-blind — a **new global SECURITY DEFINER `resolve_pulse_user_by_email`** is needed. The client subscribes to `pulse_messages` INSERT only — a transport flip needs a **new `pulse_conversations` UPDATE subscription** to surface live.

---

## 5. Locked design decisions (D1–D8)

- **D1 · Scope — LOCKED full two-way (handoff §9).** Launch slice = **1:1 DM threads end-to-end** (send-as-you + live inbound + graduation). Multi-party channels/threads = post-launch fast-follow (the 1:1 path is architecturally self-contained — it does not need channel infra).
- **D2 · Transport model — additive columns + REAL shadow `auth.users` row** (NOT a bare synthetic uuid; see §2/§3). Conversation-level identity via new `pulse_conversations` columns; per-message provenance via existing `metadata jsonb`. Reject parallel external tables (forks read paths, high blast radius) and metadata-only (no place to render external identity in the list). `userFacing: false`.
- **D3 · Slack user-OAuth — LOCKED YES.** New Slack app + `user_slack_tokens` table + 4 Gmail-mirrored routes + signed state. Single-tenant (L1). `userFacing: false`.
- **D4 · Real-time inbound — REQUIRED Events API edge fn.** Locked by D1. `userFacing: false`.
- **D5 · Graduation — PROMPTED then auto (L2).** Detect via new global `resolve_pulse_user_by_email`; flip = conditional service-role MERGE. `userFacing: true`.
- **D6 · Messages UI provenance — transport discriminator branches the 10 seams.** Slack = **plum marker only**; coral never used; rose = Send. Gate OFF presence/typing/receipts for `transport='slack'`. `userFacing: true`.
- **D7 · Proxy auth hardening — new authenticated send endpoint; xoxp- injected server-side.** Do NOT route the user token through the open body-token proxy (`server.js:139`). Bot reads stay on the proxy unchanged. `userFacing: false`.
- **D8 · Phase-8 coexistence — KEEP BOTH tokens.** Bot (`xoxb-`, localStorage) keeps powering reads + Contacts send-as-bot; user (`xoxp-`, server-side `user_slack_tokens`) is added only for Messages send-as-you + reading the operator's own DMs. `contacts.slack_user_id` is the shared identity key. `userFacing: true`.

---

## 6. In scope / Out of scope

**In scope (launch, behind `slackMessagesGrounding` OFF):**
1. Additive `pulse_conversations` columns (`transport`, `external_slack_user_id`, `external_email`, `external_display_name`) + per-message `metadata.transport` tagging.
2. Shadow `auth.users` row per Slack counterpart (deterministic uuidv5, service-role minted).
3. New `user_slack_tokens` table (RLS-on, service-role-only), modeled on `user_google_tokens`; **no** `refresh_token`/`expiry_date` (non-expiring tokens, L1 single-tenant).
4. Additive `contacts.pulse_user_id uuid` + `dbToContact` mapping (graduation persistence).
5. Slack user-OAuth broker: 4 routes mirroring the Gmail block + `signSlackState`/`verifySlackState` + `slackOauthConfigured()`.
6. New **authenticated** send-as-you endpoint (server-injects `xoxp-`).
7. `slack-events` edge fn: `v0` HMAC verify + 5-min replay window + constant-time compare + `url_verification` handshake + echo filter + `slack_ts` de-dup + service-role write.
8. Messages UI: `transport` discriminator branching the 10 seams; Slack plum marker; external-identity avatar/name fallback.
9. 1:1 DM **send-as-you** (`conversations.open` + `chat.postMessage` as the human).
10. Live 1:1 **inbound** DM delivery via Events → service-role insert → existing realtime subscription. **Go-forward only (L4 — no backfill.)**
11. **Auto-create a contact** for inbound from an unknown Slack person (L3).
12. Graduation: `resolve_pulse_user_by_email` + **prompted-then-auto** flip as a conditional MERGE + new `pulse_conversations` UPDATE subscription.
13. Single-tenant Slack app install (L1).
14. Every phase behind `slackMessagesGrounding` (OFF), independently committable, verified (tsc-no-new-errors + vitest).

**Out of scope (fast-follow / explicitly deferred):**
- Multi-party channel mirroring + threads/Block-Kit (needs channel scopes + a multi-party model the 2-slot conversation lacks).
- **Bulk inbound history backfill** (L4 says go-forward only; backfill multiplies `conversations.history` rate-limit exposure; the proxy has no 429/Retry-After handling).
- Slack Marketplace public-distribution listing + public "Add to Slack" (review + the May-2025 rate-limit cliff).
- Slack token rotation + a refresh route (default tokens are non-expiring).
- `slack_received` analytics increment (deferred per Phase-8 doc §74).
- Migrating bot-token reads to the user token (destructive to the working Phase-8 read path — Rule A).
- Routing anything through `webhookService.ts`.
- Using `unified_messages` as the live thread store.
- SMS (separate launch-blocker, still mocked).
- Reworking me/them rendering to read `metadata.direction` (avoided by using a real shadow uuid for the Slack sender).

---

## 7. Schema sketch (DRY-RUN-FIRST — do not apply blind)

> Discipline per CLAUDE.md: wrap every block in `DO $$ BEGIN … RAISE EXCEPTION 'rollback'; END $$;` until it runs clean, THEN `ALTER`/`CREATE` once. Re-confirm the 4 FKs + unique-pair index + both CHECKs are still live with `pg_constraint` immediately before applying. Do NOT infer column types from convention (`contacts.user_id` is `text`, a known gotcha).

```sql
-- (1) Conversation-level external identity (additive, default-safe; existing rows untouched, transport='pulse')
ALTER TABLE public.pulse_conversations
  ADD COLUMN IF NOT EXISTS transport               text NOT NULL DEFAULT 'pulse',
  ADD COLUMN IF NOT EXISTS external_slack_user_id   text,
  ADD COLUMN IF NOT EXISTS external_email           text,
  ADD COLUMN IF NOT EXISTS external_display_name    text;
-- Per-message provenance: NO migration — reuse pulse_messages.metadata jsonb (DEFAULT '{}'):
--   metadata = { transport:'slack', slack_ts:<event.ts>, slack_channel:<event.channel> }

-- (2) Graduation persistence (additive; contacts has NO pulse_user_id today — verified absent)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS pulse_user_id uuid;   -- uuid to match auth.users (note: contacts.user_id is TEXT — do not copy that)
-- + dbToContact must map it, else pulseUserId reverts to External on every refetch.

-- (3) Slack user-token table (NONE exists; modeled on user_google_tokens).
--     NO refresh_token/expiry_date — Slack user tokens are non-expiring unless rotation is enabled (out of scope).
CREATE TABLE IF NOT EXISTS public.user_slack_tokens (
  user_id       uuid NOT NULL,
  access_token  text NOT NULL,                   -- the xoxp- USER token (authed_user.access_token)
  scope         text,
  slack_user_id text,                            -- authed_user.id
  slack_team_id text,                            -- team.id
  bot_user_id   text,
  token_type    text DEFAULT 'user',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT user_slack_tokens_user_id_key UNIQUE (user_id)
);
ALTER TABLE public.user_slack_tokens ENABLE ROW LEVEL SECURITY;
-- Deny-all to clients; read/write ONLY via the service-role tokenStoreClient (mirror user_google_tokens).
-- Pin search_path=public,extensions,pg_temp on any helper funcs (DB security baseline).

-- (4) Shadow Slack participant (NOT DDL — runtime, service-role): mint ONCE per Slack user
--   id = uuidv5('slack:'||team_id||':'||slack_user_id)  via auth.admin.createUser / service-role insert
--   (only auth.users.id is NOT NULL/no-default; is_sso_user/is_anonymous default false — feasible).
--   This id occupies user1_id/user2_id + sender_id/recipient_id of the Slack side, satisfying all 4 FKs
--   + different_users + no_self_message.
```

---

## 8. OAuth contract (mirror the Gmail per-user block, `server.js:476-663`)

- **Env:** `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_OAUTH_REDIRECT_URI` + a `slackOauthConfigured()` guard cloning `gmailConfigured()`.
- **Signed state:** add `signSlackState`/`verifySlackState` as byte-for-byte copies of `signGmailState`/`verifyGmailState` (`:500-516`) — the callback is a public redirect with no Bearer, so user attribution is the HMAC over `{uid,exp}` (10-min validity, `timingSafeEqual`).
- **Token store:** read/write `user_slack_tokens` ONLY via the service-role `tokenStoreClient()` (`:299-301`), `onConflict:'user_id'`. The `xoxp-` token **never reaches the browser**.
- **Four routes (clone the Gmail set):**
  - `GET /api/slack/auth/url` → `resolveUserId` → `https://slack.com/oauth/v2/authorize?client_id=…&user_scope=<USER_SCOPES>&redirect_uri=…&state=signSlackState(uid)`
  - `GET /api/slack/auth/callback` → `verifySlackState` → POST `https://slack.com/api/oauth.v2.access` (form-encoded `{client_id,client_secret,code,redirect_uri}`) → persist `authed_user.access_token` AS `access_token`, `authed_user.id` AS `slack_user_id`, `team.id` AS `slack_team_id` → redirect `${appUrl}/?slack=connected`
  - `GET /api/slack/status` → `resolveUserId`, `{connected:!!row, configured:slackOauthConfigured()}`
  - `DELETE /api/slack/disconnect` → delete row (optional `auth.revoke`)
- **Slack-specific gotchas a naive Google-mirror gets wrong (MEDIUM — verify against Slack app config):**
  1. USER scopes go in the **`user_scope`** query param, NOT `scope` (`scope` = bot scopes).
  2. The `xoxp-` user token is **nested at `authed_user.access_token`**, not top-level (that's the `xoxb-` bot token).
  3. Token exchange is a **raw form-encoded fetch** (mirror `server.js:613-621`), not an SDK `getToken()`.
  4. Tokens are **non-expiring** unless rotation is enabled → **no refresh route** (omit/501-stub); handle `invalid_auth` by deleting the row + prompting reconnect (mirror the Gmail `invalid_grant` branch `:625-632`).
- **Corrected launch user-scope set:** `chat:write`, **`im:write`** (required by the `conversations.open` call, `slackService.ts:236`; the original set omitted it), `im:history`, `users:read`, `users:read.email`. (`im:read` optional — only if listing IM channels.) **Channel fast-follow:** `channels:history`, `groups:history`, `mpim:history`.
- **Security:** send-as-you must NOT use the open body-token proxy — see §7/D7.

---

## 9. Events API contract (new `supabase/functions/slack-events/index.ts`)

Skeleton on **`billing-webhook`** (the only existing HMAC mirror); do NOT copy `daily-webhook`'s security (it declares but never verifies). Request URL = `https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/slack-events`.

1. `serve(async req)` (std `http/server@0.208.0`) + OPTIONS preflight + json helper.
2. `const body = await req.text()` **before any parse** (Slack signs the raw body).
3. Reconstruct `v0:{x-slack-request-timestamp}:{body}`; reject if timestamp > 5 min old (replay window); compute `'v0=' + hex(HMAC-SHA256(SLACK_SIGNING_SECRET, basestring))` via `crypto.subtle`; compare with a **hand-written constant-time comparator** (no existing helper; `webhookService.ts`'s `===` is the anti-pattern); `401` on mismatch.
4. `type==='url_verification'` → echo `{challenge}` `200` (net-new handshake).
5. `type==='event_callback' && event.type==='message'` → **skip echoes** via `event.bot_id || event.subtype || event.user===ownBotUserId` (mirror the poll filter `slackService.ts:103`; cache `ownBotUserId` via `auth.test`).
6. **De-dup** on `slack_ts` via a pre-insert SELECT against `pulse_messages.metadata->>'slack_ts'` (+ short-circuit on the `X-Slack-Retry-Num` header). This fn is the FIRST writer of Slack data into `pulse_messages` (the poll path is client-only `UnifiedMessage`, never touches the DB) — de-dup is Events-vs-Events.
7. Resolve `event.user → contacts.slack_user_id → contacts.user_id` (TEXT) to find the owning Pulse user. **If no contact: auto-create one (L3)** keyed by `slack_user_id`. Ensure the deterministic **shadow `auth.users` row** exists (mint via service-role if absent — REQUIRED by the live FKs). Upsert `pulse_conversations` (`transport='slack'`, `external_*` identity, `{user1_id:pulseUser, user2_id:shadow}`) and INSERT `pulse_messages` (`sender_id:shadow, recipient_id:pulseUser, content_type:'text', metadata:{transport:'slack',slack_ts,slack_channel}`) via the **service-role** client.
8. Realtime delivers the row live to the open thread (subscriber RLS-read on `recipient_id`) — no refetch.
9. Always `200` fast (Slack 3s timeout); heavy work after ack.
- Signing secret = `SLACK_SIGNING_SECRET` edge env (mirror `STRIPE_WEBHOOK_SECRET`); single-tenant = one secret.
- **To receive the operator's OWN DMs you need the USER-token (`xoxp-`, `im:history`) event subscription** — `user_slack_tokens` is the prerequisite (a bot-token `message.im` only delivers DMs to the bot).

---

## 10. Graduation mechanic (conditional MERGE — not a plain re-point)

**Trigger (L2 prompted-then-auto):** new global `resolve_pulse_user_by_email(email)` (SECURITY DEFINER; mirror `discover_pulse_users`' `lower(email)=lower(auth.users.email)` join but **un-gated + global**, return `auth_user_id`, **filter `is_bot IS NOT TRUE`**), run lazily on thread open + on a `pulse_users` INSERT broadcast. On first match show one-tap **"X is now on Pulse — switch this thread to native?"**; auto thereafter for confirmed people. Invite-acceptance (persisted token, reuse `inviteService.generateInviteToken`) is the high-confidence auto trigger that can bypass the prompt.

**The flip — ONE service-role transaction:**
1. Resolve the real `pulse_user` uuid.
2. Look up any existing **native** conversation for the unordered `(owner, real uuid)` pair.
3. **IF one exists** (the unique-pair index would otherwise throw on a naive re-point): `UPDATE pulse_messages SET thread_id=<native id>` for the Slack-era rows **and** re-point their counterpart side (`sender_id`/`recipient_id`) shadow→real; then `DELETE` the emptied shadow conversation (respect the `last_message_id` FK ordering).
4. **ELSE:** `UPDATE` the shadow conversation's counterpart slot shadow→real **in place**.
5. Recompute `last_message_id`/`last_message_at`/unread on the surviving row.

**Why re-point is required (not "keep old rows on the shadow"):** the owner keeps SELECTing the whole thread either way (they always occupy one side), **but** the newly-graduated counterpart sees nothing for rows whose participants are `(shadow, owner)` — their real uuid is on neither side. Re-pointing the counterpart's side is **required for two-sided continuity.** Re-pointing `sender_id` is integrity-safe (no other table FKs `pulse_messages.sender_id`; `last_message_id` is unaffected), contingent on the target being a valid `auth.users` id — true for a real `pulse_user`.

**Surface it live:** add a **new `pulse_conversations` UPDATE realtime subscription** (today only `pulse_messages` INSERT is subscribed) or the flip only appears on refetch. On flip the channel-adaptive renderer swaps Slack→native (plum marker drops; native online dot/typing/READ appear), history preserved above a subtle "Now on Pulse · messages are native" divider. Persist `contacts.pulse_user_id` so it survives refetch.

---

## 11. Messages UI provenance (D6 — additive branches, no deletions)

Branch the 10 seams (§4) on the conversation's `transport`. For `transport='slack'`:
- **Relax** `validPulseConversations` (`Messages.tsx:2798`) and `ConversationSidebar`'s `other_user`-only guard (`:246`) so an external-identity-bearing row survives.
- Render identity/avatar/name from `external_display_name`/`external_slack_user_id` (initial-fallback when no avatar).
- **Fix me/them** at `Messages.tsx:4140` to compare against the conversation's external participant id (the shadow uuid), not `other_user.id` — else all rows render `isMe=true`.
- **Gate OFF** `OnlineIndicator` (presence), `TypingIndicator`, and READ/DELIVERED receipts — Slack provides no equivalent over Pulse's presence/typing/`is_read` channels. Show a subtle plum "via Slack" chip and optionally a "Sent to Slack" micro-label on outbound.
- Composer = send-as-you (rose Send), small "Sending as you in Slack" hint.
- **Coral is never used here** (AI-only). **Slack = plum.** **Rose = Send.**

A locked visual reference lives at `_design-playground/slack-messages-grounding.html` (mirrors the Pulse token shell; Playwright-verified headless).

---

## 12. Risks

| Risk | Sev | Mitigation |
|---|---|---|
| Bare synthetic uuid fails `foreign_key_violation` (the handoff's false premise). | **High** | Real shadow `auth.users` row (deterministic uuidv5, service-role). Re-confirm the 4 FKs via `pg_constraint` before building. |
| Graduation flip throws unique-violation when a native conversation already exists. | **High** | Conditional MERGE in one service-role transaction (§10), not a plain re-point. |
| Open body-token proxy would leak `xoxp-` to the browser if reused. | **High** | New authenticated send endpoint; inject `xoxp-` server-side; bot reads stay on the proxy. |
| Wrong/over-broad email match auto-merges a stranger's thread (unrecoverable). | **High** | Prompted-first (L2); `is_bot` filtered; invite-token is the only auto-bypass. |
| Self-bot echo loop (Phase-8 bot posts re-ingested). | Med | Skip `bot_id‖subtype‖user===ownBotUserId`; cache `ownBotUserId`. |
| Launch scope omits `im:write` → send fails `missing_scope`. | Med | Add `im:write`; verify vs `slackService.ts:233/251` JSDoc. |
| Public/distributed app hits the May-2025 rate-limit cliff. | Med | Ship single-tenant (L1); treat public distribution as Marketplace-gated. |
| Build size vs launch (large net-new core competing with P0s: SMS mocked, push not dispatching). | Med | Phase + flag everything OFF; ship what's verified; honest fallback = the Light Contacts/reachability feature, NOT advertised as "Slack in Messages." |
| `im:history` reads private DMs into Pulse storage (privacy/ToS). | Low | L4 go-forward-only shrinks the surface; single-tenant operator consents for own DMs; document retention. |

---

## 13. Acceptance criteria (per slice)

- **Schema:** migration applies clean after a passing dry-run-rollback; the 4 FKs + unique-pair index + both CHECKs still live; existing Messages/Contacts unaffected (`transport` defaults `'pulse'`); tsc-no-new-errors; vitest green.
- **OAuth:** round-trip persists `xoxp-` (from `authed_user.access_token`) into `user_slack_tokens` **server-side only** (never in a browser-readable response); `/status` reflects connected; shadow-row mint is idempotent (uuidv5 stable).
- **Send-as-you:** a DM lands in Slack **as the operator** (not the app); `xoxp-` never appears client-side; the per-contact toggle works; Phase-8 send-as-bot still works.
- **Inbound:** `url_verification` passes; a real inbound DM appears **live** in the open thread via the existing realtime subscription with **no refetch**; duplicate/replayed `slack_ts` de-duped; bad signature `401`s; an unknown sender auto-creates a contact (L3); no backfill occurs (L4).
- **UI:** a `transport='slack'` conversation renders in the sidebar with correct identity + correct bubble alignment + **no** false presence/typing/READ; Pulse DMs visually unchanged; a11y intact.
- **Graduation:** on confirmed match the same thread swaps external→native **live** (External→On Pulse) with no refetch; history preserved + visible to **both** sides post-merge; **no unique-pair violation** when a native conversation pre-exists; `contacts.pulse_user_id` survives refetch.

---

## 14. Phased plan (each phase independently committable + verified; flag `slackMessagesGrounding` OFF)

| Phase | Scope | Verify |
|---|---|---|
| **P0 — Schema foundation** | Dry-run-rollback then apply: `pulse_conversations` external columns; `contacts.pulse_user_id` + `dbToContact`; `user_slack_tokens` (RLS-on, service-role-only). No runtime behavior change. | `execute_sql` re-confirms 4 FKs + unique-pair + both CHECKs; clean apply; tsc/vitest green; Messages/Contacts unaffected. |
| **P1 — Shadow identity + OAuth broker** | Service-role shadow `auth.users` mint helper (uuidv5); Slack user-OAuth 4 routes (mirror Gmail) + `signSlackState`/`verifySlackState` + env + `slackOauthConfigured`; corrected scope set. | OAuth round-trip persists `xoxp-` server-side only; `/status` connected; mint idempotent; tsc/vitest green. |
| **P2 — Send-as-you (outbound 1:1)** | Authenticated send endpoint (server-injects `xoxp-`); `slackService` send-as-you mode; Messages routes `transport='slack'` sends through it. Bot read path untouched. | DM lands as the operator; `xoxp-` never client-side; per-contact toggle; Phase-8 send still works; tsc/vitest green. |
| **P3 — Inbound Events API (live 1:1)** | `slack-events` edge fn (HMAC + replay + constant-time + `url_verification` + echo filter + `slack_ts` de-dup + service-role write w/ shadow sender; auto-create unknown contact). Wire `message.im` user-token subscription. | Challenge passes; real inbound DM live in the open thread, no refetch; dup `slack_ts` de-duped; bad sig `401`; tsc/vitest green. |
| **P4 — Messages UI provenance** | Relax the `other_user`-only filter; `transport` discriminator branches identity/avatar/me-them; gate OFF presence/typing/receipts; Slack plum marker; external contact-panel fallback. | `transport='slack'` row renders w/ correct identity + alignment + no false signals; Pulse DMs visually unchanged; a11y; tsc/vitest green. |
| **P5 — Graduation** | Global `resolve_pulse_user_by_email` (un-gated, `is_bot`-filtered); prompted-then-auto flip as conditional MERGE; new `pulse_conversations` UPDATE subscription; persist `contacts.pulse_user_id`; reuse `inviteService` token for the auto path. | Live external→native swap, no refetch; history preserved both sides; no unique-pair violation when native pre-exists; `pulse_user_id` survives refetch; tsc/vitest green. |
| **P6 — Hardening + fast-follow triage (post-launch)** | Confirm no `xoxp-` path touches the open proxy; add 429/Retry-After backoff for future channel/backfill; defer channels/threads/backfill/Marketplace/analytics behind their own flags. | Audit: open proxy carries bot token only; backoff unit-tested; channel scopes NOT requested at launch; tsc/vitest green. |

---

## 15. Verify-at-implementation (MEDIUM-confidence items — do not lock blind)

These come from the verifier's Slack-doc citations + `slackService` JSDoc, **not re-fetched live this session**. Confirm against the actual Slack app config + a test OAuth round-trip before locking:
- `user_scope` vs `scope` param semantics; `xoxp-` nested at `authed_user.access_token`; non-expiring tokens (no refresh route).
- `im:write` requirement for `conversations.open`; `im:history` sufficiency for `message.im` + DM history; `im:read` being optional.
- The May-2025 non-Marketplace rate-limit cliff (1 `conversations.history` req/min) vs internal-app limits (50+/min).
- Marketplace-only review (own-workspace install needs none).
- `slackService.ts` exact send flow (`openDm → conversations.open`) and the precise `Messages.tsx` line numbers (taken from reader findings; glance when implementing P2/P4).
- The graduation MERGE (`thread_id` re-point + shadow-conversation delete respecting `last_message_id` FK) — **dry-run-rollback test before apply.**

---

## 16. Open questions resolved this session

All four user-facing forks are **answered (L1–L4, §1).** No blocking open questions remain for the launch slice. Post-launch decisions (token rotation, public distribution, channel mirroring, analytics) are tracked in §6 Out-of-scope.
