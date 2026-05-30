# Decisions & Tasks Redesign — Implementation Handoff

**Date:** 2026-05-29
**Direction locked:** **Triage Cockpit** (primary) + **Archive** (same cockpit pattern). **Board dropped.**
**Status:** Ready to implement
**Owner:** TBD (this doc is the handoff — it is self-contained; a builder agent can pick it up cold)

---

## 0. TL;DR

Replace the current three-mode hub (Active list / Board accordion / Archive) with a **Triage Cockpit**: a left **queue rail** (Needs you → Today → Upcoming) beside a **focal detail pane** that adapts per item — vote tally + AI intelligence for decisions, checklist + AI intelligence for tasks — driven keyboard-first (`J/K` move, act-and-advance). **Archive** becomes a second tab in the *same* cockpit shell: a timeline rail + a focal **retrospective pane** built on the existing `OutcomeRetrospective` ("Pulse AI · Look back"). Creation is consolidated into one **New** overlay routing to the existing Decision Wizard / Quick task / Ask Pulse AI. **The Board view is removed entirely.**

**Non-negotiable principle (CLAUDE.md §4 — coral budget):** `--pulse-coral*` derived tokens are reserved for AI-output surfaces only (AI intelligence blocks, AI chips, the retrospective "Look back" panel, the AI brief). Pulse **rose** (`--pulse-rose`) remains the brand/primary/active color (logo, primary CTA, active nav, selected-row stripe). Status colors are their own palette; priority tags are neutral. **We adopted PostHog *structure* (flat hairline borders, dense rows, property-filter pills, property tables, activity log, underline scene-tabs, ⌘K) — NOT PostHog's palette.** (User decision, 2026-05-29.)

**Rollout model:** behind a new feature flag **`decisionsTriageCockpit`** (default **OFF**) added to `src/lib/featureFlags.ts`. `App.tsx` branches between the legacy `DecisionTaskHub` and the new `CockpitHub`. Both ship side-by-side until the flag flips. Follow the `emailHybrid` precedent exactly (see `docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md`).

**The spec is the playground:** `_design-playground/decisions-tasks-redesign.html` (verify: `_verify-decisions-tasks.mjs`; shots: `_shots/decisions-tasks-*.png`). Pills drive `triage / archive / create / empty`. When this doc and the playground disagree, **the playground wins** on visual/interaction; this doc wins on data wiring + dispositions.

---

## 1. Source of Truth

| Reference | What it provides |
|---|---|
| `_design-playground/decisions-tasks-redesign.html` | The locked visual + interaction spec. Triage / Archive / Create overlay / Caught-up empty state, dark+light. |
| `_design-playground/_verify-decisions-tasks.mjs` | Headless verification harness (9 shots, zero-console-error bar). |
| **This doc** | Feature-disposition matrix, new architecture, phased plan, risk register. |
| `src/components/decisions/design-tokens.css` | Section design tokens (`--dt-*`, status colors, `.dt-label` mono signature). Consume, don't redeclare. |
| `src/styles/pulse-tokens.css` + `src/App.css` | Canonical `--pulse-*` tokens (rose base, coral derivations). |
| `CLAUDE.md` §1 (commit early), §4 (coral budget), §6 (doc naming) | Guardrails the implementation must hold. |
| `docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md` | The flag/scaffold/flip pattern to copy verbatim (`emailHybrid` → `decisionsTriageCockpit`). |
| Memory `project_pulse_decisions_tasks_redesign_direction.md` | The locked direction + recon summary. |

---

## 2. Mental Model

```
                         ┌──────────────────────────────────────────────┐
   CockpitMasthead  ───► │  Decisions & Tasks   ⌘K  🔔 ⚡ 🤖  [+ New ▾]  │
   (title + ⌘K +         │  ── Triage ───────  Archive ──                │  ← underline scene-tabs (2, not 3)
    actions +            ├──────────────────────────────────────────────┤
    underline tabs)      │  [Needs you ▾] [Assignee: You ×] [+ Filter]   │  ← PropertyFilterBar (composable pills)
                         ├───────────────┬──────────────────────────────┤
   QueueRail  ─────────► │ NEEDS YOU  3  │  ◆ Focal detail pane         │ ◄─ FocalPane (adapts by kind)
   (groups, J/K,         │  ◦ item       │    status · priority · ID    │
    quick-actions,       │  ◦ item  ◄────┼──  Property table             │
    caught-up empty)     │ TODAY      2  │    AI intelligence (coral)   │
                         │  ◦ item       │    Checklist / Tally+Vote     │
                         │ UPCOMING   2  │    Activity log · Comments   │
                         │  ◦ item       │  ───────────────────────────  │
                         │               │  [Mark done][Reassign]…  foot │
                         └───────────────┴──────────────────────────────┘
   New ▾  ──►  CreateOverlay { New decision (Wizard) | Quick task | Ask Pulse AI }
   Archive tab ──►  ArchiveTimeline (by week) + RetrospectivePane (Look back) + metric strip
```

**Invariants the implementation MUST hold:**

