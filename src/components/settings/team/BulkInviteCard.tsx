import React, { useState, useMemo } from 'react';
import { Upload, Loader2, AlertCircle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaceService } from '../../../services/workspaceService';

const VALID_ROLES = new Set(['admin', 'member', 'viewer']);
type InviteRole = 'admin' | 'member' | 'viewer';

interface ParsedRow {
  line: number;
  raw: string;
  email?: string;
  role?: InviteRole;
  error?: string;
}

interface Props {
  workspaceId: string;
  workspaceName: string;
  onInvitesSent: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsv(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    // Skip a header row if it looks like one
    if (i === 0 && /^email\s*[,;]\s*role/i.test(trimmed)) continue;

    const parts = trimmed.split(/[,;\t]/).map(p => p.trim());
    const email = (parts[0] || '').toLowerCase();
    const roleRaw = (parts[1] || 'member').toLowerCase();

    if (!email) {
      rows.push({ line: i + 1, raw: trimmed, error: 'missing email' });
      continue;
    }
    if (!EMAIL_REGEX.test(email)) {
      rows.push({ line: i + 1, raw: trimmed, error: `invalid email: ${email}` });
      continue;
    }
    if (!VALID_ROLES.has(roleRaw)) {
      rows.push({ line: i + 1, raw: trimmed, error: `invalid role "${roleRaw}" (use admin / member / viewer)` });
      continue;
    }
    rows.push({ line: i + 1, raw: trimmed, email, role: roleRaw as InviteRole });
  }
  return rows;
}

export const BulkInviteCard: React.FC<Props> = ({ workspaceId, workspaceName, onInvitesSent }) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<{ ok: number; failed: { email: string; reason: string }[] } | null>(null);

  const parsed = useMemo(() => parseCsv(text), [text]);
  const validRows  = parsed.filter(r => !r.error);
  const errorRows  = parsed.filter(r => r.error);

  // Dedupe — last entry wins for any given email
  const dedupedValid = useMemo(() => {
    const map = new Map<string, ParsedRow>();
    for (const row of validRows) if (row.email) map.set(row.email, row);
    return Array.from(map.values());
  }, [validRows]);

  const handleSend = async () => {
    if (dedupedValid.length === 0) return;
    setIsSending(true);
    setResults(null);
    let ok = 0;
    const failed: { email: string; reason: string }[] = [];

    for (const row of dedupedValid) {
      try {
        const { emailDelivery } = await workspaceService.inviteMember(
          workspaceId,
          row.email!,
          row.role!,
          { workspaceName },
        );
        if (emailDelivery.ok) {
          ok++;
        } else {
          failed.push({
            email: row.email!,
            reason: `email failed (${emailDelivery.reason ?? 'unknown'}) — share link manually`,
          });
        }
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message.replace(/^\[workspaceService\]\s*/, '') : 'failed';
        failed.push({ email: row.email!, reason });
      }
    }

    setResults({ ok, failed });
    setIsSending(false);

    if (ok > 0) toast.success(`Sent ${ok} invite${ok === 1 ? '' : 's'}`);
    if (failed.length > 0) toast.error(`${failed.length} invite${failed.length === 1 ? '' : 's'} failed — see details below`);

    if (ok > 0 && failed.length === 0) setText('');
    onInvitesSent();
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="w-4 h-4 text-zinc-500" />
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Bulk invite</h4>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Paste one entry per line: <code className="text-zinc-600 dark:text-zinc-400">email,role</code>.
        Role is optional and defaults to <code>member</code>. Allowed: <code>admin</code>, <code>member</code>, <code>viewer</code>.
      </p>

      <div>
        <label htmlFor="bulk-invite-csv" className="sr-only">CSV invite list</label>
        <textarea
          id="bulk-invite-csv"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'alice@acme.com,admin\nbob@acme.com,member\ncarol@acme.com'}
          rows={6}
          spellCheck={false}
          className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-y focus:outline-none focus:ring-2 focus:ring-rose-500/50"
        />
      </div>

      {/* Live parse summary */}
      {(dedupedValid.length > 0 || errorRows.length > 0) && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {dedupedValid.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="w-3 h-3" /> {dedupedValid.length} valid
            </span>
          )}
          {dedupedValid.length !== validRows.length && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              {validRows.length - dedupedValid.length} duplicate{validRows.length - dedupedValid.length === 1 ? '' : 's'} ignored
            </span>
          )}
          {errorRows.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
              <AlertCircle className="w-3 h-3" /> {errorRows.length} error{errorRows.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )}

      {errorRows.length > 0 && (
        <div className="max-h-32 overflow-y-auto bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-3 space-y-1">
          {errorRows.slice(0, 8).map(r => (
            <p key={r.line} className="text-[11px] text-red-600 dark:text-red-400 font-mono">
              Line {r.line}: {r.error}
            </p>
          ))}
          {errorRows.length > 8 && (
            <p className="text-[11px] text-red-500">...and {errorRows.length - 8} more</p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || dedupedValid.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {isSending ? `Sending ${dedupedValid.length}...` : `Send ${dedupedValid.length || ''} invite${dedupedValid.length === 1 ? '' : 's'}`.trim()}
        </button>
      </div>

      {results && (results.ok > 0 || results.failed.length > 0) && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-2">
          {results.ok > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ {results.ok} invite{results.ok === 1 ? '' : 's'} sent successfully
            </p>
          )}
          {results.failed.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {results.failed.map((f, i) => (
                <p key={i} className="text-[11px] text-red-500 font-mono">
                  {f.email}: {f.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
