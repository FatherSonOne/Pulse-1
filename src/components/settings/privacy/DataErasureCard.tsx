import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabase';

const CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

const DELETION_SCOPE: { label: string; detail: string }[] = [
  { label: 'Profile and identity',  detail: 'Display name, handle, avatar, bio, email, phone' },
  { label: 'Messages and voxes',    detail: 'All direct messages, voice notes, and conversation history you sent' },
  { label: 'Contacts and CRM data', detail: 'Contact records, circles, goals, and relationship intelligence' },
  { label: 'Decisions and tasks',   detail: 'Decisions you created, assigned tasks, and subtasks' },
  { label: 'Connected accounts',    detail: 'Google, calendar, and other OAuth integrations' },
  { label: 'Sessions and 2FA',      detail: 'Active sign-in sessions, authenticator factors, recovery codes' },
  { label: 'Settings and preferences', detail: 'Notifications, AI configuration, retention policies, theme' },
];

const RETAINED_SCOPE: string[] = [
  'Audit log entries (anonymized) — required for security and compliance.',
  'Invoices and payment records — required by financial regulations.',
  'Workspace data you contributed to other organizations remains owned by those organizations.',
];

export const DataErasureCard: React.FC = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason]           = useState('');
  const [isDeleting, setIsDeleting]   = useState(false);

  const cancel = () => {
    setShowConfirm(false);
    setConfirmText('');
    setReason('');
  };

  const handleErase = async () => {
    if (confirmText.trim() !== CONFIRM_PHRASE) {
      toast.error(`Type exactly "${CONFIRM_PHRASE}" to confirm`);
      return;
    }
    setIsDeleting(true);
    const toastId = toast.loading('Erasing account...');
    try {
      // Self-serve erasure via the delete-account edge function: it deletes
      // the caller's data (delete_user_account RPC) AND the auth identity,
      // which makes the GDPR Art. 17 claim below actually true.
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;

      toast.success('Account erased. Signing out...', { id: toastId });
      setTimeout(() => {
        supabase.auth.signOut();
        window.location.href = '/';
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to erase account';
      toast.error(msg, { id: toastId });
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
        <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Erase my account</h4>
      </div>
      <p className="text-xs text-red-600/80 dark:text-red-400/80">
        Permanently delete your account and all personal data we hold for you. This cannot be undone and satisfies
        your right to erasure under GDPR Article 17.
      </p>

      {!showConfirm && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition"
        >
          <Trash2 className="w-4 h-4" />
          Begin erasure flow
        </button>
      )}

      {showConfirm && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/30 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">What will be deleted</p>
              </div>
            </div>
            <ul className="space-y-1 text-xs">
              {DELETION_SCOPE.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                  <span className="w-1 h-1 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium">{s.label}</span>{' '}
                    <span className="text-zinc-500 dark:text-zinc-400">— {s.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">What will be retained</p>
            <ul className="space-y-1 text-xs">
              {RETAINED_SCOPE.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-zinc-500 dark:text-zinc-400">
                  <span className="w-1 h-1 rounded-full bg-zinc-400 mt-2 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="erase-reason" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
              Reason (optional)
            </label>
            <textarea
              id="erase-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Helps us improve. Not required."
              rows={2}
              maxLength={300}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
            />
          </div>

          <div>
            <label htmlFor="erase-confirm" className="block text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">
              Type <code className="font-mono bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded">{CONFIRM_PHRASE}</code> to confirm
            </label>
            <input
              id="erase-confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full px-3 py-2 text-sm font-mono border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={cancel}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleErase}
              disabled={isDeleting || confirmText.trim() !== CONFIRM_PHRASE}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {isDeleting ? 'Erasing...' : 'Permanently erase my account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
