// ============================================================
// Team Radar Service
//
// Backs the Dashboard Team Radar tile. Two fast queries:
//
//   1. Broadcasting members — workspace_members joined with
//      user_locations, filtered to is_sharing AND recent (<15 min).
//      RLS on user_locations enforces bilateral consent, so the
//      result is whatever the current user is allowed to see, not
//      necessarily every team member.
//
//   2. Coverage gaps — contacts in the current user's set whose
//      `last_contacted_at` is stale (configurable; default 21 days)
//      or null. Returns the staleest few for tile preview.
//
// Both functions are intentionally polling-friendly — no realtime
// subscriptions, no fan-out. The tile re-runs them every ~45s.
// ============================================================

import { supabase } from './supabase';
import { workspaceService } from './workspaceService';
import type { WorkspaceMember } from './workspaceService';

export interface BroadcastingMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  lat: number;
  lng: number;
  locationLabel: string | null;
  updatedAt: Date;
  /** Seconds since updatedAt. Computed at fetch time for the chip. */
  staleSeconds: number;
}

export interface CoverageGap {
  contactId: string;
  name: string;
  company: string | null;
  avatarColor: string | null;
  /** ms since epoch, or null when never contacted. */
  lastContactedAt: number | null;
  /** Days since last contact, or `null` when never contacted. */
  daysStale: number | null;
}

export interface TeamRadarSnapshot {
  totalMembers: number;
  broadcasting: BroadcastingMember[];
  coverageGaps: CoverageGap[];
  totalGaps: number;
}

const BROADCAST_FRESHNESS_MS = 15 * 60_000; // 15 min
const DEFAULT_GAP_DAYS = 21;
const MAX_GAP_PREVIEW = 3;

/**
 * One-shot read of everything the Team Radar tile needs. Pass the
 * current user's id so we exclude self from the broadcasting list
 * (self-location is shown elsewhere; the tile is for the *rest of
 * the team*).
 */
export async function loadTeamRadar(
  workspaceId: string,
  selfUserId: string,
  gapDays: number = DEFAULT_GAP_DAYS,
): Promise<TeamRadarSnapshot> {
  const [members, broadcasting, gaps] = await Promise.all([
    workspaceService.getMembers(workspaceId).catch(() => [] as WorkspaceMember[]),
    fetchBroadcasting(workspaceId, selfUserId),
    fetchCoverageGaps(gapDays),
  ]);

  // Join member display data into the broadcasting rows (the locations
  // query doesn't have name/avatar; member list does).
  const memberMap = new Map(members.map(m => [m.user_id, m]));
  const enriched: BroadcastingMember[] = broadcasting
    .filter(b => memberMap.has(b.userId)) // only members of *this* workspace
    .map(b => {
      const m = memberMap.get(b.userId)!;
      return {
        ...b,
        name: m.name ?? m.email ?? 'Team member',
        avatarUrl: m.avatar_url ?? null,
      };
    });

  return {
    totalMembers: members.length,
    broadcasting: enriched,
    coverageGaps: gaps.slice(0, MAX_GAP_PREVIEW),
    totalGaps: gaps.length,
  };
}

async function fetchBroadcasting(
  _workspaceId: string,
  selfUserId: string,
): Promise<Array<Omit<BroadcastingMember, 'name' | 'avatarUrl'>>> {
  const since = new Date(Date.now() - BROADCAST_FRESHNESS_MS).toISOString();
  const { data, error } = await supabase
    .from('user_locations')
    .select('user_id, lat, lng, location_label, updated_at, is_sharing')
    .eq('is_sharing', true)
    .gte('updated_at', since)
    .neq('user_id', selfUserId);

  if (error || !data) return [];

  const now = Date.now();
  return data.map(row => {
    const updatedAt = new Date(row.updated_at as string);
    return {
      userId: String(row.user_id),
      lat: Number(row.lat),
      lng: Number(row.lng),
      locationLabel: (row.location_label ?? null) as string | null,
      updatedAt,
      staleSeconds: Math.max(0, Math.round((now - updatedAt.getTime()) / 1000)),
    };
  });
}

async function fetchCoverageGaps(days: number): Promise<CoverageGap[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  // Two passes joined client-side because Postgres OR with mixed
  // null/value comparisons is awkward via supabase-js. We get the
  // staleest contacts first; never-contacted contacts second.
  const [staleQuery, neverQuery] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, name, company, avatar_color, last_contacted_at')
      .lt('last_contacted_at', cutoff)
      .order('last_contacted_at', { ascending: true })
      .limit(MAX_GAP_PREVIEW * 2),
    supabase
      .from('contacts')
      .select('id, name, company, avatar_color, last_contacted_at')
      .is('last_contacted_at', null)
      .limit(MAX_GAP_PREVIEW * 2),
  ]);

  // Graceful degradation when contacts.last_contacted_at hasn't been
  // provisioned on this Supabase project. Code expects the column
  // (carried over from email_contacts semantics) but no public.contacts
  // migration adds it yet. Warn once and return an empty radar instead
  // of bubbling a 400 into the Dashboard tile.
  const missingColumn =
    (staleQuery.error?.code === '42703' && /last_contacted_at/.test(staleQuery.error.message ?? '')) ||
    (neverQuery.error?.code === '42703' && /last_contacted_at/.test(neverQuery.error.message ?? ''));
  if (missingColumn) {
    console.warn(
      '[teamRadarService] contacts.last_contacted_at column missing. ' +
      'Coverage gaps surface inert until an "ALTER TABLE public.contacts ADD COLUMN last_contacted_at timestamptz" migration is applied.'
    );
    return [];
  }

  const rows = [
    ...(staleQuery.data ?? []),
    ...(neverQuery.data ?? []),
  ];

  const now = Date.now();
  return rows.map(row => {
    const lastTs = row.last_contacted_at
      ? new Date(row.last_contacted_at as string).getTime()
      : null;
    return {
      contactId: String(row.id),
      name: String(row.name ?? 'Unknown contact'),
      company: (row.company ?? null) as string | null,
      avatarColor: (row.avatar_color ?? null) as string | null,
      lastContactedAt: lastTs,
      daysStale: lastTs == null ? null : Math.floor((now - lastTs) / 86_400_000),
    };
  });
}

/** Compact "12m" / "3h" / "2d" staleness label. */
export function formatStaleness(seconds: number): string {
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}
