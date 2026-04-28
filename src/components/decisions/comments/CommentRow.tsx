// CommentRow: renders a single comment with author + body + timestamp +
// reply / edit / delete actions where applicable.
//
// Mentions stored as `@<uuid>` in the body are replaced at render time with
// the corresponding member's display name (clickable, opens member detail
// later when wired).

import React, { useMemo, useState } from 'react';
import { CornerDownRight, Edit2, Trash2, X, Check } from 'lucide-react';
import type { Comment } from '../../../services/decisionCommentsService';
import type { User } from '../../../types';

interface CommentRowProps {
  comment: Comment;
  workspaceMembers: User[];
  currentUserId: string;
  onReply: (comment: Comment) => void;
  onEdit: (comment: Comment, newBody: string) => Promise<void>;
  onDelete: (comment: Comment) => Promise<void>;
}

function memberName(userId: string, members: User[]): string {
  const m = members.find((x) => x.id === userId);
  if (!m) return 'Someone';
  return (m as User & { full_name?: string }).full_name || m.email || 'Someone';
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Replace @<uuid> tokens with @MemberName spans. Returns React fragments so
 * we can render styled mention chips in line with the rest of the body.
 */
function renderBodyWithMentions(body: string, members: User[]): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /@([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g;
  let lastIndex = 0;
  const matches = Array.from(body.matchAll(pattern));
  if (matches.length === 0) return [body];
  for (const m of matches) {
    const idx = m.index ?? 0;
    const userId = m[1];
    if (idx > lastIndex) {
      parts.push(body.slice(lastIndex, idx));
    }
    const member = members.find((x) => x.id === userId);
    parts.push(
      <span key={`m-${idx}`} className="dc-mention-chip">
        @{member ? (member as User & { full_name?: string }).full_name || member.email : 'unknown'}
      </span>
    );
    lastIndex = idx + m[0].length;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return parts;
}

export const CommentRow: React.FC<CommentRowProps> = ({
  comment,
  workspaceMembers,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);

  const author = memberName(comment.userId, workspaceMembers);
  const isOwn = comment.userId === currentUserId;
  const isReply = !!comment.parentCommentId;

  const rendered = useMemo(
    () => renderBodyWithMentions(comment.body, workspaceMembers),
    [comment.body, workspaceMembers]
  );

  const saveEdit = async () => {
    if (!draft.trim() || draft.trim() === comment.body) {
      setEditing(false);
      return;
    }
    setBusy(true);
    await onEdit(comment, draft.trim());
    setBusy(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    await onDelete(comment);
    setBusy(false);
  };

  return (
    <article className={`dc-row${isReply ? ' is-reply' : ''}`}>
      {isReply && <CornerDownRight size={12} className="dc-row-reply-icon" aria-hidden="true" />}
      <header className="dc-row-header">
        <span className="dc-row-author">{author}</span>
        <span className="dc-row-time dt-label">
          {formatRelative(comment.createdAt)}
          {comment.editedAt && ' · edited'}
        </span>
      </header>
      {editing ? (
        <div className="dc-row-edit">
          <textarea
            className="dc-composer-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            aria-label="Edit comment"
          />
          <div className="dc-row-edit-actions">
            <button
              type="button"
              className="dc-row-action"
              onClick={() => { setEditing(false); setDraft(comment.body); }}
              disabled={busy}
              aria-label="Cancel edit"
              title="Cancel"
            >
              <X size={12} aria-hidden="true" />
              Cancel
            </button>
            <button
              type="button"
              className="dc-row-action is-primary"
              onClick={saveEdit}
              disabled={busy || !draft.trim()}
              aria-label="Save edit"
              title="Save"
            >
              <Check size={12} aria-hidden="true" />
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="dc-row-body">{rendered}</p>
          <footer className="dc-row-footer">
            <button
              type="button"
              className="dc-row-action"
              onClick={() => onReply(comment)}
              title="Reply"
            >
              <CornerDownRight size={12} aria-hidden="true" />
              Reply
            </button>
            {isOwn && (
              <>
                <button
                  type="button"
                  className="dc-row-action"
                  onClick={() => setEditing(true)}
                  title="Edit"
                >
                  <Edit2 size={12} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  className="dc-row-action dc-row-action-destructive"
                  onClick={handleDelete}
                  disabled={busy}
                  title="Delete"
                >
                  <Trash2 size={12} aria-hidden="true" />
                  Delete
                </button>
              </>
            )}
          </footer>
        </>
      )}
    </article>
  );
};
