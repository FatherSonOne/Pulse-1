# Pulse Users — Discovery Data Design

> Backend data-architecture spec for the **Find teammates on Pulse** feature. Owns the RPC contract, RLS reasoning, perf budgets, and Phase 2 schema drafts. Companion to accord's L0→L2 spec (`docs/pulse-users-discovery-spec.md`).
>
> **Authoring agent**: shard. **Date**: 2026-05-21. **Status**: Design pass; no migrations applied; drafts in `docs/drafts/`. No live SQL executed.

## 0. Position in the stack

This spec sits between accord's requirements and a future shipping migration. It locks in:

- The Phase 1 RPC **signature, return columns, and SECURITY DEFINER barrier** that the service layer (`pulseUserDiscoveryService.ts`) consumes.
- The **isolation model**: tenant boundary is `workspace_members`; the RPC's only external trust anchor is `auth.uid()` plus `public.user_has_workspace_access(p_workspace_id)`.
- The **draft Phase 2 schema additions**, which are gated and NOT to be applied until accord's Gate 1.5→2 criteria are met (`pulse-users-discovery-spec.md` § Phase gate criteria).

## 1. Tenant isolation model (recap)

Pulse is **row-level multi-tenant** with `workspaces.id` as the tenant key. Every per-tenant table carries `workspace_id` and is gated by RLS that delegates to `public.user_has_permission(workspace_id, '<key>')` (post 2026-05-21 sub-PR 4d). Membership-check primitives:

| Primitive | Source | Returns | When to use |
|---|---|---|---|
| `public.user_has_workspace_access(uuid)` | `20260522000001_permissions_retire_wm_helpers.sql` | bool — caller has `workspace.read` permission in `ws_id` | **Use this** for membership checks inside SECURITY DEFINER bodies. |
| `public.user_has_permission(uuid, text)` | permission catalog | bool — caller has named permission in `ws_id` | Use when a stricter capability is needed (e.g., `members.invite`). |
| ~~`wm_is_member` / `wm_is_admin`~~ | dropped 2026-05-22 | — | **Do not reintroduce.** Use `user_has_workspace_access` / `user_has_permission`. |

The `discover_pulse_users` RPC reuses `user_has_workspace_access(p_workspace_id)` — no new membership-check primitive. This is intentional: a single canonical check means a future permission rename or audit propagates here automatically.

## 2. SECURITY DEFINER barrier (critical — multi-tenant leak surface)

The RPC is owned by `postgres` and runs `SECURITY DEFINER`. Inside the function body, `postgres` has `BYPASSRLS`, so RLS is **not** enforced on the reads. This is intentional — `workspace_members`' SELECT policy joins `workspace_members` to evaluate, which would either recurse or require the same helper-bypass `get_enriched_workspace_members` already uses. The barrier is therefore not RLS but the **explicit guard at the function head**.

**Inside the SECURITY DEFINER body, the RPC SEES:**

| Table | Columns read | Why this is safe |
|---|---|---|
| `public.workspace_members` | `workspace_id, user_id, role` | Privileged; bounded to rows where `workspace_id = p_workspace_id` AND caller passed `user_has_workspace_access` guard. |
| `public.user_profiles` | `id, display_name, handle, avatar_url, online_status` | Privileged; only joined for users already in the bounded `workspace_members` set. **Never reads `role`, `status`, `phone`, `bio`, `settings`** — those are out of discovery scope. |
| `public.contacts` | `id, external_id, user_id, email` | Privileged BUT **filtered to `user_id = auth.uid()::text`** — the RPC only consults the caller's own contacts to compute the `already_in_contacts` flag. Reading another user's contacts would be a leak. |

**What callers DIRECTLY query (RLS applies):** Nothing in Phase 1. The service consumes only the RPC. There is no direct `select('id, display_name').from('user_profiles')` in the discovery flow — that would bypass the SECURITY DEFINER reasoning and re-expose `user_profiles` rows that may not belong to a shared workspace.

**Guard sequence inside the body (must run in this order):**

1. `IF auth.uid() IS NULL THEN RAISE 'unauthenticated' …` — reject anon callers.
2. `IF NOT public.user_has_workspace_access(p_workspace_id) THEN RAISE 'forbidden' …` — reject non-members.
3. **Only after both pass** does the body issue its SELECT.

Skipping (2) is the #1 multi-tenant leak vector in `SECURITY DEFINER` RPCs; the guard is mandatory, not advisory.

## 3. Phase 1 RPC contract

