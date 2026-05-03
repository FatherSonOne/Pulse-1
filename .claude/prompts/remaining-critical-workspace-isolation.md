# Prompt: Address remaining Critical workspace-isolation findings

> **How to use:** paste the entire contents of this file as the opening message to a fresh Claude Code session in the `f:\pulse1` repo. The prompt is self-contained — the agent does not need any conversation context to start.

---

You are picking up a multi-tenant security hardening sweep on the Pulse repo (`FatherSonOne/Pulse-1`). The full audit and shipping log live in **GitHub issue #33** — read it first via `gh issue view 33 --comments`. This prompt covers the **remaining Critical and High items** that were deferred during the initial shipping push.

## Context — what's already shipped and live in production

Production cloud is **`pulse-chat`** (project ref `ucaeuszgoihoyrvhewxk`, region us-east-1, in Quantum Ecosystems org).

A six-pass primary audit + three-pass secondary audit found 49+18 Critical findings. As of session 2026-05-03, **20 Critical + 6 High** are closed in production:

- **PR-3** event_rsvp policy escape (one-line policy fix)
- **PR-4 (partial)** dashboard channel namespacing (postgres-filter half blocked on PR-1)
- **PR-5** workspace-changed event bus + dataService teardown
- **PR-6** decision realtime dedupe + namespacing
- **PR-7** invite-accept reflects without reload
- **PR-13** user_profiles privilege-escalation trigger (single-query super-admin closed)
- **PR-14** 18 SECURITY DEFINER RPCs trusting caller-supplied `user_id` — `_assert_caller_is(uuid)` helper added, all gated
- **PR-15 (partial)** 6 edge functions hardened: send-security-alert, check-search-alerts, ecosystem-bot, billing-usage, ecosystem-heartbeat, gemini-proxy + cron-schedule rotation
- **PR-16** invite email-match check + ON DELETE CASCADE FK on subtasks/task_activity/tasks/team_calendars + invite race FOR UPDATE + Personal Workspace unique index

Latest cloud migration: `20260503060109_cron_use_cron_secret`.
Active branch: `main` (and `feat/meetings-coral-cockpit` is the working branch — they currently match).

## Operational prerequisite

If `gh issue view 34` is still **OPEN**, the operator has NOT yet configured `CRON_SECRET`. Three cron paths are silently 401'ing in production. Surface this in your first message to the user — do not begin remediation work that depends on cron until #34 is closed.

## Remaining Critical/High items — work order

Order is by **shipping risk × leverage**: smallest blast radius and highest impact first. Do them in this sequence unless the user redirects.

### Tier 1 — independent + smaller migrations

#### **PR-2** Vox RLS revert (Critical · C12, C13)
- **File:** `supabase/migrations/20260330000003_fix_vox_rls_policies.sql` regressed earlier workspace-scoped policies on `team_vox_messages`, `vox_team_channels`, `voice_thread_messages`, `voice_threads`, `quick_vox_messages`, `vox_drops`, `voxer_recordings`, `vox_notes`, etc. — they now check only `member_ids`/`participants`, no workspace.
- **Fix:** new migration that recreates each policy as `USING (user_has_workspace_access(workspace_id) AND <existing user check>)`. Several of these tables don't have `workspace_id` yet (overlap with PR-1 column adds) — for those, do the column add + backfill + policy in this migration as a self-contained vox-domain bundle, OR defer to PR-1 if they're cleaner there.
- **Test:** authed user in WSA cannot SELECT voxer_recordings rows whose `workspace_id != WSA`.

