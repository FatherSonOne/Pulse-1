// Message Enhancements Components - Central Export
// Phase 1: Visual & Interaction Components
export { MessageMoodBadge } from './MessageMoodBadge';
export { RichMessageCardComponent } from './RichMessageCard';
export { AnimatedReactions, QuickReactionBar } from './AnimatedReactions';
export { LiveCollaborators, ThreadActivityIndicator, useTypingSimulation } from './LiveCollaborators';
export { MessageThemeProvider, ThemeSelector, InlineThemePicker, StandaloneThemePicker, useMessageTheme, MESSAGE_THEMES, COLOR_PAIR_THEMES } from './MessageThemeProvider';
export type { ColorPairTheme } from './MessageThemeProvider';

// Phase 2: AI-Powered Components (Original)
export { SmartCompose } from './SmartCompose';
export { AICoach } from './AICoach';

// Phase 2: AI-Powered Components (Enhanced)
export { SmartComposeEnhanced, QuickPhrases, ToneAdjuster } from './SmartComposeEnhanced';
export { AICoachEnhanced, InlineCoachTip } from './AICoachEnhanced';
export { AIMediatorPanel, MediatorIndicator } from './AIMediatorPanel';
export { VoiceContextExtractor } from './VoiceContextExtractor';
export { TranslationWidgetEnhanced, TranslationIndicator, AutoTranslateToggle } from './TranslationWidgetEnhanced';

// Phase 3: Analytics & Engagement (Original)
export { ConversationHealthWidget } from './ConversationHealthWidget';
export { AchievementToast, AchievementProgress } from './AchievementToast';
export { MessageImpactVisualization } from './MessageImpactVisualization';
export { ProactiveInsights } from './ProactiveInsights';
export { ThreadActionsMenu, ThreadBadges } from './ThreadActions';
export { TranslationWidget } from './TranslationWidget';
export { QuickActions } from './QuickActions';
export { MessageAnalyticsDashboard } from './MessageAnalyticsDashboard';
export { NetworkGraph } from './NetworkGraph';

// Phase 3: Analytics & Engagement (Enhanced)
export { ResponseTimeTracker, ResponseTimeBadge } from './ResponseTimeTracker';
export { EngagementScoring, EngagementBadge } from './EngagementScoring';
export { ConversationFlowViz } from './ConversationFlowViz';
export { AchievementSystemEnhanced, AchievementBadge } from './AchievementSystemEnhanced';
export { ProactiveInsightsEnhanced, InsightIndicator } from './ProactiveInsightsEnhanced';

// Phase 4: Collaboration & Advanced Features
export { ThreadCollaboration, ParticipantAvatars } from './ThreadCollaboration';
export { ThreadLinking, ThreadReferenceBadge } from './ThreadLinking';
export { KnowledgeBase, KnowledgeSuggestionChip } from './KnowledgeBase';
export { AdvancedSearch } from './AdvancedSearch';
export { MessagePinning, PinButton, HighlightToolbar } from './MessagePinning';
export { CollaborativeAnnotations, AnnotationButton, QuickAnnotationCreator } from './CollaborativeAnnotations';

// Phase 5: Productivity & Utilities
export { SmartTemplates, TemplateButton } from './SmartTemplates';
export { MessageScheduling, ScheduleButton } from './MessageScheduling';
export { ConversationSummary, SummaryBadge } from './ConversationSummary';
export { ExportSharing, QuickExportButton, QuickShareButton } from './ExportSharing';
export { KeyboardShortcuts, useKeyboardShortcuts, ShortcutHint } from './KeyboardShortcuts';
export { NotificationPreferences, NotificationBadge } from './NotificationPreferences';

// Phase 6: Intelligence & Organization
export { ContactInsights, ContactCard } from './ContactInsights';
export { ReactionsAnalytics, ReactionsSummaryBadge } from './ReactionsAnalytics';
export { QuickActionsCommandPalette, useCommandPalette, CommandPaletteButton } from './QuickActionsCommandPalette';
export { MessageBookmarks, BookmarkButton } from './MessageBookmarks';
export { ConversationTags, TagSelector, LabelBadge } from './ConversationTags';
export { ReadReceipts, DeliveryStatusIndicator, TypingIndicator, OnlineStatusDot } from './ReadReceipts';

// Phase 7: Proactive Intelligence & Advanced Organization
export { SmartReminders, ReminderBadge } from './SmartReminders';
export { MessageThreading, ThreadIndicator } from './MessageThreading';
export { SentimentTimeline, SentimentBadge } from './SentimentTimeline';
export { ContactGroups, GroupBadge } from './ContactGroups';
export { NaturalLanguageSearch, QuickSearchButton } from './NaturalLanguageSearch';
export { ConversationHighlights, HighlightIndicator } from './ConversationHighlights';

// Phase 8: Communication Enhancement & Inbox Intelligence
export { VoiceRecorder, VoicePlayer, VoiceMessageButton } from './VoiceMessages';
export { EmojiReactions, EmojiPicker, QuickReactionBar as EmojiQuickReactionBar } from './EmojiReactions';
export { PriorityInbox, PriorityBadge } from './PriorityInbox';
export { ConversationArchive, ArchiveButton } from './ConversationArchive';
export { QuickReplies, QuickReplyBar } from './QuickReplies';
export { MessageStatusTimeline, StatusIndicator } from './MessageStatusTimeline';

// Phase 9: Advanced Personalization & Automation
export { AutoResponseRules, RuleStatusToggle } from './AutoResponseRules';
export { FormattingToolbar, InlineFormattingBar } from './FormattingToolbar';
export { ContactNotes, QuickNoteButton } from './ContactNotes';
export { ConversationModes, StatusDot } from './ConversationModes';
export { NotificationSounds, MuteButton } from './NotificationSounds';
export { DraftManager, useAutoSaveDraft, AutoSaveIndicator, DraftRecoveryPrompt } from './DraftManager';

// Phase 10: Security, Insights & Productivity
export { MessageEncryption, PrivacyShieldButton } from './MessageEncryption';
export { ReadTimeEstimation, ReadTimeBadge } from './ReadTimeEstimation';
export { MessageVersioning, EditHistoryIndicator } from './MessageVersioning';
export { SmartFolders, FolderBadge } from './SmartFolders';
export { ConversationInsights, InsightsBadge } from './ConversationInsights';
export { FocusTimer, TimerWidget } from './FocusTimer';

// Phase 11: Multi-Media & Export Hub
export { TranslationHub, TranslateButton } from './TranslationHub';
export { AnalyticsExport, QuickExportButton as AnalyticsExportButton } from './AnalyticsExport';
export { TemplatesLibrary, TemplateInsertButton } from './TemplatesLibrary';
export { AttachmentManager, AttachmentButton } from './AttachmentManager';
export { BackupSync, SyncStatusIndicator } from './BackupSync';
export { SmartSuggestions, SuggestionButton } from './SmartSuggestions';

// Tool Overlay - Fullscreen tool panel
export { ToolOverlay } from './ToolOverlay';
export type { ToolType } from './ToolOverlay';

// Types
export type { ThreadActions } from './ThreadActions';

// Import CSS for animations
import './MessageEnhancements.css';
