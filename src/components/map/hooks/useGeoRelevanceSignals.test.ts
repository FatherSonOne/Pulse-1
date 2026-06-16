// ─────────────────────────────────────────────────────────────────────────────
// useGeoRelevanceSignals — Direction D (Horizon, P1) window-math + predicate tests.
//
// Guards the two NET-NEW windows ("Now" = [now, now+NOW_MS); "3 days" =
// [now−DAY_MS, now+THREE_DAY_MS)) and the additive 'now'/'3d' branches in
// lensIncludesContact — AND pins that 'today'/'week'/'atlas' behave EXACTLY as
// before (the P1 regression guard). Pure derivations; no fetch, no schema touch.
// ─────────────────────────────────────────────────────────────────────────────

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent, Contact } from '../../../types';
import {
  contactAttendsEvent,
  lensIncludesContact,
  useGeoRelevanceSignals,
  type GeoSignals,
} from './useGeoRelevanceSignals';
import { DAY_MS, NOW_MS, THREE_DAY_MS } from '../sub/mapLens';

// Fixed reference instant so boundary assertions are deterministic.
const NOW = new Date('2026-06-15T12:00:00.000Z').getTime();

const makeContact = (over: Partial<Contact> = {}): Contact => ({
  id: 'c1',
  name: 'Test Contact',
  role: 'member',
  avatarColor: '#000000',
  status: 'offline',
  email: 'test@example.com',
  source: 'local',
  ...over,
});

const makeEvent = (over: Partial<CalendarEvent> & { id: string; start: Date }): CalendarEvent => ({
  title: 'Event',
  end: new Date(over.start.getTime() + 60 * 60 * 1000),
  color: '#000000',
  calendarId: 'cal',
  allDay: false,
  type: 'event',
  ...over,
});

const emptySignals = (over: Partial<GeoSignals> = {}): GeoSignals => ({
  nowEvents: [],
  todayEvents: [],
  threeDayEvents: [],
  weekEvents: [],
  recentMessageContactIds: new Set<string>(),
  hasRealSignals: true,
  ...over,
});

describe('useGeoRelevanceSignals — window math (memo)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Events placed precisely on the window boundaries. Passed via weekEventsProp
  // so the hook does NOT self-fetch; the new windows derive from this same set.
  const events: CalendarEvent[] = [
    makeEvent({ id: 'at-now', start: new Date(NOW) }),
    makeEvent({ id: 'now-upper-edge', start: new Date(NOW + NOW_MS) }), // exclusive upper
    makeEvent({ id: 'mid-today', start: new Date(NOW + DAY_MS / 2) }),
    makeEvent({ id: 'two-days', start: new Date(NOW + 2 * DAY_MS) }),
    makeEvent({ id: '3d-upper-edge', start: new Date(NOW + THREE_DAY_MS) }), // exclusive upper
    makeEvent({ id: 'past-half-day', start: new Date(NOW - DAY_MS / 2) }),
    makeEvent({ id: 'past-day-edge', start: new Date(NOW - DAY_MS) }), // inclusive lower
    makeEvent({ id: 'too-old', start: new Date(NOW - 2 * DAY_MS) }),
  ];

  const ids = (list: CalendarEvent[]) => list.map(e => e.id).sort();

  it('"Now" window = [now, now + NOW_MS): includes now, excludes the +NOW_MS edge', () => {
    const { result } = renderHook(() => useGeoRelevanceSignals({ weekEventsProp: events }));
    expect(ids(result.current.nowEvents)).toEqual(['at-now']);
  });

  it('"3 days" window = [now − DAY_MS, now + THREE_DAY_MS): excludes the +3d edge and >1d-past', () => {
    const { result } = renderHook(() => useGeoRelevanceSignals({ weekEventsProp: events }));
    expect(ids(result.current.threeDayEvents)).toEqual(
      ['at-now', 'mid-today', 'now-upper-edge', 'past-day-edge', 'past-half-day', 'two-days'].sort(),
    );
  });

  it('"Today" window is unchanged by the P1 additions (±DAY_MS)', () => {
    const { result } = renderHook(() => useGeoRelevanceSignals({ weekEventsProp: events }));
    expect(ids(result.current.todayEvents)).toEqual(
      ['at-now', 'mid-today', 'now-upper-edge', 'past-day-edge', 'past-half-day'].sort(),
    );
  });

  it('nowEvents ⊆ todayEvents and threeDayEvents ⊆ weekEvents (containment invariant)', () => {
    const { result } = renderHook(() => useGeoRelevanceSignals({ weekEventsProp: events }));
    const { nowEvents, todayEvents, threeDayEvents, weekEvents } = result.current;
    const todayIds = new Set(todayEvents.map(e => e.id));
    const weekIds = new Set(weekEvents.map(e => e.id));
    expect(nowEvents.every(e => todayIds.has(e.id))).toBe(true);
    expect(threeDayEvents.every(e => weekIds.has(e.id))).toBe(true);
  });
});

