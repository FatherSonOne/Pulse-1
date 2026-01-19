// Phase 6: Intelligence & Organization Bundle
// This bundle contains contact insights, bookmarks, tags, and read receipts
// Lazy loaded when intelligence features are accessed

import { ContactInsights, ContactCard } from './ContactInsights';
import { ReactionsAnalytics, ReactionsSummaryBadge } from './ReactionsAnalytics';
import { QuickActionsCommandPalette, useCommandPalette, CommandPaletteButton } from './QuickActionsCommandPalette';
import { MessageBookmarks, BookmarkButton } from './MessageBookmarks';
import { ConversationTags, TagSelector, LabelBadge } from './ConversationTags';
import { ReadReceipts, DeliveryStatusIndicator, TypingIndicator, OnlineStatusDot } from './ReadReceipts';

// Export as default object for lazy loading
export default {
  ContactInsights,
  ContactCard,
  ReactionsAnalytics,
  ReactionsSummaryBadge,
  QuickActionsCommandPalette,
  useCommandPalette,
  CommandPaletteButton,
  MessageBookmarks,
  BookmarkButton,
  ConversationTags,
  TagSelector,
  LabelBadge,
  ReadReceipts,
  DeliveryStatusIndicator,
  TypingIndicator,
  OnlineStatusDot,
};
