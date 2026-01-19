// Phase 5: Productivity & Utilities Bundle
// This bundle contains templates, scheduling, export, and keyboard shortcuts
// Lazy loaded when productivity tools are accessed

import { SmartTemplates, TemplateButton } from './SmartTemplates';
import { MessageScheduling, ScheduleButton } from './MessageScheduling';
import { ConversationSummary, SummaryBadge } from './ConversationSummary';
import { ExportSharing, QuickExportButton, QuickShareButton } from './ExportSharing';
import { KeyboardShortcuts, useKeyboardShortcuts, ShortcutHint } from './KeyboardShortcuts';
import { NotificationPreferences, NotificationBadge } from './NotificationPreferences';

// Export as default object for lazy loading
export default {
  SmartTemplates,
  TemplateButton,
  MessageScheduling,
  ScheduleButton,
  ConversationSummary,
  SummaryBadge,
  ExportSharing,
  QuickExportButton,
  QuickShareButton,
  KeyboardShortcuts,
  useKeyboardShortcuts,
  ShortcutHint,
  NotificationPreferences,
  NotificationBadge,
};
