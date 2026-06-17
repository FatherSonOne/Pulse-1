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
  return taskSourceTarget(task)?.view ?? null;
}

/**
 * Exact-item focus contract (deep-link follow-up, see
 * docs/launch-readiness/MULTI_SURFACE_DEEPLINK_HANDOFF_2026-06-17.md).
 *
 * `view`  — the surface to navigate to (same routing as the old taskSourceView).
 * `focus` — sessionStorage sentinels the writer (CockpitHub.handleOpenSource) sets
 *           BEFORE dispatching pulse:navigate. Each target surface drains its key on
 *           mount and opens the exact item. When provenance carries no resolvable item
 *           id, `focus` is empty `{}` and the deep-link degrades to section-level (the
 *           pre-existing behavior — never worse than before).
 *
 * Sentinel keys are namespaced `pulse_focus_*` to match the existing focus-sentinel
 * idiom (pulse_focus_note / pulse_focus_contact / pulse_focus_nudge).
 */
export interface SourceTarget {
  view: AppView;
  focus: Record<string, string>;
}

export function taskSourceTarget(task: Task): SourceTarget | null {
  const src = (task.metadata?.source as string | undefined)?.toLowerCase();
  const meta = task.metadata ?? {};

  // EMAIL — `email_id` is cached_emails.id (composite `${userId}-${gmailId}`), stamped
  // by createTaskFromEmail.ts. ActionItemExtractor uses metadata.source='email' but no
  // email_id, so that path degrades to section-level.
  if (src === 'email' || src === 'email-cockpit' || meta.email_id) {
    const emailId = typeof meta.email_id === 'string' ? meta.email_id : '';
    return { view: AppView.EMAIL, focus: emailId ? { pulse_focus_email: emailId } : {} };
  }

  // MESSAGES — origin_message_id is a pulse_messages.id; the Messages reader resolves
  // its thread_id (the conversation) and scrolls to the message.
  if (src === 'messages' || src === 'message' || task.origin_message_id) {
    const msgId = task.origin_message_id ?? '';
    return { view: AppView.MESSAGES, focus: msgId ? { pulse_focus_message: msgId } : {} };
  }

  // MEETINGS — meeting_id is a pulse_video_rooms.id (set by the meeting→task writer
  // after P0). Without it, section-level.
  if (src === 'meeting' || src === 'meetings') {
    const meetingId = typeof meta.meeting_id === 'string' ? meta.meeting_id : '';
    return { view: AppView.MEETINGS, focus: meetingId ? { pulse_focus_meeting: meetingId } : {} };
  }

  // RELAY — split data model: focus encodes which store + id (+ channel_id aux for
  // team_vox). Serialized as JSON under one sentinel.
  if (src === 'relay' || src === 'vox') {
    const store = typeof meta.relay_store === 'string' ? meta.relay_store : '';
    const relayId = typeof meta.relay_vox_id === 'string' ? meta.relay_vox_id : '';
    if (store && relayId) {
      const payload: Record<string, string> = { store, id: relayId };
      if (typeof meta.relay_channel_id === 'string') payload.channelId = meta.relay_channel_id;
      return { view: AppView.RELAY, focus: { pulse_focus_relay: JSON.stringify(payload) } };
    }
    return { view: AppView.RELAY, focus: {} };
  }

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
