/**
 * Messages Component Exports
 *
 * This file exports all Messages-related components and utilities.
 */

// Main component with providers (recommended entry point)
export { MessagesWithProviders, MessagesWithProviders as default } from './MessagesWithProviders';

// Layout components
export { MessageContainer } from './MessageContainer';

// Future exports (uncomment when components are created):
// export { MessageListView } from './MessageListView';
// export { ConversationView } from './ConversationView';
// export { MessageComposer } from './MessageComposer';

// Re-export contexts for convenience
export {
  useMessages,
  useTools,
  useFocusMode,
  MessagesProvider,
  ToolsProvider,
  FocusModeProvider,
} from '../../contexts';

// Re-export custom hooks
export { useMessagesState } from '../../hooks/useMessagesState';

// Re-export types
export type {
  MessagesContextState,
  MessageReaction,
  ToolsContextState,
  FocusModeContextState,
} from '../../contexts';

export type {
  PinnedMessage,
  MessageHighlight,
  MessageAnnotation,
  MessageBookmark,
  UserTemplate,
  ScheduledMessage,
  UserReminder,
  ConversationTagAssignment,
} from '../../hooks/useMessagesState';
