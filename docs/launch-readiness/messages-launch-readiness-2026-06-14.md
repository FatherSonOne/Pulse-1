# Pulse Section Launch Readiness — Messages

**Date:** 2026-06-14
**Section:** Messages (`src/components/Messages.tsx` + `pulseService` + supporting components)
**Method:** Forensic capability audit (parallel subagents) + live-schema verification (Supabase MCP) + failsafe inventory + competitive intelligence. **Read-only** — no code was modified. Per `CLAUDE.md`, auditing and executing are separate acts; the Sprint items below are proposals, not approved work.

---

## TL;DR

**Overall score: 84/120 (70%) → LAUNCH WITH CAVEATS.**

The **core real-time DM engine is genuinely launch-ready** — send/receive, robust optimistic-update dedup, reactions, edit, delete, star, forward, real (non-faked) typing indicators, attachments, voice messages, pagination, and conversation CRUD all work end-to-end against a clean, correctly-RLS'd schema. There is **no Sprint-0 data-loss blocker** in the core path, which is a strong result for a 5,915-line surface.

The caveats are about **trust polish and honest scope**, not broken plumbing:
- **SMS is theatrical on web** (honest banner, but no real send) — so the "unified messaging incl. SMS" pitch cannot ship as a live claim.
- **No delivery/read-receipt ladder** — only an unread count. This is a table-stakes gap for a 1:1 DM product.
- **Two error paths fail silently** (forward-message, delete-conversation — both CONFIRMED on verification) and **AI assist degrades to a *silent no-op*** on edge-fn failure (no timeout / leaked loading flags — **not** the visible "hanging panel" a first read implied; see Verification Addendum).
- **Schedule-send is built but unreachable** on the Pulse-DM path — backend + modal fully wired, but no UI trigger renders for a Pulse conversation.
- **Large dark-launched / dead surface area** — 80+ "MessageEnhancements" components sealed behind `MESSAGES_TOOLS_ENABLED = false`, the entire Slack-into-Messages transport behind an OFF flag, and a `BotMessage` card cluster that is fully orphaned.

Ship the core DM; gate the over-promises; fix the trust gaps within two weeks.

---

## Verification Addendum — 2026-06-14 (post-audit)

