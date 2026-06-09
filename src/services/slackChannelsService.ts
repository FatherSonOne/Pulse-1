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
      return [];
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
      return [];
    }
    return (data ?? []) as SlackChannelMessage[];
  },

  /** Live INSERTs into one thread. Returns an unsubscribe fn. */
  subscribeToMessages(threadId: string, onInsert: (m: SlackChannelMessage) => void): () => void {
    const channelName = `slack-channel-messages-${threadId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'slack_channel_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => onInsert(payload.new as SlackChannelMessage),
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
