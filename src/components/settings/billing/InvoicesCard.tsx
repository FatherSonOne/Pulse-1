import React, { useState, useMemo } from 'react';
import { ScrollText, ExternalLink, FileText, Filter } from 'lucide-react';
import type { Invoice } from '../../../services/billingService';

type StatusFilter = 'all' | 'paid' | 'open' | 'void' | 'uncollectible' | 'draft';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all',           label: 'All' },
  { value: 'paid',          label: 'Paid' },
  { value: 'open',          label: 'Open' },
  { value: 'void',          label: 'Void' },
  { value: 'uncollectible', label: 'Uncollectible' },
];

const STATUS_COLORS: Record<string, string> = {
  paid:          'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  open:          'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  draft:         'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
  void:          'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
  uncollectible: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (start && end)  return `${fmt(start)} – ${fmt(end)}`;
  return fmt((start || end)!);
}

interface Props {
  invoices: Invoice[];
}

export const InvoicesCard: React.FC<Props> = ({ invoices }) => {
  const [filter, setFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return invoices;
    return invoices.filter(inv => inv.status === filter);
  }, [invoices, filter]);

  const totalPaid = useMemo(
    () => invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount_paid || 0), 0),
    [invoices],
  );
  const totalOutstanding = useMemo(
    () => invoices.filter(i => i.status === 'open' || i.status === 'uncollectible')
      .reduce((sum, i) => sum + (i.amount_due - i.amount_paid), 0),
    [invoices],
  );
  const currency = invoices[0]?.currency || 'usd';

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-6 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-zinc-500" />
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Invoice history</h4>
          <span className="text-[11px] text-zinc-400">({invoices.length})</span>
        </div>

        {invoices.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3 h-3 text-zinc-400 mr-1" />
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition ${
                  filter === f.value
                    ? 'bg-rose-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {invoices.length > 0 && (
        <div className="px-6 pb-4 grid grid-cols-2 gap-3">
          <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 font-semibold mb-0.5">Total paid</p>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCents(totalPaid, currency)}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 font-semibold mb-0.5">Outstanding</p>
            <p className={`text-sm font-semibold ${totalOutstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'}`}>
              {formatCents(totalOutstanding, currency)}
            </p>
          </div>
        </div>
      )}

      {invoices.length === 0 && (
        <div className="px-6 pb-6 text-center">
          <FileText className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No invoices yet</p>
          <p className="text-[11px] text-zinc-400 mt-1">
            Invoices will appear here after your first billing cycle.
          </p>
        </div>
      )}

      {invoices.length > 0 && filtered.length === 0 && (
        <div className="px-6 pb-6 text-center text-xs text-zinc-400">
          No invoices match the {filter} filter.
        </div>
      )}

      {filtered.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 max-h-96 overflow-y-auto">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((inv) => (
              <div key={inv.id} className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {formatPeriod(inv.period_start, inv.period_end)}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono truncate">
                    {inv.stripe_invoice_id}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {formatCents(inv.amount_paid || inv.amount_due, inv.currency)}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full font-semibold ${STATUS_COLORS[inv.status] ?? STATUS_COLORS.draft}`}
                  >
                    {inv.status}
                  </span>
                  {inv.invoice_pdf && (
                    <a
                      href={inv.invoice_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 inline-flex items-center gap-0.5"
                      title="Download PDF"
                    >
                      PDF
                    </a>
                  )}
                  {inv.invoice_url && (
                    <a
                      href={inv.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-rose-500 hover:text-rose-600 inline-flex items-center gap-0.5"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