The five ⚠️ FRAGILE / "verify" items below were re-checked **read-only** by parallel subagents reading the *actual* code (symbol-grep, not the audit's `~line` numbers), each with an adversarial second pass on any confirmed bug. Verdicts are corrected back into the capability matrix, failsafe table, trust-killers, and roadmap that follow.

| Item | Original status | Verified verdict (2026-06-14) | Real bug? |
|---|---|---|---|
| Delete-message restore semantics (Sprint1 #4 / row 7) | ⚠️ FRAGILE — "verify restore" | **REFUTED — code is correct.** On failure it re-inserts the snapshot with a dedup guard + re-sort and the "restored" toast matches reality; success removal is safe (refetch filters `is_deleted=false`, realtime is INSERT-only). | No — **item dropped** |
| Schedule-send open-trigger (Sprint1 #5 / row 10) | ✅ REAL¹ — "verify trigger surfaced" | **CONFIRMED unreachable.** `PulseComposer` (the only Pulse-DM composer) has no schedule control; both openers (`/schedule` slash + "View" button) live in `MessageInputSection`, which `return null`s for every Pulse conversation (`if (!activeThread \|\| activePulseConversation) return null;`). Backend + modal fully wired → reachable by **zero** gestures. | **Yes — reclassified 🔌 DISCONNECTED** |
| Forward-message failure (row 8) | ⚠️ FRAGILE | **CONFIRMED.** Catch is `console.error` only; the modal closes identically on success/failure; no `setPulseEditToast`. User believes it sent. | Yes |
| Delete-conversation failure (row 14) | ⚠️ FRAGILE | **CONFIRMED.** Catch is `console.error` + "no rollback needed"; optimistic removal leaves the conv gone from the UI while the DB row survives; refetch resurrection is **not** guaranteed soon (the sub fires only on INSERT/UPDATE; a failed delete changes no row). | Yes |
| AI assist "hang blank" (Sprint1 #1) | ⚠️ FRAGILE — "hangs blank forever" | **PARTIAL — symptom overstated.** Mechanical gap is real (no try/catch, no timeout; `invokeAI` never forwards its declared `signal`; `loadingAI`/`loadingContext` leak true). But `loadingAI` is read in **zero render branches** → worst observable symptom is a **silent no-op**, not a visible hung skeleton. | Hygiene only — re-ranked |

**Net:** 1 worry refuted, 3 confirmed bugs (all with trivial pattern-matching fixes — the `setPulseEditToast` infra already exists), 1 reclassified dead feature, 1 severity downgrade. Headline verdict (**LAUNCH WITH CAVEATS**) unchanged.

---

## Phase 1 — Forensic Capability Audit

### 1a. Surface topology

| Layer | Files |
|---|---|
| **Main surface** | `src/components/Messages.tsx` (5,915 lines — god component), rendered at `src/App.tsx:1452` |
| **Primary composer** | `src/components/PulseComposer.tsx` — **unconditional** Pulse-DM composer (`Messages.tsx:5081`); the `pulseComposerV2` flag is **vestigial** here (comment `Messages.tsx:5075-5078`) |
| **Legacy / SMS composer + AI panels** | `src/components/Messages/MessageInputSection.tsx` (787 lines, `Messages.tsx:5826`) → wraps legacy `MessageInput.tsx` (853 lines) + `BundleAI` lazy panels |
| **Services** | `pulseService.ts` (1,322 lines — DM send/receive/realtime + scheduling), `messageService.ts` (436 lines — **in-app announcements, NOT chat**), `messageChannelService.ts` (workspace channels) |
| **Supporting (LIVE)** | TriageBrief, ConversationSidebar, RelationshipRail, ConversationSpine, FilterBar, SnoozeMenu/RemindersInbox, FocusMode, MessageContextMenu, MoodBadge, LinkPreviewCard, TypingIndicator |
| **Tables (Pulse DM)** | `pulse_messages`, `pulse_conversations`, `user_profiles`, `pulse_message_reactions`, `pulse_starred_messages`, `pulse_scheduled_messages` |

### 1b/1c. Capability matrix — **reachable shipping surface**

> Status key: ✅ REAL · ⚠️ FRAGILE · 🔌 DISCONNECTED · 🎭 THEATRICAL · 💀 DEAD. Slack-transport rows are real *code* but **gated OFF** — see §1f.

| # | Capability | UI / Handler (file:line) | Service / Edge Fn → Table | Status | Notes |
|---|---|---|---|---|---|
| 1 | Send Pulse DM | `sendPulseMessage` (Messages.tsx:1413) / PulseComposer `onSend` (5082) | `pulseService.sendMessage` → RPC `send_pulse_message` → `pulse_messages` | ✅ REAL | Optimistic add; on error removes bubble + **restores text to composer** + toast (≈1516-1522) |
| 2 | Receive in real time | `subscribeToMessages` (1081) | Supabase `postgres_changes` INSERT, RLS-filtered | ✅ REAL | **Dedup is robust** — reconcile-by-(sender+content), single-flag, exact-id short-circuit (1088-1112). The old "disappearing message" race is fixed |
| 3 | Typing indicator (send/receive) | `broadcastPulseTyping` (1183) / `subscribeToTyping` (1171) | Supabase Realtime broadcast (no persistence) | ✅ REAL | **No `Math.random` fakery** — real channel push; 3s auto-clear |
| 4 | Mark read / unread count | effect on conversation open (≈1372) | RPC `mark_messages_read` → `pulse_messages.is_read` | ✅ REAL | Silent on RPC failure (no UI cost) |
| 5 | Reactions (toggle / picker) | `handlePulseReaction` (1602), `FullEmojiPicker` (5042) | `pulseService.toggleReaction` → `pulse_message_reactions` | ✅ REAL | Optimistic; reloads from server on error |
| 6 | Edit message | `saveEditPulseMessage` (≈3284) | `pulseService.editMessage` → `.update()` | ✅ REAL | Clears reactions optimistically (locked design); reloads thread on error |
| 7 | Delete message (soft) | `handlePulseV2Action('delete')` (3414-3429), `window.confirm` | `pulseService.deleteMessage` (`is_deleted=true`) | ✅ REAL | **VERIFIED 2026-06-14:** failure re-inserts the snapshot with dedup + re-sort and the "restored" toast matches reality; success removal is safe (refetch filters `is_deleted=false` at 347-351, realtime is INSERT-only at 744-749). |
| 8 | Forward message | ForwardMessageModal; `handleForwardPulseMessage` (3465-3476) | `pulseService.forwardMessage` → new `pulse_messages` row | ⚠️ FRAGILE | **CONFIRMED 2026-06-14:** catch is `console.error` only; modal closes identically on success/failure; no `setPulseEditToast`. User thinks it sent. |
| 9 | Star / save | `toggleStarPulseMessage` (≈1644) | `pulseService.toggleStar` → `pulse_starred_messages` | ✅ REAL | Optimistic; reloads on error |
| 10 | Schedule send | `handleScheduleMessage` (3078-3099) → ScheduleMessageModal via MessagesTopModals (460-462) | `pulseService.scheduleMessage` → `pulse_scheduled_messages` (+ server cron) | 🔌 DISCONNECTED | **CONFIRMED unreachable 2026-06-14:** backend + modal fully wired, but the only openers (`/schedule` slash 165, "View" button 782) live in `MessageInputSection`, which `return null`s for every Pulse conversation (`:126`). `PulseComposer` has no schedule control. Scheduling is Pulse-only by design (`recipientId = activePulseConv?.other_user?.id`, 3087) — so it's reachable by **zero** gestures. |
| 11 | Attachments (image/video/file) | MessageInputSection attach menu (≈540-630) | `pulseService.uploadAttachment` → Storage `pulse-attachments` → `pulse_messages.media_url` | ✅ REAL | Upload failure blocks send (correct) |
| 12 | Voice message | MessageInputSection recorder | MediaRecorder → `sendMessageWithAttachment` → `pulse_messages` | ✅ REAL | Recorder cleaned up on unmount |
| 13 | Copy / Mention / Share / Create-Task / Propose-Decision (context menu) | MessageContextMenu → `handlePulseV2Action` (≈3355-3402) | Clipboard / setInputText / `taskService` / `decisionService` | ✅ REAL | Create-task no-ops silently if no workspace |
| 14 | Conversation CRUD (open/create, archive, mute, delete) | `getOrCreateConversation` (1328); `handleDeletePulseConversation` (3185-3204) | RPC `get_or_create_conversation` + `.update()` → `pulse_conversations` | ⚠️ FRAGILE | Get/create are REAL. **CONFIRMED 2026-06-14:** delete-conversation failure is silent (`console.error` + "no rollback needed", 3200-3202); optimistic removal leaves the conv gone from UI while the DB row survives. |
| 15 | Search Pulse users (new convo) | debounced effect (1200) | `pulseService.searchUsers` → RPC `search_users` → `user_profiles` | ✅ REAL | Empty on error |
| 16 | Search within thread | client filter (`filteredMessages`, 2249) | local `.includes()` | ✅ REAL | Substring only; no fuzzy/AI search |
| 17 | Pagination (older messages) | `loadMoreMessages` (≈1356) | `pulseService.getMessagesPaginated` | ✅ REAL | Cursor + loading guard; virtualized list (`useVirtualList`) |
| 18 | Empty state | `renderEmptyChatArea` → TriageBrief (3701, 5104) | derived from real conversations | ✅ REAL | Real triage brief, not a blank screen |
| 19 | Focus mode digest | (≈2347) | computed from real `last_message_at` deltas | ✅ REAL | Previously a hardcoded fake string; now a real digest |
| 20 | Drafts | PulseComposer / MessageInput | `localStorage` `pulse_msg_draft_v1:` | ✅ REAL | Survives refresh; **not** synced across devices |
| 21 | SMS send (non-Pulse contact) | `handleSendSms` (2239) | native: `openSmsApp` (real) · web: honest banner (2246) | 🎭 THEATRICAL | Web has **no real send** by design (W7 deferred — comment 2234-2238); native hands off to device SMS app |
| 22 | AI Coach / Mediator / Voice Extractor | MessageInputSection BundleAI panels | `geminiService.*` (server-routed) | ⚠️ FRAGILE | **CORRECTED 2026-06-14:** real gap is no try/catch + no timeout (`invokeAI` never forwards its declared `signal`), leaking `loadingAI`/`loadingContext`. But `loadingAI` is read in **zero render branches** → worst symptom is a **silent no-op**, not the "blank hanging panel" first claimed. |
| 23 | Smart Compose / slash-command templates | PulseComposer (`STUB_TEMPLATES`) | stub (hardcoded list) | 🔌 DISCONNECTED | UI present, returns hardcoded suggestions; no real backend |
| 24 | Voice-to-text (dictation) | `VoiceTextButton` | stub handler | 🎭 THEATRICAL | Button present, dictation not wired |

**Synthesized counts (reachable surface, post-verification 2026-06-14):** ~17 REAL · 4 FRAGILE · 3 DISCONNECTED · 2 THEATRICAL (delete-message ⚠️→✅; schedule-send ✅→🔌). Plus a **gated-OFF** Slack transport (built & previously LIVE-verified) and a **dead** `BotMessage` cluster (see below).

### 1d. Data integrity (verified against live `pulse-chat` / `ucaeuszgoihoyrvhewxk` via Supabase MCP)

All six Pulse-DM tables: **RLS ON, participant-scoped, no wide-open `true` policies, 0 security-advisor lints.** FKs and constraints confirmed via `pg_constraint`:

- `pulse_messages.sender_id / recipient_id` → `auth.users(id) ON DELETE CASCADE`; `CHECK no_self_message`.
- `pulse_conversations.user1_id / user2_id` → `auth.users(id) ON DELETE CASCADE`; `CHECK different_users`; **unique-pair index** `idx_pulse_conversations_unique_pair` on `(LEAST,GREATEST)` (symmetric, dup-proof). No INSERT policy by design — writes go only through the `get_or_create_conversation` SECURITY DEFINER RPC (race-safe, same LEAST/GREATEST keying).
- All RPCs are SECURITY DEFINER with `search_path` pinned and caller-guarded. Signatures match the TS call sites exactly.
- **Memory claim that all 4 participant cols FK→`auth.users` + CHECKs + unique-pair index — CONFIRMED verbatim.**

**Risks found (none CRITICAL):**
| Severity | Risk |
|---|---|
| IMPORTANT | `pulse_messages.content_type` has **no CHECK constraint** — TS narrows to `text\|image\|voice\|file` but DB/RPC accept any string. Unenforced invariant; low blast radius (first-party sends). |
| MINOR | `pulse_messages.thread_id` has **no FK** to `pulse_conversations(id)` — orphan messages are schema-permitted (safe today: always set from the RPC). |
| MINOR | TS↔schema: `PulseMessage.sender/recipient` typed as present `UserProfile` but assigned `|| null`. On a Slack-shadow `auth.users` row there's no `user_profiles` entry → `msg.sender!.x` would NPE. **Mitigated by Slack flag being OFF.** |
| MINOR | TS `UserProfile` over-strict / omits DB-only cols (`role`, `status`, `online_status`, …); harmless because reads use `select('*')`. |

### 1e. Failsafe inventory

| Scenario | Handling | Grade |
|---|---|---|
| Network disconnect mid-send | Optimistic rollback + text restored to composer + toast (1516-1522). **No retry/queue.** | B |
| Send / Supabase insert failure | Graceful rollback both Pulse + Slack paths | A |
| Empty / invalid submit | Guarded (`!content.trim()` 1414) | A |
| Empty state (no convos) | TriageBrief surface | A |
| Empty thread | No bubbles + composer; no "start" hint | B |
| Real-time dedup race | **Fixed** (1088-1112, reconcile-by-content) | A |
| Subscription cleanup | All 4 channels unsubscribed in effect returns (1123/1141/1159/1176) | A |
| Large message thread | Virtualized + paginated | A |
| Large conversation list | `getConversations` has **no server-side limit** — loads all | B |
| Mobile / Capacitor keyboard | Safe-area padding (`messages.css:648`), MobileDrawer, responsive collapse <768px | A |
| Desktop / Electron | No Electron-specific code; **untested** | B |
| Token expiry mid-work | Relies on Supabase auto-refresh; 401 caught by send error path | B |
| **AI edge-fn failure / timeout** | `generateSmartReply`/`generateCatchUpSummary` awaited **without try/catch or timeout** (2797, 2282); `invokeAI` never forwards its `signal`. **CORRECTED 2026-06-14:** leaks loading flags but renders nothing → **silent no-op**, not a visible hang | **B−** |
| Delete message | `window.confirm` + optimistic remove + **verified rollback** (re-insert snapshot, dedup, re-sort) + matching toast | A |
| **Delete conversation** | `window.confirm` + optimistic remove; **CONFIRMED 2026-06-14** failure is silent `console.error` + no state restore (3200-3202) — conv vanishes from UI, DB row survives | **C** |

### 1f. Dead / flagged inventory (built but not reachable today)

| Item | State | Why |
|---|---|---|
| **Tools menu + 80+ MessageEnhancements bundle components** (MessageScheduling-UI, MessageEncryption, MessagePinning, MessageVersioning, MessageThreading, MessageBookmarks, MessageStatusTimeline, CollaborativeAnnotations, AnalyticsDashboard, …) | **SEALED** | `MESSAGES_TOOLS_ENABLED = false` (Messages.tsx:425) removes the entry button + nulls `setActiveToolOverlay`. Unreachable even if the per-feature flags flip. |
| **Slack-into-Messages 1:1 transport** (`sendSlackUserMessage`, graduation prompt) | **DARK-LAUNCHED** | `slackMessagesGrounding` default OFF (gate Messages.tsx:880). Code is real and was LIVE-verified previously, but no user reaches it. |
| **Slack Channels grounding** | **DARK-LAUNCHED** | `slackChannelsGrounding` OFF; separate nav view, not in Messages surface. |
| **`pulseComposerV2` / `toolsMenuV2` flags** | **VESTIGIAL / OFF** | PulseComposer now renders unconditionally regardless of `pulseComposerV2`; `toolsMenuV2` gates a placeholder. |
| **`BotMessage` + `ActionItemsCard` + `MeetingBriefingCard` + `MeetingRecapCard`** | **DEAD CODE** | `BotMessage` is never imported by Messages.tsx; the cards are imported only by `BotMessage`. Fully orphaned. |
| Classic composer AI (`voiceInput`/`aiComposer`/`toneAnalysis`) | RETIRED | Only gate the legacy `MessageInput`, off the Pulse-DM path. |

---

## Phase 2 — User Trust Assessment

### 2a. The "real user" test
- **Solo founder consolidating tabs:** Can DM another Pulse user, send/edit/react/forward, attach files, leave a voice note, and come back to a persistent thread — **yes, this works and feels trustworthy.** They will be confused that texting a phone-only contact silently can't send from the web (honest banner helps), and that there's no "delivered/read" confirmation.
- **Small-team lead evaluating Pulse Team:** Real-time DM works; but no read receipts, no message export, and the "unified inbox" promise is only half-real (Slack dark-launched, SMS mocked). They'll perceive it as a capable 1:1 messenger, not yet the Front/Missive replacement the marketing implies.

### 2b. Trust killers (ranked)
> Re-ranked 2026-06-14 after verification.
1. **Forward & delete-conversation fail silently** (CONFIRMED) — user believes an action succeeded when it didn't. *Highest real trust risk.*
2. **Schedule-send is built but unreachable** (CONFIRMED) — a wired feature with no UI entry point on the Pulse-DM path.
3. **No delivery/read indicator** — users can't tell if a message landed (universal messaging reflex).
4. **SMS web banner** — honest, but still a dead end where a capability appears to exist.
5. **AI assist silent no-op on failure** (CORRECTED — *not* a visible hang; downgraded from the original #1) — clicking does nothing, no error.
6. ~~Misleading "restored" delete toast~~ — **REFUTED:** the toast matches the real rollback.

### 2c. Stickiness
| Factor | Rating |
|---|---|
| Data in (search users, quick start convo) | **Present** |
| Data out (export / reports) | **Missing** — no message export found |
| Faster than the tab pile | **Partial** — for Pulse-to-Pulse only |
| AI saves time (summary/actions) | **Partial** — real but fragile; not surfaced as headline |
| Voice-first DM | **Present** (real differentiator vs Front/Missive) |
| Cross-section context (tasks/decisions/CRM from a message) | **Present** (real moat) |
| History / recall | **Present** (persistent, paginated) |
| Collaboration (mentions, shared views) | **Partial / Missing** |

---

## Phase 3 — Competitive Intelligence

Incumbents: Slack, Microsoft Teams, Front, Missive, Spike/Shortwave, OpenPhone (SMS); WhatsApp/Telegram as the consumer baseline.

### Table-stakes (a DM product missing these reads as broken)
1. Instant delivery + **store-and-forward / resend on reconnect** — **Pulse gap:** no offline send queue; failed sends restore text but don't auto-retry.
2. **Receipt ladder: sent → delivered → read** — **Pulse gap:** only an unread count.
3. Typing indicator — **Pulse ✓ (real).**
4. Voice notes — **Pulse ✓ (a strength).**
5. Emoji reactions — **Pulse ✓.**
6. Reply/quote to a specific message — **Pulse partial** (forward yes; verify inline reply-to).
7. Edit + delete-for-everyone — **Pulse ✓** (and a wedge: SMS can't, email-based rivals don't).

### Expected (missing = feels incomplete)
Message scheduling (**Pulse ✓, wired**), history search (**Pulse ✓ basic**), inline attachment preview (**✓**), presence/status (**partial — static "Online"**), reliable @mentions (**partial**), **message export (Pulse ✗)**, mobile-at-desktop-parity (**Android ✓, iOS untested**), AI summary/compose (**Pulse ✓ but fragile**).

### Delighters / where Pulse can win (if real)
1. **Genuinely unified DM + SMS + Slack** in a consumer-grade surface — clear white space (Front/Missive unify *support* channels; Slack/Teams stay in-walls) — **but only if SMS becomes real.**
2. **AI summary/actions included server-side, no add-on SKU / no BYO-key** — undercuts the category's "AI tax" (Teams Copilot paid, Front $20/seat add-on, Missive BYO-key).
3. **Edit + unsend on an owned transport** — impossible for SMS, absent in email rivals.
4. **Voice-in-DM** — Front/Missive have none; Teams mobile-only.
5. **AI-grounded search** — search is the single most universal complaint across Slack/Teams/Front/Missive; Shortwave's AI search is the lone praised one.

### Moats claimed-but-not-real (trust risk)
- "Unified messaging incl. SMS" — **SMS is mocked.** Shipping this claim contradicts the very reliability signals (never-lose-a-message, delivery confirmation) users trust. **Gate the claim to live channels only.**

---

## Phase 4 — Launch Readiness Scorecard

| Dimension | Score | Evidence |
|---|---|---|
| Core Functionality | 9/10 | DM send/receive/edit/delete/react/forward/voice/attach REAL & verified; **schedule-send backend wired but UI entry unreachable** on the Pulse-DM path (CONFIRMED 2026-06-14 — arguably 8/10) |
| Data Reliability | 9/10 | Clean RLS schema, robust dedup, optimistic rollback; minor unconstrained `content_type` |
| Error Resilience | 6/10 | Send path A; **AI calls now B− (silent no-op, not a hang — corrected 2026-06-14), delete-conversation (C) CONFIRMED, forward (C) CONFIRMED, no offline resend** |
| User Confidence | 6/10 | Core trustworthy; no receipt ladder; **CONFIRMED silent failures** (forward, delete-conversation); AI assist is a silent no-op on failure (not a hang — corrected 2026-06-14) |
| Completeness | 7/10 | Shipping core complete; huge sealed/dark/dead surface area behind it |
| Performance | 7/10 | Virtualized + paginated; `getConversations` unbounded; reactions sub re-subscribes per message |
| Competitive Parity | 6/10 | Missing read receipts + offline resend + export; matches most else |
| Platform Parity | 7/10 | Web + Android solid; iOS/Electron untested |
| Theme Parity | 8/10 | Canonical `--pulse-*`; no coral misuse; some consistent hardcoded grays |
| Onboarding | 6/10 | Good empty state; no first-run teaching for Messages |
| Polish | 7/10 | Path-D bubbles/rail/spine/context-menu GA; dragged by fragile AI + dead-code clutter |
| Stickiness | 6/10 | Real voice + cross-section moats; missing export, unified SMS, great search |
| **Total** | **84/120 (70%)** | **LAUNCH WITH CAVEATS** |

> **Net effect of the 2026-06-14 verification on the 84 total: ≈neutral.** Core Functionality presses down ~1 (schedule-send unreachable); Error Resilience / User Confidence press up ~1 (the AI symptom is a silent no-op, milder than scored). The two offset, so the numeric total is held at 84 and the headline verdict (**LAUNCH WITH CAVEATS**) stands — the verified picture is *more* trustworthy on the AI axis and *less* complete on schedule-send.

---

## Phase 5 — Roadmap to Launch-Ready

### 🚨 Sprint 0 — Launch blockers (positioning/scope, not core code)
> **RESOLVED 2026-06-14 — both items closed with NO code change** after reading the shipped copy + flags.

| # | Item | Type | Effort | User | Trust |
|---|---|---|---|---|---|
| 1 | ~~**Gate the "unified messaging / SMS" claim**~~ → **ALREADY HONEST, no change.** No SMS over-claim exists: the Messaging subhead is scoped to *"Pulse channels, threads, and DMs… with Slack as an opt-in connector"* (`LandingPage.tsx:2288`), the FAQ calls Slack an *"opt-in beta"* (`landingData.ts:47`), the "Unified" mock pairs with the **Slack** icon not SMS (`:2320`), and in-app SMS is flag-gated OFF (`inAppSms` default `false`, `App.tsx:248/747`, never advertised). | Positioning | — | 5 | 5 |
| 2 | ~~Decide Slack-grounding flag posture~~ → **DECIDED: keep status quo (Option A).** `slackMessagesGrounding` stays **default OFF but user-toggleable** in Settings → Integrations (Beta) (`FeatureContext.tsx:141`, category `:304-312`). This *already* matches the landing's "opt-in beta" promise, so no flip + no re-verify needed for launch. (Open follow-up, separate from the claim: confirm the beta actually functions end-to-end when toggled on — a deploy/backend question.) | Decision | — | 4 | 4 |

### ⚡ Sprint 1 — Core reliability (week 1)
> Re-prioritized 2026-06-14 after read-only verification (see Verification Addendum). Original #4 (delete-restore) **dropped — verified correct**. All items below are CONFIRMED in code.

| # | Item | Type | Effort | User | Trust |
|---|---|---|---|---|---|
| 1 | Surface **forward-message failure** — add `setPulseEditToast(...)` in the `handleForwardPulseMessage` catch (3471-3472) and don't close the modal as if it succeeded. | Bug | S | 3 | 4 |
| 2 | Surface **delete-conversation failure** — toast + restore the removed conv in the catch (3200-3202), matching the message-delete pattern. | Bug | S | 3 | 5 |
| 3 | **Add a Schedule-send entry point** to the Pulse-DM/`PulseComposer` branch (5069-5081) that calls `setShowScheduleModal(true)` — backend + modal already wired; feature is currently unreachable. | Gap | S | 3 | 3 |
| 4 | **AI assist resilience (downgraded):** wrap `generateSmartReply` (2797) / `generateCatchUpSummary` (2282) in try/finally that clears the loading flags + add an `AbortSignal.timeout(...)` forwarded through `invokeAI`'s existing `opts.signal`. Symptom is a silent no-op, not a hang — hygiene, not the original trust-killer. | Bug | S | 2 | 2 |

### 🔧 Sprint 2 — Completeness (week 2)
| # | Item | Type | Effort | User | Trust |
|---|---|---|---|---|---|
| 1 | **Delivery/read-receipt ladder** (sent → delivered → read). Schema already tracks `is_read`/`read_at`; surface it. | Feature | M | 5 | 5 |
| 2 | **Offline send queue + auto-resend on reconnect** (table-stakes; today only restores text). | Feature | M | 4 | 5 |
| 3 | Bound `getConversations` (server-side limit + lazy load) before any power user hits 1000+ threads. | Perf | S | 2 | 3 |
| 4 | Add `CHECK` constraint on `pulse_messages.content_type`. | Hardening | S | 1 | 2 |

### ✨ Sprint 3 — Polish & parity (week 3)
| # | Item | Type | Effort | User | Trust |
|---|---|---|---|---|---|
| 1 | **Message export** (per-conversation JSON/CSV) — portability/trust + matches Missive. | Feature | M | 3 | 4 |
| 2 | Inline **reply-to-specific-message** (quote) if not already present. | Feature | M | 3 | 3 |
| 3 | Fix reactions subscription churn (depends on `pulseMessages`, re-subscribes per message — 1162). | Perf | S | 2 | 2 |
| 4 | **Remove dead `BotMessage` cluster** (4 files) — present full pros/cons per `CLAUDE.md` Rule A before deleting. | Cleanup | S | 1 | 2 |
| 5 | iOS + Electron smoke test of the Messages path. | QA | M | 2 | 3 |

### 🚀 Sprint 4 — Differentiation (post-launch)
| # | Item | Type | Effort |
|---|---|---|---|
| 1 | **Real cross-channel unification** — make SMS real (Twilio integration + server send endpoint, the W7 deferral) so the "unified" claim becomes true. | Feature | XL |
| 2 | **AI-grounded message search** (the category's universal sore spot). | Feature | L |
| 3 | Surface **AI thread summary + action items** as a headline, server-side, no add-on — directly counter the "AI tax." | Feature | M |
| 4 | Surface **voice-in-DM** as a first-class differentiator vs Front/Missive. | Feature | M |

### Implementation handoff — Sprint 1 (re-ranked 2026-06-14)
> After verification the **highest-trust-impact** items are the silent-failure pair (forward + delete-conversation toasts), each a one-line `setPulseEditToast` in the existing pattern. The AI item below was the original #1 but is **downgraded** — its corrected handoff is retained for when it's picked up.
```
## Item: AI assist degrades silently on edge-fn failure (no try/catch, no timeout)
Problem: generateSmartReply (2797) / generateCatchUpSummary (2282) are awaited
         without try/catch or timeout; invokeAI (aiService.ts:67) never forwards
         its declared opts.signal. On a hard router error the loading flags
         (loadingAI/loadingContext) leak true — but they're read in ZERO render
         branches, so the visible symptom is a SILENT NO-OP (click -> nothing
         inserts, no error), NOT the "blank hanging panel" first reported.
Location: src/components/Messages.tsx:2797 (handleSmartReply), 2272-2306
          (fetchContext / generateCatchUpSummary); root cause src/services/ai/aiService.ts:67.
Fix: wrap each await in try/catch/finally that clears loadingAI/loadingContext +
     shows an inline "AI unavailable — tap to retry"; forward AbortSignal.timeout(~20s)
     into supabase.functions.invoke via the already-declared opts.signal.
Verify: point the edge fn at a 503 / add an artificial delay; confirm the control
        re-enables and shows retry, never a stuck flag. Build: npx tsc --noEmit (gate on no NEW errors).
Dependencies: none.
Effort: S (half-day).
```

---

## Phase 6 — Disposition

- **Started as an assessment + read-only verification; the verified Sprint 0 + Sprint 1 work was then executed in the same session (2026-06-14).**
- **Sprint 0 — CLOSED, no code change** (see §Sprint 0): #1 already honest, #2 decided = keep status quo (opt-in beta, default OFF).
- **Sprint 1 — SHIPPED** (commit `bccbf6f`): forward-failure + delete-conversation feedback/rollback, AI try/finally+timeout, and a reachable Schedule-send entry point (compose-in-modal). tsc-clean (no new type errors); not yet runtime-verified.
- **Recommended next step:** hand the remaining **Sprint 2/3** items (read-receipt ladder, offline resend, bound `getConversations`, `content_type` CHECK, message export, inline reply-to, reactions-sub churn, dead `BotMessage` cleanup, iOS/Electron smoke) to `/launch-prep` one at a time, and runtime-verify the Sprint 1 flows before relying on them.
- **The good news worth stating plainly:** the Messages *core* is real and verified — no data-loss blocker, clean schema, robust real-time, and the delete-message rollback + "restored" toast are provably correct. The work left is trust polish and honest scoping, not a rebuild.
