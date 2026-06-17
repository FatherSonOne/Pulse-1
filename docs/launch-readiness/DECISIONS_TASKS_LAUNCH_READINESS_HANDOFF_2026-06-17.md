# Decisions & Tasks — Launch-Readiness Handoff

**Date:** 2026-06-17
**Section:** Decisions & Tasks ("Triage Cockpit") — `src/components/decisions/cockpit/**`
**Source audit:** `docs/launch-readiness/decisions-tasks-launch-readiness-2026-06-16.md`
**Audit verdict before this work:** 66/120 (55%) — *not ready for teams*.
**State now:** every Sprint 0–3 item + the 2c follow-up is **shipped, pushed (origin/main @ `08dfe17`), and — except one cycle — live-verified**. Remaining = the template picker (deferred, low value) and Sprint 4 differentiation.

> All DB migrations were dry-run in a rolled-back transaction, then applied once,
> then re-verified live (per `CLAUDE.md` migration rules). Project: `pulse-chat`
> (`ucaeuszgoihoyrvhewxk`).

---

## 1. What shipped this session (14 commits, 9 migrations)

| # | Item | Commit | Migration / files | Verified |
|---|---|---|---|---|
| 0.1–0.4 | Team-collab RLS repair (votes tally, subtasks, task_activity, templates) | `104249d` | `20260616000003` | live (member sees full tally; non-member 0) |
| 0.5 | Hide dead controls (Sort pill, Snooze, Open-source) — handlers preserved | `2ea7f57` | TaskDetail/QueueItem/TriageView/PropertyFilterBar | tsc |
| 0.6 | Real cross-device "Remind" via Web Push | `4be2baf` | `20260616000004` (`notify_decision_voters` RPC) | live (targeting 0/1; anon revoked) + UI shows "Remind" |
| 1.1 | Status/Priority/Place chips scoped "· tasks" | `f5b91b8` | PropertyFilterBar | tsc |
| 1.2 | CommentThread infinite-spinner → `.catch()` + Retry | `f5b91b8` | CommentThread | tsc |
| 1.3 | Subtask AI error copy fixed | `f5b91b8` | SubtaskList | tsc |
| 1.4 | Risk/consensus empty-catch → `console.warn` | `f5b91b8` | DecisionDetail | tsc |
| 1.5 | Unify decision↔task link key + backfill 6 rows | `c2e37c7` | `20260616000005` | live (linked_decision 6→0) |
| 1.6 | Regression check (no consumer relied on votes self-filter) | `c2e37c7` | (verification only) | confirmed via grep + reads |
| 2a | Date filter exposed + applied (task `extracted_at`, decision `created_at`) | `ae36612` | PropertyFilterBar/CockpitHub | live (menu present) |
| 2b | Archive focal gains ActivityLog + CommentsSection | `ae36612` | ArchiveView | tsc |
| 2c | Save-as-template verified; personal-template RLS model fixed | `6ecd0c5` | `20260616000009` | live (creator sees, others 0, system global) |
| 2d | Free-text labels/tags (column + editor + filter) | `4016a3b` | `20260616000006` | live (Labels editor renders) |
| 2d | Recurring tasks (RFC-5545 RRULE, client regenerate-on-complete) | `70878c5` | `20260616000007` | engine 12/12; UI "Repeats" renders |
| 3a | Working sort (Recent/Priority/Due) | `d03069f` | PropertyFilterBar/CockpitHub | live (menu reorders) |
| 3b | Bulk multi-select + bulk complete/delete | `8a48c61` | QueueItem/QueueGroup/TriageView/CockpitHub | live (bulk bar) |
| 3d | Weighted-criteria option-scoring matrix | `30c1a27` | `20260616000008` | engine 6/6; live grid + winner |
| 3e | WIP-limit nudge | `0a20031` | proactiveSuggestionsService | tsc |
| — | Live Playwright verify harness | `08dfe17` | `e2e/_verify-dt-*.mjs` | n/a |

**Migrations applied (live):** `20260616000003`–`20260616000009` (7).

---

## 2. Remaining work (priority order)

