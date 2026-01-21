# Messages.tsx Refactoring Guide

**Status**: Phase 7 - Component Refactoring
**Date**: 2026-01-19
**Complexity**: Very High

## Overview

This guide documents the refactoring of the monolithic `Messages.tsx` component (327.9 KB, 6078 lines, 80+ state variables) into a maintainable, performant component architecture.

## Goals

1. Split monolithic component into smaller, focused components
2. Extract state management into custom hooks and context providers
3. Improve performance with React.memo, useMemo, useCallback
4. Maintain all existing functionality
5. Keep TypeScript typing throughout
6. Preserve accessibility features

## Created Architecture

### Context Providers

#### 1. MessagesContext (`src/contexts/MessagesContext.tsx`)

Manages core messaging state:

```typescript
interface MessagesContextState {
  // SMS Threads (legacy)
  threads: Thread[];
  activeThreadId: string;

  // Pulse Conversations
  pulseConversations: PulseConversation[];
  activePulseConversation: string | null;
  pulseMessages: PulseMessage[];

  // Message reactions
  pulseMessageReactions: Record<string, Array<MessageReaction>>;
  starredPulseMessages: Set<string>;

  // Reply state
  replyingToPulseMessage: PulseMessage | null;

  // Search
  searchQuery: string;
  isSearchOpen: boolean;

  // Pulse user search
  pulseUserSearch: string;
  pulseSearchResults: SearchUserResult[];
  suggestedPulseUsers: SearchUserResult[];
  recentPulseContacts: SearchUserResult[];

  // Context menu
  pulseContextMenuMsgId: string | null;
  pulseContextMenuPosition: { x: number; y: number } | null;

  // Contact panel
  selectedContactUserId: string | null;
  showContactPanel: boolean;

  // Typing indicators
  typingThreads: Record<string, boolean>;
  typingUsers: string[];

  // Mobile view
  mobileView: 'list' | 'chat';

  // Loading
  isLoading: boolean;

  // Actions
  loadThreads: () => Promise<void>;
  loadPulseConversations: () => Promise<void>;
  loadPulseMessages: (conversationId: string) => Promise<void>;
  sendPulseMessage: (conversationId: string, content: string, replyTo?: string) => Promise<void>;
  addReactionToPulseMessage: (messageId: string, emoji: string) => void;
  toggleStarPulseMessage: (messageId: string) => void;
}
```

**Usage**:
```typescript
import { useMessages } from '@/contexts';

const { threads, activePulseConversation, sendPulseMessage } = useMessages();
```

#### 2. ToolsContext (`src/contexts/ToolsContext.tsx`)

Manages tool panels and features:

```typescript
interface ToolsContextState {
  // Active tool panel
  activeToolOverlay: ToolPanelType;

  // Panel visibility
  showAnalyticsPanel: boolean;
  showCollaborationPanel: boolean;
  showProductivityPanel: boolean;
  showIntelligencePanel: boolean;
  showProactivePanel: boolean;
  showCommunicationPanel: boolean;
  showPersonalizationPanel: boolean;
  showSecurityPanel: boolean;
  showMediaHubPanel: boolean;

  // Tab states for each panel
  analyticsView: AnalyticsTab;
  collaborationTab: CollaborationTab;
  productivityTab: ProductivityTab;
  intelligenceTab: IntelligenceTab;
  proactiveTab: ProactiveTab;
  communicationTab: CommunicationTab;
  personalizationTab: PersonalizationTab;
  securityTab: SecurityTab;
  mediaHubTab: MediaHubTab;

  // AI Features
  showAICoach: boolean;
  showAIMediator: boolean;
  showVoiceExtractor: boolean;
  showQuickPhrases: boolean;

  // Advanced features
  showMeetingDeflector: boolean;
  showTaskExtractor: boolean;
  showChannelArtifactPanel: boolean;
  useIntentComposer: boolean;

  // Context panel
  showContextPanel: boolean;

  // Actions
  closeAllPanels: () => void;
  togglePanel: (panel: string, currentValue: boolean) => void;
  openPanel: (panel: ToolPanelType) => void;
}
```

**Usage**:
```typescript
import { useTools } from '@/contexts';

const { activeToolOverlay, togglePanel, closeAllPanels } = useTools();
```

#### 3. FocusModeContext (`src/contexts/FocusModeContext.tsx`)

Manages focus mode timer and state:

```typescript
interface FocusModeContextState {
  // Focus mode state
  isActive: boolean;
  threadId: string | null;
  timerDuration: number; // in seconds
  elapsedTime: number;
  breaksDue: number;

  // Focus settings
  focusDigest: string | null;

  // Timer state
  isPaused: boolean;
  isRunning: boolean;
  remainingTime: number;
  progress: number; // 0-100

  // Actions
  startFocusMode: (threadId: string, duration?: number) => void;
  stopFocusMode: () => void;
  pauseFocusMode: () => void;
  resumeFocusMode: () => void;
  resetFocusMode: () => void;
  setTimerDuration: (duration: number) => void;
}
```

