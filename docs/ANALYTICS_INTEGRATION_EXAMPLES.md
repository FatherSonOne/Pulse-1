# Analytics Integration Examples

## Quick Start: Add Analytics to Your Services

Here are **copy-paste ready** examples for integrating analytics tracking into your existing message services.

---

## 1. SMS Service Integration

### File: `src/services/smsService.ts`

**Add this import at the top:**
```typescript
import analyticsCollector from './analyticsCollector';
```

**Update the `sendMessage` function:**

```typescript
async sendMessage(conversationId: string, body: string): Promise<SendSMSResponse> {
  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation) {
    return { success: false, error: 'Conversation not found' };
  }

  const message: SMSMessage = {
    id: generateId(),
    conversationId,
    body,
    direction: 'outbound',
    status: 'sent',
    timestamp: new Date().toISOString(),
  };

  const conversationMessages = messagesMap.get(conversationId) || [];
  conversationMessages.push(message);
  messagesMap.set(conversationId, conversationMessages);

  // Update conversation
  conversation.lastMessage = body;
  conversation.lastMessageTime = message.timestamp;

  // ✅ ADD THIS: Track the sent SMS for analytics
  analyticsCollector.trackMessageEvent({
    id: message.id,
    channel: 'sms',
    contactIdentifier: conversation.phoneNumber,
    contactName: conversation.contactName,
    isSent: true,
    timestamp: new Date(message.timestamp),
    content: body
  }).catch(err => console.error('Analytics tracking failed:', err));

  // Simulate delivery status update
  setTimeout(() => {
    message.status = 'delivered';
  }, 1000);

  return { success: true, message };
}
```

**Add tracking for received messages:**

```typescript
// Add this new function or update your existing receive handler
async receiveMessage(phoneNumber: string, body: string): Promise<void> {
  const conversation = conversations.find(c => c.phoneNumber === phoneNumber);
  if (!conversation) return;

  const message: SMSMessage = {
    id: generateId(),
    conversationId: conversation.id,
    body,
    direction: 'inbound',
    status: 'received',
    timestamp: new Date().toISOString(),
  };

  const conversationMessages = messagesMap.get(conversation.id) || [];
  conversationMessages.push(message);
  messagesMap.set(conversation.id, conversationMessages);

  // ✅ Track the received SMS
  analyticsCollector.trackMessageEvent({
    id: message.id,
    channel: 'sms',
    contactIdentifier: phoneNumber,
    contactName: conversation.contactName,
    isSent: false,
    timestamp: new Date(message.timestamp),
    content: body,
    // If this is a reply to a previous message, add replyToId
    replyToId: conversationMessages[conversationMessages.length - 2]?.id
  }).catch(err => console.error('Analytics tracking failed:', err));
}
```

---

## 2. Email Service Integration

### File: `src/services/enhancedEmailService.ts`

**Add this import:**
```typescript
import analyticsCollector from './analyticsCollector';
```

**Find your email sending function and add tracking:**

```typescript
async sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  replyToId?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Your existing email sending logic here...
    const result = await yourEmailAPI.send(params);

    // ✅ ADD THIS: Track the sent email
    if (result.success) {
      analyticsCollector.trackMessageEvent({
        id: result.messageId || generateId(),
        channel: 'email',
        contactIdentifier: params.to,
        isSent: true,
        timestamp: new Date(),
        content: params.body,
        threadId: params.threadId,
        replyToId: params.replyToId
      }).catch(err => console.error('Analytics tracking failed:', err));
    }

    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}
```

**Track received emails:**

```typescript
async processIncomingEmail(email: any): Promise<void> {
  // Your existing email processing logic...

  // ✅ Track the received email
  analyticsCollector.trackMessageEvent({
    id: email.id || email.messageId,
    channel: 'email',
    contactIdentifier: email.from,
    contactName: email.fromName,
    isSent: false,
    timestamp: new Date(email.date || email.timestamp),
    content: email.body || email.textPlain,
    threadId: email.threadId,
    replyToId: email.inReplyTo
  }).catch(err => console.error('Analytics tracking failed:', err));
}
```

---

## 3. Slack Service Integration

### File: `src/services/slackService.ts`

**Add this import:**
```typescript
import analyticsCollector from './analyticsCollector';
```

**Track sent Slack messages:**

