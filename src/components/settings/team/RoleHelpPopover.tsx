import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, Check, Minus } from 'lucide-react';
import { PERMISSIONS, type PermissionRow, type RoleKey } from './RolePermissionsMatrixCard';

// 5 highest-signal rows from the canonical matrix — these are the
// permissions a workspace admin most frequently needs to reason about
// when picking an invite role. Selected by label-substring match so the
// popover stays in sync with the matrix card whenever its labels are
// renamed; if a match disappears the row silently drops out of the
// popover rather than throwing.
const HIGH_SIGNAL_LABELS = [
  'Invite new members',
  'Change member roles',
  'Remove members',
  'View plan & invoices',
  'Change plan / payment method',
] as const;

const highSignalRows: PermissionRow[] = HIGH_SIGNAL_LABELS
  .map(label => PERMISSIONS.find(p => p.label === label))
  .filter((p): p is PermissionRow => Boolean(p));

// The invite role select offers admin | member | viewer. The matrix card
// only knows owner | admin | member — viewer isn't in the canonical
// reference yet (tracked in #42). The popover surfaces admin + member from
// the matrix, then a hard-coded viewer column noted as read-only, so the
// asymmetry is visible to the user rather than silently hidden.
const VISIBLE_ROLES: { key: RoleKey | 'viewer'; label: string; color: string }[] = [
  { key: 'admin',  label: 'Admin',  color: 'text-amber-500' },
  { key: 'member', label: 'Member', color: 'text-zinc-500' },
  { key: 'viewer', label: 'Viewer', color: 'text-zinc-400' },
];

function hasPermission(row: PermissionRow, roleKey: RoleKey | 'viewer'): boolean {
  if (roleKey === 'viewer') return false;
  return row[roleKey];
}

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
 * Wired to the canonical matrix data via PERMISSIONS export, so when the
 * matrix gets re-rooted on the catalog tables in #42, this popover follows.
 */
export const RoleHelpPopover: React.FC<RoleHelpPopoverProps> = ({ triggerClassName }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
            <span className="text-[10px] text-zinc-400">5 key actions</span>
          </div>

          <table className="w-full text-[11px]">
            <thead>
              <tr>
                <th className="text-left font-medium text-zinc-500 dark:text-zinc-400 pb-1.5">
                  Action
                </th>
                {VISIBLE_ROLES.map(r => (
                  <th
                    key={r.key}
                    className={`text-center font-medium pb-1.5 px-1 ${r.color}`}
                    style={{ width: 36 }}
                  >
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {highSignalRows.map(row => (
                <tr key={row.label} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5 pr-2 text-zinc-700 dark:text-zinc-300 leading-tight">
                    {row.label}
                  </td>
                  {VISIBLE_ROLES.map(r => (
                    <td key={r.key} className="py-1.5 px-1 text-center">
                      <div className="flex justify-center">
                        <Cell allowed={hasPermission(row, r.key)} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">
            Viewer is read-only across the workspace. See the full Role permissions card
            below for every action.
          </p>
        </div>
      )}
    </div>
  );
};
