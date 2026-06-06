import { describe, it, expect } from 'vitest';
import { filterBrowseContacts, countBrowseContacts, type BrowseFilterArgs } from './browseFilter';
import { matchesSmartList } from './smartLists';
import { Contact } from '../../../../types';
import type { RelationshipProfile } from '../../../../types/relationshipTypes';
import type { ContactCircle } from '../../../../types/contactCircleTypes';

const c = (over: Partial<Contact>): Contact => ({
  id: 'c?',
  name: 'Person',
  role: '',
  avatarColor: '#000',
  status: 'offline',
  email: 'p@example.com',
  source: 'local',
  ...over,
});

// matchesSmartList only reads a handful of fields — cast a partial.
const profile = (over: Partial<RelationshipProfile>): RelationshipProfile =>
  ({ relationshipScore: 50, relationshipTrend: 'stable', ...over }) as RelationshipProfile;

const NOW = new Date('2026-06-05T12:00:00Z');

const baseArgs = (over: Partial<BrowseFilterArgs>): BrowseFilterArgs => ({
  baseContacts: [],
  profiles: [],
  circles: [],
  savedFilters: { user: [], workspace: [] },
  search: '',
  aiResultIds: null,
  filterStatus: 'all',
  filterTag: null,
  activeSmartList: null,
  activeCircleId: null,
  activeSavedFilterId: null,
  now: NOW,
  ...over,
});

describe('filterBrowseContacts', () => {
  const alice = c({ id: 'a', name: 'Alice', email: 'alice@acme.com', company: 'Acme', status: 'online' });
  const bob = c({ id: 'b', name: 'Bob', email: 'bob@globex.com', company: 'Globex', status: 'offline' });
  const all = [alice, bob];

  it('search matches name / email / company, case-insensitive', () => {
    expect(filterBrowseContacts(baseArgs({ baseContacts: all, search: 'ALICE' })).map((x) => x.id)).toEqual(['a']);
    expect(filterBrowseContacts(baseArgs({ baseContacts: all, search: 'globex' })).map((x) => x.id)).toEqual(['b']);
    expect(filterBrowseContacts(baseArgs({ baseContacts: all, search: 'acme' })).map((x) => x.id)).toEqual(['a']);
  });

  it('status filter narrows to online / offline', () => {
    expect(filterBrowseContacts(baseArgs({ baseContacts: all, filterStatus: 'online' })).map((x) => x.id)).toEqual(['a']);
    expect(filterBrowseContacts(baseArgs({ baseContacts: all, filterStatus: 'offline' })).map((x) => x.id)).toEqual(['b']);
  });

  it('tag filter matches contact.groups', () => {
    const tagged = [c({ id: 'a', groups: ['customer'] }), c({ id: 'b', groups: ['vendor'] })];
    expect(filterBrowseContacts(baseArgs({ baseContacts: tagged, filterTag: 'customer' })).map((x) => x.id)).toEqual(['a']);
  });

  it('circle filter matches memberContactIds', () => {
    const circles = [{ id: 'circ1', memberContactIds: ['b'] } as ContactCircle];
    expect(
      filterBrowseContacts(baseArgs({ baseContacts: all, circles, activeCircleId: 'circ1' })).map((x) => x.id),
    ).toEqual(['b']);
  });

  it('smart list (warm_leads) keeps contacts whose profile email matches', () => {
    const profiles = [
      profile({ contactEmail: 'alice@acme.com', relationshipScore: 80, relationshipTrend: 'rising' }),
      profile({ contactEmail: 'bob@globex.com', relationshipScore: 30, relationshipTrend: 'falling' }),
    ];
    expect(
      filterBrowseContacts(baseArgs({ baseContacts: all, profiles, activeSmartList: 'warm_leads' })).map((x) => x.id),
    ).toEqual(['a']);
  });

  it('aiResultIds narrows the set', () => {
    expect(
      filterBrowseContacts(baseArgs({ baseContacts: all, aiResultIds: new Set(['b']) })).map((x) => x.id),
    ).toEqual(['b']);
  });
});

describe('matchesSmartList (deterministic via injected now)', () => {
  it('inactive_30_days: last interaction older than 30d', () => {
    const stale = profile({ lastInteractionAt: new Date('2026-04-01T00:00:00Z') as unknown as RelationshipProfile['lastInteractionAt'] });
    const fresh = profile({ lastInteractionAt: new Date('2026-06-01T00:00:00Z') as unknown as RelationshipProfile['lastInteractionAt'] });
    expect(matchesSmartList(stale, 'inactive_30_days', NOW)).toBe(true);
    expect(matchesSmartList(fresh, 'inactive_30_days', NOW)).toBe(false);
  });

  it('recent_contacts: last interaction within 7d', () => {
    const recent = profile({ lastInteractionAt: new Date('2026-06-03T00:00:00Z') as unknown as RelationshipProfile['lastInteractionAt'] });
    expect(matchesSmartList(recent, 'recent_contacts', NOW)).toBe(true);
  });

  it('vip: isVip flag', () => {
    expect(matchesSmartList(profile({ isVip: true }), 'vip', NOW)).toBe(true);
    expect(matchesSmartList(profile({ isVip: false }), 'vip', NOW)).toBe(false);
  });
});

describe('countBrowseContacts', () => {
  it('counts total / online / offline', () => {
    const list = [c({ status: 'online' }), c({ status: 'online' }), c({ status: 'offline' })];
    expect(countBrowseContacts(list)).toEqual({ total: 3, online: 2, offline: 1 });
  });
});
