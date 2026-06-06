# Slack-Grounded Messages — Investigation & Design Handoff

> **Created:** 2026-06-06 · **Type:** investigation → design brief (NOT an implementation plan yet).
> **Goal of this handoff:** run a grounded investigation of the Messages architecture, then design the implementation of "Slack as a foundational grounding for Pulse Messages." Output = a locked scope doc + phased plan + a design-playground mockup (the same treatment Slack *send* got in `docs/SLACK_PHASE8_SCOPE_2026-06-05.md`).
> **Status:** NOT STARTED. No code. This is the input to the work, not the result.
> **Predecessor:** Slack send + per-contact identity (contactsHybrid Phase 8) — SHIPPED 2026-06-06, commits `65609aa → 5e1c271`. Scope: `docs/SLACK_PHASE8_SCOPE_2026-06-05.md`. Memory: `project_pulse_slack_phase8_scope`.

---

## 1. The thesis (why this exists)

Pulse **Messages today is Pulse-user-to-Pulse-user only** (`pulse_conversations` + `pulse_messages`, realtime via Supabase channels). At launch there will be **few Pulse users**, so Messages risks being a ghost town — a cold-start problem that blunts adoption.

**Idea:** bring Slack *into* the Messages section as grounding, so a user/team can ramp into Pulse Messages starting from their **existing Slack relationships**:

1. Messages is **populated on day one** from the user's real Slack people, not empty.
2. The user can message those people from Messages — **natively if they're on Pulse, via Slack if not**.
3. **Graduation:** a conversation lives in Messages and its *transport underneath* silently flips Slack → native Pulse as the counterpart joins (matched by email). Same thread, same surface, it just gets better.

This fits Pulse's "unify by person, channel-adaptive" thesis (Messages Path D, Email hybrid, Glimpse, Contacts Path D). Slack belongs **inside Messages as a transport**, NOT as a separate "Slack section" (a silo was explicitly rejected — see the conversation that produced this handoff). It is also NOT "rebuild a Slack client inside Pulse."

---

## 2. Verified constraints (from the Phase 8 audit — the design MUST respect these)

These were proven this session against real code; they are the hard realities that shape the build. **Do not design around the bot-token integration — it cannot deliver this feature.**

1. **Send-as-bot is wrong for Messages.** Phase 8 sends as the Pulse *bot* (`xoxb-`, `chat.postMessage`). In Messages, your outbound would land in the recipient's Slack as a DM **from a bot app**, not from you — a broken chat experience. *Real* messaging needs a **Slack user token (`xoxp-`) via OAuth user-scope** so it posts **as the human**. (Verified: Phase 8 verdict `bot-vs-user`.)
2. **A bot token cannot see the user's actual conversations.** A bot only reads channels/DMs it is a member of. The user's human-to-human Slack DMs/threads are invisible to it. So "ground Messages in my real Slack relationships" is exactly what a bot token **can't** provide — it requires the **user's own token + scopes** (`im:history`, `channels:history`, `users:read`, etc., as the user).
3. **No real-time inbound today.** Slack receive is **poll-based** (`conversations.history` → Unified Inbox). A live Messages thread needs **push: Slack Events API → a new Supabase edge function** (pattern: `supabase/functions/daily-webhook` + `ecosystem-inbound` — public `Deno.serve`, header/secret validated, service-role write). Includes Slack `url_verification` challenge + `x-slack-signature` HMAC verification.
4. **OAuth infra reality.** Pulse already runs **three Google OAuth clients + three token tables** (memory: `project_pulse_google_token_refresh`). A Slack **user-OAuth** would be a **new OAuth client + a new token table** + a real callback route (server.js currently has NO Slack OAuth — confirmed in `docs/INTEGRATIONS_BUILT_VS_STUB_AUDIT_2026-05-31.md`). This is genuine broker work, not bring-your-own-token.
5. **`/api/slack/proxy` is an unauthenticated open relay** (`server.js:139`). A user-token, real-conversation feature MUST add the Supabase Bearer auth check that Phase 8 deferred (Phase 8 §11.3 follow-up). Carry this forward.

---

## 3. What carries forward from Phase 8 (reuse — don't rebuild)

- **Identity resolver:** `slackService.lookupUserByEmail` + `contacts.slack_user_id` (column live in prod) + the `dbToContact`/`contactToDb` mapping. This is the **reconciliation primitive for graduation** (Slack user ↔ Pulse contact ↔ Pulse user, by email).
- **Server proxy + service:** `server.js /api/slack/proxy` (now with a POST branch), `slackService` (`lookupUserByEmail`/`openDm`/`sendMessage`), `slackToken.ts` (per-user token storage).
- **Channel-in-surface pattern:** `channelsFor.ts`/`ChannelRow.tsx` (Contacts) is the precedent for "a contact's reach is channel-adaptive."
- **Unified Inbox normalized model:** `unifiedInboxService` already normalizes a `slack` source into `UnifiedMessage` — possibly the substrate for inbound.
- **Scope-doc + mockup method:** mirror `docs/SLACK_PHASE8_SCOPE_2026-06-05.md` and `_design-playground/slack-redesign.html`.

