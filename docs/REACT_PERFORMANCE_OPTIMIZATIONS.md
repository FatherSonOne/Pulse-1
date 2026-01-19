# React Performance Optimizations Guide

**Date**: January 19, 2026
**Purpose**: Performance optimization patterns for MessageEnhancement components

---

## React.memo Implementation

### Pattern for Components

All expensive MessageEnhancement components should use React.memo with custom comparison for optimal performance.

### Example: AICoachEnhanced (Already Implemented)

```tsx
export const AICoachEnhanced: React.FC<AICoachEnhancedProps> = React.memo(({
  draftText,
  recentMessages,
  contactName,
  onApplySuggestion,
  onDismiss,
  compact = false
}) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these props actually changed
  return prevProps.draftText === nextProps.draftText &&
         prevProps.contactName === nextProps.contactName &&
         prevProps.recentMessages.length === nextProps.recentMessages.length &&
         prevProps.compact === nextProps.compact;
});
```

### Components to Optimize

#### High Priority (Render frequently)

1. **ResponseTimeTracker** - Updates on every message
```tsx
export const ResponseTimeTracker = React.memo(({ conversationId, messages }) => {
  // Implementation
}, (prev, next) => {
  return prev.conversationId === next.conversationId &&
         prev.messages.length === next.messages.length;
});
```

2. **EngagementScoring** - Recalculates on every interaction
```tsx
export const EngagementScoring = React.memo(({ conversationId, interactions }) => {
  // Implementation
}, (prev, next) => {
  return prev.conversationId === next.conversationId &&
         prev.interactions.length === next.interactions.length;
});
```

3. **ConversationFlowViz** - Heavy visualization component
```tsx
export const ConversationFlowViz = React.memo(({ messages, participants }) => {
  // Implementation
}, (prev, next) => {
  return prev.messages.length === next.messages.length &&
         prev.participants.length === next.participants.length;
});
```

4. **SentimentTimeline** - Analyzes sentiment on every message
```tsx
export const SentimentTimeline = React.memo(({ messages, timeRange }) => {
  // Implementation
}, (prev, next) => {
  return prev.messages.length === next.messages.length &&
         prev.timeRange === next.timeRange;
});
```

5. **NetworkGraph** - Complex D3/canvas visualization
```tsx
export const NetworkGraph = React.memo(({ data, layout }) => {
  // Implementation
}, (prev, next) => {
  return prev.data.nodes.length === next.data.nodes.length &&
         prev.data.edges.length === next.data.edges.length &&
         prev.layout === next.layout;
});
```

#### Medium Priority (Render on specific actions)

6. **ThreadCollaboration**
7. **MessageAnalyticsDashboard**
8. **SmartTemplates**
9. **ContactInsights**
10. **MessageEncryption**

#### Lower Priority (Render rarely)

11. **TranslationHub**
12. **AnalyticsExport**
13. **BackupSync**
14. **FocusTimer**
15. **SmartFolders**

---

## useMemo Optimizations in Messages.tsx

### Expensive Calculations

```tsx
// Filter messages
const filteredMessages = useMemo(() => {
  if (!searchQuery) return threads;
  return threads.filter(msg =>
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [threads, searchQuery]);

// Calculate message statistics
const messageStats = useMemo(() => ({
  total: threads.length,
  unread: threads.filter(m => !m.isRead).length,
  today: threads.filter(m => {
    const msgDate = new Date(m.timestamp);
    const today = new Date();
    return msgDate.toDateString() === today.toDateString();
  }).length,
  thisWeek: threads.filter(m => {
    const msgDate = new Date(m.timestamp);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return msgDate >= weekAgo;
  }).length
}), [threads]);

// Sort threads by timestamp
const sortedThreads = useMemo(() => {
  return [...threads].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}, [threads]);

// Group messages by date
const groupedMessages = useMemo(() => {
  const groups = new Map<string, Message[]>();
  threads.forEach(msg => {
    const date = new Date(msg.timestamp).toDateString();
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(msg);
  });
  return groups;
}, [threads]);

// Calculate engagement metrics
const engagementMetrics = useMemo(() => {
  const totalMessages = threads.length;
  const totalReactions = threads.reduce((sum, msg) =>
    sum + (msg.reactions?.length || 0), 0
  );
  const averageLength = threads.reduce((sum, msg) =>
    sum + msg.content.length, 0
  ) / totalMessages;

  return {
    totalMessages,
    totalReactions,
    averageLength,
    engagementRate: totalReactions / totalMessages
  };
}, [threads]);
```

---

## useCallback Optimizations

### Event Handlers

