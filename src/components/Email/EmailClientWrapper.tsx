// EmailClientWrapper.tsx - Wrapper to adapt legacy props to new PulseEmailClient
import React from 'react';
import { User } from '../../types';
import { PulseEmailClientRedesign } from './PulseEmailClientRedesign';

interface EmailClientWrapperProps {
  user: User;
  onUpdateUser?: () => void;
  apiKey?: string;
}

export const EmailClientWrapper: React.FC<EmailClientWrapperProps> = ({
  user,
}) => {
  return (
    <PulseEmailClientRedesign
      userEmail={user.email}
      userName={user.name}
    />
  );
};

export default EmailClientWrapper;
