// src/types/conversations.ts
//
// Unified conversation abstraction over the two chat surfaces:
//   - Workspace channels (MessageChannel from types/messages.ts)
//   - Pulse direct messages (PulseConversation from services/pulseService.ts)
//
// Introduced in Phase 5c so MessagesSplitView can render both kinds in
// one thread list without bloating its props or duplicating selectors.
// Consumers branch on `kind` only when behavior diverges (send/load
// handlers, message rendering); for shared concerns (sort, display name,
// unread count) they call the helpers below.

import type { MessageChannel } from './messages';
import type { PulseConversation } from '../services/pulseService';

export type Conversation =
  | { kind: 'channel'; channel: MessageChannel }
  | { kind: 'dm'; pulse: PulseConversation };

// ─── Identity / equality ────────────────────────────────────

/** Stable id for the conversation regardless of kind. */
export function conversationId(c: Conversation): string {
  return c.kind === 'channel' ? c.channel.id : c.pulse.id;
}

/** Convenience: find a Conversation by id in a list. */
export function findConversation(
  list: Conversation[],
  id: string | null
): Conversation | null {
  if (!id) return null;
  return list.find((c) => conversationId(c) === id) ?? null;
}

// ─── Display ────────────────────────────────────────────────

export function conversationDisplayName(c: Conversation): string {
  if (c.kind === 'channel') {
    return c.channel.name;
  }
  const u = c.pulse.other_user;
  return u?.display_name || u?.full_name || u?.handle || 'Unknown';
}

export function conversationDescription(c: Conversation): string | undefined {
  return c.kind === 'channel' ? c.channel.description : undefined;
}

export function conversationLastMessagePreview(c: Conversation): string {
  if (c.kind === 'channel') return c.channel.last_message ?? '';
  return c.pulse.last_message_preview ?? '';
}

export function conversationLastMessageAt(c: Conversation): string | null {
  if (c.kind === 'channel') return c.channel.last_message_at ?? null;
  return c.pulse.last_message_at ?? null;
}

export function conversationUnreadCount(c: Conversation): number {
  if (c.kind === 'channel') return c.channel.unread_count ?? 0;
  return c.pulse.unread_count ?? 0;
}

export function conversationIsGroup(c: Conversation): boolean {
  return c.kind === 'channel' ? c.channel.is_group : false;
}

// ─── Sorting / merging ──────────────────────────────────────

/** Sort newest-active first. Falls back to created_at when there's no
 *  activity yet so brand-new conversations bubble to the top. */
export function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const aTime = conversationLastMessageAt(a) ??
      (a.kind === 'channel' ? a.channel.created_at : a.pulse.created_at);
    const bTime = conversationLastMessageAt(b) ??
      (b.kind === 'channel' ? b.channel.created_at : b.pulse.created_at);
    return bTime.localeCompare(aTime);
  });
}

/** Merge a channel list and a Pulse-conversation list into a sorted
 *  unified `Conversation[]`. Duplicates are not expected because ids
 *  come from different table primary keys, but if any collide the
 *  channel form wins. */
export function mergeConversations(
  channels: MessageChannel[],
  pulseConversations: PulseConversation[]
): Conversation[] {
  const merged: Conversation[] = [
    ...channels.map((ch): Conversation => ({ kind: 'channel', channel: ch })),
    ...pulseConversations.map((pc): Conversation => ({ kind: 'dm', pulse: pc })),
  ];
  return sortConversations(merged);
}

// ─── Type guards ────────────────────────────────────────────

export function isChannel(c: Conversation): c is { kind: 'channel'; channel: MessageChannel } {
  return c.kind === 'channel';
}

export function isDM(c: Conversation): c is { kind: 'dm'; pulse: PulseConversation } {
  return c.kind === 'dm';
}
