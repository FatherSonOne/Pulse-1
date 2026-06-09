# Slack Channels Grounding (Integration C) — P8 Deferred Backlog Handoff

> **Created:** 2026-06-08 · **Type:** resume/backlog handoff for the post-v1 fast-follows.
> **Prereq state:** Integration C **v1 is COMPLETE and LIVE-VERIFIED two-way** (P0–P7). This doc covers
> only the four items explicitly deferred OUT of v1. Scope contract:
> `docs/SLACK_CHANNELS_GROUNDING_SCOPE_2026-06-08.md`. Running log: memory
> `project_pulse_slack_channels_grounding`. Every anchor below was read from source this session
> (commits `d026ba9` edge fn, `adb5020` RPCs, `12a6619`+`20260608120000` schema, `b68f330` outbound,
> `73b73ce` render).

---

## 0. What already exists (the foundation P8 builds on)

**Data model** (`supabase/migrations/20260608120000_…p1_schema.sql`):
- `slack_channel_threads` — one row per (owner × Slack channel): `id, owner_pulse_id (FK auth.users),
  slack_team_id, slack_channel_id, channel_name, transport='slack_channel', is_private, created_at,
  last_message_at`. UNIQUE(owner, team, channel).
- `slack_channel_messages` — `id, thread_id (FK threads), sender_shadow_id (FK auth.users, nullable),
  sender_slack_id, sender_name, content, is_outgoing, slack_ts, **slack_thread_ts**, **metadata jsonb**,
  created_at`. Partial-unique dedup `idx_slack_channel_messages_ts_per_thread (thread_id, slack_ts)
  WHERE slack_ts IS NOT NULL`.
- RLS: single-owner (`owner_pulse_id = auth.uid()` on threads; thread-join on messages). Both tables in
  the `supabase_realtime` publication (`…p5_realtime`).

**Ingest** (`supabase/functions/slack-events/index.ts`, `processChannelEvent`):
- Bot-token `message.channels` / `message.groups` events → owner-resolved → `ingest_slack_channel_message`
  RPC (mints per-author shadow, dedups on slack_ts).
- **Already captures `slack_thread_ts`** on inbound (`p_slack_thread_ts: event.thread_ts ?? null`) — so
  threading data is *stored but not rendered*. This is the single biggest head-start for P8.

**Outbound** (`server.js` `POST /api/slack/channel-send`): xoxp- `chat.postMessage` + service-role
outbound-row insert (`is_outgoing=true`, `sender_shadow_id=null`). Echo filtered in the edge fn.

**Render** (`src/components/SlackChannels/SlackChannels.tsx` + `slackChannelsService.ts`): flat list +
thread, realtime, composer. **Flat** — no thread nesting, no reactions, no edit/delete handling.

**Bot read engine** (`src/services/slackService.ts`): `getChannels()`, `getChannelMessages(channelId,
channelName, limit)` (conversations.history + users.info), `getAllMessages()` — the backfill primitive.

---

## 1. Threaded replies / reactions / edits & deletes fidelity

**Current behavior (the gap):** the edge-fn channel gate drops everything but clean new messages —
`event?.type === 'message' && !event.subtype && !event.bot_id`. So:
- **Threaded replies** *do* ingest (a reply is a normal `message` with `thread_ts`), and `slack_thread_ts`
  is already stored — but the UI renders them flat (no nesting, no "N replies"). **Stored, not shown.**
- **Edits** arrive as subtype `message_changed` → currently **dropped**.
- **Deletes** arrive as subtype `message_deleted` → currently **dropped**.
- **Reactions** arrive as separate event types `reaction_added` / `reaction_removed` (NOT `message`
  events, and NOT subscribed) → currently never reach the fn. There is **no reactions column** (would
  live in `metadata` jsonb or a new column).

**Approach (incremental, each shippable alone):**
1. **Threads (lowest effort — data already there):** UI-only. In `SlackChannels.tsx`, group messages by
   `slack_thread_ts` (parent `slack_ts` == child `slack_thread_ts`); render replies indented under the
   parent or behind a "N replies" disclosure. No schema/edge-fn change. **Effort: S.**
