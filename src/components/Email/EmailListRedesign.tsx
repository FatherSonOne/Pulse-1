// EmailListRedesign.tsx - Modern email list with enhanced UI
import React, { useState, useCallback } from 'react';
import { CachedEmail, EmailFolder, EmailCategory } from '../../services/emailSyncService';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

import { Archive, Bookmark, Clock, Inbox, MailOpen, Paperclip, Trash2, Wand2 } from 'lucide-react';

interface EmailListRedesignProps {
  emails: CachedEmail[];
  selectedEmail: CachedEmail | null;
  loading: boolean;
  onEmailSelect: (email: CachedEmail) => void;
  onToggleStar: (email: CachedEmail) => void;
  onArchive: (email: CachedEmail) => void;
  onTrash: (email: CachedEmail) => void;
  currentFolder: EmailFolder;
  accentColor?: 'rose' | 'blue' | 'purple' | 'green';
  activeCategory?: EmailCategory;
  onCategoryChange?: (category: EmailCategory) => void;
  categoryCounts?: Record<string, number>;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export const EmailListRedesign: React.FC<EmailListRedesignProps> = ({
  emails,
  selectedEmail,
  loading,
  onEmailSelect,
  onToggleStar,
  onArchive,
  onTrash,
  currentFolder,
  activeCategory,
  onCategoryChange,
  categoryCounts,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) => {
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Per-row star-pop animation key — increments only on star (not unstar) for that row
  const [starPopKeys, setStarPopKeys] = useState<Record<string, number>>({});

  const toggleSelect = useCallback((emailId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId);
      else next.add(emailId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)));
    }
  }, [emails, selectedIds.size]);

  const runBulkAction = useCallback(async (action: string, params?: Record<string, any>) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';
      const response = await fetch(`${backendUrl}/api/email/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emailIds: Array.from(selectedIds), action, params }),
      });
      if (!response.ok) throw new Error('Bulk action failed');
      toast.success(`${action} applied to ${selectedIds.size} email${selectedIds.size > 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      // Refresh will happen via parent
    } catch (err) {
      toast.error('Bulk action failed');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds]);

  // Format relative time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  // Get initials for avatar
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  // Neutral tinted avatars — coral is reserved for state, not decoration.
  // Each sender gets a single muted hue; varies for scannability without competing with the accent.
  const getAvatarColor = (email: string) => {
    const palette = [
      'bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300',
      'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
      'bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
      'bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200',
      'bg-stone-100 text-stone-700 dark:bg-zinc-900 dark:text-zinc-300',
    ];
    const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palette[hash % palette.length];
  };

  // Category badge — mono uppercase chip, neutral fill (status palette is reserved for status state)
  const getCategoryBadge = (email: CachedEmail) => {
    if (!email.ai_category) return null;
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-white/[0.06] text-stone-600 dark:text-zinc-400">
        {email.ai_category}
      </span>
    );
  };

  // High-priority indicator — single status hue (overdue red), used as a state mark, not decoration
  const getPriorityDot = (email: CachedEmail) => {
    if (email.ai_priority_score && email.ai_priority_score >= 70) {
      return (
        <span
          className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"
          title={`Priority: ${email.ai_priority_score}`}
          aria-label="High priority"
        />
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-transparent">
        <div className="text-center">
          <div className="relative w-10 h-10 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-rose-500/15"></div>
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-rose-500 animate-spin"></div>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">Loading</p>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    const isInboxZero = currentFolder === 'inbox';
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-transparent p-8">
        <div className="text-center max-w-sm">
          {isInboxZero ? (
            // Milestone moment: triage achieved. Rose halo + mono badge + confident next-move.
            <>
              <div className="relative w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                <span
                  className="pulse-email-zero-halo absolute inset-0 rounded-full bg-rose-500/15 dark:bg-rose-500/20"
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-2 rounded-full bg-rose-500/10 dark:bg-rose-500/15"
                  aria-hidden="true"
                />
                <Inbox className="w-6 h-6 text-rose-500 relative" strokeWidth={1.75} />
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400 mb-3">
                Inbox · Zero
              </div>
              <h3 className="text-lg font-light text-stone-900 dark:text-white tracking-tight mb-1.5">
                You're caught up.
              </h3>
              <p className="text-sm text-stone-500 dark:text-zinc-500 max-w-[34ch] mx-auto">
                Nothing waiting. Use this window for the work that needs you.
              </p>
            </>
          ) : (
            <>
              <Inbox className="w-8 h-8 text-stone-300 dark:text-zinc-700 mx-auto mb-5" strokeWidth={1.5} />
              <h3 className="text-lg font-light text-stone-900 dark:text-white tracking-tight mb-2">
                Nothing in {currentFolder}.
              </h3>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                Empty for now. Check back later.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto bg-white dark:bg-transparent min-h-0 h-0 scroll-smooth"
      role="listbox"
      aria-label={`Email list - ${currentFolder}`}
    >
      {/* Sticky Header: Tabs + Bulk Actions — solid, no backdrop-blur (reserved for modals) */}
      <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800">
        {/* Category Filter (Inbox Only) — mono chip row, breaks the Gmail-tab metaphor */}
        {currentFolder === 'inbox' && activeCategory && onCategoryChange && (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-stone-100 dark:border-zinc-800/60 overflow-x-auto" role="tablist" aria-label="Inbox categories">
            {(['primary', 'promotions', 'social', 'updates'] as const).map((cat) => {
              const isActive = activeCategory === cat;
              const count = categoryCounts?.[cat] || 0;
              const labels = {
                primary: { label: 'Primary', description: "Personal emails and messages that don't appear in other tabs." },
                promotions: { label: 'Promos', description: 'Marketing, newsletters, and other promotional emails.' },
                social: { label: 'Social', description: 'Notifications from social networks and media sites.' },
                updates: { label: 'Updates', description: 'Confirmations, receipts, bills, and statements.' },
              }[cat];

              return (
                <button
                  key={cat}
                  onClick={() => onCategoryChange(cat as EmailCategory)}
                  title={labels.description}
                  className={`group flex items-center gap-1.5 h-7 px-2.5 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 ${
                    isActive
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'text-stone-500 dark:text-zinc-500 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-800 dark:hover:text-zinc-200'
                  }`}
                  role="tab"
                  aria-selected={isActive}
                >
                  <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${isActive ? 'font-medium' : ''}`}>
                    {labels.label}
                  </span>
                  {count > 0 && (
                    <span className={`font-mono text-[10px] tabular-nums ${
                      isActive ? 'text-rose-600 dark:text-rose-400' : 'text-stone-400 dark:text-zinc-600'
                    }`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Bulk Actions Toolbar — quiet idle, prominent only when something is selected */}
        <div className={`flex items-center gap-3 px-5 h-10 transition-colors ${
          selectedIds.size > 0 ? 'bg-rose-500/[0.04] dark:bg-rose-500/[0.06]' : ''
        }`}>
          <input
            type="checkbox"
            checked={selectedIds.size > 0 && selectedIds.size === emails.length}
            onChange={toggleSelectAll}
            aria-label="Select all emails"
            className="w-3.5 h-3.5 rounded border-stone-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-rose-500 focus:ring-rose-500/30"
          />

          {selectedIds.size > 0 ? (
            <>
              <div className="h-4 w-px bg-stone-200 dark:bg-zinc-700"></div>
              <button
                type="button"
                onClick={() => runBulkAction('archive')}
                disabled={bulkLoading}
                className="w-7 h-7 rounded hover:bg-stone-100 dark:hover:bg-white/[0.06] flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white transition disabled:opacity-40"
                title="Archive selected"
                aria-label="Archive selected emails"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => runBulkAction('delete')}
                disabled={bulkLoading}
                className="w-7 h-7 rounded hover:bg-stone-100 dark:hover:bg-white/[0.06] flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:text-red-500 transition disabled:opacity-40"
                title="Delete selected"
                aria-label="Delete selected emails"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => runBulkAction('markAsRead')}
                disabled={bulkLoading}
                className="w-7 h-7 rounded hover:bg-stone-100 dark:hover:bg-white/[0.06] flex items-center justify-center text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white transition disabled:opacity-40"
                title="Mark as read"
                aria-label="Mark selected emails as read"
              >
                <MailOpen className="w-3.5 h-3.5" />
              </button>
            </>
          ) : null}

          <div className="flex-1"></div>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums text-stone-500 dark:text-zinc-500" aria-live="polite">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `${emails.length} ${emails.length === 1 ? 'email' : 'emails'}`}
          </span>
        </div>
      </div>

      {/* Email items */}
      <div className="divide-y divide-stone-100 dark:divide-zinc-800/60" role="list">
        {emails.map((email) => {
          const isSelected = selectedEmail?.id === email.id;
          const priorityDot = getPriorityDot(email);

          return (
            <div
              key={email.id}
              onClick={() => onEmailSelect(email)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEmailSelect(email);
                }
              }}
              role="option"
              aria-selected={isSelected}
              tabIndex={0}
              aria-label={`${email.is_read ? '' : 'Unread email. '}From ${email.from_name || email.from_email}. Subject: ${email.subject || 'No subject'}. ${email.is_starred ? 'Starred.' : ''}`}
              className={`group relative flex items-start gap-3 pl-5 pr-4 py-3 cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:bg-stone-50 dark:focus-visible:bg-white/[0.04] ${
                isSelected
                  ? 'bg-rose-500/[0.06] dark:bg-rose-500/[0.08]'
                  : email.is_read
                    ? 'hover:bg-stone-50 dark:hover:bg-white/[0.025]'
                    : 'hover:bg-stone-50 dark:hover:bg-white/[0.025]'
              }`}
            >
              {/* Selected mark — 2px coral leading bar (replaces forbidden side-stripe) */}
              {isSelected && (
                <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-rose-500" aria-hidden="true" />
              )}

              {/* Unread dot — fades out when read, single signal */}
              <span
                className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-rose-500 transition-opacity duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none ${
                  !email.is_read && !isSelected ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden="true"
              />

              {/* Checkbox */}
              <div className="pt-[3px]" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(email.id)}
                  onChange={() => toggleSelect(email.id)}
                  className="w-3.5 h-3.5 rounded border-stone-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-rose-500 focus:ring-rose-500/30 transition"
                />
              </div>

              {/* Star */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!email.is_starred) {
                    setStarPopKeys((prev) => ({ ...prev, [email.id]: (prev[email.id] ?? 0) + 1 }));
                  }
                  onToggleStar(email);
                }}
                className={`pt-[3px] transition-colors ${
                  email.is_starred
                    ? 'text-amber-500'
                    : 'text-stone-300 dark:text-zinc-700 hover:text-amber-500'
                }`}
                title={email.is_starred ? 'Unstar' : 'Star'}
              >
                <i
                  key={starPopKeys[email.id] ?? 0}
                  className={`fa-${email.is_starred ? 'solid' : 'regular'} fa-star text-[13px] inline-block ${
                    (starPopKeys[email.id] ?? 0) > 0 ? 'pulse-email-star-pop' : ''
                  }`}
                />
              </button>

              {/* Avatar — neutral tint, mono initials */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-[11px] tracking-wider font-medium flex-shrink-0 ${getAvatarColor(email.from_email)}`}>
                {getInitials(email.from_name, email.from_email)}
              </div>

              {/* Content — tight internal spacing, generous between content & meta */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  {priorityDot}
                  <span className={`text-sm truncate flex-1 tracking-tight ${
                    !email.is_read
                      ? 'font-semibold text-stone-900 dark:text-white'
                      : 'font-normal text-stone-700 dark:text-zinc-300'
                  }`}>
                    {email.from_name || email.from_email}
                  </span>
                  {email.is_important && (
                    <Bookmark className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  )}
                  {email.has_attachments && (
                    <Paperclip className="w-3 h-3 text-stone-400 dark:text-zinc-500 flex-shrink-0" />
                  )}
                  {getCategoryBadge(email)}
                </div>

                <div className={`text-sm truncate ${
                  !email.is_read
                    ? 'text-stone-900 dark:text-white font-medium'
                    : 'text-stone-700 dark:text-zinc-400'
                }`}>
                  {email.subject || '(no subject)'}
                </div>

                <div className="text-[13px] text-stone-500 dark:text-zinc-500 truncate leading-relaxed">
                  {email.snippet || email.body_text?.substring(0, 100)}
                </div>

                {/* AI Summary preview — provenance tag style, mono prefix */}
                {email.ai_summary && (
                  <div className="mt-2 flex items-start gap-2 text-xs">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-rose-600 dark:text-rose-400 mt-[2px] flex-shrink-0 inline-flex items-center gap-1">
                      <Wand2 className="w-2.5 h-2.5" />
                      AI
                    </span>
                    <span className="truncate text-stone-600 dark:text-zinc-400 leading-relaxed">
                      {email.ai_summary}
                    </span>
                  </div>
                )}
              </div>

              {/* Time and actions — meta column */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0 self-start pt-[3px] min-w-[44px]">
                <span className={`font-mono text-[10px] tabular-nums tracking-wider uppercase ${
                  !email.is_read
                    ? 'text-stone-900 dark:text-white'
                    : 'text-stone-400 dark:text-zinc-600'
                }`}>
                  {formatTime(email.received_at)}
                </span>

                {/* Hover actions */}
                <div className="flex items-center gap-px opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onArchive(email); }}
                    className="w-7 h-7 rounded hover:bg-white dark:hover:bg-white/[0.06] flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-stone-900 dark:hover:text-white transition"
                    title="Archive"
                  >
                    <Archive className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onTrash(email); }}
                    className="w-7 h-7 rounded hover:bg-white dark:hover:bg-white/[0.06] flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-red-500 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <button
                    className="w-7 h-7 rounded hover:bg-white dark:hover:bg-white/[0.06] flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-stone-900 dark:hover:text-white transition"
                    title="Snooze"
                  >
                    <Clock className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More — quiet ghost link, generous margin */}
      {hasMore && onLoadMore && (
        <div className="px-5 py-8 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-50 disabled:hover:text-stone-500"
          >
            {loadingMore ? (
              <span className="inline-flex items-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i>
                Loading
              </span>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default EmailListRedesign;
