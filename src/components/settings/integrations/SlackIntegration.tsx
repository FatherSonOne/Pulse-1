import React, { useState, useEffect } from 'react';
import type { User } from '../../../types';
import { UnifiedMessage } from '../../../types/index';
import { SlackService } from '../../../services/slackService';
import { unifiedInboxDb } from '../../../services/unifiedInboxDb';
import { getSlackBotToken, setSlackBotToken } from '../../../lib/slackToken';
import { useFeatures } from '../../../contexts/FeatureContext';
import {
  getSlackUserConnectStatus,
  startSlackUserConnect,
  disconnectSlackUser,
  type SlackUserConnectStatus,
} from '../../../services/slackUserConnect';
import {
  Info, Plug,
  Loader2, Download,
} from 'lucide-react';
import { CollapsibleIntegrationCard } from './CollapsibleIntegrationCard';

interface SlackIntegrationProps {
  user?: User | null;
  slackChannels: Array<{ id: string; name: string }>;
  setSlackChannels: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string }>>>;
}

export const SlackIntegration: React.FC<SlackIntegrationProps> = ({ user, slackChannels, setSlackChannels }) => {
  // Phase 8: seed from the persisted per-user token (localStorage) so it
  // survives reload and is reachable by the Contacts Slack send path; fall back
  // to the build-time env var for dev. See src/lib/slackToken.ts.
  const [slackToken, setSlackToken] = useState(() => getSlackBotToken() || import.meta.env.VITE_SLACK_BOT_TOKEN || '');
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackStatus, setSlackStatus] = useState<{ success: boolean; workspace?: string; error?: string } | null>(null);
  const [slackMessages, setSlackMessages] = useState<UnifiedMessage[]>([]);

  // Send-as-you (user OAuth) — gated behind slackMessagesGrounding. Distinct from
  // the bot-token flow above. See src/services/slackUserConnect.ts.
  const { features } = useFeatures();
  const [userConn, setUserConn] = useState<SlackUserConnectStatus | null>(null);
  const [userConnBusy, setUserConnBusy] = useState(false);

  useEffect(() => {
    if (!features.slackMessagesGrounding) return;
    let cancelled = false;
    getSlackUserConnectStatus().then((s) => { if (!cancelled) setUserConn(s); });
    return () => { cancelled = true; };
  }, [features.slackMessagesGrounding]);

  const handleSlackUserConnect = async () => {
    setUserConnBusy(true);
    const ok = await startSlackUserConnect();
    // On success the browser redirects to Slack; on failure, re-enable the button.
    if (!ok) setUserConnBusy(false);
  };

  const handleSlackUserDisconnect = async () => {
    setUserConnBusy(true);
    await disconnectSlackUser();
    setUserConn(await getSlackUserConnectStatus());
    setUserConnBusy(false);
  };

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
        // Phase 8: remember the validated token (per-user, client-side) so the
        // Contacts Slack send path can reuse it without a re-paste.
        setSlackBotToken(slackToken);
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
    <CollapsibleIntegrationCard
      defaultOpen={!slackStatus?.success}
      summary={
        <>
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
        </>
      }
      badge={slackStatus?.success ? <span className="connected-badge">Connected</span> : undefined}
    >
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
              <li style={{ marginTop: '6px' }}><code>chat:write</code> <strong>Send</strong> DMs (Phase 8)</li>
              <li><code>im:write</code> Open a DM channel (Phase 8)</li>
              <li><code>users:read.email</code> Match a contact email → Slack user (Phase 8)</li>
            </ul>
            <p style={{ marginTop: '12px' }}>
              Configure at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">Slack API Dashboard</a> → OAuth &amp; Permissions → Scopes
            </p>
            <p style={{ marginTop: '8px' }}>
              The last three scopes power <strong>sending a DM to a contact</strong> + matching their email. Add them, then <strong>reinstall the app</strong> to mint a new token — existing read-only tokens return <code>missing_scope</code> on send.
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

        {features.slackMessagesGrounding && (
          <div className="mt-4 pt-4 border-t border-[var(--pulse-border)]">
            <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Send as you (user OAuth · Beta)
            </h5>
            <p className="text-xs text-zinc-500 mb-3">
              Connect your own Slack so Pulse can DM <strong>as you</strong> (not the bot) and
              mirror your 1:1 threads in Messages. Your user token is stored on the server, never in the browser.
            </p>
            {userConn && !userConn.configured && (
              <div className="status-display error">
                <i className="fa-solid fa-circle-xmark status-icon"></i>
                <span>Slack OAuth isn't configured on the server yet.</span>
              </div>
            )}
            {userConn?.connected ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="connected-badge">
                  Connected{userConn.slackUserId ? ` · ${userConn.slackUserId}` : ''}
                </span>
                <button
                  onClick={handleSlackUserDisconnect}
                  disabled={userConnBusy}
                  className="nothing-btn nothing-btn-secondary"
                >
                  {userConnBusy ? <Loader2 className="spinner-icon" /> : <Plug />}
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleSlackUserConnect}
                disabled={userConnBusy || (userConn ? !userConn.configured : false)}
                className="nothing-btn nothing-btn-primary"
              >
                {userConnBusy ? <Loader2 className="spinner-icon" /> : <Plug />}
                Connect Slack
              </button>
            )}
          </div>
        )}
      </div>
    </CollapsibleIntegrationCard>
  );
};
