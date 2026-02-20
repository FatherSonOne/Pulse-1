// ============================================
// RELATIONSHIP AUTOPILOT SERVICE
// Generates keep-in-touch draft messages + scheduled actions.
// Uses AI to write personalised, context-aware messages.
// Part of: Contacts Reimagined — Phase 4
// ============================================

import { Contact } from '../types';
import { RelationshipProfile } from '../types/relationshipTypes';
import { ContactGoal, AutopilotAction, AutopilotActionType } from '../types/contactGoalTypes';
import { askAI } from './unifiedAIService';

// ==================== DRAFT MESSAGE GENERATOR ====================

/**
 * Generate a context-aware keep-in-touch message using AI.
 * Falls back to a sensible template if AI fails.
 */
export async function draftKeepInTouchMessage(
  contact: Contact,
  goal: ContactGoal,
  profile?: RelationshipProfile
): Promise<string> {
  const topics = profile?.aiTopics?.slice(0, 3).join(', ');
  const style = profile?.aiCommunicationStyle ?? 'friendly';
  const lastInteraction = profile?.lastInteractionAt
    ? new Date(profile.lastInteractionAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const prompt = [
    `Write a short, ${style} keep-in-touch message to ${contact.name}`,
    contact.company ? `(${contact.role} at ${contact.company})` : `(${contact.role})`,
    lastInteraction ? `— you last connected in ${lastInteraction}.` : '.',
    topics ? `They care about: ${topics}.` : '',
    `Channel: ${goal.channel}. Max 2 sentences. Sound natural, not templated.`,
    `Return only the message text, no subject line.`,
  ].filter(Boolean).join(' ');

  try {
    const draft = await askAI(prompt, {});
    if (draft && draft.trim().length > 10) {
      return draft.trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* fall through to template */ }

  // Template fallback
  const templates: Record<string, string> = {
    call: `Hey ${contact.name.split(' ')[0]}, been a while — would love to catch up over a quick call. When are you free?`,
    meeting: `Hi ${contact.name.split(' ')[0]}, I'd love to reconnect. Are you up for a quick coffee or video call?`,
    email: `Hi ${contact.name.split(' ')[0]},\n\nJust checking in — hope all is well! I'd love to hear what you've been up to lately.`,
    message: `Hey ${contact.name.split(' ')[0]}! Hope you're doing well. Just wanted to check in 👋`,
    any: `Hey ${contact.name.split(' ')[0]}! Hope things are going great — let's catch up soon.`,
  };

  return templates[goal.channel] ?? templates.any;
}

// ==================== AUTOPILOT ACTIONS ====================

/**
 * Generate autopilot actions for all goals that are due.
 */
export async function generateAutopilotActions(
  goals: ContactGoal[],
  contacts: Contact[],
  profiles: RelationshipProfile[]
): Promise<AutopilotAction[]> {
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const profileByEmail = new Map(profiles.map(p => [p.contactEmail.toLowerCase(), p]));
  const now = new Date();

  const dueGoals = goals.filter(g => {
    if (!g.autopilotEnabled) return false;
    return new Date(g.nextActionAt) <= now;
  });

  const actions: AutopilotAction[] = [];

  for (const goal of dueGoals) {
    const contact = contactMap.get(goal.contactId);
    if (!contact) continue;

    const profile = profileByEmail.get(contact.email?.toLowerCase() ?? '');
    const actionType = inferActionType(goal, contact);

    // Generate draft message (AI or template)
    let draftMessage: string | undefined;
    try {
      draftMessage = await draftKeepInTouchMessage(contact, goal, profile);
    } catch { /* no draft */ }

    actions.push({
      id: `autopilot_${goal.id}_${Date.now()}`,
      userId: goal.userId,
      contactId: goal.contactId,
      contactName: contact.name,
      contactAvatarColor: contact.avatarColor,
      goalId: goal.id,
      actionType,
      draftMessage,
      channel: goal.channel,
      dueAt: goal.nextActionAt,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  return actions;
}

function inferActionType(goal: ContactGoal, contact: Contact): AutopilotActionType {
  // Check birthday proximity
  if (contact.birthday) {
    const bday = new Date(contact.birthday);
    const now = new Date();
    const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
    const daysUntilBirthday = Math.ceil(
      (thisYearBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilBirthday >= 0 && daysUntilBirthday <= 7) {
      return 'birthday_reminder';
    }
  }

  return 'keep_in_touch';
}

// ==================== NEXT ACTION DATE ====================

/**
 * Calculate when the next autopilot action should fire.
 * Respects the user's preferred contact frequency.
 */
export function calculateNextActionDate(
  frequencyDays: number,
  lastCompletedAt?: string
): Date {
  const base = lastCompletedAt ? new Date(lastCompletedAt) : new Date();
  return new Date(base.getTime() + frequencyDays * 24 * 60 * 60 * 1000);
}

// ==================== CONTACT CONTEXT SUMMARY ====================

/**
 * Build a short context string for a contact (used in AI prompts).
 */
export function buildContactContext(
  contact: Contact,
  profile?: RelationshipProfile
): string {
  const parts: string[] = [contact.name];
  if (contact.role) parts.push(contact.role);
  if (contact.company) parts.push(`at ${contact.company}`);
  if (profile?.aiTopics?.length) {
    parts.push(`— interested in ${profile.aiTopics.slice(0, 2).join(', ')}`);
  }
  if (profile?.lastInteractionAt) {
    const last = new Date(profile.lastInteractionAt);
    parts.push(`— last contact ${last.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
  }
  return parts.join(' ');
}
