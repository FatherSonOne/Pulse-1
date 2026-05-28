// EmailClientWrapper.tsx - Wrapper to adapt legacy props to PulseEmailClient,
// branched on the emailHybrid feature flag (see docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md).
import React from 'react';
import { User } from '../../types';
import { useFeatureFlag } from '../../lib/featureFlags';
import { PulseEmailClientRedesign } from './PulseEmailClientRedesign';
import { EmailHybridClient } from './hybrid/EmailHybridClient';
import { EmailHybridFlagToggle } from './EmailHybridFlagToggle';

interface EmailClientWrapperProps {
  user: User;
  onUpdateUser?: () => void;
  apiKey?: string;
}

export const EmailClientWrapper: React.FC<EmailClientWrapperProps> = ({
  user,
}) => {
  const useHybrid = useFeatureFlag('emailHybrid', user.id, false);

  return (
    <>
      {useHybrid ? (
        <EmailHybridClient userEmail={user.email} userName={user.name} />
      ) : (
        <PulseEmailClientRedesign
          userEmail={user.email}
          userName={user.name}
        />
      )}
      <EmailHybridFlagToggle />
    </>
  );
};

export default EmailClientWrapper;
