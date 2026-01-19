// Phase 8: Communication Enhancement & Inbox Intelligence Bundle
// This bundle contains voice messages, emoji reactions, priority inbox, and quick replies
// Lazy loaded when communication enhancement features are used

import { VoiceRecorder, VoicePlayer, VoiceMessageButton } from './VoiceMessages';
import { EmojiReactions, EmojiPicker, QuickReactionBar as EmojiQuickReactionBar } from './EmojiReactions';
import { PriorityInbox, PriorityBadge } from './PriorityInbox';
import { ConversationArchive, ArchiveButton } from './ConversationArchive';
import { QuickReplies, QuickReplyBar } from './QuickReplies';
import { MessageStatusTimeline, StatusIndicator } from './MessageStatusTimeline';

// Export as default object for lazy loading
export default {
  VoiceRecorder,
  VoicePlayer,
  VoiceMessageButton,
  EmojiReactions,
  EmojiPicker,
  EmojiQuickReactionBar,
  PriorityInbox,
  PriorityBadge,
  ConversationArchive,
  ArchiveButton,
  QuickReplies,
  QuickReplyBar,
  MessageStatusTimeline,
  StatusIndicator,
};
