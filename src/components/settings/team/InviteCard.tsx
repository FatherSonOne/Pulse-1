import React, { useState, useMemo } from 'react';
import { Send, Loader2, AlertCircle, Check, Mail, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaceService } from '../../../services/workspaceService';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';
import { RoleHelpPopover } from './RoleHelpPopover';

type InviteRole = 'admin' | 'member' | 'viewer';
const VALID_ROLES = new Set<InviteRole>(['admin', 'member', 'viewer']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ParsedRow {
  line: number;
  raw: string;
  email?: string;
  role?: InviteRole;
  error?: string;
}

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
    const roleRaw = (parts[1] || 'member').toLowerCase() as InviteRole;

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
    rows.push({ line: i + 1, raw: trimmed, email, role: roleRaw });
  }
  return rows;
}

interface InviteCardProps {
  workspaceId: string;
  workspaceName: string;
  onInvitesSent: () => void;
  /** From ?focus=invite deep-link handler in parent — drives the rose ring/highlight. */
  isFocused: boolean;
  /** Parent-owned ref so the focus useEffect can scroll the card into view. */
  cardRef: React.RefObject<HTMLDivElement>;
  /** Parent-owned ref so the focus useEffect can autofocus the email input. */
  emailInputRef: React.RefObject<HTMLInputElement>;
}

type InviteMode = 'single' | 'bulk';

/**
 * Unified invite card. Replaces the previous setup of inline single-invite
 * JSX in TeamSettings.tsx + a separate BulkInviteCard. Single is the
 * default mode; a "Paste many" toggle swaps to the textarea/CSV path.
 *
 * Why one card: by the second day in a workspace, an admin either invites
 * one colleague or pastes the whole company roster. Two separate cards
 * was a duplicate affordance that pushed the Members list (the dominant
 * day-2 task) further down the page.
 */
export const InviteCard: React.FC<InviteCardProps> = ({
  workspaceId,
  workspaceName,
  onInvitesSent,
  isFocused,
  cardRef,
  emailInputRef,
}) => {
  const [mode, setMode] = useState<InviteMode>('single');

  // Single mode state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('member');
  const [isInviting, setIsInviting] = useState(false);

  // Bulk mode state
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<{ ok: number; failed: { email: string; reason: string }[] } | null>(null);

  const parsed = useMemo(() => parseCsv(text), [text]);
  const validRows = parsed.filter(r => !r.error);
  const errorRows = parsed.filter(r => r.error);
  const dedupedValid = useMemo(() => {
    const map = new Map<string, ParsedRow>();
    for (const row of validRows) if (row.email) map.set(row.email, row);
    return Array.from(map.values());
  }, [validRows]);

  const handleSingleInvite = async () => {
    if (!inviteEmail || !workspaceId) return;
    setIsInviting(true);
    try {
      const { isResend, emailDelivery } = await workspaceService.inviteMember(
        workspaceId,
        inviteEmail,
        inviteRole,
        { workspaceName },
      );
      if (emailDelivery.ok) {
        toast.success(isResend ? `Re-sent invite to ${inviteEmail}` : `Invite sent to ${inviteEmail}`);
      } else {
        toast.error(
          `Invite created but email couldn't be delivered (${emailDelivery.reason ?? 'unknown'}). Copy the link from Pending Invites and share it manually.`,
          { duration: 8000 },
        );
      }
      setInviteEmail('');
      setInviteRole('member');
      onInvitesSent();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send invite';
      toast.error(msg);
    } finally {
      setIsInviting(false);
    }
  };

  const handleBulkSend = async () => {
    if (dedupedValid.length === 0 || !workspaceId) return;
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
    <div
      ref={cardRef}
      className="scroll-mt-4 rounded-2xl transition-shadow"
      style={{
        boxShadow: isFocused ? '0 0 0 3px rgba(244, 63, 94, 0.45)' : 'none',
      }}
    >
      <SettingsCard className="space-y-4">
        {/* Header + mode toggle */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <MonoLabel className="flex items-center gap-2">
            {mode === 'single' ? <Mail className="w-3.5 h-3.5 text-zinc-400" /> : <FileText className="w-3.5 h-3.5 text-zinc-400" />}
            {mode === 'single' ? 'Invite new member' : 'Invite many'}
          </MonoLabel>
          <div
            role="tablist"
            aria-label="Invite mode"
            className="inline-flex p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'single'}
              onClick={() => setMode('single')}
              className={`px-2.5 py-1 rounded-md transition ${
                mode === 'single'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Single
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'bulk'}
              onClick={() => setMode('bulk')}
              className={`px-2.5 py-1 rounded-md transition ${
                mode === 'bulk'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Paste many
            </button>
          </div>
        </div>

        {/* Single mode */}
        {mode === 'single' && (
          <div className="flex gap-2 flex-wrap">
            <input
              ref={emailInputRef}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="flex-1 min-w-[240px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:outline-none focus:border-rose-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSingleInvite()}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as InviteRole)}
              aria-label="Invite role"
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 dark:text-white text-zinc-900 text-sm focus:outline-none focus:border-rose-500"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <RoleHelpPopover />
            <button
              type="button"
              onClick={handleSingleInvite}
              disabled={!inviteEmail || isInviting}
              className="px-6 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </div>
        )}

        {/* Bulk mode */}
        {mode === 'bulk' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Paste one entry per line: <code className="text-zinc-600 dark:text-zinc-400">email,role</code>.
              Role is optional (defaults to <code>member</code>). Allowed: <code>admin</code>, <code>member</code>, <code>viewer</code>.
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
                onClick={handleBulkSend}
                disabled={isSending || dedupedValid.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
        )}
      </SettingsCard>
    </div>
  );
};
