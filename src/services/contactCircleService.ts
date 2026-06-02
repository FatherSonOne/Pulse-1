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

// ==================== AI AUTO-DETECTION ====================

const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com',
  'hotmail.com', 'proton.me', 'gmx.com', 'aol.com',
  'mail.com', 'fastmail.com',
]);

const ROLE_LOCAL_PARTS = new Set([
  'info', 'support', 'admin', 'noreply', 'no-reply',
  'sales', 'contact', 'hello', 'team', 'help',
]);

export interface CircleSuggestion extends Omit<ContactCircle, 'id' | 'createdAt' | 'updatedAt'> {
  type: 'company' | 'email_domain' | 'rfm_cohort';
  label: string;
  contact_ids: string[];
}

function emailDomainClusterKey(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at < 0) return null;
  const localPart = email.slice(0, at).toLowerCase().split('+')[0];
  if (ROLE_LOCAL_PARTS.has(localPart)) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (FREE_EMAIL_PROVIDERS.has(domain)) return null;
  const parts = domain.split('.');
  if (parts.length >= 2) return parts.slice(-2).join('.');
  return domain;
}

type RfmCohort = 'active' | 'warm' | 'cooling' | 'stale' | 'dormant';

function rfmCohortFor(lastSeenIso: string | null | undefined): RfmCohort | null {
  if (!lastSeenIso) return null;
  const ms = Date.now() - new Date(lastSeenIso).getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  if (Number.isNaN(days)) return null;
  if (days <= 30) return 'active';
  if (days <= 90) return 'warm';
  if (days <= 180) return 'cooling';
  if (days <= 365) return 'stale';
  return 'dormant';
}

function lastSeenIsoFor(contact: Contact): string | null {
  const withInteraction = contact as Contact & { lastInteractionAt?: Date | string | null };
  const lastSeen = withInteraction.lastInteractionAt ?? contact.lastSynced;
  if (!lastSeen) return null;
  return lastSeen instanceof Date ? lastSeen.toISOString() : lastSeen;
}

function labelForRfmCohort(cohort: RfmCohort, count: number): string {
  return `${cohort} (${count} contacts)`;
}

function titleForRfmCohort(cohort: RfmCohort): string {
  switch (cohort) {
    case 'active': return 'Active Contacts';
    case 'warm': return 'Warm Contacts';
    case 'cooling': return 'Cooling Contacts';
    case 'stale': return 'Stale Contacts';
    case 'dormant': return 'Dormant Contacts';
  }
}

/**
 * AI-powered circle auto-detection.
 * Groups contacts by company, then uses AI to suggest circle names.
 * Returns suggested circles (not saved — user confirms them).
 */
export async function autoDetectCircles(
  userId: string,
  contacts: Contact[]
): Promise<CircleSuggestion[]> {
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

  const suggestions: CircleSuggestion[] = [];

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
      type: 'company',
      label: displayName,
      contact_ids: members.map(m => m.id),
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
      type: 'rfm_cohort',
      label: labelForRfmCohort('active', recentContacts.length),
      contact_ids: recentContacts.map(c => c.id),
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

  const byEmailDomain: Record<string, Contact[]> = {};
  for (const contact of contacts) {
    const key = emailDomainClusterKey(contact.email);
    if (!key) continue;
    if (!byEmailDomain[key]) byEmailDomain[key] = [];
    byEmailDomain[key].push(contact);
  }

  const emailDomainGroups = Object.entries(byEmailDomain)
    .filter(([, members]) => members.length >= 2);

  for (const [domain, members] of emailDomainGroups) {
    suggestions.push({
      type: 'email_domain',
      label: domain,
      contact_ids: members.map(m => m.id),
      userId,
      name: domain,
      description: `${members.length} contacts with ${domain} email addresses`,
      color: getCircleColorForIndex(suggestions.length),
      source: 'auto',
      memberContactIds: members.map(m => m.id),
      healthScore: undefined,
    });
  }

  const byRfmCohort: Record<RfmCohort, Contact[]> = {
    active: [],
    warm: [],
    cooling: [],
    stale: [],
    dormant: [],
  };

  for (const contact of contacts) {
    const cohort = rfmCohortFor(lastSeenIsoFor(contact));
    if (cohort) byRfmCohort[cohort].push(contact);
  }

  const rfmCohorts: RfmCohort[] = ['active', 'warm', 'cooling', 'stale', 'dormant'];
  for (const cohort of rfmCohorts) {
    const members = byRfmCohort[cohort];
    if (members.length < 2) continue;
    suggestions.push({
      type: 'rfm_cohort',
      label: labelForRfmCohort(cohort, members.length),
      contact_ids: members.map(c => c.id),
      userId,
      name: titleForRfmCohort(cohort),
      description: `${members.length} contacts in the ${cohort} recency cohort`,
      color: getCircleColorForIndex(suggestions.length),
      source: 'auto',
      memberContactIds: members.map(c => c.id),
      healthScore: undefined,
    });
  }

  return suggestions;
}
