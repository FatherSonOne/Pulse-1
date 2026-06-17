# Full Multi-Surface Deep-Link Integration — Spec & Handoff

**Date:** 2026-06-17
**Status:** **IMPLEMENTED (P1/P2/P3) — see §0 Implementation status.** Section-level routing
shipped earlier (launch item C, `d9a0dcc`); the exact-item focus this doc specced is now built
for Messages, Email, and Relay-Notes/Broadcast. Meetings exact-open is deferred (blocked — §0).
**Parent:** `docs/launch-readiness/DECISIONS_TASKS_LAUNCH_READINESS_HANDOFF_2026-06-17.md` (item C)
**Owner surface:** Decisions & Tasks cockpit task focal pane → originating surface.

> Investigation provenance: every code/schema claim below was read from the live repo
> + `pulse-chat` DB (`ucaeuszgoihoyrvhewxk`) on 2026-06-17. **Update (2026-06-17, deep pass):**
> the four per-surface **[VERIFY]** TODOs (Messages scroll target, Email `email_id`/open-handler,
> Meetings provenance/open-by-id, Relay provenance/open-by-id) are now **resolved against the code**
> and folded into §3–§4 with line refs. The only remaining `[VERIFY at build]` flags are
> implementation choices (e.g. Email "ensure-loaded" path; which task table each focal pane reads) —
> small, build-time, not blocking the plan.

---

## 0. Implementation status (2026-06-17, build pass)

