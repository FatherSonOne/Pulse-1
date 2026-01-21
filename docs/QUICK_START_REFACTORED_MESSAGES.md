# Quick Start: Refactored Messages Component

**For Developers**: This guide shows you how to use the new refactored Messages architecture.

## TL;DR - What Changed?

The monolithic Messages.tsx (6000+ lines, 80+ state variables) has been refactored into:
- **3 Context Providers**: MessagesContext, ToolsContext, FocusModeContext
- **1 Custom Hook**: useMessagesState
- **Clean Architecture**: State management separated from UI

## Using the Refactored System

### Option 1: Quick Integration (Recommended)

Just wrap your Messages component with the provider:

```tsx
import { MessagesWithProviders } from '@/components/Messages';

function App() {
  return (
    <MessagesWithProviders
      apiKey={apiKey}
      contacts={contacts}
      currentUser={currentUser}
    />
  );
}
```

Done! The original Messages component now has access to all contexts.

### Option 2: Manual Provider Setup

If you need more control:

```tsx
import { MessagesProvider, ToolsProvider, FocusModeProvider } from '@/contexts';
import Messages from '@/components/Messages';

function App() {
  return (
    <MessagesProvider currentUser={currentUser}>
      <ToolsProvider>
        <FocusModeProvider>
          <Messages apiKey={apiKey} contacts={contacts} />
        </FocusModeProvider>
      </ToolsProvider>
    </MessagesProvider>
  );
}
```

## Using Contexts in Your Components

### 1. Messages Context - Core Messaging

```tsx
import { useMessages } from '@/contexts';

function MyComponent() {
  const {
    // State
    threads,
    pulseConversations,
    activePulseConversation,
    pulseMessages,
    isLoading,

    // Actions
    loadPulseMessages,
    sendPulseMessage,
    addReactionToPulseMessage,
  } = useMessages();

  // Send a message
  const handleSend = async (content: string) => {
    await sendPulseMessage(activePulseConversation!, content);
  };

  // Add reaction
  const handleReaction = (messageId: string, emoji: string) => {
    addReactionToPulseMessage(messageId, emoji);
  };

  return (
    <div>
      {pulseMessages.map(msg => (
        <Message
          key={msg.id}
          message={msg}
          onReaction={(emoji) => handleReaction(msg.id, emoji)}
        />
      ))}
    </div>
  );
}
```

### 2. Tools Context - Panel Management

```tsx
import { useTools } from '@/contexts';

function ToolButton() {
  const {
    showAnalyticsPanel,
    togglePanel,
    openPanel,
    closeAllPanels,
  } = useTools();

  return (
    <div>
      <button onClick={() => openPanel('analytics')}>
        Open Analytics
      </button>
      <button onClick={() => togglePanel('analytics', showAnalyticsPanel)}>
        Toggle Analytics
      </button>
      <button onClick={closeAllPanels}>
        Close All
      </button>
    </div>
  );
}
```

### 3. Focus Mode Context - Productivity Timer

```tsx
import { useFocusMode } from '@/contexts';

function FocusModeButton() {
  const {
    isActive,
    remainingTime,
    progress,
    startFocusMode,
    stopFocusMode,
    pauseFocusMode,
  } = useFocusMode();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      {isActive ? (
        <>
          <div>Time Remaining: {formatTime(remainingTime)}</div>
          <div>Progress: {progress.toFixed(0)}%</div>
          <button onClick={stopFocusMode}>Stop</button>
          <button onClick={pauseFocusMode}>Pause</button>
        </>
      ) : (
        <button onClick={() => startFocusMode('thread-123', 25 * 60)}>
          Start 25min Focus
        </button>
      )}
    </div>
  );
}
```

### 4. Messages State Hook - Additional Features

```tsx
import { useMessagesState } from '@/hooks/useMessagesState';

function MessageFeatures() {
  const {
    // Collaboration
    pinnedMessages,
    addPinnedMessage,

    // Bookmarks
    userBookmarks,
    addBookmark,

    // Templates
    userTemplates,
    addTemplate,

    // UI State
    showEmojiPicker,
    setShowEmojiPicker,
  } = useMessagesState();

  const handlePinMessage = (message: any) => {
    addPinnedMessage({
      id: uuidv4(),
      messageId: message.id,
      text: message.content,
      sender: message.sender_id,
      timestamp: message.created_at,
      pinnedBy: 'current-user',
      pinnedAt: new Date().toISOString(),
      category: 'important',
    });
  };

  return (
    <div>
      <button onClick={() => setShowEmojiPicker(true)}>
        Add Emoji
      </button>
      {pinnedMessages.map(pin => (
        <div key={pin.id}>{pin.text}</div>
      ))}
    </div>
  );
}
```

## Common Patterns

### 1. Optimized Event Handlers

Use `useCallback` to prevent function recreation:

```tsx
const handleSend = useCallback(async (content: string) => {
  if (!activePulseConversation) return;
  await sendPulseMessage(activePulseConversation, content);
}, [activePulseConversation, sendPulseMessage]);
```

### 2. Computed Values

Use `useMemo` for expensive calculations:

```tsx
const filteredMessages = useMemo(() => {
  return pulseMessages.filter(msg =>
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [pulseMessages, searchQuery]);
```

### 3. Memoized Components

Use `React.memo` for components that re-render often:

```tsx
const MessageItem = memo(({ message, onReaction }) => {
  return (
    <div>
      {message.content}
      <ReactionButton onClick={() => onReaction('👍')} />
    </div>
  );
});
```

