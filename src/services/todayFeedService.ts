// ============================================
// TODAY FEED SERVICE
// Generates and manages the daily relationship action feed.
// Uses existing relationship intelligence + alert data.
// Falls back to localStorage if Supabase table is not yet migrated.
// ============================================

import { TodayFeedItem, TodayFeedItemType, TodayFeedSuggestedAction } from '../types/todayFeedTypes';
import { RelationshipAlert, AlertType } from '../types/relationshipTypes';
import { ContactGoal } from '../types/contactGoalTypes';
import { Contact } from '../types';
import { relationshipAlertService } from './relationshipAlertService';
import { supabase } from './supabase';
import { askAI } from './unifiedAIService';

// ==================== CONSTANTS ====================

const LOCAL_STORAGE_KEY = 'pulse_today_feed';
const MAX_FEED_ITEMS = 7;

// ==================== LOCAL STORAGE HELPERS ====================

function loadFromLocalStorage(userId: string): TodayFeedItem[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${userId}`);
    if (!raw) return [];
    const items: TodayFeedItem[] = JSON.parse(raw);
    // Filter out expired items
    const now = new Date().toISOString();
    return items.filter(item =>
      item.status === 'active' ||
      (item.status === 'snoozed' && item.snoozedUntil && item.snoozedUntil > now)
    );
  } catch {
    return [];
  }
}

function saveToLocalStorage(userId: string, items: TodayFeedItem[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_${userId}`, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

function updateItemInLocalStorage(userId: string, itemId: string, updates: Partial<TodayFeedItem>): void {
  const items = loadFromLocalStorage(userId);
  // Re-load all including completed/dismissed for update
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${userId}`);
    const all: TodayFeedItem[] = raw ? JSON.parse(raw) : [];
    const updated = all.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_${userId}`, JSON.stringify(updated));
  } catch {
    // fallback: update what we have
    const updated = items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    saveToLocalStorage(userId, updated);
  }
}

// ==================== ALERT → FEED ITEM CONVERSION ====================

const ALERT_TYPE_TO_FEED_TYPE: Partial<Record<AlertType, TodayFeedItemType>> = {
  relationship_decay:  'cooling',
  cold_contact:        'cooling',
  warm_lead:           'hot_lead',
  birthday_reminder:   'birthday',
  anniversary_reminder:'reconnect',
  follow_up_due:       'follow_up',
  no_response:         'awaiting_response',
  awaiting_response:   'awaiting_response',
  meeting_prep:        'meeting_prep',
  re_engagement:       'reconnect',
  vip_activity:        'vip_alert',
  milestone:           'custom',
};

const ALERT_TYPE_TO_ACTION: Partial<Record<AlertType, TodayFeedSuggestedAction>> = {
  relationship_decay:  'message',
  cold_contact:        'message',
  warm_lead:           'message',
  birthday_reminder:   'vox',
  anniversary_reminder:'message',
  follow_up_due:       'message',
  no_response:         'message',
  awaiting_response:   'message',
  meeting_prep:        'review',
  re_engagement:       'message',
  vip_activity:        'message',
  milestone:           'review',
};