```typescript
async postMessage(channelId: string, text: string, threadTs?: string): Promise<any> {
  try {
    const result = await this.slackRequest('chat.postMessage', {
      channel: channelId,
      text,
      thread_ts: threadTs
    });

    // ✅ ADD THIS: Track the sent Slack message
    if (result.ok) {
      analyticsCollector.trackMessageEvent({
        id: result.ts,
        channel: 'slack',
        contactIdentifier: channelId,
        isSent: true,
        timestamp: new Date(),
        content: text,
        threadId: threadTs,
        replyToId: threadTs // If it's a thread reply
      }).catch(err => console.error('Analytics tracking failed:', err));
    }

    return result;
  } catch (error) {
    console.error('Error posting Slack message:', error);
    throw error;
  }
}
```

**Track received Slack messages (when fetching):**

```typescript
async getChannelMessages(
  channelId: string,
  channelName: string = 'unknown',
  limit: number = 100
): Promise<UnifiedMessage[]> {
  try {
    const result = await this.slackRequest('conversations.history', {
      channel: channelId,
      limit,
    });

    const messages = result.messages || [];
    const unifiedMessages: UnifiedMessage[] = [];

    for (const msg of messages) {
      if (msg.bot_id || msg.subtype) continue;

      // Your existing message processing...
      const unifiedMsg: UnifiedMessage = {
        // ... your existing fields
      };

      unifiedMessages.push(unifiedMsg);

      // ✅ ADD THIS: Track received Slack messages
      analyticsCollector.trackMessageEvent({
        id: `slack-${msg.ts}`,
        channel: 'slack',
        contactIdentifier: msg.user || channelId,
        contactName: senderName,
        isSent: false, // These are received messages
        timestamp: new Date(parseFloat(msg.ts || '0') * 1000),
        content: msg.text || '',
        threadId: msg.thread_ts
      }).catch(err => console.error('Analytics tracking failed:', err));
    }

    return unifiedMessages;
  } catch (error) {
    console.error('Error fetching Slack messages:', error);
    throw error;
  }
}
```

---

## 4. Messages Component Integration

### File: `src/components/Messages.tsx` or `src/components/SMS/SMSChat.tsx`

**Add this import:**
```typescript
import { useAnalyticsTracking, createMessageEvent } from '../hooks/useAnalyticsTracking';
```

**In your component:**

```typescript
function MessageComponent() {
  const { trackMessage } = useAnalyticsTracking();

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      // Send the message
      const result = await smsService.sendMessage(conversation.id, newMessage.trim());
      
      if (result.success && result.message) {
        setMessages(prev => [...prev, result.message!]);
        setNewMessage('');

        // ✅ Track the message for analytics
        const event = createMessageEvent(
          result.message,
          'sms', // or 'email', 'slack'
          true // isSent
        );
        await trackMessage(event);

        onConversationUpdate?.();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    // Your component JSX...
  );
}
```

---

## 5. Webhook Handler Integration

### File: `src/services/webhookService.ts`

**Add this import:**
```typescript
import analyticsCollector from './analyticsCollector';
```

**Update webhook handlers:**

```typescript
private setupDefaultHandlers(): void {
  // Slack event handler
  this.registerHandler('slack', 'message', async (event) => {
    const message = await unifiedInboxService.normalizeMessage(
      event.payload,
      'slack'
    );
    
    // ✅ ADD THIS: Track incoming Slack webhook message
    analyticsCollector.trackMessageEvent({
      id: message.id,
      channel: 'slack',
      contactIdentifier: message.senderId,
      contactName: message.senderName,
      isSent: false,
      timestamp: message.timestamp,
      content: message.content
    }).catch(err => console.error('Analytics tracking failed:', err));

    console.log('Processed Slack webhook message:', message.id);
  });

  // Twilio SMS handler
  this.registerHandler('twilio', 'message.received', async (event) => {
    const message = await unifiedInboxService.normalizeMessage(
      event.payload,
      'sms'
    );

    // ✅ Track incoming SMS webhook
    analyticsCollector.trackMessageEvent({
      id: message.id,
      channel: 'sms',
      contactIdentifier: message.senderId,
      contactName: message.senderName,
      isSent: false,
      timestamp: message.timestamp,
      content: message.content
    }).catch(err => console.error('Analytics tracking failed:', err));

    console.log('Processed Twilio webhook message:', message.id);
  });

  // Gmail handler
  this.registerHandler('gmail', 'message.received', async (event) => {
    const message = await unifiedInboxService.normalizeMessage(
      event.payload,
      'email'
    );

    // ✅ Track incoming email webhook
    analyticsCollector.trackMessageEvent({
      id: message.id,
      channel: 'email',
      contactIdentifier: message.senderEmail || message.senderId,
      contactName: message.senderName,
      isSent: false,
      timestamp: message.timestamp,
      content: message.content
    }).catch(err => console.error('Analytics tracking failed:', err));

    console.log('Processed Gmail webhook message:', message.id);
  });
}
```