### A. Eyeball gap — recurring regenerate-on-complete ✅ VERIFIED LIVE (2026-06-17)
The RRULE engine is unit-proven (`src/__tests__/services/taskRecurrence.test.ts`, 12/12)
and the `RecurrencePicker` renders on TaskDetail. **Now also exercised live end-to-end.**
- Code: `CockpitHub.regenerateRecurring` (called from `handleQuickAction` + `handleStatusChange`).
- How verified: seeded a throwaway `FREQ=DAILY` task via MCP into the active workspace
  (`Quantum Ecosystems`, `60373be9`), user clicked **Mark done** in their live browser,
  then MCP confirmed the spawned child row — `status=todo`, `recurrence_parent_id` → seed,
  `recurrence_rule` preserved, `tags` + `metadata.created_by`/`recurred_from` carried.
  Both throwaway rows deleted after. Deadline advanced exactly one **local** day (engine is
  local-midnight based; a UTC-midnight seed reads as the prior local evening in EDT — not a bug).
- Headless note: `e2e/_verify-dt-recurring.mjs` exists but **does not complete headless** —
  `WorkspaceContext` won't resolve `currentWorkspace` under storageState, so the cockpit loads
  0 tasks and the row never renders (same known Relay/Direct headless-auth limit). The live
  user-click + MCP-assert path above is the verification of record.

### B. Template picker ✅ DONE & VERIFIED LIVE (2026-06-17) — path 1
Shipped via the recommended path 1: the orphaned `DecisionTemplates` picker is now wired
into the cockpit create flow as a new `template` `CreateMode`.
- `+ New ▾ → "New from template"` (and a command-palette entry) opens the picker.
- New `create/templateSubmit.ts` mirrors `wizardSubmit`: `applyTemplate` → `createDecision`
  (status `proposed`, matching the wizard) → activity log → `suggested_tasks` linked via the
  canonical `metadata.generated_from_decision` (+ `generated_from_template`) → `trackUsage`.
- **Schema gotcha handled:** template `default_decision_type` is a *voting method*
  (`consensus`/`majority_vote`); `decisions.decision_type` is a *category*. Orthogonal, no
  CHECK constraint — so `templateSubmit` does NOT pass it; createDecision defaults to `general`.
- **Pre-existing bug found + fixed:** `decisionTemplateService.trackUsage` called
  `increment_template_usage`, which updates **`message_templates`** (wrong table + a `user_id`
  filter decision_templates lacks) → usage_count never moved. Added dedicated SECURITY DEFINER
  RPC `increment_decision_template_usage(uuid)` (migration `20260617000000`, REVOKE from anon)
  and repointed `trackUsage`.
- Verified: non-destructive Playwright UI harness (`e2e/_verify-dt-template-picker.mjs`, all
  green) + live user create-clicks with MCP DB asserts — decision (`proposed`, `general`) + 5
  linked tasks created in the correct workspace, and `usage_count` ticked 0→1 via the live
  client→RPC round-trip. Throwaway rows cleaned + template counter reset.
- Commits: `fa6c3cc` (picker path + harness), `caa24fc` (usage_count RPC fix + migration).
- Deferred sub-option (not built): path 2 (template-prefilled wizard) remains available if
  higher-fidelity prefill is ever wanted — `decisionTemplateService.loadTemplateAsWizardState`.

### C. 2e — "Open source" cross-surface deep-links (DEFERRED — Sprint-4 territory)
The control is currently hidden (0.5). Provenance ids exist (`extracted_tasks.origin_message_id`
→ pulse_messages; `metadata.email_id`/`metadata.source`). Wiring real navigation needs:
- An `onNavigate(view, focusKey)` prop threaded from `App.tsx` into `CockpitHub`
  (CockpitHub currently has no nav prop).
- Per-surface focus handoff (Messages already has `sessionStorage 'pulse_focus_thread'`;
  **Email has no specific-email focus key** — would need one).
- Re-show the hidden "Open" affordance in `TaskDetail` (handler `handleOpenSource` + prop
  `onOpenSource` plumbing are intact — see 0.5 commit).
This is the audit's Sprint-4 "one-click jump to originating email/message/meeting".