1. **Two tabs only — Triage + Archive. No Board.** No horizontal/vertical kanban, no drag-to-change-status, no accordion-board state.
2. **One focal item at a time.** Selecting a queue/timeline row renders its full detail in the focal pane. There is always a selection unless the queue is empty (→ Caught-up state).
3. **Coral = AI only.** Rose = brand/primary/active. Never coral for chrome, dividers, buttons, status, or priority. (CLAUDE.md §4.)
4. **No new data model.** Reuse every existing table/service. Tasks live in `extracted_tasks`; decisions in `decisions`; votes in `decision_votes`. Realtime, comments, activity, retrospective, dependencies, context all already exist.
5. **Flag-gated, legacy untouched.** With `decisionsTriageCockpit=off`, the legacy hub is byte-identical. Downstream consumers (Dashboard strips, War Room) read the same tables and must keep working in both states.

---

## 3. Current State — Architecture Audit Summary

Source: `src/components/decisions/**` + `src/components/tasks/**` (~85 files), mounted **lazily and un-flagged** at `src/App.tsx:19` + `:941` (`<DecisionTaskHub user={user} />` when `AppView === DECISIONS_TASKS`).

| Concern | Files / lines | One-line summary |
|---|---|---|
| **Orchestrator** | `DecisionTaskHub.tsx` (1,676) | Owns mode, data load, realtime, filters, bulk actions, 12 modals, nudges, metrics, keyboard. |
| **Header** | `HubHeader.tsx` (80) | 3-tab mode switcher (Active/Board/Archive) + refresh + action slot. |
| **Filters** | `FilterBar.tsx` (299) | Search (300ms debounce), Status (7), Priority (4), Date (7/30/90d), Place; active-filter tags. |
| **Active view** | `ActiveView.tsx` (272), `tasks/TaskSection.tsx` | Strict priority buckets (NeedsVote→Overdue→Blocked→InReview→InProgress→ToDo→RecentlyDone); caught-up empty state w/ quick-launch templates + Open-with-AI. |
| **Board view** | `BoardView.tsx` (438) | 8-section vertical accordion, drag-drop status change, 600ms auto-expand, WIP limit (In Progress=5), accordion persisted via `settingsService('decisionsHubAccordionBoard')`. |
| **Archive view** | `ArchiveView.tsx` (456) | Archived (`archived_at`) items, date-range + group-by-week/month + search, 4 velocity metrics, reopen. |
| **Decision card** | `EnhancedDecisionCard.tsx` (597) | Vote (approve/reject/abstain/concern), AI risk badge, consensus, results bars, final decision, PlacePicker venue, Generate Tasks, Send Reminder. |
| **Task card** | `tasks/EnhancedTaskCard.tsx` (369) | Checkbox→done, status select, priority, AI score (Zap), provenance chip, AI assignee/duration, blocks/blocked-by, edit, two-step delete. |
| **Wizard** | `wizard/DecisionWizard.tsx` + `Step1-5` + `frames/*` | 5-step (Frame→Details→Tasks→Rhythm→Save), 6 frames (Hire/Pick-tool/Build/Allocate/Strategy/Conflict), AI `classifyAndPrefill`, save-as-template. Builds `WizardOutput`; host writes rows + activity + context. |
| **Creation modals** | `tasks/CreateTaskModal.tsx`, `tasks/TaskEditModal.tsx`, `DecisionDecomposer.tsx`, `tasks/TaskExtractionModal.tsx` | Quick task (form/NL + AI deadline); task edit (Details/Subtasks/Activity tabs); AI task generation from a decided decision; extracted-task review. |
| **AI features** | `tasks/AITaskPrioritizer.tsx`, `ConversationalAssistant.tsx`, `AlertsPanel.tsx` + services | Prioritization scores, sidebar chat, proactive nudges (stale/deadline/blocker/workload). |
| **Activity & comments** | `activity/*`, `comments/*` | Per-item activity drawer + comment thread (nested, @mention); workspace activity panel; "this week" `ActivitySummaryStrip`. |
| **Dependencies & context** | `dependencies/*`, `context/*` | Blocks/blocked-by; criteria/options/stakeholders + option-scoring; `OutcomeRetrospective` + `DueRetrospectiveBanner` (fires N days post-Decided). |
| **Realtime** | `hooks/useDecisionTaskRealtime.ts` (99) | 3 channels namespaced by workspace: `decisions`, `extracted_tasks`, `decision_votes` (votes filtered to current decision ids). |
| **Downstream** | `Dashboard/strips/{DecisionsOpen,TasksDue,TeamDecisionsWaiting}Strip.tsx`, `Dashboard/tiles/DecisionVelocityTile.tsx`, `WarRoom/missions/DecisionMission.tsx`, `Summit/summitExportService.ts` | Read the same tables/services; **not** part of this refactor — must keep working under both flag states. |
| **Cross-surface inflow** | `Email/hybrid/data/createTaskFromEmail.ts`, `Messages.tsx` (`createDecision`/`createTask`), `captureService.ts` (`kind:'decision'`) | Tasks/decisions are created from Email/Messages/Meetings/Relay; linked via `origin_message_id` + `metadata.source`. The cockpit must surface that provenance (source chip + "Extracted from X"). |

