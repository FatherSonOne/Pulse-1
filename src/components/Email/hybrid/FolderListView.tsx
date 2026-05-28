// FolderListView — Cockpit-shell content when currentFolder !== 'inbox'.
// Single full-width list with bulk-select, per-row hover actions, and a
// folder-specific empty state. The briefing + signal sections + right rail
// all hide here per handoff §5.4 — bulk power-user workflows replace them.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Archive, Trash2, MailOpen, Star, MoonStar, X } from 'lucide-react';
import { useEmailStore } from '../../../store/emailStore';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../store/emailComposeStore';
import { supabase } from '../../../services/supabase';
import { BACKEND_URL } from '../../../config/backend';
import { Avatar } from './primitives';
import { ComposeFab } from './cockpit/ComposeFab';
import { FOLDER_META } from './data/folderMeta';
import { cachedEmailToRow } from './data/emailRow';
import type { CachedEmail } from '../../../services/emailSyncService';

type BulkAction = 'archive' | 'delete' | 'markAsRead';

export const FolderListView: React.FC = () => {
  const currentFolder = useEmailStore((s) => s.currentFolder);
  const emails = useEmailStore((s) => s.emails);
  const loading = useEmailStore((s) => s.loading);

  const handleArchive = useEmailStore((s) => s.handleArchive);
  const handleTrash = useEmailStore((s) => s.handleTrash);
  const handleToggleStar = useEmailStore((s) => s.handleToggleStar);
  const setSelectedEmail = useEmailStore((s) => s.setSelectedEmail);

  const openCompose = useEmailComposeStore((s) => s.openCompose);
  const setSnoozeTargetEmailId = useEmailUIStore((s) => s.setSnoozeTargetEmailId);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Drop selection whenever the folder changes underneath us.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentFolder]);

  const meta = FOLDER_META[currentFolder];
  const selectedCount = selectedIds.size;
  const allSelected = selectedCount > 0 && selectedCount === emails.length;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(emails.map((e) => e.id)));
  }, [allSelected, emails]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const runBulk = useCallback(async (action: BulkAction) => {
    if (selectedIds.size === 0) return;
    if (action === 'delete') {
      const ok = window.confirm(
        `Move ${selectedIds.size} selected email${selectedIds.size === 1 ? '' : 's'} to trash?`,
      );
      if (!ok) return;
    }
    setBulkLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/email/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emailIds: Array.from(selectedIds), action }),
      });
      if (!res.ok) throw new Error('Bulk action failed');
      const label =
        action === 'archive' ? 'Archived' :
        action === 'delete'  ? 'Moved to trash' :
        'Marked as read';
      toast.success(`${label}: ${selectedIds.size} email${selectedIds.size > 1 ? 's' : ''}`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Couldn't update selected emails. Try again.");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds]);

  const handleRowClick = useCallback((email: CachedEmail) => {
    // Stash in selectedEmail so the Cockpit-side viewer can still react;
    // inline expansion inside FolderListView lands in a later polish pass.
    setSelectedEmail(email);
  }, [setSelectedEmail]);

  const empty = !loading && emails.length === 0;

  const headerCheckboxLabel = allSelected
    ? 'Deselect all'
    : selectedCount > 0
      ? `${selectedCount} selected — click to select all`
      : 'Select all';

  const sortedEmails = useMemo(
    () => [...emails].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()),
    [emails],
  );

  return (
    <div className="h-full w-full overflow-y-auto relative">
      {/* Header */}
      <div className="px-10 pt-8 pb-5 border-b pulse-border-color">
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-rose-color">FOLDER</div>
          <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">
            {emails.length} EMAILS
          </div>
        </div>
        <h1 className="cockpit-headline pulse-ink-color text-[28px] leading-tight tracking-tight">
          {meta.label}
        </h1>
      </div>

      {/* Bulk action strip — only when items selected */}
      {selectedCount > 0 && (
        <div
          className="sticky top-0 z-10 flex items-center gap-3 px-10 py-2 border-b pulse-border-color"
          style={{ background: 'var(--pulse-canvas-soft)' }}
        >
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] pulse-ink-2-color hover:pulse-surface-raised"
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
            <span>{selectedCount} selected</span>
          </button>
          <button
            type="button"
            onClick={() => runBulk('archive')}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] pulse-ink-color border pulse-border-color hover:pulse-surface-raised disabled:opacity-50"
          >
            <Archive className="w-3.5 h-3.5" />Archive
          </button>
          <button
            type="button"
            onClick={() => runBulk('markAsRead')}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] pulse-ink-color border pulse-border-color hover:pulse-surface-raised disabled:opacity-50"
          >
            <MailOpen className="w-3.5 h-3.5" />Mark read
          </button>
          <button
            type="button"
            onClick={() => runBulk('delete')}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] pulse-ink-color border pulse-border-color hover:pulse-surface-raised disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />Delete
          </button>
          {bulkLoading && <Loader2 className="w-3.5 h-3.5 animate-spin pulse-ink-3-color ml-1" />}
        </div>
      )}

      {/* List body */}
      {loading && (
        <div className="px-10 py-20 flex flex-col items-center gap-3 pulse-ink-3-color">
          <Loader2 className="w-5 h-5 animate-spin" />
          <div className="text-[12px] font-mono-pulse tracking-wide-mono uppercase">Loading {meta.label}…</div>
        </div>
      )}

      {empty && (
        <div className="px-10 py-20 text-center">
          <div className="cockpit-headline text-[20px] pulse-ink-color mb-2">{meta.empty.title}</div>
          <div className="text-[13px] pulse-ink-2-color max-w-md mx-auto">{meta.empty.body}</div>
        </div>
      )}

      {!loading && !empty && (
        <div className="px-10 py-4">
          {/* Select-all row */}
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label={headerCheckboxLabel}
              title={headerCheckboxLabel}
              className="w-4 h-4 accent-rose-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono-pulse pulse-ink-3-color tracking-wide-mono uppercase">
              {selectedCount > 0
                ? `${selectedCount} of ${emails.length} selected`
                : `${emails.length} ${emails.length === 1 ? 'email' : 'emails'}`}
            </span>
          </div>

          <div className="border pulse-border-color rounded-xl overflow-hidden">
            {sortedEmails.map((email, idx) => {
              const row = cachedEmailToRow(email);
              const selected = selectedIds.has(email.id);
              return (
                <div
                  key={email.id}
                  className={`selectable-row group flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
                    idx > 0 ? 'border-t pulse-border-color' : ''
                  }`}
                  onClick={() => handleRowClick(email)}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleOne(email.id)}
                    aria-label={`Select email from ${row.from}`}
                    className="w-4 h-4 accent-rose-500 cursor-pointer shrink-0"
                  />
                  <Avatar name={row.from} size={26} />
                  <span className="text-[12.5px] pulse-ink-color truncate min-w-[140px]">{row.from}</span>
                  <span className="text-[12.5px] pulse-ink-2-color truncate flex-1">
                    {row.subject}
                    {email.snippet && (
                      <span className="pulse-ink-3-color"> · {email.snippet.slice(0, 60)}</span>
                    )}
                  </span>
                  {/* Per-row hover actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleToggleStar(email); }}
                      className={`p-1 rounded hover:pulse-rose-bg-soft-color ${email.is_starred ? 'pulse-rose-color' : 'pulse-ink-3-color'}`}
                      title="Star / unstar"
                      aria-label={email.is_starred ? `Unstar email from ${row.from}` : `Star email from ${row.from}`}
                    >
                      <Star className="w-3.5 h-3.5" fill={email.is_starred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleArchive(email); }}
                      className="p-1 rounded hover:pulse-rose-bg-soft-color pulse-ink-3-color"
                      title="Archive"
                      aria-label={`Archive email from ${row.from}`}
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSnoozeTargetEmailId(email.id); }}
                      className="p-1 rounded hover:pulse-rose-bg-soft-color pulse-ink-3-color"
                      title="Snooze"
                      aria-label={`Snooze email from ${row.from}`}
                    >
                      <MoonStar className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleTrash(email); }}
                      className="p-1 rounded hover:pulse-rose-bg-soft-color pulse-ink-3-color"
                      title="Move to trash"
                      aria-label={`Move email from ${row.from} to trash`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum shrink-0 w-12 text-right">{row.when}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ComposeFab onClick={openCompose} />
    </div>
  );
};

export default FolderListView;
