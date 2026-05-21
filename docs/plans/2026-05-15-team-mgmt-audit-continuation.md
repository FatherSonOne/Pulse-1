# Team Management Audit — Continuation Prompt

**Date:** 2026-05-15
**Predecessor:** [`2026-05-14-team-mgmt-audit-revisal.md`](./2026-05-14-team-mgmt-audit-revisal.md)
**Purpose:** Drop-in prompt for a fresh agent session to resume the revisal work cold without re-deriving context.

> Copy everything below the line into a new Claude Code session prompt to resume.

---

You are picking up the Pulse Team Management audit revisal mid-stream. The previous session (2026-05-14 / 2026-05-15) shipped 7 PRs and closed 5 audit issues; 2 issues remain open. Pick up from there.

## Repo + project facts

- Working dir: `f:/pulse1`
- GitHub repo: `FatherSonOne/Pulse-1` (main branch)
- Supabase cloud project: `pulse-chat` (ref `ucaeuszgoihoyrvhewxk`) — use Supabase MCP for migrations + edge function deploys + behavioural probes
- Audit plan doc: `docs/plans/2026-05-14-team-mgmt-audit-revisal.md`
- This continuation prompt: `docs/plans/2026-05-15-team-mgmt-audit-continuation.md`
- Workflow precedent: /git-tracker (every PR comments back on its issue with a deployment-verified status block; use the existing comments on #38–#46 as templates)

## What's already done this revisal cycle

| Issue | PR | What |
|---|---|---|
| #38 ✅ | #44 | `workspace_invites` RLS self-reference fix (cross-tenant leak closed) |
| #39 ✅ | #45 | `workspace_members` last-owner trigger + WITH CHECK on update policy + `owner_id` protection trigger + transfer RPC reorder + NULL-safe gate |
| #40 ✅ | #47 + #48 | `billing_drift_log` table + `queue_billing_drift_entry` RPC + `billing-reconcile-seats` edge function + cron schedule + cap re-check inside `accept_workspace_invite` + `auto_join_workspace_by_domain` trigger |
| #43 ✅ | #50 | `workspaceGroups` feature flag in `src/lib/featureFlags.ts` (default off in prod) |
| #46 ✅ | #49 | `createWorkspace` rewritten to call `bootstrap_workspace` RPC (atomic) + RPC codified as migration |
| #41 partial | #51 | Phase 1: deep-link Invite (`?focus=invite`), Copy link button on pending invites, Transfer→ link on owner's own row + `pulse:settings-navigate` CustomEvent, Groups empty-state CTA |
| #42 | — | Untouched permissions catalog epic |

Live in prod:

- 8 migrations: `20260514000002–20260514000008`
- 2 edge functions: `billing-sync-seats` (existing, untouched) and `billing-reconcile-seats` (new, v4 ACTIVE, `verify_jwt=false`, does its own service-role bearer check)
- 1 `pg_cron` job: `billing-reconcile-seats-daily`, `0 6 * * *`, jobid 13
- 1 Vault secret: `service_role_key`, **new `sb_secret_*` format (41 chars)**, NOT the legacy JWT
- Pre-existing orphaned workspace `eac938fd-…` ("Dev Team") hand-deleted as part of #39 cleanup

## Open work, in priority order

### #41 phase 2 — 7 deferred Team Settings UX tasks

The phase-1 PR body in #51 lists each by code (C1, C3-merge, C3-files, C4, C6-promote, C8b, F1). Design decisions to make before coding:

- **C1 (seat meter):** decide meter shape — vertical bar, horizontal, or counter with progress ring. Trigger Upgrade CTA at >70% usage, rose accent only at >90% (Coral-As-Signal rule per `DESIGN.md`).
- **C3 (invite consolidation):** is `BulkInviteCard` worth keeping as a separate card, or absorbing into the main Invite card with a "Paste many" toggle? Single card is cleaner; either way needs a small UX call.
- **C8b (modal replacement):** find the project's modal vocabulary (grep `Dialog`/`Modal` components) and use that pattern for the two `window.confirm` calls in TeamSettings (revoke + remove).
- **F1 (workspace_id race):** capture `workspaceId` at mutation start; disable the workspace switcher while a Team-Settings mutation is in flight. Multi-file: needs hook into `WorkspaceContext` or local state lock.

Also worth landing in phase 2: a `?focus=transfer` useEffect in `WorkspaceSettings.tsx` that scrolls to / opens the Transfer card. Mirror the `?focus=invite` pattern from `TeamSettings.tsx:34-58` (added in commit `be1ef61`). This completes the cross-section deep-link wired by `pulse:settings-navigate` in `src/components/Settings.tsx` from commit `999c31d`.

### #42 — permissions catalog epic (multi-quarter)

The issue body decomposes into 7 sub-PRs. Phase 1 is the smallest and unblocks the rest:

1. Create `permissions(key, category, description)` catalog table
2. Create `workspace_roles(id, workspace_id, key, name, is_system, rank)` with `UNIQUE (workspace_id, key)`
3. Create `role_permissions(role_id, permission_key)` junction
4. Seed the 4 system roles (owner/admin/member/viewer) per existing workspace via a one-shot migration
5. NO code consumers yet — substrate only

The matrix at `src/components/settings/team/RolePermissionsMatrixCard.tsx:31-69` becomes a `useQuery(['role-permissions', workspaceId])` in a later phase. RLS migrations from `role IN ('owner','admin')` literals to `user_has_permission(...)` come in phases 3-4. Don't try to do those at the same time as the catalog tables.

## Operational quirks to know

- **Pre-existing CI is red** on `main` (Type Check + Tests + Security Audit) since at least 2026-05-10. All migration PRs in this revisal merged via `gh pr merge --admin --merge` (or `--squash`). It's not the audit work causing the red; treat as known background state. Could file a separate maintenance issue.
- **Service-role key:** the project's `SUPABASE_SERVICE_ROLE_KEY` env is the new `sb_secret_*` format (41 chars), not the legacy JWT. Edge functions that do their own bearer comparison reject the JWT with `403`. Vault rotation via `vault.update_secret(secret_id, new_secret)`. Memory reference: `[[reference_supabase_service_role_key]]`.
- **Cron job:** already scheduled. Don't re-schedule. The job references the Vault secret by **name** (not id) so rotation needs no cron edits.
- **TeamSettings.tsx working-tree state:** as of 2026-05-15, fully committed. No stray uncommitted hunks.
- **Migration tree drift:** at least one function (`bootstrap_workspace`) existed in `pg_proc` but not in any migration before #49 codified it. Worth a periodic schema-drift audit (compare `pg_proc` against the migration tree); could file as a small maintenance issue.

## How to start

1. `cd f:/pulse1 && git pull --ff-only` to make sure local main is current
2. Read the open issue you want to tackle:
   ```bash
   gh issue view <41|42> --json title,body
   ```
3. Pick the smallest cohesive sub-task; branch via:
   ```bash
   git checkout -b fix/<task-name>
   ```
4. Use Supabase MCP for prod migrations + probes. The probe pattern that worked across this revisal: wrap mutations in a `pg_temp` function that captures `sqlstate` inside a `BEGIN/EXCEPTION` block and `RETURN QUERY SELECT` — that way MCP returns the result as a row instead of swallowing `RAISE NOTICE` output. Example:

   ```sql
   CREATE OR REPLACE FUNCTION pg_temp.probe()
   RETURNS TABLE(test_case text, sqlstate text, message text)
   LANGUAGE plpgsql AS $fn$
   DECLARE v_sqlstate text; v_msg text;
   BEGIN
     BEGIN
       -- thing you want to test
     EXCEPTION WHEN OTHERS THEN
       GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
     END;
     RETURN QUERY SELECT 'name'::text, v_sqlstate, v_msg;
   END $fn$;
   SELECT * FROM pg_temp.probe();
   ```
5. Update the issue with a deployment-verified comment block following the existing pattern (see #38–#46 comments for the template)
6. Open PR via `gh pr create`; auto-close via `Closes #N` in the body. Use `gh pr merge --admin --merge` if CI is still red on `main`.

## Memory references that help

- `[[reference_pulse_supabase]]` — project ref + org
- `[[reference_supabase_service_role_key]]` — key format trap + Vault rotation
- `[[project_pulse_relay_workspace_consolidation]]` — bootstrap_workspace pattern (now fully codified via #49)
- `[[reference_pulse_design_tokens]]` — `--pulse-*` tokens, no raw hex
- `[[reference_impeccable_skill]]` — `/impeccable critique` skill for any UX work

## Don'ts

- Don't try to clear all remaining work in one PR. The pattern that worked across this revisal is one cohesive theme per PR, multi-commit where the steps tell a story, behavioural probes captured in the PR body, comment back on the issue with a verification table.
- Don't re-roll any of the already-shipped 8 migrations. They're idempotent in their own way, but re-applying mid-state could introduce regressions.
- Don't merge anything to `main` without the `--admin` flag right now — CI is red and won't go green this session. Treat the red as background state, not an audit-related signal.
- Don't try to use the legacy JWT format service-role key in Vault. The edge function will reject with 403 and you'll spend time diagnosing what's already documented in `[[reference_supabase_service_role_key]]`.

---

*Plan doc by the previous session. Tracked via /git-tracker.*