## Complete Example Component

```tsx
import React, { useState, useCallback, useMemo, memo } from 'react';
import { useMessages, useTools, useFocusMode } from '@/contexts';
import { useMessagesState } from '@/hooks/useMessagesState';

const MessageList = memo(() => {
  const {
    pulseMessages,
    activePulseConversation,
    sendPulseMessage,
    addReactionToPulseMessage,
  } = useMessages();

  const { showEmojiPicker, setShowEmojiPicker } = useMessagesState();
  const { openPanel } = useTools();
  const { startFocusMode } = useFocusMode();

  const [inputValue, setInputValue] = useState('');

  // Optimized send handler
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !activePulseConversation) return;

    await sendPulseMessage(activePulseConversation, inputValue);
    setInputValue('');
  }, [inputValue, activePulseConversation, sendPulseMessage]);

  // Optimized reaction handler
  const handleReaction = useCallback((messageId: string, emoji: string) => {
    addReactionToPulseMessage(messageId, emoji);
  }, [addReactionToPulseMessage]);

  // Computed filtered messages
  const recentMessages = useMemo(() => {
    return pulseMessages.slice(-50); // Last 50 messages
  }, [pulseMessages]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex gap-2 p-2 border-b">
        <button onClick={() => openPanel('analytics')}>
          Analytics
        </button>
        <button onClick={() => startFocusMode(activePulseConversation!, 25 * 60)}>
          Focus Mode
        </button>
        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
          Emoji
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {recentMessages.map(msg => (
          <div key={msg.id} className="mb-2">
            <div>{msg.content}</div>
            <button onClick={() => handleReaction(msg.id, '👍')}>👍</button>
            <button onClick={() => handleReaction(msg.id, '❤️')}>❤️</button>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          className="w-full p-2 border rounded"
          placeholder="Type a message..."
        />
        <button onClick={handleSend} className="mt-2">
          Send
        </button>
      </div>
    </div>
  );
});

export default MessageList;
```

## Migration Checklist

When refactoring an existing component:

- [ ] Replace `useState` for messaging with `useMessages()` context
- [ ] Replace tool panel state with `useTools()` context
- [ ] Replace focus mode state with `useFocusMode()` context
- [ ] Move UI state to `useMessagesState()` hook
- [ ] Wrap event handlers with `useCallback`
- [ ] Wrap computed values with `useMemo`
- [ ] Add `React.memo` to expensive components
- [ ] Test that all functionality still works

## TypeScript Support

All contexts and hooks are fully typed:

```tsx
import type {
  MessagesContextState,
  ToolsContextState,
  FocusModeContextState,
  PinnedMessage,
  UserTemplate,
} from '@/contexts';

// Your IDE will provide full IntelliSense support
const { threads }: MessagesContextState = useMessages();
```

## Testing

### Testing Components with Contexts

```tsx
import { render, screen } from '@testing-library/react';
import { MessagesProvider } from '@/contexts';
import MyComponent from './MyComponent';

test('renders messages', () => {
  render(
    <MessagesProvider currentUser={mockUser}>
      <MyComponent />
    </MessagesProvider>
  );

  expect(screen.getByText(/messages/i)).toBeInTheDocument();
});
```

### Testing Hooks

```tsx
import { renderHook, act } from '@testing-library/react';
import { useMessages, MessagesProvider } from '@/contexts';

test('sends message', async () => {
  const { result } = renderHook(() => useMessages(), {
    wrapper: MessagesProvider,
  });

  await act(async () => {
    await result.current.sendPulseMessage('conv-123', 'Hello!');
  });

  expect(result.current.pulseMessages).toHaveLength(1);
});
```

## Troubleshooting

### "useMessages must be used within a MessagesProvider"

**Solution**: Wrap your component tree with `<MessagesWithProviders>` or add the providers manually.

### State not updating

**Solution**: Make sure you're using the context setters, not creating local state:

```tsx
// ❌ Wrong - creates local state
const [activeThread, setActiveThread] = useState('');

// ✅ Correct - uses context
const { activeThreadId, setActiveThreadId } = useMessages();
```

### Performance issues

**Solution**: Add performance optimizations:

1. Wrap components with `React.memo`
2. Use `useCallback` for event handlers
3. Use `useMemo` for computed values
4. Consider virtualization for long lists

## Next Steps

1. **Read**: [MESSAGES_REFACTORING_GUIDE.md](MESSAGES_REFACTORING_GUIDE.md) for detailed architecture
2. **Review**: Example component in `src/components/Messages/Messages.refactored.example.tsx`
3. **Explore**: Context implementations in `src/contexts/`
4. **Build**: Start using contexts in your components!

## Resources

- **Architecture Guide**: MESSAGES_REFACTORING_GUIDE.md
- **Implementation Summary**: PHASE_7_COMPONENT_REFACTORING_SUMMARY.md
- **Example Component**: src/components/Messages/Messages.refactored.example.tsx
- **Context Source**: src/contexts/
- **Custom Hook**: src/hooks/useMessagesState.ts

## Support

For questions or issues:
1. Review the comprehensive refactoring guide
2. Check the example implementations
3. Look at TypeScript interfaces for API details
4. Consult the phase summary for architecture overview

---

**Quick Start Guide Version**: 1.0
**Last Updated**: 2026-01-19
**Status**: Ready for Development
