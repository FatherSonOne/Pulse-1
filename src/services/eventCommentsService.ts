/**
 * eventCommentsService.ts
 *
 * CRUD + real-time for threaded event comments stored in `event_comments`.
 * Soft-deletes preserve thread continuity (replies still render).
 */

import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EventComment {
  id: string;
  event_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  edited_at: string | null;
  created_at: string;
  deleted_at: string | null;
  // Joined from profiles (populated client-side if available)
  author?: {
    id: string;
    name: string;
    avatar_url?: string;
    avatar_color?: string;
  };
}

export interface CommentThread extends EventComment {
  replies: EventComment[];
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetches all comments for an event and assembles them into a thread tree.
 * Soft-deleted comments with replies are kept as placeholder nodes.
 */
export async function getComments(eventId: string): Promise<CommentThread[]> {
  const { data, error } = await supabase
    .from('event_comments')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  const all = (data ?? []) as EventComment[];

  // Build tree
  const byId: Record<string, CommentThread> = {};
  all.forEach(c => { byId[c.id] = { ...c, replies: [] }; });

  const roots: CommentThread[] = [];
  all.forEach(c => {
    if (c.parent_id && byId[c.parent_id]) {
      byId[c.parent_id].replies.push(byId[c.id]);
    } else {
      roots.push(byId[c.id]);
    }
  });

  return roots;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Adds a new top-level comment or reply.
 */
export async function addComment(
  eventId: string,
  userId: string,
  body: string,
  parentId?: string,
): Promise<EventComment> {
  const { data, error } = await supabase
    .from('event_comments')
    .insert({
      event_id:  eventId,
      user_id:   userId,
      parent_id: parentId ?? null,
      body,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as EventComment;
}

/**
 * Edits a comment body and sets edited_at.
 */
export async function editComment(
  commentId: string,
  userId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase
    .from('event_comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('user_id', userId); // ensures only the author can edit

  if (error) throw error;
}

/**
 * Soft-deletes a comment by setting deleted_at.
 * Replies remain visible; the comment body is replaced with "[Comment deleted]" in the UI.
 */
export async function deleteComment(
  commentId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('event_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('user_id', userId);

  if (error) throw error;
}

// ── Real-time ────────────────────────────────────────────────────────────────

/**
 * Subscribes to comment changes for an event.
 * Calls `callback` with the full refreshed thread tree on any change.
 * Returns an unsubscribe function.
 */
export function subscribeToComments(
  eventId: string,
  callback: (threads: CommentThread[]) => void,
): () => void {
  const channel = supabase
    .channel(`event-comments-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'event_comments',
        filter: `event_id=eq.${eventId}`,
      },
      async () => {
        const threads = await getComments(eventId);
        callback(threads);
      },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
