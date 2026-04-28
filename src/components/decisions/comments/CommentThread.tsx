// CommentThread: groups top-level comments and their replies, renders the
// composer at the bottom, and handles realtime arrivals via the comments
// service subscription.

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { decisionCommentsService, type Comment, type CommentSource } from '../../../services/decisionCommentsService';
import type { User } from '../../../types';
import { CommentRow } from './CommentRow';
import { CommentComposer } from './CommentComposer';
import './Comments.css';

interface CommentThreadProps {
  source: CommentSource;
  itemId: string;
  workspaceId: string;
  currentUserId: string;
  workspaceMembers: User[];
}

interface ThreadGroup {
  parent: Comment;
  replies: Comment[];
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  source,
  itemId,
  workspaceId,
  currentUserId,
  workspaceMembers,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetcher =
      source === 'decision'
        ? decisionCommentsService.listForDecision(itemId)
        : decisionCommentsService.listForTask(itemId);
    fetcher.then((data) => {
      if (!cancelled) {
        setComments(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source, itemId]);

  // Live subscription.
  useEffect(() => {
    const unsubscribe = decisionCommentsService.subscribeToItem(source, itemId, (next) => {
      setComments((prev) => {
        if (prev.some((c) => c.id === next.id)) return prev;
        return [...prev, next];
      });
    });
    return unsubscribe;
  }, [source, itemId]);

  // Group top-level comments with their replies (one level deep).
  const groups = useMemo<ThreadGroup[]>(() => {
    const topLevel = comments.filter((c) => !c.parentCommentId);
    const repliesByParent = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.parentCommentId) {
        const list = repliesByParent.get(c.parentCommentId) ?? [];
        list.push(c);
        repliesByParent.set(c.parentCommentId, list);
      }
    }
    return topLevel.map((parent) => ({
      parent,
      replies: (repliesByParent.get(parent.id) ?? []).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      ),
    }));
  }, [comments]);

  const knownUserIds = useMemo(() => workspaceMembers.map((m) => m.id), [workspaceMembers]);

  const handleSubmit = async (body: string): Promise<boolean> => {
    const result = await decisionCommentsService.addComment({
      source,
      itemId,
      workspaceId,
      userId: currentUserId,
      body,
      parentCommentId: replyTo?.id ?? null,
      knownUserIds,
    });
    if (!result) {
      toast.error('Could not post comment. Try again.');
      return false;
    }
    // Optimistic merge: realtime will dedupe by id.
    setComments((prev) => (prev.some((c) => c.id === result.id) ? prev : [...prev, result]));
    setReplyTo(null);
    return true;
  };

  const handleEdit = async (comment: Comment, newBody: string) => {
    const updated = await decisionCommentsService.editComment({
      source,
      commentId: comment.id,
      body: newBody,
      knownUserIds,
    });
    if (!updated) {
      toast.error('Could not save edit.');
      return;
    }
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDelete = async (comment: Comment) => {
    const ok = await decisionCommentsService.deleteComment({ source, commentId: comment.id });
    if (!ok) {
      toast.error('Could not delete comment.');
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== comment.id && c.parentCommentId !== comment.id));
  };

  const replyToLabel = useMemo(() => {
    if (!replyTo) return null;
    const author = workspaceMembers.find((m) => m.id === replyTo.userId);
    const authorName = author
      ? (author as User & { full_name?: string }).full_name || author.email
      : 'a teammate';
    const snippet = replyTo.body.replace(
      /@[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
      '@…'
    ).slice(0, 60);
    return `${authorName}: ${snippet}${snippet.length === 60 ? '…' : ''}`;
  }, [replyTo, workspaceMembers]);

  return (
    <section className="dc-thread" aria-label="Comments">
      {loading ? (
        <div className="dc-thread-loading">
          <Loader2 size={14} className="dc-spinner" aria-hidden="true" />
          <span>Loading comments</span>
        </div>
      ) : groups.length === 0 ? (
        <p className="dc-thread-empty">No comments yet. Start the discussion.</p>
      ) : (
        <ul className="dc-thread-list">
          {groups.map(({ parent, replies }) => (
            <li key={parent.id} className="dc-thread-group">
              <CommentRow
                comment={parent}
                workspaceMembers={workspaceMembers}
                currentUserId={currentUserId}
                onReply={setReplyTo}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {replies.length > 0 && (
                <ul className="dc-thread-replies">
                  {replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        workspaceMembers={workspaceMembers}
                        currentUserId={currentUserId}
                        onReply={setReplyTo}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <CommentComposer
        workspaceMembers={workspaceMembers}
        onSubmit={handleSubmit}
        replyToLabel={replyToLabel}
        onCancelReply={replyTo ? () => setReplyTo(null) : undefined}
      />
    </section>
  );
};
