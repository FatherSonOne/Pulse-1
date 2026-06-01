# Messages Section — Triage Report — 2026-06-01

> Forensic damage assessment, not an improvement plan. This is a damage report:
> what's standing, what's cracked, what's collapsed, what was never finished.
> No benchmarking, no roadmaps, no fixes applied. Ground truth only, with
> `file:line` citations. Four highest-stakes findings were re-verified by hand
> against the source after the survey.

---

## Executive Summary

**Overall Health: FRAGILE** — the *live core* is genuinely solid; the *periphery* is a minefield.

| Metric | Count |
|---|---|
| Files touching the section | ~150 (Messages.tsx + 40 in `Messages/` + 89 in `MessageEnhancements/` + 8 services + 5 hooks + 1 context + ~13 migrations) |
| Largest single file | `Messages.tsx` — **5,498 lines** |
| Solid (live + real data) | ~45 components/methods |
| Cracked | ~12 |
| Severed | ~10 |
| Stub (mock/hardcoded in live path) | ~23 |
| Gutted | 1 service (`messageService.ts`) |
| Orphan (dead) | ~25 |
| Dormant (real but unmounted/flagged) | ~30+ |

**Plain-English summary.** The Pulse direct-message experience — the thing a
user actually touches every day — is **real and well-built**: it sends through
the `send_pulse_message` RPC into the real `pulse_messages` table, has real-time
with a carefully-fixed dedup race, real reactions/stars/edit/delete/forward/
schedule/bookmarks/tags, and a context menu that was promoted to GA. **Don't
touch that core.** The damage is everywhere around it:

1. **A latent guaranteed crash** sits in the dormant legacy-thread branch of
   `Messages.tsx` — three identifiers (`setShowCommandPalette`, `newMessage`,
   `setNewMessage`) are referenced but never declared. It only ships because that
   branch is unreachable in normal use and the build skips type-checking.
2. **The entire "message tools" surface is largely fake.** `ToolOverlay` renders
   ~38 enhancement components, most fed mock data (`generateMock*()`, `Math.random`)
   or no data at all. It's an opaque `z-40` overlay that *occludes* a second,
   real-data copy of the same panels rendering underneath — so the section
   double-mounts ~7 feature bundles and shows the fake one.
3. **SMS is not a real send** — it's an `sms:` URL hand-off, native-only, dead on web.
4. **`messageService.ts` (in-app campaign system, not chat) is broadly broken** —
   its column names are stale against the live schema.
5. **Large amounts of dead/dormant code** — orphaned hooks (`useMessagesState` ~430
   LoC), a never-rendered bot-card chain, two orphaned Phase-3 menus that MEMORY
   *thought* were deleted, and ~25 orphaned enhancement components.