function alertToFeedItem(alert: RelationshipAlert, userId: string): TodayFeedItem {
  const feedType = ALERT_TYPE_TO_FEED_TYPE[alert.alertType] ?? 'custom';
  const suggestedAction = ALERT_TYPE_TO_ACTION[alert.alertType] ?? 'message';

  // Resolve contact details from joined profile data
  const profile = alert.profile;
  const contactName = profile?.contactName ?? 'there';
  const draftMessages: Partial<Record<AlertType, string>> = {
    relationship_decay:   `Hey ${contactName}, I realized it's been a while since we connected. Wanted to reach out and catch up — hope you're doing well!`,
    cold_contact:         `Hi ${contactName}! It's been too long. I was thinking about our last conversation and wanted to check in. How are things going?`,
    warm_lead:            `Hi ${contactName}, I've been thinking about our conversation and wanted to follow up. Do you have a few minutes to chat this week?`,
    birthday_reminder:    `Happy Birthday, ${contactName}! 🎉 Hope you have a wonderful day!`,
    follow_up_due:        `Hi ${contactName}, just following up on our last conversation. Wanted to make sure I didn't drop the ball on anything. What's the best next step?`,
    no_response:          `Hi ${contactName}, I wanted to bump this up in case it got buried. Let me know if you have any questions or if there's anything I can help with!`,
    awaiting_response:    `Hey ${contactName}, just wanted to check in on the message I sent a few days ago. Happy to clarify anything or adjust if needed!`,
    re_engagement:        `Hi ${contactName}, it's been a while — I'd love to reconnect and catch up. Would you be open to a quick call sometime this week?`,
    vip_activity:         `Hey ${contactName}, I saw your recent update and wanted to reach out. Would love to hear more about what you're working on!`,
  };

  // Use profile email as contactId fallback (profile.id is the profile UUID)
  const contactId = profile?.id ?? alert.profileId ?? '';

  return {
    id: `alert_${alert.id}`,
    userId,
    contactId,
    contactName:  profile?.contactName ?? 'Unknown',
    contactAvatarColor: undefined, // resolved at render time from Contact list
    relationshipScore:  profile?.relationshipScore,
    itemType:         feedType,
    priority:         alert.priority ?? 5,
    title:            alert.title,
    subtitle:         alert.description ?? '',
    aiDraftMessage:   draftMessages[alert.alertType],
    suggestedAction,
    status:          'active',
    createdAt:       alert.createdAt ? new Date(alert.createdAt).toISOString() : new Date().toISOString(),
    metadata:        { sourceAlertId: alert.id, alertType: alert.alertType },
  };
}

// ==================== SUPABASE OPERATIONS ====================

async function supabaseSaveFeedItems(items: TodayFeedItem[]): Promise<void> {
  const rows = items.map(item => ({
    id: item.id,
    user_id: item.userId,
    contact_id: item.contactId,
    contact_name: item.contactName,
    item_type: item.itemType,
    priority: item.priority,
    title: item.title,
    subtitle: item.subtitle,
    ai_draft_message: item.aiDraftMessage,
    suggested_action: item.suggestedAction,
    suggested_channel: item.suggestedChannel,
    expires_at: item.expiresAt,
    status: item.status,
    snoozed_until: item.snoozedUntil,
    completed_at: item.completedAt,
    metadata: item.metadata,
    created_at: item.createdAt,
  }));

  await supabase.from('today_feed_items').upsert(rows, { onConflict: 'id' });
}

async function supabaseGetFeedItems(userId: string, status?: string): Promise<TodayFeedItem[]> {
  let query = supabase
    .from('today_feed_items')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id:               row.id as string,
    userId:           row.user_id as string,
    contactId:        row.contact_id as string,
    contactName:      row.contact_name as string,
    itemType:         row.item_type as TodayFeedItemType,
    priority:         row.priority as number,
    title:            row.title as string,
    subtitle:         row.subtitle as string,
    aiDraftMessage:   row.ai_draft_message as string | undefined,
    suggestedAction:  row.suggested_action as TodayFeedSuggestedAction,
    suggestedChannel: row.suggested_channel as string | undefined,
    expiresAt:        row.expires_at as string | undefined,
    status:           row.status as TodayFeedItem['status'],
    snoozedUntil:     row.snoozed_until as string | undefined,
    completedAt:      row.completed_at as string | undefined,
    metadata:         row.metadata as Record<string, unknown> | undefined,
    createdAt:        row.created_at as string,
  }));
}

async function supabaseUpdateFeedItem(itemId: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('today_feed_items')
    .update(updates)
    .eq('id', itemId);
  if (error) throw error;
}

// ==================== GOAL → FEED ITEM CONVERSION ====================

/**
 * Convert a ContactGoal (autopilot) into a TodayFeedItem with autopilot badge.
 */
