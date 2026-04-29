// Comments service for decisions and tasks. Phase 3 of the Decisions and
// Tasks overhaul. Mirrors the activity service shape so per-item comment
// threads and the activity feed can both refresh from the same patterns.

import { supabase } from './supabase';
import { decisionActivityService } from './decisionActivityService';

export type CommentSource = 'decision' | 'task';

export interface Comment {
  id: string;
  source: CommentSource;
  /** decision_id or task_id depending on source. */
  itemId: string;
  workspaceId: string;
  userId: string;
  body: string;
  parentCommentId: string | null;
  mentionedUserIds: string[];
  createdAt: string;
  editedAt: string | null;
}

interface RawDecisionComment {
  id: string;
  decision_id: string;
  workspace_id: string;
  user_id: string;
  body: string;
  parent_comment_id: string | null;
  mentioned_user_ids: string[] | null;
  created_at: string;
  edited_at: string | null;
}

interface RawTaskComment {
  id: string;
  task_id: string;
  workspace_id: string;
  user_id: string;
  body: string;
  parent_comment_id: string | null;
  mentioned_user_ids: string[] | null;
  created_at: string;
  edited_at: string | null;
}

function fromDecisionRow(r: RawDecisionComment): Comment {
  return {
    id: r.id,
    source: 'decision',
    itemId: r.decision_id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    body: r.body,
    parentCommentId: r.parent_comment_id,
    mentionedUserIds: r.mentioned_user_ids ?? [],
    createdAt: r.created_at,
    editedAt: r.edited_at,
  };
}

function fromTaskRow(r: RawTaskComment): Comment {
  return {
    id: r.id,
    source: 'task',
    itemId: r.task_id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    body: r.body,
    parentCommentId: r.parent_comment_id,
    mentionedUserIds: r.mentioned_user_ids ?? [],
    createdAt: r.created_at,
    editedAt: r.edited_at,
  };
}

/**
 * Extract @mention user ids from a comment body. Match `@user-id` syntax
 * where the picker writes member ids (uuids) directly so we can do a simple
 * regex pass instead of a name-resolution lookup.
 */
function extractMentions(body: string, knownUserIds: string[]): string[] {
  const matches = body.match(/@[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g);
  if (!matches) return [];
  const mentioned = new Set<string>();
  for (const raw of matches) {
    const id = raw.slice(1); // drop the leading @
    if (knownUserIds.includes(id)) mentioned.add(id);
  }
  return Array.from(mentioned);
}

export const decisionCommentsService = {
  async listForDecision(decisionId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('decision_comments')
      .select('*')
      .eq('decision_id', decisionId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading decision comments:', error);
      return [];
    }
    return (data ?? []).map(fromDecisionRow);
  },

  async listForTask(taskId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading task comments:', error);
      return [];
    }
    return (data ?? []).map(fromTaskRow);
  },

  async addComment(opts: {
    source: CommentSource;
    itemId: string;
    workspaceId: string;
    userId: string;
    body: string;
    parentCommentId?: string | null;
    /** Pool of user ids the picker offered, for mention validation. */
    knownUserIds?: string[];
  }): Promise<Comment | null> {
    const trimmed = opts.body.trim();
    if (!trimmed) return null;

    const mentioned = extractMentions(trimmed, opts.knownUserIds ?? []);
    const table = opts.source === 'decision' ? 'decision_comments' : 'task_comments';
    const itemKey = opts.source === 'decision' ? 'decision_id' : 'task_id';

    const { data, error } = await supabase
      .from(table)
      .insert({
        [itemKey]: opts.itemId,
        workspace_id: opts.workspaceId,
        user_id: opts.userId,
        body: trimmed,
        parent_comment_id: opts.parentCommentId ?? null,
        mentioned_user_ids: mentioned,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      return null;
    }

    // Log decision comments to the activity feed. Task activity continues
    // to flow through the existing task-activity trigger paths.
    if (opts.source === 'decision') {
      await decisionActivityService.logDecisionEvent({
        decisionId: opts.itemId,
        workspaceId: opts.workspaceId,
        userId: opts.userId,
        action: 'comment_added',
        metadata: { commentId: (data as { id: string }).id, mentioned },
      });
    }

    return opts.source === 'decision'
      ? fromDecisionRow(data as RawDecisionComment)
      : fromTaskRow(data as RawTaskComment);
  },

  async editComment(opts: {
    source: CommentSource;
    commentId: string;
    body: string;
    knownUserIds?: string[];
  }): Promise<Comment | null> {
    const trimmed = opts.body.trim();
    if (!trimmed) return null;
    const mentioned = extractMentions(trimmed, opts.knownUserIds ?? []);
    const table = opts.source === 'decision' ? 'decision_comments' : 'task_comments';

    const { data, error } = await supabase
      .from(table)
      .update({
        body: trimmed,
        mentioned_user_ids: mentioned,
        edited_at: new Date().toISOString(),
      })
      .eq('id', opts.commentId)
      .select()
      .single();

    if (error) {
      console.error('Error editing comment:', error);
      return null;
    }
    return opts.source === 'decision'
      ? fromDecisionRow(data as RawDecisionComment)
      : fromTaskRow(data as RawTaskComment);
  },

  async deleteComment(opts: {
    source: CommentSource;
    commentId: string;
  }): Promise<boolean> {
    const table = opts.source === 'decision' ? 'decision_comments' : 'task_comments';
    const { error } = await supabase.from(table).delete().eq('id', opts.commentId);
    if (error) {
      console.error('Error deleting comment:', error);
      return false;
    }
    return true;
  },

  /** Subscribe to live comments for a single item. */
  subscribeToItem(
    source: CommentSource,
    itemId: string,
    onEvent: (comment: Comment) => void
  ): () => void {
    const table = source === 'decision' ? 'decision_comments' : 'task_comments';
    const filterCol = source === 'decision' ? 'decision_id' : 'task_id';
    const channel = supabase
      .channel(`${table}-${itemId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `${filterCol}=eq.${itemId}`,
        },
        (payload) => {
          const row = payload.new as RawDecisionComment | RawTaskComment;
          onEvent(source === 'decision' ? fromDecisionRow(row as RawDecisionComment) : fromTaskRow(row as RawTaskComment));
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  },
};
