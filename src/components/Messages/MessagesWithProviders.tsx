/**
 * MessagesWithProviders - Integration Wrapper
 *
 * This component wraps the Messages component with all necessary context providers.
 * Use this as the entry point for the Messages feature.
 *
 * Usage:
 * ```tsx
 * import { MessagesWithProviders } from '@/components/Messages';
 *
 * <MessagesWithProviders
 *   apiKey={apiKey}
 *   contacts={contacts}
 *   currentUser={currentUser}
 * />
 * ```
 */

import React from 'react';
import { MessagesProvider, ToolsProvider, FocusModeProvider } from '../../contexts';
import Messages from '../Messages';
import { useFeatureFlag } from '../../lib/featureFlags';
import { MessagesSplitViewWithProviders } from './MessagesSplitViewWithProviders';

interface MessagesWithProvidersProps {
  apiKey: string;
  contacts: any[];
  initialContactId?: string;
  onAddContact?: (contact: any) => Promise<any>;
  currentUser?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * MessagesWithProviders
 *
 * Provides all necessary contexts for the Messages component:
 * - MessagesProvider: Core messaging state (threads, conversations, messages)
 * - ToolsProvider: Tool panels and features state
 * - FocusModeProvider: Focus mode timer and state
 *
 * This wrapper allows the Messages component to access all contexts
 * without prop drilling.
 */
export const MessagesWithProviders: React.FC<MessagesWithProvidersProps> = ({
  apiKey,
  contacts,
  initialContactId,
  onAddContact,
  currentUser,
}) => {
  // Phase 5e — feature-flag gated cutover. When ON, mount the new
  // entry that uses MessagesSplitView + the Phase 5d plugins. When
  // OFF (default), keep the legacy 4810-line Messages.tsx monolith.
  const useV2 = useFeatureFlag('pulseMessagesV2', currentUser?.id);

  return (
    <MessagesProvider currentUser={currentUser}>
      <ToolsProvider>
        <FocusModeProvider>
          {useV2 ? (
            <MessagesSplitViewWithProviders
              currentUser={currentUser}
              contacts={contacts}
            />
          ) : (
            <Messages
              apiKey={apiKey}
              contacts={contacts}
              initialContactId={initialContactId}
              onAddContact={onAddContact}
              currentUser={currentUser}
            />
          )}
        </FocusModeProvider>
      </ToolsProvider>
    </MessagesProvider>
  );
};

export default MessagesWithProviders;
