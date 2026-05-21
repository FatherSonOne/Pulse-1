// ─────────────────────────────────────────────────────────────────────────────
// useGeoRelevanceSignals — Phase 5 lens-membership feed for PulseMapView.
//
// Composes a GeoSignals bundle from whichever source has data:
//   • props (parent supplies pre-computed events + recent-message contact ids)
//   • self-fetch via dataService when the parent leaves the props undefined
//
// Today's parent (App.tsx) doesn't lift this fetch — Dashboard owns the
// equivalent data — so the self-fetch is the default path. The props are
// here so a future parent or a test can supply pre-computed signals.
//
// Also exports `lensIncludesContact`, the predicate that decides whether a
// contact appears under TODAY / WEEK / ATLAS. Lifted alongside the hook so
// the host component (visibleMarkers filter) and the AI proposal hook can
// both call it without re-importing the predicate from elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import type { CalendarEvent, Contact, Thread } from '../../../types';
import { dataService } from '../../../services/dataService';
import { DAY_MS, WEEK_MS, type MapLens } from '../sub/mapLens';

export interface GeoSignals {
  todayEvents: CalendarEvent[];
  weekEvents: CalendarEvent[];
  recentMessageContactIds: Set<string>;
  /** True when at least one source returned non-empty data; tells the lens
   *  helper to switch from the legacy proxy to real signals. */
  hasRealSignals: boolean;
}

// Email-lookup helper: an event's attendees array is usually email addresses
// (Google/Outlook) or display names. Returns true if any attendee matches
// this contact by email (case-insensitive) or, failing that, by display name.
export function contactAttendsEvent(c: Contact, e: CalendarEvent): boolean {
  if (!e.attendees || e.attendees.length === 0) return false;
  const contactEmail = c.email?.toLowerCase().trim();
  const contactName = c.name?.toLowerCase().trim();
  for (const att of e.attendees) {
    const lower = (att || '').toLowerCase().trim();
    if (!lower) continue;
    if (contactEmail && lower === contactEmail) return true;
    if (contactName && lower === contactName) return true;
    // Detailed attendees with embedded "Name <email>" formatting.
    if (contactEmail && lower.includes(contactEmail)) return true;
  }
  return false;
}

// Real-signal predicate. Atlas always shows everything pinned. TODAY/WEEK
// admit a contact when ANY of: they're in recentMessageContactIds, they
// attend an event in the lens window, OR (defensive) the legacy proxy still
// places them in the window. The fallback keeps a freshly-installed Pulse
// (no calendar yet, no message history yet) from looking empty.
export function lensIncludesContact(
  c: Contact,
  lens: MapLens,
  now: number,
  signals: GeoSignals,
): boolean {
  if (lens === 'atlas') return true;

  if (signals.hasRealSignals) {
    if (signals.recentMessageContactIds.has(c.id)) return true;
    const eventList = lens === 'today' ? signals.todayEvents : signals.weekEvents;
    if (eventList.some(e => contactAttendsEvent(c, e))) return true;
    // Real signals exist but this contact isn't tied to them. Still honour
    // the team/pulse-user override so the operator's own circle is visible
    // even on quiet days.
    if (c.isTeamMember || c.pulseUserId) return true;
    return false;
  }

  // Legacy proxy — no real signals yet (Google Calendar not connected,
  // no thread history, etc.). Keeps the section usable for fresh installs.
  if (c.isTeamMember || c.pulseUserId) return true;
  const seen = c.lastSeen ? c.lastSeen.getTime() : 0;
  const window = lens === 'today' ? DAY_MS : WEEK_MS;
  return now - seen <= window;
}

export interface UseGeoRelevanceSignalsInput {
  todayEventsProp?: CalendarEvent[];
  weekEventsProp?: CalendarEvent[];
  recentMessageContactIdsProp?: Set<string>;
}

export function useGeoRelevanceSignals(input: UseGeoRelevanceSignalsInput): GeoSignals {
  const { todayEventsProp, weekEventsProp, recentMessageContactIdsProp } = input;

  const [fetchedEvents, setFetchedEvents] = useState<CalendarEvent[]>([]);
  const [fetchedThreads, setFetchedThreads] = useState<Thread[]>([]);
  const needsSelfFetch =
    todayEventsProp === undefined &&
    weekEventsProp === undefined &&
    recentMessageContactIdsProp === undefined;
  useEffect(() => {
    if (!needsSelfFetch) return;
    let cancelled = false;
    const now = new Date();
    const weekEnd = new Date(now.getTime() + WEEK_MS);
    Promise.all([
      dataService.getEvents(now, weekEnd).catch(() => [] as CalendarEvent[]),
      dataService.getThreads().catch(() => [] as Thread[]),
    ]).then(([events, threads]) => {
      if (cancelled) return;
      setFetchedEvents(events);
      setFetchedThreads(threads);
    });
    return () => { cancelled = true; };
  }, [needsSelfFetch]);

  // Compose the signal bundle from whichever source has data — props win when
  // the parent supplied them, otherwise the self-fetch results are used.
  return useMemo<GeoSignals>(() => {
    const now = Date.now();
    const dayCutoff = now - DAY_MS;
    const weekCutoff = now + WEEK_MS;

    const events = todayEventsProp !== undefined || weekEventsProp !== undefined
      ? [...(todayEventsProp ?? []), ...(weekEventsProp ?? [])]
      : fetchedEvents;

    const todayEvents = todayEventsProp ?? events.filter(e => {
      const t = e.start instanceof Date ? e.start.getTime() : new Date(e.start).getTime();
      return Number.isFinite(t) && t >= now - DAY_MS && t < now + DAY_MS;
    });
    const weekEvents = weekEventsProp ?? events.filter(e => {
      const t = e.start instanceof Date ? e.start.getTime() : new Date(e.start).getTime();
      return Number.isFinite(t) && t >= dayCutoff && t < weekCutoff;
    });

    let recentMessageContactIds = recentMessageContactIdsProp;
    if (recentMessageContactIds === undefined) {
      const ids = new Set<string>();
      for (const thread of fetchedThreads) {
        const lastMsg = thread.messages?.[thread.messages.length - 1];
        const ts = lastMsg?.timestamp instanceof Date
          ? lastMsg.timestamp.getTime()
          : lastMsg?.timestamp ? new Date(lastMsg.timestamp).getTime() : 0;
        if (ts >= dayCutoff) ids.add(thread.contactId);
      }
      recentMessageContactIds = ids;
    }

    const hasRealSignals =
      todayEvents.length > 0 ||
      weekEvents.length > 0 ||
      recentMessageContactIds.size > 0;

    return { todayEvents, weekEvents, recentMessageContactIds, hasRealSignals };
  }, [todayEventsProp, weekEventsProp, recentMessageContactIdsProp, fetchedEvents, fetchedThreads]);
}
