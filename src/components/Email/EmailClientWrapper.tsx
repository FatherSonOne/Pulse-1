// EmailClientWrapper.tsx — entry adapter for the Email surface. Gates the whole
// surface on two things before mounting EmailHybridClient (which fetches Gmail
// on mount):
//   1. The `emailEnabled` switch (Settings → Features & Labs). Off → placeholder.
//   2. A connected Gmail GRANT (scope split — Gmail is a separate, owner-only
//      OAuth client, not part of login). Not connected → "Connect Gmail" screen.
//
// Kept as a separate file because App.tsx + useRoutePreload lazy-import it by
// path; collapsing it into EmailHybridClient would force route signature changes.
import React, { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { User } from '../../types';
import { EmailHybridClient } from './hybrid/EmailHybridClient';
import { useFeatures } from '../../contexts/FeatureContext';
import { getGmailConnectStatus, startGmailConnect } from '../../services/google/gmailConnect';

interface EmailClientWrapperProps {
  user: User;
  onUpdateUser?: () => void;
  apiKey?: string;
}

const centeredStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: 12,
  padding: 24,
  color: 'var(--pulse-ink-2, #b0b0b0)',
};

export const EmailClientWrapper: React.FC<EmailClientWrapperProps> = ({
  user,
}) => {
  const { features } = useFeatures();
  const [gmail, setGmail] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!features.emailEnabled) return;
    let alive = true;
    setGmail('checking');
    getGmailConnectStatus().then((s) => {
      if (alive) setGmail(s.connected ? 'connected' : 'disconnected');
    });
    return () => { alive = false; };
  }, [features.emailEnabled]);

  // (1) Email section turned off.
  if (!features.emailEnabled) {
    return (
      <div style={centeredStyle}>
        <Mail size={40} style={{ color: 'var(--pulse-ink-3, #8a8a8a)', opacity: 0.8 }} />
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--pulse-ink-1, #e8e8e8)', margin: 0 }}>
          Email is turned off
        </h2>
        <p style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 360, margin: 0 }}>
          This feature isn’t available right now. You can re-enable it for testing
          and development in <strong>Settings → Features &amp; Labs → Email Section</strong>.
        </p>
      </div>
    );
  }

  // (2) Checking the Gmail grant.
  if (gmail === 'checking') {
    return (
      <div style={centeredStyle}>
        <Mail size={36} style={{ color: 'var(--pulse-ink-3, #8a8a8a)', opacity: 0.7 }} />
        <p style={{ fontSize: 13, margin: 0 }}>Checking Gmail connection…</p>
      </div>
    );
  }

  // (3) Email on, but Gmail not connected yet → connect.
  if (gmail === 'disconnected') {
    return (
      <div style={centeredStyle}>
        <Mail size={40} style={{ color: 'var(--pulse-rose, #f43f5e)', opacity: 0.9 }} />
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--pulse-ink-1, #e8e8e8)', margin: 0 }}>
          Connect Gmail
        </h2>
        <p style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 380, margin: 0 }}>
          Email uses a separate Google sign-in for Gmail access. Connect your
          Gmail account to load your inbox.
        </p>
        <button
          type="button"
          disabled={connecting}
          onClick={async () => {
            setConnecting(true);
            const ok = await startGmailConnect();
            if (!ok) setConnecting(false); // otherwise the browser is redirecting
          }}
          className="pulse-btn-primary"
          style={{
            marginTop: 4,
            padding: '8px 18px',
            borderRadius: 8,
            color: '#fff',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: connecting ? 'default' : 'pointer',
            opacity: connecting ? 0.7 : 1,
          }}
        >
          {connecting ? 'Opening Google…' : 'Connect Gmail'}
        </button>
        <p style={{ fontSize: 11, lineHeight: 1.4, maxWidth: 380, margin: '4px 0 0', color: 'var(--pulse-ink-3, #8a8a8a)' }}>
          You may see an “unverified app” screen — that’s expected for this private
          Gmail connection; choose Advanced → continue.
        </p>
      </div>
    );
  }

  // (4) Email on + Gmail connected → the real client.
  return <EmailHybridClient userEmail={user.email} userName={user.name} />;
};

export default EmailClientWrapper;