**Fix first:** the latent crash (#1, trivial), then the unread-count bug, then
decide what to do about the fake tools surface (#2, the biggest structural issue).

---

## 1. Intended Purpose

Messages is Pulse's **unified communication inbox** (`App.tsx:200` — "Unified
inbox", keywords inbox/chat/dm). From the user's perspective it is:

- **Pulse-to-Pulse direct messaging** — real-time 1:1 chat between Pulse users,
  with reactions, stars, edits, deletes, forwarding, scheduled sends, attachments,
  bookmarks, and per-conversation tags. This is the primary, live surface.
- **A "cockpit" around the conversation** — a left conversation sidebar with
  filtering and a reminders inbox; a right **RelationshipRail** showing pace,
  open tasks, and decisions tied to the conversation; an **intelligence spine**
  (`ConversationSpine`/`SpineNode`) that surfaces AI-detected "moments"; and a
  **TriageBrief** empty state.
- **AI-assisted tooling** — a tools menu (WRITE / ANALYZE / COACH taxonomy) that
  is *meant* to open analytics, sentiment, summarization, coaching, smart-compose,
  etc.
- **Path D additions** — create-a-task and propose-a-decision directly from a DM
  message (write-path shipped, commits `415d948`/`b4e9068`).
- **A dormant legacy SMS/thread surface** — an older thread model (`dataService`
  threads, `sms:`-based sending) that is loaded but never auto-selected.

---

## 2. What's Solid (Your Foundations — build on these, don't touch)

### Live Pulse-DM data layer — `pulseService.ts` `[SOLID]`
All tables/RPCs exist; ids are uuid (no text/uuid mismatch here).
- `sendMessage` (`pulseService.ts:360`) → RPC `send_pulse_message`, wrapped in
  Sentry/PostHog SLI instrumentation. Primary send path, called at
  `Messages.tsx:1355, 4656, 4667`.
- `getConversations` (:247), `getMessages` (:313), `getMessagesPaginated` (:1031,
  correct cursor + hasMore+1), `markAsRead` (:435 → `mark_messages_read`),
  `editMessage` (:1003), `deleteMessage` (:454), `forwardMessage` (:1144),
  `getOrCreateConversation` (:476), archive/mute/delete-conversation (:518-579).
- **Real-time** `subscribeToMessages` (:703) with a relevance filter (:727).
  *Dedup is consumer-side by design* — the reconcile logic lives in `Messages.tsx`/
  the Zustand store, not the service (this is the May-2026 disappearing-message fix).
- Reactions `pulse_message_reactions` (:766-851), stars `pulse_starred_messages`
  (:883-903), attachments → `pulse-attachments` bucket (:949-987), typing broadcast
  (:1096-1110), scheduled messages `pulse_scheduled_messages` + pg_cron (:1184-1244).

### Live message surface — `Messages.tsx` Pulse-DM branch (3484–4684) `[SOLID]`
The exercised surface: header, inline search, message list with grouping/date
dividers/spine/gestures/hover-reactions/context-menu/receipts/reactions, emoji
picker, and the flag-switched composer. Real optimistic send with rollback
(input restored on failure :1378-1380; delete rollback :3065-3074).

### Path D tasks/decisions from a DM `[SOLID]`
`taskService.createTask`/`getOpenTasksByMessageIds`, `decisionService.createDecision`/
`getDecisionsByMessageIds` → `extracted_tasks`/`decisions` linked by
`origin_message_id`/`message_id`, workspace-scoped (`Messages.tsx:1842-1954`).
Wired to context menu `create-task`/`propose-decision` (:3041-3047).

### Persistence services — all columns verified against live schema `[SOLID]`
- `messagePersonalService.ts` bookmarks + templates (tables `message_bookmarks`,
  `message_templates`, RPC `increment_template_usage` exists). Called from
  `Messages.tsx` + `MessagesFeaturePanels`.
- `messageChannelService.ts` core channel ops (`message_channels`, `channel_messages`,
  `channel_members`, `message_reactions`, `message_reads`) — used by `messageStore`.
- `messageSummarizationService.ts` (`summarizeThread`/`generateDailyDigest`/
  `generateCatchUpSummary`) — routes via `ai-router`, called by `messageStore`.
- `messageAutoResponseService.ts` `checkAutoResponse`/`getRules` — called by `messageStore`.
- `messageEnhancementsService.ts` `detectMessageMood`/`detectRichContent`/coaching/
  health — called directly in the stream (`Messages.tsx:5059, 5079`) and via the hook.
- `messagesExportService.ts` markdown/JSON export, handoff summary, stats, search.

### Stream chrome + chat sub-components `[SOLID]`
`MessageMoodBadge` (:5064), `RichMessageCardComponent` (:5084), `AnimatedReactions`
(:5280), `LiveCollaborators` (:5315), `HoverReactionTrigger` (:4058),
`StandaloneThemePicker` (:3894), `FullEmojiPicker` (:4620); plus `ConversationSidebar`,
`FilterBar`, `RemindersInbox` (real `threadReminderService` + realtime),
`RelationshipRail` + `useRelationshipData`, `ConversationSpine`/`SpineNode`,
`useConversationMoments` (real heuristics + `ai-router` merge), `MessageInputSection`/
`MessageInputPortal`, `TriageBrief`, `SnoozeMenu`, `TagPills`/`TagPicker`,
`MessageLinkPreviews`, `GestureHandler`, `MobileDrawer`/`useSwipeFromEdge`,
`UserBadge`, `SmartTimestamp`, `DateDivider`, `messageConstants`. All 6 modals
(`InviteTeam`, `ConversationStats`, `ForwardMessage`, `ScheduleMessage`,
`InviteToPulse`) + barrel are `[SOLID]` and props-driven.

### Hooks `[SOLID]`
`useMessagesKeyboardShortcuts` (`Messages.tsx:3235`), `useMessageTrigger` (:383),
`useMessageEnhancements` (:937, wires enhancements + achievement + translation services).

### Composer AI panels `[SOLID]` (real data via `MessageInputSection`)
`AICoachEnhanced`, `SmartCompose`, `QuickPhrases`, `QuickActions`, `AIMediatorPanel`,
`VoiceContextExtractor` (`MessageInputSection.tsx:306-488`).

### Analytics modals fed real `threads` `[SOLID]`
`MessageAnalyticsDashboard` (`MessagesEndModals.tsx:226`, useMemo over real threads),
`NetworkGraph` (:249, nodes from real threads), `AchievementToast` (:202).

---

## 3. What's Cracked (fixable with targeted repairs — sorted trivial → complex)

| # | Item | Location | What's broken | Fix | Cascade |
|---|---|---|---|---|---|
| C1 | `getUnreadCount` always returns 0 | `pulseService.ts:625` | `head:true` makes Supabase return `data=null`; code returns `data?.length \|\| 0` instead of `count` | TRIVIAL | Low — store derives unread elsewhere, so badge mostly works anyway |
| C2 | `TypingIndicator` bad prop | `Messages.tsx:4898` | passes `users={typingUsers}`; the interface only has `userName`/`size`/`className` → nameless bubble / TS error | TRIVIAL | Legacy render branch only |
| C3 | Empty `onTyping` callback | `Messages.tsx:4669-4671` | `onTyping={(isTyping) => {}}` on the legacy `MessageInput` Pulse path; real typing is wired separately (:5426-5429) | TRIVIAL | None (dead callback) |
| C4 | Tool-suggestion no-op launcher | `Messages.tsx:1166-1169` | `// TODO: Implement actual tool launch logic via ToolOverlay` — one of two call sites passes a no-op launcher (the palette site :1192 is real) | MODERATE | Suggestions can't launch tools |
| C5 | `generateProactiveInsights` fake AI | `messageEnhancementsService.ts:604` | signature takes `apiKey`, body never calls AI — pure keyword heuristics; misleading | MODERATE | Insights are shallow, not AI |
| C6 | `messageChannelService.getChannelMembers` latent 400 | `messageChannelService.ts:177` | embed `users:user_id (id,name,avatar_url)` — canonical profile table is `user_profiles`/`pulse_users`, no `name` col / no `users` relationship | MODERATE | Unobserved (only tests call it) |
| C7 | `userMatchesSegment` retention column | `messageService.ts:265` | reads `user_retention_cohorts.last_seen_at` — column doesn't exist | MODERATE | In-app campaign targeting (not chat) |
| C8 | ToolOverlay components fed no props | `ToolOverlay.tsx:180-352` | `EngagementScoring`/`ResponseTimeTracker`/`ConversationFlowViz`/`ProactiveInsightsEnhanced`/`ConversationSummary`/`ContactInsights` render with no `messages` → empty shells / `score:0` defaults | COMPLEX | See §6 (overlay occlusion) — these *have* real data in the occluded path |

> **Most serious cracked/severed item is broken out separately as the latent crash — see §4.**

---

## 4. What's Severed (disconnected wiring)

### S1 — LATENT CRASH: undeclared identifiers in the legacy-thread branch `[SEVERED]` ⚠️ TOP FINDING
Verified by hand:
- `setShowCommandPalette` — **only** referenced at `Messages.tsx:4796`
  (`onClick={() => setShowCommandPalette(true)}`), **zero declarations** in the file.
  The local Cmd+K palette was removed (comment :636-640) but this button was left behind.
- `newMessage` / `setNewMessage` — **only** referenced at `Messages.tsx:4843-4844`
  (passed to `<MessagesFeaturePanels>`), **zero component-scope declarations** (the
  only `newMessage` is a block-local const inside `handleSend`).

All three live inside the `{activeThread && (…)}` legacy branch (4690-5323). That
branch is unreachable in normal use — SMS/legacy threads are deliberately never
auto-selected (`loadThreads` comment :394-396) — and vite/esbuild skip type-checking
(repo has ~1,234 pre-existing TS errors). **The moment a legacy thread is selected
(e.g. an `initialContactId` deep-link → `createNewThread` :1630), this branch mounts
and throws `ReferenceError`.** Fix complexity: TRIVIAL (delete the dead button /
declare the state), but high-value because it's a guaranteed crash.

### S2 — `MessagesContext.tsx` orphaned relative to the live component `[SEVERED]`
`MessagesProvider`/`useMessages` is **never imported by `Messages.tsx`**. The
component re-implements every piece of that context's state (loadThreads,
sendPulseMessage, reactions, stars…) locally. 354 lines of provider that the live
surface doesn't consume.

### S3 — Bot-card chain never rendered `[SEVERED]`
`BotMessage.tsx` (real `ecosystem-outbound` edge calls, export, rating) has **zero
`<BotMessage>` render sites**. It transitively strands `MeetingRecapCard`,
`MeetingBriefingCard`, `ActionItemsCard` (each imported only by `BotMessage`).
Complete code, no front door.

### S4 — Severed enhancement imports in `Messages.tsx` `[SEVERED]`
Imported but never rendered: `ConversationHealthWidget` (import :75),
`TranslationWidget` (:82), `AchievementProgress` (:76).

### S5 — `classifyMessage` (auto-response) `[SEVERED/DORMANT]`
`messageAutoResponseService.ts:320` — complete, router-wired, self-documented "Not
used internally", no external caller.

---

## 5. What's Stubbed (never finished — mock/hardcoded in the LIVE path)

The most consequential damage by volume. The **ToolOverlay tool surface is largely
fake** — components render but are powered by `generateMock*()` / `Math.random`:

| Component | Mock source (file:line) |
|---|---|
| `ReactionsAnalytics` | `:37-67` `generateMockReactions()` + `Math.random` |
| `SentimentTimeline` | `:83-113,177` `generateMockDataPoints()` + `Math.random` |
| `SmartReminders` | `:49-105,182` `generateMockReminders/Suggestions()` |
| `ContactGroups` | `:71-128,236` `generateMockGroups/Channels()` |
| `PriorityInbox` | `:40,412` `generateMockMessages()` |
| `SmartFolders` | `:46-214` `generateMockFolders/Messages()` |
| `MessageEncryption` | `:50-139` `generateMockEncryptedMessages/SecurityEvents()` |
| `ConversationInsights` | `:62-137` `generateMockMetrics/Insights()` |
| `MessageBookmarks` | 10 mock/`Math.random` hits |
| `SmartSuggestions` | 12 mock hits |
| `ConversationHighlights` | 6 mock hits |
| `MessageThreading`, `ConversationArchive`, `TranslationHub` | 4 mock hits each |
| `ReadTimeEstimation`, `MessageVersioning`, `ConversationTags`, `ReadReceipts`, `NaturalLanguageSearch`, `MessageStatusTimeline` | 2 each |
| `VoiceMessages`, `FocusTimer` (MessageEnhancements/) | 1 each |
| `ContactInsights` | `:63-86` `defaultContact`/`defaultMetrics` ("No Contact Selected", score 0) |

> **Important caveat (Rule B):** several of these accept real props and only fall
> back to mock when the call site passes none. They are mock *because ToolOverlay
> calls them bare* — `MessagesFeaturePanels` *does* pass real data (e.g.
> `EngagementScoring messages={...}` at `:239`). So this is **wiring damage, not
> necessarily component damage**. See §6.

In-component stubs (host `Messages.tsx`):
- Proposal voting auto-approves on a 3s timer — fake second voter (`:2334-2336`). `[STUB]`
- Focus-mode "while you were focused" digest is a hardcoded string ("Sarah sent 2
  messages… New task assigned in Jira", `:2087`). `[STUB]`
- Outcome-goal modal writes `localStorage` `pulse-goal-${id}` (`:4434,4452`), never
  read back, no table. `[STUB]`
- `'add-to-calendar'` rich-card action → `// TODO: Implement calendar integration`
  (`:5090`). `[STUB]`

---

## 6. What's Gutted / Structurally Damaged (was better, or doubled-up)

### G1 — ToolOverlay occlusion: ~7 feature bundles render twice, the real copy is hidden ⚠️ BIGGEST STRUCTURAL ISSUE
`togglePanel` (`Messages.tsx:898-919`, **verified**) sets **both**
`setActiveToolOverlay(panel)` **and** the legacy `setShow*Panel(true)` — the code
comments it "Also set the legacy state for compatibility" (:907). Result:
- `ToolOverlay` (`Messages.tsx:3904`) is an `absolute inset-0 z-40` full-cover
  overlay (`ToolOverlay.tsx:143`) rendering ~38 components **with mostly mock/empty
  data**.
- `MessagesFeaturePanels` (`Messages.tsx:4840`) renders the **same** components
  through lazy bundles **with real data** — but underneath the opaque overlay, so
  it's never seen.

The user sees the fake copy; the real copy executes invisibly. This is the single
biggest piece of wiring damage — ~30 components are `[DORMANT]` in the occluded path.

### G2 — `messageService.ts` stale schema (in-app campaign system, not chat) `[GUTTED]`
Column names drifted from the live `in_app_messages` table without the service being
updated:

| Service uses | Real column |
|---|---|
| `trigger_event` | `event_trigger` |
| `target_segment` | `segment` |
| `segment_filter` | `custom_segment_query` |
| `start_date`/`end_date` | `starts_at`/`ends_at` |
| `active` | `is_active` |
| `auto_dismiss_seconds` | `display_duration_seconds` |
| `max_displays_per_user` | (does not exist) |
| `messages_seen_count`/`messages_clicked_count` | `total_messages_seen`/`total_messages_clicked` |

`createMessage`/`getActiveMessages`/`getMessagesByEvent`/`updateMessage`/
`toggleMessageStatus`/`initializeUserRetention`/`updateUserActivity` all CRACKED.
RPCs it calls (`get_message_metrics`, `increment_messages_seen/clicked`) do exist.
*This is the toast/banner campaign subsystem — separate from chat — but it lives in
the Messages file cluster.*

### G3 — Focus subsystem already pruned `[history]`
`03ccdb0 refactor(messages): delete orphaned Focus subsystem (~2369 LOC dead code)`
— the live `Messages/FocusMode.tsx` chain is the survivor and is `[SOLID]`.

---

## 7. What's Orphaned (dead code — INVESTIGATE before removing; do NOT delete per Rule A)

| Item | Location | Evidence |
|---|---|---|
| `ContextMenu.tsx` (Phase-3) | `Messages/ContextMenu.tsx` | only importer is `examples/Phase3Examples.tsx:20`, which has **zero importers**. MEMORY says this was "deleted on GA" — **it was not**. |
| `RadialMenu.tsx` (Phase-3) | `Messages/RadialMenu.tsx` | only importer `Phase3Examples.tsx:13` (dead). MEMORY's "deleted" claim is wrong. |
| `FeatureSettingsPanel.tsx` | `Messages/` | only `Phase3Examples.tsx:21` (dead) |
| `ChannelList.tsx` | `Messages/` | fully built (real `messageChannelService` CRUD), **no `<ChannelList>` render anywhere** |
| `Messages/MessageContainer.tsx` | `Messages/` | dead twin; live `MessageContainer` is `src/components/MessageContainer.tsx` |
| `useMessagesState.ts` (~430 LoC) | `hooks/` | **only match in repo is its own definition** — largest single dead hook |
| `useMessageContextMenu.ts` (hooks/) | `hooks/` | dead older duplicate; live menu uses `components/MessageContextMenu/` version |
| `useCommonTriggers`, `useActivityTracking` | `useMessageTrigger.ts:75,179` | exported, never imported |
| `usePulseMessaging.ts` | `hooks/` | orphaned; **also harbors a bug** — calls `pulseService.createOrGetConversation` (:238) but the real method is `getOrCreateConversation`. Dormant until revived. |
| ~10 enhancement components | `MessageEnhancements/` | `AICoach` (orig), `SmartComposeEnhanced`, `ToneAdjuster`, `InlineCoachTip`, `MediatorIndicator`, `TranslationWidgetEnhanced`, `ProactiveInsights` (orig), `PersonalAnalyticsDashboard`+`AnalyticsBadge`, `SearchPanel`+`QuickSearchButton`, `AchievementSystemEnhanced` — exported in barrel/bundle, never rendered |
| `generateFocusDigest`, `summarizeSingleMessage`, `parseJSONResponse`, `calculateAchievements` | various services | complete methods with no caller |

> Per CLAUDE.md Rule A this is a **report**, not a deletion proposal. Several
> "orphans" are complete, correct code (e.g. `ChannelList`, channel-member CRUD,
> highlights/annotations) that may have a planned consumer.

---

## 8. Connection Map

### 8a. Route-to-Render
```
AppView.MESSAGES (App.tsx:884)
  → lazy Messages (App.tsx:17) ; props: contacts, initialContactId, onAddContact, fullPage=true
    → currentUser via useAuth() fallback (apiKey undefined — deprecated no-op)
    → reads:  pulseService (conversations/messages/reactions/stars/typing) [SOLID]
              tagsService, threadReminderService, taskService, decisionService [SOLID]
              dataService threads (legacy, DORMANT)
    → writes: send_pulse_message RPC → pulse_messages [SOLID]
              extracted_tasks / decisions (Path D) [SOLID]
              localStorage (theme, outcome goals — goals never read back) [STUB]
    → children: ConversationSidebar/FilterBar/RemindersInbox [SOLID]
                Pulse-DM stream (3484-4684) [SOLID]
                legacy-thread branch (4690-5323) [SEVERED — latent crash S1]
                ToolOverlay (3904) [STUB/CRACKED — visible fake]
                MessagesFeaturePanels (4840) [DORMANT — real, occluded]
                Top/EndModals [SOLID]
```

### 8b. Data Flow (live)
```
pulse_messages
  → pulseService.sendMessage / send_pulse_message RPC [SOLID]
  → pulseService.subscribeToMessages (relevance filter; dedup consumer-side) [SOLID]
    → usePulseMessagesStore (Zustand) → Messages.tsx local pulseMessages [SOLID]
      → message list render (3946+) → bubbles + reactions + spine + rail
pulse_message_reactions / pulse_starred_messages → toggleReaction/toggleStar [SOLID]
pulse_scheduled_messages (+pg_cron) → scheduleMessage [SOLID]
message_bookmarks / message_templates → messagePersonalService [SOLID]
extracted_tasks / decisions → task/decisionService (origin_message_id) [SOLID]
in_app_messages → messageService [CRACKED — stale columns, see G2]
```

### 8c. Cross-Section Dependencies
```
DEPENDS ON:  AuthContext (currentUser), FeatureContext (pulseComposerV2/toolsMenuV2),
             lib/featureFlags (proposalMode), tagsService, taskService, decisionService,
             threadReminderService, focusModeService, linkPreviewService, ai-router edge fns
DEPENDED ON BY: App.tsx (mount), Sidebar/SidebarContent.tsx (MessagesContent),
             Dashboard (onOpenMessages → setView(MESSAGES))
BROKEN LINKS: MessagesContext (provided, never consumed — S2);
             messageService ↔ in_app_messages (column drift — G2);
             getChannelMembers ↔ users embed (C6)
```

---

## 9. UI Surface Audit

### 9a. Page-level
| Check | Status | Notes |
|---|---|---|
| Route resolves | ✅ | `App.tsx:884` |
| Renders without errors | ⚠️ | Live DM path yes; legacy-thread branch throws (S1) |
| No blank sections | ⚠️ | ToolOverlay shows mock-data panels (look real, aren't) |
| Loading state | ✅ | `EnhancedLoadingScreen` (`Messages.tsx:3254`) |
| Empty state | ✅ | `TriageBrief` (:3348) + "Start a Conversation" (:3946) |
| Error state | ⚠️ | Data integrity solid (optimistic rollback); user-visible errors mostly silent `console.error` (only `pulseEditToast`) |
| Navigation in/out | ✅ | |
| Section tint | ✅ | rose/ink tokens; coral reserved for AI per token discipline |

### 9b. Interactive elements (notable)
| Element | Location | Handler | Works? | Notes |
|---|---|---|---|---|
| Command Palette button | `Messages.tsx:4796` | `setShowCommandPalette` | ❌ | **undeclared → crash (S1)** |
| Composer (Pulse) | `:4653` | `sendMessage` | ✅ | flag-switched PulseComposer/MessageInput |
| Context menu | `:4531` | `MessageContextMenu` | ✅ | GA, the only message menu |
| Create task / propose decision | `:3041-3047` | task/decisionService | ✅ | Path D |
| Tool buttons → ToolOverlay | `togglePanel` :898 | dual-set | ⚠️ | opens fake overlay over real panels (G1) |
| `onTyping` (legacy path) | `:4669` | `(isTyping)=>{}` | ❌ | empty (C3) |
| Add to calendar (rich card) | `:5090` | TODO | ❌ | stub |
| Proposal vote | `:2334` | setTimeout auto-approve | ❌ | fake voter (flagged off) |
| SMS send | `handleSendSms` :1984 | `openSmsApp` | ⚠️ | `sms:` URL, native-only, dead on web |

### 9c. Missing/standard patterns
Present: search/filter ✅, sort (via filter) ✅, single-item action menu ✅,
detail/rail ✅, create/forward/schedule modals ✅, delete confirm ✅, export ✅,
keyboard shortcuts ✅, mobile drawer ✅, refresh via realtime ✅, toast feedback ⚠️
(partial). Notably weak: **user-visible error feedback** (most failures silent),
**real tool-panel data** (mocked), **SMS as a real channel** (intent-only).

### Feature flags
- `pulseComposerV2` (FeatureContext default **false**, `:77`) — gates PulseComposer
  vs legacy MessageInput (`Messages.tsx:4653`). `[DORMANT]`
- `toolsMenuV2` (default **false**, `:80`) — gates ToolsMenuV2 vs legacy drawer
  (`Messages.tsx:4781`; ToolsMenuV2 always mounted at :3872). `[DORMANT]`
- `messageContextMenuV2` — **removed**; v2 menu promoted to GA (commits
  `2f39451`/`60acbc2`). `MessageContextMenu` is now unconditional. `[SOLID/GA]`
- `proposalMode` (`lib/featureFlags`, `:472`) — gates proposal composer; underlying
  voting is `[STUB]`. `[DORMANT]`

---

## 10. Repair Priority Queue

| Pri | Item | Category | Complexity | Enables / Why |
|---|---|---|---|---|
| 1 | S1 latent crash — `setShowCommandPalette`/`newMessage`/`setNewMessage` | Severed | TRIVIAL | Removes a guaranteed `ReferenceError` if a legacy thread is ever selected |
| 2 | C1 `getUnreadCount` returns 0 | Cracked | TRIVIAL | Correct unread badge (use `count`, not `data.length`) |
| 3 | C2/C3 `TypingIndicator` bad prop + empty `onTyping` | Cracked/Severed | TRIVIAL | Clean legacy render path |
| 4 | **G1 ToolOverlay occlusion** — decide: keep real FeaturePanels OR fix ToolOverlay to receive real data; stop double-mount | Gutted/wiring | COMPLEX | Turns the entire tools surface from fake → real; un-hides ~30 working components. **Highest user-impact** |
| 5 | §5 ToolOverlay mock-data components | Stub | COMPLEX | Subsumed by #4 once wiring is fixed (most accept real props) |
| 6 | G2 `messageService.ts` column drift | Gutted | MODERATE | Repairs in-app campaign CRUD (separate from chat) |
| 7 | C4/C5/C6/C7 (no-op launcher, fake "AI" insights, `getChannelMembers` embed, retention column) | Cracked | MODERATE | Removes silent failures |
| 8 | Error-feedback pass (silent `console.error` → user toasts) | Cracked | MODERATE | UX reliability |
| 9 | Orphan triage (§7) — confirm-then-decide per Rule A | Orphan | VARIES | Bundle-size + clarity; `ContextMenu`/`RadialMenu`/`useMessagesState` etc. |
| 10 | SMS as a real channel (Twilio/server send) | Stub | COMPLEX | Launch-blocker per roadmap; currently intent-only |

---

## 11. Git Forensics

**`Messages.tsx` — last 15 (most recent first):**
```
60acbc2 feat(messages): promote context-menu to GA; delete legacy + Phase-3 menus
2f39451 feat(messages): make v2 context-menu real before promoting it
46de2cc fix(messages): stop optimistic sends clobbering each other; drop fake typing
051df87 fix(messages): filter optimistic placeholder ids from rail queries
a3d3cf7 feat(monitoring): wire retention instrumentation + define NSM (#117)
415d948 feat(messages): create task / propose decision from a DM message — write-path (Path D 5b)
b4e9068 feat(messages): per-conversation tasks/decisions in the rail — read-path (Path D 5a)
4d6a158 feat(messages): interactive rail open-items + mobile rail-as-sheet (Path D 5,4)
4ccff32 feat(messages): AI moment detection for the intelligence spine (Path D 5,3)
5e46db8 feat(messages): wire intelligence spine into the legacy-thread render path (Path D 5,2)
15349a1 feat(messages): wire intelligence spine into the Pulse-DM message loop (Path D 5,1b)
2facada fix(messages): hide RelationshipRail below xl to prevent broken narrow layout
40f4227 feat(messages): dock RelationshipRail in the legacy conversation pane (Path D,3b)
8f0dc0a Merge branch 'main' into feat/messages-coral-cockpit-phase-h-tail
385b490 fix(messages): dark-mode contrast pass on message context menu
```

**`Messages/` dir — notable large deletions:**
```
b55ead4 chore(messages): remove paused v2 rebuild, commit to legacy surface   ← v2 Messages DELETED
7313fe5 refactor(messages): delete orphaned SplitViewMessagesContainer + retire --split-view-* tokens
03ccdb0 refactor(messages): delete orphaned Focus subsystem (~2369 LOC dead code)
```

**`MessageEnhancements/` — last 10:** mostly emoji-picker + a11y + sentiment-to-real-LLM
work; `2ba18c8 refactor(messages): redesign message tools — WRITE/ANALYZE/COACH`.

**Reading of the timeline.** The recent history is *healthy, additive* work — Path D
(intelligence spine, rail, tasks/decisions from a message), the context-menu GA, and
the deliberate `b55ead4` decision to delete the paused v2 rebuild and commit to the
legacy `Messages.tsx`. **The damage in this report is not from recent commits** — it
is *accumulated sediment*: the ToolOverlay/FeaturePanels double-mount, the mock-data
enhancement components, the stale `messageService` columns, and the orphaned
Phase-3 menus/hooks all predate the recent Path D work and were carried along when v2
was abandoned in favor of legacy. The single recent regression risk is the latent
crash (S1), where `setShowCommandPalette` was orphaned during the Cmd+K palette removal.

---

### Cross-checks against MEMORY (corrections)
- MEMORY "Phase-3 ContextMenu/RadialMenu deleted on GA" — **incorrect**; both files
  still exist as orphans (only `Phase3Examples.tsx`, itself dead, imports them).
- MEMORY "SMS still mocked" — **confirmed** (intent-only `sms:` hand-off, native-only).
- MEMORY "real-time DM IS real (pulse_messages)" — **confirmed**.
- MEMORY "v2 rebuild DELETED, build on legacy Messages.tsx" — **confirmed** (`b55ead4`).
- MEMORY "context-menu GA, flag removed" — **confirmed** (`60acbc2`/`2f39451`).

*No files were modified in producing this report.*