**Persistence keys:** `decisionsHubAccordionBoard` (board accordion — becomes dead), dismissed/snoozed nudges (`dismissedNudgesStorage`), AI-prioritization preference (`localStorage`).
**Keyboard today:** `C` (new task), `Escape` (close topmost overlay, hierarchy mission>assistant>prioritizer>reassign>extend), `Tab` focus-trap in modals, `Space/Enter` on card checkbox/actions, `Cmd/Ctrl+Enter` to submit forms.
**No feature flag today** — everything is on by default.

---

## 4. Feature Disposition Matrix

**Legend:** **Preserved** = behavior kept ~verbatim · **Moved** = kept, new location/affordance · **Deferred (v1.1)** = out of scope for v1, stub/document · **Removed** = dropped, rationale required.
Anything not in this matrix is a bug in this doc.

### 4.1 Navigation & header
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| 3-mode switcher (Active/Board/Archive) | `HubHeader` | Underline scene-tabs **Triage / Archive** | **Moved** | 2 tabs; Board gone. |
| Section title + refresh | `HubHeader` | `CockpitMasthead` | **Moved** | Refresh → `⌘K` command + realtime auto-refresh already covers it. |
| Nudges/Alerts bell + `AlertsPanel` | Header action | Masthead bell + same dropdown | **Preserved** | Reuse `AlertsPanel` verbatim. |
| Activity button → `WorkspaceActivityPanel` | Header action | Masthead Activity icon | **Preserved** | `ActivitySummaryStrip` "this week" rollup → panel header. |
| AI Assistant (`ConversationalAssistant`) | Header Bot | Masthead Bot → sidebar | **Preserved** | Same sidebar component. |
| Decision Wizard launcher | Header Template | **New** overlay → "New decision" | **Moved** | |
| Create Task (`+` / `C`) | Header Plus | **New** overlay → "Quick task" | **Moved** | `C` shortcut preserved. |
| CSV export | Header Download | `⌘K` command / overflow | **Moved** | Lower prominence; same `handleExportCSV`. |
| `RealTimeIndicator` | Header (on error) | Masthead | **Preserved** | |

### 4.2 Filters & views
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Search (300ms debounce) | `FilterBar` | `⌘K` + property bar | **Preserved** | Port the debounce. |
| Status / Priority / Date filters | `FilterBar` dropdowns | Composable property-filter pills | **Moved** | Same `FilterState`; pill UI. |
| Place/Location filter | `FilterBar` (when places exist) | Property pill (conditional) | **Preserved** | Keep `taskPlaceMap` + `availablePlaces`. |
| Clear filters / active-filter tags | `FilterBar` | Pills are the active display; "Clear" clears pills | **Moved** | |
| Saved views (Needs you / All / Decisions / Mine) | — | `SavedViews` selector | **New (added)** | PostHog saved-view concept; v1 = static presets, not user-persisted. |

### 4.3 Active view → Triage queue
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Strict priority buckets | `ActiveView` 7 buckets | Queue groups **Needs you / Today / Upcoming** | **Moved** | Mapping: *Needs you* = decisions-needing-vote + overdue + blocked; *Today* = in_review + in_progress; *Upcoming* = todo/pending. Keep the strict no-double-render rule. |
| Recently-completed bucket | `ActiveView` (collapsed) | Surfaces in Archive (last 48h) / `⌘K` | **Moved** | |
| Section collapse/expand | `ActiveView` / `TaskSection` | Queue group collapse | **Preserved** | |
| Caught-up empty state | `ActiveView` empty | `CaughtUp` focal | **Preserved** | quick-launch templates → New-overlay frames; Open-with-AI → Ask Pulse AI. |
| `ActivitySummaryStrip` "this week" | top of Active | `WorkspaceActivityPanel` header | **Moved** | Optional coral AI-brief strip is **Deferred v1.1**. |
| `DueRetrospectiveBanner` | top of Active | Triage queue item ("Look back: …") under *Needs you* + recorded in Archive focal | **Moved** | Introduce a 3rd item kind `retro` in the queue; `recordOutcome` writes as today. |

### 4.4 Board view — **REMOVED**
| Feature | Current | Disposition | Rationale |
|---|---|---|---|
| 8-section accordion board | `BoardView` | **Removed** | User dropped the Board. Lifecycle is expressed by queue groups + status pills + inline status control. |
| Drag-to-change-status | `BoardView` DnD | **Removed** (status change **Preserved** via inline control + quick-actions) | No drag surface in the cockpit; status edited in focal pane / hover quick-action. |
| 600ms drag auto-expand | `BoardView` | **Removed** | No board. |
| WIP limit indicator (InProgress=5) | `BoardView` | **Deferred (v1.1)** | Resurface as a nudge ("In Progress > 5") not a column cap. |
| `decisionsHubAccordionBoard` setting | `settingsService` | **Removed** | Delete the key write; leave any stored value orphaned (harmless). |