2. **Edits/deletes:** in `processChannelEvent`, stop blanket-dropping subtypes — add handlers for
   `message_changed` (payload `event.message.ts` + new text → UPDATE the row's `content`, set a
   `metadata.edited_at`) and `message_deleted` (`event.deleted_ts` → soft-delete: a `metadata.deleted=true`
   or a new `deleted_at` column, render as "message deleted"). Needs a new RPC pair
   (`edit_slack_channel_message` / `tombstone_slack_channel_message`, service-role) keyed on
   `(thread, slack_ts)`. **Do NOT loosen the new-message path** — branch on `event.subtype` explicitly so a
   normal message still flows unchanged. **Effort: M.**
3. **Reactions:** add `reaction_added` / `reaction_removed` to the Slack app **bot event subscriptions**;
   handle in the edge fn (event carries `item.ts`, `item.channel`, `reaction`, `user`). Store as
   `metadata.reactions` (jsonb map emoji→count, or a small `slack_channel_reactions` table for fidelity).
   Render chips under the message. **Effort: M.** **Scope decision:** `metadata` jsonb is lighter; a side
   table is cleaner for per-user reaction state — decide before building.

**Gotchas:** the dedup index is `(thread_id, slack_ts)` — edits keep the same `ts`, so an edit must UPDATE
not INSERT. Deletes must not break the partial-unique. Keep the fail-closed discipline: an unknown subtype
is dropped, not mis-ingested.

---

## 2. Multi-operator inbound routing

**Current behavior (the gap):** `processChannelEvent` (like the DM path) resolves the owner as the
**OLDEST** `user_slack_tokens` row for the team (`order('created_at', { ascending: true }).limit(1)`).
With two Pulse logins sharing the same workspace token (verified this session:
`feedaa8d` + `0bea47c3` both on team `T0B63H511LJ`, same slack user `U0B5X67Q7A7`), **every channel
message routes to the oldest login only.** The second operator sees nothing.

