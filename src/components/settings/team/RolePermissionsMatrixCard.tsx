import React, { useState } from 'react';
import { ShieldCheck, Check, Minus, ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';
import { useWorkspaceData } from '../../../contexts/WorkspaceContext';
import {
  usePermissionMatrix,
  type PermissionMatrixRow,
  type PermissionMatrixRole,
} from '../../../hooks/usePermissionMatrix';

// Re-exported so RoleHelpPopover and any future consumers can share types
// without re-importing from the hook directly.
export type { PermissionMatrixRow as PermissionRow, PermissionMatrixRole };
export type RoleKey = string;

const ROLE_COLORS: Record<string, string> = {
  owner:  'text-rose-500',
  admin:  'text-amber-500',
  member: 'text-zinc-500',
  viewer: 'text-zinc-400',
};

const roleColor = (key: string): string => ROLE_COLORS[key] ?? 'text-zinc-500';

function Cell({ allowed }: { allowed: boolean }): React.ReactElement {
  return allowed ? (
    <Check className="w-4 h-4 text-emerald-500" aria-label="Allowed" />
  ) : (
    <Minus className="w-4 h-4 text-zinc-300 dark:text-zinc-600" aria-label="Not allowed" />
  );
}

export const RolePermissionsMatrixCard: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const { currentWorkspace } = useWorkspaceData();
  const { rows, roles, isLoading, error } = usePermissionMatrix(currentWorkspace?.id ?? null);

  const categories: string[] = Array.from(new Set(rows.map(r => r.category)));

  return (
    <SettingsCard padded={false} className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-zinc-500" />
          <MonoLabel>Role permissions</MonoLabel>
        </div>
        <span className="flex items-center gap-1 text-xs text-zinc-400">
          {expanded ? 'Hide' : 'Show'}
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Read-only summary of what each role can do in this workspace. Loaded from the
            permission catalog — drift between this matrix and what the database enforces
            should never appear here.
          </p>

          {isLoading && rows.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading role permissions…</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-900/10 border border-rose-200/60 dark:border-rose-900/40 rounded-md p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Couldn't load role permissions: {error}</span>
            </div>
          )}

          {!isLoading && !error && rows.length > 0 && (
            <>
              {/* Desktop: full matrix table */}
              <div className="hidden md:block">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left">
                      <th className="font-semibold text-zinc-500 dark:text-zinc-400 pb-2 pr-4">Permission</th>
                      {roles.map(r => (
                        <th
                          key={r.key}
                          className={`font-semibold pb-2 px-2 text-center ${roleColor(r.key)}`}
                          style={{ minWidth: 60 }}
                        >
                          {r.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(cat => (
                      <React.Fragment key={cat}>
                        <tr>
                          <td colSpan={1 + roles.length} className="pt-3 pb-1 text-[10px] uppercase tracking-widest font-bold text-zinc-400">
                            {cat}
                          </td>
                        </tr>
                        {rows.filter(r => r.category === cat).map(row => (
                          <tr key={row.key} className="border-t border-zinc-100 dark:border-zinc-800">
                            <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                              {row.label}
                              {row.description && (
                                <span className="block text-[10px] text-zinc-400 font-normal mt-0.5">{row.description}</span>
                              )}
                            </td>
                            {roles.map(r => (
                              <td key={r.key} className="py-2 px-2 text-center">
                                <div className="flex justify-center">
                                  <Cell allowed={row.roles[r.key] ?? false} />
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards grouped by category, role chips per row */}
              <div className="md:hidden space-y-4">
                {categories.map(cat => (
                  <div key={cat}>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2">
                      {cat}
                    </div>
                    <div className="space-y-2">
                      {rows.filter(r => r.category === cat).map(row => (
                        <div
                          key={row.key}
                          className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900"
                        >
                          <p className="text-xs text-zinc-900 dark:text-white font-medium leading-snug">
                            {row.label}
                          </p>
                          {row.description && (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                              {row.description}
                            </p>
                          )}
                          <div className="flex gap-1.5 mt-2.5">
                            {roles.map(r => {
                              const allowed = row.roles[r.key] ?? false;
                              return (
                                <div
                                  key={r.key}
                                  className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border text-[11px] font-medium ${
                                    allowed
                                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-900/20'
                                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40'
                                  }`}
                                >
                                  <Cell allowed={allowed} />
                                  <span className={roleColor(r.key)}>{r.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </SettingsCard>
  );
};