### 4.5 Archive
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Archived items (`archived_at`) | `ArchiveView` | `ArchiveTimeline` rail (grouped by week) | **Preserved** | Reuse `getArchivedTasks` / `getArchivedDecisions`. |
| Date range presets + custom | `ArchiveView` | Property pill | **Preserved** | |
| Group by week/month/none | `ArchiveView` | Control (default week) | **Preserved** | |
| Search within archive | `ArchiveView` | Filter pill / `⌘K` | **Preserved** | |
| Velocity metrics (4) | `ArchiveView` cards | Inline metric strip in filter bar | **Moved** | Same computation. |
| Reopen | `ArchiveView` per-item | Focal `Reopen` action | **Preserved** | `reopenTask` / `reopenDecision`. |
| Outcome retrospective | `OutcomeRetrospective` (banner) | **Elevated** to Archive focal **RetrospectivePane** for decisions | **Moved** | "Pulse AI · Look back": recorded → show rating+reflection; pending → rating buttons + textarea. `recordOutcome`/`resolvePrompt` unchanged. |

### 4.6 Cards → Focal panes
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Decision: vote (4 choices), already-voted state | `EnhancedDecisionCard` | `DecisionDetail` footer | **Preserved** | `castVote`. |
| Decision: AI risk badge + recommendations | `EnhancedDecisionCard` | `DecisionDetail` AI block (coral) | **Preserved** | `assessDecisionRisk`; hide on quota (`confidence===-1`). |
| Decision: consensus detection (≥3 votes) | `EnhancedDecisionCard` | `DecisionDetail` AI block | **Preserved** | `consensusDetectorService`. |
| Decision: results bars + final decision | `EnhancedDecisionCard` | `DecisionDetail` Tally | **Preserved** | |
| Decision: Generate Tasks → `DecisionDecomposer` | `EnhancedDecisionCard` | `DecisionDetail` action | **Preserved** | |
| Decision: Send Reminder | `EnhancedDecisionCard` | `DecisionDetail` action | **Preserved** | `notifyDecisionEvent`. |
| Decision: PlacePicker venue/geofence | `EnhancedDecisionCard` | `DecisionDetail` property | **Preserved** | |
| Task: checkbox → done/todo | `EnhancedTaskCard` | Focal "Mark done" + queue quick-action | **Preserved** | |
| Task: status select / priority | `EnhancedTaskCard` | Focal property table (inline-edit) | **Preserved** | |
| Task: AI score / provenance chip | `EnhancedTaskCard` | Focal AI intelligence + chip | **Preserved** | |
| Task: AI suggested assignee / duration | `EnhancedTaskCard` | Focal AI intelligence | **Preserved** | |
| Task: blocks / blocked-by deps | `EnhancedTaskCard` + `DependencySection` | Focal AI intelligence + property | **Preserved** | `dependenciesService`; keep newly-unblocked toast. |
| Task: edit → `TaskEditModal` | `EnhancedTaskCard` | Focal is the editor (inline) + modal still available | **Moved** | Focal pane subsumes the Details tab; Subtasks/Activity inline. |
| Task: two-step delete | `EnhancedTaskCard` | Focal footer + queue quick-action | **Preserved** | Keep 4s arm window. |
| Source provenance ("Extracted from Email" + quote) | weak today | First-class in focal (`SourceContext`) | **Moved (elevated)** | The "multi-surface AI core" made visible. |
| Skeleton loaders | `Skeleton{Task,Decision}Card` | Queue/focal skeletons | **Preserved** | Adapt shape. |

### 4.7 Creation (the New overlay)
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Decision Wizard (5 steps, 6 frames, save-as-template) | `DecisionWizard` | New → "New decision" | **Preserved** | Reuse component as-is; render inside overlay. |
| AI `classifyAndPrefill` (describe-it) | Wizard Step 1 | New-decision describe input | **Preserved** | |
| Quick task (form/NL + AI deadline) | `CreateTaskModal` | New → "Quick task" | **Preserved** | |
| Ask Pulse AI (`DecisionMission`) | header/assistant | New → "Ask Pulse AI" | **Preserved** | `ragService.chat`. |
| Decompose decision → tasks | `DecisionDecomposer` | `DecisionDetail` action | **Preserved** | |
| Extracted-task review | `TaskExtractionModal` | reachable from decompose/decision | **Preserved** | |

### 4.8 AI, activity, comments
| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| `AITaskPrioritizer` | overlay | `⌘K` "Prioritize" / Triage action | **Moved** | Applies `ai_priority_score` to tasks; same service. |
| Proactive nudges | `AlertsPanel` | Masthead bell | **Preserved** | |
| Per-item activity (`ActivityDrawer` activity tab) | drawer | **Inline** `ActivityLog` in focal | **Moved** | Always visible, no drawer. |
| Per-item comments (thread, @mention, edit/delete) | `ActivityDrawer` comments tab | **Inline** `CommentsSection` in focal | **Moved** | Reuse `comments/*` + `decisionCommentsService`. |
| Workspace activity | `WorkspaceActivityPanel` | Masthead Activity | **Preserved** | |
| Bulk multi-select + bulk status/delete | hub toolbar | — | **Deferred (v1.1)** | Cockpit is single-focus. v1 keeps per-item status/delete via focal + quick-actions. Re-add queue shift-select + bulk bar in v1.1. |
| Option-scoring comparison grid | `decisionContextService.scoreOption` | — | **Deferred (v1.1)** | Wizard still writes criteria/options; the scoring grid UI is v1.1. |
| `WorkloadHeatmap` | `tasks/WorkloadHeatmap.tsx` (not mounted in hub) | — | **Deferred (v1.1)** | Not currently surfaced; leave file untouched. |

