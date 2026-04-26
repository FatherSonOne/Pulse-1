import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Loader2, Users, UserCheck, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspacePermissions } from '../../../contexts/WorkspaceContext';
import {
  workspaceService,
  WorkspaceIntegration,
  IntegrationKey,
  IntegrationScope,
} from '../../../services/workspaceService';

interface IntegrationDef {
  key:         IntegrationKey;
  label:       string;
  description: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  { key: 'slack',           label: 'Slack',           description: 'Mirror Slack channels into Pulse and post outbound messages.' },
  { key: 'gmail',           label: 'Gmail',           description: 'Sync inbound mail and send via Gmail.' },
  { key: 'google_calendar', label: 'Google Calendar', description: 'Two-way calendar sync.' },
  { key: 'google_drive',    label: 'Google Drive',    description: 'Attach Drive files in messages and emails.' },
  { key: 'microsoft',       label: 'Microsoft 365',   description: 'Outlook mail, calendar, and Teams.' },
  { key: 'twilio',          label: 'Twilio',          description: 'Send SMS through Pulse.' },
  { key: 'zapier',          label: 'Zapier',          description: 'Forward Pulse events to other tools.' },
];

export const OrgIntegrationsCard: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { isAdmin } = useWorkspacePermissions();

  const [rows, setRows] = useState<Record<IntegrationKey, WorkspaceIntegration | null>>(() => ({
    slack: null, gmail: null, google_calendar: null, google_drive: null,
    microsoft: null, twilio: null, zapier: null,
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey]     = useState<IntegrationKey | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const list = await workspaceService.getWorkspaceIntegrations(currentWorkspace.id);
      const map = { ...rows };
      INTEGRATIONS.forEach(i => { map[i.key] = list.find(r => r.integration_key === i.key) ?? null; });
      setRows(map);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load integration policy';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id]);

  useEffect(() => { load(); }, [load]);

  if (!currentWorkspace) return null;

  const updateRow = async (key: IntegrationKey, patch: Partial<Pick<WorkspaceIntegration, 'scope' | 'is_enabled'>>) => {
    setBusyKey(key);
    try {
      const current = rows[key];
      const next = await workspaceService.upsertWorkspaceIntegration(currentWorkspace.id, key, {
        scope:       patch.scope       ?? current?.scope       ?? 'per_user',
        is_enabled:  patch.is_enabled  ?? current?.is_enabled  ?? true,
      });
      setRows(prev => ({ ...prev, [key]: next }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update integration';
      toast.error(msg);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-zinc-500" />
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Org-managed integrations</h4>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Choose how each integration is wired up: members connect their own accounts, or an admin connects once
        and all members share the connection.
      </p>

      {isLoading && (
        <div className="py-6 text-center">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto" />
        </div>
      )}

      {!isLoading && (
        <div className="space-y-2">
          {INTEGRATIONS.map((def) => {
            const row = rows[def.key];
            const scope:   IntegrationScope = row?.scope      ?? 'per_user';
            const enabled: boolean          = row?.is_enabled ?? true;
            const ScopeIcon = scope === 'shared' ? UserCheck : Users;

            return (
              <div
                key={def.key}
                className={`flex items-start gap-3 p-3 border rounded-lg transition ${
                  enabled
                    ? 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800'
                    : 'bg-zinc-100/50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{def.label}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300">
                      <ScopeIcon className="w-3 h-3" />
                      {scope === 'shared' ? 'shared' : 'per-user'}
                    </span>
                    {!enabled && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full bg-zinc-300 dark:bg-zinc-700 text-zinc-500">
                        disabled
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{def.description}</p>
                  {scope === 'shared' && row?.connected_by && (
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Connected by {row.connected_by.slice(0, 8)}...
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <select
                      value={scope}
                      onChange={(e) => updateRow(def.key, { scope: e.target.value as IntegrationScope })}
                      disabled={busyKey === def.key}
                      aria-label={`${def.label} scope`}
                      className="text-[11px] px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                    >
                      <option value="per_user">Per-user</option>
                      <option value="shared">Shared</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => updateRow(def.key, { is_enabled: !enabled })}
                      disabled={busyKey === def.key}
                      className={`p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-40 ${
                        enabled ? 'text-emerald-500' : 'text-zinc-400'
                      }`}
                      title={enabled ? 'Disable for org' : 'Enable for org'}
                      aria-label={enabled ? 'Disable' : 'Enable'}
                    >
                      {busyKey === def.key
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Power className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isAdmin && (
        <p className="text-[11px] text-zinc-400">
          Contact an admin to change how integrations are scoped for this organization.
        </p>
      )}
    </div>
  );
};