**Usage**:
```typescript
import { useFocusMode } from '@/contexts';

const { isActive, remainingTime, startFocusMode, stopFocusMode } = useFocusMode();
```

### Custom Hooks

#### useMessagesState (`src/hooks/useMessagesState.ts`)

Manages additional message-related state that doesn't belong in contexts:

```typescript
const {
  // Collaboration
  pinnedMessages,
  highlights,
  annotations,
  addPinnedMessage,
  addHighlight,
  addAnnotation,

  // Productivity
  userTemplates,
  userScheduledMessages,
  userReminders,
  addTemplate,
  addScheduledMessage,
  addReminder,

  // Organization
  userBookmarks,
  conversationTagAssignments,
  addBookmark,

  // UI state
  showTemplates,
  showEmojiPicker,
  editingMessageId,
  replyingTo,

  // Thread management
  threadFilter,
  archivedThreads,
  mutedThreads,
  toggleArchiveThread,
  toggleMuteThread,

  // Voice recording
  isRecording,
  recordingDuration,
  mediaRecorderRef,

  // Audio playback
  isPlayingId,
  audioContextRef,
} = useMessagesState();
```

### Component Structure

#### MessageContainer (`src/components/Messages/MessageContainer.tsx`)

Main layout wrapper that provides consistent container styling:

```typescript
<MessageContainer>
  {children}
</MessageContainer>
```

## Refactoring Strategy

### Phase 1: Wrap with Context Providers ✅ COMPLETE

1. Created `MessagesContext`, `ToolsContext`, `FocusModeContext`
2. Created `useMessagesState` custom hook
3. Created `MessageContainer` layout wrapper

### Phase 2: Progressive State Migration (IN PROGRESS)

The Messages.tsx component has 80+ state variables. Migrate them progressively:

**Step 1**: Identify state categories
- Core messaging (threads, messages, conversations) → MessagesContext
- Tool panels and features → ToolsContext
- Focus mode → FocusModeContext
- Collaboration features → useMessagesState
- UI toggles → useMessagesState

**Step 2**: Replace useState with context/hook usage
```typescript
// Before
const [activeThreadId, setActiveThreadId] = useState<string>('');

// After
const { activeThreadId, setActiveThreadId } = useMessages();
```

**Step 3**: Extract component sections
- Extract thread list view
- Extract conversation view
- Extract message composer
- Extract tool panels

### Phase 3: Component Extraction (TODO)

#### MessageListView Component
Extract thread list rendering:
```typescript
<MessageListView
  threads={threads}
  pulseConversations={pulseConversations}
  activeThreadId={activeThreadId}
  activePulseConversation={activePulseConversation}
  onThreadSelect={setActiveThreadId}
  onConversationSelect={setActivePulseConversation}
  searchQuery={searchQuery}
  threadFilter={threadFilter}
/>
```

#### ConversationView Component
Extract active conversation rendering:
```typescript
<ConversationView
  activeThread={activeThread}
  activePulseConversation={activePulseConversation}
  messages={messages}
  reactions={pulseMessageReactions}
  onReaction={addReactionToPulseMessage}
  onReply={setReplyingToPulseMessage}
  onStar={toggleStarPulseMessage}
/>
```

#### MessageComposer Component
Extract message input area:
```typescript
<MessageComposer
  threadId={activeThreadId}
  conversationId={activePulseConversation}
  replyingTo={replyingToPulseMessage}
  onSend={sendPulseMessage}
  onCancelReply={() => setReplyingToPulseMessage(null)}
/>
```

### Phase 4: Performance Optimization (TODO)

1. Add React.memo to expensive components
2. Use useMemo for computed values
3. Use useCallback for event handlers
4. Implement virtualization for long message lists
5. Lazy load heavy components

**Example optimizations**:
```typescript
// Memoize expensive computed values
const filteredThreads = useMemo(() => {
  return threads.filter(thread => {
    if (threadFilter === 'all') return true;
    if (threadFilter === 'unread') return thread.unread_count > 0;
    if (threadFilter === 'pinned') return thread.is_pinned;
    return true;
  });
}, [threads, threadFilter]);

// Memoize callbacks
const handleSendMessage = useCallback(async (content: string) => {
  if (!activePulseConversation) return;
  await sendPulseMessage(activePulseConversation, content);
}, [activePulseConversation, sendPulseMessage]);

// Memoize expensive components
const MessageList = memo(({ messages, onReaction }) => {
  // Component implementation
});
```

## Integration Pattern

### 1. Wrap App with Providers

In your app entry point (e.g., `App.tsx`):

```typescript
import { MessagesProvider, ToolsProvider, FocusModeProvider } from '@/contexts';

function App() {
  return (
    <MessagesProvider currentUser={currentUser}>
      <ToolsProvider>
        <FocusModeProvider>
          <Messages />
        </FocusModeProvider>
      </ToolsProvider>
    </MessagesProvider>
  );
}
```

