/impeccable critique

# AUDIT TARGET
The Pulse "Team Management" surface — both the UI a workspace owner sees at
Settings → Team and the entire backend membership/permissions stack that
powers it. Treat this as a security-and-UX dual review, because team mgmt
is where multi-tenant SaaS fails most often (misconfigured RLS, privilege
escalation, mis-prorated seats, ghost members) AND where a confused owner
costs you signups.

# SURFACE AREA

## Frontend (rendered in screenshot)
  - src/components/settings/TeamSettings.tsx  (372 lines)
    - Invite New Member form (single email + role)
    - Workspace Members list with role chip
    - Pending Invites list (resend/revoke)
  - src/components/settings/team/BulkInviteCard.tsx  (205 lines)
    - Paste "email,role" lines
  - src/components/settings/team/GroupsManagementCard.tsx  (468 lines)
    - Groups & Departments — create, edit, color, assign members
  - src/components/settings/team/RolePermissionsMatrixCard.tsx  (194 lines)
    - Read-only role × permission matrix (no custom roles yet)
  - Owner-only "Transfer ownership" / member removal lives in
    WorkspaceSettings.tsx, not Team — note that split.

## Service layer
  - src/services/workspaceService.ts methods to scrutinize:
      inviteMember          (with "refresh existing invite" branch)
      acceptInvite          (token-based, calls SECURITY DEFINER RPC)
      updateMemberRole
      removeMember          (fires billingService.syncSeats after)
      getPendingInvites
      getMembers            (calls get_enriched_workspace_members RPC)
      transferOwnership
      createGroup / updateGroup / addGroupMember / removeGroupMember

## Backend (Supabase Postgres)
  - supabase/migrations/20260226000003_workspace_members.sql
    Base table + initial RLS
  - supabase/migrations/20260226000004_fix_workspace_rls_recursion.sql
    SECURITY DEFINER helpers (wm_is_member) — fixed an HTTP 500
    infinite-recursion bug; trust this pattern but verify it.
  - supabase/migrations/20260226000006_invite_accept_rpc.sql
    accept_workspace_invite (SECURITY DEFINER, bypasses RLS to insert
    membership row at acceptance time).
  - supabase/migrations/20260406000001_enriched_workspace_members_rpc.sql
    Joins auth.users / user_profiles into one shape for the UI.
  - supabase/migrations/20260426000002_workspace_groups.sql
    workspace_groups + workspace_group_members tables.
  - supabase/migrations/20260309000115_cleanup_consolidate_invites.sql
    Note: invites have been consolidated/migrated — check that the
    schema-the-code-expects matches the schema-that-exists.

## Adjacent concerns
  - Seat billing — every membership mutation should round-trip
    billingService.syncSeats(workspace_id). Verify it does, and that
    Stripe quantity matches active-member count exactly (including
    pending invites? excluded? clarify).
  - Auto-join domain (WorkspaceSettings.tsx) silently adds members.
    Where does its seat-impact land?

# CRITIQUE ACROSS THESE DIMENSIONS

Score each 0–10 with concrete file:line citations. No generic praise; if
something is fine, say "fine, score 7, here's the one thing I'd raise."

## A. Security & permission integrity (the most important)
  1. RLS coverage — is there a code path (a non-SECURITY DEFINER query,
     or an RPC that forgot to re-check membership) where a user could
     read members/invites/groups of a workspace they don't belong to?
  2. Privilege escalation — can a 'member' or 'viewer' role somehow
     elevate themselves to admin/owner via the invite flow, role
     update, or group assignment? Walk through updateMemberRole
     (workspaceService.ts:680) — is the "only admin/owner can do this"
     check on the client only, on the DB, or both?
  3. Invite token security — accept_workspace_invite consumes a token.
     Is the token cryptographically random, length-checked, single-use,
     and expired on use? What stops invite-spraying or replay?
  4. Owner removal / orphaning — can the last owner leave/be removed,
     stranding the workspace? Is there a guard preventing zero-owner
     state in BOTH the trigger and the application layer?
  5. transferOwnership atomicity — is the change of owner_id and the
     role-flips on workspace_members a single transaction? What
     happens on partial failure?
  6. Bulk invite — does it validate role values server-side, or does
     the server trust whatever string the client paste-parsed
     (e.g. "viewer\nrm -rf, admin")?

