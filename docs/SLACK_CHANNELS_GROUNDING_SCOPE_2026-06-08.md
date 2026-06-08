# Slack Channels → Pulse — Grounding Scope (Integration C)

> **Created:** 2026-06-08 · **Type:** scope/contract (the design lock + phased plan).
> **Status:** decisions LOCKED, **no code written yet** (per CLAUDE.md Rule A this is a proposal
> approved in *direction* only; each phase still gets built + verified before the next).
> **Companion docs:** `SLACK_INTEGRATION_OVERVIEW_HANDOFF_2026-06-08.md` (whole-footprint map),
> `SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md` (Integration B — the DM path this mirrors).
> Every schema/constraint claim below was read from live `pg_constraint` / `information_schema` /
> `pg_proc` on 2026-06-08 (Supabase project `pulse-chat`, ref `ucaeuszgoihoyrvhewxk`); source anchors
> are exact as of commit `554ab83`.

This is **Integration C**: bringing Slack **channel** threads (public/private, N-party) into Pulse as
a first-class, two-way surface. It is a *sibling* of — not a change to — Integration B (1:1 Slack DM
grounding). Do not conflate the two.

---

## 0. Why this is its own integration (the modeling crux)

A channel is **N-party**. Pulse's two existing message containers cannot hold it, and this was proven,
not assumed:

- **DM tables (`pulse_conversations` / `pulse_messages`) are physically 2-party.** `pulse_conversations`
  encodes participants as exactly two `NOT NULL` columns `user1_id` / `user2_id` (both FK→`auth.users(id)`
  `ON DELETE CASCADE`), with `CHECK different_users` (`user1_id <> user2_id`) and the decisive hard-cap
  **`UNIQUE INDEX idx_pulse_conversations_unique_pair` on `(LEAST(user1_id,user2_id), GREATEST(...))`** —
  at most one conversation per *unordered pair*, no third slot, no membership junction table for this
  family. `pulse_messages` mirrors it (`sender_id` + `recipient_id` both `NOT NULL` FK→`auth.users`,
  `CHECK no_self_message`). `transport` is `text NOT NULL DEFAULT 'pulse'` with **no CHECK**, so a new
  enum value is free DDL — **but it changes nothing**, because the cap is structural. The identity-synthesis
  seam (`pulseService.ts:307-331`) also assumes exactly one `other_user`.
- **Relay's Channel store (`team_vox_messages`) is voice-locked.** `audio_url` and `duration` are both
  `NOT NULL`; `message_type` CHECK = `['normal','standup','announcement']`; the UI (`StudioMessageCard`)
  renders a play-disc + waveform for every row. Text there = fake voice notes with dead play buttons.
  **Rejected.**
- **The dormant-but-LIVE text stack (`message_channels` / `channel_messages` / `channel_members`) is
  entomate's.** It *is* N-party and text-native (`channel_messages.message_type` CHECK already includes
  `'text'`), with a full `messageChannelService` — but it holds **11 real rows that entomate actively
  writes** (`bot_app='entomate'`), and carries a FK-target split (`channel_messages.sender_id`→`auth.users`
  while `channel_members.user_id`→`public.users`). Co-tenanting Slack rows there is a Rule A/Rule B
  blast-radius risk + a doubled identity model. **Rejected for v1** (see D3).

**Conclusion:** a channel needs a different **container** — a net-new, text-native, owner-scoped sibling
store. That is the architecture below.

---

## 1. Decisions (LOCKED 2026-06-08)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| **D1** | Container | **New sibling tables** (`slack_channel_threads` + `slack_channel_messages`), single-owner RLS, isolated from entomate. | Best content-unlock per unit of modeling-violence; fully additive + reversible; keeps entomate's live data untouched. |
| **D2** | v1 capability | **Two-way** (read + reply-into-channel). | User choice — the durable home, not a read-only stepping stone. |
| **D3** | Reuse vs isolate | **Isolate** (do NOT adopt the entomate `message_channels` stack). | Rule A/Rule B: don't write into a container another product actively depends on; reuse savings don't offset blast-radius + the `auth.users`-vs-`public.users` FK split. |
| **D4** | Inbound token | **Bot token (`xoxb-`) Events** (`message.channels` / `message.groups`). | The `xoxp-` user tokens are verified DM-only (`im:history,users:read,users:read.email,chat:write,im:write` — no channel scopes). Bot already has `channels:history`/`groups:history` (re-verify live in P0). Bot must be `/invite`-d into each target channel. |
| **D5** | Outbound identity | **Post-as-you** (`xoxp-` user token, server-injected on a dedicated authed route). | Reuses Integration-B's proven send-as-you machinery; replies appear under your own Slack name (natural for a human conversation); consistent with how Slack DMs already send. Your `xoxp-` already holds `chat:write`. |
| **D6** | Membership model | **Display-only senders** — one shadow `auth.users` row per *author* (`ensure_slack_shadow_user` verbatim), single-owner RLS (`owner_pulse_id = auth.uid()`). NO `channel_members` rows for Slack people. | A Slack-channel mirror is owner-scoped, not a multi-tenant Pulse channel; don't mint membership rows for people who'll never log in. |
| **D7** | Flag | New `slackChannelsGrounding`, **default OFF**. Master switch for Integration C. | Mirrors `slackMessagesGrounding`. |

