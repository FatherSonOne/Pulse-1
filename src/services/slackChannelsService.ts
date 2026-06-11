// Slack Channels Grounding (Integration C) · P5 — read service.
//
// Reads the owner-scoped channel mirror (slack_channel_threads /
// slack_channel_messages) the edge fn ingests into, and subscribes to realtime
// INSERTs so new channel messages appear without a refetch. RLS is single-owner
// (SELECT where owner_pulse_id = auth.uid()), so a normal authenticated client
// only ever sees its own rows — no extra plumbing.
//
// Channel display names are NOT stored (the edge fn writes channel_name = null,
// since the message event has no name); they're resolved client-side from the
// bot token via SlackService.getChannels(), mirroring how reads already work.

import { supabase } from './supabase';
import { SlackService } from './slackService';
import { getSlackBotToken } from '../lib/slackToken';
import { BACKEND_URL } from '../config/backend';
import { summarizeConversation, type ConversationSummary, type VoxMessage } from './relay/relayAIService';

export interface SlackChannelThread {
  id: string;
  owner_pulse_id: string;
  slack_team_id: string;
  slack_channel_id: string;
  channel_name: string | null;
  transport: string;
  is_private: boolean;
  created_at: string;
  last_message_at: string | null;
}

export interface SlackChannelMessage {
  id: string;
  thread_id: string;
  sender_shadow_id: string | null;
  sender_slack_id: string | null;
  sender_name: string;
  content: string;
  is_outgoing: boolean;
  slack_ts: string | null;
  slack_thread_ts: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export const slackChannelsService = {
  /** All mirrored channel threads for the signed-in owner, most-recent first. */
  async getThreads(): Promise<SlackChannelThread[]> {
    const { data, error } = await supabase
      .from('slack_channel_threads')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[slackChannels] getThreads error:', error.message);
      throw new Error(error.message);
    }
    return (data ?? []) as SlackChannelThread[];
  },

  /** Messages for one thread, oldest first (conversation order). */
  async getMessages(threadId: string): Promise<SlackChannelMessage[]> {
    const { data, error } = await supabase
      .from('slack_channel_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[slackChannels] getMessages error:', error.message);
      throw new Error(error.message);
    }
    return (data ?? []) as SlackChannelMessage[];
  },

  /**
   * Live changes to one thread. onInsert fires on new messages; onUpdate (optional) fires on
   * edits/deletes (P8 §1.2) — the table is REPLICA IDENTITY FULL so payload.new carries the whole
   * updated row (content + edited_at/deleted_at). Returns an unsubscribe fn.
   */
  subscribeToMessages(
    threadId: string,
    onInsert: (m: SlackChannelMessage) => void,
    onUpdate?: (m: SlackChannelMessage) => void,
  ): () => void {
    const channelName = `slack-channel-messages-${threadId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'slack_channel_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => onInsert(payload.new as SlackChannelMessage),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'slack_channel_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => onUpdate?.(payload.new as SlackChannelMessage),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },

  /** Live thread-list changes (new channel mirrored, or last_message_at bumped). */
  subscribeToThreads(onChange: () => void): () => void {
    const channelName = `slack-channel-threads-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'slack_channel_threads' }, () => onChange())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'slack_channel_threads' }, () => onChange())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },

  /**
   * Reply-as-you into a Slack channel (P6). Posts via the dedicated authed route
   * POST /api/slack/channel-send — the xoxp- user token is injected server-side
   * and NEVER the open proxy (D7). On success the server records the outgoing row
   * and returns it; the caller appends it (realtime also delivers it — dedup by id).
   */
  async sendChannelMessage(
    channel: string,
    text: string,
  ): Promise<{ ok: boolean; message?: SlackChannelMessage; code?: string; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false, code: 'UNAUTHENTICATED', error: 'Not signed in' };
    try {
      const res = await fetch(`${BACKEND_URL}/api/slack/channel-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ channel, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return { ok: false, code: data.code || 'SEND_FAILED', error: data.error || `HTTP ${res.status}` };
      }
      return { ok: true, message: (data.message ?? undefined) as SlackChannelMessage | undefined };
    } catch (e) {
      return { ok: false, code: 'NETWORK', error: e instanceof Error ? e.message : 'Network error' };
    }
  },

  /**
   * Import a channel's recent history into the mirror (P8 §3). One-shot, bounded, idempotent —
   * the server dedups on slack_ts, so re-running only adds what's still missing. The xoxb- bot
   * token is forwarded so the SERVER fetches conversations.history + mints via service-role; the
   * client never calls the minting RPC (POST /api/slack/channel-backfill). Returns the
   * inserted/skipped counts on success.
   */
  async backfillChannel(
    channel: string,
    channelName: string | null,
    isPrivate: boolean,
    limit = 100,
  ): Promise<{ ok: boolean; inserted?: number; skipped?: number; total?: number; code?: string; error?: string }> {
    const botToken = getSlackBotToken();
    if (!botToken) return { ok: false, code: 'NO_TOKEN', error: 'No Slack bot token' };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false, code: 'UNAUTHENTICATED', error: 'Not signed in' };
    try {
      const res = await fetch(`${BACKEND_URL}/api/slack/channel-backfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ channel, channelName, isPrivate, botToken, limit }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        return { ok: false, code: data.code || 'BACKFILL_FAILED', error: data.error || `HTTP ${res.status}` };
      }
      return { ok: true, inserted: data.inserted ?? 0, skipped: data.skipped ?? 0, total: data.total ?? 0 };
    } catch (e) {
      return { ok: false, code: 'NETWORK', error: e instanceof Error ? e.message : 'Network error' };
    }
  },

  /**
   * Summarize the current channel thread via the EXISTING server-side summarizer (P8 §4).
   * Maps the mirror's text rows into the relay summarizer's VoxMessage shape and routes through
   * the ai-router edge function (relayAIService.summarizeConversation) — NO client-side AI calls
   * (CLAUDE.md §4 / Gemini-is-server-side). Deleted + empty rows are excluded. Returns null on an
   * empty thread; the summarizer's throws (e.g. "No active workspace") propagate to the caller.
   */
  async summarizeThread(messages: SlackChannelMessage[]): Promise<ConversationSummary | null> {
    const vox: VoxMessage[] = messages
      .filter((m) => !m.deleted_at && (m.content ?? '').trim().length > 0)
      .map((m) => ({
        id: m.id,
        transcription: m.content,
        sender: m.is_outgoing ? 'me' : 'other',
        senderName: m.sender_name,
        timestamp: new Date(m.created_at),
        duration: 0, // text rows, not voice — duration is cosmetic in the summary output
      }));
    if (vox.length === 0) return null;
    return summarizeConversation(undefined, vox);
  },

  /**
   * Resolve slack_channel_id → channel name via the bot token (the edge fn
   * stores null). Best-effort: returns an empty map with no token or on failure,
   * and the UI falls back to the raw channel id.
   */
  async resolveChannelNames(): Promise<Map<string, string>> {
    const token = getSlackBotToken();
    if (!token) return new Map();
    try {
      const svc = new SlackService(token);
      const channels = await svc.getChannels();
      return new Map(channels.map((c) => [c.id, c.name]));
    } catch (e) {
      console.warn('[slackChannels] resolveChannelNames failed:', (e as Error).message);
      return new Map();
    }
  },
};
