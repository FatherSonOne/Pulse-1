// EmailClientWrapper.tsx — thin prop adapter from the App's user object
// onto EmailHybridClient. Pre-Phase-11b this was a feature-flag branch
// between the hybrid surface and the legacy PulseEmailClientRedesign;
// the legacy surface and the emailHybrid flag were removed in Phase 11b
// (commit alongside this file), so the wrapper now just rewrites props.
//
// It ALSO gates the whole Email surface on the `emailEnabled` switch
// (Settings → Features & Labs). When off, EmailHybridClient never mounts —
// it fetches Gmail on mount — so a placeholder renders instead and no Gmail
// fetch / token use happens.
//
// Kept as a separate file because App.tsx + useRoutePreload lazy-import
// it by path; collapsing it into EmailHybridClient would force route
// signature changes for no gain.
import React from 'react';
import { Mail } from 'lucide-react';
import { User } from '../../types';
import { EmailHybridClient } from './hybrid/EmailHybridClient';
import { useFeatures } from '../../contexts/FeatureContext';

interface EmailClientWrapperProps {
  user: User;
  onUpdateUser?: () => void;
  apiKey?: string;
}

export const EmailClientWrapper: React.FC<EmailClientWrapperProps> = ({
  user,
}) => {
  const { features } = useFeatures();

  if (!features.emailEnabled) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 12,
          padding: 24,
          color: 'var(--pulse-ink-2, #b0b0b0)',
        }}
      >
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

  return <EmailHybridClient userEmail={user.email} userName={user.name} />;
};

export default EmailClientWrapper;
