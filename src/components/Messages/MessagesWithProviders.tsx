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
import Messages from '../Messages'; // Original Messages component
// import MessagesRefactored from './Messages.refactored.example'; // For testing the refactored version

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
  return (
    <MessagesProvider currentUser={currentUser}>
      <ToolsProvider>
        <FocusModeProvider>
          <Messages
            apiKey={apiKey}
            contacts={contacts}
            initialContactId={initialContactId}
            onAddContact={onAddContact}
            currentUser={currentUser}
          />
        </FocusModeProvider>
      </ToolsProvider>
    </MessagesProvider>
  );
};

/**
 * MessagesWithProvidersRefactored
 *
 * This is an example showing how to use the refactored Messages component.
 * Uncomment when ready to switch to the refactored version.
 */
/*
export const MessagesWithProvidersRefactored: React.FC<MessagesWithProvidersProps> = ({
  apiKey,
  contacts,
  initialContactId,
  onAddContact,
  currentUser,
}) => {
  return (
    <MessagesProvider currentUser={currentUser}>
      <ToolsProvider>
        <FocusModeProvider>
          <MessagesRefactored
            apiKey={apiKey}
            contacts={contacts}
            initialContactId={initialContactId}
            onAddContact={onAddContact}
            currentUser={currentUser}
          />
        </FocusModeProvider>
      </ToolsProvider>
    </MessagesProvider>
  );
};
*/

export default MessagesWithProviders;
