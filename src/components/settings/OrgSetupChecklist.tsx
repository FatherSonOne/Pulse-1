import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ImageIcon,
  Users,
  Globe,
  CreditCard,
  X,
  ListChecks,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useWorkspaceData,
  useWorkspaceActions,
  useWorkspacePermissions,
} from '../../contexts/WorkspaceContext';
import {
  trackOnboarding,
  OnboardingEvent,
} from '../../lib/monitoring/onboardingEvents';

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
  /** Sub-field token written to the URL as `?focus=<token>` so the destination
   *  settings section can scroll + highlight (and sometimes auto-open) the
   *  specific control instead of dropping the user on a long settings page. */
  focus: string;
  /** Primary activation move — visually emphasized while incomplete so the
   *  onboarding sequence leads with it (AC1: invite → first multiplayer). */
  primary?: boolean;
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
        // AC1: invite is the primary activation move — surfaced first so the
        // onboarding sequence pushes invite → first multiplayer interaction
        // early. Emphasized when still incomplete.
        id: 'team',
        label: 'Invite your team',
        description: 'Bring collaborators in by email or link.',
        icon: Users,
        done: members.length > 1,
        section: 'team',
        focus: 'invite',
        primary: true,
      },
      {
        id: 'logo',
        label: 'Add your organization logo',
        description: 'Make it yours: upload a square image.',
        icon: ImageIcon,
        done: !!currentWorkspace.avatar_url,
        section: 'workspace',
        focus: 'logo',
      },
      {
        id: 'domain',
        label: 'Set auto-join domain',
        description: 'Let coworkers on your email domain join automatically.',
        icon: Globe,
        done: !!currentWorkspace.auto_join_domain,
        section: 'workspace',
        focus: 'auto-join',
      },
      {
        id: 'billing',
        label: 'Add billing contact',
        description: 'Where invoices and payment notices should go.',
        icon: CreditCard,
        done: !!currentWorkspace.billing_email,
        // Lives inside Workspace settings, not Plan & Billing — the latter
        // is for the multi-contact card; this is the single email default.
        section: 'workspace',
        focus: 'billing-contact',
      },
    ];
  }, [currentWorkspace, members.length]);

  const shouldShow =
    !!currentWorkspace &&
    currentWorkspace.onboarding_step === 'named' &&
    isAdmin;

  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const progressPct =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  // Fire opened-once per workspace per session. The ref guards React 18
  // double-mount in dev so the event is idempotent.
  const openedFiredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!shouldShow || !currentWorkspace) return;
    if (openedFiredFor.current === currentWorkspace.id) return;
    openedFiredFor.current = currentWorkspace.id;
    trackOnboarding(OnboardingEvent.ChecklistOpened, {
      workspace_id: currentWorkspace.id,
      total_items: totalCount,
      completed_items: completedCount,
    });
  }, [shouldShow, currentWorkspace, totalCount, completedCount]);

  if (!shouldShow || !currentWorkspace) return null;

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await updateWorkspace(currentWorkspace.id, { onboarding_step: 'complete' });
      trackOnboarding(OnboardingEvent.Dismissed, {
        workspace_id: currentWorkspace.id,
        n_incomplete: totalCount - completedCount,
        all_done: allDone,
      });
      toast.success("You're all set.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not dismiss checklist';
      toast.error(msg);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div
      className="relative rounded-2xl p-5 sm:p-6 overflow-hidden"
      style={{
        background: 'var(--pulse-surface)',
        border: '1px solid var(--pulse-border)',
        boxShadow: 'var(--pulse-shadow-sm)',
      }}
    >
      <div className="relative flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--pulse-rose)' }}
          >
            <ListChecks className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold line-clamp-2 text-[var(--pulse-ink)]">
              Finish setting up {currentWorkspace.name}
            </h3>
            <p className="text-xs sm:text-sm mt-0.5 text-[var(--pulse-ink-2)]">
              {completedCount} of {totalCount} complete
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isDismissing}
          aria-label="Dismiss setup checklist"
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] focus-visible:ring-offset-2"
        >
          {isDismissing ? (
            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <X className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <div
        className="relative h-1.5 rounded-full overflow-hidden mb-4"
        style={{ background: 'var(--pulse-border)' }}
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Setup progress: ${completedCount} of ${totalCount} complete`}
      >
        <div
          className="h-full transition-all duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${progressPct}%`, background: 'var(--pulse-rose)' }}
        />
      </div>

      <ul className="relative space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const emphasize = !!item.primary && !item.done;
          return (
            <li key={item.id}>
              <button
                type="button"
                style={emphasize
                  ? { borderColor: 'var(--pulse-rose)', background: 'var(--pulse-rose-soft)' }
                  : undefined}
                onClick={() => {
                  trackOnboarding(OnboardingEvent.ChoreClicked, {
                    workspace_id: currentWorkspace.id,
                    item_id: item.id,
                    already_done: item.done,
                  });
                  // Write `focus` to the URL so the destination settings
                  // section can scroll/highlight the specific control.
                  const params = new URLSearchParams(window.location.search);
                  params.set('settings', item.section);
                  params.set('focus', item.focus);
                  window.history.replaceState(
                    {},
                    '',
                    `${window.location.pathname}?${params.toString()}`,
                  );
                  openSettings(item.section);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] focus-visible:ring-offset-2
                  ${item.done
                    ? 'border-transparent bg-zinc-100/60 dark:bg-zinc-800/40 opacity-60 hover:opacity-80'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
              >
                {item.done ? (
                  <CheckCircle2
                    className="w-5 h-5 shrink-0"
                    style={{ color: 'var(--pulse-tone-positive)' }}
                    aria-hidden="true"
                  />
                ) : (
                  <Circle className="w-5 h-5 text-zinc-400 shrink-0" aria-hidden="true" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 ${item.done ? 'text-zinc-400' : ''}`}
                  style={item.done ? undefined : { color: 'var(--pulse-ink-2)' }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${item.done ? 'line-through' : ''}`}
                      style={{ color: item.done ? 'var(--pulse-ink-2)' : 'var(--pulse-ink)' }}
                    >
                      {item.label}
                    </span>
                    {emphasize && (
                      <span
                        className="text-[10px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded text-white shrink-0"
                        style={{ background: 'var(--pulse-rose)' }}
                      >
                        Start here
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5 text-[var(--pulse-ink-2)]">
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
          className="pulse-btn-primary relative mt-4 w-full px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition disabled:opacity-50"
          style={{ background: 'var(--pulse-rose)' }}
        >
          {isDismissing ? 'Hiding…' : 'Hide this checklist'}
        </button>
      )}
    </div>
  );
};