### 4.9 Infra / downstream (no behavior change)
| Feature | Disposition | Notes |
|---|---|---|
| `useDecisionTaskRealtime` (3 channels) | **Preserved** verbatim | Reuse the hook unchanged. |
| Dashboard strips/tiles, War Room `DecisionMission`, Summit export, `ecosystemNotifyService` | **Preserved** | Read same tables/services; verify both flag states. |
| Cross-surface inflow (Email/Messages/capture) | **Preserved** | Cockpit only *displays* provenance; no change to writers. |

---

## 5. New Architecture

### 5.1 Component tree (new folder `src/components/decisions/cockpit/`)
```
cockpit/
  CockpitHub.tsx              ← orchestrator (data, realtime, filters, modals, nudges, metrics, keyboard).
                                Mirrors DecisionTaskHub's data/effects; reuses every service + the realtime hook.
  CockpitMasthead.tsx         ← title + ⌘K bar + bell/activity/AI + New▾ + underline tabs (Triage|Archive).
  CommandBar.tsx              ← ⌘K palette (search items + run: New, Prioritize, Export, Refresh, jump-to).
  filters/
    PropertyFilterBar.tsx     ← composable pills (reads/writes the existing FilterState).
    SavedViews.tsx            ← static presets (Needs you / All work / Decisions / Assigned to me).
  triage/
    TriageView.tsx            ← queue rail + focal split; owns selectedId.
    QueueRail.tsx  QueueGroup.tsx  QueueItem.tsx
    CaughtUp.tsx              ← empty state (New decision / Ask Pulse AI).
  focal/
    FocalPane.tsx             ← routes by item.kind → TaskDetail | DecisionDetail | RetrospectivePane.
    TaskDetail.tsx            ← property table + SourceContext + AI intelligence + checklist + ActivityLog + CommentsSection + FocalActions.
    DecisionDetail.tsx        ← property table + Tally/Vote + AI intelligence (risk+consensus) + ActivityLog + CommentsSection + FocalActions.
    PropertyTable.tsx  ActivityLog.tsx  CommentsSection.tsx  SourceContext.tsx  FocalActions.tsx
  archive/
    ArchiveView.tsx           ← timeline rail + focal; owns selectedId.
    ArchiveTimeline.tsx  ArchiveRow.tsx  ArchiveMetrics.tsx
    RetrospectivePane.tsx     ← elevates OutcomeRetrospective (recorded + pending states).
  create/
    CreateOverlay.tsx         ← segmented New decision | Quick task | Ask AI; mounts existing components.
```
**Reused as-is (do not rewrite):** `DecisionWizard` + steps/frames, `CreateTaskModal`, `DecisionMission`, `DecisionDecomposer`, `TaskExtractionModal`, `ReassignTaskModal`, `ExtendDeadlineDialog`, `AlertsPanel`, `ConversationalAssistant`, `WorkspaceActivityPanel`, `AITaskPrioritizer`, `comments/*`, `PlacePicker`, `RealTimeIndicator`, every service, `useDecisionTaskRealtime`, `useAIErrorHandler`, `design-tokens.css`.

### 5.2 State plan (`CockpitHub`)
Port verbatim from `DecisionTaskHub`: `decisions`, `tasks`, loading/hasMore, `filters` (`FilterState`), `availablePlaces`/`taskPlaceMap`, `workspaceMembers`, `metrics`, `nudges`/`dismissedNudges`, all modal flags, the 800ms debounce, `loadDecisions`/`loadTasks`/`generateMetrics`/`generateNudges`, every `handle*` callback, and the realtime wiring. **Add:** `tab: 'triage'|'archive'`, `selectedId` (per tab), `overlay: null|'create'`, `commandOpen`. Derive queue groups + archive groups with `useMemo` from the same `filteredTasks`/`filteredDecisions`.

