import React, { useState } from 'react';
import type { User } from '../../../types';
import { UnifiedMessage } from '../../../types/index';
import { SlackService } from '../../../services/slackService';
import { unifiedInboxDb } from '../../../services/unifiedInboxDb';
import {
  Info, Plug,
  Loader2, Download,
} from 'lucide-react';

interface SlackIntegrationProps {
  user?: User | null;
  slackChannels: Array<{ id: string; name: string }>;
  setSlackChannels: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string }>>>;
}

export const SlackIntegration: React.FC<SlackIntegrationProps> = ({ user, slackChannels, setSlackChannels }) => {
  const [slackToken, setSlackToken] = useState(import.meta.env.VITE_SLACK_BOT_TOKEN || '');
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackStatus, setSlackStatus] = useState<{ success: boolean; workspace?: string; error?: string } | null>(null);
  const [slackMessages, setSlackMessages] = useState<UnifiedMessage[]>([]);

  const testSlackConnection = async () => {
    if (!slackToken) {
      setSlackStatus({ success: false, error: 'Please enter a Slack bot token' });
      return;
    }

    setSlackTesting(true);
    setSlackStatus(null);

    try {
      const slackService = new SlackService(slackToken);
      const result = await slackService.testConnection();
      setSlackStatus(result);

      if (result.success) {
        const channels = await slackService.getChannels();
        setSlackChannels(channels);
      }
    } catch (error: any) {
      setSlackStatus({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setSlackTesting(false);
    }
  };

  const fetchSlackMessages = async () => {
    if (!slackToken) return;

    const effectiveUserId = user?.id || '00000000-0000-0000-0000-000000000001';

    setSlackTesting(true);
    try {
      await unifiedInboxDb.updateSyncState(effectiveUserId, 'slack', {
        syncStatus: 'syncing'
      });

      const slackService = new SlackService(slackToken);
      const messages = await slackService.getAllMessages(20);

      const storedCount = await unifiedInboxDb.storeMessages(effectiveUserId, messages);
      console.log(`Stored ${storedCount} Slack messages to database`);

      await unifiedInboxDb.updateSyncState(effectiveUserId, 'slack', {
        syncStatus: 'completed',
        lastMessageTimestamp: messages.length > 0 ? messages[0].timestamp : undefined
      });

      const dbMessages = await unifiedInboxDb.getMessages(effectiveUserId, {
        platform: 'slack',
        limit: 50
      });

      setSlackMessages(messages);

      if (messages.length === 0) {
        setSlackStatus({
          success: true,
          workspace: slackStatus?.workspace,
          error: 'No messages found. Make sure your bot is added to at least one channel.'
        });
      } else {
        setSlackStatus({
          success: true,
          workspace: slackStatus?.workspace,
          error: `Successfully synced ${storedCount} messages to database`
        });
      }
    } catch (error) {
      console.error('Error fetching Slack messages:', error);

      await unifiedInboxDb.updateSyncState(effectiveUserId, 'slack', {
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      setSlackStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      });
    } finally {
      setSlackTesting(false);
    }
  };

  return (
    <div className="integration-card">
      <div className="integration-header">
        <div className="integration-icon" style={{ background: '#4A154B' }}>
          <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
            <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
            <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
            <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z"/>
            <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.521-2.522v-2.522h2.521zm0-1.27a2.527 2.527 0 0 1-2.521-2.522 2.527 2.527 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z"/>
          </svg>
        </div>
        <div className="integration-info" style={{ flex: 1 }}>
          <h4>Slack</h4>
          <p>Aggregate messages from Slack channels</p>
        </div>
        {slackStatus?.success && (
          <span className="connected-badge">
            Connected
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="nothing-input-label">
            Slack Bot Token
          </label>
          <input
            type="password"
            value={slackToken}
            onChange={(e) => setSlackToken(e.target.value)}
            placeholder="xoxb-your-slack-bot-token"
            className="nothing-input"
          />
          <div className="nothing-info-box">
            <p className="info-title">
              <Info />
              Required Slack Bot Scopes:
            </p>
            <ul>
              <li><code>channels:history</code> Read public channel messages</li>
              <li><code>channels:read</code> View public channels</li>
              <li><code>groups:history</code> Read private channel messages</li>
              <li><code>groups:read</code> View private channels</li>
              <li><code>im:history</code> Read DM messages</li>
              <li><code>im:read</code> View DMs</li>
              <li><code>mpim:read</code> View group DMs</li>
              <li><code>users:read</code> View user info</li>
            </ul>
            <p style={{ marginTop: '12px' }}>
              Configure at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">Slack API Dashboard</a> → OAuth &amp; Permissions → Scopes
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={testSlackConnection}
            disabled={slackTesting || !slackToken}
            className="nothing-btn nothing-btn-primary"
          >
            {slackTesting ? (
              <>
                <Loader2 className="spinner-icon" />
                Testing...
              </>
            ) : (
              <>
                <Plug />
                Test Connection
              </>
            )}
          </button>

          {slackStatus?.success && (
            <button
              onClick={fetchSlackMessages}
              disabled={slackTesting}
              className="nothing-btn nothing-btn-secondary"
            >
              <Download />
              Fetch Messages
            </button>
          )}

        </div>

        {slackStatus && (
          <div className={`status-display ${slackStatus.success ? 'success' : 'error'}`}>
            <i className={`fa-solid ${slackStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
            <span>{slackStatus.success ? `Connected to ${slackStatus.workspace}` : `Error: ${slackStatus.error}`}</span>
          </div>
        )}

        {slackChannels.length > 0 && (
          <div className="mt-4">
            <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Available Channels ({slackChannels.length})
            </h5>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {slackChannels.slice(0, 10).map((channel) => (
                <div key={channel.id} className="bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg px-3 py-2 text-xs">
                  <span className="text-zinc-500">#</span>
                  <span className="dark:text-white text-zinc-900">{channel.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {slackMessages.length > 0 && (
          <div className="message-preview">
            <div className="message-preview-title">
              Recent Messages ({slackMessages.length})
            </div>
            <div>
              {slackMessages.slice(0, 5).map((msg) => (
                <div key={msg.id} className="preview-message">
                  <div className="preview-message-sender">
                    {msg.senderName} <span style={{ opacity: 0.5 }}>• #{msg.channelName}</span>
                  </div>
                  <div className="preview-message-content">{msg.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
