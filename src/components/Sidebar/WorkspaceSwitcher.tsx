import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../hooks/useAuth';
import { Workspace, workspaceService } from '../../services/workspaceService';
import { DeleteWorkspaceDialog } from '../settings/DeleteWorkspaceDialog';
import './WorkspaceSwitcher.css';

import { Archive, ArrowLeft, Check, Copy, CornerDownRight, MoreHorizontal, Plus, Trash2, UserPlus } from 'lucide-react';

interface WorkspaceSwitcherProps {
  isCollapsed: boolean;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Size variants map to CSS classes: sm=22px, md=24px, lg=28px
function avatarSizeClass(size: number): string {
  if (size <= 22) return 'ws-avatar-sm';
  if (size <= 24) return 'ws-avatar-md';
  return 'ws-avatar-lg';
}

function WorkspaceAvatar({ workspace, size = 28 }: { workspace: Workspace; size?: number }) {
  const sc = avatarSizeClass(size);
  if (workspace.avatar_url) {
    return (
      <img
        src={workspace.avatar_url}
        alt={workspace.name}
        className={`ws-avatar ws-avatar-img ${sc}`}
      />
    );
  }
  return (
    <div className={`ws-avatar ws-avatar-initials ${sc}`}>
      {getInitials(workspace.name)}
    </div>
  );
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ isCollapsed }) => {
  const {
    workspaces,
    currentWorkspace,
    members,
    currentRole,
    isOwner,
    canManageMembers,
    switchWorkspace,
    createChildWorkspace,
    softDeleteWorkspace,
    hardDeleteWorkspace,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ ws: Workspace; mode: 'soft' | 'hard' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const primaryWorkspace = currentWorkspace?.parent_workspace_id
    ? workspaces.find((w) => w.id === currentWorkspace.parent_workspace_id) ?? currentWorkspace
    : currentWorkspace;
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { user } = useAuth();

  // Fetch unread counts for all workspaces when panel opens
  const loadUnreadCounts = useCallback(async () => {
    if (!user?.id || workspaces.length === 0) return;
    const counts: Record<string, number> = {};
    await Promise.all(
      workspaces.map(async (ws) => {
        counts[ws.id] = await workspaceService.getUnreadCount(ws.id, user.id);
      }),
    );
    setUnreadCounts(counts);
  }, [user?.id, workspaces]);

  useEffect(() => {
    if (isOpen) loadUnreadCounts();
  }, [isOpen, loadUnreadCounts]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setShowCreateForm(false);
        setShowInviteForm(false);
        setOpenRowMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close row menu when panel closes or workspace switches
  useEffect(() => {
    if (!isOpen) setOpenRowMenuId(null);
  }, [isOpen]);

  // Keyboard navigation: Escape to close, arrow keys to navigate workspace list
  useEffect(() => {
    if (!isOpen || showCreateForm || showInviteForm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = panelRef.current?.querySelectorAll<HTMLButtonElement>('.ws-list-item');
        if (!items?.length) return;
        const currentIdx = Array.from(items).findIndex(el => el === document.activeElement);
        const nextIdx = e.key === 'ArrowDown'
          ? Math.min(currentIdx + 1, items.length - 1)
          : Math.max(currentIdx - 1, 0);
        items[nextIdx]?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, showCreateForm, showInviteForm]);

  const handleSwitch = (ws: Workspace) => {
    switchWorkspace(ws.id);
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !primaryWorkspace) return;
    setIsCreating(true);
    setCreateError('');
    try {
      const ws = await createChildWorkspace(primaryWorkspace.id, newName.trim());
      switchWorkspace(ws.id);
      setNewName('');
      setShowCreateForm(false);
      setIsOpen(false);
    } catch (err: any) {
      setCreateError(err?.message ?? 'Could not create workspace');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !currentWorkspace) return;
    setIsInviting(true);
    setInviteError('');
    try {
      const { invite, emailDelivery } = await workspaceService.inviteMember(
        currentWorkspace.id,
        inviteEmail.trim(),
        inviteRole,
        { workspaceName: currentWorkspace.name },
      );
      setInviteEmail('');
      setInviteLink(workspaceService.getInviteLink(invite.token));
      if (!emailDelivery.ok) {
        setInviteError(`Invite created — but the email couldn't be delivered (${emailDelivery.reason ?? 'unknown'}). Copy the link below and share it manually.`);
      }
    } catch (err: any) {
      setInviteError(err?.message ?? 'Invite failed');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handleRowAction = (ws: Workspace, mode: 'soft' | 'hard') => {
    setOpenRowMenuId(null);
    setDeleteTarget({ ws, mode });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.mode === 'soft') {
        await softDeleteWorkspace(deleteTarget.ws.id);
      } else {
        await hardDeleteWorkspace(deleteTarget.ws.id);
      }
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!currentWorkspace) return null;

  // Collapsed state: just an avatar icon
  if (isCollapsed) {
    return (
      <div className="ws-switcher-collapsed">
        <button
          type="button"
          ref={triggerRef}
          className="ws-trigger-collapsed"
          onClick={() => setIsOpen((o) => !o)}
          title={currentWorkspace.name}
        >
          <WorkspaceAvatar workspace={currentWorkspace} size={28} />
        </button>
        {isOpen && (
          <div className="ws-panel ws-panel-collapsed-pos" ref={panelRef}>
            <WorkspaceList
              workspaces={workspaces}
              currentId={currentWorkspace.id}
              currentUserId={user?.id}
              onSwitch={handleSwitch}
              onCreateClick={isOwner ? () => setShowCreateForm(true) : undefined}
              onArchive={(ws) => handleRowAction(ws, 'soft')}
              onDelete={(ws) => handleRowAction(ws, 'hard')}
              openMenuId={openRowMenuId}
              onMenuToggle={(id) => setOpenRowMenuId((cur) => (cur === id ? null : id))}
              unreadCounts={unreadCounts}
            />
          </div>
        )}
        {deleteTarget && (
          <DeleteWorkspaceDialog
            workspaceName={deleteTarget.ws.name}
            mode={deleteTarget.mode}
            isOpen={true}
            isLoading={isDeleting}
            onConfirm={handleConfirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="ws-switcher">
      {/* Trigger button */}
      <button
        type="button"
        ref={triggerRef}
        className={`ws-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => {
          setIsOpen((o) => !o);
          setShowCreateForm(false);
          setShowInviteForm(false);
          setInviteLink('');
        }}
      >
        <WorkspaceAvatar workspace={currentWorkspace} size={24} />
        <span className="ws-trigger-name">{currentWorkspace.name}</span>
        <div className="ws-trigger-badges">
          {currentRole && (
            <span className={`ws-role-badge ws-role-${currentRole}`}>{currentRole}</span>
          )}
        </div>
        <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} ws-trigger-chevron`} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="ws-panel" ref={panelRef}>
          {!showCreateForm && !showInviteForm && (
            <>
              {/* Workspace list */}
              <div className="ws-panel-section">
                <div className="ws-panel-label">Workspaces</div>
                <WorkspaceList
                  workspaces={workspaces}
                  currentId={currentWorkspace.id}
                  currentUserId={user?.id}
                  onSwitch={handleSwitch}
                  onCreateClick={isOwner ? () => setShowCreateForm(true) : undefined}
                  onArchive={(ws) => handleRowAction(ws, 'soft')}
                  onDelete={(ws) => handleRowAction(ws, 'hard')}
                  openMenuId={openRowMenuId}
                  onMenuToggle={(id) => setOpenRowMenuId((cur) => (cur === id ? null : id))}
                />
              </div>

              {/* Member list */}
              {members.length > 0 && (
                <div className="ws-panel-section ws-panel-divider">
                  <div className="ws-panel-label">
                    Members
                    <span className="ws-member-count">{members.length}</span>
                  </div>
                  <div className="ws-member-list">
                    {members.slice(0, 5).map((m) => (
                      <div key={m.user_id} className="ws-member-row">
                        <div className="ws-member-avatar">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt={m.name ?? ''} />
                          ) : (
                            <span>{getInitials(m.name ?? m.email ?? '?')}</span>
                          )}
                        </div>
                        <div className="ws-member-info">
                          <span className="ws-member-name">{m.name ?? m.email ?? 'Unknown'}</span>
                        </div>
                        <span className={`ws-role-badge ws-role-${m.role}`}>{m.role}</span>
                      </div>
                    ))}
                    {members.length > 5 && (
                      <div className="ws-member-overflow">+{members.length - 5} more</div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              {canManageMembers && (
                <div className="ws-panel-section ws-panel-divider">
                  <button
                    type="button"
                    className="ws-action-btn"
                    onClick={() => setShowInviteForm(true)}
                  >
                    <UserPlus />
                    <span>Invite member</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Create child workspace */}
          {showCreateForm && primaryWorkspace && (
            <div className="ws-panel-section">
              <button
                type="button"
                className="ws-back-btn"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewName('');
                  setCreateError('');
                }}
              >
                <ArrowLeft /> Back
              </button>
              <div className="ws-panel-label">New workspace</div>
              <p className="ws-create-hint">
                Sub-context under <strong>{primaryWorkspace.name}</strong> — shares your plan,
                no extra charge.
              </p>
              <div className="ws-form">
                <input
                  autoFocus
                  className="ws-input"
                  placeholder="e.g. Development, Personal, Project X"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) handleCreate(); }}
                  maxLength={50}
                />
                {createError && <div className="ws-error">{createError}</div>}
                <button
                  type="button"
                  className="ws-submit-btn"
                  disabled={!newName.trim() || isCreating}
                  onClick={handleCreate}
                >
                  {isCreating ? 'Creating…' : 'Create workspace'}
                </button>
              </div>
            </div>
          )}

          {/* Invite member form */}
          {showInviteForm && (
            <div className="ws-panel-section">
              <button
                type="button"
                className="ws-back-btn"
                onClick={() => { setShowInviteForm(false); setInviteError(''); setInviteLink(''); }}
              >
                <ArrowLeft /> Back
              </button>
              <div className="ws-panel-label">Invite to {currentWorkspace.name}</div>
              <form onSubmit={handleInvite} className="ws-form">
                <input
                  autoFocus
                  className="ws-input"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <select
                  aria-label="Member role"
                  className="ws-input ws-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
                {inviteError && <div className="ws-error">{inviteError}</div>}
                <button
                  type="submit"
                  className="ws-submit-btn"
                  disabled={!inviteEmail.trim() || isInviting}
                >
                  {isInviting ? 'Sending…' : 'Send invite'}
                </button>
              </form>
              {inviteLink && (
                <div className="ws-invite-link-box">
                  <span className="ws-invite-link-label">Invite link</span>
                  <div className="ws-invite-link-row">
                    <span className="ws-invite-link-text">{inviteLink}</span>
                    <button
                      type="button"
                      className="ws-copy-btn"
                      onClick={handleCopyLink}
                      title="Copy invite link"
                    >
                      {linkCopied
                        ? <Check />
                        : <Copy />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {deleteTarget && (
        <DeleteWorkspaceDialog
          workspaceName={deleteTarget.ws.name}
          mode={deleteTarget.mode}
          isOpen={true}
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

// -------------------------------------------------------
// Sub-component: workspace list shared by both states
// -------------------------------------------------------

interface WorkspaceListProps {
  workspaces: Workspace[];
  currentId: string;
  currentUserId?: string;
  onSwitch: (ws: Workspace) => void;
  onCreateClick?: () => void;
  onArchive?: (ws: Workspace) => void;
  onDelete?: (ws: Workspace) => void;
  openMenuId?: string | null;
  onMenuToggle?: (id: string) => void;
  unreadCounts?: Record<string, number>;
}

const WorkspaceList: React.FC<WorkspaceListProps> = ({
  workspaces,
  currentId,
  currentUserId,
  onSwitch,
  onCreateClick,
  onArchive,
  onDelete,
  openMenuId,
  onMenuToggle,
  unreadCounts,
}) => {
  const primaries = workspaces.filter((w) => !w.parent_workspace_id);
  const childrenByParent = workspaces.reduce<Record<string, Workspace[]>>((acc, w) => {
    if (w.parent_workspace_id) {
      (acc[w.parent_workspace_id] ||= []).push(w);
    }
    return acc;
  }, {});
  const orphans = workspaces.filter(
    (w) => w.parent_workspace_id && !primaries.some((p) => p.id === w.parent_workspace_id),
  );

  const renderRow = (ws: Workspace, isChild: boolean) => {
    const unread = unreadCounts?.[ws.id] ?? 0;
    const userIsOwner = !!currentUserId && ws.owner_id === currentUserId;
    const canShowMenu = userIsOwner && (onArchive || onDelete);
    const menuOpen = openMenuId === ws.id;
    return (
      <div
        key={ws.id}
        className={`ws-row ${ws.id === currentId ? 'active' : ''} ${isChild ? 'ws-row-child' : ''}`}
      >
        <button
          type="button"
          className={`ws-list-item ${ws.id === currentId ? 'active' : ''} ${isChild ? 'ws-list-item-child' : ''}`}
          onClick={() => onSwitch(ws)}
        >
          {isChild && <CornerDownRight className="ws-child-indicator" />}
          <WorkspaceAvatar workspace={ws} size={22} />
          <span className="ws-list-name">{ws.name}</span>
          {unread > 0 && ws.id !== currentId && (
            <span className="ws-unread-badge">{unread > 99 ? '99+' : unread}</span>
          )}
          {ws.id === currentId && <Check className="ws-list-check" />}
        </button>
        {canShowMenu && (
          <>
            <button
              type="button"
              aria-label="Workspace options"
              className="ws-row-menu-trigger"
              onClick={(e) => {
                e.stopPropagation();
                onMenuToggle?.(ws.id);
              }}
            >
              <MoreHorizontal />
            </button>
            {menuOpen && (
              <div className="ws-row-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                {onArchive && (
                  <button
                    type="button"
                    role="menuitem"
                    className="ws-row-menu-item"
                    onClick={() => onArchive(ws)}
                  >
                    <Archive /> <span>Archive</span>
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    className="ws-row-menu-item ws-row-menu-item-danger"
                    onClick={() => onDelete(ws)}
                  >
                    <Trash2 /> <span>Delete permanently</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {primaries.map((p) => (
        <React.Fragment key={p.id}>
          {renderRow(p, false)}
          {(childrenByParent[p.id] ?? []).map((c) => renderRow(c, true))}
        </React.Fragment>
      ))}
      {orphans.map((o) => renderRow(o, false))}
      {onCreateClick && (
        <button type="button" className="ws-list-item ws-list-create" onClick={onCreateClick}>
          <div className="ws-create-icon"><Plus /></div>
          <span>New workspace</span>
        </button>
      )}
    </>
  );
};

export default WorkspaceSwitcher;