function goalToFeedItem(
  goal: ContactGoal,
  contact: Contact,
  draftMessage?: string
): TodayFeedItem {
  const channel = goal.channel === 'any' ? 'message' : goal.channel;
  return {
    id: `autopilot_${goal.id}`,
    userId: goal.userId,
    contactId: goal.contactId,
    contactName: contact.name,
    contactAvatarColor: contact.avatarColor,
    relationshipScore: undefined,
    itemType: 'follow_up',
    priority: 2, // autopilot items are high priority
    title: `Time to reach out to ${contact.name}`,
    subtitle: goal.notes
      ? `Reminder: ${goal.notes}`
      : `You set a ${goal.frequency.replace('biweekly', 'bi-weekly')} ${channel} goal for this contact.`,
    aiDraftMessage: draftMessage,
    suggestedAction: channel as TodayFeedSuggestedAction,
    status: 'active',
    createdAt: new Date().toISOString(),
    metadata: {
      sourceGoalId: goal.id,
      isAutopilot: true,
      frequency: goal.frequency,
    },
  };
}

/**
 * Build autopilot feed items from due goals.
 * Filters out goals that already have an active feed item.
 */
export function buildAutopilotFeedItems(
  goals: ContactGoal[],
  contacts: Contact[],
  existingItemIds: Set<string>
): TodayFeedItem[] {
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const now = new Date();
  const items: TodayFeedItem[] = [];

  for (const goal of goals) {
    const itemId = `autopilot_${goal.id}`;
    if (existingItemIds.has(itemId)) continue;
    if (!goal.autopilotEnabled) continue;
    if (new Date(goal.nextActionAt) > now) continue;

    const contact = contactMap.get(goal.contactId);
    if (!contact) continue;

    items.push(goalToFeedItem(goal, contact));
  }

  return items;
}

// ==================== PUBLIC API ====================

/**
 * Generate the today feed for a user.
 * Pulls from existing RelationshipAlerts, de-dupes against already-seen items,
 * caps at MAX_FEED_ITEMS active items, and persists (Supabase or localStorage).
 */
export async function generateTodayFeed(userId: string): Promise<TodayFeedItem[]> {
  try {
    // 1. Pull existing active/snoozed items from Supabase
    let existingItems: TodayFeedItem[] = [];
    let useSupabase = true;
    try {
      existingItems = await supabaseGetFeedItems(userId, 'active');
      const snoozed = await supabaseGetFeedItems(userId, 'snoozed');
      existingItems = [...existingItems, ...snoozed];
    } catch {
      useSupabase = false;
      existingItems = loadFromLocalStorage(userId);
    }

    const existingIds = new Set(existingItems.map(i => i.id));

    // 2. Fetch relationship alerts and convert to feed items
    relationshipAlertService.setUserId(userId);
    const alerts = await relationshipAlertService.getActiveAlerts();
    const newItems: TodayFeedItem[] = [];

    for (const alert of alerts) {
      const feedId = `alert_${alert.id}`;
      if (!existingIds.has(feedId)) {
        newItems.push(alertToFeedItem(alert, userId));
      }
    }

    // 3. Merge and sort by priority
    const allItems = [...existingItems, ...newItems]
      .sort((a, b) => a.priority - b.priority)
      .slice(0, MAX_FEED_ITEMS * 2); // keep buffer for filter usage

    // 4. Persist new items
    if (newItems.length > 0) {
      if (useSupabase) {
        try {
          await supabaseSaveFeedItems(newItems);
        } catch {
          saveToLocalStorage(userId, allItems);
        }
      } else {
        saveToLocalStorage(userId, allItems);
      }
    }

    return allItems.filter(i => i.status === 'active').slice(0, MAX_FEED_ITEMS * 2);
  } catch (err) {
    console.error('[TodayFeedService] generateTodayFeed error:', err);
    // Ultimate fallback: return from localStorage
    return loadFromLocalStorage(userId);
  }
}

/**
 * Get feed items for a user, optionally filtered by status.
 */
