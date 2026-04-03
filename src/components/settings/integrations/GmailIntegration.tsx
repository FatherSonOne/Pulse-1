import React, { useState } from 'react';
import type { User } from '../../../types';
import { UnifiedMessage } from '../../../types/index';
import {
  Check, Info, Plug,
  Lock, Loader2, Download,
} from 'lucide-react';

interface GmailIntegrationProps {
  user?: User | null;
}

export const GmailIntegration: React.FC<GmailIntegrationProps> = ({ user }) => {
  const [gmailTesting, setGmailTesting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<{ success: boolean; email?: string; error?: string } | null>(null);
  const [gmailMessages, setGmailMessages] = useState<UnifiedMessage[]>([]);

  return (
    <div className="integration-card">
      <div className="integration-header">
        <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
          <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
            <path fill="#EA4335" d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-1 2v.68l-7 4.9-7-4.9V6h14zm-14 12V9.12l6.45 4.51c.16.11.35.17.55.17s.39-.06.55-.17L19 9.12V18H5z"/>
          </svg>
        </div>
        <div className="integration-info" style={{ flex: 1 }}>
          <h4>Gmail</h4>
          <p>Pull in email conversations</p>
        </div>
        {(gmailStatus?.success || user?.connectedProviders.google) && (
          <span className="connected-badge">
            Connected
          </span>
        )}
      </div>

      <div className="space-y-3">
        {user?.connectedProviders.google ? (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Gmail Connected</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500">{user?.email}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Gmail integration is active through your Google sign-in. Your emails are accessible in the Email section.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center">
            <Lock className="text-zinc-400 text-2xl mb-2" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Connect your Google account above to enable Gmail</p>
          </div>
        )}

        <div className="nothing-info-box" style={{ marginTop: '16px' }}>
          <p className="info-title">
            <Info />
            Gmail API Permissions:
          </p>
          <ul>
            <li><code>gmail.readonly</code> Read email messages</li>
            <li><code>gmail.send</code> Send emails on your behalf</li>
            <li><code>gmail.modify</code> Mark as read, archive, delete</li>
          </ul>
        </div>

        {user?.connectedProviders.google && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                setGmailTesting(true);
                setGmailStatus(null);
                try {
                  const { getGmailService } = await import('../../../services/gmailService');
                  const gmailService = getGmailService();
                  const result = await gmailService.testConnection();
                  setGmailStatus(result);
                } catch (error: any) {
                  setGmailStatus({ success: false, error: error.message || 'Connection failed' });
                } finally {
                  setGmailTesting(false);
                }
              }}
              disabled={gmailTesting}
              className="nothing-btn nothing-btn-primary"
            >
              {gmailTesting ? (
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

            {gmailStatus?.success && (
              <button
                onClick={async () => {
                  setGmailTesting(true);
                  try {
                    const { getGmailService } = await import('../../../services/gmailService');
                    const gmailService = getGmailService();
                    const messages = await gmailService.getMessages(10);
                    setGmailMessages(messages);
                    setGmailStatus({
                      success: true,
                      email: gmailStatus?.email,
                      error: `Fetched ${messages.length} recent emails`
                    });
                  } catch (error: any) {
                    setGmailStatus({ success: false, error: error.message });
                  } finally {
                    setGmailTesting(false);
                  }
                }}
                disabled={gmailTesting}
                className="nothing-btn nothing-btn-secondary"
              >
                <Download />
                Fetch Messages
              </button>
            )}
          </div>
        )}

        {gmailStatus && (
          <div className={`status-display ${gmailStatus.success ? 'success' : 'error'}`}>
            <i className={`fa-solid ${gmailStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
            <span>{gmailStatus.success ? `Connected to ${gmailStatus.email}` : `Error: ${gmailStatus.error}`}</span>
          </div>
        )}

        {gmailMessages.length > 0 && (
          <div className="message-preview">
            <div className="message-preview-title">
              Recent Emails ({gmailMessages.length})
            </div>
            <div>
              {gmailMessages.slice(0, 5).map((msg) => (
                <div key={msg.id} className="preview-message">
                  <div className="preview-message-sender">
                    {msg.senderName} <span style={{ opacity: 0.5 }}>• {msg.senderEmail}</span>
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
