import { UnifiedMessage } from '../types';

/**
 * Slack Integration Service (Browser-Compatible)
 * Fetches messages from Slack channels using REST API and converts them to UnifiedMessage format
 */

export class SlackService {
  private botToken: string;
  private proxyURL = 'http://localhost:3003/api/slack/proxy';

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /**
   * Helper to make Slack API requests via proxy server
   */
  private async slackRequest(endpoint: string, params: Record<string, any> = {}) {
    const response = await fetch(this.proxyURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        token: this.botToken,
        params,
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
  async testConnection(): Promise<{ success: boolean; workspaceName?: string; error?: string }> {
    try {
      const result = await this.slackRequest('auth.test');
      return {
        success: true,
        workspaceName: result.team as string,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
