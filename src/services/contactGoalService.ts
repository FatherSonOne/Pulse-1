// ============================================
// CONTACT GOAL SERVICE
// CRUD for keep-in-touch goals + action tracking.
// Supabase-first with localStorage fallback.
// Part of: Contacts Reimagined — Phase 4
// ============================================

import {
  ContactGoal,
  ContactGoalRow,
  GoalFrequency,
  calculateNextActionDate,
} from '../types/contactGoalTypes';
import { supabase } from './supabase';

// ==================== LOCAL STORAGE FALLBACK ====================

const LS_GOALS_KEY = 'pulse_contact_goals';

function lsGetGoals(userId: string): ContactGoal[] {
  try {
    const raw = localStorage.getItem(`${LS_GOALS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function lsSaveGoals(userId: string, goals: ContactGoal[]): void {
  try {
    localStorage.setItem(`${LS_GOALS_KEY}_${userId}`, JSON.stringify(goals));
  } catch { /* ignore */ }
}

// ==================== ROW CONVERTERS ====================

function rowToGoal(row: ContactGoalRow): ContactGoal {
  return {
    id: row.id,
    userId: row.user_id,
    contactId: row.contact_id,
    contactEmail: row.contact_email,
    frequency: row.frequency as GoalFrequency,
    channel: row.channel as ContactGoal['channel'],
    notes: row.notes ?? undefined,
    autopilotEnabled: row.autopilot_enabled,
    nextActionAt: row.next_action_at,
    lastCompletedAt: row.last_completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==================== SUPABASE OPERATIONS ====================

async function sbGetGoals(userId: string): Promise<ContactGoal[]> {
  const { data, error } = await supabase
    .from('contact_goals')
    .select('*')
    .eq('user_id', userId)
    .order('next_action_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: ContactGoalRow) => rowToGoal(r));
}

async function sbGetGoalForContact(
  userId: string,
  contactId: string
): Promise<ContactGoal | null> {
  const { data, error } = await supabase
    .from('contact_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToGoal(data as ContactGoalRow) : null;
}

async function sbUpsertGoal(
  goal: Omit<ContactGoal, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<ContactGoal> {
  const nextAt = calculateNextActionDate(goal.frequency);
  const { data, error } = await supabase
    .from('contact_goals')
    .upsert(
      {
        ...(goal.id ? { id: goal.id } : {}),
        user_id: goal.userId,
        contact_id: goal.contactId,
        contact_email: goal.contactEmail,
        frequency: goal.frequency,
        channel: goal.channel,
        notes: goal.notes ?? null,
        autopilot_enabled: goal.autopilotEnabled,
        next_action_at: goal.nextActionAt || nextAt.toISOString(),
        last_completed_at: goal.lastCompletedAt ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,contact_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return rowToGoal(data as ContactGoalRow);
}

async function sbDeleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase
    .from('contact_goals')
    .delete()
    .eq('id', goalId);
  if (error) throw error;
}

async function sbMarkActionComplete(
  goalId: string,
  userId: string,
  frequency: GoalFrequency
): Promise<void> {
  const nextAt = calculateNextActionDate(frequency);
  const { error } = await supabase
    .from('contact_goals')
    .update({
      last_completed_at: new Date().toISOString(),
      next_action_at: nextAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ==================== PUBLIC API ====================

/**
 * Get all goals for a user, sorted by next due date.
 */
export async function getGoals(userId: string): Promise<ContactGoal[]> {
  try {
    return await sbGetGoals(userId);
  } catch {
    return lsGetGoals(userId);
  }
}

/**
 * Get the goal for a specific contact (at most one per contact).
 */
export async function getGoalForContact(
  userId: string,
  contactId: string
): Promise<ContactGoal | null> {
  try {
    return await sbGetGoalForContact(userId, contactId);
  } catch {
    const goals = lsGetGoals(userId);
    return goals.find(g => g.contactId === contactId) ?? null;
  }
}

/**
 * Create or update a contact goal (upsert on user_id+contact_id).
 */
export async function upsertGoal(
  goal: Omit<ContactGoal, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<ContactGoal> {
  try {
    return await sbUpsertGoal(goal);
  } catch {
    const nextAt = calculateNextActionDate(goal.frequency);
    const saved: ContactGoal = {
      ...goal,
      id: goal.id ?? `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      nextActionAt: goal.nextActionAt || nextAt.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const goals = lsGetGoals(goal.userId);
    const existing = goals.findIndex(g => g.contactId === goal.contactId);
    if (existing >= 0) {
      goals[existing] = saved;
    } else {
      goals.push(saved);
    }
    lsSaveGoals(goal.userId, goals);
    return saved;
  }
}

/**
 * Delete a contact goal.
 */
export async function deleteGoal(goalId: string, userId: string): Promise<void> {
  try {
    await sbDeleteGoal(goalId);
  } catch {
    const goals = lsGetGoals(userId).filter(g => g.id !== goalId);
    lsSaveGoals(userId, goals);
  }
}

/**
 * Mark a keep-in-touch action as complete.
 * Advances the next_action_at by the frequency interval.
 */
export async function markActionComplete(
  goalId: string,
  userId: string,
  frequency: GoalFrequency
): Promise<void> {
  try {
    await sbMarkActionComplete(goalId, userId, frequency);
  } catch {
    const goals = lsGetGoals(userId);
    const nextAt = calculateNextActionDate(frequency);
    lsSaveGoals(
      userId,
      goals.map(g =>
        g.id === goalId
          ? {
              ...g,
              lastCompletedAt: new Date().toISOString(),
              nextActionAt: nextAt.toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : g
      )
    );
  }
}

/**
 * Toggle autopilot on/off for a goal.
 */
export async function setAutopilot(
  goalId: string,
  userId: string,
  enabled: boolean
): Promise<void> {
  try {
    const { error } = await supabase
      .from('contact_goals')
      .update({ autopilot_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', goalId)
      .eq('user_id', userId);
    if (error) throw error;
  } catch {
    const goals = lsGetGoals(userId);
    lsSaveGoals(
      userId,
      goals.map(g =>
        g.id === goalId ? { ...g, autopilotEnabled: enabled } : g
      )
    );
  }
}

/**
 * Get goals that are due (next_action_at <= now + 1 day buffer).
 */
export async function getUpcomingActions(userId: string): Promise<ContactGoal[]> {
  const goals = await getGoals(userId);
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr buffer
  return goals.filter(g => new Date(g.nextActionAt) <= cutoff);
}