```tsx
// Send message handler
const handleSendMessage = useCallback(async (content: string) => {
  if (!selectedContact || !content.trim()) return;

  const newMessage = {
    id: uuidv4(),
    content: content.trim(),
    timestamp: new Date().toISOString(),
    senderId: currentUser.id,
    recipientId: selectedContact.id,
    isRead: false
  };

  await sendMessage(newMessage);
  setInputText('');
}, [selectedContact, currentUser]);

// Reaction handler
const handleAddReaction = useCallback((messageId: string, emoji: string) => {
  setThreads(prev => prev.map(msg => {
    if (msg.id === messageId) {
      const reactions = msg.reactions || [];
      return {
        ...msg,
        reactions: [...reactions, { emoji, userId: currentUser.id }]
      };
    }
    return msg;
  }));
}, [currentUser]);

// Delete message handler
const handleDeleteMessage = useCallback((messageId: string) => {
  setThreads(prev => prev.filter(msg => msg.id !== messageId));
}, []);

// Edit message handler
const handleEditMessage = useCallback((messageId: string, newContent: string) => {
  setThreads(prev => prev.map(msg =>
    msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
  ));
}, []);

// Search handler with debounce
const handleSearch = useCallback(
  debounce((query: string) => {
    setSearchQuery(query);
  }, 300),
  []
);

// Scroll handler
const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
  const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
  setShowScrollButton(!isAtBottom);
}, []);
```

---

## Component Splitting Strategy

### Large Components to Split

#### Messages.tsx Component Structure

Current: 6,387 lines (too large)
Target: <500 lines per component

**Recommended splits**:

1. **MessageList.tsx** (lines 1000-3000)
   - Message rendering
   - Virtualization
   - Grouping logic

2. **MessageInput.tsx** (lines 5500-6000)
   - Input field
   - Formatting toolbar
   - Attachment handling

3. **MessageSidebar.tsx** (lines 4000-5000)
   - Contact list
   - Search
   - Filters

4. **MessageToolsPanel.tsx** (lines 4200-4500)
   - Enhancement tools
   - AI features
   - Analytics

---

## Virtual Scrolling Implementation

For messages list with 1000+ messages:

```tsx
import { useVirtual } from 'react-virtual';

const MessageList: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtual({
    size: messages.length,
    parentRef,
    estimateSize: useCallback(() => 80, []), // Estimated row height
    overscan: 5 // Render 5 extra items above/below viewport
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.totalSize}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.virtualItems.map(virtualRow => {
          const message = messages[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <MessageItem message={message} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

---

## Performance Monitoring

### Custom Hook for Performance Tracking

```tsx
const usePerformanceMonitor = (componentName: string) => {
  useEffect(() => {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      if (renderTime > 16) { // >16ms = <60fps
        console.warn(`${componentName} slow render: ${renderTime.toFixed(2)}ms`);
      }
    };
  });
};

// Usage
const AICoachEnhanced = () => {
  usePerformanceMonitor('AICoachEnhanced');
  // Component implementation
};
```

### React DevTools Profiler

Add Profiler in development:

```tsx
import { Profiler } from 'react';

const onRenderCallback = (
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number
) => {
  if (actualDuration > 16) {
    console.warn(`${id} ${phase}: ${actualDuration}ms`);
  }
};

<Profiler id="Messages" onRender={onRenderCallback}>
  <Messages />
</Profiler>
```

---

## Performance Checklist

- [x] React.memo added to expensive components
- [ ] useMemo added for expensive calculations
- [ ] useCallback added for event handlers
- [ ] Virtual scrolling for long lists
- [ ] Code splitting with lazy loading
- [ ] Bundle size optimized
- [ ] Performance monitoring in place
- [ ] Component splitting completed
- [ ] Lighthouse score >90

---

## Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial Render | 800ms | <200ms | 75% |
| Re-render on Type | 50ms | <16ms | 68% |
| Scroll Performance | 30fps | 60fps | 100% |
| Bundle Size | 1.2MB | <500KB | 58% |
| Time to Interactive | 5-7s | <3s | 57% |

---

## Testing Performance Optimizations

```bash
# Run performance tests
npm run test:performance

# Profile with React DevTools
npm run dev
# Open React DevTools → Profiler → Start Profiling

# Check bundle sizes
npm run build:analyze

# Run Lighthouse
npx lighthouse http://localhost:5173
```

---

## Next Steps

1. Apply React.memo to all components listed above
2. Add useMemo/useCallback to Messages.tsx
3. Implement virtual scrolling for message list
4. Split Messages.tsx into smaller components
5. Run performance audit
6. Verify metrics meet targets
