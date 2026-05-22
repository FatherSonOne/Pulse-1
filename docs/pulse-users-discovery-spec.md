# Pulse Users — Discovery Spec (L0 → L1 → L2)

> Unified spec for the "Find teammates on Pulse" feature — a third path inside the Add-Contact chooser that surfaces other Pulse users (in-workspace first, cross-org later) as discoverable contacts.
> **Scope mode**: Standard (3 phased capabilities × 3 audience lanes; upstream of implementation; no L3).
> **Authoring agent**: accord. **Date**: 2026-05-21. **Status**: Discovery; awaits palette UX direction and shard schema/RLS detailing.
> **Inputs**: User screenshot of the Add-Contact chooser; existing tile-picker at `src/components/contacts/ContactsRedesigned.tsx` (lines 1679–1770); workspace_members + user_profiles substrate; memory notes `project_pulse_relay_workspace_consolidation`, `project_pulse_relay_workspace_rls`, `reference_pulse_design_tokens`.

---

## L0 — Vision

Today, Pulse onboarding ends at a two-tile fork: **Import from Google** (shipped e2e) or **Add manually**. Neither path acknowledges that *other Pulse users already exist in the viewer's own workspace*. A new operator joining a team workspace sees a literally empty contact list and is asked to re-enter people whom Pulse already authoritatively knows about. The result is duplication, cold-start friction, and a missed signal that Pulse is a network — not a personal address book.

**Desired end state.** The Add-Contact chooser becomes a three-tile picker. The new prominent tile — **"Find teammates on Pulse"** — surfaces every other Pulse user in the viewer's workspace(s) as one-tap-add discoverable contacts. The same surface is the foundation for two later phases: (1.5) cross-workspace discovery when the viewer and a Pulse user share *any* workspace, and (2) opt-in cross-org discovery for handles outside any shared workspace. Phase 1 is unblockable today — every required table, RPC pattern, and RLS primitive already exists. Phases 1.5 and 2 are explicitly gated and out of Phase 1's blast radius.

---

## L1 — Requirements

### C1 — Org-Internal Discovery (Phase 1, NOW)

The viewer can open the new tile and see a deduplicated list of every other Pulse user who shares at least one workspace with them via `workspace_members`. Each row shows display name, handle (if set), avatar, role label in the shared workspace, and a single primary action ("Add to my contacts"). Users already present in the viewer's `contacts` table appear as *Added* (action disabled, no second insert). Empty result (solo workspace) renders a non-blocking zero-state inviting the user to invite teammates. **Required.** No new tables. One new RPC. Reuses `workspace_members` RLS (memory: `project_pulse_relay_workspace_rls`).

### C2 — Cross-Workspace Discovery within shared scopes (Phase 1.5)

The same surface gains a scope toggle: *This workspace* (default) → *All workspaces I'm in*. C2 broadens the result set to the union of every Pulse user across every workspace the viewer is a member of, still gated through `workspace_members`-derived visibility. This is the natural extension of C1: same SQL, broader `workspace_id IN (...)` filter, same RLS primitives. Required outcome: a viewer who belongs to 3 workspaces sees teammates from all 3 without leaving the modal. **Should.** Ships after Phase 1 telemetry confirms result-set size remains bounded and the perf budget holds.

### C3 — Cross-Org Public Discovery (Phase 2, LATER — gated)

When the viewer wants to add a Pulse user who shares *no* workspace with them, the surface offers a search-by-exact-handle path (e.g. "@maya-chen"). **Enumeration is forbidden** — there is no browse, no prefix-match below 3 chars, no listing API that returns ≥1 row without a complete handle. Each target user controls their own discoverability via opt-in fields on `user_profiles` (default OFF). A target user who has opted out is unreachable via C3 regardless of handle correctness — the endpoint returns "no match" indistinguishably from a typo. **Could.** Gated behind Phase 2 entry criteria below; not in scope for the current PR chain.

### Non-functional / cross-functional requirements (apply to all phases)

- **Privacy default**: discoverability outside the viewer's workspace set is **opt-out by default** (i.e. C1 and C2 surface every workspace-mate; C3 requires explicit opt-in on the target).
- **Coral budget**: this is a discovery surface, not an AI-output surface — `--pulse-coral*` tokens are forbidden here (memory: `reference_pulse_design_tokens`).
- **Performance**: Phase 1 RPC returns ≤200 rows uncapped (workspaces above 200 paginate); 95p latency ≤300ms warm.
- **No client-side enumeration**: C3 search runs server-side only; the client cannot iterate handles via a `LIKE 'a%'` fan-out.

