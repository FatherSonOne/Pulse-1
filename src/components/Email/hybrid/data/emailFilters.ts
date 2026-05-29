// Filter application logic for the hybrid email surface.
// Phase 12.5. Filters compose with the current folder + active search to
// narrow the visible emails. The dropdown UI lives in
// chrome/FiltersDropdown.tsx; the chip strip in chrome/ActiveFiltersStrip.tsx;
// the store slot in emailUIStore.emailFilters.

import { useMemo } from 'react';
import { useEmailStore } from '../../../../store/emailStore';
import { useEmailUIStore, type EmailFilters } from '../../../../store/emailUIStore';
import type { CachedEmail } from '../../../../services/emailSyncService';
import { categorize } from './emailRow';

function matchesDateRange(
  email: CachedEmail,
  range: EmailFilters['dateRange'],
  now: number = Date.now(),
): boolean {
  if (range === 'all') return true;
  const received = new Date(email.received_at).getTime();
  if (Number.isNaN(received)) return false;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();

  switch (range) {
    case 'today':
      return received >= startOfTodayMs;
    case 'this-week':
      return received >= startOfTodayMs - 6 * 24 * 60 * 60 * 1000;
    case 'this-month':
      return received >= startOfTodayMs - 29 * 24 * 60 * 60 * 1000;
    default:
      return true;
  }
}

export function applyFilters(emails: CachedEmail[], filters: EmailFilters): CachedEmail[] {
  return emails.filter((e) => {
    if (filters.readStatus === 'unread' && e.is_read) return false;
    if (filters.readStatus === 'read' && !e.is_read) return false;
    if (filters.starred === 'starred' && !e.is_starred) return false;
    if (filters.attachment === 'with-attachment' && !e.has_attachments) return false;
    if (filters.lane !== 'all' && categorize(e) !== filters.lane) return false;
    if (filters.dateRange !== 'all' && !matchesDateRange(e, filters.dateRange)) return false;
    return true;
  });
}

/** Pure selector wrapping emailStore.emails through the current filter state. */
export function useFilteredEmails(): CachedEmail[] {
  const emails = useEmailStore((s) => s.emails);
  const filters = useEmailUIStore((s) => s.emailFilters);
  return useMemo(() => applyFilters(emails, filters), [emails, filters]);
}
