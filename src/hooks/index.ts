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

// AI/Intelligence
export { useMultiModalIntelligence } from './useMultiModalIntelligence';

// CRM
export { useCRMIntegration } from './useCRMIntegration';

// Performance
export { useVirtualList } from './useVirtualList';

// UI/Layout
// useSplitViewMessages removed 2026-05-31 with the v2 Messages rebuild.
export { useResizablePanel } from './useResizablePanel';

// Motion (DESIGN.md §4 — project ease-out, reduced-motion aware)
export { useMotionPreset, PULSE_EASE, PULSE_DURATION } from './useMotionPreset';
export type { MotionPreset } from './useMotionPreset';

// Messaging (extracted from Messages.tsx)
// usePulseMessaging + hooks/useMessageContextMenu deleted 2026-06-01 (W10 batch 1)
// — both orphaned: usePulseMessaging had no caller; the live message menu uses
// components/MessageContextMenu's own useMessageContextMenu, not this hooks one.
// useMessageScheduling deleted earlier — superseded by pulseService.scheduleMessage
// (writes to pulse_scheduled_messages; pg_cron handles delivery).