export async function getFeedItems(userId: string, status?: string): Promise<TodayFeedItem[]> {
  try {
    return await supabaseGetFeedItems(userId, status);
  } catch {
    const items = loadFromLocalStorage(userId);
    return status ? items.filter(i => i.status === status) : items;
  }
}

/**
 * Mark a feed item as completed.
 */
export async function completeFeedItem(itemId: string, userId: string): Promise<void> {
  const completedAt = new Date().toISOString();
  try {
    await supabaseUpdateFeedItem(itemId, { status: 'completed', completed_at: completedAt });
  } catch {
    updateItemInLocalStorage(userId, itemId, { status: 'completed', completedAt });
  }
}

/**
 * Snooze a feed item until a given date.
 */
export async function snoozeFeedItem(itemId: string, userId: string, until: Date): Promise<void> {
  const snoozedUntil = until.toISOString();
  try {
    await supabaseUpdateFeedItem(itemId, { status: 'snoozed', snoozed_until: snoozedUntil });
  } catch {
    updateItemInLocalStorage(userId, itemId, { status: 'snoozed', snoozedUntil });
  }
}

/**
 * Dismiss a feed item permanently.
 */
export async function dismissFeedItem(itemId: string, userId: string): Promise<void> {
  try {
    await supabaseUpdateFeedItem(itemId, { status: 'dismissed' });
  } catch {
    updateItemInLocalStorage(userId, itemId, { status: 'dismissed' });
  }
}

// ==================== AI DRAFT GENERATION ====================

/**
 * Generate a contextual AI draft message for a single feed item.
 * Called lazily — feed items have template drafts by default, this upgrades them.
 * @param item  The feed item needing a draft
 * @param topics  Optional list of known conversation topics for this contact
 * @param lastInteraction  Optional description of last interaction context
 */
export async function generateAIDraftMessage(
  item: TodayFeedItem,
  topics?: string[],
  lastInteraction?: string
): Promise<string> {
  const topicsStr = topics && topics.length > 0
    ? `Known conversation topics: ${topics.slice(0, 3).join(', ')}.`
    : '';
  const lastStr = lastInteraction
    ? `Last interaction context: ${lastInteraction}.`
    : '';

  const prompt = `Write a short, natural, friendly message to ${item.contactName} for this situation: ${item.title}. ${item.subtitle ? `Context: ${item.subtitle}.` : ''} ${topicsStr} ${lastStr}

Requirements:
- 1-3 sentences maximum
- Warm and personal, not generic
- End with a clear but soft call-to-action
- No subject line, no greeting like "Hi [name]," — start with the message body
- Sound like it was written by a human, not AI

Return only the message text, nothing else.`;

  try {
    const draft = await askAI(prompt, {});
    return draft.trim();
  } catch {
    // Return the item's existing template draft or empty string
    return item.aiDraftMessage ?? '';
  }
}

/**
 * Enrich a list of feed items with AI-generated draft messages.
 * Processes items in parallel (up to 3 at a time) to avoid overwhelming the AI service.
 * Returns updated items — does not mutate the originals.
 */
export async function enrichFeedItemsWithAIDrafts(
  items: TodayFeedItem[],
  profileTopics?: Record<string, string[]>  // contactId → topics
): Promise<TodayFeedItem[]> {
  const BATCH_SIZE = 3;
  const result = [...items];

  for (let i = 0; i < result.length; i += BATCH_SIZE) {
    const batch = result.slice(i, i + BATCH_SIZE);
    const enriched = await Promise.all(
      batch.map(async (item) => {
        // Only generate for items with 'message' or 'vox' actions
        if (!['message', 'vox', 'email'].includes(item.suggestedAction)) return item;
        const topics = profileTopics?.[item.contactId];
        const draft = await generateAIDraftMessage(item, topics);
        return draft ? { ...item, aiDraftMessage: draft } : item;
      })
    );
    for (let j = 0; j < enriched.length; j++) {
      result[i + j] = enriched[j];
    }
  }

  return result;
}