```sql
public.discover_pulse_users(
  p_workspace_id uuid,             -- required; the workspace being viewed
  p_query        text DEFAULT NULL, -- reserved; Phase 1 ignores (Phase 2 = handle lookup)
  p_limit        int  DEFAULT 50,  -- soft cap; hard ceiling 200
  p_cursor       text DEFAULT NULL  -- reserved; Phase 1 ignores
) RETURNS TABLE (
  user_id              uuid,
  display_name         text,
  handle               text,
  avatar_url           text,
  shared_workspace_id  uuid,
  shared_workspace_role text,
  online_status        text,
  already_in_contacts  boolean,
  joined_at            timestamptz
)
```

**Scoping rules (Phase 1, `current_workspace` semantics implicit):**

- Returns one row per `(workspace_id, user_id)` where:
  - `workspace_id = p_workspace_id`
  - `user_id <> auth.uid()` (exclude self)
- `already_in_contacts` is `TRUE` when an active `contacts` row exists with `user_id = auth.uid()::text` AND (`email` matches the candidate's `auth.users.email` OR `external_id = candidate.user_id::text`). **Phase 1 implementation reads `auth.users.email` inside the SECURITY DEFINER body** — safe because the read is bounded to the candidate set already gated by membership. The email is consumed only for the boolean — it is **not returned in the row payload**.
- Sort order: `workspace_role` rank (owner→admin→member→viewer) then `joined_at ASC` then `user_id ASC` for deterministic pagination.

**Cursor pagination scheme (reserved, not used in Phase 1):**

Cursor is an opaque base64-encoded `(joined_at_iso, user_id)` tuple. The RPC, when `p_cursor` is non-NULL, applies `(joined_at, user_id) > (cursor_joined_at, cursor_user_id)` as the keyset predicate. The signature reserves the param now so the Phase 1.5 upgrade is a no-op at the call-site. Phase 1 callers always pass `p_cursor => NULL`.

**Result caps:**

- `p_limit` clamped to `least(p_limit, 200)` server-side.
- If returned rows == 200, the service knows results are truncated and surfaces a "Show more" affordance (Phase 1.5 will wire real pagination).
- Default of 50 keeps the warm payload small for the median workspace (≤50 members per accord's perf budget § Phase 1 NFR).

**Perf budget (per accord § Phase 1 NFR, Phase 1.5 gate):**

- p95 warm latency ≤ 300ms at the largest live workspace (≥500 members).
- p99 result-set size ≤ 200 rows (enforced by clamp).
- Query plan must use the index on `workspace_members(workspace_id)` for the inner-scan; this index already exists (`idx_workspace_members_workspace_id`).

## 4. Index plan (handoff to a future `tuner` pass)

Phase 1 adds **no** new indexes — the workload is supported by existing indexes:

- `idx_workspace_members_workspace_id` — covers the inner scan.
- `user_profiles_pkey` (on `id`) — covers the join to `user_profiles`.
- `idx_contacts_email`, `idx_contacts_email_gin` — cover the `already_in_contacts` email match. The `external_id` path is uncovered today; if profiling shows the GIN scan is hot, recommend `CREATE INDEX idx_contacts_user_external ON contacts(user_id, external_id)`.

Phase 2 (handle-lookup) **does** need new indexes — see § 6 below — but those are part of the deferred migration, not Phase 1.

## 5. Phase 1.5 scope delta (cross-workspace within shared scope)

Phase 1.5 broadens the result set to "all workspaces the caller belongs to". The RPC signature is unchanged; what changes is the WHERE clause:

```sql
-- Phase 1 (current_workspace):
WHERE wm.workspace_id = p_workspace_id
  AND public.user_has_workspace_access(p_workspace_id)

-- Phase 1.5 (all_my_workspaces): p_workspace_id is interpreted as NULL→ALL
WHERE wm.workspace_id IN (
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
)
```

The signature already accommodates both via `p_workspace_id uuid` — pass a concrete id for Phase 1 behavior, pass `NULL` for Phase 1.5 behavior. The function body branches on `p_workspace_id IS NULL`.

Dedup matters in 1.5: a user who shares 3 workspaces with the caller should appear once. The natural fix is `SELECT DISTINCT ON (user_id) … ORDER BY user_id, role_rank` and pick the strongest-role row. This is a Phase 1.5 implementation concern, called out here so the Phase 1 RPC keeps a clean shape and 1.5 doesn't have to reshape it.

## 6. Phase 2 schema additions (DRAFT — gated)

Draft DDL lives at `docs/drafts/pulse_user_discovery_phase2_schema.sql`. Summary:

- **`user_profiles.is_discoverable_by_handle boolean NOT NULL DEFAULT false`** — opt-in toggle. Default OFF (privacy-respecting). The existing `prevent_user_profile_privesc` trigger does **not** gate this column; UPDATE is allowed only for `id = auth.uid()` per the `user_profiles_update_self` policy.
- **`user_profiles.public_handle text`** — already exists as `handle`. **No new column** — accord's spec calls this "public_handle"; the existing `handle` is unique and validated by the `valid_handle` CHECK constraint. The Phase 2 opt-in semantics layer onto the existing column.
- **`public.pulse_user_discovery_blocks(blocker_id uuid, blocked_id uuid, created_at timestamptz)`** — abuse lever. `(blocker_id, blocked_id)` composite PK; FK to `auth.users(id)` on both sides with `ON DELETE CASCADE`; index on `(blocked_id, blocker_id)` for the reverse-lookup the RPC does at every handle search.

## 7. Phase 2 abuse-vector matrix (enumeration prevention)

| Vector | Defense |
|---|---|
| **Prefix / LIKE enumeration** | RPC accepts only `p_query` for exact case-insensitive match: `lower(handle) = lower(p_query)`. No `LIKE`, no `ILIKE`, no trigram. Server enforces `length(p_query) BETWEEN 3 AND 30`. |
| **Autocomplete oracle** | No autocomplete endpoint exists. The service layer has no `searchHandles(prefix)` method. Phase 2 only ships `findByHandle(handle)` with exact-match semantics. |
| **Distinguishable miss reasons** | All four cases — typo, opted-out, blocked, non-existent — return the **same** `null` row (or empty result set). No error codes that distinguish "exists but private" from "does not exist". |
| **Timing oracle** | Function uses a constant-time predicate `lower(handle) = lower(p_query)` against an index; the diff between miss and hit is sub-ms. Combined with rate limiting, this is below the practical exploitability threshold. Document; do not paper over with `pg_sleep`. |
| **Rate limit** | Per-caller token bucket: 30 lookups per 5min, enforced via a `pulse_user_lookup_audit(caller_id, called_at)` table with a partial index and a function-side window-count check. Soft-fail (return null) on quota exhaustion — never tell the caller they hit a limit. (Alt: Redis-backed limit at the edge function; chosen impl deferred to Phase 2 implementation PR.) |
| **Block-list** | At RPC entry, `IF EXISTS (SELECT 1 FROM pulse_user_discovery_blocks WHERE blocker_id = candidate.id AND blocked_id = auth.uid())` → return null. Indistinguishable from no-match. |
| **Opt-in default** | `is_discoverable_by_handle` defaults `false`. No backfill — every existing user is OFF until they opt in. |
| **Fuzzy / "did you mean"** | Explicitly forbidden. The Phase 2 RPC must not call any string-similarity function (`similarity`, `levenshtein`, etc.) on `handle`. |
| **Identity confirmation via avatar / display_name** | Phase 2 returns the minimum payload: `user_id`, `display_name`, `handle`, `avatar_url`. No email, no role, no workspace context. The caller learns "this handle resolves to a person" — they must already know enough about that person to want to add them. |

## 8. Illustrative service signature (no implementation here)

```ts
// src/services/pulseUserDiscoveryService.ts — IMPLEMENTATION OUT OF SCOPE FOR shard
export interface DiscoverablePulseUser {
  userId: string; displayName: string; handle: string | null;
  avatarUrl: string | null; sharedWorkspaceId: string;
  sharedWorkspaceRole: 'owner'|'admin'|'member'|'viewer';
  onlineStatus: 'online'|'offline'|'away'|'busy'; alreadyInContacts: boolean;
}
export const pulseUserDiscoveryService = {
  listInCurrentWorkspace(workspaceId: string, opts?: { limit?: number; cursor?: string | null }): Promise<DiscoverablePulseUser[]>,
  // Phase 1.5+:  listAcrossMyWorkspaces(opts?)
  // Phase 2+:    findByHandle(handle)
};
```

The service is a thin RPC wrapper. No business logic, no client-side enumeration assist.

## 9. Open questions for accord / user

- **`already_in_contacts` matching key**: email vs `external_id`. Phase 1 uses both; if a future Pulse-native contact source emerges, the match key needs revisiting. Acceptable risk for Phase 1.
- **`email` in the return payload**: omitted in this design (UX spec doesn't need it). If palette's mockups want a contact-card preview that shows a workspace-mate's email, add it as an additive column.
- **Rate-limit storage for Phase 2**: SQL table vs Redis. SQL is simpler; Redis is more accurate at high QPS. Defer to Phase 2 implementation PR.
- **Cross-app discovery (Entomate, Logos Vision)**: accord flagged this. Out of Phase 1 scope. Phase 2's handle-lookup is the natural extension point but requires coordination across `user_profiles` semantics across apps.