### 2. Use Contexts in Components

```typescript
import { useMessages, useTools, useFocusMode } from '@/contexts';
import { useMessagesState } from '@/hooks/useMessagesState';

function Messages() {
  const messagesContext = useMessages();
  const toolsContext = useTools();
  const focusModeContext = useFocusMode();
  const messagesState = useMessagesState();

  // Component implementation using context values
}
```

## Benefits

### Performance Improvements

1. **Reduced Re-renders**: Context isolates state updates to relevant components
2. **Optimized Updates**: React.memo prevents unnecessary re-renders
3. **Computed Values**: useMemo caches expensive calculations
4. **Stable Callbacks**: useCallback prevents function recreation

### Maintainability Improvements

1. **Smaller Components**: Each component has focused responsibility
2. **Clear State Ownership**: Contexts clearly define state boundaries
3. **Reusable Logic**: Custom hooks encapsulate complex logic
4. **Type Safety**: Full TypeScript support throughout

### Developer Experience Improvements

1. **Easier Testing**: Smaller components are easier to test
2. **Better Debugging**: Clear component boundaries help identify issues
3. **Improved Code Navigation**: Logical file structure
4. **Easier Onboarding**: Clearer architecture for new developers

## Migration Checklist

### Completed ✅
- [x] Create MessagesContext
- [x] Create ToolsContext
- [x] Create FocusModeContext
- [x] Create useMessagesState custom hook
- [x] Create MessageContainer layout wrapper
- [x] Create context index exports

### In Progress 🟡
- [ ] Extract MessageListView component
- [ ] Extract ConversationView component
- [ ] Extract MessageComposer component
- [ ] Migrate state from Messages.tsx to contexts
- [ ] Add React.memo to expensive components

### Todo 🔲
- [ ] Add virtualization for message lists
- [ ] Implement lazy loading for heavy components
- [ ] Add performance monitoring
- [ ] Create unit tests for contexts and hooks
- [ ] Create integration tests for message flows
- [ ] Document component API
- [ ] Add Storybook stories for components

## Testing Strategy

### Unit Tests
```typescript
describe('MessagesContext', () => {
  it('should load threads on mount', async () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: MessagesProvider,
    });

    await waitFor(() => {
      expect(result.current.threads.length).toBeGreaterThan(0);
    });
  });

  it('should send pulse message', async () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: MessagesProvider,
    });

    await act(async () => {
      await result.current.sendPulseMessage('conv-123', 'Hello!');
    });

    expect(result.current.pulseMessages).toContainEqual(
      expect.objectContaining({ content: 'Hello!' })
    );
  });
});
```

### Integration Tests
```typescript
describe('Messages Component', () => {
  it('should display thread list and conversation', async () => {
    render(
      <MessagesProvider>
        <ToolsProvider>
          <Messages />
        </ToolsProvider>
      </MessagesProvider>
    );

    // Assert thread list is visible
    expect(screen.getByText(/conversations/i)).toBeInTheDocument();

    // Select a thread
    const thread = await screen.findByText(/Test Thread/i);
    fireEvent.click(thread);

    // Assert conversation is displayed
    expect(screen.getByText(/Test message content/i)).toBeInTheDocument();
  });
});
```

## Performance Metrics

### Before Refactoring
- Component size: 327.9 KB
- Lines of code: 6078
- State variables: 80+
- Render time: ~150ms (estimated)
- Re-render frequency: High (many state updates)

### Target After Refactoring
- Largest component: <100 KB
- Average component size: 20-50 KB
- State variables per component: <15
- Render time: <50ms
- Re-render frequency: Low (optimized with memo)

## Next Steps

1. **Extract MessageListView component** (Priority: High)
   - Move thread list rendering logic
   - Add search and filter functionality
   - Implement virtualization for long lists

2. **Extract ConversationView component** (Priority: High)
   - Move message rendering logic
   - Add reaction and reply handlers
   - Optimize message list performance

3. **Extract MessageComposer component** (Priority: High)
   - Move message input logic
   - Add AI suggestions integration
   - Implement draft auto-save

4. **Add Performance Optimizations** (Priority: Medium)
   - Implement React.memo throughout
   - Add useMemo for computed values
   - Add useCallback for event handlers
   - Implement virtualization

5. **Add Tests** (Priority: Medium)
   - Unit tests for contexts
   - Unit tests for custom hooks
   - Integration tests for message flows
   - E2E tests for critical paths

## Resources

- [React Context Documentation](https://react.dev/reference/react/useContext)
- [React.memo Documentation](https://react.dev/reference/react/memo)
- [useMemo Documentation](https://react.dev/reference/react/useMemo)
- [useCallback Documentation](https://react.dev/reference/react/useCallback)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)

---

**Last Updated**: 2026-01-19
**Status**: Phase 7 In Progress
**Next Review**: After MessageListView extraction
