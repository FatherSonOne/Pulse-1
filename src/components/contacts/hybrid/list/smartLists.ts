// ============================================
// Smart-list config + predicates for the hybrid Contacts Browse column.
//
// VERBATIM copy of the legacy ContactsRedesigned.tsx taxonomy (SMART_LISTS,
// TAGS) and the inline smart-list predicate switch (filteredContacts useMemo).
// Copied — not extracted — so the legacy component stays untouched until
// Phase 12 (CLAUDE.md §0: additive + reversible beats touching working code).
// When Phase 12 deletes the legacy People layout, this becomes the sole copy.
//
// The only behavioral change vs. the legacy inline switch is that `now` is an
// injectable parameter (defaulting to new Date()) so the time-relative lists
// (inactive_30_days, recent_contacts) are deterministically unit-testable.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.2.
// ============================================

import type { LucideIcon } from 'lucide-react';
import { Clock, Flame, Moon, Star, Snowflake, Zap } from 'lucide-react';
import type { SmartListType, RelationshipProfile } from '../../../../types/relationshipTypes';

export interface SmartListConfig {
  id: SmartListType;
  label: string;
  Icon: LucideIcon;
}

// The six smart lists Pulse surfaces (a subset of the SmartListType union).
export const SMART_LISTS: SmartListConfig[] = [
  { id: 'needs_follow_up', label: 'Needs Follow-up', Icon: Clock },
  { id: 'warm_leads', label: 'Warm Leads', Icon: Flame },
  { id: 'inactive_30_days', label: 'Inactive (30d)', Icon: Moon },
  { id: 'vip', label: 'VIP Contacts', Icon: Star },
  { id: 'cold_leads', label: 'Cold Leads', Icon: Snowflake },
  { id: 'recent_contacts', label: 'Recent', Icon: Zap },
];

// User-applied labels (contact.groups[]). Not state — see the taxonomy note in
// the legacy file. "VIP" intentionally absent (it's the isVip smart list).
export const TAGS: { id: string; label: string }[] = [
  { id: 'prospect', label: 'Prospect' },
  { id: 'customer', label: 'Customer' },
  { id: 'partner', label: 'Partner' },
  { id: 'vendor', label: 'Vendor' },
];

/**
 * Does a relationship profile satisfy a smart list? Verbatim port of the legacy
 * switch (ContactsRedesigned filteredContacts useMemo). Evaluated against
 * RelationshipProfile data, not contact rows.
 */
export function matchesSmartList(
  p: RelationshipProfile,
  list: SmartListType,
  now: Date = new Date(),
): boolean {
  switch (list) {
    case 'needs_follow_up':
      return Boolean(
        p.lastEmailSentAt && (!p.lastEmailReceivedAt || p.lastEmailSentAt > p.lastEmailReceivedAt),
      );
    case 'warm_leads':
      return p.relationshipScore >= 60 && p.relationshipTrend === 'rising';
    case 'inactive_30_days': {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return Boolean(p.lastInteractionAt && new Date(p.lastInteractionAt) < thirtyDaysAgo);
    }
    case 'vip':
      return Boolean(p.isVip);
    case 'cold_leads':
      return p.relationshipScore < 40 || p.relationshipTrend === 'falling';
    case 'recent_contacts': {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return Boolean(p.lastInteractionAt && new Date(p.lastInteractionAt) >= sevenDaysAgo);
    }
    default:
      return true;
  }
}