**Anti-decisions (rejected with evidence):** Option 2 (adopt entomate stack), Option 3 (Relay voice
store), Option 4 (read-only `unified_messages` mirror — skipped because the user chose the durable
two-way home, not a throwaway v0).

---

## 2. Data model (the new container)

> **Schema-first discipline (CLAUDE.md §4):** every migration below is **dry-run-validated in a
> rolled-back `DO $$ … RAISE EXCEPTION 'rollback' $$` transaction until clean, THEN applied once.**
> Never apply-then-debug. All functions pin `search_path = public, extensions, pg_temp`.

### `slack_channel_threads` (one row per owner × Slack channel)
```
id                 uuid    PK   default gen_random_uuid()
owner_pulse_id     uuid    NOT NULL  FK → auth.users(id) ON DELETE CASCADE
slack_team_id      text    NOT NULL
slack_channel_id   text    NOT NULL
channel_name       text                       -- denormalized display label
transport          text    NOT NULL default 'slack_channel'
is_private         boolean NOT NULL default false   -- public_channel vs private_channel/group
created_at         timestamptz NOT NULL default now()
last_message_at    timestamptz
UNIQUE (owner_pulse_id, slack_team_id, slack_channel_id)
```

### `slack_channel_messages`
```
id                 uuid    PK   default gen_random_uuid()
thread_id          uuid    NOT NULL  FK → slack_channel_threads(id) ON DELETE CASCADE
sender_shadow_id   uuid              FK → auth.users(id) ON DELETE SET NULL  -- shadow per author; null = the owner's own reply
sender_slack_id    text              -- raw Slack user id (provenance)
sender_name        text    NOT NULL  -- display name (survives even if shadow mint is skipped)
content            text    NOT NULL  -- text-native; NO audio_url/duration fakes
is_outgoing        boolean NOT NULL default false   -- true = the owner's reply posted from Pulse
slack_ts           text              -- Slack message ts (provenance + dedup key)
slack_thread_ts    text              -- parent ts for threaded replies (future fidelity)
metadata           jsonb   NOT NULL default '{}'::jsonb
created_at         timestamptz NOT NULL default now()
UNIQUE (thread_id, slack_ts)         -- idempotency, mirrors idx_pulse_messages_slack_ts_per_thread
```

**RLS (single-owner):** on both tables, `USING (owner_pulse_id = auth.uid())` for `SELECT`
(`slack_channel_messages` joins its `thread_id` → `slack_channel_threads.owner_pulse_id`). Writes are
service-role only (the edge fn + the authed send route bypass RLS); no client `INSERT`/`UPDATE` policy.
RLS **ON** with zero client write-policies = deny-all for clients, exactly like `user_slack_tokens`.

**Why this shape:**
- `content text NOT NULL` is the headline difference from Relay — text is the primary field, no lies.
- `sender_shadow_id` nullable so the owner's own outgoing reply (`is_outgoing=true`) needs no shadow.
- `UNIQUE(thread_id, slack_ts)` re-expresses the proven DM dedup index for the new table.
- `transport='slack_channel'` discriminates at the row level (harmless even though the table is
  Slack-only — keeps queries self-documenting and future-proofs a possible union view).

---

## 3. Ingest RPCs (siblings — NEVER edits to the DM RPCs)

Both are **new** functions. Do **not** touch `get_or_create_slack_conversation`,
`ingest_slack_inbound_message`, or `graduate_slack_conversation` — they are hard-baked to
`(owner, single-shadow)` pairing and graduation is undefined for N senders.

