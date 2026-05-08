import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, Eye, Clock, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspaceActions, useWorkspacePermissions } from '../../../contexts/WorkspaceContext';
import { settingsService } from '../../../services/settingsService';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';

type Retention = 0 | 7 | 30 | 90 | 365;

const RETENTION_OPTIONS: { value: Retention; label: string }[] = [
  { value: 0,   label: 'Forever (until manually deleted)' },
  { value: 7,   label: '7 days' },
  { value: 30,  label: '30 days' },
  { value: 90,  label: '90 days' },
  { value: 365, label: '1 year' },
];

export const AIDataPolicyCard: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { updateWorkspace } = useWorkspaceActions();
  const { isAdmin } = useWorkspacePermissions();

  const [orgEnforced, setOrgEnforced]     = useState(false);
  const [orgRetention, setOrgRetention]   = useState<Retention>(0);
  const [isSavingOrg, setIsSavingOrg]     = useState(false);

  const [userPiiOn, setUserPiiOn]                 = useState(false);
  const [isLoadingUser, setIsLoadingUser]         = useState(true);
  const [isSavingUser, setIsSavingUser]           = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    setOrgEnforced(currentWorkspace.ai_pii_masking_enforced ?? false);
    setOrgRetention((currentWorkspace.ai_output_retention_days ?? 0) as Retention);
  }, [currentWorkspace?.id, currentWorkspace?.ai_pii_masking_enforced, currentWorkspace?.ai_output_retention_days]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await settingsService.get('aiPiiMaskingEnabled');
      if (cancelled) return;
      setUserPiiOn(typeof stored === 'boolean' ? stored : false);
      setIsLoadingUser(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!currentWorkspace) return null;

  // Effective masking = org enforces OR user enabled.
  const effectiveMasking = orgEnforced || userPiiOn;

  const orgDirty =
    orgEnforced  !== (currentWorkspace.ai_pii_masking_enforced ?? false) ||
    orgRetention !== (currentWorkspace.ai_output_retention_days ?? 0);

  const handleSaveOrg = async () => {
    setIsSavingOrg(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        ai_pii_masking_enforced:  orgEnforced,
        ai_output_retention_days: orgRetention,
      });
      toast.success('AI data policy saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save policy';
      toast.error(msg);
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleUserPiiToggle = async (next: boolean) => {
    if (orgEnforced && !next) {
      toast.error('Your organization enforces PII masking — it cannot be disabled');
      return;
    }
    setUserPiiOn(next);
    setIsSavingUser(true);
    try {
      await settingsService.set('aiPiiMaskingEnabled', next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save preference';
      toast.error(msg);
      setUserPiiOn(!next);
    } finally {
      setIsSavingUser(false);
    }
  };

  return (
    <SettingsCard className="space-y-5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-zinc-500" />
        <MonoLabel>AI data policy</MonoLabel>
      </div>

      {/* Effective state badge */}
      <div className={`flex items-center gap-2 p-3 rounded-lg border ${
        effectiveMasking
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/40'
          : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800'
      }`}>
        {effectiveMasking ? (
          <>
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              <strong>PII masking is active</strong> — emails, phone numbers, and other identifiers
              are scrubbed from your prompts before being sent to AI providers.
              {orgEnforced && ' (Enforced by organization.)'}
            </p>
          </>
        ) : (
          <>
            <Eye className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              PII masking is off. Prompts are sent to AI providers as-is.
            </p>
          </>
        )}
      </div>

      {/* Per-user toggle */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={userPiiOn || orgEnforced}
          onChange={(e) => handleUserPiiToggle(e.target.checked)}
          disabled={isLoadingUser || isSavingUser || orgEnforced}
          className="w-4 h-4 mt-0.5 text-rose-500 border-zinc-300 rounded focus:ring-rose-500 disabled:opacity-50"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-zinc-900 dark:text-white">
            Mask PII in my AI prompts
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Strips emails, phone numbers, SSNs, and other obvious identifiers from prompts client-side
            before they reach the AI provider. Slight quality trade-off; significant privacy gain.
            {orgEnforced && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
                Locked on by organization policy.
              </span>
            )}
          </p>
        </div>
      </label>

      {/* Org admin section */}
      {isAdmin && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            Organization policy
          </p>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={orgEnforced}
              onChange={(e) => setOrgEnforced(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-rose-500 border-zinc-300 rounded focus:ring-rose-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                Enforce PII masking org-wide
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                When on, every member's AI prompts are masked regardless of their personal preference.
              </p>
            </div>
          </label>

          <div>
            <label htmlFor="ai-retention" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              AI output retention
            </label>
            <select
              id="ai-retention"
              value={orgRetention}
              onChange={(e) => setOrgRetention(Number(e.target.value) as Retention)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            >
              {RETENTION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-zinc-400 mt-1">
              How long Pulse retains AI prompts and completions for review and improvement.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveOrg}
              disabled={isSavingOrg || !orgDirty}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSavingOrg && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isSavingOrg ? 'Saving...' : 'Save org policy'}
            </button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
};
