import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Check, Minus } from 'lucide-react';
import { useWorkspaceData } from '../../../contexts/WorkspaceContext';
import { usePermissionMatrix } from '../../../hooks/usePermissionMatrix';

// 5 highest-signal permission keys an invite-time admin reasons about.
// Keys (not labels) so the popover stays stable across copy edits.
const HIGH_SIGNAL_KEYS = [
  'members.invite',
  'members.update_role',
  'members.remove',
  'billing.read',
  'billing.write',
] as const;

// The invite role select offers admin | member | viewer — owner is excluded
// since owners are minted via Transfer, never invite. We show the same three
// columns from the catalog matrix so what's in the popover is what the
// matrix card shows below.
const VISIBLE_ROLE_KEYS = ['admin', 'member', 'viewer'] as const;
const ROLE_COLORS: Record<string, string> = {
  admin:  'text-amber-500',
  member: 'text-zinc-500',
  viewer: 'text-zinc-400',
};

function Cell({ allowed }: { allowed: boolean }): React.ReactElement {
  return allowed ? (
    <Check className="w-3 h-3 text-emerald-500" aria-label="Allowed" />
  ) : (
    <Minus className="w-3 h-3 text-zinc-300 dark:text-zinc-600" aria-label="Not allowed" />
  );
}

interface RoleHelpPopoverProps {
  /** Optional class for the trigger button (e.g. to align with sibling inputs). */
  triggerClassName?: string;
}

/**
 * Inline help popover next to a role <select>. Click the (?) icon to reveal
 * a compact 5-row × 3-role grid showing what each role can do for the most
 * common admin actions. Closes on outside click and Escape.
 *
 * Reads the same catalog tables (permissions / workspace_roles /
 * role_permissions) as RolePermissionsMatrixCard, so the popover and the
 * full matrix can never drift.
 */
export const RoleHelpPopover: React.FC<RoleHelpPopoverProps> = ({ triggerClassName }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace } = useWorkspaceData();
  const { rows, roles } = usePermissionMatrix(currentWorkspace?.id ?? null);

  const highSignalRows = useMemo(() => {
    const byKey = new Map(rows.map(r => [r.key, r] as const));
    return HIGH_SIGNAL_KEYS
      .map(k => byKey.get(k))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [rows]);

  const visibleRoles = useMemo(() => {
    const byKey = new Map(roles.map(r => [r.key, r] as const));
    return VISIBLE_ROLE_KEYS
      .map(k => byKey.get(k))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [roles]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Hide role permissions help' : 'Show role permissions help'}
        aria-expanded={open}
        className={
          triggerClassName ??
          'h-full px-2.5 inline-flex items-center justify-center text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition'
        }
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Role permissions summary"
          className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-3 text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 dark:text-zinc-400"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Role help
            </span>
            <span className="text-[10px] text-zinc-400">
              {highSignalRows.length || 5} key actions
            </span>
          </div>

          {highSignalRows.length === 0 || visibleRoles.length === 0 ? (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 py-3 text-center">
              Loading role help…
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  <th className="text-left font-medium text-zinc-500 dark:text-zinc-400 pb-1.5">
                    Action
                  </th>
                  {visibleRoles.map(r => (
                    <th
                      key={r.key}
                      className={`text-center font-medium pb-1.5 px-1 ${ROLE_COLORS[r.key] ?? 'text-zinc-500'}`}
                      style={{ width: 36 }}
                    >
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {highSignalRows.map(row => (
                  <tr key={row.key} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-2 text-zinc-700 dark:text-zinc-300 leading-tight">
                      {row.label}
                    </td>
                    {visibleRoles.map(r => (
                      <td key={r.key} className="py-1.5 px-1 text-center">
                        <div className="flex justify-center">
                          <Cell allowed={row.roles[r.key] ?? false} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">
            See the full Role permissions card below for every action.
          </p>
        </div>
      )}
    </div>
  );
};
