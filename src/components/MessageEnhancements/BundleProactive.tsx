// Phase 7: Proactive Intelligence & Advanced Organization Bundle
// This bundle contains smart reminders, threading, sentiment analysis, and search
// Lazy loaded in background after initial render

import { SmartReminders, ReminderBadge } from './SmartReminders';
import { MessageThreading, ThreadIndicator } from './MessageThreading';
import { SentimentTimeline, SentimentBadge } from './SentimentTimeline';
import { ContactGroups, GroupBadge } from './ContactGroups';
import { NaturalLanguageSearch, QuickSearchButton } from './NaturalLanguageSearch';
import { ConversationHighlights, HighlightIndicator } from './ConversationHighlights';

// Export as default object for lazy loading
export default {
  SmartReminders,
  ReminderBadge,
  MessageThreading,
  ThreadIndicator,
  SentimentTimeline,
  SentimentBadge,
  ContactGroups,
  GroupBadge,
  NaturalLanguageSearch,
  QuickSearchButton,
  ConversationHighlights,
  HighlightIndicator,
};