Built this session on `main`. Commits: P-infra/P0/P1 `4216733`, P2 `124e6b7`,
P3-Meetings `e9ac487`, P3-Relay `0689a07`. Type-checked (no new errors vs the ~1234
baseline). **Not yet eyeball-verified live** (the seed→live-click loop in §6 is the
verification method; headless can't reach the cockpit — workspace resolution).

| Phase | Surface | What shipped | Exact-item? |
|-------|---------|--------------|-------------|
| P-infra | — | `taskSourceTarget(task)→{view,focus}`; `CockpitHub.handleOpenSource` writes `pulse_focus_*` sentinels then navigates; `taskSourceView` now wraps `taskSourceTarget` | n/a |
| P0 | Messages | `handleCreateTaskFromMessage` stamps `metadata.source='messages'` | n/a |
| P1 | **Messages** | `pulseService.getThreadIdForMessage`; `Messages.tsx` reader drains `pulse_focus_message`→resolve thread→`selectPulseConversation`→scroll+rose-flash on `[data-message-id]`; `msgFocusFlash` CSS | ✅ exact message |
| P2 | **Email** | `EmailHybridClient` reader drains `pulse_focus_email`→`openReaderPanel(cached_emails.id)`; `EmailReaderPanel` gains additive lazy-fetch-by-id fallback (no list pollution) | ✅ exact email |
| P3 | **Meetings** | `MeetingSummaryView` now writes `extracted_tasks` (was legacy `tasks`) w/ `metadata.source='meeting'` | ⚠️ section-level only — exact open **blocked** (below) |
| P3 | **Relay** | New "Create task from note" affordance (VoxNotesMode) → `extracted_tasks` w/ `relay_store`/`relay_vox_id`; `Relay.tsx` reader drains `pulse_focus_relay` JSON | ✅ Notes + Broadcast; ⚠️ Direct/Channel section-level |

### Meetings exact-open — DEFERRED, architecturally blocked (verified, not assumed)
Three concrete reasons the exact-meeting open can't be wired without new work:
1. **No meeting DB id at task-creation.** `activeRoom` is `{ roomUrl, roomName }` (a Daily.co
   room *name*); the `pulse_video_rooms` row is created **async, server-side** by the Daily
   webhook — the client never holds that id when action-items become tasks (`Meetings.tsx:157`).
2. **Resolver can't rebuild the view.** `meetingService.getMeetingRecordingById` returns
   `summary: null` + no `actionItems/keyPoints/decisions` (meetingService.ts:311-345) — it can't
   reconstruct `MeetingSummaryData`.
3. **Durable record is elsewhere.** Real action-items come only from the live-meeting-end summary
   (`Meetings.tsx:853`); the recap paths that *do* carry an id (`archives` note id) set
   `actionItems: []`. The `meeting_note` archive is written outside this flow.
   → To unblock: persist the structured end-of-meeting summary (archive or a meetings row) with
   an id, stamp it on the task (`metadata.meeting_id`), and add a reader that rebuilds the summary
   from it. `taskSourceTarget` already emits `pulse_focus_meeting` when `meeting_id` is present.

### Known follow-ups (net-new, not regressions to fix now)
- **Tasks-table split:** meeting tasks now land in `extracted_tasks`; Dashboard / daily briefing /
  Glimpse / unified search read the legacy `tasks` table and will not show NEW meeting tasks until
  they also read `extracted_tasks` (accepted trade-off — see `e9ac487`). Same applies to
  `ActionItemExtractor.tsx` email tasks (still → `tasks`, no `email_id`).
- **Relay Direct/Channel exact-open:** Direct opens by *contact* not message; Channel (`TeamVoxMode`)
  has no message-open hook (`focusThreadId` declared but not forwarded). Currently section-level.
- **Relay creation coverage:** only Notes has a create-task affordance so far; Broadcast/Channel/
  Direct have none (so the reader's broadcast branch is ready but untriggered).

---

## 1. What exists today (shipped)

The "Open source" affordance in the task focal pane (`focal/TaskDetail.tsx`) routes to the
**section** the task came from. Mechanism:

- **`cockpit/taskSource.ts`** — `taskSourceView(task): AppView | null` is the single predicate
  (shared by navigation + button visibility). It maps provenance →
  `AppView.{EMAIL,MESSAGES,MEETINGS,RELAY}`:
  ```ts
  src === 'email'    || metadata.email_id        → EMAIL
  src === 'messages' || origin_message_id        → MESSAGES
  src === 'meeting'                              → MEETINGS
  src === 'relay'    || src === 'vox'            → RELAY
  ```
- **`CockpitHub.handleOpenSource`** dispatches the global `pulse:navigate` CustomEvent bus
  (App.tsx:1277 listener → `setView`). No prop threading.
- The button renders only when `taskSourceView(task) !== null`.

**Gap this spec closes:** landing on the section is not the same as opening the *exact*
originating email / message / meeting / vox. That's the audit's "one-click jump to the
originating item."

---

## 2. Architecture — the focus-sentinel pattern (already idiomatic)

The codebase already deep-links to a specific item across sections via
`sessionStorage.pulse_focus_*` sentinels, read by the target surface on mount. Existing keys:
`pulse_focus_note` (Archives/Captures), `pulse_focus_contact` (Contacts),
`pulse_focus_decision`, `pulse_focus_task`, `pulse_focus_nudge` (Messages/Email, section-level only).

**The pattern to replicate for each surface:**
1. **Writer (cockpit):** `handleOpenSource` sets `sessionStorage.setItem('<focus-key>', <itemId>)`
   *before* dispatching `pulse:navigate`.
2. **Reader (target surface):** a `useEffect` on mount reads the key, removes it, opens/scrolls
   to the item, then clears any highlight. Model it on the existing `pulse_focus_nudge` readers
   (`Messages.tsx:1010`, `EmailHybridClient.tsx:221-234`).

**Suggested taskSource.ts extension** — return the focus contract alongside the view:
```ts
export interface SourceTarget { view: AppView; focusKey: string; focusId: string; }
export function taskSourceTarget(task: Task): SourceTarget | null { ... }
```
`handleOpenSource` then becomes generic: set `focusKey=focusId`, dispatch navigate. Keep
`taskSourceView` as a thin wrapper for the existing button-visibility check (no behavior change).

---

## 3. Per-surface plans

### 3.1 Messages — **FEASIBLE, highest priority** (most task origins) — all VERIFY items now resolved ✅
**Key fact (verified):** `pulse_messages.thread_id` *is* the conversation id. `pulseService.getMessages(conversationId)`
queries `pulse_messages WHERE thread_id = conversationId` (pulseService.ts:348), and
`getOrCreateConversation` returns a `pulse_conversations.id` (pulseService.ts:506-523). So:

- **Resolve:** `origin_message_id` → `SELECT thread_id FROM pulse_messages WHERE id = :origin_message_id`
  (add `pulseService.getThreadIdForMessage(messageId)` — one narrow query). `thread_id` = the
  conversation to open.
- **Writer:** set `pulse_focus_conversation = thread_id` and `pulse_focus_message = origin_message_id`
  (for scroll/highlight), then navigate to `AppView.MESSAGES`.
- **Reader (in `Messages.tsx`):** on mount, read `pulse_focus_conversation` → call the existing
  `selectPulseConversation(conversationId)` (Messages.tsx:1359) → then scroll to/highlight
  `pulse_focus_message`. There is already a `focusThreadId` state + `pulse_focus_nudge` reader
  (Messages.tsx:478, 1009-1020) to model the highlight lifecycle on. Note `selectPulseConversation`
  is `async` and internally calls **`getMessagesPaginated(conversationId, 50)`** (not `getMessages`) —
  it takes *only* a conversation id and does NOT accept a target message, so the scroll/highlight
  must run **after** its promise resolves.
- **Scroll-to-message — RESOLVED ✅:** message bubbles already render a stable
  **`data-message-id={msg.id}`** (Messages.tsx:4707-4710). The `document.querySelector('[data-message-id="…"]')`
  lookup is a first-class, proven pattern here — already used at lines 1851, 3383, 4618, 4676, 5073 to
  anchor menus/pickers. So scroll-to-message needs **no new markup**:
  `document.querySelector('[data-message-id="' + id + '"]')?.scrollIntoView({ behavior:'smooth', block:'center' })`.
- **⚠️ Auto-scroll race — RESOLVED, must handle:** a `useEffect` keyed on `pulseMessages`
  (Messages.tsx:1082-1087) and a `scrollToBottom` (2276-2280, fired on thread change at 2508)
  **force the list to the bottom every time messages load via `messagesEndRef` (declared L822)**. Because
  `selectPulseConversation` triggers a `pulseMessages` state set, that auto-scroll will fire *after*
  your reader and clobber a naive scroll-to-message. Sequence the reader to scroll-to-message on a
  trailing `setTimeout` (≥300ms, matching the nudge pattern) *after* the conversation load settles, or
  gate the bottom-scroll effect while a focus target is pending. Verify the highlight lands by eyeball
  (the seed→live-click loop in §6), since the race is timing-dependent.
- **Caveat:** `Messages.tsx` is ~5,900 lines — keep the reader self-contained; do not refactor
  surrounding code.

### 3.2 Email — **FEASIBLE, second priority** — all VERIFY items now resolved ✅
- **`email_id` contents — RESOLVED ✅:** the *only* writer that stamps a usable `metadata.email_id`
  is `Email/hybrid/data/createTaskFromEmail.ts:48-61`. It sets
  `email_id = raw?.id ?? row.id` = the **`cached_emails.id` primary key**, which is a *composite*
  string `${userId}-${gmailId}` (built at `emailSyncService.ts:403`). It also records
  `email_gmail_id` (raw Gmail message id) and `email_thread_id` (Gmail thread id) separately.
  So `email_id` is **NOT** a bare Gmail id, RFC-822 id, or thread id — it's the `cached_emails` PK,
  which is exactly the id the open handler wants (see below). Convenient: no translation needed.
- **⚠️ Source-string mismatch — RESOLVED, fold into P0:** `createTaskFromEmail.ts` stamps
  **`source: 'email-cockpit'`**, NOT `'email'`. But `taskSource.ts` routes EMAIL on
  `src === 'email' || metadata.email_id`. Today routing only works because of the `|| email_id`
  branch. The *other* email writer, `ActionItemExtractor.tsx:188`, sets `source:'email'` +
  `source_id: email.id` (also a `cached_emails.id`) but inserts into the **`tasks`** table (not
  `extracted_tasks`) and sets **no `metadata.email_id`**. Normalize both onto `source:'email'` +
  `metadata.email_id` in P0 (§4) so routing isn't dependent on one OR-branch.
- **Open handler — RESOLVED ✅:** selection is **Zustand store-based, not prop-drilled.** Call
  **`openReaderPanel(id)` from `useEmailUIStore`** (`emailUIStore.ts:128, 195-198`) with
  `id = cached_emails.id`. (The list's own row click does `setReaderPanelEmailId(email.id)` in
  `FolderListView.tsx:106-109`; `EmailReaderPanel` then resolves the email via
  `emails.find(e => e.id === renderId)` — `EmailReaderPanel.tsx:55`.) `EmailReaderPanel` is mounted
  prop-less at `EmailHybridClient.tsx:759`, so the reader just imports the store action.
- **⚠️ Email-must-be-loaded gotcha — RESOLVED, must handle:** `EmailReaderPanel` resolves the email
  from the in-memory `emails: CachedEmail[]` array (`emailStore.ts:16`, a flat list, linear `find` —
  no id-keyed map). If the target email isn't in the *currently loaded folder*, `find()` returns
  `undefined` and the panel **immediately self-closes** (`EmailReaderPanel.tsx:57-60`). So the reader
  must, when the id isn't present, first `setCurrentFolder(...)` to a folder containing it (or trigger
  a load) and await `loadEmails` before firing `openReaderPanel`. **[VERIFY at build]** the cleanest
  "ensure this email is loaded" path (folder switch vs. a targeted fetch-by-id into the store).
- **Reader:** add a `pulse_focus_email` `useEffect` in `EmailHybridClient.tsx` right beside the
  existing `pulse_focus_nudge` reader (EmailHybridClient.tsx:221-234, quoted pattern: read string →
  `removeItem` → `setMode('cockpit')` → trailing `setTimeout`). Read `pulse_focus_email`, ensure the
  email is loaded, then `openReaderPanel(emailId)`.
- **Writer (cockpit):** set `pulse_focus_email = <metadata.email_id>`, navigate to `AppView.EMAIL`.
- Note: there's also a legacy non-hybrid Email path; target the hybrid client (the live one).

### 3.3 Meetings — **INVESTIGATED: needs provenance AND a new open-by-id entrypoint** (most build cost)
- **Provenance — CONFIRMED ABSENT ❌:** no meeting-origin task carries *any* meeting identifier today.
  The only meeting→task path, `Meetings/MeetingsComponents.tsx:2065-2070` (`MeetingSummaryView`),
  calls `dataService.createTask({ title, completed, listId:'work', assigneeId })` — **no
  `metadata.source`, no meeting id, no calendar/recall id.** `meetingDetectionService.ts:7` only
  defines `source: 'conversation' | 'email' | 'vox'` and creates *no* tasks. `taskSource.ts:18` does
  check `metadata.source === 'meeting'`, but that branch is **dead** — nothing writes it. P0 must add
  meeting provenance at the `MeetingSummaryView` call site (stamp `source:'meeting'` +
  `metadata.meeting_id = pulse_video_rooms.id`).
- **Open-by-id — CONFIRMED ABSENT ❌, must build:** Meetings has no `pulse_focus_meeting` sentinel,
  no `?meetingId=` param, no `selectMeeting`. The only parameterized entries are `initialMeetingCode`
  (a Daily.co *room name* to JOIN a live room, App.tsx:702-713), `initialContactId`, and
  `startIntent` — none open a *past* recording/summary. The summary view is reachable only by an
  in-component TimeRail row click (`onOpenRecap`, Meetings.tsx:673-685).
- **Resolver already exists ✅:** `meetingService.getMeetingRecordingById(id)` (meetingService.ts:311,
  falls back to legacy `meetings` table at :329) resolves a `pulse_video_rooms.id` (UUID) to the row
  needed for the summary view. **Build:** add an `initialMeetingId` prop (or `pulse_focus_meeting`
  reader) on `Meetings` that calls `getMeetingRecordingById`, sets `summaryData`, and `setView('summary')`.
- **Target id = `pulse_video_rooms.id`** (primary live table; legacy `meetings` is read-fallback only).

### 3.4 Relay — **INVESTIGATED: open-by-id mostly already exists; only provenance + Channel missing**
- **Provenance — CONFIRMED ABSENT ❌:** no relay/vox→task creation path exists. `taskSource.ts:19`
  recognizes `src === 'relay' || src === 'vox'` and routes to `AppView.RELAY`, but **no writer emits
  those source strings from a vox item.** (The only relay-adjacent task writer is War Room voice,
  `warRoomToolsService.ts:304`, `source:'war_room_voice'` — no vox-item id.) So the whole feature is
  forward-looking: P0 must add a relay→task path that stamps `metadata.source='relay'` +
  `metadata.relay_store` + `metadata.relay_vox_id` (+ `relay_channel_id` for channel items).
- **Open-by-id — PARTIALLY EXISTS ✅/❌:** Relay (`Relay.tsx:125`) has six views
  (`triage|direct|channel|broadcast|notes|live`). Existing exact-item hooks:
  - **Notes ✅** — `initialNoteId` fully wired (`VoxNotesMode.tsx:73-74, 345-348`, finds + selects).
  - **Broadcast ✅** — `initialBroadcastId` scrolls via `data-broadcast-id` (`PulseRadio.tsx:386-394`).
  - **Direct ⚠️** — `initialContactId` opens a *contact thread*, not a specific message
    (`Relay.tsx:309`). Good enough to land the thread; no per-message focus.
  - **Channel ❌** — `TeamVoxMode` has **no** open-by-id. `focusThreadId` is declared (`Relay.tsx:188`)
    and set on triage clicks (:283) but **never forwarded** to `<TeamVoxMode>` (rendered at 312-318
    with only `onBack`/`apiKey`/`isDarkMode`). Channel deep-link must add the prop + a reader.
- **Focus key must encode store + id (+ aux) — CONFIRMED:** all three tables key on `id` (UUID):
  `quick_vox_messages.id`, `team_vox_messages.id` (+ needs `channel_id` to open the channel first),
  `vox_notes.id` (mappers: `voxModeService.ts:2896-2956`). Use
  `{ store:'quick_vox'|'team_vox_messages'|'vox_notes', id, aux? }`. The codebase already models this
  store-discriminator in `VoxSelectionItem.mode` (`useVoxSelection.ts:17`).

---

## 4. Provenance normalization (P0 — do before/with the readers)

Deep-links are only as good as the provenance stamped at task-creation. Current inconsistencies
(verified):

- **Messages** stamps `origin_message_id` but NOT `metadata.source='messages'`
  (`Messages.tsx:2186-2197`, `handleCreateTaskFromMessage`). Routing currently infers Messages from
  `origin_message_id`, but normalize by also setting `metadata.source='messages'`.
- **Email — RESOLVED ✅, two writers disagree:** `createTaskFromEmail.ts:48-61` sets
  `source:'email-cockpit'` (**not** `'email'`) + a usable `metadata.email_id` (= `cached_emails.id`).
  `ActionItemExtractor.tsx:188` sets `source:'email'` + `source_id` (also `cached_emails.id`) but
  **no `metadata.email_id`**, and writes to the **`tasks`** table not `extracted_tasks`. Normalize
  both to `source:'email'` + `metadata.email_id` so EMAIL routing doesn't ride solely on
  `taskSource.ts`'s `|| metadata.email_id` OR-branch.
- **Meetings — RESOLVED ❌:** `MeetingsComponents.tsx:2065-2070` stamps no provenance at all. Add
  `source:'meeting'` + `metadata.meeting_id = pulse_video_rooms.id` (§3.3).
- **Relay — RESOLVED ❌:** no vox→task path exists; the source strings `taskSource.ts` already routes
  on are never emitted. Add `source:'relay'` + `metadata.relay_store/relay_vox_id` (§3.4).
- **Data reality (2026-06-17):** across all `extracted_tasks`, **0** have `metadata.source`, **1** has
  `origin_message_id`, **0** have `email_id`. Provenance accrues only going forward — so this feature's
  value grows with usage; ship provenance normalization first so new tasks are deep-linkable.

**Recommendation:** add a tiny shared helper for task-creation call sites to stamp
`{ source, email_id?, origin_message_id?, meeting_id?, relay_store?, relay_vox_id? }` consistently,
so every surface that creates a task records routable provenance. Note the two id-bearing tables differ:
`extracted_tasks` carries a generic `metadata jsonb` + `origin_message_id`, while the legacy `tasks`
table (used by `ActionItemExtractor` + `MeetingSummaryView`) has `originMessageId` but **no `metadata`
column** — so meeting/relay/email_id provenance for those writers either needs a `metadata` column or
those creators should route through `extracted_tasks`. **[VERIFY at build]** which table each surface's
focal pane actually reads, so provenance lands where the cockpit can see it.

---

## 5. Phasing

Re-ordered by build cost now that all surfaces are investigated. **Messages + Email are fully
mechanically resolved** (no unknowns); Meetings/Relay need provenance *and* (Meetings) a new
entrypoint, so they cost more even though Relay's Notes/Broadcast hooks already exist.

| Phase | Scope | Risk | Notes |
|-------|-------|------|-------|
| **P0** | Provenance normalization — stamp `source`+id at every task-creation site; resolve the `email-cockpit`/`tasks`-vs-`extracted_tasks` split (§4) | low | Unblocks everything; do first |
| **P1** | Messages exact-message focus | med | Highest volume; mechanics fully resolved incl. `data-message-id` + auto-scroll race (§3.1) |
| **P2** | Email exact-email focus | med | Fully resolved: `openReaderPanel(cached_emails.id)`; only the "ensure loaded" path is a build detail (§3.2) |
| **P3a** | Relay Notes + Broadcast (open-by-id already exists) | low-med | Just needs provenance + a reader → reuse `initialNoteId`/`initialBroadcastId` (§3.4) |
| **P3b** | Relay Channel + Meetings (need new entrypoint) | med-high | Channel: forward `focusThreadId` to `TeamVoxMode` + reader. Meetings: add `initialMeetingId` → `getMeetingRecordingById` → `setView('summary')` (§3.3/3.4) |
| **P-infra** | `taskSource.ts` → `taskSourceTarget` (view+focusKey+focusId) | low | Generalizes `handleOpenSource` |

---

## 6. Testing (matches this session's proven method)

Headless Playwright **cannot** verify these — `WorkspaceContext` doesn't resolve `currentWorkspace`
under storageState, so the cockpit loads 0 tasks and no focal/affordance renders (same limit hit on
items A/B/C). Use the **seed → live-click → MCP-assert** loop instead:

1. Seed a throwaway task via MCP into the **active** workspace (`pulse_active_workspace` in
   localStorage; was `60373be9` "Quantum Ecosystems") with real provenance
   (`origin_message_id` of a real message / `metadata.email_id` of a real email).
2. In the signed-in browser: open the task → click "Open <source>" → confirm the exact item opens
   (right conversation + scrolled to message / right email).
3. Delete the throwaway via MCP.

A non-destructive Playwright UI harness can still assert the **affordance renders** for a seeded
task (cf. `e2e/_verify-dt-template-picker.mjs`), but workspace-resolution blocks the click path.

---

## 7. Files & anchors (verified line refs, 2026-06-17)

**Routing / writer core**
- `src/components/decisions/cockpit/taskSource.ts` — the predicate to extend (§2); `:18` meeting
  branch (dead), `:19` relay/vox branch (dead until P0 emits the source).
- `src/components/decisions/cockpit/CockpitHub.tsx` `handleOpenSource` (~L459) — the writer.
- `src/components/decisions/cockpit/focal/TaskDetail.tsx` — affordance (`Open <source>` ActBtn).
- App nav bus: `src/App.tsx:1277` (`pulse:navigate` listener); `src/types.ts:9` (`AppView`).

**Messages (§3.1)**
- `src/services/pulseService.ts:341-352` (`getMessages` → `thread_id`), `:504-523` (`getOrCreateConversation`).
- `src/components/Messages.tsx:1359-1392` (`selectPulseConversation`, async, calls `getMessagesPaginated`).
- `:1009-1020` (`pulse_focus_nudge` reader template), `:478` (`focusThreadId` state).
- `:4707-4710` (`data-message-id={msg.id}` on the bubble — scroll target).
- `:822` (`messagesEndRef`), `:1082-1087` + `:2276-2280`/`:2508` (auto-scroll-to-bottom — the race to handle).

**Email (§3.2)**
- `src/components/Email/hybrid/EmailHybridClient.tsx:221-234` (`pulse_focus_nudge` reader — template),
  `:759` (`<EmailReaderPanel />` mounted prop-less).
- `src/stores/emailUIStore.ts:128,195-198` (`openReaderPanel(id)` — the open action; `id = cached_emails.id`).
- `src/components/Email/hybrid/.../FolderListView.tsx:106-109` (row click → `setReaderPanelEmailId(email.id)`).
- `src/components/Email/hybrid/.../EmailReaderPanel.tsx:55,57-60` (`emails.find(e=>e.id===id)`; self-closes if absent).
- `src/stores/emailStore.ts:16` (`emails: CachedEmail[]` — flat list, linear find).
- `src/services/emailSyncService.ts:403` (`cached_emails.id = \`${userId}-${gmailId}\``).

**Meetings (§3.3)**
- `src/services/meetingService.ts:311,329` (`getMeetingRecordingById` resolver; `:329` legacy fallback).
- `src/components/Meetings/MeetingsComponents.tsx:2065-2070` (meeting→task writer, no provenance — fix in P0).
- `src/components/Meetings.tsx:673-685` (`onOpenRecap` — internal-only summary entry).

**Relay (§3.4)**
- `src/components/Relay.tsx:125` (view union), `:188`/`:283` (`focusThreadId` set but not forwarded), `:309`
  (`initialContactId`), `:312-318` (`TeamVoxMode` render — add open-by-id prop here).
- `src/components/Relay/VoxNotesMode.tsx:73-74,345-348` (`initialNoteId` — works).
- `src/components/Relay/PulseRadio.tsx:386-394` (`initialBroadcastId` via `data-broadcast-id` — works).
- `src/services/relay/voxModeService.ts:2896-2956` (id mappers for the 3 stores).
- `src/services/warRoomToolsService.ts:304` (only relay-adjacent task writer, `source:'war_room_voice'`).

**Provenance writers (§4)**
- `src/components/Email/hybrid/data/createTaskFromEmail.ts:48-61` (sets `source:'email-cockpit'` + `email_id`).
- `src/components/Email/ActionItemExtractor.tsx:188` (`source:'email'` + `source_id`, no `email_id`, → `tasks` table).
- `src/components/Messages.tsx:2186-2197` (`origin_message_id`, no `source`).
