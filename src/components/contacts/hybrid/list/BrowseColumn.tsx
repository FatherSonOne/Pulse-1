// ============================================
// BrowseColumn — Col 1 of the hybrid People view.
// Search (header) + status/tag chips + a collapsible Filters drawer
// (smart lists / circles / saved filters / archive) + the contact list +
// a pinned Add Contact footer. See handoff §2 + §4.2.
// ============================================

import React, { useState } from 'react';
import { Search, Plus, SlidersHorizontal, UserX } from 'lucide-react';
import { Contact } from '../../../../types';
import type { SmartListType } from '../../../../types/relationshipTypes';
import type { ContactCircle } from '../../../../types/contactCircleTypes';
import type { FilterStatus, BrowseCounts } from './browseFilter';
import { TAGS } from './smartLists';
import { ContactListItem } from './ContactListItem';
import { FiltersDrawer } from './FiltersDrawer';

interface BrowseColumnProps {
  /** Already-filtered list to render. */
  contacts: Contact[];
  selectedContactId: string | null;
  onSelectContact: (c: Contact) => void;

  search: string;
  onSearchChange: (v: string) => void;
  counts: BrowseCounts;

  filterStatus: FilterStatus;
  onFilterStatusChange: (s: FilterStatus) => void;
  filterTag: string | null;
  onFilterTagChange: (t: string | null) => void;

  activeSmartList: SmartListType | null;
  smartListCounts: Record<SmartListType, number>;
  onSmartListChange: (l: SmartListType | null) => void;

  circles: ContactCircle[];
  activeCircleId: string | null;
  onCircleChange: (id: string | null) => void;

  showArchived: boolean;
  archivedCount: number;
  onToggleArchived: (next: boolean) => void;

  savedFiltersPanel?: React.ReactNode;
  /** Count of active drawer filters (smart list + circle + saved filter + archived) for the badge. */
  activeDrawerFilterCount: number;

  // Bulk selection (Phase 7)
  selectedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  /** BulkActionToolbar, built by the orchestrator (where the handlers live). */
  bulkToolbar?: React.ReactNode;

  onAddContact: () => void;
}

const StatusChip: React.FC<{ label: string; count?: number; active: boolean; onClick: () => void }> = ({
  label,
  count,
  active,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
      active
        ? 'bg-[var(--pulse-rose-soft)] border-[var(--pulse-rose-soft)] text-[var(--pulse-rose)]'
        : 'border-[var(--pulse-border)] text-zinc-500 dark:text-zinc-400 hover:bg-[var(--pulse-surface-raised)]'
    }`}
  >
    {label}
    {count !== undefined && <span className="text-[10px] opacity-70">{count}</span>}
  </button>
);

export const BrowseColumn: React.FC<BrowseColumnProps> = ({
  contacts,
  selectedContactId,
  onSelectContact,
  search,
  onSearchChange,
  counts,
  filterStatus,
  onFilterStatusChange,
  filterTag,
  onFilterTagChange,
  activeSmartList,
  smartListCounts,
  onSmartListChange,
  circles,
  activeCircleId,
  onCircleChange,
  showArchived,
  archivedCount,
  onToggleArchived,
  savedFiltersPanel,
  activeDrawerFilterCount,
  selectedIds,
  onToggleCheck,
  onSelectAllVisible,
  onClearSelection,
  bulkToolbar,
  onAddContact,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      className="flex flex-col h-full w-[330px] shrink-0 border-r"
      style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-canvas)' }}
    >
      {/* Bulk action toolbar — replaces nothing; sits above the header when a
          selection is active (mirrors legacy's header-replacement placement). */}
      {selectedIds.size > 0 && bulkToolbar}

      {/* Header — search + Filters toggle */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--pulse-border)' }}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl border"
          style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-surface)' }}
        >
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search contacts…"
            data-contacts-search
            className="flex-1 bg-transparent outline-none text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>

        {/* Status + tag chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          <StatusChip
            label="All"
            count={counts.total}
            active={filterStatus === 'all'}
            onClick={() => onFilterStatusChange('all')}
          />
          <StatusChip
            label="Online"
            count={counts.online}
            active={filterStatus === 'online'}
            onClick={() => onFilterStatusChange(filterStatus === 'online' ? 'all' : 'online')}
          />
          <span className="w-px h-4 bg-[var(--pulse-border)] mx-0.5" />
          {TAGS.map((tag) => (
            <StatusChip
              key={tag.id}
              label={tag.label}
              active={filterTag === tag.id}
              onClick={() => onFilterTagChange(filterTag === tag.id ? null : tag.id)}
            />
          ))}
        </div>

        {/* Filters drawer toggle */}
        <button
          type="button"
          onClick={() => setDrawerOpen((v) => !v)}
          aria-expanded={drawerOpen}
          className="mt-2.5 w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors hover:bg-[var(--pulse-surface-raised)]"
          style={{ borderColor: 'var(--pulse-border)', color: 'var(--pulse-ink-2)' }}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </span>
          {activeDrawerFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold bg-[var(--pulse-rose-soft)] text-[var(--pulse-rose)]">
              {activeDrawerFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters drawer (collapsible) */}
      {drawerOpen && (
        <div className="border-b max-h-[45%] overflow-y-auto" style={{ borderColor: 'var(--pulse-border)' }}>
          <FiltersDrawer
            activeSmartList={activeSmartList}
            smartListCounts={smartListCounts}
            onSmartListChange={onSmartListChange}
            circles={circles}
            activeCircleId={activeCircleId}
            onCircleChange={onCircleChange}
            showArchived={showArchived}
            archivedCount={archivedCount}
            onToggleArchived={onToggleArchived}
            savedFiltersPanel={savedFiltersPanel}
          />
        </div>
      )}

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {selectedIds.size > 0 && contacts.length > 0 && (
          <div className="flex items-center justify-between px-1.5 py-1 mb-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={onSelectAllVisible}
              className="font-medium hover:text-rose-500 transition-colors"
            >
              Select all {contacts.length}
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="hover:text-rose-500 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full px-6 text-zinc-400 dark:text-zinc-500">
            <UserX className="w-6 h-6 mb-2" />
            <p className="text-sm">No matches</p>
            <p className="text-xs mt-1">Adjust your search or clear filters.</p>
          </div>
        ) : (
          contacts.map((c) => (
            <ContactListItem
              key={c.id}
              contact={c}
              selected={selectedContactId === c.id}
              checked={selectedIds.has(c.id)}
              selectionActive={selectedIds.size > 0}
              onSelect={() => onSelectContact(c)}
              onToggleCheck={() => onToggleCheck(c.id)}
            />
          ))
        )}
      </div>

      {/* Pinned footer — Add Contact */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--pulse-border)' }}>
        <button
          type="button"
          onClick={onAddContact}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--pulse-rose)' }}
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>
    </div>
  );
};

export default BrowseColumn;