---

## L2 — Team Detail

### L2 — Backend / Data lane

**Target tables (existing, no Phase 1 schema migration):**
- `public.user_profiles` — has `id`, `handle`, `display_name`, `full_name`, `avatar_url`, `bio`, `is_verified`, `online_status`, `last_active_at`. Already locked down by the `prevent_user_profile_privesc` trigger (2026-05-03) — Phase 2 opt-in fields will piggyback on the existing UPDATE path.
- `public.workspace_members` — RLS post-2026-05-21 routes through `user_has_permission(workspace_id, 'members.read')`. Phase 1 SELECT visibility is bounded by this policy; the new RPC must be `SECURITY DEFINER` to avoid the join-recursion trap that `get_enriched_workspace_members` already solves.
- `public.contacts` — left-joined to determine *Added* state per row.

**New RPC family** (Phase 1 ships only `scope='current_workspace'`):

```sql
-- Illustrative only; shard owns the final signature.
CREATE FUNCTION public.discover_pulse_users(
  p_scope        TEXT,    -- 'current_workspace' | 'all_my_workspaces' | 'handle_lookup'
  p_workspace_id UUID,    -- required when scope='current_workspace'
  p_query        TEXT,    -- required when scope='handle_lookup' (exact match)
  p_limit        INT
) RETURNS TABLE (
  user_id UUID, display_name TEXT, handle TEXT, avatar_url TEXT,
  shared_workspace_id UUID, shared_workspace_role TEXT,
  already_in_contacts BOOLEAN
) SECURITY DEFINER ...
```

**RLS scoping per phase:**
- C1/C2: function-internal check that `auth.uid()` is a member of every `workspace_id` it queries; exclude `auth.uid()` from the result set; exclude users already in the viewer's `contacts`.
- C3: function-internal check that *target* user's `user_profiles.is_discoverable_by_handle = true` AND that `p_query` exact-matches their handle (case-insensitive, length ≥3). Rate-limited per caller.

**Phase 2 schema additions** (deferred, shard to draft a separate migration spec):
- `user_profiles.is_discoverable_by_handle BOOLEAN NOT NULL DEFAULT false`
- `user_profiles.discoverable_fields JSONB` (per-field opt-in: handle, display_name, avatar_url only)
- New table `pulse_user_discovery_blocks` (target_user_id, blocked_caller_id, blocked_at) — abuse lever.

### L2 — Service / API lane

**New file**: `src/services/pulseUserDiscoveryService.ts`. Rationale: keeps discovery semantics out of `pulseService.ts` (which is the relay/message surface) and out of `teamService.ts` (which is workspace-admin-centric). The discovery service consumes the new RPC and shapes results for the UI.

Illustrative shape:

```ts
export interface DiscoverablePulseUser {
  userId: string; displayName: string; handle: string | null;
  avatarUrl: string | null; sharedWorkspaceId: string;
  sharedWorkspaceRole: 'owner'|'admin'|'member'|'viewer';
  alreadyInContacts: boolean;
}
export const pulseUserDiscoveryService = {
  listInCurrentWorkspace(workspaceId: string, limit?: number): Promise<DiscoverablePulseUser[]>,
  listAcrossMyWorkspaces(limit?: number): Promise<DiscoverablePulseUser[]>,         // Phase 1.5
  findByHandle(handle: string): Promise<DiscoverablePulseUser | null>,               // Phase 2
  addAsContact(userId: string): Promise<Contact>,                                     // shared
};
```

**Pagination**: cursor-based (`joined_at` + `user_id`) once results exceed the 200-row uncapped budget; not required at Phase 1 launch but the RPC signature must reserve the cursor params.

**Abuse / rate-limit (Phase 2 only)**: `findByHandle` is gated by a per-caller token bucket (e.g. 30 lookups / 5min) enforced server-side; failures return a uniform "no match" response indistinguishable from a real miss.

### L2 — UX / Discovery surface lane

**Insertion point**: the `showAddChooser` block inside `ContactsRedesigned.tsx` (lines 1679–1770). The current two-tile picker becomes a three-tile picker with the new tile rendered **first** (top) so it earns the primary affordance — onboarding bias should favor the network, not the import.

**Tile copy direction** (defer microcopy authorship to prose / palette):
- Title: surfaces "teammates on Pulse" framing.
- Subtitle: makes the org-internal scope explicit ("Already in your workspace.").
- Right-side cue: live count of discoverable users when ≥1 (e.g. "4 ready").