### D. Sprint 4 — differentiation (POST-LAUNCH, from the audit)
- Real cross-device reminders — **DONE in 0.6** (the others below remain).
- AI "is the investigation complete enough to decide?" loop.
- Workspace-shared decision AI context (the `ragService.chat` in `DecisionMission` currently
  passes empty context arrays — ungrounded; audit item #5).
- Next-best-decision surfacing.
- Deeper cross-surface provenance (overlaps with C).

---

## 3. Technical context for resuming cold

### New engines (pure, unit-tested — reuse these)
- `src/services/taskRecurrence.ts` — RRULE parse + `computeNextDate` + `nextRecurringTask`
  (FREQ/INTERVAL/COUNT/UNTIL/BYDAY/BYMONTHDAY). Tests: `__tests__/services/taskRecurrence.test.ts`.
- `src/services/decisionScoring.ts` — `computeMatrix` (Σ score×weight, rank, winner).
  Tests: `__tests__/services/decisionScoring.test.ts`.

### Schema additions this session
- `extracted_tasks.tags text[]` (default `'{}'`, GIN index) — free-text labels.
- `extracted_tasks.recurrence_rule text`, `recurrence_parent_id uuid` (partial index).
- `decisions.scoring_matrix jsonb` — **isolated** from the wizard-owned `decisions.options`/
  `criteria` columns (those have frame-specific shapes; do not collide them).
- `Task` type: added `tags?`, `recurrence_rule?`, `recurrence_parent_id?` (`taskService.ts`).
  Note: `extracted_tasks` keys off **`extracted_at`** (not `created_at`).
- `Decision` type: added `scoring_matrix?` (`decisionService.ts`).

### RLS facts (verified live via pg_policies)
- The canonical workspace gate is `public.user_has_workspace_access(ws_id uuid)`
  (SECURITY DEFINER → `user_has_permission(ws, 'workspace.read')`).
- `decision_votes` has **no** workspace_id — scope through `decisions` (SELECT = owner OR
  `EXISTS decisions d WHERE … user_has_workspace_access(d.workspace_id)`).
- `decision_votes.user_id` is **text**; `workspace_members.user_id`, `push_subscriptions.user_id`
  are **uuid** — cast when joining (`wm.user_id::text`).
- Supabase auto-grants EXECUTE on new public functions to `anon` — **explicitly `REVOKE … FROM anon`**
  on SECURITY DEFINER RPCs (see `notify_decision_voters`).
- `decision_templates` kinds: **system** (`is_system=true`), **shared** (`workspace_id` + access),
  **personal** (`workspace_id NULL` + `created_by = auth.uid()`, creator-only).

### Web Push pipeline (already existed — reuse for any new push)
- Sender: `supabase/functions/send-push` (VAPID, `web-push`). Body `{ user_id|user_ids, notification }`.
  Auth via `CRON_SECRET` or `PUSH_DISPATCH_SECRET` Bearer.
- DB→push pattern: a SECURITY DEFINER fn reads vault `cron_secret` and `net.http_post`s
  send-push (see `notify_on_pulse_message` + `notify_decision_voters`). Never blocks the txn.
- Delivery depends on `VAPID_*` Supabase secrets being set (DM push already ships, so they are).

### Gotchas hit this session
- `tsc --noEmit` OOMs at default heap → `NODE_OPTIONS=--max-old-space-size=8192`. Repo has a
  large pre-existing error baseline; gate on **no NEW errors in touched files**. Two pre-existing
  errors in `tasks/CreateTaskModal.tsx` + `tasks/TaskEditModal.tsx` are a `types.Task` vs
  `taskService.Task` divergence — unrelated to this work.
- The cockpit's **active workspace** is from `localStorage.pulse_active_workspace` (was
  `60373be9-…`, NOT `c54f5267-…`). When seeding/flipping test data, use the *active* workspace.
- Decisions only appear in the triage queue when `status='voting'` AND the user hasn't voted.

---

## 4. Running the live verify harness
1. Dev server up: `npm run dev:full` (cockpit at `http://localhost:5173`).
2. Refresh token: in a signed-in `:5173` tab, DevTools console → run the Blob-download snippet
   (see memory `reference_pulse_e2e_token_export`); it lands in Downloads → copy over
   `e2e/.auth/user.json` (token ~1 hr).
3. Run: `node e2e/_verify-dt-cockpit.mjs` (sort/bulk/labels/repeats) and
   `node e2e/_verify-dt-scoring.mjs` (scoring grid — needs a `voting` decision in the active
   workspace). Screenshots → `.dt-verify/` (gitignored).

---

*All changes on `main`, pushed. This section now clears every launch-blocker, reliability,
completeness, and polish item from the 2026-06-16 audit. Remaining = deferred picker (B) +
post-launch differentiation (C, D).*
