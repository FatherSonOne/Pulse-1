# Split-View Integration Guide

This guide shows how to integrate the new split-view layout into the existing Messages.tsx component.

## Quick Start

### Option 1: Replace Entire Layout (Recommended)

Replace the existing Messages component with the new split-view:

```typescript
// In src/components/Messages.tsx
import MessagesSplitView from './Messages/MessagesSplitView';
import { useMessageChannels } from '../hooks/useMessageChannels';

export default function Messages() {
  const { channels, messages, currentUserId, sendMessage, addReaction, loadMessages } = useMessageChannels();

  return (
    <MessagesSplitView
      channels={channels}
      messages={messages}
      currentUserId={currentUserId}
      onSendMessage={sendMessage}
      onAddReaction={addReaction}
      onLoadMessages={loadMessages}
    />
  );
}
```

### Option 2: Feature Flag Toggle

Use a feature flag to gradually roll out the new layout:

```typescript
// In src/components/Messages.tsx
import MessagesSplitView from './Messages/MessagesSplitView';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

export default function Messages() {
  const useSplitView = useFeatureFlag('split-view-layout');
  const { channels, messages, currentUserId, ...handlers } = useMessageChannels();

  if (useSplitView) {
    return (
      <MessagesSplitView
        channels={channels}
        messages={messages}
        currentUserId={currentUserId}
        {...handlers}
      />
    );
  }

  // Existing legacy layout
  return <LegacyMessagesLayout {...props} />;
}
```

### Option 3: User Preference Toggle

Let users choose their preferred layout:

```typescript
// In src/components/Messages.tsx
import MessagesSplitView from './Messages/MessagesSplitView';
import { useUserPreference } from '../hooks/useUserPreference';

export default function Messages() {
  const [layoutMode, setLayoutMode] = useUserPreference('messages-layout', 'split-view');
  const { channels, messages, currentUserId, ...handlers } = useMessageChannels();

  return (
    <div className="h-full flex flex-col">
      {/* Layout toggle */}
      <div className="flex items-center justify-end px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setLayoutMode(layoutMode === 'split-view' ? 'legacy' : 'split-view')}
          className="px-3 py-1 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          {layoutMode === 'split-view' ? (
            <>
              <i className="fa-solid fa-table-columns mr-2"></i>
              Split View
            </>
          ) : (
            <>
              <i className="fa-solid fa-list mr-2"></i>
              List View
            </>
          )}
        </button>
      </div>

      {/* Layout content */}
      <div className="flex-1 overflow-hidden">
        {layoutMode === 'split-view' ? (
          <MessagesSplitView
            channels={channels}
            messages={messages}
            currentUserId={currentUserId}
            {...handlers}
          />
        ) : (
          <LegacyMessagesLayout {...props} />
        )}
      </div>
    </div>
  );
}
```

## Custom Message Rendering

### Custom Message Input

```typescript
import MessageInput from './MessageInput';

<MessagesSplitView
  {...props}
  renderMessageInput={() => (
    <MessageInput
      onSend={(content) => handleSendMessage(activeChannelId, content)}
      placeholder="Type a message..."
      enableAI={true}
      enableAttachments={true}
    />
  )}
/>
```

### Custom Message Bubble

```typescript
import CustomMessageBubble from './CustomMessageBubble';

<MessagesSplitView
  {...props}
  renderMessageBubble={(message) => (
    <CustomMessageBubble
      message={message}
      currentUserId={currentUserId}
      onReact={(emoji) => handleReaction(message.id, emoji)}
      onEdit={(newContent) => handleEdit(message.id, newContent)}
      onDelete={() => handleDelete(message.id)}
    />
  )}
/>
```

## Connecting to Existing State

### Using Zustand Store