---

## 4. PART 1 — Investigation plan (run this first; read-only)

Answer each question against the **real code/schema** (quote `path:line`; query `information_schema`/`pg_policy` via the Supabase MCP — project `pulse-chat` ref `ucaeuszgoihoyrvhewxk`). Do NOT infer from naming (Pulse schema is deliberately inconsistent).

### A. Messages surface architecture
- **Entry:** `src/components/Messages.tsx` (the Path D surface) + `src/components/Messages/` (ConversationSidebar, ConversationSpine, MessageInputSection, RelationshipRail, FilterBar, InviteToPulseModal, InviteTeamModal, BotMessage, …).
- Q: How is a conversation list assembled and rendered? Where would a Slack-backed (external) conversation slot in? What is the composer (`PulseComposer` / `MessageInputSection` / `MessageInputPortal`) and how does it send?
- Q: Is the surface hard-wired to Pulse-user participants anywhere (avatars, presence, typing, read receipts)? List the assumptions that break for a non-Pulse participant.

### B. Conversation + message data model (the crux)
- **Entry:** `src/services/pulseService.ts` — uses `pulse_conversations` (threads, ~lines 253/495–667) + `pulse_messages` (~316/459/614/1009/1151) + realtime `supabase.channel(...)` (~711/858/1099/1119).
- Q: **Query the real schema** of `pulse_conversations` and `pulse_messages` — columns, keys, FKs, RLS. Are participants keyed by `pulse_user_id` (uuid) only? Is there any `participant`/`member` table, or a 2-party shape?
- Q: **Can the model represent an EXTERNAL participant / a non-Pulse transport today?** (e.g., a conversation whose counterpart is a Slack user, not a Pulse user.) This is the central feasibility question. If not, what is the minimal additive schema change (a `transport`/`source` column on the conversation? an `external_participant` reference? a parallel table?) — sketch options, schema-first, dry-run-rollback.
- Q: How does realtime delivery work (channel naming, payload), and how would inbound-from-Slack be injected so the thread updates live?

### C. The Unified Inbox substrate
- **Entry:** `src/services/unifiedInboxService.ts`, `src/services/slackService.ts`, `UnifiedInbox.tsx`, `unifiedInboxDb` (Dexie/local) vs the `unified_messages` table.
- Q: Is the `UnifiedMessage` (source `slack`) model + storage the right substrate to power Slack-backed Messages threads, or does Messages need its own external-conversation concept? Where does inbound Slack currently land, and is it per-contact-addressable?

