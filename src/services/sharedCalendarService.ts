/**
 * sharedCalendarService.ts
 *
 * CRUD for shared/team calendars stored in team_calendars + team_calendar_members.
 * Handles membership management and visibility toggling.
 */

import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type CalendarRole = 'owner' | 'editor' | 'viewer';

export interface TeamCalendar {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  color: string;
  created_by: string;
  is_public: boolean;
  created_at: string;
  // Joined fields
  member_count?: number;
  my_role?: CalendarRole;
}

export interface TeamCalendarMember {
  calendar_id: string;
  user_id: string;
  role: CalendarRole;
  joined_at: string;
  // Joined
  name?: string;
  email?: string;
  avatar_url?: string;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Creates a new team calendar and adds the caller as the owner.
 */
export async function createTeamCalendar(
  name: string,
  color: string,
  memberIds: string[],
  description?: string,
  workspaceId?: string,
): Promise<TeamCalendar> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: calendar, error: calError } = await supabase
    .from('team_calendars')
    .insert({
      name,
      color,
      description:  description ?? null,
      workspace_id: workspaceId ?? null,
      created_by:   user.id,
      is_public:    false,
    })
    .select('*')
    .single();

  if (calError) throw calError;

  // Add creator as owner, then invite members as editors
  const memberRows = [
    { calendar_id: calendar.id, user_id: user.id, role: 'owner' as CalendarRole },
    ...memberIds
      .filter(id => id !== user.id)
      .map(id => ({ calendar_id: calendar.id, user_id: id, role: 'editor' as CalendarRole })),
  ];

  const { error: memberError } = await supabase
    .from('team_calendar_members')
    .insert(memberRows);

  if (memberError) throw memberError;

  return { ...calendar, my_role: 'owner', member_count: memberRows.length } as TeamCalendar;
}

/**
 * Returns all team calendars the current user is a member of.
 */
export async function getMyTeamCalendars(): Promise<TeamCalendar[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch member rows for this user
  const { data: memberRows, error: mErr } = await supabase
    .from('team_calendar_members')
    .select('calendar_id, role')
    .eq('user_id', user.id);

  if (mErr) throw mErr;
  if (!memberRows || memberRows.length === 0) return [];

  const calIds = memberRows.map(r => r.calendar_id);
  const roleMap: Record<string, CalendarRole> = {};
  memberRows.forEach(r => { roleMap[r.calendar_id] = r.role as CalendarRole; });

  const { data: calendars, error: calErr } = await supabase
    .from('team_calendars')
    .select('*')
    .in('id', calIds)
    .order('created_at', { ascending: true });

  if (calErr) throw calErr;

  return (calendars ?? []).map(c => ({
    ...c,
    my_role: roleMap[c.id] ?? 'viewer',
  })) as TeamCalendar[];
}

/**
 * Returns all members of a calendar with their profile details.
 */
export async function getCalendarMembers(calendarId: string): Promise<TeamCalendarMember[]> {
  const { data, error } = await supabase
    .from('team_calendar_members')
    .select('*')
    .eq('calendar_id', calendarId);

  if (error) throw error;
  return (data ?? []) as TeamCalendarMember[];
}

/**
 * Adds a user to a calendar (owner only).
 */
export async function addMember(
  calendarId: string,
  userId: string,
  role: 'editor' | 'viewer' = 'editor',
): Promise<void> {
  const { error } = await supabase
    .from('team_calendar_members')
    .upsert(
      { calendar_id: calendarId, user_id: userId, role },
      { onConflict: 'calendar_id,user_id' },
    );
  if (error) throw error;
}

/**
 * Removes a member from a calendar.
 */
export async function removeMember(calendarId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('team_calendar_members')
    .delete()
    .eq('calendar_id', calendarId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Updates calendar metadata (name, color, description).
 */
export async function updateTeamCalendar(
  id: string,
  changes: Partial<Pick<TeamCalendar, 'name' | 'color' | 'description' | 'is_public'>>,
): Promise<void> {
  const { error } = await supabase
    .from('team_calendars')
    .update(changes)
    .eq('id', id);
  if (error) throw error;
}

/**
 * Deletes a calendar (owner only). Cascades to members and events.
 */
export async function deleteCalendar(id: string): Promise<void> {
  const { error } = await supabase
    .from('team_calendars')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
