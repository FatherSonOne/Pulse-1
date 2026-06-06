import { UnifiedMessage } from '../types';
import { BACKEND_URL } from '../config/backend';

/**
 * Slack Integration Service (Browser-Compatible)
 * Fetches messages from Slack channels using REST API and converts them to UnifiedMessage format
 */

export class SlackService {
  private botToken: string;
  private proxyURL = `${BACKEND_URL}/api/slack/proxy`;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /**
   * Helper to make Slack API requests via proxy server
   */
  private async slackRequest(
    endpoint: string,
    params: Record<string, any> = {},
    options: { method?: 'GET' | 'POST' } = {}
  ) {
    const response = await fetch(this.proxyURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        token: this.botToken,
        params,
        // Phase 8: tell the proxy to POST upstream (write methods) vs GET (reads).
        // Omitted for reads so existing read calls hit the unchanged GET path.
        ...(options.method ? { method: options.method } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Proxy error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || 'Slack API request failed');
    }

    return data;
  }

  /**
   * Fetch all channels the bot is a member of
   * This ensures we only try to read messages from channels we have access to
   */
  async getChannels(): Promise<Array<{ id: string; name: string }>> {
    try {
      const result = await this.slackRequest('conversations.list', {
        types: 'public_channel,private_channel,im,mpim',
        exclude_archived: true,
        limit: 100,
      });

      // Filter to only channels the bot is a member of
      const memberChannels = (result.channels || [])
        .filter((channel: any) => channel.is_member || channel.is_im)
        .map((channel: any) => ({
          id: channel.id,
          name: channel.name || channel.user || 'unknown',
        }));

      return memberChannels;
    } catch (error) {
      console.error('Error fetching Slack channels:', error);
      throw new Error('Failed to fetch Slack channels');
    }
  }

  /**
   * Fetch messages from a specific channel
   * @param channelId - Slack channel ID
   * @param channelName - Slack channel name
   * @param limit - Number of messages to fetch (default: 100)
   */
  async getChannelMessages(
    channelId: string,
    channelName: string = 'unknown',
    limit: number = 100
  ): Promise<UnifiedMessage[]> {
    try {
      const result = await this.slackRequest('conversations.history', {
        channel: channelId,
        limit,
      });

      const messages = result.messages || [];
      const unifiedMessages: UnifiedMessage[] = [];

      for (const msg of messages) {
        // Skip bot messages and system messages
        if (msg.bot_id || msg.subtype) continue;

        // Get user info for sender
        let senderName = 'Unknown User';
        let senderAvatar = '';

        if (msg.user) {
          try {
            const userInfo = await this.slackRequest('users.info', { user: msg.user });
            senderName = userInfo.user?.real_name || userInfo.user?.name || 'Unknown User';
            senderAvatar = userInfo.user?.profile?.image_72 || '';
          } catch (e) {
            console.warn('Could not fetch user info:', e);
          }
        }

        const unifiedMsg: UnifiedMessage = {
          id: `slack-${msg.ts}`,
          source: 'slack',
          type: 'text',
          content: msg.text || '',
          senderId: msg.user || 'unknown',
          senderName: senderName,
          senderEmail: '',
          channelId: channelId,
          channelName: channelName,
          timestamp: new Date(parseFloat(msg.ts || '0') * 1000),
          conversationGraphId: msg.thread_ts || msg.ts,
          isRead: false,
          starred: false,
          tags: [],
          metadata: {
            slackChannelId: channelId,
            slackMessageTs: msg.ts,
            slackThreadTs: msg.thread_ts,
            senderAvatarUrl: senderAvatar,
          },
        };

        unifiedMessages.push(unifiedMsg);
      }

      return unifiedMessages;
    } catch (error) {
      console.error('Error fetching Slack messages:', error);
      throw new Error('Failed to fetch Slack messages');
    }
  }

  /**
   * Fetch messages from all accessible channels
   * @param limit - Number of messages per channel (default: 50)
   */
  async getAllMessages(limit: number = 50): Promise<UnifiedMessage[]> {
    try {
      const channels = await this.getChannels();

      if (channels.length === 0) {
        console.warn('No channels found. Make sure the bot is added to at least one channel.');
        return [];
      }

      const allMessages: UnifiedMessage[] = [];

      // Fetch messages from each channel, skip channels that error
      for (const channel of channels) {
        try {
          const messages = await this.getChannelMessages(channel.id, channel.name, limit);
          allMessages.push(...messages);
        } catch (error) {
          console.warn(`Skipping channel ${channel.name} due to error:`, error);
          // Continue with other channels instead of failing completely
        }
      }

      // Sort by timestamp (newest first)
      allMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return allMessages;
    } catch (error) {
      console.error('Error fetching all Slack messages:', error);
      throw new Error('Failed to fetch all Slack messages');
    }
  }

  /**
   * Test connection to Slack
   */
  async testConnection(): Promise<{ success: boolean; workspace?: string; error?: string }> {
    try {
      const result = await this.slackRequest('auth.test');
      return {
        success: true,
        workspace: result.team as string,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================
  // Phase 8 — outbound send + per-contact identity (contactsHybrid).
  // All write methods POST upstream via the proxy's method:'POST' branch.
  // Sends post as the Pulse BOT app (xoxb-), not the operator; send-as-user
  // (OAuth xoxp-) is deferred to v1.1. See docs/SLACK_PHASE8_SCOPE_2026-06-05.md.
  // ============================================================

  /**
   * Resolve a contact's email to a Slack user id (Phase 8 identity).
   * Requires the `users:read.email` scope. Returns null when no Slack member
   * matches the email (the expected "not on Slack" outcome, surfaced as a
   * manual "Link Slack" prompt); throws on any other Slack error (e.g.
   * missing_scope, invalid_auth).
   */
  async lookupUserByEmail(email: string): Promise<string | null> {
    try {
      const result = await this.slackRequest('users.lookupByEmail', { email });
      return (result.user?.id as string) ?? null;
    } catch (error) {
      if (error instanceof Error && /users_not_found/.test(error.message)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Open (or fetch) the DM channel id for a Slack user. Requires `im:write`.
   * Returns the IM channel id used as the chat.postMessage target.
   */
  async openDm(slackUserId: string): Promise<string> {
    const result = await this.slackRequest(
      'conversations.open',
      { users: slackUserId },
      { method: 'POST' }
    );
    const channelId = result.channel?.id as string | undefined;
    if (!channelId) {
      throw new Error('conversations.open returned no channel id');
    }
    return channelId;
  }

  /**
   * Send a plain-text DM to a Slack user id (Phase 8). Requires `chat:write`
   * (+ `im:write` to open the DM). Posts as the Pulse bot app. Returns the
   * message ts + channel on success; throws on empty text or any Slack error.
   */
  async sendMessage(
    slackUserId: string,
    text: string
  ): Promise<{ ts: string; channel: string }> {
    const trimmed = (text ?? '').trim();
    if (!trimmed) {
      throw new Error('Cannot send an empty Slack message');
    }
    const channel = await this.openDm(slackUserId);
    const result = await this.slackRequest(
      'chat.postMessage',
      { channel, text: trimmed },
      { method: 'POST' }
    );
    return { ts: result.ts as string, channel: (result.channel as string) ?? channel };
  }
}
