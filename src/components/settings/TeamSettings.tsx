import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspaceData, useWorkspaceActions, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import { workspaceService, WorkspaceMember, WorkspaceInvite, WORKSPACE_PLAN_LABELS, WORKSPACE_PLAN_LIMITS } from '../../services/workspaceService';
import { Loader2, Mail, Send, Users, Shield, UserMinus, ChevronDown, Clock, X, RotateCcw, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { BulkInviteCard } from './team/BulkInviteCard';
import { GroupsManagementCard } from './team/GroupsManagementCard';
import { RolePermissionsMatrixCard } from './team/RolePermissionsMatrixCard';
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
  // Groups card is gated behind a flag until #42 phase 5 lands a real read
  // consumer (group_grants → mentions / routing / channel ACL). Dev override:
  // ?ff_workspaceGroups=on (also persists to localStorage for that browser).
  const showGroups = useFeatureFlag('workspaceGroups', userId);

  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  // Which pending-invite row was just copied? Drives the 1.5s Check icon.
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

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

  const handleInvite = async () => {
    if (!inviteEmail || !workspaceId || !currentWorkspace) return;
    setIsInviting(true);
    try {
      const { isResend, emailDelivery } = await workspaceService.inviteMember(
        workspaceId,
        inviteEmail,
        inviteRole,
        { workspaceName: currentWorkspace.name },
      );
      if (emailDelivery.ok) {
        toast.success(isResend ? `Re-sent invite to ${inviteEmail}` : `Invite sent to ${inviteEmail}`);
      } else {
        toast.error(
          `Invite created but email couldn't be delivered (${emailDelivery.reason ?? 'unknown'}). Copy the link from Pending Invites and share it manually.`,
        );
      }
      setInviteEmail('');
      setInviteRole('member');
      await loadInvites();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invite';
      toast.error(msg);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (member: WorkspaceMember, newRole: 'admin' | 'member' | 'viewer') => {
    if (!workspaceId) return;
    try {
      await workspaceService.updateMemberRole(workspaceId, member.user_id, newRole);
      toast.success(`Updated ${member.name || 'member'} to ${newRole}`);
      await refreshMembers();
    } catch {
      toast.error('Failed to update role');
    }
    setRoleDropdownOpen(null);
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    if (!workspaceId) return;
    if (!confirm(`Remove ${member.name || member.email || 'this member'} from the workspace?`)) return;
    try {
      await workspaceService.removeMember(workspaceId, member.user_id);
      toast.success('Member removed');
      await refreshMembers();
    } catch {
      toast.error('Failed to remove member');
    }
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

  const handleRevokeInvite = async (invite: WorkspaceInvite) => {
    if (!confirm(`Revoke invite for ${invite.email}?`)) return;
    try {
      // Delete the invite row directly
      const { error } = await (await import('../../services/supabase')).supabase
        .from('workspace_invites')
        .delete()
        .eq('id', invite.id);
      if (error) throw error;
      toast.success('Invite revoked');
      await loadInvites();
    } catch {
      toast.error('Failed to revoke invite');
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
          <span className="ml-2 text-xs text-zinc-400">
            {members.length} / {memberLimit} members ({WORKSPACE_PLAN_LABELS[plan]} plan)
          </span>
        </p>
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

      {/* Invite Form — admin+ only */}
      {canManageMembers && (
      <div
        ref={inviteCardRef}
        className="scroll-mt-4 rounded-2xl transition-shadow"
        style={{
          boxShadow: inviteFocused ? '0 0 0 3px rgba(244, 63, 94, 0.45)' : 'none',
        }}
      >
        <SettingsCard>
          <MonoLabel className="mb-6">Invite New Member</MonoLabel>
          <div className="flex gap-2">
            <input
              ref={inviteEmailInputRef}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:outline-none focus:border-rose-500"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
              aria-label="Invite role"
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 dark:text-white text-zinc-900 text-sm focus:outline-none focus:border-rose-500"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="button"
              onClick={handleInvite}
              disabled={!inviteEmail || isInviting}
              className="px-6 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </div>
        </SettingsCard>
      </div>
      )}

      {/* Bulk invite — admin+ only */}
      {canManageMembers && workspaceId && (
        <BulkInviteCard
          workspaceId={workspaceId}
          workspaceName={currentWorkspace.name}
          onInvitesSent={loadInvites}
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
    </div>
  );
};
