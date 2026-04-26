import React, { useState } from 'react';
import { FileDown, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabase';
import { settingsService } from '../../../services/settingsService';

// Tables we attempt to read for the export. RLS handles the per-user filtering;
// any 4xx/5xx (table missing, no permission) is swallowed and recorded in the
// export's _meta.errors block instead of breaking the whole export.
const EXPORT_TABLES: string[] = [
  'user_profiles',
  'user_sessions',
  'workspace_members',
  'workspace_invites',
  'workspace_groups',
  'workspace_group_members',
  'pulse_messages',
  'pulse_conversations',
  'decisions',
  'decision_tasks',
  'subtasks',
  'contacts',
  'contact_circles',
  'contact_circle_members',
  'contact_goals',
  'export_jobs',
  'pwa_push_subscriptions',
  'oauth_connected_apps',
  'event_rsvp',
  'booking_requests',
  'brainstorm_sessions',
];

type ExportMap = Record<string, unknown>;

async function buildExport(): Promise<{ data: ExportMap; errors: { table: string; error: string }[] }> {
  const data: ExportMap = {};
  const errors: { table: string; error: string }[] = [];

  await Promise.all(
    EXPORT_TABLES.map(async (table) => {
      try {
        const { data: rows, error } = await supabase
          .from(table)
          .select('*')
          .limit(10000);
        if (error) {
          errors.push({ table, error: error.message });
        } else {
          data[table] = rows ?? [];
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        errors.push({ table, error: msg });
      }
    }),
  );

  return { data, errors };
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const DataExportRequestCard: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport]   = useState<{ at: string; tables: number; bytes: number } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Gathering your data...');
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error('Not authenticated');

      const { data: tableData, errors } = await buildExport();
      const settings = await settingsService.getAll();

      const payload = {
        _meta: {
          generated_at: new Date().toISOString(),
          format_version: 1,
          gdpr_article: 'Article 20 — Right to data portability',
          user: {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
          },
          included_tables: Object.keys(tableData),
          errors,
        },
        settings,
        ...tableData,
      };

      const json = JSON.stringify(payload, null, 2);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`pulse-data-export-${stamp}.json`, payload);

      const tables = Object.keys(tableData).length;
      setLastExport({ at: new Date().toISOString(), tables, bytes: json.length });
      toast.success(`Export ready — ${tables} table${tables === 1 ? '' : 's'} included`, { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error(msg, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileDown className="w-4 h-4 text-zinc-500" />
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Export my data</h4>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Download a complete JSON copy of every record we hold for your account — profile, settings, messages,
        contacts, decisions, tasks, sessions, and more. Satisfies your right to data portability under GDPR Article 20.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <p><strong className="text-zinc-700 dark:text-zinc-300">Format:</strong> JSON</p>
        <p><strong className="text-zinc-700 dark:text-zinc-300">Location:</strong> Direct download to your device</p>
        <p><strong className="text-zinc-700 dark:text-zinc-300">Source:</strong> Live database (not cached)</p>
        <p><strong className="text-zinc-700 dark:text-zinc-300">Privacy:</strong> Never leaves your browser</p>
      </div>

      {lastExport && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Last export downloaded {new Date(lastExport.at).toLocaleString()} —
            {' '}{lastExport.tables} tables, {(lastExport.bytes / 1024).toFixed(1)} KB
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {isExporting ? 'Preparing export...' : 'Download my data'}
        </button>
      </div>
    </div>
  );
};
