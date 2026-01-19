// EmailClientWrapper.tsx - Wrapper to adapt legacy props to new PulseEmailClient
import React from 'react';
import { User } from '../../types';
import { PulseEmailClient } from './PulseEmailClient';

interface EmailClientWrapperProps {
  user: User;
  onUpdateUser?: () => void;
  apiKey?: string;
}

/**
 * Wrapper component that adapts legacy App.tsx props to the new PulseEmailClient
 * This allows the new email client to work with the existing App.tsx without changes
 */
export const EmailClientWrapper: React.FC<EmailClientWrapperProps> = ({
  user,
  onUpdateUser,
  apiKey,
}) => {
  return (
    <div className="h-full w-full rounded-2xl bg-zinc-950 shadow-2xl border border-zinc-800 flex flex-col">
      <PulseEmailClient
        userEmail={user.email}
        userName={user.name}
      />
    </div>
  );
};

export default EmailClientWrapper;