#### **PR-8** `clearAllClientCachesOnLogout()` (Critical · C30–C37)
- **Where:** `src/services/authService.ts:380` — `logoutUser()` currently clears only `pulse_user_session`. The audit found 30+ leak-on-logout vectors (API keys, OAuth tokens, IndexedDB email cache, AI conversation history, etc.).
- **Fix:** new module `src/services/sessionLifecycle.ts` exporting `clearAllClientCachesOnLogout()` that:
  1. Iterates `localStorage` and removes everything matching `pulse_*`, `pulse-*`, `pulse:*`, `cal_*`, `voxer*`, `outlook_*`, `gemini_api_key`, `openai_api_key`, `claude_api_key`, `assemblyai_api_key`, `elevenlabs_api_key`, `mapbox_api_key`, `google_maps_api_key`, `analytics_last_aggregation`, `focusMode`, `accentColor`, `customColor`, `theme`, `lp-theme`, `war-room-mission-messages`, `biometric_auth_enabled`, `haptic_feedback_enabled`, `ai_prioritization_enabled`, `sb-*-auth-token`. Keep only `pulse_app_version` and `pulse_keep_logged_in`.
  2. `sessionStorage.clear()`.
  3. Calls `reset()` on every Zustand store: `useNotificationStore`, `useMessagesStore`, `usePulseMessagesStore`, `useWarRoomStore`, `useEmailStore`, `useEmailUIStore`, `useEmailComposeStore`, `useArchiveStore`. **Each store needs a new `reset()` action added** — do not skip this; without it the Zustand state survives logout in module memory.
  4. `await` `indexedDB.deleteDatabase('pulse-email-cache')`, `'pulse_offline_db'`, `'rateLimits'`.
  5. Calls existing `clearServiceWorkerCaches()` from `src/utils/offlineManager.ts:357`.
- **Wire from:** end of `logoutUser()` and the `SIGNED_OUT` branch of `onAuthStateChange()` at `authService.ts:536`.
- **Test:** UserA logs in, sets API keys, switches to a workspace. Logs out. UserB logs in. UserB's localStorage contains zero `pulse_*` / `gemini_api_key` / `outlook_*` keys; UserB's IndexedDB databases are empty or absent.

#### **PR-9** Workspace-switch cleanup + remount (High · M-cache-1, M-cache-2)
- New helper `clearWorkspaceScopedCachesOnSwitch(prevWsId, nextWsId)` that removes the workspace-scoped localStorage keys (`pulse_meeting_action_items`, `pulse_meeting_followups`, `pulse_suggested_events`, `cal_teams`, `cal_goals`, `pulse_recent_searches`, `war-room-mission-messages`, all `pulse-goal-*`, all `${CACHE_PREFIX}*`, `pulse_offline_queue`).
- Call from `WorkspaceContext.switchWorkspace` BEFORE `setCurrentWorkspace(target)`. Already-existing `pulse:workspace-changed` event bus (PR-5) means the dataService channel teardown is already happening on switch.
- **In `App.tsx`**, add `key={currentWorkspace?.id ?? 'none'}` to the authenticated subtree (around `<WorkspaceGate>` render). This forces `MessagesProvider`, `FocusModeProvider`, `PulseAIProvider`, and lazy route components to remount on switch — eliminates the in-memory React-context leaks.
- **Test:** UserA in WSA loads dashboard. Switches to WSB. WSB's MessagesProvider state is empty (no leaked WSA conversations).

