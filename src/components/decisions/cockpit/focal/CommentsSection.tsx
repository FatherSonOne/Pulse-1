/**
 * CommentsSection — inline discussion thread for the focal pane (replaces the
 * ActivityDrawer's comments tab). Thin labeled wrapper around the existing
 * CommentThread (threaded replies, @mention picker, edit/delete) — reused
 * verbatim so comment behavior is identical to the drawer.
 */
import { CommentThread } from '../../comments/CommentThread';
import type { ActivitySource } from '../../../../services/decisionActivityService';
import type { User } from '../../../../types';

interface CommentsSectionProps {
  source: ActivitySource;
  itemId: string;
  workspaceId: string;
  currentUserId: string;
  members: User[];
}

export function CommentsSection({ source, itemId, workspaceId, currentUserId, members }: CommentsSectionProps) {
  return (
    <div className="ck-comments">
      <div className="ck-focal-section-label">Discussion</div>
      <CommentThread
        source={source}
        itemId={itemId}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        workspaceMembers={members}
      />
    </div>
  );
}
