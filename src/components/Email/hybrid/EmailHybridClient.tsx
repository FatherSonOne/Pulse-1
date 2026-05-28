// EmailHybridClient — entry point when emailHybrid flag is on.
// Phase 1: renders the Cockpit with mock data inside the .email-hybrid-shell
// scope so hybrid.css utility classes resolve. Phase 3 will wrap this in the
// view-shell cross-fade and mount TriageView alongside.
import React from 'react';
import { CockpitView } from './CockpitView';
import './hybrid.css';

interface EmailHybridClientProps {
  userEmail: string;
  userName: string;
}

export const EmailHybridClient: React.FC<EmailHybridClientProps> = () => {
  return (
    <div className="email-hybrid-shell h-full w-full relative">
      <CockpitView density="normal" />
    </div>
  );
};

export default EmailHybridClient;
