import React, { useEffect, useState } from 'react';
import type { User } from '../../../types';
import { UnifiedMessage } from '../../../types/index';
import {
  Check, Info, Plug,
  Lock, Loader2, Download, Unlink, RefreshCw,
} from 'lucide-react';
import { useFeatures } from '../../../contexts/FeatureContext';
import {
  getGmailConnectStatus,
  startGmailConnect,
  disconnectGmail,
} from '../../../services/google/gmailConnect';
import { CollapsibleIntegrationCard } from './CollapsibleIntegrationCard';

interface GmailIntegrationProps {
  // Kept for parent compatibility. The Gmail grant is a SEPARATE owner-only
  // OAuth client (server-side user_gmail_tokens), independent of the login
  // user, so this card no longer keys off `user.connectedProviders.google`.
  user?: User | null;
}

// The real grant state, sourced from GET /api/gmail/status (the dedicated Gmail
// OAuth client) — not the login provider. Mirrors EmailClientWrapper.
type GmailGrant = 'checking' | 'connected' | 'disconnected';

export const GmailIntegration: React.FC<GmailIntegrationProps> = () => {
  const { features } = useFeatures();
  const emailEnabled = features.emailEnabled;

  const [grant, setGrant] = useState<GmailGrant>('checking');
  const [configured, setConfigured] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [gmailTesting, setGmailTesting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<{ success: boolean; email?: string; error?: string } | null>(null);
  const [gmailMessages, setGmailMessages] = useState<UnifiedMessage[]>([]);

  // Probe the real Gmail grant on mount and whenever Email is toggled. The
  // status route bypasses the email flag, but there's no reason to probe while
  // the feature is off. getGmailConnectStatus fails CLOSED (backend down →
  // disconnected), matching the wrapper.
  useEffect(() => {
    if (!emailEnabled) {
      setGrant('disconnected');
      // Don't leave a prior session's account address / email previews hanging
      // under the "turned off" card.
      setGmailStatus(null);
      setGmailMessages([]);
      return;
    }
    let alive = true;
    setGrant('checking');
    setConfigured(true); // optimistic until the probe resolves
    getGmailConnectStatus().then((s) => {
      if (!alive) return;
      setConfigured(s.configured);
      setGrant(s.connected ? 'connected' : 'disconnected');
    });
    return () => { alive = false; };
  }, [emailEnabled]);

  const isConnected = emailEnabled && grant === 'connected';

  // Once connected, surface the REAL Gmail address. /api/gmail/status doesn't
  // carry it (never stored server-side), so fetch it live via testConnection
  // (gated by emailEnabled, which isConnected already implies). Runs once until
  // a result lands; manual Test Connection / disconnect reset gmailStatus.
  useEffect(() => {
    if (!isConnected || gmailStatus || gmailTesting) return;
    let alive = true;
    (async () => {
      try {
        const { getGmailService } = await import('../../../services/gmailService');
        const result = await getGmailService().testConnection();
        if (alive) setGmailStatus(result);
      } catch (error: any) {
        if (alive) setGmailStatus({ success: false, error: error?.message || 'Connection failed' });
      }
    })();
    return () => { alive = false; };
  }, [isConnected, gmailStatus, gmailTesting]);

  return (
    <CollapsibleIntegrationCard
      defaultOpen={false}
      summary={
        <>
          <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
              <path fill="#EA4335" d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-1 2v.68l-7 4.9-7-4.9V6h14zm-14 12V9.12l6.45 4.51c.16.11.35.17.55.17s.39-.06.55-.17L19 9.12V18H5z"/>
            </svg>
          </div>
          <div className="integration-info" style={{ flex: 1 }}>
            <h4>Gmail</h4>
            <p>Pull in email conversations</p>
          </div>
        </>
      }
      badge={isConnected ? <span className="connected-badge">Connected</span> : undefined}
    >
      <div className="space-y-3">
        {/* (1) Email feature OFF — private, off by default. */}
        {!emailEnabled && (
          <div className="bg-[var(--pulse-surface-raised)] border border-[var(--pulse-border)] rounded-xl p-4 text-center">
            <Lock className="text-zinc-400 text-2xl mb-2" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Email is a private feature and is turned off. Turn it on in Settings → Features &amp; Labs to connect Gmail.
            </p>
          </div>
        )}

        {/* (2) Email ON, probing the grant. */}
        {emailEnabled && grant === 'checking' && (
          <div className="bg-[var(--pulse-surface-raised)] border border-[var(--pulse-border)] rounded-xl p-4 text-center">
            <Loader2 className="spinner-icon" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">Checking Gmail connection…</p>
          </div>
        )}

        {/* (3) Email ON, no Gmail grant yet → connect (separate sign-in). */}
        {emailEnabled && grant === 'disconnected' && (
          <div className="bg-[var(--pulse-surface-raised)] border border-[var(--pulse-border)] rounded-xl p-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Email uses a separate Google sign-in for Gmail access. Connect your Gmail account to load your inbox.
            </p>

            {!configured && (
              <div className="status-display error" style={{ marginTop: '12px' }}>
                <i className="fa-solid fa-circle-xmark status-icon"></i>
                <span>Gmail connection is unavailable right now. The server may be starting up or not yet configured.</span>
              </div>
            )}

            <button
              onClick={async () => {
                setConnecting(true);
                const ok = await startGmailConnect();
                if (!ok) setConnecting(false); // otherwise the browser is redirecting
              }}
              disabled={connecting || !configured}
              className="nothing-btn nothing-btn-primary"
              style={{ marginTop: '12px' }}
            >
              {connecting ? (
                <>
                  <Loader2 className="spinner-icon" />
                  Opening Google…
                </>
              ) : (
                <>
                  <Plug />
                  Connect Gmail
                </>
              )}
            </button>

            <p className="text-xs text-zinc-500 mt-2">
              You may see an "unverified app" screen. That's expected for this private Gmail connection; choose Advanced, then continue.
            </p>
          </div>
        )}

        {/* (4) Email ON + Gmail grant connected. */}
        {isConnected && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Gmail Connected</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500">
                  {gmailStatus?.email || 'Verifying account…'}
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Gmail is connected through a separate Google sign-in. Your emails are accessible in the Email section.
            </p>
          </div>
        )}

        {/* Permissions — always shown; honest about what the Gmail grant requests. */}
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

        {/* Connected-only actions. */}
        {isConnected && (
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

            <button
              onClick={async () => {
                if (!window.confirm('Switch to a different Gmail account? You will pick the new account on Google\'s screen.')) {
                  return;
                }
                setConnecting(true);
                await disconnectGmail();
                const ok = await startGmailConnect();
                if (!ok) setConnecting(false); // otherwise the browser is redirecting
              }}
              disabled={connecting || disconnecting}
              className="nothing-btn nothing-btn-secondary"
            >
              {connecting ? <Loader2 className="spinner-icon" /> : <RefreshCw />}
              Switch account
            </button>

            <button
              onClick={async () => {
                if (!window.confirm('Disconnect Gmail from Pulse? Your emails stop syncing until you reconnect. This does not affect your Google sign-in.')) {
                  return;
                }
                setDisconnecting(true);
                try {
                  const ok = await disconnectGmail();
                  if (ok) {
                    setGmailStatus(null);
                    setGmailMessages([]);
                    setGrant('disconnected');
                  } else {
                    setGmailStatus({ success: false, error: 'Could not disconnect Gmail. Please try again.' });
                  }
                } finally {
                  setDisconnecting(false);
                }
              }}
              disabled={disconnecting}
              className="nothing-btn nothing-btn-secondary"
            >
              {disconnecting ? <Loader2 className="spinner-icon" /> : <Unlink />}
              Disconnect
            </button>
          </div>
        )}

        {isConnected && gmailStatus && (
          <div className={`status-display ${gmailStatus.success ? 'success' : 'error'}`}>
            <i className={`fa-solid ${gmailStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
            <span>{gmailStatus.success ? (gmailStatus.error || `Connected to ${gmailStatus.email}`) : `Error: ${gmailStatus.error}`}</span>
          </div>
        )}

        {isConnected && gmailMessages.length > 0 && (
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
    </CollapsibleIntegrationCard>
  );
};
