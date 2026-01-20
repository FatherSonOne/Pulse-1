# Pulse Messages - API Reference

**Version**: 1.0
**Last Updated**: 2026-01-19
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Message Channel Service](#message-channel-service)
3. [AI Services](#ai-services)
4. [CRM Services](#crm-services)
5. [Real-Time Subscriptions](#real-time-subscriptions)
6. [Type Definitions](#type-definitions)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Overview

The Pulse Messages backend API provides comprehensive endpoints for messaging, AI integration, CRM connectivity, and real-time communication through Supabase.

### Base Configuration

```typescript
// Supabase Client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);
```

---

## Message Channel Service

**File**: `src/services/messageChannelService.ts` (997 lines)

### Channel Operations

#### getChannels

```typescript
async function getChannels(workspaceId: string): Promise<MessageChannel[]>
```

**Purpose**: Fetch all channels in a workspace

**Parameters**:
- `workspaceId`: Workspace ID

**Returns**: Array of MessageChannel objects

**Example**:
```typescript
const channels = await messageChannelService.getChannels('workspace-123');
```

#### getChannel

```typescript
async function getChannel(channelId: string): Promise<MessageChannel | null>
```

**Purpose**: Get single channel details

**Parameters**:
- `channelId`: Channel ID

**Returns**: MessageChannel or null

**Example**:
```typescript
const channel = await messageChannelService.getChannel('channel-456');
```

#### createChannel

```typescript
async function createChannel(data: {
  workspaceId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  isGroup: boolean;
  createdBy: string;
  memberIds?: string[];
}): Promise<MessageChannel>
```

**Purpose**: Create new channel (DM or group)

**Parameters**:
- `workspaceId`: Workspace ID
- `name`: Channel name
- `description`: Optional description
- `isPublic`: Public visibility
- `isGroup`: Group channel flag
- `createdBy`: Creator user ID
- `memberIds`: Initial member IDs

**Returns**: Created MessageChannel

**Example**:
```typescript
const channel = await messageChannelService.createChannel({
  workspaceId: 'workspace-123',
  name: 'Team Chat',
  isPublic: true,
  isGroup: true,
  createdBy: 'user-789',
  memberIds: ['user-789', 'user-456']
});
```

### Message Operations

#### getMessages

```typescript
async function getMessages(
  channelId: string,
  limit?: number,
  offset?: number
): Promise<ChannelMessage[]>
```

**Purpose**: Fetch messages with pagination

**Parameters**:
- `channelId`: Channel ID
- `limit`: Max messages (default: 50)
- `offset`: Skip messages (default: 0)

**Returns**: Array of ChannelMessage objects

**Example**:
```typescript
const messages = await messageChannelService.getMessages('channel-456', 50, 0);
```

#### sendMessage

```typescript
async function sendMessage(data: {
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType?: 'text' | 'system' | 'file';
  attachments?: MessageAttachment[];
  threadId?: string;
}): Promise<ChannelMessage>
```

**Purpose**: Send new message to channel

**Parameters**: Message data object

**Returns**: Created ChannelMessage

**Example**:
```typescript
const message = await messageChannelService.sendMessage({
  channelId: 'channel-456',
  senderId: 'user-789',
  senderName: 'John Doe',
  content: 'Hello world!',
  messageType: 'text'
});
```

#### addReaction

```typescript
async function addReaction(
  messageId: string,
  emoji: string,
  userId: string
): Promise<void>
```

**Purpose**: Add emoji reaction to message

**Parameters**:
- `messageId`: Message ID
- `emoji`: Emoji character
- `userId`: User ID

**Example**:
```typescript
await messageChannelService.addReaction('msg-123', '👍', 'user-789');
```

---

## AI Services

### Gemini Service

**File**: `src/services/geminiService.ts`

#### generateSmartReplies

```typescript
async function generateSmartReplies(
  messageContent: string,
  conversationContext?: string[]
): Promise<string[]>
```

**Purpose**: Generate AI-powered message suggestions

**Parameters**:
- `messageContent`: Current message
- `conversationContext`: Previous messages

**Returns**: Array of suggested replies (3)

**Example**:
```typescript
const replies = await geminiService.generateSmartReplies(
  'What time works for you?',
  ['Let\'s schedule a meeting', 'How about next week?']
);
// Returns: ['2pm tomorrow works', 'Wednesday afternoon?', 'Let me check my calendar']
```

#### analyzeDraftIntent

```typescript
async function analyzeDraftIntent(
  draft: string
): Promise<{
  intent: string;
  tone: 'professional' | 'casual' | 'urgent';
  suggestions: string[];
}>
```

**Purpose**: Analyze draft message intent and tone

**Parameters**:
- `draft`: Draft message text

**Returns**: Analysis object

**Example**:
```typescript
const analysis = await geminiService.analyzeDraftIntent(
  'Can we please discuss the budget ASAP?'
);
// Returns: { intent: 'request_meeting', tone: 'urgent', suggestions: [...] }
```

### Conversation Intelligence Service

**File**: `src/services/conversationIntelligenceService.ts`

#### analyzeConversation

```typescript
async function analyzeConversation(
  channelId: string
): Promise<ConversationIntelligence>
```

**Purpose**: Get comprehensive conversation analysis

**Parameters**:
- `channelId`: Channel ID

**Returns**: ConversationIntelligence object

**Example**:
```typescript
const intelligence = await conversationIntelligenceService.analyzeConversation('channel-456');
// Returns: { sentiment, topics, engagement, participants }
```

### Message Summarization Service

**File**: `src/services/messageSummarizationService.ts`

#### summarizeThread

```typescript
async function summarizeThread(
  threadId: string
): Promise<ThreadSummary>
```

**Purpose**: Generate thread summary with key points

**Parameters**:
- `threadId`: Thread ID

**Returns**: ThreadSummary object

**Example**:
```typescript
const summary = await messageSummarizationService.summarizeThread('thread-123');
// Returns: { summary, keyPoints, actionItems, participants }
```

---

## CRM Services

### CRM Service

**File**: `src/services/crmService.ts`

#### Platform-Specific Methods

**HubSpot**:
```typescript
const hubspot = await crmService.getIntegration('hubspot');
const contacts = await hubspot.getContacts({ limit: 50 });
const contact = await hubspot.createContact({
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe'
});
```

**Salesforce**:
```typescript
const salesforce = await crmService.getIntegration('salesforce');
const leads = await salesforce.getLeads({ status: 'Open' });
const opportunity = await salesforce.createOpportunity({
  name: 'Q4 Deal',
  amount: 50000,
  closeDate: '2026-12-31'
});
```

---

## Real-Time Subscriptions

### Message Subscriptions

```typescript
// Subscribe to channel messages
const subscription = supabase
  .channel(`messages:${channelId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'channel_messages',
    filter: `channel_id=eq.${channelId}`
  }, (payload) => {
    console.log('New message:', payload.new);
  })
  .subscribe();

// Cleanup
subscription.unsubscribe();
```

### Typing Indicators

```typescript
// Subscribe to typing events
supabase
  .channel(`typing:${channelId}`)
  .on('broadcast', { event: 'typing' }, (payload) => {
    console.log('User typing:', payload);
  })
  .subscribe();

// Broadcast typing
supabase
  .channel(`typing:${channelId}`)
  .send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId, isTyping: true }
  });
```

---

## Type Definitions

### MessageChannel

```typescript
interface MessageChannel {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  unread_count?: number;
  last_message?: string;
  last_message_at?: string;
  members?: ChannelMember[];
}
```

### ChannelMessage

```typescript
interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  message_type: 'text' | 'system' | 'file';
  attachments?: MessageAttachment[];
  thread_id?: string;
  thread_count?: number;
  edited_at?: string;
  created_at: string;
  is_pinned: boolean;
  reactions?: MessageReaction[];
}
```

### ConversationIntelligence

```typescript
interface ConversationIntelligence {
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative' | 'mixed';
    score: number; // -1 to 1
    distribution: { positive: number; neutral: number; negative: number };
  };
  topics: Array<{ name: string; confidence: number }>;
  engagement: {
    totalMessages: number;
    responseTime: { avg: number; median: number };
    messageVelocity: number;
  };
  participants: Array<{
    userId: string;
    messageCount: number;
    engagementScore: number;
  }>;
}
```

---

## Error Handling

### Error Types

```typescript
class APIError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT` | 429 | Rate limit exceeded |
| `SERVER_ERROR` | 500 | Internal server error |

### Error Handling Example

```typescript
try {
  const message = await messageChannelService.sendMessage(data);
} catch (error) {
  if (error instanceof APIError) {
    if (error.code === 'RATE_LIMIT') {
      console.error('Rate limited. Please wait.');
    } else if (error.code === 'AUTH_REQUIRED') {
      console.error('Please log in.');
    }
  }
}
```

---

## Rate Limiting

### Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Send Message | 60 requests | 1 minute |
| Create Channel | 10 requests | 1 hour |
| AI Services | 20 requests | 1 minute |
| Search | 100 requests | 1 minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
```

---

**See Also**:
- [Messages Architecture](./MESSAGES_ARCHITECTURE.md)
- [Component API](./COMPONENT_API.md)
- [Development Setup](./DEVELOPMENT_SETUP.md)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
**Maintained By**: Pulse Engineering Team
