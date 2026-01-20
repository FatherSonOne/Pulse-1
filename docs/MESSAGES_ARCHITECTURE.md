# Pulse Messages - System Architecture

**Version**: 1.0
**Last Updated**: 2026-01-19
**Status**: Production Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Patterns](#architecture-patterns)
4. [Component Architecture](#component-architecture)
5. [State Management](#state-management)
6. [Data Flow](#data-flow)
7. [Real-Time Communication](#real-time-communication)
8. [AI Integration](#ai-integration)
9. [CRM Integration](#crm-integration)
10. [Performance Architecture](#performance-architecture)
11. [Security Architecture](#security-architecture)
12. [Scalability Considerations](#scalability-considerations)
13. [Future Architecture](#future-architecture)

---

## Executive Summary

Pulse Messages is a comprehensive, real-time messaging platform built with React, TypeScript, and Supabase. The system features:

- **126 components** organized into 10 feature bundles
- **39 AI and productivity tools** across 4 categories
- **Real-time messaging** via Supabase subscriptions
- **Multi-platform CRM integration** (HubSpot, Salesforce, Pipedrive, Zoho)
- **AI-powered features** using Google Gemini
- **Split-view layout** with thread list and conversation panels
- **Context-based state management** for scalability

### Key Metrics

- **Component Count**: 126 components
- **Tool Count**: 39 tools
- **State Management**: 4 React Contexts + Zustand store
- **Real-Time Channels**: WebSocket via Supabase
- **API Endpoints**: 15+ core services
- **Bundle Size**: <500KB initial load

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Desktop    │  │    Tablet    │  │       Mobile         │  │
│  │  (>1024px)   │  │ (768-1024px) │  │      (<768px)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER (React)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Messages Split-View Layout                    │ │
│  │  ┌──────────────────┐  ┌──────────────────────────────┐  │ │
│  │  │ ThreadListPanel  │  │    ConversationPanel         │  │ │
│  │  │     (30%)        │  │         (70%)                │  │ │
│  │  │                  │  │                              │  │ │
│  │  │ - Thread Items   │  │ - Message Bubbles            │  │ │
│  │  │ - Search Bar     │  │ - Reactions                  │  │ │
│  │  │ - Pinned Section │  │ - Threading                  │  │ │
│  │  └──────────────────┘  └──────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    10 Feature Bundles                      │ │
│  │  - BundleAI            - BundleAnalytics                   │ │
│  │  - BundleCollaboration - BundleProductivity                │ │
│  │  - BundleIntelligence  - BundleProactive                   │ │
│  │  - BundleCommunication - BundleAutomation                  │ │
│  │  - BundleSecurity      - BundleMultimedia                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      Tools Panel (39 Tools)                │ │
│  │  - AI Tools (9)        - Content Creation (11)             │ │
│  │  - Analysis (10)       - Utilities (9)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT LAYER                        │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │MessagesContext │  │  ToolsContext  │  │ FocusModeContext│  │
│  │                │  │                │  │                 │  │
│  │- Threads       │  │- Active Tool   │  │- Timer State    │  │
│  │- Messages      │  │- Panel States  │  │- Pomodoro       │  │
│  │- Reactions     │  │- Tab States    │  │- Breaks         │  │
│  └────────────────┘  └────────────────┘  └─────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Zustand Store (messageStore)                │  │
│  │  - Channel management    - Search & filters              │  │
│  │  - Real-time subscriptions - AI features                 │  │
│  │  - Optimistic updates    - Auto-response rules           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                              │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐ │
│  │ messageChannel   │  │ geminiService  │  │   crmService    │ │
│  │    Service       │  │                │  │                 │ │
│  │ (997 lines)      │  │ (AI features)  │  │ (Multi-CRM)     │ │
│  └────────┬─────────┘  └───────┬────────┘  └────────┬────────┘ │
│           │                    │                    │          │
│  ┌────────┴──────────────┬─────┴────────┬───────────┴────────┐ │
│  │conversationIntel.     │messageSumm.  │messageAutoResp.    │ │
│  │Service                │Service       │Service             │ │
│  └───────────────────────┴──────────────┴────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │   Supabase   │  │ Google Gemini│  │  CRM Platforms      │  │
│  │  PostgreSQL  │  │  1.5 Flash   │  │  (HubSpot, SF, etc) │  │
│  │  + Realtime  │  │              │  │                     │  │
│  └──────────────┘  └──────────────┘  └─────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Database Tables                       │  │
│  │  - message_channels      - channel_messages              │  │
│  │  - channel_members       - message_interactions          │  │
│  │  - crm_integrations      - crm_sync_logs                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Patterns

### 1. Component-Based Architecture

**Pattern**: Modular, reusable components organized by feature

**Structure**:
```
src/components/
├── Messages/                    # Core messaging
│   ├── MessagesSplitView.tsx   # Main layout
│   ├── ThreadListPanel.tsx     # Thread list
│   ├── ConversationPanel.tsx   # Messages
│   ├── ThreadItem.tsx          # Individual thread
│   └── ThreadSearch.tsx        # Search
├── MessageEnhancements/         # Feature bundles
│   ├── Bundle*.tsx             # 10 bundles
│   ├── AnimatedReactions.tsx   # Reactions
│   ├── HoverReactionTrigger.tsx # Hover system
│   └── MessageThreading.tsx    # Threading
└── ToolsPanel/                  # Tools system
    ├── ToolsPanel.tsx          # Main panel
    ├── ToolCard.tsx            # Tool cards
    └── toolsData.ts            # Tool registry
```

**Benefits**:
- Easy to test in isolation
- Reusable across features
- Clear separation of concerns
- Maintainable codebase

### 2. Context-Based State Management

**Pattern**: React Context API for global state, custom hooks for local state

**Implementation**:
```typescript
// Global contexts
<MessagesProvider>
  <ToolsProvider>
    <FocusModeProvider>
      <Messages />
    </FocusModeProvider>
  </ToolsProvider>
</MessagesProvider>

// Usage in components
const { threads, sendMessage } = useMessages();
const { togglePanel } = useTools();
const { startFocusMode } = useFocusMode();
```

**State Distribution**:
- **MessagesContext**: Core messaging (threads, messages, reactions)
- **ToolsContext**: Tool panels and features
- **FocusModeContext**: Focus mode timer
- **useMessagesState**: Local UI state and features
- **Zustand Store**: Complex async operations

### 3. Service Layer Pattern

**Pattern**: Separation of business logic from UI

**Services**:
- **messageChannelService.ts** (997 lines): Core messaging API
- **geminiService.ts**: AI integration
- **conversationIntelligenceService.ts**: AI analysis
- **messageSummarizationService.ts**: AI summaries
- **messageAutoResponseService.ts**: Auto-responses
- **crmService.ts**: CRM integration
- **crmActionsService.ts**: CRM actions

**Benefits**:
- Testable business logic
- Reusable across components
- Easy to mock for testing
- Clear API boundaries

### 4. Real-Time Event-Driven Architecture

**Pattern**: WebSocket subscriptions for real-time updates

**Implementation**:
```typescript
// Subscribe to channel messages
supabase.channel(`messages:${channelId}`)
  .on('INSERT', handleNewMessage)
  .on('UPDATE', handleMessageUpdate)
  .on('DELETE', handleMessageDelete)
  .subscribe();

// Subscribe to typing indicators
supabase.channel(`typing:${channelId}`)
  .on('BROADCAST', handleTypingIndicator)
  .subscribe();
```

**Benefits**:
- Instant updates across clients
- No polling required
- Scalable to many users
- Built-in reconnection

### 5. Optimistic UI Updates

**Pattern**: Update UI immediately, sync with server

**Flow**:
```typescript
// 1. Optimistic update
const tempMessage = { ...message, id: 'temp-' + Date.now() };
dispatch({ type: 'ADD_PENDING_MESSAGE', message: tempMessage });

// 2. Send to server
try {
  const realMessage = await sendMessage(message);
  dispatch({ type: 'REPLACE_MESSAGE', tempId: tempMessage.id, message: realMessage });
} catch (error) {
  dispatch({ type: 'MARK_FAILED', tempId: tempMessage.id });
}
```

**Benefits**:
- Perceived instant response
- Better UX on slow connections
- Graceful error handling
- Retry mechanism

---

## Component Architecture

### Core Components

#### 1. MessagesSplitView

**Purpose**: Main layout orchestrator

**Responsibilities**:
- Layout management (30/70 split)
- Responsive breakpoints
- Keyboard shortcuts
- Mobile view toggle

**Props**:
```typescript
interface MessagesSplitViewProps {
  channels: MessageChannel[];
  messages: Record<string, ChannelMessage[]>;
  currentUserId: string;
  onSendMessage: (channelId: string, content: string) => Promise<void>;
  onAddReaction: (messageId: string, emoji: string) => Promise<void>;
}
```

#### 2. ThreadListPanel

**Purpose**: Display and filter thread list

**Responsibilities**:
- Thread list rendering
- Pinned threads section
- Search integration
- Thread selection

**Features**:
- Real-time updates
- Unread badges
- Last message preview
- Relative timestamps

#### 3. ConversationPanel

**Purpose**: Display messages for active thread

**Responsibilities**:
- Message list rendering
- Date grouping
- Auto-scroll to latest
- Loading states

**Features**:
- Message bubbles
- Reaction badges
- Thread replies
- Sender avatars

#### 4. HoverReactionTrigger

**Purpose**: Hover/long-press reaction system

**Responsibilities**:
- Hover detection (300ms delay)
- Long-press detection (500ms)
- Smart positioning
- Haptic feedback

**Features**:
- Desktop hover support
- Mobile long-press
- Keyboard navigation
- Accessibility

### Feature Bundles (10 Bundles)

#### Bundle Organization

Each bundle contains 12-16 components organized by feature area:

1. **BundleAI** (13 components)
   - SmartCompose, AICoach, Translation, Voice Context

2. **BundleAnalytics** (16 components)
   - Engagement Scoring, Response Time, Flow Viz, Achievements

3. **BundleCollaboration** (13 components)
   - Threading, Pinning, Annotations, Knowledge Base

4. **BundleProductivity** (14 components)
   - Templates, Scheduling, Summaries, Keyboard Shortcuts

5. **BundleIntelligence** (16 components)
   - Bookmarks, Tags, Read Receipts, Command Palette

6. **BundleProactive** (12 components)
   - Smart Reminders, Sentiment Timeline, Contact Groups

7. **BundleCommunication** (14 components)
   - Voice Messages, Quick Replies, Priority Inbox

8. **BundleAutomation** (14 components)
   - Auto-Responses, Draft Manager, Formatting Toolbar

9. **BundleSecurity** (12 components)
   - Encryption, Versioning, Focus Timer, Smart Folders

10. **BundleMultimedia** (12 components)
    - Attachments, Backup/Sync, Export, ToolOverlay

### Tools System

#### ToolsPanel Architecture

**Component Hierarchy**:
```
ToolsPanel
├── CategoryTabs (4 categories)
├── SearchBox (fuzzy search)
├── ContextualSuggestions (time-based)
├── QuickAccessBar (recent/pinned)
└── ToolCard[] (39 tools)
```

**Tool Categories**:
1. **AI Tools** (9 tools): AI Coach, Smart Compose, Sentiment Analysis
2. **Content Creation** (11 tools): Templates, Voice Recorder, Formatting
3. **Analysis** (10 tools): Engagement Scoring, Response Time Analytics
4. **Utilities** (9 tools): Search, Pinning, Keyboard Shortcuts

**Storage**: LocalStorage-based usage tracking with recent/pinned tools

---

## State Management

### Context Providers

#### MessagesContext

**State Variables** (30+):
```typescript
{
  // SMS Legacy
  threads: Thread[];
  activeThreadId: string;

  // Pulse Conversations
  pulseConversations: PulseConversation[];
  activePulseConversation: PulseConversation | null;

  // Messaging
  starredMessages: string[];
  replyingTo: ChannelMessage | null;

  // Search
  searchQuery: string;
  pulseUserSearchQuery: string;
  pulseUserSearchResults: PulseUser[];

  // UI State
  showContactPanel: boolean;
  contextMenuPosition: { x: number; y: number };
  typingUsers: string[];
  mobileView: 'list' | 'chat';

  // Loading
  isLoading: boolean;
}
```

**Actions**:
- `loadThreads()`, `loadPulseMessages()`
- `sendPulseMessage()`, `addReactionToPulseMessage()`
- `toggleStarPulseMessage()`, `setReplyingTo()`

#### ToolsContext

**State Variables** (40+):
```typescript
{
  // Active Tool
  activeToolOverlay: string | null;

  // Panel States (9 panels)
  showAnalyticsPanel: boolean;
  showCollaborationPanel: boolean;
  showProductivityPanel: boolean;
  // ... 6 more panels

  // Tab States (45+ tabs)
  analyticsTab: string;
  collaborationTab: string;
  // ... 7 more tab states

  // AI Features
  showAICoach: boolean;
  showAIMediator: boolean;
  showVoiceExtractor: boolean;
  showQuickPhrases: boolean;

  // Advanced Features
  showMeetingDeflector: boolean;
  showTaskExtractor: boolean;
  showChannelArtifactPanel: boolean;
  showIntentComposer: boolean;

  // Other
  showCommandPalette: boolean;
  showContextPanel: boolean;
}
```

**Actions**:
- `closeAllPanels()`, `togglePanel()`, `openPanel()`

#### FocusModeContext

**State Variables** (10+):
```typescript
{
  isFocusModeActive: boolean;
  focusDuration: number; // 25 minutes default
  focusTimeRemaining: number;
  isPaused: boolean;
  focusProgress: number; // 0-100%
  breakCount: number;
  lastFocusStart: Date | null;
}
```

**Actions**:
- `startFocusMode()`, `stopFocusMode()`
- `pauseFocusMode()`, `resumeFocusMode()`
- `resetFocusMode()`, `setTimerDuration()`

#### Zustand Store (messageStore)

**State Variables** (85+ variables):
```typescript
{
  // Core Data
  channels: MessageChannel[];
  selectedChannelId: string | null;
  messages: Record<string, ChannelMessage[]>;
  members: Record<string, ChannelMember[]>;

  // UI State
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  // Real-Time
  typingUsers: Record<string, TypingIndicator[]>;

  // Search
  searchQuery: string;
  searchResults: ChannelMessage[];
  searchFilters: SearchFilters;

  // AI Features
  smartReplies: string[];
  draftAnalysis: DraftAnalysis | null;
  conversationIntelligence: ConversationIntelligence | null;

  // Summarization
  threadSummaries: Record<string, ThreadSummary>;
  dailyDigest: DailyDigest | null;
  catchUpSummary: CatchUpSummary | null;

  // Auto-Response
  autoResponseRules: AutoResponseRule[];
  autoResponseEnabled: boolean;

  // Optimistic Updates
  pendingMessages: ChannelMessage[];
  failedMessages: ChannelMessage[];
}
```

**Actions** (85+ methods):
- Channel management (10 actions)
- Message operations (15 actions)
- Search & discovery (8 actions)
- AI integration (12 actions)
- Real-time updates (6 actions)
- UI state management (10+ actions)

---

## Data Flow

### Message Send Flow

```
1. User Input
   └─> MessageInput component

2. Validation
   └─> Character limit check (2000 chars)
   └─> Content validation

3. Optimistic Update
   └─> Add temp message to UI
   └─> Show sending indicator

4. API Call
   └─> messageChannelService.sendMessage()
   └─> Supabase INSERT

5. Real-Time Broadcast
   └─> Supabase broadcasts to subscribers
   └─> Other clients receive update

6. Confirmation
   └─> Replace temp message with real message
   └─> Update UI with server ID

7. Error Handling
   └─> On failure: Mark message as failed
   └─> Show retry button
   └─> Allow manual retry
```

### Reaction Flow

```
1. User Action
   └─> Hover over message (300ms)
   └─> OR long-press (500ms mobile)

2. Show Reaction Bar
   └─> HoverReactionTrigger
   └─> QuickReactionBar appears

3. Select Emoji
   └─> Click/tap emoji

4. Optimistic Update
   └─> Add reaction to UI immediately
   └─> Animate floating emoji

5. API Call
   └─> messageChannelService.addReaction()
   └─> Supabase INSERT into message_interactions

6. Real-Time Broadcast
   └─> Other clients receive update
   └─> Reaction count incremented

7. Confirmation
   └─> Persist reaction to database
   └─> Update reaction counts
```

### Real-Time Update Flow

```
1. Server Event
   └─> New message, reaction, or edit
   └─> Supabase broadcasts event

2. WebSocket Subscription
   └─> Client receives event
   └─> Event type: INSERT, UPDATE, DELETE

3. State Update
   └─> Dispatch action to store
   └─> Update relevant state

4. UI Re-render
   └─> React re-renders affected components
   └─> Animations triggered

5. Notification (if needed)
   └─> Browser notification
   └─> Sound alert
   └─> Badge update
```

---

## Real-Time Communication

### Supabase Realtime Architecture

**Protocol**: PostgreSQL + PostgREST + WebSocket

**Channels**:

1. **Message Channel**: `messages:${channelId}`
   - Events: INSERT, UPDATE, DELETE
   - Payload: Full message object
   - Use case: New messages, edits, deletions

2. **Typing Channel**: `typing:${channelId}`
   - Events: BROADCAST
   - Payload: { userId, userName, isTyping }
   - Use case: Typing indicators
   - Timeout: 1 second auto-cleanup

3. **Full Channel**: `channel-full:${channelId}`
   - Events: All channel changes
   - Payload: Complete channel state
   - Use case: Member joins/leaves, metadata changes

### Subscription Management

**Lifecycle**:
```typescript
// Subscribe on mount
useEffect(() => {
  const subscription = supabase
    .channel(`messages:${channelId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'channel_messages',
      filter: `channel_id=eq.${channelId}`
    }, handleNewMessage)
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [channelId]);
```

**Features**:
- Automatic reconnection on disconnect
- Exponential backoff retry
- Error handling
- Cleanup on unmount

### Typing Indicators

**Implementation**:
```typescript
// Debounced typing broadcast
const debouncedTyping = debounce(() => {
  supabase.channel(`typing:${channelId}`)
    .send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, userName, isTyping: true }
    });
}, 300);

// Auto-cleanup after 1 second
setTimeout(() => {
  supabase.channel(`typing:${channelId}`)
    .send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, userName, isTyping: false }
    });
}, 1000);
```

---

## AI Integration

### Google Gemini Integration

**Model**: Gemini 1.5 Flash

**Features**:
1. **Smart Compose**: AI-powered message suggestions
2. **Draft Analysis**: Intent detection and tone analysis
3. **Sentiment Analysis**: Emotion detection
4. **Topic Detection**: Conversation categorization
5. **Translation**: Multi-language support
6. **Summarization**: Thread and daily summaries

**Service Architecture**:
```typescript
// Core AI method
async function processWithModel(
  prompt: string,
  model?: string,
  temperature?: number
): Promise<string> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, temperature })
  });

  return response.json();
}
```

### Conversation Intelligence

**Service**: conversationIntelligenceService.ts

**Features**:
- Sentiment analysis (positive/neutral/negative/mixed)
- Topic detection with confidence scores
- Engagement metrics (response time, message velocity)
- Participant engagement tracking
- 5-minute cache for real-time analysis

**Return Type**:
```typescript
{
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative' | 'mixed',
    score: number, // -1 to 1
    distribution: { positive: %, neutral: %, negative: % }
  },
  topics: Array<{ name: string, confidence: number }>,
  engagement: {
    totalMessages: number,
    responseTime: { avg: number, median: number },
    messageVelocity: number // messages per hour
  },
  participants: Array<{
    userId: string,
    messageCount: number,
    engagementScore: number
  }>
}
```

### Message Summarization

**Service**: messageSummarizationService.ts

**Capabilities**:
- **Thread summaries**: Key points + action items
- **Daily digest**: Aggregation of day's activity
- **Catch-up summaries**: For users returning after absence
- **Cache**: 10-minute TTL

**Example**:
```typescript
const summary = await summarizeThread(threadId);
// Returns:
{
  threadId: string,
  summary: string,
  keyPoints: string[],
  actionItems: string[],
  participants: string[],
  generatedAt: string
}
```

---

## CRM Integration

### Multi-Platform Support

**Platforms**:
1. **HubSpot** (OAuth 2.0 + REST API)
2. **Salesforce** (OAuth 2.0 + REST API)
3. **Pipedrive** (OAuth + API Key + REST API)
4. **Zoho CRM** (OAuth 2.0 + REST API)

**Features**:
- Bi-directional sync
- Contact/lead creation from messages
- Deal/opportunity tracking
- Activity logging
- Task creation
- Webhook subscriptions

### CRM Service Architecture

**Service**: crmService.ts (300 lines)

**Platform Services**:
- hubspotService.ts
- salesforceService.ts
- pipedriveService.ts
- zohoService.ts

**Common Interface**:
```typescript
interface CRMService {
  authorize(): Promise<string>; // OAuth URL
  exchangeToken(code: string): Promise<TokenResponse>;
  getContacts(params?: QueryParams): Promise<Contact[]>;
  createContact(data: ContactData): Promise<Contact>;
  updateContact(id: string, data: Partial<ContactData>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  searchContacts(query: string): Promise<Contact[]>;
}
```

### Message-CRM Linking

**Implementation**:
```typescript
interface ChannelMessage {
  // ... standard fields
  linkedChatId?: string;
  linkedChannelId?: string;
  crmMetadata?: {
    platform: 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho';
    entityType: 'contact' | 'deal' | 'task';
    entityId: string;
  };
}
```

---

## Performance Architecture

### Optimization Strategies

#### 1. Code Splitting

**Bundle Strategy**:
- Main bundle: Core components (<300KB)
- Feature bundles: Lazy-loaded on demand
- Tool bundles: Loaded when panel opens
- CRM bundles: Loaded when integrated

**Implementation**:
```typescript
const BundleAI = lazy(() => import('./MessageEnhancements/BundleAI'));
const ToolsPanel = lazy(() => import('./ToolsPanel/ToolsPanel'));

<Suspense fallback={<Spinner />}>
  <BundleAI />
</Suspense>
```

#### 2. Memoization

**Components**:
```typescript
const MessageItem = React.memo(({ message, onReact }) => {
  return <div>{message.content}</div>;
}, (prevProps, nextProps) => {
  return prevProps.message.id === nextProps.message.id;
});
```

**Computed Values**:
```typescript
const sortedThreads = useMemo(() => {
  return threads.sort((a, b) =>
    new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
  );
}, [threads]);
```

**Callbacks**:
```typescript
const handleReaction = useCallback((messageId: string, emoji: string) => {
  addReaction(messageId, emoji);
}, [addReaction]);
```

#### 3. Virtualization

**List Virtualization** (react-window):
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={messages.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <MessageItem message={messages[index]} />
    </div>
  )}
</FixedSizeList>
```

#### 4. Debouncing

**Search**:
```typescript
const debouncedSearch = debounce((query: string) => {
  searchMessages(query);
}, 300);
```

**Typing Indicators**:
```typescript
const debouncedTyping = debounce(() => {
  broadcastTyping(true);
}, 1000);
```

### Performance Metrics

**Target Metrics**:
- Initial load: <2 seconds
- Thread switch: <300ms
- Message send: <100ms (optimistic)
- Search response: <100ms
- Scroll performance: 60fps
- Memory usage: <100MB

**Monitoring**:
- React DevTools Profiler
- Chrome Performance tab
- Lighthouse CI
- Real User Monitoring (RUM)

---

## Security Architecture

### Authentication

**Provider**: Supabase Auth

**Flow**:
```
1. User Login
   └─> Email/Password or OAuth
   └─> Supabase validates credentials

2. Token Generation
   └─> JWT access token (1 hour expiry)
   └─> Refresh token (30 days expiry)

3. Token Storage
   └─> httpOnly cookies (recommended)
   └─> OR localStorage (less secure)

4. Token Refresh
   └─> Automatic refresh before expiry
   └─> Silent token exchange

5. Session Management
   └─> Session stored in Supabase
   └─> Auto-logout on token expiry
```

### Authorization

**Row-Level Security (RLS)**:
```sql
-- Users can only see channels they're members of
CREATE POLICY "Channel visibility"
  ON message_channels
  FOR SELECT
  USING (
    id IN (
      SELECT channel_id
      FROM channel_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can only edit their own messages
CREATE POLICY "Message ownership"
  ON channel_messages
  FOR UPDATE
  USING (sender_id = auth.uid());
```

### Data Encryption

**At Rest**:
- Database: AES-256 encryption (Supabase default)
- File storage: AES-256 encryption
- Backups: Encrypted snapshots

**In Transit**:
- TLS 1.3 for all API calls
- WSS (WebSocket Secure) for real-time
- HTTPS enforced

**Client-Side**:
- Sensitive data encrypted before storage
- End-to-end encryption for messages (optional feature)

### API Security

**Rate Limiting**:
- 100 requests/minute per user
- 1000 requests/hour per user
- Exponential backoff on limit

**Input Validation**:
- XSS protection (DOMPurify)
- SQL injection prevention (parameterized queries)
- File type validation
- Size limits enforced

**CORS**:
```typescript
{
  origin: process.env.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}
```

---

## Scalability Considerations

### Horizontal Scaling

**Database**:
- Read replicas for query distribution
- Connection pooling (PgBouncer)
- Query optimization with indexes

**API**:
- Stateless service design
- Load balancer (Nginx/AWS ALB)
- Auto-scaling based on CPU/memory

**WebSocket**:
- Multiple WebSocket servers
- Redis pub/sub for cross-server messaging
- Sticky sessions for connection affinity

### Caching Strategy

**Levels**:
1. **Browser Cache**: Static assets (1 year)
2. **CDN Cache**: Images, fonts (1 month)
3. **Application Cache**: API responses (5 minutes)
4. **Database Cache**: Query results (configurable)

**Implementation**:
```typescript
// In-memory cache with TTL
const cache = new Map<string, { data: any; expiry: number }>();

function getCached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return Promise.resolve(cached.data);
  }

  return fetcher().then(data => {
    cache.set(key, { data, expiry: Date.now() + ttl });
    return data;
  });
}
```

### Database Optimization

**Indexes**:
```sql
-- Optimize channel message queries
CREATE INDEX idx_channel_messages_channel_id ON channel_messages(channel_id);
CREATE INDEX idx_channel_messages_created_at ON channel_messages(created_at DESC);
CREATE INDEX idx_channel_messages_sender_id ON channel_messages(sender_id);

-- Optimize search queries
CREATE INDEX idx_channel_messages_content_gin ON channel_messages USING GIN(to_tsvector('english', content));
```

**Partitioning**:
```sql
-- Partition messages by month
CREATE TABLE channel_messages_2026_01 PARTITION OF channel_messages
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### Load Testing

**Tools**:
- Apache JMeter for API load testing
- Artillery for WebSocket testing
- Lighthouse for frontend performance

**Scenarios**:
- 100 concurrent users sending messages
- 1000 users in single channel
- 10,000 messages in thread
- Real-time updates to 1000+ clients

---

## Future Architecture

### Planned Enhancements

#### 1. Microservices Migration

**Current**: Monolithic service layer
**Future**: Distributed microservices

**Services**:
- Message Service (core messaging)
- AI Service (all AI features)
- CRM Service (CRM integration)
- Notification Service (push notifications)
- Search Service (Elasticsearch integration)

#### 2. GraphQL API

**Current**: REST API
**Future**: GraphQL with subscriptions

**Benefits**:
- Flexible queries
- Reduced over-fetching
- Real-time subscriptions
- Type safety

#### 3. Offline-First Architecture

**Current**: Online-only
**Future**: Full offline support

**Implementation**:
- Service workers for caching
- IndexedDB for local storage
- Conflict resolution on sync
- Queue for pending operations

#### 4. Advanced AI Features

**Planned**:
- GPT-4 integration for complex tasks
- Custom fine-tuned models
- Voice-to-text with Whisper
- Image analysis with Vision models
- Code execution sandbox

#### 5. Enhanced Analytics

**Planned**:
- Real-time dashboard
- Custom reports
- Export to BI tools
- Predictive analytics
- Anomaly detection

---

## Appendix

### Technology Stack

**Frontend**:
- React 18
- TypeScript 5
- Tailwind CSS 3
- Framer Motion 10
- React Router 6

**State Management**:
- React Context API
- Zustand 4
- React Query (planned)

**Backend**:
- Supabase (PostgreSQL + Realtime + Auth + Storage)
- Node.js (for custom services)

**AI**:
- Google Gemini 1.5 Flash
- OpenAI GPT-4 (planned)

**CRM**:
- HubSpot API
- Salesforce API
- Pipedrive API
- Zoho CRM API

**Testing**:
- Jest
- React Testing Library
- Cypress (E2E)

**CI/CD**:
- GitHub Actions
- Vercel (deployment)

### Related Documentation

- [API Reference](./API_REFERENCE.md) - Backend API contracts
- [Component API](./COMPONENT_API.md) - Component prop documentation
- [Tools Integration](./TOOLS_INTEGRATION.md) - Tool wiring guide
- [Focus Mode](./FOCUS_MODE.md) - Focus feature documentation
- [User Guide](./USER_GUIDE.md) - Feature walkthroughs
- [Development Setup](./DEVELOPMENT_SETUP.md) - Local dev environment

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
**Maintained By**: Pulse Engineering Team
**License**: Proprietary
