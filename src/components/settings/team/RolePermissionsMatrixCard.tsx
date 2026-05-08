import React, { useState } from 'react';
import { ShieldCheck, Check, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';

type RoleKey = 'owner' | 'admin' | 'member';

interface PermissionRow {
  category: string;
  label: string;
  description?: string;
  owner: boolean;
  admin: boolean;
  member: boolean;
}

const ROLE_LABELS: Record<RoleKey, string> = {
  owner:  'Owner',
  admin:  'Admin',
  member: 'Member',
};

const ROLE_COLORS: Record<RoleKey, string> = {
  owner:  'text-rose-500',
  admin:  'text-amber-500',
  member: 'text-zinc-500',
};

// Truth table — what each role can do today.
// To add a custom role, extend this matrix and add a column to the table.
const PERMISSIONS: PermissionRow[] = [
  // Use product
  { category: 'Use product',    label: 'Sign in and use the workspace',  owner: true,  admin: true,  member: true },
  { category: 'Use product',    label: 'Send messages, voxes, and use AI', owner: true,  admin: true,  member: true },
  { category: 'Use product',    label: 'Connect personal integrations',   owner: true,  admin: true,  member: true,
    description: 'Per-user OAuth connections (Gmail, Calendar, etc.)' },

  // Members & invites
  { category: 'Members',        label: 'View team roster',                owner: true,  admin: true,  member: true },
  { category: 'Members',        label: 'Invite new members',              owner: true,  admin: true,  member: false },
  { category: 'Members',        label: 'Bulk invite via CSV',             owner: true,  admin: true,  member: false },
  { category: 'Members',        label: 'Change member roles',             owner: true,  admin: true,  member: false,
    description: 'Cannot change owner role — only the owner can transfer ownership.' },
  { category: 'Members',        label: 'Remove members',                  owner: true,  admin: true,  member: false },
  { category: 'Members',        label: 'Create / manage groups',          owner: true,  admin: true,  member: false },

  // Org settings
  { category: 'Organization',   label: 'Edit org profile (name, logo, etc.)', owner: true, admin: true, member: false },
  { category: 'Organization',   label: 'Manage membership policy (auto-join)', owner: true, admin: true, member: false },
  { category: 'Organization',   label: 'Manage shared integrations',      owner: true,  admin: true,  member: false },
  { category: 'Organization',   label: 'Archive (soft-delete) workspace', owner: true,  admin: true,  member: false },
  { category: 'Organization',   label: 'Transfer ownership',              owner: true,  admin: false, member: false },
  { category: 'Organization',   label: 'Permanently delete workspace',    owner: true,  admin: false, member: false,
    description: 'Blocked while legal hold is active.' },

  // Security
  { category: 'Security',       label: 'View sign-in activity (all members)', owner: true, admin: true, member: false },
  { category: 'Security',       label: 'Configure 2FA / session / IP allowlist', owner: true, admin: true, member: false },
  { category: 'Security',       label: 'Enroll personal 2FA',             owner: true,  admin: true,  member: true },

  // Billing
  { category: 'Billing',        label: 'View plan & invoices',            owner: true,  admin: true,  member: false },
  { category: 'Billing',        label: 'Change plan / payment method',    owner: true,  admin: false, member: false },

  // Compliance
  { category: 'Compliance',     label: 'View audit log',                  owner: true,  admin: true,  member: false },
  { category: 'Compliance',     label: 'Export audit log (CSV)',          owner: true,  admin: true,  member: false },
  { category: 'Compliance',     label: 'Toggle legal hold',               owner: true,  admin: false, member: false },
];

const CATEGORIES: string[] = Array.from(new Set(PERMISSIONS.map(p => p.category)));

function Cell({ allowed }: { allowed: boolean }): React.ReactElement {
  return allowed ? (
    <Check className="w-4 h-4 text-emerald-500" aria-label="Allowed" />
  ) : (
    <Minus className="w-4 h-4 text-zinc-300 dark:text-zinc-600" aria-label="Not allowed" />
  );
}

export const RolePermissionsMatrixCard: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

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
            Read-only summary of what each role can do today. Custom roles aren't supported yet —
            this serves as the canonical reference until they are.
          </p>

          {/* Header row */}
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="text-left">
                  <th className="font-semibold text-zinc-500 dark:text-zinc-400 pb-2 pr-4">Permission</th>
                  {(Object.keys(ROLE_LABELS) as RoleKey[]).map(k => (
                    <th key={k} className={`font-semibold pb-2 px-2 text-center ${ROLE_COLORS[k]}`} style={{ minWidth: 60 }}>
                      {ROLE_LABELS[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(cat => (
                  <React.Fragment key={cat}>
                    <tr>
                      <td colSpan={4} className="pt-3 pb-1 text-[10px] uppercase tracking-widest font-bold text-zinc-400">
                        {cat}
                      </td>
                    </tr>
                    {PERMISSIONS.filter(p => p.category === cat).map((p, i) => (
                      <tr key={`${cat}-${i}`} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                          {p.label}
                          {p.description && (
                            <span className="block text-[10px] text-zinc-400 font-normal mt-0.5">{p.description}</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center"><div className="flex justify-center"><Cell allowed={p.owner} /></div></td>
                        <td className="py-2 px-2 text-center"><div className="flex justify-center"><Cell allowed={p.admin} /></div></td>
                        <td className="py-2 px-2 text-center"><div className="flex justify-center"><Cell allowed={p.member} /></div></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SettingsCard>
  );
};
