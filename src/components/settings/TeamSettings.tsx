import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspaceData, useWorkspaceActions, useWorkspacePermissions, useWorkspaceMutationLock } from '../../contexts/WorkspaceContext';
import { workspaceService, WorkspaceMember, WorkspaceInvite, WORKSPACE_PLAN_LABELS, WORKSPACE_PLAN_LIMITS } from '../../services/workspaceService';
import { Mail, Users, UserMinus, ChevronDown, Clock, X, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { InviteCard } from './team/InviteCard';
import { GroupsManagementCard } from './team/GroupsManagementCard';
import { RolePermissionsMatrixCard } from './team/RolePermissionsMatrixCard';
import { ConfirmActionDialog } from './team/ConfirmActionDialog';
import { SeatMeter } from './team/SeatMeter';
import { SettingsCard } from './shared/SettingsCard';
import { MonoLabel } from './shared/MonoLabel';
import { useFeatureFlag } from '../../lib/featureFlags';

interface TeamSettingsProps {
  userId: string;
  userName?: string;
}

export const TeamSettings: React.FC<TeamSettingsProps> = ({ userId }) => {
  const { currentWorkspace, members } = useWorkspaceData();
  const { refreshMembers } = useWorkspaceActions();
  const { isOwner, isAdmin, canManageMembers } = useWorkspacePermissions();
  const { acquireMutationLock } = useWorkspaceMutationLock();
  // Groups card is gated behind a flag until #42 phase 5 lands a real read
  // consumer (group_grants → mentions / routing / channel ACL). Dev override:
  // ?ff_workspaceGroups=on (also persists to localStorage for that browser).
  const showGroups = useFeatureFlag('workspaceGroups', userId);

  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  // Which pending-invite row was just copied? Drives the 1.5s Check icon.
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Two-step confirmation for destructive actions (member remove / invite
  // revoke). Replaces native confirm() with a role-aware dialog so the user
  // gets the differentiated copy DESIGN.md asks for.
  type PendingConfirm =
    | { kind: 'remove'; member: WorkspaceMember }
    | { kind: 'revoke'; invite: WorkspaceInvite }
    | null;
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Deep-link focus (?focus=invite) — scroll + highlight the invite form
  // and put the cursor in the email field.
  const inviteCardRef = useRef<HTMLDivElement>(null);
  const inviteEmailInputRef = useRef<HTMLInputElement>(null);
  const [inviteFocused, setInviteFocused] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('focus') !== 'invite') return;

    setInviteFocused(true);
    const scrollT = setTimeout(() => {
      inviteCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => inviteEmailInputRef.current?.focus(), 400);
    }, 50);
    const fadeT = setTimeout(() => setInviteFocused(false), 3000);

    params.delete('focus');
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`,
    );

    return () => { clearTimeout(scrollT); clearTimeout(fadeT); };
  }, []);

  const workspaceId = currentWorkspace?.id;
  const plan = currentWorkspace?.plan ?? 'free';
  const memberLimit = WORKSPACE_PLAN_LIMITS[plan] ?? 50;

  const loadInvites = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoadingInvites(true);
    try {
      const invites = await workspaceService.getPendingInvites(workspaceId);
      setPendingInvites(invites);
    } catch {
      // non-fatal
    } finally {
      setIsLoadingInvites(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleRoleChange = async (member: WorkspaceMember, newRole: 'admin' | 'member' | 'viewer') => {
    // F1: capture workspaceId at mutation start so a workspace switch
    // mid-flight can't redirect the await into a different workspace's
    // context. acquireMutationLock disables the workspace switcher until
    // release() fires.
    const wsId = workspaceId;
    if (!wsId) return;
    const release = acquireMutationLock();
    try {
      await workspaceService.updateMemberRole(wsId, member.user_id, newRole);
      toast.success(`Updated ${member.name || 'member'} to ${newRole}`);
      await refreshMembers();
    } catch {
      toast.error('Failed to update role');
    } finally {
      release();
      setRoleDropdownOpen(null);
    }
  };

  // Triggers — open the confirm dialog with the right target. Execution
  // happens in handleConfirmPending below once the user clicks through.
  const handleRemoveMember = (member: WorkspaceMember) => {
    if (!workspaceId) return;
    setPendingConfirm({ kind: 'remove', member });
  };

  const handleCopyInviteLink = async (invite: WorkspaceInvite) => {
    const url = workspaceService.getInviteLink(invite.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteId(invite.id);
      toast.success('Invite link copied');
      setTimeout(() => setCopiedInviteId((prev) => (prev === invite.id ? null : prev)), 1500);
    } catch {
      toast.error('Could not copy. Long-press to copy manually:');
      // Some browsers block clipboard on insecure contexts. Show the URL inline
      // via a second toast so the user can still grab it.
      toast(url, { duration: 8000 });
    }
  };

  const handleRevokeInvite = (invite: WorkspaceInvite) => {
    setPendingConfirm({ kind: 'revoke', invite });
  };

  const handleConfirmPending = async () => {
    if (!pendingConfirm) return;
    // F1: capture workspaceId + acquire lock for the duration of the
    // mutation. Both remove and revoke paths are workspace-scoped (the
    // revoke RLS check qualifies workspace_id even though we delete by
    // invite.id), so switching workspaces mid-await would still race.
    const wsId = workspaceId;
    if (!wsId) {
      setPendingConfirm(null);
      return;
    }
    const release = acquireMutationLock();
    setIsConfirming(true);
    try {
      if (pendingConfirm.kind === 'remove') {
        await workspaceService.removeMember(wsId, pendingConfirm.member.user_id);
        toast.success('Member removed');
        await refreshMembers();
      } else {
        const { error } = await (await import('../../services/supabase')).supabase
          .from('workspace_invites')
          .delete()
          .eq('id', pendingConfirm.invite.id);
        if (error) throw error;
        toast.success('Invite revoked');
        await loadInvites();
      }
      setPendingConfirm(null);
    } catch {
      toast.error(pendingConfirm.kind === 'remove' ? 'Failed to remove member' : 'Failed to revoke invite');
    } finally {
      setIsConfirming(false);
      release();
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="p-8 text-center text-zinc-500 text-sm">
        No workspace selected.
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    owner: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
    admin: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    member: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
    viewer: 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400',
  };

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="section-header">
        <h3><Users /> Team Management</h3>
        <p>
          Manage members and invitations for <strong>{currentWorkspace.name}</strong>.
        </p>
        <SeatMeter
          used={members.length}
          limit={memberLimit}
          planLabel={WORKSPACE_PLAN_LABELS[plan]}
          canUpgrade={isOwner || isAdmin}
        />
      </div>

      {/* Current Members — promoted above Invite by daily-task-priority
          (audit #41 C6-promote: by day 2 of any workspace, roster management
          is the dominant task; cold-open invite UX moves below). */}
      <SettingsCard padded={false} className="overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <MonoLabel>
            Workspace Members ({members.length})
          </MonoLabel>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {members.map((member) => {
            const displayName = member.name || member.email || 'Unknown';
            const isCurrentUser = member.user_id === userId;
            const isMemberOwner = member.role === 'owner';

            return (
              <div key={member.user_id} className="p-4 flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center text-rose-500 dark:text-rose-400 font-semibold overflow-hidden flex-shrink-0">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold dark:text-white text-zinc-900 truncate">
                    {displayName} {isCurrentUser && <span className="text-zinc-400 font-normal">(You)</span>}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {member.handle ? `@${member.handle}` : member.email || ''}
                  </p>
                </div>

                {/* Role badge / dropdown */}
                <div className="relative">
                  {canManageMembers && !isMemberOwner && !isCurrentUser ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setRoleDropdownOpen(roleDropdownOpen === member.user_id ? null : member.user_id)}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium flex items-center gap-1 ${roleColors[member.role]}`}
                      >
                        {member.role}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {roleDropdownOpen === member.user_id && (
                        <div className="absolute right-0 top-8 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[120px]">
                          {(['admin', 'member', 'viewer'] as const).map((r) => (
                            <button
                              type="button"
                              key={r}
                              onClick={() => handleRoleChange(member, r)}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                                member.role === r ? 'font-bold text-rose-500' : 'dark:text-zinc-300 text-zinc-700'
                              }`}
                            >
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${roleColors[member.role]}`}>
                        {member.role}
                      </span>
                      {/* Surface "Transfer ownership" on the owner's own row.
                          Without this hint, an owner who wants to leave has
                          to discover that (a) they can't remove themselves
                          from Team, (b) ownership transfer lives in Workspace
                          settings. Fires a custom event the Settings shell
                          listens for. */}
                      {isMemberOwner && isCurrentUser && isOwner && (
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(
                            new CustomEvent('pulse:settings-navigate', {
                              detail: { section: 'workspace', focus: 'transfer' },
                            }),
                          )}
                          className="text-xs font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300"
                          aria-label="Transfer ownership in Workspace settings"
                        >
                          Transfer →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Remove button — admin+ can remove non-owners, can't remove self */}
                {canManageMembers && !isMemberOwner && !isCurrentUser && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 transition"
                    title="Remove member"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
          {members.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-sm">Loading members...</div>
          )}
        </div>
      </SettingsCard>

      {/* Invite — admin+ only. Single card with a "Paste many" toggle that
          swaps between single-email and CSV-paste modes. Replaces the
          previous inline single-invite + separate BulkInviteCard combo
          (audit #41 C3-merge). */}
      {canManageMembers && workspaceId && (
        <InviteCard
          workspaceId={workspaceId}
          workspaceName={currentWorkspace.name}
          onInvitesSent={loadInvites}
          isFocused={inviteFocused}
          cardRef={inviteCardRef}
          emailInputRef={inviteEmailInputRef}
        />
      )}

      {/* Pending Invitations — admin+ only */}
      {canManageMembers && pendingInvites.length > 0 && (
        <SettingsCard padded={false} className="overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
            <MonoLabel className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              Pending Invitations ({pendingInvites.length})
            </MonoLabel>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium dark:text-white text-zinc-900">{invite.email}</p>
                    <p className="text-xs text-zinc-500">
                      {invite.role} &middot; expires {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1"
                    onClick={() => handleCopyInviteLink(invite)}
                    aria-label={`Copy invite link for ${invite.email}`}
                  >
                    {copiedInviteId === invite.id
                      ? <><Check className="w-3 h-3" /> Copied</>
                      : <><Copy className="w-3 h-3" /> Copy link</>}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1"
                    onClick={() => handleRevokeInvite(invite)}
                    aria-label={`Revoke invite for ${invite.email}`}
                  >
                    <X className="w-3 h-3" /> Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
      )}

      {/* Groups & departments — see showGroups flag declaration above. */}
      {workspaceId && showGroups && (
        <GroupsManagementCard
          workspaceId={workspaceId}
          members={members}
          isAdmin={isAdmin}
        />
      )}

      {/* Role permissions matrix (read-only reference) */}
      <RolePermissionsMatrixCard />

      {/* Non-admin notice */}
      {!canManageMembers && (
        <p className="text-xs text-zinc-400 text-center">
          Contact your workspace admin to manage team members and invitations.
        </p>
      )}

      {/* Confirm dialog — single instance, props derived from pendingConfirm.
          Replaces two native confirm() calls (member remove + invite revoke)
          per #41 C8b. Differentiated copy/severity per action. */}
      <ConfirmActionDialog
        isOpen={pendingConfirm !== null}
        isLoading={isConfirming}
        onCancel={() => { if (!isConfirming) setPendingConfirm(null); }}
        onConfirm={handleConfirmPending}
        severity={pendingConfirm?.kind === 'remove' ? 'destructive' : 'warning'}
        title={
          pendingConfirm?.kind === 'remove' ? 'Remove member?'
          : pendingConfirm?.kind === 'revoke' ? 'Revoke pending invite?'
          : ''
        }
        confirmLabel={
          pendingConfirm?.kind === 'remove' ? 'Remove member'
          : pendingConfirm?.kind === 'revoke' ? 'Revoke invite'
          : ''
        }
        description={
          pendingConfirm?.kind === 'remove' ? (
            <>
              <strong className="text-zinc-900 dark:text-white">
                {pendingConfirm.member.name || pendingConfirm.member.email || 'This member'}
              </strong>{' '}
              will lose access to <strong>{currentWorkspace.name}</strong> immediately. Their
              role assignments and group memberships will be removed.
            </>
          ) : pendingConfirm?.kind === 'revoke' ? (
            <>
              The pending invite for{' '}
              <strong className="text-zinc-900 dark:text-white">{pendingConfirm.invite.email}</strong>{' '}
              will be deleted and its link will stop working. You can send a fresh invite at any time.
            </>
          ) : null
        }
        detail={
          pendingConfirm?.kind === 'remove'
            ? 'They can be re-invited later — but any messages, voxes, or tasks they own stay in the workspace.'
            : pendingConfirm?.kind === 'revoke'
              ? 'The invitee never had access, so nothing else is affected.'
              : undefined
        }
      />
    </div>
  );
};
