import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Send, Loader2, AlertCircle, Check, Mail, FileText, Upload, X, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaceService } from '../../../services/workspaceService';
import { useWorkspaceMutationLock } from '../../../contexts/WorkspaceContext';
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

const ROLE_META: Record<InviteRole, { label: string; tone: string; hint: string }> = {
  admin:  { label: 'Admin',  tone: 'text-amber-600 dark:text-amber-400', hint: 'Manage members, billing, and settings' },
  member: { label: 'Member', tone: 'text-zinc-700 dark:text-zinc-300',   hint: 'Default workspace access' },
  viewer: { label: 'Viewer', tone: 'text-zinc-500 dark:text-zinc-400',   hint: 'Read-only access' },
};

interface RoleSelectorProps {
  value: InviteRole;
  onChange: (next: InviteRole) => void;
  disabled?: boolean;
}

/** Custom role dropdown matching the member-row role chip pattern in
 *  TeamSettings.tsx. Replaces the underdeveloped native <select> so the
 *  invite row looks at home next to the rest of the team UI. */
const RoleSelector: React.FC<RoleSelectorProps> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = ROLE_META[value];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Invite role: ${current.label}`}
        className="h-full inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-600 transition disabled:opacity-50"
      >
        <span className={current.tone}>{current.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Invite role"
          className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 overflow-hidden"
        >
          {(['admin', 'member', 'viewer'] as const).map((key) => {
            const meta = ROLE_META[key];
            const selected = key === value;
            return (
              <li key={key} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { onChange(key); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-start gap-2 ${
                    selected ? 'bg-rose-50/60 dark:bg-rose-500/10' : ''
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${selected ? 'text-rose-500' : 'text-transparent'}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${meta.tone}`}>{meta.label}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">{meta.hint}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

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
  const { acquireMutationLock } = useWorkspaceMutationLock();
  const [mode, setMode] = useState<InviteMode>('single');

  // Single mode state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('member');
  const [isInviting, setIsInviting] = useState(false);

  // Bulk mode state
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<{ ok: number; failed: { email: string; reason: string }[] } | null>(null);

  // CSV file upload state — same parser path as paste, just sourced from a file.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Cap file size at 1 MB. A CSV with one email per ~30 bytes is ~30k rows
  // at that ceiling — orders of magnitude past any realistic invite batch.
  const MAX_FILE_SIZE = 1_000_000;

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large (${Math.round(file.size / 1024)} KB). Max 1 MB.`);
      return;
    }
    // Be permissive about file type — some browsers report '' or
    // 'application/vnd.ms-excel' for legitimate CSVs.
    if (file.type && !/csv|text|plain/i.test(file.type)) {
      toast.error(`Unsupported file type: ${file.type}. Use .csv or .txt.`);
      return;
    }
    try {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
      setResults(null);
    } catch {
      toast.error('Could not read file');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset the input so re-selecting the same file fires onChange again.
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clearLoadedFile = () => {
    setFileName(null);
    setText('');
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
    // F1: snapshot workspaceId + acquire lock so the workspace switcher
    // disables until this completes. workspaceId came in as a prop so the
    // closure already captures the value at call time, but read into a
    // local for clarity.
    const wsId = workspaceId;
    const release = acquireMutationLock();
    setIsInviting(true);
    try {
      const { isResend, emailDelivery } = await workspaceService.inviteMember(
        wsId,
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
      release();
    }
  };

  const handleBulkSend = async () => {
    if (dedupedValid.length === 0 || !workspaceId) return;
    // F1: snapshot workspaceId + hold the lock across the whole batch
    // loop so the switcher stays disabled until every invite resolves.
    const wsId = workspaceId;
    const release = acquireMutationLock();
    setIsSending(true);
    setResults(null);
    let ok = 0;
    const failed: { email: string; reason: string }[] = [];

    for (const row of dedupedValid) {
      try {
        const { emailDelivery } = await workspaceService.inviteMember(
          wsId,
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
    release();

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

        {/* Single mode — email gets a dedicated full-width row; role + help +
            send sit on the second row so nothing competes with the input for
            click/focus area. */}
        {mode === 'single' && (
          <div className="space-y-2.5">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                ref={emailInputRef}
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                autoComplete="email"
                spellCheck={false}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-sm dark:text-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSingleInvite(); }}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <RoleSelector
                value={inviteRole}
                onChange={setInviteRole}
                disabled={isInviting}
              />
              <RoleHelpPopover />
              <button
                type="button"
                onClick={handleSingleInvite}
                disabled={!inviteEmail || isInviting}
                className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send invite
              </button>
            </div>
          </div>
        )}

        {/* Bulk mode */}
        {mode === 'bulk' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 flex-1 min-w-[200px]">
                Paste, drag a CSV in, or click Upload. One entry per line:{' '}
                <code className="text-zinc-600 dark:text-zinc-400">email,role</code>.
                Role defaults to <code>member</code>. Allowed: <code>admin</code>, <code>member</code>, <code>viewer</code>.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={handleFileInputChange}
                className="sr-only"
                aria-label="Upload CSV file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition"
              >
                <Upload className="w-3 h-3" />
                Upload CSV
              </button>
            </div>

            {fileName && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                <FileText className="w-3 h-3 text-zinc-400" />
                <span className="font-mono truncate">{fileName}</span>
                <button
                  type="button"
                  onClick={clearLoadedFile}
                  aria-label="Clear loaded file"
                  className="ml-auto text-zinc-400 hover:text-rose-500 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-lg transition ${
                isDragging
                  ? 'ring-2 ring-rose-500/60 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900'
                  : ''
              }`}
            >
              <label htmlFor="bulk-invite-csv" className="sr-only">CSV invite list</label>
              <textarea
                id="bulk-invite-csv"
                value={text}
                onChange={(e) => { setText(e.target.value); if (fileName) setFileName(null); }}
                placeholder={'alice@acme.com,admin\nbob@acme.com,member\ncarol@acme.com'}
                rows={6}
                spellCheck={false}
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-y focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              />
              {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-rose-50/90 dark:bg-rose-500/10 pointer-events-none">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-medium text-sm">
                    <Upload className="w-4 h-4" />
                    Drop CSV to load
                  </div>
                </div>
              )}
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
