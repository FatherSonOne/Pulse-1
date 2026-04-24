// TrialGate — renders TrialExpiredBlock over the app when the workspace has no
// active Pulse subscription (trial expired or never started).
//
// Mounted inside WorkspaceProvider so useEntitlements has a workspace to query.
// Does NOT block the entire app tree — renders the paywall as an overlay so the
// app can keep background state fresh. App interaction is blocked by the backdrop.

import React from 'react';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import { TrialExpiredBlock } from './TrialExpiredBlock';

interface TrialGateProps {
  children: React.ReactNode;
}

export const TrialGate: React.FC<TrialGateProps> = ({ children }) => {
  const { entitlements, hasActivePulseAccess, isLoading } = useEntitlements();
  const { currentWorkspace } = useWorkspaceData();

  // While entitlements are loading, render children — block appears once we know.
  // If no workspace yet, WorkspaceGate handles that state.
  const showPaywall = !isLoading && !!entitlements && !hasActivePulseAccess && !!currentWorkspace;

  return (
    <>
      {children}
      {showPaywall && (
        <TrialExpiredBlock
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          canManageBilling={true}
        />
      )}
    </>
  );
};