### D. Slack OAuth (user-scope) landscape
- **Entry:** `server.js` (Google/CRM OAuth routes as the pattern; NO Slack OAuth today), memory `project_pulse_google_token_refresh` (3-client/3-table reality).
- Q: Design the Slack **user-token** OAuth: a new Slack app/client config, callback route, a new token table (mirror `user_google_tokens`/`google_oauth_tokens`), refresh handling, and the **user scopes** needed (send-as-user `chat:write`; read the user's DMs/channels `im:history`/`channels:history`/`groups:history`; `users:read`/`users:read.email`; presence?). What does Slack distribution/verification require?
- Q: Bot token (Phase 8) vs user token — do we keep both (bot for app-level, user for messaging-as-you), or migrate? How do they coexist with `slackToken.ts`?

### E. Real-time inbound (Events API)
- **Entry:** `supabase/functions/daily-webhook/index.ts` + `ecosystem-inbound/index.ts` (the public-receiver pattern); Phase 8 audit dimension `inbound-webhooks` (webhookService.ts is DORMANT/wrong-HMAC — do NOT use it).
- Q: Design a Slack Events endpoint as a new edge function: `url_verification` challenge, `x-slack-signature` (`v0:timestamp:body`) HMAC verification, event routing (`message` events), service-role write into the conversation model, and de-dup vs the existing poll path. What's the subscription + Request URL setup on the Slack app?

### F. Identity, presence & graduation
- **Entry:** `contacts.slack_user_id` (Phase 8), `pulseUserDiscoveryService.ts`, `pulse_users` canonical table (memory: `project_pulse_users_canonical_table` — join on `auth_user_id`, filter `is_bot`), `InviteToPulseModal.tsx`.
- Q: How is "this person is on Pulse" determined today, and how does a Slack person map → Pulse contact → Pulse user (by email)? Design the **graduation** trigger: when a Slack counterpart becomes a Pulse user, how does the thread flip transport without losing history/continuity?
- Q: How does the existing **invite-to-Pulse** flow work, and can Slack grounding feed it (invite your Slack people into Pulse)?

### G. Cold-start economics (sanity check the lightest path)
- Q: Is the cold-start actually solved by the **lighter "graph grounding"** (Slack user-OAuth → import the user's real people into contacts/Messages + send-as-you + graduation) WITHOUT mirroring full Slack history? Or does the value require two-way thread mirroring? Decide the minimum that makes Messages non-empty + useful on day one.

---

## 5. PART 2 — Design decisions to resolve (with the investigation findings)

Each is a fork the design must lock, with options + tradeoffs, then a recommendation + rationale (mirror Phase 8 §3 "Locked Decisions"). Surface the genuinely user-facing ones as questions.

- **D1 · Scope: graph-grounding-lite vs full thread-mirroring.** (a) Import Slack people + send-as-you + graduation, no history mirror [lighter, likely higher ROI for cold-start]; (b) full two-way Slack threads inside Messages [richer, much bigger]. *Recommend (a) for v1; (b) as a later phase.*
- **D2 · Transport model in the conversation schema.** Extend `pulse_conversations` with a `transport`/`source` + external-participant reference, vs a parallel external-conversation table, vs riding the Unified Inbox model. (Schema-first; dry-run.)
- **D3 · Slack OAuth user-token** — new client + token table + callback + scopes. Required for D1 send-as-you regardless. Define the minimal scope set.
- **D4 · Real-time inbound** — Events API edge function (for two-way) vs poll-only (for grounding-lite). Tie to D1.
- **D5 · Graduation mechanic** — auto vs prompted; identity match by email; history continuity; what the UI shows on flip.
- **D6 · Messages UI** — how a Slack-backed thread is labeled/provenance'd (channel marker = Slack plum, never chrome; coral stays AI-only), composer behavior, the external-participant avatar/presence fallback, "invite to Pulse" CTA placement.
- **D7 · Proxy auth hardening** — add the Supabase Bearer check to `/api/slack/proxy` (Phase 8 deferred) as part of this, since user tokens flow through it.
- **D8 · Coexistence with Phase 8** — does Contacts' bot-token send stay, or fold into the user-token model? Keep `contacts.slack_user_id` as the shared identity key.

---

## 6. Expected deliverables of this work

1. A **locked scope doc** `docs/SLACK_MESSAGES_GROUNDING_SCOPE_<date>.md` — verified as-is, corrected assumptions, locked decisions (D1–D8), in/out scope, change-set, schema sketch (dry-run-first), OAuth + Events API contract, risks, ACs, open questions.
2. A **design-playground mockup** `_design-playground/slack-messages-grounding.html` — how a Slack-backed thread + the cold-start populated Messages + graduation look, on the real Pulse token shell (Slack plum marker only, coral = AI only, rose = Send). Verify headless via Playwright.
3. A **phased implementation plan**, additive, gated behind a new FeatureContext flag (default OFF), preserving Messages Path D (CLAUDE.md Rule A). Each phase independently committable + verified (tsc no-new-errors / vitest).

---

## 7. Guardrails (CLAUDE.md)

- **Schema-first.** Verify `pulse_conversations`/`pulse_messages`/token-table schemas against ground truth; dry-run every migration in a rolled-back transaction before applying once.
- **Additive behind a flag.** Preserve the working Messages Path D surface and pulseService realtime; this is layered on, not a rewrite. Removing/altering working code needs an explicit approved pros/cons (Rule A).
- **Coral = AI only.** Slack = plum channel marker; rose = Send CTA; never coral on these human surfaces.
- **Server-side Slack.** All Slack calls through the proxy/edge functions; no direct Slack from React (mirror the Gemini rule).
- **Don't rebuild Slack.** The target is grounding Messages in the user's graph + send-as-you + graduation — not a Slack client.
- **Parallel sessions.** A second Claude session has been active in contacts/messages files; commit eagerly with explicit paths, never `commit -a`/`stash` (see memory: `feedback_parallel_session_commit_a_sweep`).

---

## 8. Suggested execution

Run it like Phase 1 of Slack send: a **multi-agent investigation workflow** (parallel readers over A–G above → adversarial verification of the load-bearing claims, especially **B: can the conversation model carry an external participant** and **D/E: the OAuth + Events scope** → synthesis into the scope doc). Then a section-redesign-style mockup, then the phased plan.

**Start-here file list:** `src/components/Messages.tsx`, `src/services/pulseService.ts`, `src/components/Messages/{ConversationSidebar,ConversationSpine,MessageInputSection,InviteToPulseModal}.tsx`, `src/services/unifiedInboxService.ts` + `slackService.ts`, `src/services/pulseUserDiscoveryService.ts`, `server.js` (OAuth routes), `supabase/functions/{daily-webhook,ecosystem-inbound}/index.ts`, `docs/SLACK_PHASE8_SCOPE_2026-06-05.md`. Schema to query: `pulse_conversations`, `pulse_messages`, `pulse_users`, `contacts`, `user_google_tokens`/`google_oauth_tokens` (token-table template).

---

## 9. Open strategic questions for the user (resolve before/early in the work)

1. **Lighter vs richer (D1):** is the cold-start solved by *graph grounding + send-as-you + graduation* (no full history), or do you want full two-way Slack threads mirrored in Messages? (Strong recommendation: ship the lighter version first.)
2. **OAuth appetite:** are you OK standing up a real Slack **user-OAuth** app (new client, token table, distribution/verification)? It's required for any version that sends *as you* / reads *your* conversations — the bot token can't.
3. **Scope vs launch:** this is meaningfully bigger than Phase 8 and touches the Messages core. Is it a pre-launch ramp lever, or a fast-follow after the Pulse-native Messages launch?
