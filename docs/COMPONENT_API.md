# Pulse Messages - Component API Reference

**Version**: 1.0
**Last Updated**: 2026-01-19

---

## Table of Contents

1. [Core Components](#core-components)
2. [Feature Components](#feature-components)
3. [UI Components](#ui-components)
4. [Props Reference](#props-reference)

---

## Core Components

### MessagesSplitView

Main layout component with split-view design (30% threads, 70% conversation).

**Props**:
```typescript
interface MessagesSplitViewProps {
  channels: MessageChannel[];
  messages: Record<string, ChannelMessage[]>;
  currentUserId: string;
  onSendMessage: (channelId: string, content: string) => Promise<void>;
  onAddReaction?: (messageId: string, emoji: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onEditMessage?: (messageId: string, content: string) => Promise<void>;
  onPinMessage?: (messageId: string, isPinned: boolean) => Promise<void>;
  customMessageRenderer?: (message: ChannelMessage) => React.ReactNode;
  className?: string;
}
```

**Usage**:
```tsx
<MessagesSplitView
  channels={channels}
  messages={messages}
  currentUserId="user-123"
  onSendMessage={handleSendMessage}
  onAddReaction={handleAddReaction}
/>
```

---

### ThreadListPanel

Displays thread list with search and pinned sections.

**Props**:
```typescript
interface ThreadListPanelProps {
  channels: MessageChannel[];
  selectedChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  currentUserId: string;
  showPinnedSection?: boolean;
  className?: string;
}
```

---

### ConversationPanel

Displays messages for active thread.

**Props**:
```typescript
interface ConversationPanelProps {
  channelId: string | null;
  messages: ChannelMessage[];
  currentUserId: string;
  onSendMessage: (content: string) => Promise<void>;
  onAddReaction?: (messageId: string, emoji: string) => Promise<void>;
  customMessageRenderer?: (message: ChannelMessage) => React.ReactNode;
  isLoading?: boolean;
  className?: string;
}
```

---

### ToolsPanel

39-tool panel with categories and search.

**Props**:
```typescript
interface ToolsPanelProps {
  onToolClick: (toolId: string) => void;
  onClose?: () => void;
  className?: string;
  initialCategory?: 'all' | 'ai' | 'content' | 'analysis' | 'utilities';
  showQuickAccess?: boolean;
  showSuggestions?: boolean;
}
```

---

### HoverReactionTrigger

Hover/long-press reaction system.

**Props**:
```typescript
interface HoverReactionTriggerProps {
  messageId: string;
  isMe: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onShowMore?: () => void;
  children: React.ReactNode;
  hoverDelay?: number; // default: 300ms
  longPressDelay?: number; // default: 500ms
  disabled?: boolean;
  renderReactionBar?: (props: ReactionBarProps) => React.ReactNode;
}
```

**Usage**:
```tsx
<HoverReactionTrigger
  messageId={message.id}
  isMe={message.sender === currentUserId}
  onReact={handleReaction}
>
  <MessageBubble message={message} />
</HoverReactionTrigger>
```

---

## Feature Components

### AICoach (BundleAI)

**Props**:
```typescript
interface AICoachProps {
  onClose: () => void;
  messageContext?: ChannelMessage;
  channelId?: string;
}
```

### SmartCompose (BundleAI)

**Props**:
```typescript
interface SmartComposeProps {
  messageContent: string;
  conversationContext: string[];
  onSuggestionSelect: (suggestion: string) => void;
  apiKey: string;
}
```

### EngagementScore (BundleAnalytics)

**Props**:
```typescript
interface EngagementScoreProps {
  channelId: string;
  timeRange?: '7d' | '30d' | '90d';
}
```

### TemplatePicker (BundleProductivity)

**Props**:
```typescript
interface TemplatePickerProps {
  templates: Template[];
  onSelect: (template: Template) => void;
  onClose: () => void;
}
```

---

## UI Components

### ThreadItem

**Props**:
```typescript
interface ThreadItemProps {
  channel: MessageChannel;
  isActive: boolean;
  onClick: () => void;
  onPin?: () => void;
  onMute?: () => void;
  isPinned?: boolean;
  isMuted?: boolean;
}
```

### MessageBubble

**Props**:
```typescript
interface MessageBubbleProps {
  message: ChannelMessage;
  isMe: boolean;
  onReact?: (emoji: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showAvatar?: boolean;
}
```

### AnimatedReactions

**Props**:
```typescript
interface AnimatedReactionsProps {
  reactions: MessageReaction[];
  onReact: (emoji: string) => void;
  isMe: boolean;
  maxVisible?: number;
}
```

---

## Props Reference

### Common Prop Types

```typescript
// Message types
type MessageType = 'text' | 'system' | 'file';

// Callback types
type MessageCallback = (messageId: string) => void | Promise<void>;
type ReactionCallback = (messageId: string, emoji: string) => void | Promise<void>;

// Rendering types
type MessageRenderer = (message: ChannelMessage) => React.ReactNode;
type CustomRenderer<T> = (item: T) => React.ReactNode;

// Common props
interface CommonProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
```

---

**See Also**:
- [Messages Architecture](./MESSAGES_ARCHITECTURE.md)
- [API Reference](./API_REFERENCE.md)
- [User Guide](./USER_GUIDE.md)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
