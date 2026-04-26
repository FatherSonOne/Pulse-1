import React, { useState, useEffect } from 'react';
import {
  Scale,
  FileText,
  MapPin,
  Download,
  Lock,
  AlertTriangle,
  Mail,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspaceActions, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import { workspaceService, AuditLogEntry } from '../../services/workspaceService';

const DPA_URL = '/legal/pulse-dpa.pdf';
const DPA_REQUEST_EMAIL = 'legal@quantumecosystems.com';

// Region info comes from VITE_SUPABASE_REGION if set, otherwise we display a
// generic line. Set this in .env to surface the actual region to customers.
const SUPABASE_REGION =
  (import.meta.env.VITE_SUPABASE_REGION as string | undefined) || 'Multi-region (managed by Supabase)';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function auditLogToCsv(entries: AuditLogEntry[]): string {
  const header = ['id', 'created_at', 'workspace_id', 'actor_id', 'action', 'target_id', 'metadata'];
  const rows = entries.map(e => [
    e.id,
    e.created_at,
    e.workspace_id,
    e.actor_id,
    e.action,
    e.target_id ?? '',
    e.metadata ? JSON.stringify(e.metadata) : '',
  ]);
  return [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ComplianceSettings: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { updateWorkspace } = useWorkspaceActions();
  const { isAdmin, isOwner } = useWorkspacePermissions();

  const [legalHold, setLegalHold] = useState(currentWorkspace?.legal_hold ?? false);
  const [isTogglingHold, setIsTogglingHold] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Probe whether the DPA PDF is actually deployed. If not, fall back to
  // the email-request button — matches the hybrid plan from the handoff.
  const [dpaAvailable, setDpaAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLegalHold(currentWorkspace.legal_hold ?? false);
  }, [currentWorkspace?.id, currentWorkspace?.legal_hold]);

  useEffect(() => {
    let cancelled = false;
    fetch(DPA_URL, { method: 'HEAD' })
      .then(r => { if (!cancelled) setDpaAvailable(r.ok); })
      .catch(() => { if (!cancelled) setDpaAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  if (!currentWorkspace) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm p-6">
        No organization selected.
      </div>
    );
  }

  const handleExportAuditLog = async () => {
    setIsExporting(true);
    try {
      const entries = await workspaceService.getAuditLog(currentWorkspace.id, 1000);
      if (entries.length === 0) {
        toast('No audit entries to export.');
        return;
      }
      const csv = auditLogToCsv(entries);
      const stamp = new Date().toISOString().slice(0, 10);
      const safeSlug = (currentWorkspace.slug || currentWorkspace.id).slice(0, 40);
      downloadCsv(`audit-log-${safeSlug}-${stamp}.csv`, csv);
      toast.success(`Exported ${entries.length} audit entries`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export audit log';
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleLegalHold = async () => {
    const next = !legalHold;
    if (next) {
      const confirmed = window.confirm(
        'Enable legal hold? While active, the organization cannot be permanently deleted, even by the owner. ' +
        'Use this for litigation, audits, or regulatory investigations.',
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        'Disable legal hold? Permanent deletion will be possible again. ' +
        'Only do this once any active investigation or audit is closed.',
      );
      if (!confirmed) return;
    }

    setIsTogglingHold(true);
    try {
      await updateWorkspace(currentWorkspace.id, { legal_hold: next });
      setLegalHold(next);
      toast.success(next ? 'Legal hold enabled' : 'Legal hold disabled');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update legal hold';
      toast.error(msg);
    } finally {
      setIsTogglingHold(false);
    }
  };

  const dpaMailto = `mailto:${DPA_REQUEST_EMAIL}?subject=${encodeURIComponent(
    `DPA Request — ${currentWorkspace.name}`,
  )}&body=${encodeURIComponent(
    `Hello,\n\nWe would like to receive the Data Processing Agreement for ${currentWorkspace.name}.\n\nThanks.`,
  )}`;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
          <Scale className="w-5 h-5 text-rose-500" />
          Compliance
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Data processing agreements, audit log export, data residency, and legal hold.
        </p>
      </div>

      {/* DPA */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-500" />
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Data Processing Agreement</h4>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Our DPA describes how Quantum Ecosystems processes your organization's personal data under GDPR.
          Includes the current subprocessor list and technical &amp; organizational measures.
        </p>

        {dpaAvailable === null && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability...
          </div>
        )}

        {dpaAvailable === true && (
          <a
            href={DPA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            Download DPA (PDF)
          </a>
        )}

        {dpaAvailable === false && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                DPA is not yet published. Use the request button below and we'll send you a copy by email.
              </p>
            </div>
            <a
              href={dpaMailto}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition"
            >
              <Mail className="w-4 h-4" />
              Request DPA by email
            </a>
          </div>
        )}
      </div>

      {/* Data residency */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-zinc-500" />
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Data residency</h4>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Where your organization's data is stored and processed. See the DPA Schedule 1 for the full subprocessor list.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400 font-semibold mb-1">Primary region</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">{SUPABASE_REGION}</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400 font-semibold mb-1">Database provider</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Supabase (Postgres)</p>
          </div>
        </div>
        <p className="text-[11px] text-zinc-400">
          Cross-border transfers (e.g. to AI subprocessors in the United States) are governed by the
          EU Standard Contractual Clauses where applicable.
        </p>
      </div>

      {/* Audit log export */}
      {isAdmin && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-500" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Audit log export</h4>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Download up to the last 1,000 audit entries as CSV — useful for compliance reviews and
            incident reporting. The full log remains available in the Organization section.
          </p>
          <button
            type="button"
            onClick={handleExportAuditLog}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
            ) : (
              <><Download className="w-4 h-4" /> Export Audit Log (CSV)</>
            )}
          </button>
        </div>
      )}

      {/* Legal hold — owner only */}
      {isOwner && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-zinc-500" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Legal hold</h4>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            When enabled, the organization cannot be permanently deleted — even by the owner.
            Use this during litigation, audits, or regulatory investigations to preserve evidence.
            Soft-delete (archive) is still allowed; only the irreversible hard-delete is blocked.
          </p>

          {legalHold && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Legal hold is <strong>active</strong>. Permanent deletion is currently blocked at the database level.
              </p>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={legalHold}
              onChange={handleToggleLegalHold}
              disabled={isTogglingHold}
              className="w-4 h-4 mt-0.5 text-rose-500 border-zinc-300 rounded focus:ring-rose-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-white">
                Enable legal hold for this organization
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                You will be asked to confirm before the change takes effect.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Footer link to subprocessors */}
      <div className="text-xs text-zinc-400 flex items-center gap-1.5">
        <ExternalLink className="w-3 h-3" />
        Subprocessor list lives in Schedule 1 of the DPA.
      </div>
    </div>
  );
};
