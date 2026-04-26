import React, { useState, useEffect } from 'react';
import { Cpu, Loader2, Lock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspaceActions, useWorkspacePermissions } from '../../../contexts/WorkspaceContext';
import { settingsService } from '../../../services/settingsService';

type ProviderKey = 'openai' | 'anthropic' | 'google';

interface ProviderDef {
  key:    ProviderKey;
  label:  string;
  models: string;
}

const PROVIDERS: ProviderDef[] = [
  { key: 'openai',    label: 'OpenAI',    models: 'GPT, Whisper, Realtime voice' },
  { key: 'anthropic', label: 'Anthropic', models: 'Claude (Opus, Sonnet, Haiku)' },
  { key: 'google',    label: 'Google',    models: 'Gemini, Live audio' },
];

type ProviderMap = Record<ProviderKey, boolean>;

const ALL_ON: ProviderMap = { openai: true, anthropic: true, google: true };

export const AIProvidersCard: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { updateWorkspace } = useWorkspaceActions();
  const { isAdmin } = useWorkspacePermissions();

  // Org-level state (admin section)
  const [orgAllowed, setOrgAllowed] = useState<ProviderMap>(ALL_ON);
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // User overrides — per-provider opt-out flags. true means user actively allowed,
  // false means user has opted out. Missing key = follow org default.
  const [overrides, setOverrides]       = useState<Partial<ProviderMap>>({});
  const [isLoadingOverrides, setIsLoadingOverrides] = useState(true);
  const [isSavingOverrides, setIsSavingOverrides]   = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    const fromDb = currentWorkspace.ai_allowed_providers ?? {};
    setOrgAllowed({
      openai:    fromDb.openai    !== false,
      anthropic: fromDb.anthropic !== false,
      google:    fromDb.google    !== false,
    });
  }, [currentWorkspace?.id, currentWorkspace?.ai_allowed_providers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await settingsService.get('aiProviderOverrides');
      if (cancelled) return;
      setOverrides((stored ?? {}) as Partial<ProviderMap>);
      setIsLoadingOverrides(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!currentWorkspace) return null;

  // Effective access — org allowed AND not user-opted-out.
  const effective = (k: ProviderKey): boolean => {
    if (!orgAllowed[k]) return false;
    if (overrides[k] === false) return false;
    return true;
  };

  const orgDirty =
    orgAllowed.openai    !== (currentWorkspace.ai_allowed_providers?.openai    !== false) ||
    orgAllowed.anthropic !== (currentWorkspace.ai_allowed_providers?.anthropic !== false) ||
    orgAllowed.google    !== (currentWorkspace.ai_allowed_providers?.google    !== false);

  const handleSaveOrg = async () => {
    setIsSavingOrg(true);
    try {
      await updateWorkspace(currentWorkspace.id, { ai_allowed_providers: orgAllowed });
      toast.success('Organization AI policy saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save AI policy';
      toast.error(msg);
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleToggleOverride = async (k: ProviderKey, optOut: boolean) => {
    // Cannot enable a provider blocked by the org.
    if (!orgAllowed[k] && !optOut) {
      toast.error(`${PROVIDERS.find(p => p.key === k)?.label} is blocked by your organization`);
      return;
    }
    const next: Partial<ProviderMap> = { ...overrides };
    if (optOut) {
      next[k] = false;
    } else {
      delete next[k]; // remove override → fall back to org default
    }
    setOverrides(next);
    setIsSavingOverrides(true);
    try {
      await settingsService.set('aiProviderOverrides', next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save preference';
      toast.error(msg);
      setOverrides(overrides); // revert on failure
    } finally {
      setIsSavingOverrides(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-zinc-500" />
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">AI providers</h4>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Pulse routes each task to the right model automatically. Use these controls to restrict which providers
        can be used in this organization, and to opt out of providers for your own account.
      </p>

      {/* Organization policy — admin+ */}
      {isAdmin && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-zinc-500" />
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
              Organization policy
            </p>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Disabling a provider blocks it for everyone in your organization, including admins.
          </p>

          {PROVIDERS.map(p => (
            <label key={p.key} className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={orgAllowed[p.key]}
                onChange={(e) => setOrgAllowed(prev => ({ ...prev, [p.key]: e.target.checked }))}
                className="w-4 h-4 mt-0.5 text-rose-500 border-zinc-300 rounded focus:ring-rose-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{p.label}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{p.models}</p>
              </div>
            </label>
          ))}

          {!orgAllowed.openai && !orgAllowed.anthropic && !orgAllowed.google && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                With every provider disabled, AI features will be unavailable for the entire organization.
              </p>
            </div>
          )}

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

      {/* Per-user override panel */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          My preferences
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Opt out of providers for your own account, even when your organization allows them.
          You can't enable a provider your organization has blocked.
        </p>

        {isLoadingOverrides && (
          <div className="py-2">
            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
          </div>
        )}

        {!isLoadingOverrides && PROVIDERS.map(p => {
          const orgBlocks   = !orgAllowed[p.key];
          const userOptedOut = overrides[p.key] === false;
          const eff = effective(p.key);

          return (
            <div
              key={p.key}
              className="flex items-center justify-between gap-3 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 rounded-lg"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{p.label}</p>
                  {eff && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                      active
                    </span>
                  )}
                  {!eff && orgBlocks && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-500 font-medium">
                      blocked by org
                    </span>
                  )}
                  {!eff && !orgBlocks && userOptedOut && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                      you opted out
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleOverride(p.key, !userOptedOut)}
                disabled={orgBlocks || isSavingOverrides}
                className="text-xs font-medium text-rose-500 hover:text-rose-600 disabled:text-zinc-400 disabled:cursor-not-allowed"
              >
                {userOptedOut ? 'Re-enable for me' : 'Opt out for me'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
