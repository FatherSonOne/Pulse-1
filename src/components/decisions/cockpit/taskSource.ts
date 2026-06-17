/**
 * taskSource — single source of truth for "where did this task come from?".
 * Maps a task's provenance (metadata.source / email_id / origin_message_id) to the
 * app surface it originated in, so the cockpit's "Open source" affordance can both
 * decide whether to show and where to navigate.
 *
 * Routing-level deep-link (launch-readiness item C): lands the user on the correct
 * section. Exact-item focus (open the specific email/message) is a deferred follow-up
 * — pulse_messages has no clean conversation_id and provenance data is still sparse.
 */
import { AppView } from '../../../types';
import type { Task } from '../../../services/taskService';

export function taskSourceView(task: Task): AppView | null {
  const src = (task.metadata?.source as string | undefined)?.toLowerCase();
  if (src === 'email' || task.metadata?.email_id) return AppView.EMAIL;
  if (src === 'messages' || src === 'message' || task.origin_message_id) return AppView.MESSAGES;
  if (src === 'meeting' || src === 'meetings') return AppView.MEETINGS;
  if (src === 'relay' || src === 'vox') return AppView.RELAY;
  return null;
}

/** Short human label for the source surface, for button/affordance copy. */
export function taskSourceLabel(view: AppView): string {
  switch (view) {
    case AppView.EMAIL: return 'email';
    case AppView.MESSAGES: return 'message';
    case AppView.MEETINGS: return 'meeting';
    case AppView.RELAY: return 'Relay';
    default: return 'source';
  }
}