**Inner surface** (opened by tile tap): a sheet listing rows. Three states palette must design:
1. **Loaded**: list of rows, each with avatar + name + handle + workspace-role pill + primary "Add" / disabled "Added" action. Multi-select with bulk "Add 3 contacts" footer is in scope for Phase 1.
2. **Zero-state (solo workspace, no teammates found)**: friendly empty state with one secondary CTA to "Invite a teammate" routing to existing workspace-invite flow. NOT an error.
3. **Empty after filter (Phase 1.5 only)**: same shell, different copy. Phase 2 search-no-match state is a distinct fourth design problem owned by Phase 2.

**Token consumption (canonical, no local color)**:
- Tile background `var(--pulse-canvas)`, border `var(--pulse-border)`, hover `var(--pulse-rose-soft)` border (matches the existing two tiles' hover pattern, lines 1719–1741).
- Icon background tile: `var(--pulse-tone-info-soft)` with icon `var(--pulse-tone-info)` — a *different* slot than the rose-soft Google tile so the three tiles are visually distinct. (Alternative: `--pulse-tone-success-soft` if info reads too similar to "manual". Palette decides.)
- **No coral.** Reserved for AI-output only.

---

## Phase gate criteria

### Gate from Phase 1 → Phase 1.5 (C1 → C2)

- Phase 1 RPC has been in prod ≥2 weeks with no RLS regressions surfaced by Supabase advisors.
- Telemetry shows median result-set size ≤50 rows; 99p ≤200 rows.
- The "already in contacts" left-join performs within budget on the largest live workspace (≥500 members).
- UX confirms the toggle copy is non-confusing in qualitative testing (echo or plea pass acceptable).

### Gate from Phase 1.5 → Phase 2 (C2 → C3)

- `user_profiles.is_discoverable_by_handle` column shipped, default `false`, surfaced in a Settings opt-in UI; ≥1 week of opt-in telemetry before C3 endpoint goes live.
- Abuse plumbing in place: per-caller rate limit on `findByHandle`; `pulse_user_discovery_blocks` table + UI to add a block; uniform "no match" responses verified (no timing leak distinguishing opted-out from typo).
- Audit: no enumeration vector ships (no LIKE prefix, no autocomplete API, no "did you mean" suggestions, no fuzzy match below exact-handle).
- Legal sign-off on the privacy posture for cross-org user-locatable data (cloak skill review or equivalent).
- Cross-org block-list UX shipped before any user can be discovered via C3.

---

## Open questions for user

- **Tile precedence**: should "Find teammates on Pulse" sit *above* "Import from Google", or *below* it? Above gives Pulse-native discovery the primary affordance; below preserves muscle memory for users who've used the current chooser. Default proposal: above.
- **Multi-select in Phase 1?** This spec assumes yes (bulk-add N teammates in one tap). Confirm or cut to single-add MVP.
- **Workspace-role pill copy**: surface the role explicitly ("Admin", "Member") or stay role-agnostic in the discovery list? Surfacing role is informative but may invite questions about why a viewer can see role data that the existing Team Settings already exposes.
- **Zero-state CTA**: "Invite a teammate" routes to the existing workspace-invite flow — is that desired, or should the zero state be a quieter "When teammates join, they'll show up here" without a CTA?
- **Phase 2 handle namespace**: handles are already unique in `user_profiles`. Should Phase 2 search be `@handle` (Twitter-style, requires `@`) or bare-handle? Bare-handle is friendlier; `@`-prefixed is more obviously a "handle lookup" and rules out accidental free-text searches that would tempt us toward enumeration.
- **Cross-app discovery (Entomate, Logos Vision)**: in scope at all? Memory shows shared `user_profiles` across the QntmEcos ecosystem. If a Pulse user is also an Entomate user but shares no Pulse workspace, do we treat them as discoverable via C1/C2 or only C3? Default proposal: C3 only — discovery is workspace-scoped per app.

---

## Cross-spec references

- **Substrate**: `project_pulse_relay_workspace_consolidation` (canonical `workspace_members`), `project_pulse_relay_workspace_rls` (live RLS shape — query `pg_policy` via MCP before writing schema changes), `reference_pulse_design_tokens` (token consumption rule).
- **Pattern**: `supabase/migrations/20260406000001_enriched_workspace_members_rpc.sql` (SECURITY DEFINER RPC that joins workspace_members + user_profiles + auth.users without RLS recursion — the exact pattern shard should clone).
- **Touchpoint**: `src/components/contacts/ContactsRedesigned.tsx` lines 1679–1770 (the existing two-tile chooser — extension point for the third tile).
