// Multi-person Thread Collaboration Component
import React, { useState, useMemo } from 'react';

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  avatarColor?: string;
  role: 'owner' | 'participant' | 'viewer' | 'mentioned';
  status: 'online' | 'away' | 'offline';
  lastActive?: string;
  messageCount: number;
}

interface CollaborationInvite {
  id: string;
  email: string;
  role: 'participant' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
  sentAt: string;
}

interface ThreadCollaborationProps {
  threadId: string;
  participants: Participant[];
  pendingInvites?: CollaborationInvite[];
  currentUserId: string;
  onInvite?: (email: string, role: 'participant' | 'viewer') => void;
  onRemove?: (participantId: string) => void;
  onChangeRole?: (participantId: string, role: Participant['role']) => void;
  onResendInvite?: (inviteId: string) => void;
  onCancelInvite?: (inviteId: string) => void;
  compact?: boolean;
}

export const ThreadCollaboration: React.FC<ThreadCollaborationProps> = ({
  threadId,
  participants = [],
  pendingInvites = [],
  currentUserId,
  onInvite,
  onRemove,
  onChangeRole,
  onResendInvite,
  onCancelInvite,
  compact = false
}) => {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'participant' | 'viewer'>('participant');
  const [showAllParticipants, setShowAllParticipants] = useState(false);

  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // Sort by: owner first, then by online status, then by message count
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (b.status === 'online' && a.status !== 'online') return 1;
      return b.messageCount - a.messageCount;
    });
  }, [participants]);

  const displayedParticipants = showAllParticipants ? sortedParticipants : sortedParticipants.slice(0, 5);
  const onlineCount = participants.filter(p => p.status === 'online').length;

  const getStatusColor = (status: Participant['status']) => {
    switch (status) {
      case 'online': return 'bg-emerald-500';
      case 'away': return 'bg-amber-500';
      default: return 'bg-zinc-400';
    }
  };

  const getRoleBadge = (role: Participant['role']) => {
    switch (role) {
      case 'owner':
        return <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded">Owner</span>;
      case 'participant':
        return <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">Active</span>;
      case 'viewer':
        return <span className="px-1.5 py-0.5 text-[9px] font-bold bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded">Viewer</span>;
      case 'mentioned':
        return <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded">Mentioned</span>;
    }
  };

  const handleInvite = () => {
    if (inviteEmail.trim() && onInvite) {
      onInvite(inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      setShowInviteModal(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {sortedParticipants.slice(0, 4).map(p => (
            <div
              key={p.id}
              className="relative w-7 h-7 rounded-full ring-2 ring-white dark:ring-zinc-900 flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: p.avatarColor || '#6366f1' }}
              title={p.name}
            >
              {p.avatar ? (
                <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                p.name.charAt(0).toUpperCase()
              )}
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${getStatusColor(p.status)} ring-2 ring-white dark:ring-zinc-900`} />
            </div>
          ))}
          {participants.length > 4 && (
            <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 ring-2 ring-white dark:ring-zinc-900 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400">
              +{participants.length - 4}
            </div>
          )}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          <span className="text-emerald-500 font-medium">{onlineCount}</span> online
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <i className="fa-solid fa-users text-indigo-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Collaborators</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {participants.length} participants · {onlineCount} online
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition"
          >
            <i className="fa-solid fa-user-plus" />
            Invite
          </button>
        </div>
      </div>

      {/* Participants List */}
      <div className="p-2 max-h-60 overflow-y-auto">
        {displayedParticipants.map(participant => (
          <div
            key={participant.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition group"
          >
            {/* Avatar */}
            <div className="relative">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: participant.avatarColor || '#6366f1' }}
              >
                {participant.avatar ? (
                  <img src={participant.avatar} alt={participant.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  participant.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${getStatusColor(participant.status)} ring-2 ring-white dark:ring-zinc-800`} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-white truncate">
                  {participant.name}
                </span>
                {participant.id === currentUserId && (
                  <span className="text-[9px] text-zinc-400">(you)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {getRoleBadge(participant.role)}
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  {participant.messageCount} messages
                </span>
              </div>
            </div>

            {/* Actions */}
            {participant.id !== currentUserId && participant.role !== 'owner' && (
              <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                <button
                  onClick={() => onChangeRole?.(participant.id, participant.role === 'viewer' ? 'participant' : 'viewer')}
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  title="Change role"
                >
                  <i className="fa-solid fa-user-pen text-xs" />
                </button>
                <button
                  onClick={() => onRemove?.(participant.id)}
                  className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Remove"
                >
                  <i className="fa-solid fa-user-minus text-xs" />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Show more button */}
        {participants.length > 5 && (
          <button
            onClick={() => setShowAllParticipants(!showAllParticipants)}
            className="w-full py-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {showAllParticipants ? 'Show less' : `Show ${participants.length - 5} more`}
          </button>
        )}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 p-2">
          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 px-2">
            Pending Invites ({pendingInvites.length})
          </div>
          {pendingInvites.map(invite => (
            <div key={invite.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <div>
                <div className="text-sm text-zinc-700 dark:text-zinc-300">{invite.email}</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {invite.role} · Sent {new Date(invite.sentAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onResendInvite?.(invite.id)}
                  className="p-1.5 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  title="Resend"
                >
                  <i className="fa-solid fa-paper-plane text-xs" />
                </button>
                <button
                  onClick={() => onCancelInvite?.(invite.id)}
                  className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Cancel"
                >
                  <i className="fa-solid fa-times text-xs" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-white">Invite Collaborator</h3>
                <button onClick={() => setShowInviteModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <i className="fa-solid fa-times" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                  Role
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setInviteRole('participant')}
                    className={`flex-1 p-3 rounded-lg border-2 transition ${
                      inviteRole === 'participant'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <i className="fa-solid fa-pen text-indigo-500" />
                      <span className="font-medium text-zinc-800 dark:text-white">Participant</span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Can send messages and participate</p>
                  </button>
                  <button
                    onClick={() => setInviteRole('viewer')}
                    className={`flex-1 p-3 rounded-lg border-2 transition ${
                      inviteRole === 'viewer'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <i className="fa-solid fa-eye text-zinc-500" />
                      <span className="font-medium text-zinc-800 dark:text-white">Viewer</span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Can only view the conversation</p>
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-2">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Participant avatars strip for header
export const ParticipantAvatars: React.FC<{
  participants: Array<{ id: string; name: string; avatar?: string; avatarColor?: string; status: 'online' | 'away' | 'offline' }>;
  max?: number;
  size?: 'sm' | 'md';
  onClick?: () => void;
}> = ({ participants, max = 5, size = 'sm', onClick }) => {
  const sizeClasses = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';

  return (
    <button onClick={onClick} className="flex items-center gap-1">
      <div className="flex -space-x-1.5">
        {participants.slice(0, max).map(p => (
          <div
            key={p.id}
            className={`${sizeClasses} rounded-full ring-2 ring-white dark:ring-zinc-900 flex items-center justify-center font-bold text-white`}
            style={{ backgroundColor: p.avatarColor || '#6366f1' }}
            title={p.name}
          >
            {p.avatar ? (
              <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              p.name.charAt(0).toUpperCase()
            )}
          </div>
        ))}
        {participants.length > max && (
          <div className={`${sizeClasses} rounded-full bg-zinc-200 dark:bg-zinc-700 ring-2 ring-white dark:ring-zinc-900 flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-400`}>
            +{participants.length - max}
          </div>
        )}
      </div>
    </button>
  );
};

export default ThreadCollaboration;
