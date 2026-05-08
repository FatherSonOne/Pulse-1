import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Loader2, RefreshCw, MailWarning } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspacePermissions } from '../../../contexts/WorkspaceContext';
import { workspaceService, MemberConnectionRow } from '../../../services/workspaceService';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';

const PROVIDER_LABEL: Record<string, string> = {
  google:    'Google',
  microsoft: 'Microsoft',
  apple:     'Apple',
};

function relativeDate(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (d < 1)   return 'today';
  if (d < 7)   return `${d}d ago`;
  if (d < 30)  return `${Math.floor(d / 7)}w ago`;
  return new Date(iso).toLocaleDateString();
}

export const MemberConnectionsCard: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { isAdmin } = useWorkspacePermissions();

  const [rows, setRows] = useState<MemberConnectionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const data = await workspaceService.getMemberConnections(currentWorkspace.id);
      setRows(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load member connections';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, currentWorkspace?.id]);

  if (!isAdmin) return null;
  if (!currentWorkspace) return null;

  const totals = {
    members:     rows.length,
    connected:   rows.filter(r => r.providers.length > 0).length,
    unconnected: rows.filter(r => r.providers.length === 0).length,
  };

  return (
    <SettingsCard className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-zinc-500" />
          <MonoLabel>Member connections</MonoLabel>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-500 disabled:opacity-40"
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Which OAuth services each member has personally connected. Useful for compliance reviews and onboarding follow-up.
      </p>

      {!isLoading && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg">
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{totals.members}</p>
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 font-semibold">Members</p>
          </div>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{totals.connected}</p>
            <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-semibold">Connected</p>
          </div>
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{totals.unconnected}</p>
            <p className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400 font-semibold">Unconnected</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="py-6 text-center">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto" />
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="py-6 text-center text-xs text-zinc-400">
          No member data to show.
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 -mx-6 px-6 max-h-96 overflow-y-auto">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((m) => {
              const hasNone = m.providers.length === 0;
              return (
                <div key={m.user_id} className="py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center text-rose-500 dark:text-rose-400 text-xs font-semibold flex-shrink-0 overflow-hidden">
                    {m.user_avatar_url
                      ? <img src={m.user_avatar_url} alt="" className="w-full h-full object-cover" />
                      : (m.user_name || m.user_email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {m.user_name || m.user_email || m.user_id.slice(0, 8)}
                      </p>
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-zinc-400">
                        {m.user_role}
                      </span>
                    </div>
                    {m.user_email && m.user_name && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{m.user_email}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasNone ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                        <MailWarning className="w-3 h-3" />
                        none
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {m.providers.map(p => (
                          <span
                            key={p}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                          >
                            {PROVIDER_LABEL[p] ?? p}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-[10px] text-zinc-400 hidden sm:inline" title={m.last_connected_at ?? ''}>
                      {relativeDate(m.last_connected_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SettingsCard>
  );
};