### 5.3 Selection / focal mechanics
- Queue/timeline rows are `role="button"` divs (so quick-action buttons can nest). `selectedId` drives the focal pane. `J/K` move selection within the flattened visible list; `E` = primary act (done / approve-context); `S` = snooze; `Enter` opens source.
- Focal pane is **always visible** when the list is non-empty; **no focus trap** (it's not a modal). Modals (wizard, create, reassign, extend, mission) keep their existing focus traps.
- Empty list → `CaughtUp`.

### 5.4 Tab / Archive handling
Archive is a tab swap inside `CockpitHub` (not a route). Same masthead + filter bar; the body swaps `TriageView` ↔ `ArchiveView`. Archive reuses the rail+focal pattern; focal for a decision = `RetrospectivePane`, for a task = a read-only completion summary with `Reopen`.

---

## 6. Implementation Phases

Each phase is independently mergeable to `main` (per CLAUDE.md §1 — commit each unit; new files `git add`ed immediately). Conventional commits.

### Phase 0 — Scaffold (flag + folder + branch)
- Add `decisionsTriageCockpit` to `src/lib/featureFlags.ts` (default `false`, dev override `?ff_decisionsTriageCockpit=on`). Follow the `emailHybrid` template.
- Create `src/components/decisions/cockpit/CockpitHub.tsx` rendering `CockpitMasthead` + an empty body.
- In `src/App.tsx:941`, branch: `useFeatureFlag('decisionsTriageCockpit', user?.id, false) ? <CockpitHub user={user}/> : <DecisionTaskHub user={user}/>`. Lazy-load `CockpitHub`.
- **Acceptance:** repo builds; flag OFF → legacy unchanged; `?ff_decisionsTriageCockpit=on` → empty cockpit shell with masthead.
- **Commit:** `feat(decisions): scaffold decisionsTriageCockpit flag + cockpit/ shell`

### Phase 1 — Masthead + tabs + ⌘K stub
- `CockpitMasthead` (title, `⌘K` bar, bell/activity/AI buttons, `New ▾`, underline `Triage|Archive` tabs). `CommandBar` opens on `⌘K`/`Ctrl+K` (stub list).
- **Acceptance:** tabs toggle a placeholder; `⌘K` opens/closes; coral budget respected (rose primary, no coral chrome).
- **Commit:** `feat(decisions): cockpit masthead, scene tabs, ⌘K command bar`

### Phase 2 — Data layer in CockpitHub
- Port data load + realtime + filters + members + places + nudges/metrics from `DecisionTaskHub` (reuse services + `useDecisionTaskRealtime`). Wire `RealTimeIndicator`.
- **Acceptance:** cockpit loads real decisions/tasks for the workspace; realtime updates arrive; no console errors.
- **Commit:** `feat(decisions): port data + realtime + filters into CockpitHub`

### Phase 3 — Triage queue rail
- `TriageView` + `QueueRail`/`QueueGroup`/`QueueItem`. Group mapping per §4.3. Selection state, `J/K` nav, hover quick-actions (done/snooze), collapsible group headers, source chip + AI chip.
- **Acceptance:** queue mirrors today's Active buckets (no item double-renders); selecting updates focal placeholder; keyboard nav works.
- **Commit:** `feat(decisions): triage queue rail with grouped items + keyboard nav`

### Phase 4 — Focal TaskDetail
- `FocalPane` + `TaskDetail`: property table (assignee/due/source/priority/ID, inline-edit), `SourceContext`, AI intelligence block (score/est/blocks + suggestion), checklist/subtasks, footer actions (Mark done, Reassign→modal, Snooze/Extend→dialog, Open source). Wire `dependenciesService` + newly-unblocked toast.
- **Acceptance:** every `EnhancedTaskCard` + `TaskEditModal` Details action reachable from the focal pane; status/priority/assignee/deadline edits persist.
- **Commit:** `feat(decisions): focal task detail (property table, AI intel, actions)`

### Phase 5 — Focal DecisionDetail
- `DecisionDetail`: status + type + source + ID, description, Tally + vote buttons (already-voted state), AI intelligence (risk + consensus, hide on quota), Generate Tasks→decomposer, Send Reminder, PlacePicker.
- **Acceptance:** every `EnhancedDecisionCard` action reachable; voting + decompose + reminder work; risk/consensus render.
- **Commit:** `feat(decisions): focal decision detail (tally, vote, AI risk/consensus)`

### Phase 6 — Activity log + Comments inline
- `ActivityLog` (per-item activity, AI events flagged) + `CommentsSection` (reuse `comments/*` + `decisionCommentsService`: thread, @mention, edit/delete). Replace `ActivityDrawer` usage in the cockpit.
- **Acceptance:** comment + activity parity with the drawer; @mention picker works.
- **Commit:** `feat(decisions): inline activity log + comments in focal pane`

### Phase 7 — Property filters + saved views + ⌘K actions
- `PropertyFilterBar` (pills over existing `FilterState`) + `SavedViews` presets. Fill `CommandBar` actions (New, Prioritize, Export CSV, Refresh, jump-to-item, search).
- **Acceptance:** filters drive the queue; saved-view presets switch the active filter set; `⌘K` runs each action.
- **Commit:** `feat(decisions): composable property filters, saved views, ⌘K actions`

### Phase 8 — Empty state + due-retrospective surfacing
- `CaughtUp` empty state (New decision / Ask Pulse AI). Surface due retrospectives as a `retro` queue item under *Needs you* (via `decisionContextService.getDuePrompts`).
- **Acceptance:** clearing the queue shows Caught-up; a due retro appears as a queue item and opens the record-outcome flow.
- **Commit:** `feat(decisions): caught-up empty state + due-retrospective queue item`

### Phase 9 — Archive tab
- `ArchiveView` (timeline rail grouped by week + focal), `ArchiveMetrics` strip, `RetrospectivePane` (recorded + pending), date/group/search controls, `Reopen`.
- **Acceptance:** archived items list; metrics compute; reopen works; pending retro records via `recordOutcome`.
- **Commit:** `feat(decisions): archive tab — timeline + retrospective focal + metrics`

### Phase 10 — Create overlay
- `CreateOverlay` segmented (New decision = `DecisionWizard`, Quick task = `CreateTaskModal`, Ask AI = `DecisionMission`). Wire `New ▾` + `C` shortcut.
- **Acceptance:** all three creation paths produce real rows (decision+tasks via wizard, task via quick, decision via mission); activity logged.
- **Commit:** `feat(decisions): unified New overlay (wizard / quick task / ask AI)`

### Phase 11 — Keyboard, a11y, ancillary panels
- Global keys: `J/K` nav, `E` done, `S` snooze, `C` new, `⌘K` palette, `Escape` hierarchy. Guard against `KeyboardChordsLayer` / text-input focus. Wire `AlertsPanel` (bell), `ConversationalAssistant` (Bot), `WorkspaceActivityPanel` (Activity), `AITaskPrioritizer`. `@media (prefers-reduced-motion)`; focus-visible rings; aria on rails/focal.
- **Acceptance:** keyboard parity; reduced-motion safe; nudges/assistant/activity panels open; a11y pass (axe).
- **Commit:** `feat(decisions): cockpit keyboard model + ancillary panels + a11y`

### Phase 12 — Flag flip + legacy cleanup
- Visual pass vs `_design-playground` (dark+light); e2e (extend `e2e/decisions-tasks-sprint7.spec.ts`); verify Dashboard strips + War Room under flag ON.
- Flip `decisionsTriageCockpit` default → `true` (keep `?ff_decisionsTriageCockpit=off` for rollback).
- After soak: delete `HubHeader`, `FilterBar`, `ActiveView`, `BoardView`, old `ArchiveView`, `TaskSection`, `EnhancedTaskCard`/`EnhancedDecisionCard` (if no other consumers — **grep first**), the `decisionsHubAccordionBoard` write, and `DecisionTaskHub` itself. Update `decisions/index.ts`.
- **Commits (two):** `feat(decisions): flip decisionsTriageCockpit default to true` → `chore(decisions): remove legacy hub after cockpit soak`

---

## 7. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Realtime channel collision (cockpit + legacy both mounted in a tab) | Low | Med | Only one renders (flag branch). Channels are workspace-namespaced; hook unchanged. |
| 2 | `extracted_tasks` vs `tasks` table confusion | Med | High | Tasks are in `extracted_tasks`. Reuse `taskService` only; never hand-write queries. |
| 3 | Dropping drag-DnD upsets muscle memory | Med | Low | Status still editable inline + via quick-action; faster than drag. Note in release. |
| 4 | Bulk-action regression (deferred) | Med | Med | Per-item delete/status remain in v1; document bulk as v1.1; don't silently remove the capability path. |
| 5 | Comment/@mention parity gap | Med | Med | Reuse `comments/*` + `decisionCommentsService` unchanged; e2e the mention flow. |
| 6 | Always-visible focal breaks modal focus assumptions | Low | Med | Focal is not a modal (no trap); only true overlays trap focus. |
| 7 | Keyboard clash with global `KeyboardChordsLayer` | Med | Med | Bail when text input/contenteditable focused or modifier held; reuse the existing `isTypingTarget` guard. |
| 8 | Coral-budget creep (rose used as AI or coral as chrome) | Med | Med | Lint visually each phase; coral only in AI/retrospective blocks + chips. |
| 9 | Perf with large workspaces (long queue/archive) | Low | Med | Keep `Load More` pagination; virtualize rail only if >200 rows (defer otherwise). |
| 10 | Downstream consumers regress under flag ON | Low | High | Phase 12 explicitly verifies Dashboard strips + War Room + Summit export. |
| 11 | Retrospective prompt surfacing duplicates (banner + queue item) | Low | Low | Single source: `getDuePrompts`; banner removed when cockpit ON. |
| 12 | Wizard reuse inside overlay (sizing/portal) | Med | Low | `DecisionWizard` already `createPortal`s; mount it from the overlay's New-decision route, don't re-implement. |
| 13 | Legacy deletion removes a still-used card | Med | Med | Grep every `EnhancedTaskCard`/`EnhancedDecisionCard` import before Phase 12 deletion. |

---

## 8. Acceptance Criteria

**Behavioral**
- [ ] Flag OFF → legacy hub byte-identical (visual diff + e2e regression).
- [ ] Flag ON → Triage renders real grouped items; selecting shows full detail; `J/K/E/S/C/⌘K/Esc` work.
- [ ] Every matrix **Preserved**/**Moved** feature is reachable and functional (vote, decompose, reminder, status/priority/assignee/deadline edits, delete, reassign, extend, deps, comments, activity, nudges, assistant, workspace activity, export, prioritize).
- [ ] Archive lists archived items, computes metrics, reopens, and records outcomes (recorded + pending states).
- [ ] New overlay creates real rows via wizard / quick task / ask-AI; activity logged.
- [ ] Realtime updates the cockpit (insert/update across decisions/tasks/votes).

**Visual**
- [ ] Matches `_design-playground/decisions-tasks-redesign.html` (dark+light) within reason.
- [ ] Coral only on AI/retrospective surfaces; rose only as brand/primary/active; status palette intact; priority tags neutral.

**Code-health**
- [ ] No NEW `tsc` errors (`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`; gate on no-new vs the ~1234 pre-existing — see memory `reference_pulse_tsc_oom`).
- [ ] `_verify-decisions-tasks.mjs` stays zero-console-error.
- [ ] Phase 12 deletes legacy with no dangling imports.

**Performance**
- [ ] First focal paint < 100ms after selection; no jank scrolling a 100-row rail.

---

## 9. Out of Scope (Deferred to v1.1)

1. **Queue multi-select + bulk status/delete bar** (cockpit is single-focus in v1).
2. **Option-scoring comparison grid** (`scoreOption`); wizard still captures criteria/options.
3. **WIP-limit signal** (as a nudge, not a column cap).
4. **`WorkloadHeatmap`** surfacing.
5. **Optional coral AI morning-brief strip** atop the focal pane.
6. **User-persisted saved views** (v1 ships static presets).
7. **Rail virtualization** (only if a workspace exceeds ~200 active items).
8. **Board view** — permanently removed, not deferred.

---

## 10. Decisions Log

| Decision | Why |
|---|---|
| Board dropped entirely | User direction (2026-05-29). Lifecycle is legible via queue groups + status pills; the board's drag affordance added weight without speeding triage. |
| PostHog **structure**, not palette | User chose "Structure only, keep rose". Preserves Pulse brand + CLAUDE.md §4 coral budget. |
| Coral = AI only; rose = brand/primary | CLAUDE.md §4. Non-negotiable. |
| Retrospective elevated to Archive focal | Turns Archive from a graveyard into a living look-back surface; reuses real `OutcomeRetrospective` + `decision_outcomes`. |
| Bulk actions deferred to v1.1 | Cockpit's single-focus model; per-item actions cover v1. Flagged so it isn't silently lost. |
| Flag-gated cutover (`decisionsTriageCockpit`) | Mirrors `emailHybrid`; safe side-by-side soak + instant rollback. |
| Focal pane subsumes `TaskEditModal` Details | Always-visible editing beats a modal hop; modal stays available for deep edits. |

---

## Appendix A — File inventory & disposition

**New (`cockpit/`):** `CockpitHub`, `CockpitMasthead`, `CommandBar`, `filters/{PropertyFilterBar,SavedViews}`, `triage/{TriageView,QueueRail,QueueGroup,QueueItem,CaughtUp}`, `focal/{FocalPane,TaskDetail,DecisionDetail,PropertyTable,ActivityLog,CommentsSection,SourceContext,FocalActions}`, `archive/{ArchiveView,ArchiveTimeline,ArchiveRow,ArchiveMetrics,RetrospectivePane}`, `create/CreateOverlay`.

**Reused unchanged:** `wizard/**`, `CreateTaskModal`, `TaskEditModal` (deep-edit), `DecisionMission`, `DecisionDecomposer`, `TaskExtractionModal`, `ReassignTaskModal`, `ExtendDeadlineDialog`, `AlertsPanel`, `ConversationalAssistant`, `WorkspaceActivityPanel`, `AITaskPrioritizer`, `comments/**`, `dependencies/**`, `context/**` (`OutcomeRetrospective` consumed by `RetrospectivePane`), `Skeleton*Card`, `RealTimeIndicator`, `PlacePicker`, all `src/services/*`, `useDecisionTaskRealtime`, `useAIErrorHandler`, `design-tokens.css`.

**Modified:** `src/App.tsx` (flag branch), `src/lib/featureFlags.ts` (add flag), `decisions/index.ts` (exports).

**Removed at Phase 12 (after soak, grep-verified):** `DecisionTaskHub`, `HubHeader`, `FilterBar`, `ActiveView`, `BoardView` + `BoardView.css`, old `ArchiveView`, `tasks/TaskSection`, `EnhancedTaskCard`, `EnhancedDecisionCard`, `DueRetrospectiveBanner` (superseded by queue item + Archive pane), `ActivityDrawer` (inlined), `decisionsHubAccordionBoard` write.

## Appendix B — Reading order for the builder

1. This doc §2 (mental model) + §4 (matrix) + §6 (phases).
2. `_design-playground/decisions-tasks-redesign.html` — open it; toggle Triage/Archive/Create/Caught-up, dark+light.
3. `docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md` §Phase 0 + flag section — copy the flag/scaffold/flip mechanics.
4. `src/components/decisions/DecisionTaskHub.tsx` — the state/effects/handlers to port.
5. `src/hooks/useDecisionTaskRealtime.ts` + `src/services/{decisionService,taskService,decisionActivityService,decisionContextService,dependenciesService}.ts` — the data contracts.
6. `src/components/decisions/{EnhancedDecisionCard,ActiveView}.tsx` + `tasks/EnhancedTaskCard.tsx` — every feature the focal panes must absorb.
7. `src/components/decisions/wizard/DecisionWizard.tsx` + `context/OutcomeRetrospective.tsx` — creation + retrospective, reused as-is.
8. `src/components/decisions/design-tokens.css` + CLAUDE.md §4 — coral budget before writing any color.

---

*End of handoff. No code changed by this document. Implementation begins at Phase 0.*
