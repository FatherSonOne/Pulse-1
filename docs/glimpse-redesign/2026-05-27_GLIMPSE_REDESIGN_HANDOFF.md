# Glimpse Redesign — Implementation Plan / Handoff

> **Status:** Design approved (2026-05-27). Not yet implemented.
> **To be executed in a fresh session.** This doc is the source of truth for
> that session — read it top to bottom before touching code.
>
> **Visual source of truth:** `_design-playground/glimpse-redesign.html`
> (opens on **Path D · Hybrid** — the approved composite). Screenshots in
> `_design-playground/_shots/glf-*.png`. The playground also keeps the
> rejected/alternate directions (A/B/C and the per-surface toggles) for
> reference — do **not** port those; only Path D's defaults are approved.

---

## 1. What was approved

A two-surface redesign of the Glimpse section. Coral stays **AI-signal-only**
throughout (summary chips, action pills, briefing accents) — never used to
denote ownership, chrome, or "mine".

| Surface | Approved layout | One-liner |
|---|---|---|
| **Inbox** | **Briefing + Reel** | A coral-bordered AI **briefing/digest card** on top, then **every glimpse as a poster card** in a responsive grid (replaces today's 5-column triage table). |
| **Thread** | **Stacked Cockpit cards + Task Rail** | The existing transcript-first cards, **stacked in one column** (sender in each card header — *no* left/right bubbles), with a **sticky Tasks/Decisions rail** pinned on the right. |

Record, Search, and the message menus/modals are **unchanged** — keep the
current implementation.

### Why these (design rationale, for context)
- Inbox: the value of Glimpse is "know what's in the video before you watch."
  The briefing answers that at the inbox level; the reel grid keeps the video
  itself as the recognizable object.
- Thread: stacked cockpit cards preserve the dense, scannable transcript-first
  read; the rail makes the conversation's extracted work (tasks/decisions)
  actionable without leaving the thread.

---

## 2. Ground truth — what already exists (do not rebuild)

All paths relative to repo root `f:/pulse1`.

### Components
- `src/components/Glimpse/Glimpse.tsx` — the whole section (~1970 lines).
  - `ConversationItem` (~L140) — **current inbox row** (Triage Cockpit table).
    → **This is what the Reel grid replaces.**
  - `MessageBubble` (~L260) — **the cockpit card** (`gl-card`): meta row, AI
    summary block (`gl-summary` + `CLAUDE · SUMMARY` chip), action items,
    inline player, proof row (Watch/Reply/Bookmark), transcript disclosure,
    footer (status, reactions). → **Reuse as-is for the stacked thread.**
  - `RecipientSelector`, record view, search view — **unchanged.**
  - View switch: `viewMode` = `'conversations' | 'chat' | 'record' | 'search'`
    (~L119). The redesign keeps these names; only the *render* of
    `conversations` and `chat` changes.
- `src/components/Glimpse/Glimpse.css` (~2346 lines) — all `gl-*` styles +
  `--gl-*` tokens. Triage Cockpit grid lives at `.gl-tc-*` (~L176+).

### Hooks (`src/hooks/useGlimpse.ts`)
- `useGlimpseConversations()` → `{ conversations, totalUnread, isLoading, … }`.
  Each `GlimpseConversation` already carries the fields the Reel grid + a
  **deterministic** briefing need — **no new query**:
  `lastMessageSummary`, `lastMessageActionCount`, `lastMessageThumbnail`,
  `lastMessageDuration`, `lastMessageProcessingStatus`, `unreadCount`,
  `lastMessageAt`, `participants`, `title`.
- `useGlimpseMessages({ conversationId })` → `{ messages, convertedActionItems,
  toggleReaction, toggleBookmark, addActionItemAsTask, … }`. Every
  `GlimpseMessage` has `actionItems: string[]`, `summary`, `transcript`,
  `topics`, `thumbnailUrl`, `reactions`, `status`. → **Task-rail tasks are a
  client-side roll-up of `actionItems`; no new fetch.**

### Types (`src/services/glimpse/glimpseTypes.ts`)
- `GlimpseMessage`, `GlimpseConversation` — see field lists above. No schema
  change required for the approved design.

### AI service (`src/services/relay/relayAIService.ts`)
- `summarizeConversation(apiKey, messages, workspaceId?)` → returns
  `{ overview, keyPoints, actionItems, keyDecisions?, nextSteps? }`
  (`ConversationSummary` / richer variant ~L20–L98). **Per-conversation only.**
  Already wired into the thread toolbar (`onSummarize`).
- `generateSmartReplies`, `generateReplyDraft` — unchanged.

### Service (`src/services/glimpse/glimpseService.ts`)
- `createTaskFromActionItem(actionItem, message)` (~L738) and
  `getConvertedActionItems(ids)` (~L800) — power the task rail's "add as task"
  + ✓-converted state. **There is no `decisions` query in Glimpse** — decisions
  only exist via `summarizeConversation().keyDecisions`.

---

## 3. Data plan (the only non-trivial wiring)

### Inbox briefing — TWO tiers, ship Tier 1 first
- **Tier 1 — deterministic digest (REAL NOW, no backend):** build the briefing
  card from data already in `useGlimpseConversations`:
  - headline counts: `conversations.length` signals · `totalUnread` unread ·
    Σ `lastMessageActionCount` action items.
  - "Needs you" = conversations where `unreadCount > 0 || lastMessageActionCount > 0`;
    "FYI" = the rest. (Exactly the split the playground's `DInbox` uses.)
  - The digest *paragraph* is **templated from those facts**, not an LLM
    sentence. Do **not** fabricate prose. If you can't state it from data,
    don't print it.
  - Decisions/tasks columns: tasks = the action-item roll-up (links to the
    owning conversations); **omit the Decisions column in Tier 1** (no source).
- **Tier 2 — AI-synthesized digest (FLAGGED, v1+):** a real "Claude watched
  your inbox" synthesis across conversations.
  - **Must be a Supabase edge function** (e.g. `glimpse-inbox-digest`, or extend
    `ai-router`) — **never a direct Gemini call from React** (see
    [[project_pulse_gemini_serverside]]). `summarizeConversation` is
    per-conversation and not a substitute.
  - Gate behind a flag (follow the prelaunch "ship only what's real" rule —
    see `docs/PULSE_PRELAUNCH_ROADMAP.md`). Tier 1 is the always-on fallback.

### Thread task rail
- **Tasks (REAL NOW):** dedup `message.actionItems` across `chatHook.messages`;
  render each with the converted-state from `chatHook.convertedActionItems`;
  tap → `chatHook.addActionItemAsTask(message, item)` (already exists). Clicking
  a task can scroll to / highlight its origin card (optional polish).
- **Decisions (CONDITIONAL):** only populated after the user runs **Summarize**
  (toolbar already wired) — read `ConversationSummary.keyDecisions`. When no
  summary has been generated, show a quiet "Run summary to extract decisions"
  affordance, **not** an empty coral block. Do not auto-fire an LLM call on
  thread open.

---

## 4. Implementation phases

> Work directly on `main` (Pulse default). Commit each phase separately with a
> conventional message. Do **not** branch unless the cutover feels risky enough
> to warrant it — surface that judgment to the user first.

### Phase 1 — Inbox: Reel grid replaces the triage table
- In `Glimpse.tsx`, the `viewMode === 'conversations'` branch currently maps
  `ConversationItem` rows inside `.gl-tc-list`. Replace with a **poster-card
  grid** (`ReelCard`-equivalent — see playground `ReelCard`).
- New card: poster (use `lastMessageThumbnail`; gradient fallback when null —
  the playground's `Poster` is a *placeholder*, real thumbnails exist), unread
  coral bead, sender + avatar, `lastMessageDuration` badge, 2-line
  `lastMessageSummary`, `Claude` muted chip + action pill. Walkthrough/group
  badges from existing signals.
- Keep `processingStatus` → "Transcribing" pending chip.
- Click → existing `handleSelectConversation`.
- CSS: add `.gl-reel-*` classes to `Glimpse.css`; reuse `--gl-*` tokens. Keep
  the `.gl-tc-*` styles for now (only delete once the table is fully gone and
  nothing else references them).

### Phase 2 — Inbox: Briefing card (Tier 1)
- Add a `GlimpseBriefingCard` above the grid. Coral border earns its place
  here (AI surface). Source: deterministic counts (§3). Group the grid into
  **Needs you / FYI** sections (playground `DInbox`).
- Flag-gate a `Tier 2` slot but do not build the edge function in this pass —
  file a follow-up issue.

### Phase 3 — Thread: stacked cards + 2-col grid
- The `viewMode === 'chat'` branch already renders `MessageBubble` cards
  stacked in `.vvb-messages-list` (max-width column). **This is already the
  approved stacked layout** — the main change is wrapping it in a 2-column grid
  with the rail.
- New layout: `grid` `minmax(0,1fr) 220px`, `align-items:start`; left = the
  existing stacked card column, right = `GlimpseTaskRail` (sticky). Below a
  breakpoint (≤ ~860px) the rail drops under the thread or collapses to a
  toggle. **No bubble/staggering** — cards stay uniform, full-column width.
- Do **not** introduce a me/them `tone` surface split (the playground tried it
  then dropped it for the stacked layout — uniform surfaces, sender in header).

### Phase 4 — Thread: Task Rail
- `GlimpseTaskRail` component: `EXTRACTED` label, `TASKS` (roll-up, real),
  `DECISIONS` (from last `summarizeConversation`, else CTA), `Reply` button
  (reuses the record entry).
- Wire tasks to `addActionItemAsTask` + `convertedActionItems` (✓ state).

### Phase 5 — Styling, tokens, a11y
- All new styles use `--gl-*` / `--pulse-*` tokens; **no local color literals**
  (see [[reference_pulse_design_tokens]]). Audit coral usage against the budget
  in `docs/messages-tools-redesign.md`.
- Light + dark parity (user requires this in every component).
- a11y: grid cards are buttons with aria-labels mirroring the old row labels;
  rail is a labelled complementary region; respect target-size + focus-visible
  (the existing `.gl-tc-row` patterns are a good model).

### Phase 6 — Verify
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — gate on **no NEW**
  errors (repo has ~1234 pre-existing; see [[reference_pulse_tsc_oom]]).
- `npm run test` (Vitest) — Glimpse service/uploadRetry tests still green.
- `npm run test:e2e` — refresh the a11y spec
  (`e2e/messages-coral-cockpit-a11y.spec.ts` is the pattern); add Glimpse
  inbox-grid + thread-rail coverage. Auth refresh per
  [[reference_pulse_e2e_auth_refresh]].
- Manual: dark + light, empty inbox, processing state, group/walkthrough,
  long transcript, rail with 0 tasks.

---

## 5. Real now vs flagged for v1

| Piece | Status |
|---|---|
| Reel grid inbox | **Real** — data already on `GlimpseConversation` |
| Deterministic briefing card | **Real** — counts/splits from existing fields |
| Stacked thread + task rail (tasks) | **Real** — `actionItems` roll-up + existing convert wiring |
| Rail decisions (post-Summarize) | **Real** — reuses `summarizeConversation().keyDecisions` |
| AI-synthesized inbox digest (Tier 2) | **Flagged v1+** — needs new edge function, server-side only |

---

## 6. Risks & gotchas
- **Coral budget.** The briefing card + chips can blow the "AI-only" budget if
  reused as chrome. One coral attention-hit per row; provenance demoted to a
  neutral chip in dense lists (the current `ConversationItem` does this — copy
  the pattern).
- **Server-side Gemini.** Tier 2 digest must not call Gemini from React
  ([[project_pulse_gemini_serverside]]). Direct calls will be rejected/insecure.
- **Thumbnails.** Real `thumbnailUrl` / `lastMessageThumbnail` exist; the
  playground gradient `Poster` is a placeholder only — wire the real image with
  a gradient fallback for null.
- **Rules of Hooks.** `useGlimpseMessages` must stay called unconditionally
  (empty `conversationId` = no-op) — don't move it behind the new layout
  branches.
- **RLS.** Live policies on `quick_vox_messages` / workspace tables require
  `workspace_id` + access checks ([[project_pulse_relay_workspace_rls]]); query
  via MCP to confirm before adding any new server read for Tier 2.
- **Don't delete `.gl-tc-*`** until the table render is fully gone and grep
  shows no references.

---

## 7. Acceptance criteria
- [ ] Inbox renders the reel poster grid (no 5-col table) with the briefing card
      on top; Needs-you / FYI grouping; processing + unread + group/walkthrough
      states correct; dark + light.
- [ ] Thread renders stacked cockpit cards (uniform, sender-in-header, no
      bubbles) in a column with a sticky Tasks/Decisions rail; rail tasks are
      real and convertible; decisions appear post-Summarize.
- [ ] Record / Search / menus unchanged and still working.
- [ ] Coral used only on AI surfaces; tokens only (no color literals).
- [ ] No NEW `tsc` errors; Vitest green; a11y e2e updated.
- [ ] Visual match to `_design-playground/_shots/glf-01..04` (Path D).

---

## 8. Open decisions for the implementing session
1. **Tier 2 digest** — build the edge function this pass, or file as a separate
   issue and ship Tier 1 only? (Recommended: ship Tier 1, file the issue.)
2. **Rail responsive behavior** — drop-below vs collapsible toggle on narrow
   panes? (Recommended: collapse to a toggle ≤ ~860px.)
3. **Should this be one GitHub issue under the launch-roadmap epic (#98)?**
   (Not filed yet — confirm with the user; `/git-tracker` is the tool.)

---

## 9. Pointers
- Playground: `_design-playground/glimpse-redesign.html` (Path D = approved).
- Shots: `_design-playground/_shots/glf-*.png`, `gld-*.png`.
- Prior exploration: `docs/glimpse-redesign/directions-v1.html` (2026-05-21).
- Coral budget: `docs/messages-tools-redesign.md`.
- Prelaunch principle: `docs/PULSE_PRELAUNCH_ROADMAP.md`.
- Memory: [[project_pulse_messages_pathd]], [[project_pulse_gemini_serverside]],
  [[reference_pulse_design_tokens]], [[reference_pulse_tsc_oom]],
  [[project_pulse_relay_workspace_rls]], [[reference_pulse_e2e_auth_refresh]].