describe('lensIncludesContact — atlas / today / week unchanged (P1 regression guard)', () => {
  it('atlas always returns true, regardless of signals', () => {
    const c = makeContact({ id: 'nobody' });
    expect(lensIncludesContact(c, 'atlas', NOW, emptySignals())).toBe(true);
    expect(lensIncludesContact(c, 'atlas', NOW, emptySignals({ hasRealSignals: false }))).toBe(true);
  });

  it('recent-message contact is included across all horizons (existing real-signal path)', () => {
    const c = makeContact({ id: 'c-recent' });
    const signals = emptySignals({ recentMessageContactIds: new Set(['c-recent']) });
    for (const lens of ['now', 'today', '3d', 'week'] as const) {
      expect(lensIncludesContact(c, lens, NOW, signals)).toBe(true);
    }
  });

  it('event attendance selects the matching window per lens', () => {
    const c = makeContact({ id: 'c-attendee', email: 'attendee@example.com' });
    const ev = makeEvent({ id: 'ev', start: new Date(NOW), attendees: ['attendee@example.com'] });
    // Event present in today/3d/week buckets but NOT in nowEvents.
    const signals = emptySignals({ todayEvents: [ev], threeDayEvents: [ev], weekEvents: [ev] });
    expect(lensIncludesContact(c, 'today', NOW, signals)).toBe(true);
    expect(lensIncludesContact(c, '3d', NOW, signals)).toBe(true);
    expect(lensIncludesContact(c, 'week', NOW, signals)).toBe(true);
    // 'now' looks only at nowEvents (empty) and the contact is neither recent nor team.
    expect(lensIncludesContact(c, 'now', NOW, signals)).toBe(false);
  });

  it('"now" admits a contact attending an event in the nowEvents window', () => {
    const c = makeContact({ id: 'c-now', email: 'now@example.com' });
    const ev = makeEvent({ id: 'ev-now', start: new Date(NOW), attendees: ['now@example.com'] });
    expect(lensIncludesContact(c, 'now', NOW, emptySignals({ nowEvents: [ev] }))).toBe(true);
  });

  it('team/pulse override still applies to the new horizons', () => {
    const team = makeContact({ id: 'c-team', isTeamMember: true });
    for (const lens of ['now', 'today', '3d', 'week'] as const) {
      expect(lensIncludesContact(team, lens, NOW, emptySignals())).toBe(true);
    }
  });
});

describe('lensIncludesContact — legacy proxy window per horizon (hasRealSignals=false)', () => {
  const legacy = emptySignals({ hasRealSignals: false });

  it('NOW_MS (3h) gates the "now" legacy window', () => {
    const recent = makeContact({ id: 'r', lastSeen: new Date(NOW - 2 * 60 * 60 * 1000) }); // 2h ago
    const stale = makeContact({ id: 's', lastSeen: new Date(NOW - 4 * 60 * 60 * 1000) }); // 4h ago
    expect(lensIncludesContact(recent, 'now', NOW, legacy)).toBe(true);
    expect(lensIncludesContact(stale, 'now', NOW, legacy)).toBe(false);
    // 4h-stale still inside the wider Today window.
    expect(lensIncludesContact(stale, 'today', NOW, legacy)).toBe(true);
  });

  it('THREE_DAY_MS gates the "3d" legacy window', () => {
    const twoDays = makeContact({ id: 't', lastSeen: new Date(NOW - 2 * DAY_MS) });
    expect(lensIncludesContact(twoDays, 'today', NOW, legacy)).toBe(false); // outside ±DAY
    expect(lensIncludesContact(twoDays, '3d', NOW, legacy)).toBe(true); // inside 3 days
    expect(lensIncludesContact(twoDays, 'week', NOW, legacy)).toBe(true);
  });
});

describe('contactAttendsEvent', () => {
  it('matches by email (case-insensitive) and by display name', () => {
    const c = makeContact({ email: 'Jane@Example.com', name: 'Jane Doe' });
    expect(contactAttendsEvent(c, makeEvent({ id: 'a', start: new Date(NOW), attendees: ['jane@example.com'] }))).toBe(true);
    expect(contactAttendsEvent(c, makeEvent({ id: 'b', start: new Date(NOW), attendees: ['Jane Doe'] }))).toBe(true);
    expect(contactAttendsEvent(c, makeEvent({ id: 'c', start: new Date(NOW), attendees: ['someone@else.com'] }))).toBe(false);
    expect(contactAttendsEvent(c, makeEvent({ id: 'd', start: new Date(NOW) }))).toBe(false); // no attendees
  });
});
