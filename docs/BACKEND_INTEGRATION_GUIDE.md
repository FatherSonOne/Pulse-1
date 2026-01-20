# Pulse Messages - Backend Integration Guide

Complete guide for understanding and working with Pulse Messages backend architecture.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication System](#authentication-system)
3. [Message Services](#message-services)
4. [CRM Integration](#crm-integration)
5. [AI Services](#ai-services)
6. [File Management](#file-management)
7. [Security](#security)
8. [State Management](#state-management)
9. [Real-Time Features](#real-time-features)
10. [Deployment](#deployment)

---

## Architecture Overview

### Technology Stack

**Backend Services:**
- Supabase (PostgreSQL + Real-time + Storage + Auth)
- Supabase Edge Functions (Deno runtime)
- Google Gemini 1.5 Flash (AI)
- Redis (optional, for distributed rate limiting)

**Frontend State:**
- Zustand (global state management)
- React Query (data fetching - future)
- React Context (authentication)

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  AuthContext │  │ MessageStore │  │ ToolsPanel   │     │
│  │  (React)     │  │ (Zustand)    │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ authService  │  │ messageChannel│  │ fileUpload   │     │
│  │              │  │ Service       │  │ Service      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE PLATFORM                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Auth       │  │  PostgreSQL  │  │   Storage    │     │
│  │  (JWT)       │  │  + Real-time │  │   (S3-like)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Edge Function│  │    Webhooks  │  │   Triggers   │     │
│  │ (Deno)       │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL APIS                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Gemini AI  │  │ CRM Platforms│  │  Cloud APIs  │     │
│  │  (Google)    │  │ (HubSpot etc)│  │ (Optional)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication System

### Overview

Pulse Messages uses Supabase Auth with custom React Context integration for seamless authentication across the application.

### Components

#### AuthContext (`src/contexts/AuthContext.tsx`)

Provides authentication state and methods to entire application:

```typescript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, loginWithGoogle, logout } = useAuth();

  if (!isAuthenticated) {
    return <button onClick={loginWithGoogle}>Login</button>;
  }

  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**Available Methods:**
- `loginWithGoogle()` - OAuth with Google
- `loginWithMicrosoft()` - OAuth with Microsoft/Azure
- `loginWithEmail(email, password)` - Email/password login
- `signUpWithEmail(email, password, name)` - Registration
- `logout()` - Sign out
- `refreshSession()` - Manual session refresh
- `checkSessionValid()` - Validate current session

**Features:**
- Automatic session restoration on page load
- Proactive session refresh (30-min threshold)
- Real-time auth state updates
- Secure token storage (httpOnly capable)

#### Auth Service (`src/services/authService.ts`)

Low-level authentication service with direct Supabase integration:

```typescript
import { getSessionUser, loginWithGoogle } from '../services/authService';

// Get current user synchronously (cached)
const user = getSessionUserSync();

// Get current user with validation
const user = await getSessionUser();

// OAuth login
const user = await loginWithGoogle();
```

### Session Management

**Token Refresh Strategy:**
```typescript
// Automatic refresh when session < 30 minutes remaining
const SESSION_REFRESH_THRESHOLD = 30 * 60 * 1000;

// Manual refresh
await forceRefreshSession();

// Check validity
const isValid = await isSessionValid();
```

**Session Monitoring:**
- Checks every 2 minutes
- Auto-refreshes when < 30 minutes remaining
- Refreshes on app visibility change
- Logs all refresh attempts

### Protected Routes

```typescript
import { withAuth } from '../hooks/useAuth';

// Wrap component with authentication requirement
const ProtectedPage = withAuth(MyComponent);

// Or use hook directly
function MyComponent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <div>Protected content</div>;
}
```

---

## Message Services

### Message Channel Service

**File**: `src/services/messageChannelService.ts` (997 lines)

**Core Operations:**

```typescript
import { messageChannelService } from '../services/messageChannelService';

// Get channels
const channels = await messageChannelService.getChannels(workspaceId);

// Get messages
const messages = await messageChannelService.getMessages(channelId, limit);

// Send message
const message = await messageChannelService.sendMessage(
  channelId,
  userId,
  content,
  'text'
);

// Edit message
await messageChannelService.editMessage(messageId, newContent);

// Delete message
await messageChannelService.deleteMessage(messageId);

// Reactions
await messageChannelService.addReaction(messageId, '👍', userId);
await messageChannelService.removeReaction(messageId, '👍', userId);

// Threads
const replies = await messageChannelService.getThreadMessages(threadId);
await messageChannelService.createThreadReply(threadId, userId, content);
```

**Real-Time Features:**

```typescript
// Subscribe to channel updates
messageChannelService.subscribeToChannelFull(
  channelId,
  (message) => console.log('New message:', message),
  (message) => console.log('Updated:', message),
  (messageId) => console.log('Deleted:', messageId)
);

// Subscribe to typing indicators
messageChannelService.subscribeToTypingIndicators(
  channelId,
  (indicator) => console.log('User typing:', indicator.userName),
  (userId) => console.log('User stopped typing:', userId)
);

// Send typing indicator
await messageChannelService.broadcastTypingIndicator(channelId, userId, userName);
```

**Advanced Search:**

```typescript
const results = await messageChannelService.searchMessagesAdvanced(
  workspaceId,
  'search query',
  {
    channelId: 'channel-123',
    hasAttachments: true,
    isPinned: false,
    dateFrom: new Date('2024-01-01'),
    dateTo: new Date('2024-12-31')
  }
);
```

---

## CRM Integration

### Overview

Pulse Messages integrates with 4 major CRM platforms:
- HubSpot
- Salesforce
- Pipedrive
- Zoho CRM

### CRM Service

**File**: `src/services/crmService.ts`

**Setup Integration:**

```typescript
import { CRMService } from '../services/crmService';

const crmService = new CRMService();

// Create integration
const integration = await crmService.createIntegration(
  'hubspot',
  'My HubSpot Account',
  accessToken,
  workspaceId
);

// Get integration
const integration = await crmService.getIntegration('hubspot');

// Update tokens
await crmService.updateToken(
  integrationId,
  newAccessToken,
  refreshToken,
  expiresIn
);
```

**Sync Operations:**

```typescript
// Sync contacts
const contacts = await crmService.syncContacts(integrationId);

// Sync companies
const companies = await crmService.syncCompanies(integrationId);

// Sync deals
const deals = await crmService.syncDeals(integrationId);

// Get sync logs
const logs = await crmService.getSyncLogs(integrationId, limit);
```

### Platform-Specific Services

Each CRM has its own service module:

**HubSpot** (`src/services/crm/hubspotService.ts`)
```typescript
import { hubspotService } from '../services/crm/hubspotService';

// OAuth
const authUrl = await hubspotService.getAuthorizationUrl(redirectUri);
const tokens = await hubspotService.exchangeCodeForToken(code, redirectUri);

// Operations
const contacts = await hubspotService.getContacts(accessToken);
const contact = await hubspotService.createContact(accessToken, contactData);
const deals = await hubspotService.getDeals(accessToken);
```

**Salesforce** (`src/services/crm/salesforceService.ts`)
```typescript
import { salesforceService } from '../services/crm/salesforceService';

// OAuth with Salesforce
const authUrl = await salesforceService.getAuthorizationUrl(redirectUri);
const tokens = await salesforceService.exchangeCodeForToken(code, redirectUri);

// Operations
const leads = await salesforceService.getLeads(accessToken, instanceUrl);
const accounts = await salesforceService.getAccounts(accessToken, instanceUrl);
```

**Setup Guide**: See [OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md)

---

## AI Services

### Gemini AI Service

**File**: `src/services/geminiService.ts`

**Features:**
- Smart reply generation
- Draft intent analysis
- Sentiment analysis
- Message summarization
- Translation

**Usage:**

```typescript
import { generateSmartReply, analyzeDraftIntent } from '../services/geminiService';

// Generate smart replies
const history = [
  { role: 'other', text: 'How are you?' },
  { role: 'me', text: 'I am good, thanks!' }
];
const reply = await generateSmartReply(apiKey, history);

// Analyze draft
const analysis = await analyzeDraftIntent(apiKey, draftText);
// Returns: { intent: string, suggestions: string[], warnings: string[] }
```

### Gemini API Proxy (Secure)

**File**: `supabase/functions/gemini-proxy/index.ts`

**Why Use Proxy:**
- ✅ Hides API key from client
- ✅ Rate limiting per user
- ✅ Request logging
- ✅ Input sanitization
- ✅ Error handling

**Client Usage:**

```typescript
// Call through proxy instead of direct API
const response = await fetch('/functions/v1/gemini-proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'Generate a professional email response',
    operation: 'smartReply',
    history: [...]
  })
});

const { result } = await response.json();
```

### Conversation Intelligence

**File**: `src/services/conversationIntelligenceService.ts`

**Features:**
```typescript
import { conversationIntelligenceService } from '../services/conversationIntelligenceService';

// Analyze conversation
const intelligence = await conversationIntelligenceService.analyzeConversation(
  messages,
  apiKey
);

// Returns:
{
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative',
    score: 0.85,
    distribution: { positive: 70, neutral: 20, negative: 10 }
  },
  topics: [
    { name: 'Project Planning', confidence: 0.9 },
    { name: 'Budget Discussion', confidence: 0.7 }
  ],
  engagement: {
    totalMessages: 45,
    responseTime: { avg: 120, median: 90 },
    messageVelocity: 15 // messages per hour
  }
}
```

---

## File Management

### File Upload Service

**File**: `src/services/fileUploadService.ts`

**Features:**
- Secure upload to Supabase Storage
- File validation (type, size, name)
- Automatic thumbnail generation
- Progress tracking
- Metadata storage

**Usage:**

```typescript
import { fileUploadService, useFileUpload } from '../services/fileUploadService';

// Direct usage
const result = await fileUploadService.uploadFile(file, userId, {
  bucket: 'message-attachments',
  folder: 'images',
  maxSize: 5 * 1024 * 1024, // 5MB
  generateThumbnail: true
});

// React hook
function MyComponent() {
  const { upload, uploading, progress, error } = useFileUpload();

  const handleUpload = async (files: File[]) => {
    const results = await upload(files, user.id, {
      generateThumbnail: true
    });
    console.log('Uploaded:', results);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files)} />
      {uploading && <progress value={progress.percentage} max="100" />}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

**File Operations:**

```typescript
// List user files
const files = await fileUploadService.listFiles(userId, {
  limit: 50,
  category: 'image'
});

// Get file metadata
const metadata = await fileUploadService.getFileMetadata(fileId);

// Delete file
await fileUploadService.deleteFile(filePath);

// Get signed URL (for private files)
const signedUrl = await fileUploadService.getSignedUrl(filePath, 'private-bucket', 3600);
```

---

## Security

### Security Middleware

**File**: `src/services/securityMiddleware.ts`

**Input Sanitization:**

```typescript
import { securityMiddleware } from '../services/securityMiddleware';

// Sanitize HTML (remove XSS)
const clean = securityMiddleware.sanitizeHTML(userInput);

// Sanitize plain text
const clean = securityMiddleware.sanitizeText(userInput);

// Sanitize URL
const safeUrl = securityMiddleware.sanitizeURL(userUrl);
```

**Input Validation:**

```typescript
// Validate message
const validation = securityMiddleware.validateMessage(content);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// Validate file
const fileValidation = securityMiddleware.validateFile(file);

// Validate email
const emailValidation = securityMiddleware.validateEmail(email);

// Validate URL (with SSRF protection)
const urlValidation = securityMiddleware.validateURL(url);
```

**Rate Limiting:**

```typescript
// Check rate limit
const result = securityMiddleware.checkRateLimit(userId, {
  maxRequests: 100,
  windowMs: 60000 // 1 minute
});

if (!result.allowed) {
  throw new Error(`Rate limit exceeded. Reset at ${new Date(result.resetAt)}`);
}

console.log(`Remaining requests: ${result.remaining}`);
```

**Content Security:**

```typescript
// Detect malicious content
const check = securityMiddleware.detectMaliciousContent(userInput);
if (!check.safe) {
  console.error('Malicious content detected:', check.reason);
}

// Detect sensitive data
const sensitiveCheck = securityMiddleware.detectSensitiveData(content);
if (sensitiveCheck.found) {
  console.warn('Sensitive data types found:', sensitiveCheck.types);
  // ['credit_card', 'ssn', 'api_key']
}
```

**Retry Logic:**

```typescript
// Retry with exponential backoff
const result = await securityMiddleware.retryWithBackoff(
  async () => {
    return await fetch('/api/endpoint');
  },
  3, // max attempts
  1000 // base delay (ms)
);
```

---

## State Management

### Message Store (Zustand)

**File**: `src/store/messageStore.ts` (952 lines)

**Architecture:**
- Zustand for state management
- Immer for immutable updates
- subscribeWithSelector for granular subscriptions

**Usage:**

```typescript
import { useMessagesStore } from '../store/messageStore';

function MyComponent() {
  // Select specific state
  const channels = useMessagesStore((state) => state.channels);
  const selectedChannel = useMessagesStore((state) =>
    state.channels.find(c => c.id === state.selectedChannelId)
  );

  // Actions
  const loadChannels = useMessagesStore((state) => state.loadChannels);
  const sendMessage = useMessagesStore((state) => state.sendMessage);

  useEffect(() => {
    loadChannels(workspaceId);
  }, [workspaceId]);

  return (
    <div>
      {channels.map(channel => (
        <div key={channel.id}>{channel.name}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

**Key Features:**

- **Optimistic Updates**: Messages appear instantly, sync in background
- **Real-Time Sync**: WebSocket subscriptions for live updates
- **Smart Caching**: Reduces unnecessary API calls
- **Error Recovery**: Failed messages can be retried
- **Typing Indicators**: Real-time "user is typing" notifications

**State Structure:**

```typescript
{
  // Core Data
  channels: MessageChannel[]
  messages: Record<string, ChannelMessage[]> // channelId -> messages
  members: Record<string, ChannelMember[]>

  // UI State
  isLoading: boolean
  isSending: boolean
  error: string | null

  // Real-Time
  typingUsers: Record<string, TypingIndicator[]>

  // AI Features
  smartReplies: SmartReplyOption[]
  draftAnalysis: DraftAnalysisResult | null

  // Optimistic Updates
  pendingMessages: Record<string, ChannelMessage>
  failedMessages: Record<string, { message, error }>
}
```

---

## Real-Time Features

### Supabase Real-Time

**PostgreSQL Replication:**

```sql
-- Enable real-time for table
ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_interactions;
```

**Client Subscription:**

```typescript
import { supabase } from './supabase';

// Subscribe to messages
const channel = supabase
  .channel(`messages:${channelId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'channel_messages',
      filter: `channel_id=eq.${channelId}`
    },
    (payload) => {
      console.log('New message:', payload.new);
      // Update local state
    }
  )
  .subscribe();

// Cleanup
channel.unsubscribe();
```

**Broadcast Channels:**

```typescript
// Send typing indicator
const channel = supabase.channel(`typing:${channelId}`);

channel.send({
  type: 'broadcast',
  event: 'typing',
  payload: { userId, userName }
});

// Listen for typing
channel.on('broadcast', { event: 'typing' }, (payload) => {
  console.log(`${payload.userName} is typing...`);
});
```

---

## Deployment

### Environment Setup

1. **Copy production template:**
   ```bash
   cp .env.production .env.production.local
   ```

2. **Fill in credentials:**
   - Supabase URL and keys
   - OAuth credentials (HubSpot, Salesforce, etc.)
   - Gemini API key
   - Other service keys

3. **Verify configuration:**
   ```bash
   npm run check-env
   ```

### Database Setup

```bash
# Run migrations
supabase db push

# Apply RLS policies
supabase db reset

# Verify schema
supabase db dump
```

### Function Deployment

```bash
# Deploy Gemini proxy
supabase functions deploy gemini-proxy

# Set secrets
supabase secrets set GEMINI_API_KEY=your-key-here
supabase secrets set JWT_SECRET=your-jwt-secret

# Test function
curl -X POST https://your-project.supabase.co/functions/v1/gemini-proxy \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'
```

### Frontend Build

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Test production build locally
npm run preview

# Deploy to Vercel/Netlify
vercel deploy --prod
```

### Health Checks

Create health check endpoints:

```typescript
// pages/api/health.ts
export default function handler(req, res) {
  // Check database connection
  const dbHealthy = await checkDatabase();

  // Check Supabase
  const supabaseHealthy = await checkSupabase();

  // Check external APIs
  const apisHealthy = await checkExternalAPIs();

  if (dbHealthy && supabaseHealthy && apisHealthy) {
    res.status(200).json({ status: 'healthy' });
  } else {
    res.status(503).json({ status: 'unhealthy', details: {...} });
  }
}
```

---

## Monitoring & Observability

### Logging

```typescript
// Structured logging
console.log({
  level: 'info',
  timestamp: new Date().toISOString(),
  userId: user.id,
  action: 'message_sent',
  channelId: channel.id,
  messageId: message.id
});
```

### Error Tracking

```typescript
// Sentry integration
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.VITE_APP_MODE,
  tracesSampleRate: 1.0,
});

// Capture errors
try {
  await sendMessage(content);
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'messaging' },
    extra: { channelId, userId }
  });
}
```

### Performance Monitoring

```typescript
// Measure operation timing
console.time('sendMessage');
await sendMessage(content);
console.timeEnd('sendMessage');

// Track metrics
const start = performance.now();
await loadMessages(channelId);
const duration = performance.now() - start;

// Report to analytics
analytics.track('message_load_time', { duration, channelId });
```

---

## Troubleshooting

### Common Issues

**1. Authentication Errors**
```typescript
// Check session status
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);

// Force refresh
await forceRefreshSession();
```

**2. Real-Time Not Working**
```typescript
// Verify publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

// Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'channel_messages';
```

**3. Rate Limiting Issues**
```typescript
// Check rate limit status
const status = securityMiddleware.checkRateLimit(userId);
console.log('Rate limit:', status);

// Reset if needed
securityMiddleware.resetRateLimit(userId);
```

---

## API Reference

See individual service files for complete API documentation:

- [authService.ts](../src/services/authService.ts)
- [messageChannelService.ts](../src/services/messageChannelService.ts)
- [crmService.ts](../src/services/crmService.ts)
- [fileUploadService.ts](../src/services/fileUploadService.ts)
- [securityMiddleware.ts](../src/services/securityMiddleware.ts)

---

## Support

- **Documentation**: `/docs` directory
- **Issues**: GitHub Issues
- **Security**: security@pulsemessages.com

---

**Last Updated**: 2026-01-19
**Version**: 1.0
