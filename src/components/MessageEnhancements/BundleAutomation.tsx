// Phase 9: Advanced Personalization & Automation Bundle
// This bundle contains auto-response rules, formatting, notes, and draft management
// Lazy loaded when automation features are accessed

import { AutoResponseRules, RuleStatusToggle } from './AutoResponseRules';
import { FormattingToolbar, InlineFormattingBar } from './FormattingToolbar';
import { ContactNotes, QuickNoteButton } from './ContactNotes';
import { ConversationModes, StatusDot } from './ConversationModes';
import { NotificationSounds, MuteButton } from './NotificationSounds';
import { DraftManager, useAutoSaveDraft, AutoSaveIndicator, DraftRecoveryPrompt } from './DraftManager';

// Export as default object for lazy loading
export default {
  AutoResponseRules,
  RuleStatusToggle,
  FormattingToolbar,
  InlineFormattingBar,
  ContactNotes,
  QuickNoteButton,
  ConversationModes,
  StatusDot,
  NotificationSounds,
  MuteButton,
  DraftManager,
  useAutoSaveDraft,
  AutoSaveIndicator,
  DraftRecoveryPrompt,
};
