/**
 * Hooks Index
 * Re-export all custom hooks for easy importing
 */

// PWA and Service Worker
export { useServiceWorker, useServiceWorkerUpdate } from './useServiceWorker';

// Notifications
export { useNotifications } from './useNotifications';
export { usePermissions } from './usePermissions';

// Real-time
export { usePresence } from './usePresence';

// Media
export { useVoxRecording } from './useVoxRecording';
export { useVoiceToText } from './useVoiceToText';
export { useVoiceCommands, VOICE_COMMAND_TEMPLATES } from './useVoiceCommands';

// Communication
export { useMessageTrigger } from './useMessageTrigger';
export { useMessageEnhancements } from './useMessageEnhancements';
export { useEmailKeyboardShortcuts } from './useEmailKeyboardShortcuts';

// AI/Intelligence
export { useMultiModalIntelligence } from './useMultiModalIntelligence';

// CRM
export { useCRMIntegration } from './useCRMIntegration';

// Performance
export { useVirtualList } from './useVirtualList';

// UI/Layout
export { useSplitViewMessages } from './useSplitViewMessages';
export { useResizablePanel } from './useResizablePanel';

// Messaging (extracted from Messages.tsx)
export { usePulseMessaging } from './usePulseMessaging';
export type { UsePulseMessagingReturn } from './usePulseMessaging';
// useMessageScheduling deleted — superseded by pulseService.scheduleMessage
// (writes to pulse_scheduled_messages; pg_cron handles delivery).
export { useMessageContextMenu } from './useMessageContextMenu';
export type { UseMessageContextMenuReturn, ContextMenuPosition } from './useMessageContextMenu';
