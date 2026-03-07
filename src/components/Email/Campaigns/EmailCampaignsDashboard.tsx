// src/components/Email/Campaigns/EmailCampaignsDashboard.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  EmailCampaign,
  emailCampaignService,
} from '../../../services/emailCampaignService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  onNewCampaign: () => void;
  onEditCampaign: (campaign: EmailCampaign) => void;
}

type StatusFilter = 'all' | 'draft' | 'scheduled' | 'sent';

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

let toastCounter = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return { toasts, addToast };
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<EmailCampaign['status'], string> = {
  draft: 'bg-zinc-700/20 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-300',
  scheduled: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  sending: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  sent: 'bg-green-500/20 text-green-600 dark:text-green-400',
  paused: 'bg-red-500/20 text-red-600 dark:text-red-400',
};

const STATUS_LABELS: Record<EmailCampaign['status'], string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
};

function StatusBadge({ status }: { status: EmailCampaign['status'] }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Rate display
// ---------------------------------------------------------------------------

function formatRate(numerator: number, denominator: number): string {
  if (!denominator) return '—';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Row-level delete confirmation state
// ---------------------------------------------------------------------------

function useDeleteConfirm() {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const request = useCallback((id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirmId(id);
    // Auto-cancel after 5 s so the UI doesn't get stuck
    timerRef.current = setTimeout(() => setConfirmId(null), 5000);
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirmId(null);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { confirmId, request, cancel };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const EmailCampaignsDashboard: React.FC<Props> = ({
  onNewCampaign,
  onEditCampaign,
}) => {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());

  const { toasts, addToast } = useToasts();
  const { confirmId, request: requestDelete, cancel: cancelDelete } = useDeleteConfirm();

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    emailCampaignService
      .list()
      .then((data) => { if (!cancelled) setCampaigns(data); })
      .catch((err) => {
        if (!cancelled) addToast('error', err?.message ?? 'Failed to load campaigns');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [addToast]);

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filtered = campaigns.filter((c) => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'sent' ? c.status === 'sent' : c.status === statusFilter);
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.subject ?? '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  // -------------------------------------------------------------------------
  // Duplicate
  // -------------------------------------------------------------------------

  const handleDuplicate = useCallback(
    async (id: string) => {
      setMutatingIds((prev) => new Set(prev).add(id));
      try {
        const copy = await emailCampaignService.duplicate(id);
        setCampaigns((prev) => [copy, ...prev]);
        addToast('success', 'Campaign duplicated');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to duplicate campaign';
        addToast('error', msg);
      } finally {
        setMutatingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [addToast],
  );

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  const handleDelete = useCallback(
    async (id: string) => {
      cancelDelete();
      setMutatingIds((prev) => new Set(prev).add(id));
      try {
        await emailCampaignService.delete(id);
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
        addToast('success', 'Campaign deleted');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete campaign';
        addToast('error', msg);
      } finally {
        setMutatingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [addToast, cancelDelete],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'sent', label: 'Sent' },
  ];

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-zinc-100">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between px-6 py-4 bg-stone-50 dark:bg-zinc-950 border-b border-stone-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Campaigns</h2>
          <p className="text-sm text-stone-500 dark:text-zinc-400 mt-0.5">
            Create, manage, and track your email campaigns
          </p>
        </div>
        <button
          onClick={onNewCampaign}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-rose-500 to-red-500 text-white text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
        >
          <i className="fa-solid fa-plus text-xs" />
          New Campaign
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Toolbar: search + status tabs                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-3 border-b border-stone-200 dark:border-zinc-800">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-zinc-500 text-xs pointer-events-none" />
          <input
            type="text"
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 placeholder-stone-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-lg p-1">
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === key
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          /* Loading spinner */
          <div className="flex items-center justify-center h-64">
            <i className="fa-solid fa-spinner animate-spin text-2xl text-rose-500" />
          </div>
        ) : campaigns.length === 0 ? (
          /* Empty state — no campaigns at all */
          <EmptyState onNewCampaign={onNewCampaign} />
        ) : filtered.length === 0 ? (
          /* No results for current filter */
          <div className="flex flex-col items-center justify-center h-64 text-stone-500 dark:text-zinc-400">
            <i className="fa-solid fa-envelope-open text-3xl mb-3 opacity-40" />
            <p className="text-sm">No campaigns match your filters.</p>
            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); }}
              className="mt-3 text-xs text-rose-500 dark:text-rose-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Campaign table */
          <CampaignTable
            campaigns={filtered}
            confirmId={confirmId}
            mutatingIds={mutatingIds}
            onEdit={onEditCampaign}
            onDuplicate={handleDuplicate}
            onRequestDelete={requestDelete}
            onConfirmDelete={handleDelete}
            onCancelDelete={cancelDelete}
          />
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Toast stack                                                         */}
      {/* ------------------------------------------------------------------ */}
      <ToastStack toasts={toasts} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// CampaignTable
// ---------------------------------------------------------------------------

interface TableProps {
  campaigns: EmailCampaign[];
  confirmId: string | null;
  mutatingIds: Set<string>;
  onEdit: (c: EmailCampaign) => void;
  onDuplicate: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

const CampaignTable: React.FC<TableProps> = ({
  campaigns,
  confirmId,
  mutatingIds,
  onEdit,
  onDuplicate,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) => {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-medium text-stone-500 dark:text-zinc-400 uppercase tracking-wider border-b border-stone-200 dark:border-zinc-800">
          <th className="px-6 py-3">Campaign</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3 hidden md:table-cell">Segment</th>
          <th className="px-4 py-3 hidden lg:table-cell">Open Rate</th>
          <th className="px-4 py-3 hidden lg:table-cell">Click Rate</th>
          <th className="px-4 py-3 hidden md:table-cell">Sent</th>
          <th className="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/60">
        {campaigns.map((campaign) => {
          const isMutating = mutatingIds.has(campaign.id);
          const isConfirming = confirmId === campaign.id;
          const openRate = formatRate(campaign.stats.opened, campaign.stats.delivered);
          const clickRate = formatRate(campaign.stats.clicked, campaign.stats.delivered);

          return (
            <tr
              key={campaign.id}
              className={`group transition-colors hover:bg-stone-50 dark:hover:bg-zinc-900/40 ${
                isMutating ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {/* Campaign name + subject */}
              <td className="px-6 py-3">
                <div className="font-medium text-stone-900 dark:text-zinc-100 truncate max-w-[220px]">
                  {campaign.name}
                </div>
                {campaign.subject && (
                  <div className="text-xs text-stone-500 dark:text-zinc-400 truncate max-w-[220px] mt-0.5">
                    {campaign.subject}
                  </div>
                )}
              </td>

              {/* Status badge */}
              <td className="px-4 py-3 whitespace-nowrap">
                <StatusBadge status={campaign.status} />
              </td>

              {/* Segment */}
              <td className="px-4 py-3 hidden md:table-cell text-stone-600 dark:text-zinc-300 whitespace-nowrap">
                {campaign.segment_name || '—'}
              </td>

              {/* Open rate */}
              <td className="px-4 py-3 hidden lg:table-cell text-stone-600 dark:text-zinc-300 whitespace-nowrap tabular-nums">
                {openRate}
              </td>

              {/* Click rate */}
              <td className="px-4 py-3 hidden lg:table-cell text-stone-600 dark:text-zinc-300 whitespace-nowrap tabular-nums">
                {clickRate}
              </td>

              {/* Sent date */}
              <td className="px-4 py-3 hidden md:table-cell text-stone-500 dark:text-zinc-400 whitespace-nowrap">
                {formatDate(campaign.sent_at)}
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  {isConfirming ? (
                    /* Inline delete confirmation */
                    <>
                      <button
                        onClick={() => onConfirmDelete(campaign.id)}
                        className="px-2.5 py-1 rounded-md bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={onCancelDelete}
                        className="px-2.5 py-1 rounded-md bg-stone-200 dark:bg-zinc-700 text-stone-700 dark:text-zinc-200 text-xs font-medium hover:bg-stone-300 dark:hover:bg-zinc-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    /* Normal action icons */
                    <>
                      {/* Edit */}
                      <ActionButton
                        title="Edit campaign"
                        icon="fa-pen"
                        onClick={() => onEdit(campaign)}
                      />
                      {/* Duplicate */}
                      <ActionButton
                        title="Duplicate campaign"
                        icon="fa-copy"
                        onClick={() => onDuplicate(campaign.id)}
                      />
                      {/* Delete */}
                      <ActionButton
                        title="Delete campaign"
                        icon="fa-trash"
                        onClick={() => onRequestDelete(campaign.id)}
                        danger
                      />
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// ---------------------------------------------------------------------------
// ActionButton
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  title: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ title, icon, onClick, danger }) => (
  <button
    title={title}
    onClick={onClick}
    className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
      danger
        ? 'text-stone-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
        : 'text-stone-400 dark:text-zinc-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10'
    }`}
  >
    <i className={`fa-solid ${icon}`} />
  </button>
);

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

const EmptyState: React.FC<{ onNewCampaign: () => void }> = ({ onNewCampaign }) => (
  <div className="flex flex-col items-center justify-center h-64 text-center px-6">
    <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
      <i className="fa-solid fa-envelope-open text-2xl text-rose-500 dark:text-rose-400" />
    </div>
    <h3 className="text-base font-semibold text-stone-900 dark:text-zinc-100 mb-1">
      No campaigns yet
    </h3>
    <p className="text-sm text-stone-500 dark:text-zinc-400 mb-5 max-w-xs">
      Campaigns let you send targeted emails to segments of your audience. Get started by creating your first one.
    </p>
    <button
      onClick={onNewCampaign}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-rose-500 to-red-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
    >
      Create your first campaign
      <i className="fa-solid fa-arrow-right text-xs" />
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// ToastStack
// ---------------------------------------------------------------------------

const ToastStack: React.FC<{ toasts: Toast[] }> = ({ toasts }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium pointer-events-auto animate-fade-in ${
            t.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          <i
            className={`fa-solid ${
              t.type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'
            } text-xs`}
          />
          {t.message}
        </div>
      ))}
    </div>
  );
};

export default EmailCampaignsDashboard;