**Approach:** route by the event's authorizing user instead of "oldest". A bot `event_callback` includes
`payload.authorizations[]` (and/or `event` context) identifying which installation/user the event is for.
For a single bot install in one workspace, channel events are workspace-level (one bot, not per-user) —
so the real question is **which Pulse owner(s) should receive a mirror of a workspace channel.** Options:
- **Fan-out:** ingest the channel message once per connected operator of that team (loop all
  `user_slack_tokens` rows for the team, ingest into each owner's mirror). Simple, but duplicates rows
  per operator (acceptable — they're owner-scoped).
- **Single canonical + shared read:** one mirror per channel, shared across the team's operators via a
  team-scoped RLS instead of owner-scoped. Bigger RLS rework.

**Lean:** fan-out (loop the team's tokens, ingest per owner) — keeps the owner-scoped model and RLS intact;
just changes the resolver from `limit(1)` to "for each operator". Same fix applies to the DM path's
known 3.2 multi-login gap (see `SLACK_MESSAGES_GROUNDING_BACKLOG_HANDOFF_2026-06-08.md` §3.2) — consider
doing both together. **Effort: M.** **Files:** `slack-events/index.ts` (`processChannelEvent` resolver),
no schema change for fan-out.

**Gotcha:** the echo filter (`event.user === tokenRow.slack_user_id`) is per-resolved-operator; in a
fan-out it must skip the post for the operator who authored it but still mirror it for the *others* (one
operator's post is another's inbound). Get this right or you double/miss.

---

## 3. Channel history backfill

**Current behavior (the gap):** ingest is **go-forward only** — only messages posted *after* the bot
joined + events were wired appear. Historical channel messages are absent.

**Approach:** a one-shot, bounded import using the existing bot read engine:
- `new SlackService(getSlackBotToken()).getChannelMessages(channelId, channelName, limit)` already returns
  normalized `UnifiedMessage[]` (text, sender, ts, thread_ts) via `conversations.history` + `users.info`.
- For each, call a backfill RPC that reuses `ensure_slack_shadow_user` + the same dedup
  (`ingest_slack_channel_message` works as-is — its `EXISTS (thread_id, slack_ts)` pre-check + ON CONFLICT
  makes re-import idempotent against already-landed rows). So backfill = call the existing RPC per
  historical message; **no new ingest primitive needed.**
- Where to trigger: a "Load earlier" button in the channel thread (paged by `conversations.history`
  cursor), or a one-time sync on first channel open. Client-side (bot token is client-side) OR a new
  authed server route if you want it server-driven.

**Gotchas:** `conversations.history` is rate-limited (Tier 3, ~50/min) and `users.info` is N+1 (cache the
sender map — `getChannelMessages` already enriches per-sender, watch the cost at channel scale). Bound the
window (e.g. last 200 messages or 30 days) — do NOT unbounded-import. `slack_ts` dedup means re-runs are
safe. **Effort: M.** **Decision:** client-triggered (reuses bot token, simplest) vs server route
(centralized, but needs the bot token server-side which it isn't today).

---

## 4. AI grounding over channel content

**Current behavior (the gap):** Slack channel messages now live as first-class text rows in
`slack_channel_messages`, but no AI feature reads them. (The DM grounding put messages in `pulse_messages`,
which War Room / summaries may already see; channels are in the *sibling* table, invisible to those.)

**Approach:** feed channel threads into the existing AI surfaces. All Gemini/AI runs are **server-side via
Supabase edge functions** (memory `project_pulse_gemini_serverside` — do NOT add client API calls):
- **Thread summary / catch-up:** a "Summarize this channel" action that reads `slack_channel_messages`
  for a thread and routes through the existing summarizer seam (mirror `relayAIService.summarizeConversation`
  / the Glimpse briefing generators, which already operate on text). Render the summary with the
  **coral** AI-provenance treatment (this is the ONE place coral is correct — AI output, per CLAUDE.md §4).
- **War Room / RAG grounding:** add `slack_channel_messages` as an ingest source for the War Room RAG
  corpus so channel discussions are searchable/answerable alongside other sources.
- **Search:** index channel messages into the unified Search workbench.

**Gotchas:** coral is reserved for AI output — fine here, but keep the channel *chrome* neutral (only the
summary/insight card gets coral). Server-side only for Gemini. Volume: summarize per-thread, not the whole
channel, to bound tokens. **Effort: M–L** depending on how many surfaces. **Decision:** which surface
first — per-thread summary (smallest, highest "it's alive") vs War Room corpus (biggest unlock).

---

## 5. Suggested sequencing (by leverage / risk)

1. **Threads UI (§1.1)** — S, data already stored, pure UI win.
2. **Channel backfill (§3)** — M, reuses the RPC verbatim, big content unlock, low risk.
3. **Edits/deletes (§1.2)** — M, fidelity; needs the subtype-branch + 2 RPCs.
4. **Multi-operator routing (§2)** — M, do alongside the DM 3.2 fix.
5. **Reactions (§1.3)** — M, needs a storage decision (metadata vs side table).
6. **AI grounding (§4)** — M–L, start with per-thread summary (coral card).

---

## 6. Cross-cutting rules (carry over from v1)

- **Don't loosen the fail-closed edge-fn discipline** — branch explicitly on event type/subtype; an
  unknown shape is dropped, never mis-ingested. The DM `isDm` gate and the channel branch stay disjoint.
- **Never route `xoxp-` through `/api/slack/proxy`** (D7) — any new write is a dedicated authed route.
- **Schema-first**: dry-run-rollback every migration; verify columns via MCP, don't guess.
- **Coral = AI output only.** Channel chrome stays neutral + plum "via Slack"; only AI summary/insight
  cards earn coral.
- **Workspace lock**: only the installed workspace (Qntmecos, `T0B63H511LJ`) is visible.
- **Test refs**: `#all-qntmecos` = `C0B675PS5M2`; operator FM1 = `U0B5X67Q7A7` (echo-filtered); post as
  Frankie Messana (`U0B675R9D44`) to exercise inbound.
- **Local test loop**: `npm run server` (backend on `:3003`, `VITE_BACKEND_URL=localhost:3003`); flag
  `slackChannelsGrounding` toggle in Settings → Features & Labs → Integrations.

---

**Resume:** pick an item from §5; each is independently shippable behind the existing
`slackChannelsGrounding` flag. None requires re-touching the verified v1 ingest/outbound/render core —
they extend it.