## B. Seat billing correctness
  1. Walk the four mutation paths (invite accept, member remove, role
     change that doesn't change seat count, auto-join domain
     enrollment) and confirm Stripe quantity stays in sync.
  2. What about pending invites? Should outstanding invites count
     against seat caps to prevent over-provisioning? Today, do they?
  3. Race: two admins remove the same member at the same instant —
     do we end up calling syncSeats(N-1) twice or N-2 once?

## C. UX of the page itself (screenshot reality check)
  1. Information density and hierarchy — Invite, Bulk Invite, Members,
     Groups, Permissions. Is the order right? Is "1 / 50 members
     (Free plan)" the right place to surface plan caps, or should the
     plan badge be more prominent?
  2. Empty states — "No groups yet" is plain text. Compared to Linear's
     empty-state-as-CTA pattern, does this earn its space or feel
     unfinished? Same question for an empty pending-invites list.
  3. Bulk Invite UX — paste CSV is engineer-friendly, not human-
     friendly. Does it support contacts picker? Google Workspace
     directory? Drag-drop of a .csv? Or only paste-text?
  4. Role selection — three-role dropdown buried next to email
     input. Is the difference between Member / Admin / Viewer
     explained anywhere AT the moment of selection, or do you have to
     scroll to "Role Permissions" to learn what you just granted?
  5. Groups feature — is it complete (CRUD, membership, color, used
     anywhere in routing / mentions / permissions), or stranded
     vanity feature with no read-side consumer? Find every callsite
     of getGroups/getGroupMembers and report.
  6. Member row — owner of the workspace appears with just a chip;
     no actions visible (transfer, remove, change role). Where do
     those live and are they discoverable? Note the inconsistency
     that ownership-transfer lives in WorkspaceSettings, not Team.

## D. Error surface & failure modes
  1. inviteMember has a "refresh existing invite" branch — verify
     it can't be abused (resend-spam, token regeneration that
     invalidates a real user mid-flow).
  2. Invite email delivery is checked (emailDelivery.reason) but
     what's the UX when delivery fails? Is the "copy this link"
     fallback obvious or buried?
  3. acceptInvite seat-sync is wrapped in try/swallow with a
     console.warn (line ~662). Is that the right blast radius — or
     do we now allow a paid Stripe customer to accumulate
     un-synced seats?
  4. Removing yourself vs. removing someone else — different copy?
     Different confirmations? Or one-size-fits-all destructive
     dialog?

## E. Architectural clarity
  1. Owner / admin / member / viewer is a 4-tier enum. The
     RolePermissionsMatrixCard says "Custom roles aren't supported
     yet." Is the codebase architecturally READY for custom roles,
     or is it a tangle of hardcoded `role === 'admin'` checks?
     Grep and report.
  2. workspace_members vs. groups vs. role_permissions — three
     concepts. Are they orthogonal and composable, or does role
     leak into group semantics anywhere?
  3. parent_workspace_id / child workspaces (20260427000002 migration)
     — do team membership and roles INHERIT from parent? Is that
     intended? Is it implemented?

## F. Multi-workspace edge cases
  1. The screenshot shows a 1-member workspace called "My Workspace".
     Same user owns 7+ workspaces (we saw this in billing audit).
     Does Team Management get confused when current_workspace
     switches mid-action (e.g. mid-invite)?
  2. A user invited to TWO workspaces with the SAME email — what
     happens? Two pending invites? One? Last-write-wins?

# DELIVERABLE

For each dimension A–F:
  - Score 0–10 + one-line verdict
  - 3-5 file:line citations as evidence
  - The highest-leverage fix

Then:
  - **3 fixes I'd ship this week** (effort estimate per fix)
  - **3 hidden security/billing bugs I bet exist** — concrete enough that
    a reviewer can either disprove them or write a failing test
  - **1 architectural change worth the upgrade** — what should
    workspace_members look like in 12 months, and why is today's shape
    going to constrain you?

No platitudes. Assume the reader will compare this to Linear's
workspace.permissions and Slack's user-groups + custom-role enterprise grid,
and conclude Pulse is significantly behind.