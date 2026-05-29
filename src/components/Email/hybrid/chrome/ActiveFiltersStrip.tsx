// ActiveFiltersStrip — chip strip showing currently-applied filters above
// the email list. Each chip can be removed individually; the trailing
// "Clear all" link resets the whole filter set.
// Phase 12.5. Rendered above the CockpitView content and the FolderListView
// content. Hidden when no filters are active.
import React from 'react';
import { X } from 'lucide-react';
import {
  countActiveFilters,
  useEmailUIStore,
  type EmailFilters,
  type LaneFilter,
} from '../../../../store/emailUIStore';

const LANE_LABEL: Record<Exclude<LaneFilter, 'all'>, string> = {
  work: 'Work',
  admin: 'Admin',
  tools: 'Tools',
  news: 'News',
  personal: 'Personal',
};

function chipsFromFilters(filters: EmailFilters) {
  const chips: { key: keyof EmailFilters; label: string }[] = [];
  if (filters.readStatus !== 'all') {
    chips.push({ key: 'readStatus', label: filters.readStatus === 'unread' ? 'Unread' : 'Read' });
  }
  if (filters.starred === 'starred') {
    chips.push({ key: 'starred', label: 'Starred' });
  }
  if (filters.attachment === 'with-attachment') {
    chips.push({ key: 'attachment', label: 'With attachment' });
  }
  if (filters.lane !== 'all') {
    chips.push({ key: 'lane', label: LANE_LABEL[filters.lane] });
  }
  if (filters.dateRange !== 'all') {
    const label =
      filters.dateRange === 'today' ? 'Today'
      : filters.dateRange === 'this-week' ? 'Last 7 days'
      : 'Last 30 days';
    chips.push({ key: 'dateRange', label });
  }
  return chips;
}

const DEFAULTS: Record<keyof EmailFilters, EmailFilters[keyof EmailFilters]> = {
  readStatus: 'all',
  starred: 'all',
  attachment: 'all',
  lane: 'all',
  dateRange: 'all',
};

export const ActiveFiltersStrip: React.FC = () => {
  const filters = useEmailUIStore((s) => s.emailFilters);
  const setEmailFilter = useEmailUIStore((s) => s.setEmailFilter);
  const resetEmailFilters = useEmailUIStore((s) => s.resetEmailFilters);

  if (countActiveFilters(filters) === 0) return null;
  const chips = chipsFromFilters(filters);

  return (
    <div
      className="flex items-center gap-2 flex-wrap px-6 md:px-10 py-2.5 border-b pulse-border-color"
      style={{ background: 'var(--pulse-canvas-soft)' }}
    >
      <span className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">FILTERED ·</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => setEmailFilter(chip.key, DEFAULTS[chip.key] as never)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] pulse-rose-bg-soft-color pulse-coral-fg-color hover:pulse-rose-bg-color hover:text-white transition"
          aria-label={`Remove ${chip.label} filter`}
          title={`Remove ${chip.label} filter`}
        >
          {chip.label}
          <X className="w-3 h-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => resetEmailFilters()}
        className="ml-1 text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color hover:pulse-rose-color"
      >
        CLEAR ALL
      </button>
    </div>
  );
};

export default ActiveFiltersStrip;
