import React, { useState } from 'react';
import type { User } from '../../../types';
import { UnifiedMessage } from '../../../types/index';
import { TwilioService } from '../../../services/twilioService';
import { unifiedInboxDb } from '../../../services/unifiedInboxDb';
import {
  Info, Plug,
  Loader2, Download,
} from 'lucide-react';

interface TwilioIntegrationProps {
  user?: User | null;
}

export const TwilioIntegration: React.FC<TwilioIntegrationProps> = ({ user }) => {
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioTesting, setTwilioTesting] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState<{ success: boolean; phoneNumber?: string; error?: string } | null>(null);
  const [twilioMessages, setTwilioMessages] = useState<UnifiedMessage[]>([]);

  const testTwilioConnection = async () => {
    if (!twilioAccountSid || !twilioAuthToken) {
      setTwilioStatus({ success: false, error: 'Please enter Twilio credentials' });
      return;
    }

    setTwilioTesting(true);
    setTwilioStatus(null);

    try {
      const twilioService = new TwilioService(twilioAccountSid, twilioAuthToken);
      const result = await twilioService.testConnection();
      setTwilioStatus(result);
    } catch (error: any) {
      setTwilioStatus({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setTwilioTesting(false);
    }
  };

  const fetchTwilioMessages = async () => {
    if (!twilioAccountSid || !twilioAuthToken) return;

    const effectiveUserId = user?.id || '00000000-0000-0000-0000-000000000001';

    setTwilioTesting(true);
    try {
      await unifiedInboxDb.updateSyncState(effectiveUserId, 'sms', {
        syncStatus: 'syncing'
      });

      const twilioService = new TwilioService(twilioAccountSid, twilioAuthToken);
      const messages = await twilioService.getMessages(20);

      const storedCount = await unifiedInboxDb.storeMessages(effectiveUserId, messages);
      console.log(`Stored ${storedCount} SMS messages to database`);

      await unifiedInboxDb.updateSyncState(effectiveUserId, 'sms', {
        syncStatus: 'completed',
        lastMessageTimestamp: messages.length > 0 ? messages[0].timestamp : undefined
      });

      setTwilioMessages(messages);

      if (messages.length === 0) {
        setTwilioStatus({
          success: true,
          phoneNumber: twilioStatus?.phoneNumber,
          error: 'No messages found.'
        });
      } else {
        setTwilioStatus({
          success: true,
          phoneNumber: twilioStatus?.phoneNumber,
          error: `Successfully synced ${storedCount} messages to database`
        });
      }
    } catch (error) {
      console.error('Error fetching Twilio messages:', error);

      await unifiedInboxDb.updateSyncState(effectiveUserId, 'sms', {
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      setTwilioStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      });
    } finally {
      setTwilioTesting(false);
    }
  };

  return (
    <div className="integration-card">
      <div className="integration-header">
        <div className="integration-icon" style={{ background: '#F22F46' }}>
          <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
            <path fill="#fff" d="M12 0C5.381 0 0 5.381 0 12s5.381 12 12 12 12-5.381 12-12S18.619 0 12 0zm0 20.4c-4.639 0-8.4-3.761-8.4-8.4S7.361 3.6 12 3.6s8.4 3.761 8.4 8.4-3.761 8.4-8.4 8.4zm3.6-8.4c0 .994-.806 1.8-1.8 1.8s-1.8-.806-1.8-1.8.806-1.8 1.8-1.8 1.8.806 1.8 1.8zm-5.4 0c0 .994-.806 1.8-1.8 1.8S6.6 12.994 6.6 12s.806-1.8 1.8-1.8 1.8.806 1.8 1.8z"/>
          </svg>
        </div>
        <div className="integration-info" style={{ flex: 1 }}>
          <h4>Twilio SMS</h4>
          <p>Include SMS messages</p>
        </div>
        {twilioStatus?.success && (
          <span className="connected-badge">
            Connected
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="nothing-input-label">
            Twilio Account SID
          </label>
          <input
            type="text"
            value={twilioAccountSid}
            onChange={(e) => setTwilioAccountSid(e.target.value)}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="nothing-input"
          />
        </div>

        <div>
          <label className="nothing-input-label">
            Twilio Auth Token
          </label>
          <input
            type="password"
            value={twilioAuthToken}
            onChange={(e) => setTwilioAuthToken(e.target.value)}
            placeholder="********************************"
            className="nothing-input"
          />
          <div className="nothing-info-box">
            <p className="info-title">
              <Info />
              Twilio API Credentials:
            </p>
            <ul>
              <li>Find your Account SID and Auth Token in the Twilio Console</li>
              <li>Ensure your Twilio number has SMS capabilities enabled</li>
            </ul>
            <p style={{ marginTop: '12px' }}>
              Get credentials at <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer">Twilio Console</a>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={testTwilioConnection}
            disabled={twilioTesting || !twilioAccountSid || !twilioAuthToken}
            className="nothing-btn nothing-btn-primary"
          >
            {twilioTesting ? (
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

          {twilioStatus?.success && (
            <button
              onClick={fetchTwilioMessages}
              disabled={twilioTesting}
              className="nothing-btn nothing-btn-secondary"
            >
              <Download />
              Fetch Messages
            </button>
          )}

        </div>

        {twilioStatus && (
          <div className={`status-display ${twilioStatus.success ? 'success' : 'error'}`}>
            <i className={`fa-solid ${twilioStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
            <span>{twilioStatus.success ? `Connected to ${twilioStatus.phoneNumber}` : `Error: ${twilioStatus.error}`}</span>
          </div>
        )}

        {twilioMessages.length > 0 && (
          <div className="message-preview">
            <div className="message-preview-title">
              Recent SMS ({twilioMessages.length})
            </div>
            <div>
              {twilioMessages.slice(0, 5).map((msg) => (
                <div key={msg.id} className="preview-message">
                  <div className="preview-message-sender">
                    {msg.senderName} <span style={{ opacity: 0.5 }}>• {(msg.metadata as Record<string, unknown>)?.formattedPhone as string}</span>
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
