// Phase 10: Security, Insights & Productivity Bundle
// This bundle contains encryption, versioning, smart folders, and focus tools
// Lazy loaded when security and insights features are accessed

import { MessageEncryption, PrivacyShieldButton } from './MessageEncryption';
import { ReadTimeEstimation, ReadTimeBadge } from './ReadTimeEstimation';
import { MessageVersioning, EditHistoryIndicator } from './MessageVersioning';
import { SmartFolders, FolderBadge } from './SmartFolders';
import { ConversationInsights, InsightsBadge } from './ConversationInsights';
import { FocusTimer, TimerWidget } from './FocusTimer';

// Export as default object for lazy loading
export default {
  MessageEncryption,
  PrivacyShieldButton,
  ReadTimeEstimation,
  ReadTimeBadge,
  MessageVersioning,
  EditHistoryIndicator,
  SmartFolders,
  FolderBadge,
  ConversationInsights,
  InsightsBadge,
  FocusTimer,
  TimerWidget,
};
