// EmailClientWrapper.tsx — thin prop adapter from the App's user object
// onto EmailHybridClient. Pre-Phase-11b this was a feature-flag branch
// between the hybrid surface and the legacy PulseEmailClientRedesign;
// the legacy surface and the emailHybrid flag were removed in Phase 11b
// (commit alongside this file), so the wrapper now just rewrites props.
//
// Kept as a separate file because App.tsx + useRoutePreload lazy-import
// it by path; collapsing it into EmailHybridClient would force route
// signature changes for no gain.
import React from 'react';
import { User } from '../../types';
import { EmailHybridClient } from './hybrid/EmailHybridClient';

interface EmailClientWrapperProps {
  user: User;
  onUpdateUser?: () => void;
  apiKey?: string;
}

export const EmailClientWrapper: React.FC<EmailClientWrapperProps> = ({
  user,
}) => {
  return <EmailHybridClient userEmail={user.email} userName={user.name} />;
};

export default EmailClientWrapper;
