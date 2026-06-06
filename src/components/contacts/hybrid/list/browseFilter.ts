// ============================================
// browseFilter — the Browse column's filter + count engine.
//
// VERBATIM port of the legacy ContactsRedesigned filteredContacts useMemo
// (lines 920-989) and counts useMemo, extracted into pure functions so the
// hybrid orchestrator stays lean and the engine is unit-testable. The
// saved-filter step delegates to the existing savedFiltersService verbatim.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.2 (D1).
// ============================================

import { Contact } from '../../../../types';
import type { SmartListType, RelationshipProfile } from '../../../../types/relationshipTypes';
import type { ContactCircle } from '../../../../types/contactCircleTypes';
import { applyFilterPredicate, type SavedFilter } from '../../../../services/savedFiltersService';
import { matchesSmartList } from './smartLists';

export type FilterStatus = 'all' | 'online' | 'offline';

export interface BrowseFilterArgs {
  baseContacts: Contact[];
  profiles: RelationshipProfile[];
  circles: ContactCircle[];
  savedFilters: { user: SavedFilter[]; workspace: SavedFilter[] };
  search: string;
  /** AI / NL search override — when non-null, restricts to its result set. */
  aiResultIds: Set<string> | null;
  filterStatus: FilterStatus;
  filterTag: string | null;
  activeSmartList: SmartListType | null;
  activeCircleId: string | null;
  activeSavedFilterId: string | null;
  /** Injectable clock for deterministic smart-list tests. */
  now?: Date;
}

export function filterBrowseContacts(args: BrowseFilterArgs): Contact[] {
  const {
    baseContacts,
    profiles,
    circles,
    savedFilters,
    search,
    aiResultIds,
    filterStatus,
    filterTag,
    activeSmartList,
    activeCircleId,
    activeSavedFilterId,
    now,
  } = args;

  const q = search.toLowerCase();

  let result = baseContacts.filter((c) => {
    // AI / NL search override.
    if (aiResultIds && !aiResultIds.has(c.id)) return false;

    // Search — name / email / company (matches the real legacy behavior).
    const matchesSearch =
      search === '' ||
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    // Status.
    if (filterStatus === 'online' && c.status !== 'online') return false;
    if (filterStatus === 'offline' && c.status !== 'offline') return false;

    // Tag (contact.groups[]).
    if (filterTag && !c.groups?.includes(filterTag)) return false;

    // Circle membership.
    if (activeCircleId) {
      const circle = circles.find((cc) => cc.id === activeCircleId);
      if (!circle || !circle.memberContactIds.includes(c.id)) return false;
    }

    return true;
  });

  // Smart list — evaluate predicates over relationship profiles, map to emails.
  if (activeSmartList) {
    const smartListEmails = new Set(
      profiles.filter((p) => matchesSmartList(p, activeSmartList, now)).map((p) => p.contactEmail),
    );
    result = result.filter((c) => c.email && smartListEmails.has(c.email));
  }

  // Saved filter — delegate to the existing predicate engine (reused verbatim).
  const activeFilter = [...savedFilters.user, ...savedFilters.workspace].find(
    (f) => f.id === activeSavedFilterId,
  );
  if (activeFilter) {
    const knownCircleIds = new Set(circles.map((circle) => circle.id));
    const knownTagUuids = new Set(baseContacts.flatMap((contact) => contact.groups ?? []));
    result = applyFilterPredicate(activeFilter.predicate_json, result, knownCircleIds, knownTagUuids)
      .matched;
  }

  return result;
}

export interface BrowseCounts {
  total: number;
  online: number;
  offline: number;
}

export function countBrowseContacts(baseContacts: Contact[]): BrowseCounts {
  return {
    total: baseContacts.length,
    online: baseContacts.filter((c) => c.status === 'online').length,
    offline: baseContacts.filter((c) => c.status === 'offline').length,
  };
}
