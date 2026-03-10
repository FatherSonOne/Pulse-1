import React, { useState, useEffect } from 'react';
import { sendTeamInvite, getPendingTeamInvites, resendTeamInvite, revokeTeamInvite, type TeamInvite } from '../../services/teamService';
import { Loader2, Mail, Send, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface TeamSettingsProps {
  userId: string;
  userName: string;
}

export const TeamSettings: React.FC<TeamSettingsProps> = ({ userName }) => {
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    getPendingTeamInvites().then(setPendingInvites).catch(() => {});
  }, []);

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3>
          <Users /> Team Management
        </h3>
        <p>
          Invite team members and manage access permissions.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Invite New Member</h4>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={async () => {
              if (!inviteEmail) return;
              setIsInviting(true);
              const { success, error } = await sendTeamInvite(inviteEmail);
              if (success) {
                toast.success(`Invite sent to ${inviteEmail}`);
                setInviteEmail('');
                const updated = await getPendingTeamInvites();
                setPendingInvites(updated);
              } else {
                toast.error(error || 'Failed to send invite');
              }
              setIsInviting(false);
            }}
            disabled={!inviteEmail || isInviting}
            className="px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
          >
            {isInviting ? <Loader2 className="animate-spin" /> : <Send />}
            Send Invite
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold dark:text-white text-zinc-900">Pending Invitations</h4>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500">
                  <Mail />
                </div>
                <div>
                  <p className="text-sm font-medium dark:text-white text-zinc-900">{invite.email}</p>
                  <p className="text-xs text-zinc-500">Sent {new Date(invite.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-xs font-medium text-blue-500 hover:text-blue-600"
                  onClick={async () => {
                    const { success } = await resendTeamInvite(invite.id);
                    success ? toast.success(`Invite resent to ${invite.email}`) : toast.error('Failed to resend');
                  }}
                >Resend</button>
                <button
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                  onClick={async () => {
                    if (!confirm(`Revoke invite for ${invite.email}?`)) return;
                    const { success } = await revokeTeamInvite(invite.id);
                    if (success) setPendingInvites(pendingInvites.filter(i => i.id !== invite.id));
                    else toast.error('Failed to revoke');
                  }}
                >Revoke</button>
              </div>
            </div>
          ))}
          {pendingInvites.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-sm">
              No pending invitations.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold dark:text-white text-zinc-900">Current Members</h4>
        </div>
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
            {userName.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold dark:text-white text-zinc-900">{userName} (You)</p>
            <p className="text-xs text-zinc-500">Admin</p>
          </div>
          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-full font-medium">Active</span>
        </div>
      </div>
    </div>
  );
};