- **`get_or_create_slack_channel_thread(p_owner_pulse_id, p_team_id, p_slack_channel_id, p_channel_name, p_is_private)`**
  → `thread_id`. `INSERT … ON CONFLICT (owner_pulse_id, slack_team_id, slack_channel_id) DO UPDATE
  SET channel_name = EXCLUDED.channel_name` (keeps the label fresh) `RETURNING id`.
- **`ingest_slack_channel_message(p_thread_id, p_sender_slack_id, p_sender_name, p_team_id, p_content,
  p_slack_ts, p_slack_thread_ts, p_metadata)`** → `message_id | null`.
  1. `EXISTS` pre-check on `(thread_id, slack_ts)` → return null if dup (backstopped by the UNIQUE index).
  2. Mint/resolve the author shadow via **`ensure_slack_shadow_user(p_team_id, p_sender_slack_id, …)`**
     (verbatim reuse — channel authors are still individual Slack people).
  3. `INSERT … ON CONFLICT (thread_id, slack_ts) DO NOTHING RETURNING id`.
  4. Bump `slack_channel_threads.last_message_at`.
  - **Optional L3 parity:** auto-create a `contacts` row per author keyed on
    `(user_id, platform='slack', external_id=p_sender_slack_id)` `ON CONFLICT DO NOTHING` — mirrors the
    DM path's L3 contact-create. **Decide in P2** whether channel authors should populate Contacts
    (likely yes, but gate it so a noisy channel doesn't flood Contacts).

---

## 4. Inbound — `slack-events` edge fn (additive branch, fail-closed preserved)

`supabase/functions/slack-events/index.ts` currently fail-closes to DMs:
```
index.ts:210  const isDm = event?.channel_type === 'im' || String(event?.channel ?? '').startsWith('D')
index.ts:211-216  // reject if !isDm
```
**Do NOT loosen the `isDm` gate.** It was deliberately written so a widened subscription can't
mis-ingest a channel post as a DM. Add a **separate branch**:

```
const isChannel = event?.channel_type === 'channel' || event?.channel_type === 'group'
                  || /^[CG]/.test(String(event?.channel ?? ''))
```
- Reuse **verbatim**: `verifySlackSignature` (raw-body HMAC, 5-min replay, constant-time, fail-closed),
  `url_verification` echo, the 200-ack-then-`EdgeRuntime.waitUntil` deferral, owner-resolution by
  `team_id` (`index.ts:131-139`), and `fetchSlackUserProfile` (`users.info`) enrichment.
- **Echo filter for channels:** skip `bot_id` / relevant subtypes **and the operator's own slack id**
  (so the owner's own as-you reply, which Slack will echo back as a `message.channels` event, is not
  re-ingested — we render it optimistically from the send response instead).
- On a real channel message: `get_or_create_slack_channel_thread(owner, team, channel, name, is_private)`
  → `ingest_slack_channel_message(...)`.
- **Slack app config (P3):** add `message.channels` + `message.groups` event subscriptions; re-verify /
  add bot scopes `channels:history`, `groups:history` (docs say granted — re-read the dashboard in P0).

---

## 5. Outbound — reply-as-you (dedicated authed route, NOT the proxy)

**D7 hazard (overview §3):** the open `/api/slack/proxy` forwards whatever token is in the body. The
`xoxp-` user token must **never** route through it. Add a **dedicated authenticated route**, modeled on
the existing send-as-you DM route `POST /api/slack/send` (`server.js:887`):

- **`POST /api/slack/channel-send`** — authenticated; loads the caller's `xoxp-` from `user_slack_tokens`
  (service-role); calls `chat.postMessage({ channel: slack_channel_id, text })`. Unlike the DM route it
  **skips `conversations.open`** (you post directly to a channel id you're a member of). Returns
  `{ ts, channel }`.
- **Render path:** on success, write an outgoing row via a small service-role insert (or a third RPC
  `record_outgoing_slack_channel_message`) with `is_outgoing=true`, `sender_shadow_id=null`,
  `sender_name = <the operator's display name>`, `slack_ts = ts`. The inbound echo of this same post is
  filtered (§4), so the `UNIQUE(thread_id, slack_ts)` index + optimistic insert are the single source of
  truth — no double.
- **Scopes:** `xoxp-` already holds `chat:write`. Re-verify in P0 that user-level `chat:write` covers
  channel posting for a channel you're a member of (it should; confirm live before relying).

---

## 6. Render surface (read + composer)

No mounted renderer exists for any channel/unified content today (`UnifiedInbox.tsx` is provably
unmounted — its only parent `MultiModalDemo.tsx` is imported by no router/App). So this is a **net-new
component** — the honest cost every viable option shares.

- **IA decision (open, P5):** where the surface lives — a third conversation kind inside **Messages**,
  a section in **Relay**, or a **dedicated top-level Slack Channels** view. Lean: a dedicated read-mostly
  channel list + thread view, reusing Relay studio primitives so it inherits the house style.
- **Reuse render chrome:** `StudioMasthead`, `StudioMessageCard` (its `canPlay`/`onPlay` are **optional**
  → renders text children with **no play disc / no waveform**), `StudioCard`, `avatarColorForId`/`initials`.
- **Provenance visual language:** the established **plum "via Slack" chip** + neutral chrome.
  **NOT `--pulse-coral`** — coral is AI-output + playback-state only (CLAUDE.md §4).
- **Realtime:** subscribe to `slack_channel_messages` INSERT (mirror `subscribeToConversations`).
- **Composer:** a reply box wired to `POST /api/slack/channel-send` with optimistic append.
- Everything gated behind `slackChannelsGrounding`.

---

## 7. Phased plan

> Schema-first, additive, reversible. Build + **verify** each phase before the next (operating contract
> rule 3). Commit each phase independently on `main` (CLAUDE.md §3).

| Phase | Goal | Touches |
|---|---|---|
| **P0 — Verify-live + flag** | Re-read the **actual installed bot scopes** from the Slack dashboard (`channels:history`/`groups:history` were doc-recorded, not re-verified this session); confirm the bot is `/invite`-able to a Qntmecos test channel; confirm `xoxp-` `chat:write` covers channel posting. Add `slackChannelsGrounding` to `FeatureContext` (default `false`). **No data changes.** | Slack dashboard (read), `src/contexts/FeatureContext.tsx` |
| **P1 — Schema** | Create `slack_channel_threads` + `slack_channel_messages` with the UNIQUEs + single-owner RLS, `search_path`-pinned. **Dry-run-rollback until clean, then apply once.** | 2 new migrations + RLS |
| **P2 — Ingest RPCs** | `get_or_create_slack_channel_thread` + `ingest_slack_channel_message` (reuse `ensure_slack_shadow_user`; dedup on `(thread_id,slack_ts)`); decide L3 contact-create. Dry-run-rollback validate. **New functions, never edits to DM RPCs.** | 2 new migrations |
| **P3 — Edge-fn inbound branch** | Additive `message.channels`/`groups` branch in `slack-events` alongside the `isDm` gate (do NOT loosen it); widen echo filter for channels. Add Slack event subscriptions + bot scopes. `deploy_edge_function` + live probe. | `supabase/functions/slack-events/index.ts`, Slack app |
| **P4 — Live ingest verify** | `/invite` the bot to one channel; post; confirm a thread + message rows land with correct shadow senders, `sender_name`, and `slack_ts` dedup (re-post same ts → no dup). **Data-layer verify first, no UI** — mirrors Integration B's cadence. | live Slack + DB read-back |
| **P5 — Render surface (read)** | Net-new channel list + thread component (Relay studio primitives, neutral chrome, plum "via Slack" chip); realtime subscribe; gated behind the flag. | new component, subscribe path, flag consumption |
| **P6 — Outbound reply-as-you** | `POST /api/slack/channel-send` (xoxp server-injected, `chat.postMessage` to channel, **never the proxy**); optimistic outgoing-row insert + render; rely on `UNIQUE(thread_id,slack_ts)` + echo filter for no-double. `node --check server.js`. | `server.js` (new route), composer, optional `record_outgoing_*` RPC |
| **P7 — Live two-way verify** | End-to-end: inbound channel post renders in Pulse; reply from Pulse appears in Slack **as you**; both dedup; realtime updates. | live Slack + Pulse |
| **P8 — Deferred fast-follows** | Threads/reactions/edits/files fidelity (relax the subtype filter), multi-operator inbound routing (route by Events `authorizations[].user_id`), channel backfill, public distribution. **OUT of v1.** | (future) |

---

## 8. Reuse inventory (the no-rebuild list)

- **`ensure_slack_shadow_user(team, slack_user)`** — verbatim; channel authors are still individual people.
- **`slack-events` scaffolding** — `verifySlackSignature` + 5-min replay + constant-time compare +
  `EdgeRuntime.waitUntil` ack-fast + owner-resolution (`index.ts:131-139`) + `fetchSlackUserProfile`.
- **`verify_jwt=false`** config (`config.toml:435-436`) — same function inherits it.
- **`idx_pulse_messages_slack_ts_per_thread` dedup pattern** — re-expressed as `UNIQUE(thread_id, slack_ts)`.
- **`transport text DEFAULT 'pulse'` (no CHECK)** — `'slack_channel'` is free DDL.
- **`SlackService.getChannels/getChannelMessages/getAllMessages`** bot read engine (`conversations.list`
  + `history` + `users.info`) — for any future backfill/manual sync; bot read scopes already granted.
- **`server.js` `/api/slack/send` (line 887)** — the send-as-you template the new `/channel-send` route copies.
- **Relay studio primitives** — `StudioMasthead`, `StudioMessageCard` (optional `canPlay` → text rows),
  `StudioCard`, `avatarColorForId`/`initials`.
- **Plum "via Slack" chip** idiom (Messages.tsx) — established provenance language (NOT coral).

---

## 9. Do-NOT-do (anti-scope, with evidence)

1. **Do NOT** add a transport value to `pulse_conversations` to host a channel — the `UNIQUE` pair index
   + `CHECK different_users` + two `NOT NULL` participant columns make N>2 physically impossible.
2. **Do NOT** loosen the `slack-events` fail-closed `isDm` gate (`index.ts:210-216`) — add a separate
   channel branch.
3. **Do NOT** edit `get_or_create_slack_conversation` / `ingest_slack_inbound_message` /
   `graduate_slack_conversation` — write NEW sibling RPCs.
4. **Do NOT** write Slack channel rows into entomate's live `message_channels`/`channel_messages`
   container (11 real rows incl. `bot_app='entomate'`).
5. **Do NOT** force channel text into Relay's `team_vox_messages` — `audio_url`/`duration` are `NOT NULL`
   and `message_type` is voice-only.
6. **Do NOT** route the `xoxp-` user token through `/api/slack/proxy` (D7 open-body-token hazard) —
   inbound stays on the service-role edge fn; outbound uses the dedicated authed `/channel-send` route.
7. **Do NOT** use `--pulse-coral` for channel chrome — neutral + plum/emerald provenance idiom only.
8. **Do NOT** extend graduation to channels — undefined for N senders; keep the graduation prompt
   gated on `transport='slack'` DM only.
9. **Do NOT** apply any migration without a rolled-back `DO`-block dry-run first; do NOT guess column
   names/types — all schema here was verified against live `pg_constraint` / `information_schema`.

---

## 10. Cross-cutting gotchas (inherited from the Slack corpus)

1. **Workspace lock:** Pulse only sees the installed workspace (Qntmecos, team `T0B63H511LJ`). Channel
   reads/posts from any other workspace silently produce nothing.
2. **Bot membership:** `conversations.history` and `message.channels` events only fire for channels the
   bot is a **member** of — `/invite @Pulse` per channel.
3. **`tsc` globs the Deno edge fn** → expect ~5 "Cannot find name 'Deno'" false positives; gate on **no
   NEW** errors. The edge fn's real gate is `deploy_edge_function` + live probes.
4. **`server.js` is not in tsc/vitest** — verify with `node --check`.
5. **`docs/*.md` is gitignored** — `_SCOPE_` is allowlisted (this file is tracked); verify any new doc
   with `git check-ignore -v` and `git add -f` if needed.
6. **`users.info` N+1:** at channel scale, batch/cache user-profile lookups (the DM path issued one per
   sender; a busy channel will hit rate limits).

---

## 11. Open items to resolve in-phase (not blockers)

- **P2:** should channel authors auto-populate `contacts` (L3 parity), and if so, gated how?
- **P5:** the IA home — dedicated Slack Channels view vs a Messages/Relay section.
- **P6:** confirm live that user-level `xoxp- chat:write` posts to channels (vs needing a bot-token post).
- **P8:** thread fidelity (parent/replies) — the edge fn filters subtypes today; channels with heavy
  threading may want that relaxed.

---

**Resume pointer:** start at **P0** (verify-live bot scopes + add the flag). The full investigation
that produced this lock (6 ground-truth readers + synthesis) is the basis for every claim above; the
crux is §0 — the DM tables are provably 2-party, so Integration C is a net-new owner-scoped container,
reusing Integration B's receive half verbatim.