#### **PR-12** Defense-in-depth query patches (Medium · C38–C41, H14, H15)
Single PR touching 6 files. Add explicit `.eq('workspace_id', workspaceId)` (or `.eq('user_id', uid)` where workspace_id column doesn't exist yet) to:

1. `src/services/messageChannelService.ts:792` `searchMessagesAdvanced(workspaceId, …)` — accepts `workspaceId` param and currently never uses it. Add the filter on the query.
2. `src/services/dataService.ts:1115` `getWeeklyProductivityData` (messages count) — no user filter; add `.eq('user_id', uid)`.
3. `src/services/dataService.ts:1175,1182` `getProductivityMetrics` — same fix.
4. `src/services/searchService.ts:100` `fallbackSearch` — same fix.
5. `src/services/dataService.ts:1551` `getOutcomes` — outcomes table HAS `workspace_id` but query filters only by `user_id`. Add `.eq('workspace_id', ws)`.
6. `src/services/taskService.ts:295` `getTasksByIds` + `src/services/dependenciesService.ts:60,136,145` — bulk-by-IDs queries with no workspace filter. Plumb `workspaceId` through, add the filter.

### Tier 2 — bigger surgery

#### **PR-1** Phase-3 RLS migration — full ~25-table sweep (Critical · C1–C18)
This is the foundational schema migration that the May 10 9:15am EDT scheduled remote agent (`trig_01Hz5agzd4LN2BiAPoLfd6Em`) is currently aimed at. **If you're picking up before May 10, decide whether to ship some/all of it manually** — a partial start (e.g. `tasks` domain) lets the May 10 agent continue with the rest.

Per-domain breakdown (one sub-migration each, applied independently):
- **auth/workspace foundations** — none of the workspace-y tables here need column adds; this is mostly verification work
- **calendar** — `calendar_events`, `event_comments` (drop the `OR ce.user_id IS NULL` branch — C5), recurrence, RSVP, shared calendars, booking pages
- **decisions** — `decisions` (already has workspace_id but verify NOT NULL), `decision_votes`, `decision_tasks`, `decision_templates` (C7)
- **tasks** — `tasks` (legacy), `extracted_tasks`, `outcomes`/`outcome_blockers`/`workspace_outcomes` (drop NULL branches — H8) — most of the FK CASCADE work already done in PR-16
- **vox** — combine with PR-2 Vox RLS revert
- **analytics** — the 10 tables from `20260402000001_analytics_advanced_tables.sql`
- **archives** — `archives`, `archive_versions`
- **channels** — `message_channels`, `channel_messages`, `channel_members` (close the `is_public` cross-workspace cluster — C15, C16)
- **email** — `email_campaigns`, `email_segments`
- **contacts** — DECISION POINT: per Pass E investigation, contacts are intentionally user-owned (one address book per user). Either document this as the contract or migrate to workspace-owned. Don't proceed until the user makes the call.

For each domain, the pattern is:
```sql
-- Step 1: add column if missing
ALTER TABLE foo ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Step 2: backfill from workspace_members (Phase-1 stub had workspace_id = user_id;
--         non-stub users without workspace_id get their My Workspace)
UPDATE foo SET workspace_id = (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = COALESCE(foo.user_id::uuid, foo.workspace_id)
    AND w.deleted_at IS NULL
  ORDER BY w.created_at ASC LIMIT 1
)
WHERE workspace_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM workspaces w2 WHERE w2.id = foo.workspace_id
);

-- Step 3: NOT NULL + FK
ALTER TABLE foo ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE foo ADD CONSTRAINT foo_workspace_fk
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- Step 4: drop legacy user_id-only policies, recreate with workspace gate
DROP POLICY IF EXISTS foo_owner_select ON foo;
CREATE POLICY foo_workspace_select ON foo FOR SELECT
  USING (user_has_workspace_access(workspace_id) AND user_id = auth.uid()::text);
-- ... insert/update/delete ...

-- Step 5: index
CREATE INDEX IF NOT EXISTS idx_foo_workspace ON foo(workspace_id);
```

Be ruthlessly idempotent (`IF NOT EXISTS`, `IF EXISTS`, `OR REPLACE`). Test each domain by running the smoke test from PASS G of issue #33 against it.

#### **PR-10** Storage `relay` bucket hardening (Critical · C24, C25)
Most damaging unfixed item today: every Vox audio is publicly listable + downloadable + deletable cross-workspace.

1. **Migrate path schema** in `src/services/relay/voxModeService.ts` (7 sites at lines 518, 661, 1277, 1536, 1885, 2005 + the team_vox already-conformant 1076) and `src/services/glimpse/glimpseService.ts:369` — prefix each path with `{workspace_id}/`.
2. **One-time data migration script** to move existing objects from `{userId}/...` to `{workspaceId}/{userId}/...` in storage. Script is at `scripts/cleanup-relay-storage.mjs` template — extend it.
3. **New migration** that flips the bucket to `public = false` and replaces the policies with:
```sql
CREATE POLICY "relay_workspace_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'relay'
  AND public.user_has_workspace_access(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "relay_workspace_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'relay'
  AND public.user_has_workspace_access(((storage.foldername(name))[1])::uuid)
  AND (storage.foldername(name))[2] = auth.uid()::text
);
CREATE POLICY "relay_owner_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'relay' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'relay' AND owner = auth.uid());
CREATE POLICY "relay_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'relay' AND owner = auth.uid());
```
4. **Replace** every `getPublicUrl()` call in the 8 files above with `createSignedUrl(path, 900)` — 15-min TTL.

#### **PR-11** Storage `pulse-attachments` + 5 undefined buckets (High · C26, C28)
Run `select id, name, public from storage.buckets;` against `pulse-chat` first to confirm which of these exist:
- `avatars` — used by `AccountSettings.tsx:151`
- `message-attachments` — `fileUploadService.ts:48` (DEFAULT_BUCKET)
- `voxer-media` — `dataService.ts:1505-1545` (likely dead)
- `exports` — `analyticsExportService.ts`
- `backups` — `backupSyncService.ts`

For each that exists: add a migration creating it private with `{workspace_id}/{user_id}/...` path policy + `user_has_workspace_access` SELECT. Update `fileUploadService.uploadFile()` signature to require `workspaceId`. Replace `getPublicUrl()` with `createSignedUrl()`.

For `pulse-attachments` (defined in `20260330000002`): same hardening — flip private + workspace-scoped path + signed URLs.

### Tier 3 — deferred PR-15 items (each needs scoped product/infra decision)

These are flagged in issue #33 — confirm scope with the user before starting:

- **N13** `daily-webhook` HMAC verification — needs Daily.co's signing scheme docs + `DAILY_WEBHOOK_SECRET` env config
- **N14** `data-cleanup` body `user_id` tightening — drop body param (cron-only mode) OR require admin JWT in addition to `CRON_SECRET`
- **N15** `ecosystem-bot`/`ecosystem-inbound` workspace_id trust — needs new `ecosystem_workspace_authorizations(service_token, workspace_id, allowed_event_types[])` table + per-token allow-list. Coordinate with the cross-app bridge contract in memory `project_ecosystem_bridge_auth.md`.
- **N17** `send-email` open relay — needs per-user rate limit infra (DB-backed like `gemini-proxy`'s pattern) + `workspace_id` param + recipient scoping (only workspace members/contacts) OR template-only mode (server-side template id, no caller-supplied HTML)
- **N20** `daily-rooms` participant join check — verify caller is participant of the meeting room before minting Daily owner tokens / updating recording metadata
- **N26** `transfer_workspace_ownership` AAL2 — require `auth.jwt() ->> 'aal' = 'aal2'` (re-auth assertion) before swap. Needs MFA already configured in Supabase Auth.
- **N29** OAuth token model — workspace-scoped vs user-scoped product decision. Either document user-token model + remove `workspace_integrations.scope='shared'` UI option, OR build `workspace_oauth_tokens(workspace_id, user_id, provider, …)` table + RLS scoped to active workspace + per-workspace re-consent UX.

## Working rules

1. **Production safety:** apply migrations to `pulse-chat` only after the local file is reviewed AND the migration is idempotent. Use the Supabase MCP `apply_migration` action — never raw `execute_sql` for DDL.
2. **Backfill before constraints:** every NOT NULL or FK addition must be preceded by a backfill of NULL/orphan rows. Sample the row counts first with `execute_sql` before deciding the backfill strategy.
3. **Don't break callers:** when modifying a SECURITY DEFINER function, **keep its signature stable** and add the auth check at the top via `_assert_caller_is(p_user_id)` (already exists in production from PR-14). Dropping a param breaks every JS call site — avoid.
4. **Commit per PR:** one PR-N per commit, conventional commits style, message references `#33`. Apply to prod, then commit (so the commit message can include "Applied to production as <migration_name>").
5. **Update issue #33 progress comments after each PR ships.** Flip the checkbox in the issue body's 12-PR plan. Use the existing comment cadence as the model.
6. **Don't auto-merge to main.** The user's existing flow is: ship to `feat/meetings-coral-cockpit`, then they push to main themselves OR explicitly ask. Use `git push origin feat/meetings-coral-cockpit:main` only on explicit request.
7. **The `CLAUDE.md auto-memory` system has relevant context** — `MEMORY.md` lists all stored memories. Read `project_pulse_supabase.md` for cloud project ref, `project_pulse_relay_rename.md` for the Voxer→Relay context that affects PR-2 / PR-10, `project_ecosystem_bridge_auth.md` for the gateway-token pattern that affects N15.

## First-message format expected from you

When you start, reply with a tight status check:

```
✅ Read issue #33 + this prompt. Understanding confirmed.
✅ Cloud state: latest migration <verify>, branch <verify>
⚠/✅  CRON_SECRET ops issue #34: <open / closed>
🎯 Recommended starting PR: <PR-N>, because <one sentence>
   Estimated diff size: <small / medium / large>
   Risk: <low / medium / high>
   Apply to prod after review? <yes / no — wait for me>
```

Then wait for the user's go-ahead before writing any code.
