import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ImageIcon,
  Users,
  Globe,
  CreditCard,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useWorkspaceData,
  useWorkspaceActions,
  useWorkspacePermissions,
} from '../../contexts/WorkspaceContext';

interface OrgSetupChecklistProps {
  openSettings: (section: string) => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  section: string;
}

/**
 * Dismissible post-onboarding checklist shown on the Dashboard to org
 * owners/admins while `onboarding_step = 'named'`. Each item deep-links into
 * the relevant Settings section. "Dismiss" flips state to 'complete'.
 */
export const OrgSetupChecklist: React.FC<OrgSetupChecklistProps> = ({ openSettings }) => {
  const { currentWorkspace, members } = useWorkspaceData();
  const { updateWorkspace } = useWorkspaceActions();
  const { isAdmin } = useWorkspacePermissions();

  const [isDismissing, setIsDismissing] = useState(false);

  const items = useMemo<ChecklistItem[]>(() => {
    if (!currentWorkspace) return [];
    return [
      {
        id: 'logo',
        label: 'Add your organization logo',
        description: 'Make it yours — upload a square image.',
        icon: ImageIcon,
        done: !!currentWorkspace.avatar_url,
        section: 'workspace',
      },
      {
        id: 'team',
        label: 'Invite your team',
        description: 'Bring collaborators in by email or link.',
        icon: Users,
        done: members.length > 1,
        section: 'team',
      },
      {
        id: 'domain',
        label: 'Set auto-join domain',
        description: 'Let coworkers on your email domain join automatically.',
        icon: Globe,
        done: !!currentWorkspace.auto_join_domain,
        section: 'workspace',
      },
      {
        id: 'billing',
        label: 'Add billing contact',
        description: 'Where invoices and payment notices should go.',
        icon: CreditCard,
        done: !!currentWorkspace.billing_email,
        section: 'billing',
      },
    ];
  }, [currentWorkspace, members.length]);

  if (!currentWorkspace) return null;
  if (currentWorkspace.onboarding_step !== 'named') return null;
  if (!isAdmin) return null;

  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const allDone = completedCount === totalCount;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await updateWorkspace(currentWorkspace.id, { onboarding_step: 'complete' });
      toast.success("You're all set!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not dismiss checklist';
      toast.error(msg);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 p-5 sm:p-6 shadow-sm overflow-hidden">
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br from-rose-400/20 to-pink-400/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
              Finish setting up {currentWorkspace.name}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {completedCount} of {totalCount} complete
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isDismissing}
          aria-label="Dismiss setup checklist"
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
        >
          {isDismissing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
        </button>
      </div>

      <div className="relative h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ul className="relative space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openSettings(item.section)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left
                  ${item.done
                    ? 'border-transparent bg-zinc-100/60 dark:bg-zinc-800/40 opacity-60 hover:opacity-80'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-md'
                  }`}
              >
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-zinc-400 shrink-0" />
                )}
                <Icon className={`w-4 h-4 shrink-0 ${item.done ? 'text-zinc-400' : 'text-rose-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${item.done ? 'line-through text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>
                    {item.label}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {item.description}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {allDone && (
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isDismissing}
          className="relative mt-4 w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold text-sm hover:shadow-lg hover:shadow-rose-500/30 transition disabled:opacity-50"
        >
          {isDismissing ? 'Finishing...' : 'Hide this checklist'}
        </button>
      )}
    </div>
  );
};