```typescript
// In src/stores/messageStore.ts
import { create } from 'zustand';
import { MessageChannel, ChannelMessage } from '../types/messages';

interface MessageStore {
  channels: MessageChannel[];
  messages: Record<string, ChannelMessage[]>;
  activeChannelId: string | null;
  setActiveChannel: (channelId: string) => void;
  addMessage: (channelId: string, message: ChannelMessage) => void;
  // ... other actions
}

export const useMessageStore = create<MessageStore>((set) => ({
  channels: [],
  messages: {},
  activeChannelId: null,
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  addMessage: (channelId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [channelId]: [...(state.messages[channelId] || []), message]
    }
  })),
  // ... other implementations
}));

// In Messages.tsx
import { useMessageStore } from '../stores/messageStore';

export default function Messages() {
  const { channels, messages, activeChannelId, setActiveChannel, addMessage } = useMessageStore();

  return (
    <MessagesSplitView
      channels={channels}
      messages={messages}
      currentUserId="user-1"
      onSendMessage={(channelId, content) => {
        // Send message via API
        const newMessage = await sendMessageAPI(channelId, content);
        addMessage(channelId, newMessage);
      }}
    />
  );
}
```

### Using React Context

```typescript
// In src/contexts/MessagesContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface MessagesContextValue {
  channels: MessageChannel[];
  messages: Record<string, ChannelMessage[]>;
  // ... other state
}

const MessagesContext = createContext<MessagesContextValue | null>(null);

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [channels, setChannels] = useState<MessageChannel[]>([]);
  const [messages, setMessages] = useState<Record<string, ChannelMessage[]>>({});

  return (
    <MessagesContext.Provider value={{ channels, messages }}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (!context) throw new Error('useMessages must be used within MessagesProvider');
  return context;
};

// In Messages.tsx
import { useMessages } from '../contexts/MessagesContext';

export default function Messages() {
  const { channels, messages } = useMessages();

  return (
    <MessagesSplitView
      channels={channels}
      messages={messages}
      currentUserId="user-1"
    />
  );
}
```

## Real-time Updates with Supabase

```typescript
// In Messages.tsx or a custom hook
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Messages() {
  const { channels, messages, addMessage, updateMessage, deleteMessage } = useMessageStore();

  useEffect(() => {
    // Subscribe to real-time updates
    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'channel_messages'
      }, (payload) => {
        const newMessage = payload.new as ChannelMessage;
        addMessage(newMessage.channel_id, newMessage);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'channel_messages'
      }, (payload) => {
        const updatedMessage = payload.new as ChannelMessage;
        updateMessage(updatedMessage.channel_id, updatedMessage);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'channel_messages'
      }, (payload) => {
        const deletedMessage = payload.old as ChannelMessage;
        deleteMessage(deletedMessage.channel_id, deletedMessage.id);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <MessagesSplitView
      channels={channels}
      messages={messages}
      currentUserId="user-1"
    />
  );
}
```

## Styling Customization

### CSS Variables

```css
/* In your global CSS or theme file */
:root {
  --messages-split-ratio-desktop: 30% 70%;
  --messages-split-ratio-tablet: 35% 65%;
  --messages-border-color: #e5e7eb;
  --messages-bg-primary: #ffffff;
  --messages-text-primary: #18181b;
  --messages-active-bg: #eff6ff;
  --messages-active-border: #3b82f6;
}

.dark {
  --messages-border-color: #27272a;
  --messages-bg-primary: #18181b;
  --messages-text-primary: #ffffff;
  --messages-active-bg: rgba(59, 130, 246, 0.2);
  --messages-active-border: #3b82f6;
}
```

### Custom CSS Classes

```typescript
<MessagesSplitView
  className="custom-messages-layout"
  {...props}
/>
```

```css
/* In your custom CSS */
.custom-messages-layout {
  /* Override default styles */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.custom-messages-layout .thread-list-panel {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.custom-messages-layout .conversation-panel {
  background: rgba(255, 255, 255, 0.05);
}
```

## Mobile Customization

### Custom Mobile Behavior

```typescript
import { useState, useEffect } from 'react';

export default function Messages() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <MessagesSplitView
      {...props}
      // Hide thread list initially on mobile
      className={isMobile ? 'mobile-conversation-first' : ''}
    />
  );
}
```

