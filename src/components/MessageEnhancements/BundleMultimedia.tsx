// Phase 11: Multi-Media & Export Hub Bundle
// This bundle contains translation hub, analytics export, templates library, and attachments
// Lazy loaded when multi-media and export features are used

import { TranslationHub, TranslateButton } from './TranslationHub';
import { AnalyticsExport, QuickExportButton as AnalyticsExportButton } from './AnalyticsExport';
import { TemplatesLibrary, TemplateInsertButton } from './TemplatesLibrary';
import { AttachmentManager, AttachmentButton } from './AttachmentManager';
import { BackupSync, SyncStatusIndicator } from './BackupSync';
import { SmartSuggestions, SuggestionButton } from './SmartSuggestions';
import ToolOverlay from './ToolOverlay';

// Export as default object for lazy loading
export default {
  TranslationHub,
  TranslateButton,
  AnalyticsExport,
  AnalyticsExportButton,
  TemplatesLibrary,
  TemplateInsertButton,
  AttachmentManager,
  AttachmentButton,
  BackupSync,
  SyncStatusIndicator,
  SmartSuggestions,
  SuggestionButton,
  ToolOverlay,
};
