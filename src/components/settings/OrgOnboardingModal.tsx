import React, { useEffect, useRef, useState } from 'react';
import { Building2, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useWorkspaceData,
  useWorkspaceActions,
  useWorkspacePermissions,
} from '../../contexts/WorkspaceContext';
import { MonoLabel } from './shared/MonoLabel';
import {
  trackOnboarding,
  OnboardingEvent,
} from '../../lib/monitoring/onboardingEvents';

/**
 * Blocking onboarding modal shown to the org owner when their workspace
 * is in `onboarding_step = 'pending'`. Collects only the organization name;
 * every other setup step lives in the dismissible dashboard checklist.
 *
 * Non-owners never see this modal; they enter the app normally while the
 * owner finishes setup.
 *
 * a11y: role=dialog + aria-modal, focus is trapped between the input and the
 * submit button (only two focusables when not saving), Escape is intentionally
 * not bound — naming the workspace is required, the modal is the only exit.
 * Migration target: org name moves to a pre-Stripe plan picker and this file
 * is deleted (see docs/onboarding-redesign.md §9).
 */
export const OrgOnboardingModal: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { updateWorkspace } = useWorkspaceActions();
  const { isOwner } = useWorkspacePermissions();

  const [orgName, setOrgName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const titleId = 'org-onboarding-title';
  const descId = 'org-onboarding-desc';

  const shouldShow =
    !!currentWorkspace &&
    currentWorkspace.onboarding_step === 'pending' &&
    isOwner;

  // Fire surface_shown once per mount. The modal-shown signal feeds the
  // activation funnel's denominator.
  useEffect(() => {
    if (!shouldShow) return;
    trackOnboarding(OnboardingEvent.SurfaceShown, {
      workspace_id: currentWorkspace?.id,
      role: 'owner',
      surface: 'org_onboarding_modal',
    });
  }, [shouldShow, currentWorkspace?.id]);

  // Focus trap. Two focusables: input and submit. Tab wraps; Shift+Tab wraps
  // backwards. Escape is swallowed because there's no valid dismiss.
  useEffect(() => {
    if (!shouldShow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = [inputRef.current, submitRef.current].filter(
        (el): el is HTMLInputElement | HTMLButtonElement => el !== null && !el.hasAttribute('disabled'),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shouldShow]);

  if (!shouldShow) return null;

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
      trackOnboarding(OnboardingEvent.Named, {
        workspace_id: currentWorkspace.id,
        name_length: trimmed.length,
      });
      toast.success(`Welcome to Pulse, ${trimmed}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save organization';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="pulse-modal-scrim fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-300 motion-reduce:animate-none"
        style={{
          background: 'var(--pulse-surface)',
          border: '1px solid var(--pulse-border)',
          boxShadow: 'var(--pulse-shadow-md)',
        }}
      >
        <div className="p-6 sm:p-8" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--pulse-rose)' }}
          >
            <Building2 className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <h1
            id={titleId}
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--pulse-ink)]"
          >
            Name your organization
          </h1>
          <p
            id={descId}
            className="text-sm mt-2 leading-relaxed text-[var(--pulse-ink-2)]"
          >
            This is the space where you and your team will work together on Pulse.
            You can change it later in Settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div>
            <MonoLabel as="label" htmlFor="org-name" className="mb-2">
              Organization name
            </MonoLabel>
            <input
              id="org-name"
              ref={inputRef}
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g., Acme Inc."
              autoFocus
              maxLength={80}
              disabled={isSaving}
              aria-required="true"
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[var(--pulse-ink)] placeholder-[var(--pulse-ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--pulse-rose)] focus:border-transparent transition disabled:opacity-50"
            />
          </div>

          <button
            ref={submitRef}
            type="submit"
            disabled={isSaving || !orgName.trim()}
            className="pulse-btn-primary w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--pulse-rose)' }}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Creating your organization...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
