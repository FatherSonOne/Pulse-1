import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { Workspace, workspaceService } from '../../services/workspaceService';
import './WorkspaceSwitcher.css';

import { ArrowLeft, Check, Copy, Plus, UserPlus } from 'lucide-react';

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
    isAdmin,
    canManageMembers,
    switchWorkspace,
    createWorkspace,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSwitch = (ws: Workspace) => {
    switchWorkspace(ws.id);
    setIsOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const ws = await createWorkspace(newName.trim());
      switchWorkspace(ws.id);
      setNewName('');
      setShowCreateForm(false);
      setIsOpen(false);
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
      const invite = await workspaceService.inviteMember(currentWorkspace.id, inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      setInviteLink(workspaceService.getInviteLink(invite.token));
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
              onSwitch={handleSwitch}
              onCreateClick={() => setShowCreateForm(true)}
            />
          </div>
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
                  onSwitch={handleSwitch}
                  onCreateClick={() => setShowCreateForm(true)}
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

          {/* Create workspace form */}
          {showCreateForm && (
            <div className="ws-panel-section">
              <button
                type="button"
                className="ws-back-btn"
                onClick={() => setShowCreateForm(false)}
              >
                <ArrowLeft /> Back
              </button>
              <div className="ws-panel-label">New workspace</div>
              <form onSubmit={handleCreate} className="ws-form">
                <input
                  autoFocus
                  className="ws-input"
                  placeholder="Workspace name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={50}
                />
                <button
                  type="submit"
                  className="ws-submit-btn"
                  disabled={!newName.trim() || isCreating}
                >
                  {isCreating ? 'Creating…' : 'Create'}
                </button>
              </form>
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
    </div>
  );
};

// -------------------------------------------------------
// Sub-component: workspace list shared by both states
// -------------------------------------------------------

interface WorkspaceListProps {
  workspaces: Workspace[];
  currentId: string;
  onSwitch: (ws: Workspace) => void;
  onCreateClick: () => void;
}

const WorkspaceList: React.FC<WorkspaceListProps> = ({ workspaces, currentId, onSwitch, onCreateClick }) => (
  <>
    {workspaces.map((ws) => (
      <button
        type="button"
        key={ws.id}
        className={`ws-list-item ${ws.id === currentId ? 'active' : ''}`}
        onClick={() => onSwitch(ws)}
      >
        <WorkspaceAvatar workspace={ws} size={22} />
        <span className="ws-list-name">{ws.name}</span>
        {ws.id === currentId && <Check className="ws-list-check" />}
      </button>
    ))}
    <button type="button" className="ws-list-item ws-list-create" onClick={onCreateClick}>
      <div className="ws-create-icon"><Plus /></div>
      <span>New workspace</span>
    </button>
  </>
);

export default WorkspaceSwitcher;