---

## 6. Unified Inbox Integration

### File: `src/services/unifiedInboxDb.ts`

**Add tracking when storing messages:**

```typescript
import analyticsCollector from './analyticsCollector';

async storeMessage(message: UnifiedMessage): Promise<void> {
  // Your existing storage logic...
  await supabase.from('unified_messages').insert(messageData);

  // ✅ Track the message
  const channel = message.source === 'slack' ? 'slack' 
                : message.source === 'email' ? 'email' 
                : 'sms';

  analyticsCollector.trackMessageEvent({
    id: message.id,
    channel,
    contactIdentifier: message.senderEmail || message.senderId,
    contactName: message.senderName,
    isSent: false, // Assuming these are received messages
    timestamp: message.timestamp,
    content: message.content
  }).catch(err => console.error('Analytics tracking failed:', err));
}
```

---

## 7. Testing Your Integration

### Test Analytics Tracking

Add this to a settings page or debug panel:

```typescript
import { useAnalyticsTracking } from '../hooks/useAnalyticsTracking';

function AnalyticsTestPanel() {
  const { trackMessage, backfillAnalytics } = useAnalyticsTracking();

  const testTracking = async () => {
    // Test tracking a single message
    await trackMessage({
      id: 'test-' + Date.now(),
      channel: 'email',
      contactIdentifier: 'test@example.com',
      contactName: 'Test User',
      isSent: true,
      timestamp: new Date(),
      content: 'This is a test message'
    });

    alert('Test message tracked! Check the analytics dashboard.');
  };

  const runBackfill = async () => {
    await backfillAnalytics(30); // Last 30 days
    alert('Backfill complete! Analytics data populated.');
  };

  return (
    <div>
      <button onClick={testTracking}>Test Analytics Tracking</button>
      <button onClick={runBackfill}>Backfill Analytics (30 days)</button>
    </div>
  );
}
```

---

## 8. Batch Import Historical Data

If you have existing messages in your database:

```typescript
import analyticsCollector from './services/analyticsCollector';

async function importHistoricalData() {
  // Fetch your existing messages
  const { data: messages } = await supabase
    .from('unified_messages')
    .select('*')
    .gte('timestamp', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  // Convert to MessageEvent format
  const events = messages.map(msg => ({
    id: msg.id,
    channel: msg.platform as 'email' | 'sms' | 'slack',
    contactIdentifier: msg.sender_id || msg.external_id,
    contactName: msg.metadata?.sender_name,
    isSent: msg.metadata?.is_sent || false,
    timestamp: new Date(msg.timestamp),
    content: msg.content,
    threadId: msg.thread_id,
    replyToId: msg.reply_to_id
  }));

  // Track in batches
  await analyticsCollector.trackMessageBatch(events);
  
  console.log(`Imported ${events.length} historical messages`);
}
```

---

## Key Points

### ✅ Do's
- Always use `.catch()` on tracking calls (don't let analytics break your app)
- Track both sent AND received messages
- Include `replyToId` when available (for response time tracking)
- Use the correct channel: 'email', 'sms', or 'slack'
- Include message content for sentiment analysis

### ❌ Don'ts
- Don't `await` analytics tracking in critical paths (use fire-and-forget)
- Don't track system messages or bot messages
- Don't track the same message twice
- Don't throw errors if analytics fails

### 🎯 Best Practices
1. **Fire and forget**: Use `.catch()` instead of `try/catch` for non-critical tracking
2. **Batch processing**: Use `trackMessageBatch()` for bulk imports
3. **Test incrementally**: Start with one service, verify it works, then add others
4. **Check the dashboard**: After integration, verify data appears in Analytics Dashboard
5. **Run backfill**: Use the setup wizard or manual backfill for historical data

---

## Troubleshooting

### No data showing in dashboard?
1. Check browser console for errors
2. Verify database migration is applied
3. Run `backfillAnalytics(30)` to populate data
4. Check that `trackMessage` is actually being called

### Engagement scores not updating?
```sql
-- Run this in Supabase SQL editor
SELECT recalculate_all_engagement_scores(auth.uid());
```

### Response times missing?
- Ensure you're passing `replyToId` when tracking replies
- Check that both incoming and outgoing messages are tracked

---

## Next Steps

1. ✅ Pick one service (SMS, Email, or Slack)
2. ✅ Add the tracking code from examples above
3. ✅ Test by sending a message
4. ✅ Check Analytics Dashboard for data
5. ✅ Repeat for other services
6. ✅ Run backfill for historical data

Need help? Check `docs/ANALYTICS_IMPLEMENTATION.md` for full documentation!
