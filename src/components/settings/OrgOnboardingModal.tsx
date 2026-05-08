import React, { useState } from 'react';
import { Building2, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useWorkspaceData,
  useWorkspaceActions,
  useWorkspacePermissions,
} from '../../contexts/WorkspaceContext';

/**
 * Blocking onboarding modal shown to the org owner when their workspace
 * is in `onboarding_step = 'pending'`. Collects only the organization name —
 * every other setup step lives in the dismissible dashboard checklist.
 *
 * Non-owners never see this modal; they enter the app normally while the
 * owner finishes setup.
 */
export const OrgOnboardingModal: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { updateWorkspace } = useWorkspaceActions();
  const { isOwner } = useWorkspacePermissions();

  const [orgName, setOrgName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!currentWorkspace) return null;
  if (currentWorkspace.onboarding_step !== 'pending') return null;
  if (!isOwner) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = orgName.trim();
    if (!trimmed) {
      toast.error('Please enter your organization name');
      return;
    }
    if (trimmed.length > 80) {
      toast.error('Name must be 80 characters or less');
      return;
    }

    setIsSaving(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        name: trimmed,
        onboarding_step: 'named',
      });
      toast.success(`Welcome to Pulse, ${trimmed}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save organization';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-6 sm:p-8 border-b border-zinc-200 dark:border-zinc-800">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/30">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Name your organization
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
            This is the space where you and your team will work together on Pulse.
            You can change it later in Settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div>
            <label
              htmlFor="org-name"
              className="block text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2"
            >
              Organization name
            </label>
            <input
              id="org-name"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g., Acme Inc."
              autoFocus
              maxLength={80}
              disabled={isSaving}
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || !orgName.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating your organization...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
