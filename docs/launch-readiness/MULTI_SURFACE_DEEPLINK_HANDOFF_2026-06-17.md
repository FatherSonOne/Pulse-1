# Full Multi-Surface Deep-Link Integration — Spec & Handoff

**Date:** 2026-06-17
**Status:** Spec for a deferred follow-up. **Section-level routing already shipped**
(launch item C, commit `d9a0dcc`); this doc covers the remaining **exact-item focus**.
**Parent:** `docs/launch-readiness/DECISIONS_TASKS_LAUNCH_READINESS_HANDOFF_2026-06-17.md` (item C)
**Owner surface:** Decisions & Tasks cockpit task focal pane → originating surface.

> Investigation provenance: every code/schema claim below was read from the live repo
> + `pulse-chat` DB (`ucaeuszgoihoyrvhewxk`) on 2026-06-17. Lines marked **[VERIFY]**
> are TODOs the implementer must confirm before building (not yet read).

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

### 3.1 Messages — **FEASIBLE, highest priority** (most task origins)
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
  (Messages.tsx:478, 1010) to model the highlight lifecycle on.
- **Scroll-to-message [VERIFY]:** confirm message rows carry a stable DOM id/ref to scroll to;
  if not, add `data-message-id` to the row and `scrollIntoView`.
- **Caveat:** `Messages.tsx` is ~5,900 lines — keep the reader self-contained; do not refactor
  surrounding code.

### 3.2 Email — **FEASIBLE, second priority**
- **Provenance:** writers stamp `metadata.source='email'` (+ ideally `email_id`) —
  `Email/ActionItemExtractor.tsx:187`, `gmailService.ts:407`, `Email/hybrid/data/createTaskFromEmail.ts`.
  **[VERIFY]** what `email_id` actually contains (cached_emails.id? gmail message id? rfc822?) —
  query a real email-origin task's metadata before building the reader.
- **Writer:** set `pulse_focus_email = <email_id>`, navigate to `AppView.EMAIL`.
- **Reader:** add a `pulse_focus_email` `useEffect` in `EmailHybridClient.tsx` right beside the
  existing `pulse_focus_nudge` reader (EmailHybridClient.tsx:221-234). **[VERIFY]** the function
  that opens a specific email/thread — it is NOT at the top level of EmailHybridClient (grep found
  no `openThread`/`setActiveThread` there); trace into the child reader/list components to find the
  select-email handler and lift/expose it.
- Note: there's also a legacy non-hybrid Email path; target the hybrid client (the live one).

### 3.3 Meetings — **INVESTIGATE FIRST**
- **[VERIFY]** what a meeting-origin task carries (no `source='meeting'` tasks exist in data today).
  `meetingDetectionService.ts` mentions `source: 'conversation' | 'email' | 'vox'` — meeting tasks
  may not even set `source='meeting'`. Determine the real id (meeting id? recall bot id?) and the
  Meetings open-by-id mechanism before speccing a reader.

### 3.4 Relay — **INVESTIGATE FIRST**
- **[VERIFY]** relay/vox-origin task provenance + how Relay opens a specific vox/note. Relay's data
  model is split (Direct=quick_vox, Channel=team_vox_messages, Notes=vox_notes) — the focus key must
  encode *which* relay store + id.

---

## 4. Provenance normalization (P0 — do before/with the readers)

Deep-links are only as good as the provenance stamped at task-creation. Current inconsistencies
(verified):

- **Messages task path stamps `origin_message_id` but NOT `metadata.source='messages'`**
  (`Messages.tsx:2186-2197`, `handleCreateTaskFromMessage`). Routing currently infers Messages from
  `origin_message_id`, but normalize by also setting `metadata.source='messages'`.
- **Email** sets `source='email'` but **[VERIFY]** whether it consistently sets a resolvable
  `email_id`.
- **Data reality (2026-06-17):** across all `extracted_tasks`, **0** have `metadata.source`, **1** has
  `origin_message_id`, **0** have `email_id`. Provenance accrues only going forward — so this feature's
  value grows with usage; ship provenance normalization first so new tasks are deep-linkable.

**Recommendation:** add a tiny shared helper for task-creation call sites to stamp
`{ source, email_id?, origin_message_id? }` consistently, so every surface that creates a task
records routable provenance.

---

## 5. Phasing

| Phase | Scope | Risk | Notes |
|-------|-------|------|-------|
| **P0** | Provenance normalization (stamp `source` everywhere; verify `email_id`) | low | Unblocks everything; do first |
| **P1** | Messages exact-message focus | med | Highest volume; mechanics verified (§3.1) |
| **P2** | Email exact-email focus | med | Needs open-email hook trace (§3.2) |
| **P3** | Meetings + Relay | med-high | Investigate provenance + open API first (§3.3/3.4) |
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

- `src/components/decisions/cockpit/taskSource.ts` — the predicate to extend (§2).
- `src/components/decisions/cockpit/CockpitHub.tsx` `handleOpenSource` (~L459) — the writer.
- `src/components/decisions/cockpit/focal/TaskDetail.tsx` — affordance (`Open <source>` ActBtn).
- `src/services/pulseService.ts:341-352` (`getMessages` → `thread_id`), `:504-523` (`getOrCreateConversation`).
- `src/components/Messages.tsx:1359` (`selectPulseConversation`), `:478`/`:1010` (focus state + nudge reader).
- `src/components/Email/hybrid/EmailHybridClient.tsx:221-234` (`pulse_focus_nudge` reader — template).
- App nav bus: `src/App.tsx:1277` (`pulse:navigate` listener); `src/types.ts:9` (`AppView`).
- Provenance writers: `Email/ActionItemExtractor.tsx:187`, `gmailService.ts:407`,
  `Messages.tsx:2186-2197`.
