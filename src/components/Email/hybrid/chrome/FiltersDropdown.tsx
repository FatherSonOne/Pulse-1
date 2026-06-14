// FiltersDropdown — popover in the canvas top bar that exposes the filter
// controls. Each control is a single-select radio group rendered as pills.
// "Clear all" link at the bottom resets the filter state.
import React, { useEffect, useRef, useState } from 'react';
import { Filter, X } from 'lucide-react';
import {
  countActiveFilters,
  useEmailUIStore,
  type EmailFilters,
  type ReadStatusFilter,
  type StarredFilter,
  type AttachmentFilter,
  type LaneFilter,
  type DateRangeFilter,
} from '../../../../store/emailUIStore';

interface OptionGroupProps<V extends string> {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}

function OptionGroup<V extends string>({ label, value, options, onChange }: OptionGroupProps<V>) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color uppercase">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1 rounded-md text-[12px] transition ${
                active
                  ? 'pulse-rose-bg-color text-white'
                  : 'pulse-surface-raised pulse-ink-2-color hover:pulse-ink-color'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const FiltersDropdown: React.FC = () => {
  const filters = useEmailUIStore((s) => s.emailFilters);
  const setEmailFilter = useEmailUIStore((s) => s.setEmailFilter);
  const resetEmailFilters = useEmailUIStore((s) => s.resetEmailFilters);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const activeCount = countActiveFilters(filters);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] border pulse-border-color transition ${
          activeCount > 0
            ? 'pulse-rose-color pulse-rose-bg-soft-color pulse-rose-border'
            : 'pulse-ink-color hover:pulse-surface-raised'
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Filter emails"
      >
        <Filter className="w-3.5 h-3.5" />
        <span className="font-medium">Filter</span>
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-mono-pulse pulse-rose-bg-color text-white tnum">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filter emails"
          className="absolute left-0 top-full mt-1.5 z-30 w-[320px] rounded-xl border pulse-border-color overflow-hidden hybrid-popover"
          style={{
            background: 'var(--pulse-canvas-soft)',
            boxShadow: '0 22px 60px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.30)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b pulse-border-color">
            <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-rose-color">
              FILTERS
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-0.5 rounded hover:pulse-surface-raised pulse-ink-3-color"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
            <OptionGroup<ReadStatusFilter>
              label="Read status"
              value={filters.readStatus}
              options={[
                { value: 'all', label: 'All' },
                { value: 'unread', label: 'Unread' },
                { value: 'read', label: 'Read' },
              ]}
              onChange={(v) => setEmailFilter('readStatus', v)}
            />
            <OptionGroup<StarredFilter>
              label="Star"
              value={filters.starred}
              options={[
                { value: 'all', label: 'All' },
                { value: 'starred', label: 'Starred' },
              ]}
              onChange={(v) => setEmailFilter('starred', v)}
            />
            <OptionGroup<AttachmentFilter>
              label="Attachments"
              value={filters.attachment}
              options={[
                { value: 'all', label: 'All' },
                { value: 'with-attachment', label: 'With attachment' },
              ]}
              onChange={(v) => setEmailFilter('attachment', v)}
            />
            <OptionGroup<LaneFilter>
              label="Lane"
              value={filters.lane}
              options={[
                { value: 'all', label: 'All' },
                { value: 'work', label: 'Work' },
                { value: 'admin', label: 'Admin' },
                { value: 'tools', label: 'Tools' },
                { value: 'news', label: 'News' },
                { value: 'personal', label: 'Personal' },
              ]}
              onChange={(v) => setEmailFilter('lane', v)}
            />
            <OptionGroup<DateRangeFilter>
              label="Date"
              value={filters.dateRange}
              options={[
                { value: 'all', label: 'All time' },
                { value: 'today', label: 'Today' },
                { value: 'this-week', label: 'Last 7 days' },
                { value: 'this-month', label: 'Last 30 days' },
              ]}
              onChange={(v) => setEmailFilter('dateRange', v)}
            />
          </div>

          <div className="px-4 py-2.5 border-t pulse-border-color flex items-center justify-between">
            <button
              type="button"
              onClick={() => resetEmailFilters()}
              disabled={activeCount === 0}
              className="text-[11px] font-mono-pulse tracking-wide-mono pulse-ink-3-color hover:pulse-rose-color disabled:opacity-40 disabled:hover:pulse-ink-3-color"
            >
              CLEAR ALL
            </button>
            <span className="text-[10px] pulse-ink-3-color">
              {activeCount > 0 ? `${activeCount} active` : 'No filters'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FiltersDropdown;
