# Slack Integration — State of the Union & Exploration Handoff

> **Created:** 2026-06-08 · **Type:** orientation/exploration hub (NOT a resume point for one feature —
> that's `SLACK_MESSAGES_GROUNDING_BACKLOG_HANDOFF_2026-06-08.md`). Purpose: a single map of the
> ENTIRE Slack footprint in Pulse so the next session can pick a direction to keep exploring without
> re-discovering what already exists. Every claim here was read from source on 2026-06-08; file:line
> anchors are exact as of commit `554ab83`.

---

## 0. The one thing to understand first

There are **TWO parallel Slack integrations** in Pulse, with different tokens, storage, identity, and
purpose. They share one Slack app and (partly) one backend proxy, but are otherwise independent. Do not
conflate them.

| | **A — Bot token (`xoxb-`)** | **B — User token (`xoxp-`)** |
|---|---|---|
| **Lineage** | older; "contactsHybrid **Phase 8**" + Unified-Inbox reads | newer; "**Slack-Grounded Messages**" |
| **Posts as** | the Pulse **bot app** | **the operator (you)** |
| **Token storage** | `localStorage` per-user, **client-side** (`src/lib/slackToken.ts`) | DB `user_slack_tokens`, **server-only** (service-role) |
| **Reads** | `conversations.history` → Unified Inbox (`unifiedInboxDb`) | inbound DMs via the `slack-events` edge fn |
| **Sends** | Contacts ChannelRow DM (`sendSlackDm`) | Messages send-as-you (`/api/slack/send`) |
| **Lands in** | `UnifiedMessage` / IndexedDB-style `unifiedInboxDb` | `pulse_messages` rows w/ `transport='slack'` |
| **Flag** | `slackSend` (+ token presence) | `slackMessagesGrounding` |
| **Status** | reads shipped & working; **send built + unit-tested but UI gated OFF** | **2-way LIVE-VERIFIED** + graduation prompt UI shipped |
| **Backend** | `POST /api/slack/proxy` (open body-token relay) | 6 dedicated `/api/slack/*` routes |

**One Slack app, two token types (decision D8):** "Pulse Smoke" (App ID `A0B6SUJDAUX`), installed in
the **Qntmecos** workspace (team `T0B63H511LJ`). The same app holds the `xoxb-` bot token AND mints the
`xoxp-` user token via OAuth.

---

## 1. Integration A — Bot token (`xoxb-`): reads + Contacts send

**Identity model:** bring-your-own bot token. The user pastes `xoxb-…` in Settings; it's validated, then
persisted to `localStorage` (`pulse_slack_bot_token`) — **never to our DB** (decision D-C: avoid
member-readable `workspace_integrations.shared_config`). Forwarded per-request as a Bearer to the proxy.

**Files:**
- `src/lib/slackToken.ts` — get/set/clear/has bot token in localStorage.
- `src/services/slackService.ts` — `SlackService` class. Reads: `getChannels`, `getChannelMessages`,
  `getAllMessages`, `testConnection`. Phase-8 writes: `lookupUserByEmail`, `openDm`, `sendMessage`
  (all POST upstream via the proxy's `method:'POST'` branch). Posts **as the bot**, not the operator.
- `src/services/slackService.test.ts` — unit tests.
- `src/components/settings/integrations/SlackIntegration.tsx` — the settings card (token input + scope
  checklist + Test Connection + Fetch Messages). ALSO hosts integration B's "Send as you" section.
- `src/components/contacts/hybrid/channels/actions.ts` — `resolveSlackUser(contact)` +
  `sendSlackDm(contact, text)` (throw `NO_TOKEN` / `NOT_LINKED`). The Contacts send path.
- `src/components/contacts/hybrid/channels/channelsFor.ts` — gates the Slack channel on
  `slackSendEnabled`; when off, renders a **disabled** "Link Slack" affordance with
  `disabledReason: 'Slack send arrives in a later phase'`.
- `src/components/contacts/hybrid/channels/ChannelRow.tsx` (+ `.test.tsx`) — the per-contact channel row.

**Identity data:** `contacts.slack_user_id` (text) — a contact's resolved Slack user id (migration
`20260606034444_phase8_contacts_slack_user_id.sql`). Resolved via `users.lookupByEmail`
(`users:read.email` scope).

**Reads → Unified Inbox:** `fetchSlackMessages` in the settings card pulls channel history and stores into
`unifiedInboxDb` as `UnifiedMessage`s (`source:'slack'`). NB: per the messages-grounding scope, the
Unified Inbox store is the WRONG live store for the Messages surface — it's a one-time cold-start import
only, never the path B routes through.

**Status:** reads shipped & functional. Send + per-contact identity are **built and unit-tested** but the
Contacts UI channel is **disabled by default** (gated behind the `slackSend` flag, default OFF — see §5).
Sends as the bot; send-as-user was deferred to integration B.

---

## 2. Integration B — User token (`xoxp-`): Slack-Grounded Messages (2-way live)

The headline work of the last few sessions. Brings Slack 1:1 DMs INTO Pulse Messages as a *transport*
(not a silo): cold-start from real Slack people, **send-as-you**, **live inbound**, and **graduation**
(a thread flips Slack→native when the counterpart joins Pulse, matched by email).

**Full detail lives in three docs (read those for depth):**
- `docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md` — the contract (D1–D8, L1–L4, phases P0–P6).
- `docs/SLACK_MESSAGES_GROUNDING_BACKLOG_HANDOFF_2026-06-08.md` — **the resume point** (what's left).
- memory `project_pulse_slack_messages_grounding` — the running log.

**One-paragraph state:** P0 schema → P1 shadow-mint + user-OAuth → P2 send-as-you → P3 inbound Events
fn → P4 Messages UI → P5 graduation (DB + **prompt UI**) → front-door are all **shipped**, and the
two-way loop is **live-verified end-to-end** (real DM `jehovahsneaky83`→FM1 ingested into Pulse).
The graduation prompt UI landed this session (`9c451fd` + polish `554ab83`) — emerald banner under a
slack-thread header that one-tap flips to native. **Remaining:** live-verify the flip (CASE A/B),
multi-login inbound routing (3.2), public distribution (3.3), P6 hardening. See the backlog doc.

**Key architectural choices (so you don't re-litigate them):**
- The Slack counterpart is a **real shadow `auth.users` row** (deterministic `uuidv5('slack:{team}:{user}')`,
  service-role minted) — because all 4 `pulse_messages`/`pulse_conversations` participant cols FK to
  `auth.users` (a bare synthetic uuid fails). See memory `reference_pulse_messages_auth_fks`.
- The operator keeps their own side, so RLS / realtime / read-paths work **verbatim**.
- P4 synthesizes `other_user` at the **data layer** (`pulseService.getConversations`) so the 10 fragile
  Messages participant seams need no edits — only live signals (presence/typing/receipts) gate off for
  Slack, plus a plum "via Slack" chip.

---

## 3. Backend — `server.js` Slack routes (exact, as of `554ab83`)

| Route | Line | Integration | Purpose |
|---|---|---|---|
| `POST /api/slack/proxy` | `server.js:148` | **A** | Open relay: forwards `{endpoint, token, params, method}` to `slack.com/api/*`. Reads=GET-with-query, writes opt in via `method:'POST'`. |
| `GET /api/slack/status` | `server.js:771` | **B** | User-OAuth connect status (`connected`/`configured`/`slackUserId`/`teamId`). |
| `GET /api/slack/auth/url` | `server.js:788` | **B** | Start the `xoxp-` OAuth (signed-state, mirrors the Gmail block). |
| `GET /api/slack/auth/callback` | `server.js:809` | **B** | OAuth callback → stores `xoxp-` in `user_slack_tokens` (service-role). |
| `DELETE /api/slack/disconnect` | `server.js:868` | **B** | Drop the stored grant. |
| `POST /api/slack/send` | `server.js:887` | **B** | Authenticated send-as-you (xoxp injected server-side; mints shadow + conversation; returns `{shadowUserId, conversationId, ts, channel}`). |
| `POST /api/slack/conversation` | `server.js:991` | **B** | Front-door: start/fetch a `transport='slack'` thread by email or slackUserId. |

> ⚠ **D7 hazard — the proxy is an OPEN body-token relay.** `/api/slack/proxy` forwards **whatever token
> is in the request body** to Slack. It's `xoxb-`-only *by convention*. The `xoxp-` user token must
> **never** route through it (it's authenticated + server-injected on the dedicated `/send` route
> precisely to avoid this). Any new Slack write should use a dedicated authenticated route, not the proxy.

---

## 4. Edge function — inbound (integration B only)

- `supabase/functions/slack-events/index.ts` — **ACTIVE v4**, `verify_jwt=false`. Slack v0 HMAC
  (raw-body-before-parse, constant-time, 5-min replay, fail-closed); `url_verification` echo; echo filter
  (bot_id/subtype + operator's own slack id); fail-closed DM gate; acks 200 then ingests via
  `EdgeRuntime.waitUntil`; best-effort `users.info` enrichment.
- **Operator config (live, working):** Event Subscriptions → `message.im` under "on behalf of users";
  Request URL `https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/slack-events`;
  `SLACK_SIGNING_SECRET` set as a **Supabase edge** secret (separate store from Render).

---

## 5. Database surface

**Tables / columns:**
- `pulse_conversations`: `transport text NOT NULL DEFAULT 'pulse'`, `external_slack_user_id`,
  `external_email`, `external_display_name` (P0 `20260606155711`). **B.**
- `contacts`: `slack_user_id text` (A identity, `20260606034444`); `pulse_user_id uuid` (B graduation,
  P0). Note `contacts.user_id` is **text** (schema gotcha) but `pulse_user_id` is **uuid**.
- `user_slack_tokens` (P0): `xoxp-` store modeled on `user_google_tokens`. **RLS ON with 0 client
  policies = deny-all**; read/written only by the server's service-role client. No `refresh_token`/expiry
  (Slack user tokens are non-expiring unless rotation is enabled, which is out of scope). **B.**
- Shadow `auth.users` rows (`raw_user_meta_data.pulse_shadow='true'`, email-less) — the Slack counterpart.

**RPCs (all service-role or oracle-guarded):**
- `ensure_slack_shadow_user(team, slack_user, email?, name?)` → shadow uuid (`20260607061845`).
- `get_or_create_slack_conversation(...)` → transport='slack' conv (`20260607124444`).
- `ingest_slack_inbound_message(...)` → atomic shadow+conv+dedup+message+rollup+L3-contact;
  **graduation-aware** (routes post-grad inbound into the native thread) (`20260607134149` + `…135538`).
- `resolve_pulse_user_by_email(email)` → uuid|null; **oracle-guarded** (caller must hold the email as a
  contact) + **ambiguity-guarded** (NULL unless exactly one match) (`20260607142338` + `…143842`).
- `graduate_slack_conversation(conv_id)` → surviving conv id; conditional MERGE, CASE A flip-in-place /
  CASE B merge-then-delete-shadow (`20260607143750`).
- 4 signup triggers guarded to skip shadow rows (`20260607061411`).

**Security:** all the above were dry-run-rollback validated and (for P3/P5) 4-lens adversarially reviewed
before apply, per CLAUDE.md's destructive-migration rule.

---

## 6. Frontend surface — where Slack shows up

- **Settings → Integrations:** `SlackIntegration.tsx` — bot-token card (A) **and** the
  "Send as you (user OAuth · Beta)" section (B, gated on `slackMessagesGrounding`).
- **Settings → Features & Labs:** `FeaturesLabsSettings.tsx` — surfaces `slackMessagesGrounding` as
  "Slack in Messages (Beta)".
- **Contacts (hybrid):** `channels/actions.ts`, `channelsFor.ts`, `ChannelRow.tsx`, `detail/FocusColumn.tsx`
  — the per-contact Slack DM channel (A), disabled until `slackSend`.
- **Messages:** `Messages.tsx` — the `transport==='slack'` send branch (`sendPulseMessage`), the
  `isSlackConv` render gating + "via Slack" chip, and the **graduation prompt banner**;
  `Messages/MessagesTopModals.tsx` `SlackDmStarter` (the front-door "Message on Slack (as you)" modal);
  `pulseService.getConversations` (identity synthesis) + `subscribeToConversations` (live swap).
- **Services:** `slackService.ts` (A), `slackToken.ts` (A), `slackUserConnect.ts` (B —
  status/connect/disconnect/send/start-conversation + this session's `resolveGraduationCandidate` /
  `graduateSlackConversation` wrappers).
- **Design:** `_design-playground/slack-redesign.html`, `slack-messages-grounding.html`,
  `_shots/slack-grounding-*.png`, `_verify-slack-grounding.mjs`.

---

## 7. Feature flags (all default OFF)

| Flag | Gates | Default |
|---|---|---|
| `slackMessagesGrounding` | Integration B end-to-end (send-as-you, inbound, render, graduation). Master switch. | OFF |
| `slackSend` | Integration A's Contacts ChannelRow DM send. System-wide kill-switch for the send capability. | OFF |
| `contactsHybrid` | The hybrid Contacts redesign that *hosts* the Slack ChannelRow (A). | OFF |
| (bot token presence) | localStorage `pulse_slack_bot_token` — independent gate on the Contacts Slack UI. | n/a |

Definitions: `src/contexts/FeatureContext.tsx` (`slackSend` ~L62, `slackMessagesGrounding` ~L69).

---

## 8. The Slack app & scopes (live config)

- **App:** "Pulse Smoke", App ID `A0B6SUJDAUX`, single-tenant install in **Qntmecos** (team `T0B63H511LJ`).
- **Bot scopes (A, reads + Phase-8 writes):** `channels:history`, `channels:read`, `groups:history`,
  `groups:read`, `im:history`, `im:read`, `mpim:read`, `users:read`, `chat:write`, `im:write`,
  `users:read.email`.
- **User scopes (B, `xoxp-`):** `chat:write`, `im:write`, `im:history`, `users:read`, `users:read.email`.
- **Events (B):** `message.im` "on behalf of users"; Request URL = the `slack-events` edge fn.
- **OAuth redirect (B):** `https://pulse-api-1epw.onrender.com/api/slack/auth/callback`.
- **Env:** Render backend holds `SLACK_CLIENT_ID/SECRET`, `SLACK_OAUTH_REDIRECT_URL` (note `_URL` not
  `_URI`), `VITE_APP_URL`. Supabase **edge** secret holds `SLACK_SIGNING_SECRET` (separate store).

---

## 9. Exploration directions (pick one to keep going)

Net-new Slack surfaces, each with the gate that makes it non-trivial. Roughly ordered by leverage:

1. **Finish integration B's tail (lowest risk, already scoped).** Live-verify the graduation flip → 3.2
   multi-login inbound routing (route by Events `authorizations[].user_id`, not oldest token) → 3.3
   public distribution (open beyond Qntmecos; needs Slack "Activate Public Distribution" + the 3.2 fix).
   Full scope in the backlog handoff + `SLACK_PUBLIC_DISTRIBUTION_SCOPE_2026-06-07.md`.

2. **Channels → a Pulse surface (currently OUT, decision L4 "go-forward, no backfill").** Today only 1:1
   DMs are grounded. Bringing Slack *channel* threads into Relay/Messages is the biggest content unlock —
   but it's its own flag, its own scopes (`channels:history` etc., already on the bot), and a real
   modeling question (channel ≠ DM; the shadow-user model is per-person, not per-channel). Likely wants a
   new transport value or a separate surface.

3. **Slack as a notification SINK (outbound-only, easy win).** Push Pulse events (a new task, a decision,
   a War Room summary) INTO Slack via `chat.postMessage`. Reuses integration A's send or a webhook. Low
   complexity, high "it's alive" value; no inbound/identity headaches.

4. **Slash commands / Slack App Home (Pulse actions from inside Slack).** `/pulse …` to create a task or
   start a Vox from Slack. Needs interactivity Request URLs + a command handler (new edge fn). Bigger lift
   (Slack interactivity payloads, ack-within-3s), but turns Slack into a Pulse client.

5. **Retire the `xoxb-` bot read path in favor of `xoxp-`.** Integration A's localStorage bot token is the
   least-clean part (open proxy, client-stored). Once B's user-OAuth is public-distributed, A's reads +
   Contacts send could migrate onto the server-held user token and the open proxy could be deleted (D7
   hazard gone). Consolidation play, not a feature.

6. **History backfill (currently go-forward only, L4).** Import a window of prior Slack DMs on first
   connect. Wants careful dedup against the `slack_ts` unique index and a bounded range.

7. **Richer DM content:** files/attachments, reactions sync, threads, edits/deletes (`message_changed`/
   `message_deleted` subtypes — the edge fn currently filters subtypes). Each is an incremental ingest
   upgrade.

8. **AI grounding on Slack content** (War Room / summaries over grounded Slack threads). Leverages the
   fact that Slack DMs now live in `pulse_messages` as first-class rows.

---

## 10. Cross-cutting gotchas (don't relearn these)

1. **Workspace mismatch is the #1 time-sink.** Pulse only sees the workspace it's installed +
   token-connected to (Qntmecos). Testing in any other workspace silently produces nothing.
2. **D7 proxy hazard:** never route `xoxp-` through `/api/slack/proxy` (§3).
3. **Echo filter / self-DM:** the operator's own slack id is skipped on inbound — you can't test inbound by
   messaging yourself. Inbound only fires for a DM **to** the connected account, **in** the connected
   workspace, **from a different user**.
4. **Two Pulse logins share the same FM1 token** today (`feedaa8d` + `0bea47c3`); inbound routes to the
   oldest — test/view in the `jehovahsneaky83@gmail.com` (`feedaa8d`) login until 3.2 lands.
5. **`tsc` globs the Deno edge fn** → `slack-events` adds ~5 "Cannot find name 'Deno'" false positives.
   Gate on **no NEW** errors; the edge fn's real gate is a successful `deploy_edge_function` + live probes.
6. **`server.js` is not in tsc/vitest** — verify with `node --check`.
7. **`docs/*.md` is gitignored** — only allowlisted name patterns (incl. `_HANDOFF_`) are tracked; commit
   with `git add -f` if needed and verify with `git check-ignore -v`.

---

## 11. Doc map (the Slack corpus)

| Doc | Covers |
|---|---|
| **this file** | the whole-footprint map + exploration menu |
| `SLACK_PHASE8_SCOPE_2026-06-05.md` | integration A — Contacts bot DM send + per-contact identity (D-A…D-F) |
| `SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md` | integration B — the contract (D1–D8, L1–L4, P0–P6) |
| `SLACK_MESSAGES_GROUNDING_HANDOFF_2026-06-06.md` | B — initial input handoff (superseded by later ones) |
| `SLACK_MESSAGES_GROUNDING_P2_HANDOFF_2026-06-07.md` | B — send-as-you (P2) handoff |
| `SLACK_PUBLIC_DISTRIBUTION_SCOPE_2026-06-07.md` | B — opening Slack-connect beyond one workspace (3.3) |
| `SLACK_MESSAGES_GROUNDING_BACKLOG_HANDOFF_2026-06-08.md` | **B — the live resume point** (what's left) |

**Memory:** `project_pulse_slack_messages_grounding` (B running log), `project_pulse_slack_phase8_scope`
(A scope), `reference_pulse_messages_auth_fks` (the shadow-user FK crux).
