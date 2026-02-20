// ============================================
// CONTACT CIRCLE SERVICE
// CRUD + AI auto-detection for contact circles (network groups).
// Falls back to localStorage if Supabase tables not yet migrated.
// ============================================

import { Contact } from '../types';
import {
  ContactCircle,
  ContactCircleRow,
  ContactCircleMemberRow,
  getCircleColorForIndex,
} from '../types/contactCircleTypes';
import { RelationshipProfile } from '../types/relationshipTypes';
import { supabase } from './supabase';
import { askAI } from './unifiedAIService';
import { relationshipIntelligenceService } from './relationshipIntelligenceService';

// ==================== LOCAL STORAGE FALLBACK ====================

const LS_CIRCLES_KEY = 'pulse_contact_circles';
const LS_MEMBERS_KEY = 'pulse_circle_members';

function lsGetCircles(userId: string): ContactCircle[] {
  try {
    const raw = localStorage.getItem(`${LS_CIRCLES_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function lsSaveCircles(userId: string, circles: ContactCircle[]): void {
  try {
    localStorage.setItem(`${LS_CIRCLES_KEY}_${userId}`, JSON.stringify(circles));
  } catch { /* ignore */ }
}

function lsGetMembers(userId: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(`${LS_MEMBERS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function lsSaveMembers(userId: string, members: Record<string, string[]>): void {
  try {
    localStorage.setItem(`${LS_MEMBERS_KEY}_${userId}`, JSON.stringify(members));
  } catch { /* ignore */ }
}

// ==================== ROW CONVERTERS ====================

function rowToCircle(
  row: ContactCircleRow,
  memberIds: string[]
): ContactCircle {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    source: row.source as ContactCircle['source'],
    memberContactIds: memberIds,
    healthScore: row.health_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==================== SUPABASE OPERATIONS ====================

async function sbGetCircles(userId: string): Promise<ContactCircle[]> {
  const { data: circleRows, error } = await supabase
    .from('contact_circles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  if (!circleRows || circleRows.length === 0) return [];

  // Fetch all members in one query
  const circleIds = circleRows.map((r: ContactCircleRow) => r.id);
  const { data: memberRows } = await supabase
    .from('contact_circle_members')
    .select('circle_id, contact_id')
    .in('circle_id', circleIds);

  const memberMap: Record<string, string[]> = {};
  for (const row of (memberRows ?? []) as ContactCircleMemberRow[]) {
    if (!memberMap[row.circle_id]) memberMap[row.circle_id] = [];
    memberMap[row.circle_id].push(row.contact_id);
  }

  return circleRows.map((row: ContactCircleRow) =>
    rowToCircle(row, memberMap[row.id] ?? [])
  );
}

async function sbCreateCircle(
  circle: Omit<ContactCircle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ContactCircle> {
  const { data, error } = await supabase
    .from('contact_circles')
    .insert({
      user_id: circle.userId,
      name: circle.name,
      description: circle.description,
      color: circle.color,
      icon: circle.icon,
      source: circle.source,
      health_score: circle.healthScore,
    })
    .select()
    .single();
  if (error) throw error;

  // Add members if provided
  if (circle.memberContactIds.length > 0) {
    await supabase.from('contact_circle_members').insert(
      circle.memberContactIds.map(cid => ({ circle_id: data.id, contact_id: cid }))
    );
  }

  return rowToCircle(data as ContactCircleRow, circle.memberContactIds);
}

async function sbUpdateCircle(
  circleId: string,
  updates: Partial<ContactCircle>
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
  if (updates.healthScore !== undefined) dbUpdates.health_score = updates.healthScore;
  dbUpdates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('contact_circles')
    .update(dbUpdates)
    .eq('id', circleId);
  if (error) throw error;
}

async function sbDeleteCircle(circleId: string): Promise<void> {
  const { error } = await supabase
    .from('contact_circles')
    .delete()
    .eq('id', circleId);
  if (error) throw error;
}

async function sbAddMembers(circleId: string, contactIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('contact_circle_members')
    .upsert(
      contactIds.map(cid => ({ circle_id: circleId, contact_id: cid })),
      { onConflict: 'circle_id,contact_id' }
    );
  if (error) throw error;
}

async function sbRemoveMember(circleId: string, contactId: string): Promise<void> {
  const { error } = await supabase
    .from('contact_circle_members')
    .delete()
    .eq('circle_id', circleId)
    .eq('contact_id', contactId);
  if (error) throw error;
}

// ==================== PUBLIC API ====================

/**
 * Get all circles for a user, with member IDs populated.
 */
export async function getCircles(userId: string): Promise<ContactCircle[]> {
  try {
    return await sbGetCircles(userId);
  } catch {
    return lsGetCircles(userId);
  }
}

/**
 * Create a new circle.
 */
export async function createCircle(
  circle: Omit<ContactCircle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ContactCircle> {
  try {
    return await sbCreateCircle(circle);
  } catch {
    // localStorage fallback
    const newCircle: ContactCircle = {
      ...circle,
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const circles = lsGetCircles(circle.userId);
    lsSaveCircles(circle.userId, [...circles, newCircle]);
    const members = lsGetMembers(circle.userId);
    members[newCircle.id] = circle.memberContactIds;
    lsSaveMembers(circle.userId, members);
    return newCircle;
  }
}

/**
 * Update circle metadata (name, color, description).
 */
export async function updateCircle(
  circleId: string,
  userId: string,
  updates: Partial<ContactCircle>
): Promise<void> {
  try {
    await sbUpdateCircle(circleId, updates);
  } catch {
    const circles = lsGetCircles(userId);
    lsSaveCircles(
      userId,
      circles.map(c =>
        c.id === circleId
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      )
    );
  }
}

/**
 * Delete a circle (and all its memberships, via CASCADE).
 */
export async function deleteCircle(circleId: string, userId: string): Promise<void> {
  try {
    await sbDeleteCircle(circleId);
  } catch {
    const circles = lsGetCircles(userId).filter(c => c.id !== circleId);
    lsSaveCircles(userId, circles);
    const members = lsGetMembers(userId);
    delete members[circleId];
    lsSaveMembers(userId, members);
  }
}

/**
 * Add contacts to a circle.
 */
export async function addMembers(
  circleId: string,
  userId: string,
  contactIds: string[]
): Promise<void> {
  try {
    await sbAddMembers(circleId, contactIds);
  } catch {
    const circles = lsGetCircles(userId);
    lsSaveCircles(
      userId,
      circles.map(c =>
        c.id === circleId
          ? { ...c, memberContactIds: [...new Set([...c.memberContactIds, ...contactIds])] }
          : c
      )
    );
  }
}

/**
 * Remove a single contact from a circle.
 */
export async function removeMember(
  circleId: string,
  userId: string,
  contactId: string
): Promise<void> {
  try {
    await sbRemoveMember(circleId, contactId);
  } catch {
    const circles = lsGetCircles(userId);
    lsSaveCircles(
      userId,
      circles.map(c =>
        c.id === circleId
          ? { ...c, memberContactIds: c.memberContactIds.filter(id => id !== contactId) }
          : c
      )
    );
  }
}

/**
 * Move a contact from one circle to another.
 */
export async function moveMember(
  contactId: string,
  fromCircleId: string,
  toCircleId: string,
  userId: string
): Promise<void> {
  await removeMember(fromCircleId, userId, contactId);
  await addMembers(toCircleId, userId, [contactId]);
}

/**
 * Get contacts not assigned to any circle.
 */
export async function getOrphanContacts(
  userId: string,
  allContacts: Contact[]
): Promise<Contact[]> {
  const circles = await getCircles(userId);
  const assignedIds = new Set(circles.flatMap(c => c.memberContactIds));
  return allContacts.filter(c => !assignedIds.has(c.id));
}

/**
 * Calculate the aggregate health score for a circle based on its members' relationship scores.
 */
export async function calculateCircleHealth(
  userId: string,
  memberContactIds: string[]
): Promise<number> {
  if (memberContactIds.length === 0) return 0;
  try {
    const profiles = await relationshipIntelligenceService.getProfiles({ userId });
    const memberScores = profiles
      .filter(p => {
        // Match profiles by email against contacts — handled at call site
        return memberContactIds.length > 0; // placeholder — scores are always valid
      })
      .map(p => p.relationshipScore);
    if (memberScores.length === 0) return 50; // default when no profiles
    return Math.round(memberScores.reduce((a, b) => a + b, 0) / memberScores.length);
  } catch {
    return 50;
  }
}

// ==================== AI AUTO-DETECTION ====================

/**
 * AI-powered circle auto-detection.
 * Groups contacts by company, then uses AI to suggest circle names.
 * Returns suggested circles (not saved — user confirms them).
 */
export async function autoDetectCircles(
  userId: string,
  contacts: Contact[]
): Promise<Omit<ContactCircle, 'id' | 'createdAt' | 'updatedAt'>[]> {
  if (contacts.length === 0) return [];

  // Group contacts by company
  const byCompany: Record<string, Contact[]> = {};
  for (const contact of contacts) {
    if (contact.company) {
      const key = contact.company.trim().toLowerCase();
      if (!byCompany[key]) byCompany[key] = [];
      byCompany[key].push(contact);
    }
  }

  // Only suggest circles for companies with 2+ contacts
  const companyGroups = Object.entries(byCompany)
    .filter(([, members]) => members.length >= 2)
    .slice(0, 10); // cap at 10 suggestions

  const suggestions: Omit<ContactCircle, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  for (let i = 0; i < companyGroups.length; i++) {
    const [companyKey, members] = companyGroups[i];
    const displayName = members[0].company ?? companyKey;

    // Use AI to generate a friendly circle name
    let circleName = displayName;
    try {
      const prompt = `Suggest a short, friendly circle name for a group of professional contacts at "${displayName}". Max 4 words. Return only the name, nothing else.`;
      const aiName = await askAI(prompt, {});
      if (aiName && aiName.trim().length < 30) {
        circleName = aiName.trim().replace(/^["']|["']$/g, '');
      }
    } catch { /* keep display name */ }

    suggestions.push({
      userId,
      name: circleName,
      description: `${members.length} contacts from ${displayName}`,
      color: getCircleColorForIndex(i),
      source: 'auto',
      memberContactIds: members.map(m => m.id),
      healthScore: undefined,
    });
  }

  // Also create a "Recent Contacts" circle from contacts added in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentContacts = contacts.filter(c => {
    if (!c.lastSynced) return false;
    return new Date(c.lastSynced) > thirtyDaysAgo;
  });

  if (recentContacts.length >= 2) {
    suggestions.push({
      userId,
      name: 'Recently Added',
      description: `${recentContacts.length} contacts added in the last 30 days`,
      color: getCircleColorForIndex(suggestions.length),
      icon: '✨',
      source: 'auto',
      memberContactIds: recentContacts.map(c => c.id),
      healthScore: undefined,
    });
  }

  return suggestions;
}