## Analytics Integration

### Track User Interactions

```typescript
import { trackEvent } from '../lib/analytics';

<MessagesSplitView
  {...props}
  onSendMessage={(channelId, content) => {
    // Track message sent
    trackEvent('message_sent', {
      channel_id: channelId,
      content_length: content.length,
      timestamp: new Date().toISOString()
    });

    // Send message
    handleSendMessage(channelId, content);
  }}
  onLoadMessages={(channelId) => {
    // Track thread view
    trackEvent('thread_viewed', {
      channel_id: channelId,
      timestamp: new Date().toISOString()
    });

    // Load messages
    return loadMessages(channelId);
  }}
/>
```

## Error Handling

### Error Boundaries

```typescript
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
        <p className="text-zinc-600 mb-4">{error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export default function Messages() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <MessagesSplitView {...props} />
    </ErrorBoundary>
  );
}
```

## Performance Optimization

### Memoization

```typescript
import { useMemo } from 'react';

export default function Messages() {
  const { channels, messages, currentUserId } = useMessageStore();

  // Memoize filtered channels
  const filteredChannels = useMemo(() => {
    return channels.filter(ch => ch.is_public || ch.members?.some(m => m.user_id === currentUserId));
  }, [channels, currentUserId]);

  // Memoize message handlers
  const handleSendMessage = useCallback((channelId: string, content: string) => {
    // Implementation
  }, []);

  return (
    <MessagesSplitView
      channels={filteredChannels}
      messages={messages}
      currentUserId={currentUserId}
      onSendMessage={handleSendMessage}
    />
  );
}
```

## Testing the Integration

### Unit Test Example

```typescript
import { render, screen } from '@testing-library/react';
import Messages from './Messages';

test('renders split-view layout', () => {
  render(<Messages />);
  expect(screen.getByText('Messages')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Search threads...')).toBeInTheDocument();
});
```

### E2E Test Example (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('split-view navigation works', async ({ page }) => {
  await page.goto('/messages');

  // Check split-view is rendered
  await expect(page.locator('.messages-split-view')).toBeVisible();

  // Select a thread
  await page.click('text=General');

  // Verify conversation panel shows messages
  await expect(page.locator('.conversation-panel')).toBeVisible();

  // Test keyboard shortcut
  await page.keyboard.press('Control+]');

  // Verify next thread is selected
  await expect(page.locator('.thread-item.active')).toContainText('Engineering');
});
```

## Migration Checklist

- [ ] Import MessagesSplitView component
- [ ] Connect to existing state management (Zustand/Context)
- [ ] Implement message sending handler
- [ ] Implement reaction handler
- [ ] Implement message loading handler
- [ ] Set up real-time subscriptions (if using Supabase)
- [ ] Test keyboard shortcuts (Ctrl+[/], Ctrl+J)
- [ ] Test responsive behavior on mobile
- [ ] Test accessibility with screen reader
- [ ] Add error boundaries
- [ ] Add analytics tracking
- [ ] Import messages.css styles
- [ ] Test in production environment

## Troubleshooting

### Issue: Keyboard shortcuts not working
**Solution**: Ensure no other components are preventing default on these key combinations. Check if inputs are properly excluded from shortcut handling.

### Issue: Mobile view not switching
**Solution**: Verify window resize listener is working. Check that CSS media queries are properly applied.

### Issue: Messages not loading
**Solution**: Verify `onLoadMessages` handler is properly connected to your data fetching logic. Check console for errors.

### Issue: Styles not applying
**Solution**: Ensure `messages.css` is imported. Check that CSS Grid is supported in your browser. Verify no conflicting styles.

## Support

For additional help:
- See [README.md](./README.md) for component documentation
- See [AGENTIC_BUILD_ORCHESTRATION.md](../../../AGENTIC_BUILD_ORCHESTRATION.md) for project overview
- Check test files for usage examples

---

**Last Updated**: 2026-01-19
**Phase**: Phase 2 - Split-View Layout
**Status**: Complete
