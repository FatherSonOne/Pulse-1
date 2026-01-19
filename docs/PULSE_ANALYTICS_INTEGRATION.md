# Pulse Analytics Integration Guide

## Overview

This guide shows you how to integrate analytics tracking into **Pulse's three main communication channels**:

1. **Pulse Messages** - Built-in messaging threads
2. **Email** - Emails sent through Pulse
3. **Voxer** - Voice/video recordings

---

## 1. Pulse Messages Integration

Pulse messages are stored in the `messages` and `threads` tables via `dataService.ts`.

### File: `src/services/dataService.ts`

**Add this import at the top:**

```typescript
import analyticsCollector from './analyticsCollector';
```

**Update the `addMessage` function (around line 649):**

```typescript
async addMessage(threadId: string, message: Omit<Message, 'id'>): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert([{
      thread_id: threadId,
      sender: message.sender,
      text: message.text,
      timestamp: message.timestamp.toISOString(),
      read: message.read,
      attachments: message.attachments || [],
      metadata: message.metadata || {}
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding message:', error);
    return null;
  }

  const newMessage = dbToMessage(data);

  // ✅ ADD THIS: Track the Pulse message for analytics
  try {
    // Get thread info to identify the contact
    const thread = await this.getThread(threadId);
    if (thread) {
      await analyticsCollector.trackMessageEvent({
        id: newMessage.id,
        channel: 'sms', // Using 'sms' as the channel type for Pulse messages
        contactIdentifier: thread.contactId,
        contactName: thread.contactName,
        isSent: message.sender === 'me',
        timestamp: newMessage.timestamp,
        content: message.text,
        threadId: threadId
      });
    }
  } catch (analyticsError) {
    console.error('Analytics tracking failed:', analyticsError);
    // Don't let analytics errors break message sending
  }

  return newMessage;
}
```

---

## 2. Email Integration

Pulse sends emails through various services. We need to track when emails are sent.

### Option A: Track in Email Service

**File: `src/services/enhancedEmailService.ts`**

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
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Your existing email sending logic...
    const result = await yourEmailAPI.send(params);

    // ✅ ADD THIS: Track sent email
    if (result.success) {
      analyticsCollector.trackMessageEvent({
        id: result.messageId || `email-${Date.now()}`,
        channel: 'email',
        contactIdentifier: params.to,
        isSent: true,
        timestamp: new Date(),
        content: params.body,
        threadId: params.threadId
      }).catch(err => console.error('Analytics tracking failed:', err));
    }

    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}
```

### Option B: Track in Gmail Service

**File: `src/services/gmailService.ts`**

```typescript
import analyticsCollector from './analyticsCollector';

async sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string }> {
  try {
    // Your Gmail API call...
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    // ✅ Track sent email
    if (response.data.id) {
      analyticsCollector.trackMessageEvent({
        id: response.data.id,
        channel: 'email',
        contactIdentifier: params.to,
        isSent: true,
        timestamp: new Date(),
        content: params.body || params.html || '',
        threadId: params.threadId
      }).catch(err => console.error('Analytics tracking failed:', err));
    }

    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false };
  }
}
```

---

## 3. Voxer Integration

Voxer recordings are saved via `dataService.saveVoxerRecording()`.

### File: `src/services/dataService.ts`

**Find the `saveVoxerRecording` function (around line 1255) and add tracking:**

```typescript
async saveVoxerRecording(recording: {
  id?: string;
  title?: string;
  audio_url?: string;
  video_url?: string;
  duration: number;
  transcript?: string;
  contact_id?: string;
  contact_name?: string;
  is_outgoing: boolean;
  starred?: boolean;
  tags?: string[];
  analysis?: any;
  recorded_at?: string;
}): Promise<any | null> {
  const userId = this.getUserId();
  if (!userId) return null;

  const recordingData: any = {
    user_id: userId,
    title: recording.title,
    audio_url: recording.audio_url,
    duration: recording.duration,
    transcript: recording.transcript,
    contact_id: recording.contact_id,
    contact_name: recording.contact_name,
    is_outgoing: recording.is_outgoing,
    played: false,
    starred: recording.starred || false,
    tags: recording.tags || [],
    analysis: recording.analysis || null,
    recorded_at: recording.recorded_at || new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  
  // Store video_url in analysis JSON if video_url exists
  if (recording.video_url) {
    recordingData.analysis = {
      ...(recording.analysis || {}),
      video_url: recording.video_url,
    };
  }

  let result;
  if (recording.id) {
    // Update existing
    const { data, error } = await supabase
      .from('voxer_recordings')
      .update(recordingData)
      .eq('id', recording.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating voxer recording:', error);
      return null;
    }
    result = data;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('voxer_recordings')
      .insert([recordingData])
      .select()
      .single();

    if (error) {
      console.error('Error saving voxer recording:', error);
      return null;
    }
    result = data;
  }

  // ✅ ADD THIS: Track Voxer recording for analytics
  try {
    await analyticsCollector.trackMessageEvent({
      id: result.id,
      channel: 'slack', // Using 'slack' as the channel type for voice messages
      contactIdentifier: recording.contact_id || recording.contact_name || 'unknown',
      contactName: recording.contact_name,
      isSent: recording.is_outgoing,
      timestamp: new Date(recording.recorded_at || Date.now()),
      content: recording.transcript || recording.title || '[Voice Recording]'
    });
  } catch (analyticsError) {
    console.error('Analytics tracking failed:', analyticsError);
    // Don't let analytics errors break recording save
  }

  return result;
}
```

---

## 4. Alternative: Component-Level Tracking

If you prefer to track at the UI level instead of the service level:

### File: `src/components/Messages.tsx`

**Add this import:**

```typescript
import { useAnalyticsTracking } from '../hooks/useAnalyticsTracking';
```

**In your Messages component:**

```typescript
const Messages: React.FC<MessagesProps> = ({ user }) => {
  const { trackMessage } = useAnalyticsTracking();

  // Find your message sending handler and add tracking
  const handleSendMessage = async (threadId: string, text: string) => {
    // Send the message
    const newMessage = await dataService.addMessage(threadId, {
      sender: 'me',
      text,
      timestamp: new Date(),
      read: true
    });

    if (newMessage) {
      // ✅ Track the message
      const thread = threads.find(t => t.id === threadId);
      if (thread) {
        await trackMessage({
          id: newMessage.id,
          channel: 'sms',
          contactIdentifier: thread.contactId,
          contactName: thread.contactName,
          isSent: true,
          timestamp: newMessage.timestamp,
          content: text,
          threadId: threadId
        });
      }
    }
  };

  // Rest of your component...
};
```

### File: `src/components/Voxer.tsx`

**Add tracking when saving recordings:**

```typescript
import { useAnalyticsTracking } from '../hooks/useAnalyticsTracking';

const Voxer: React.FC<VoxerProps> = ({ contacts, activeContactId }) => {
  const { trackMessage } = useAnalyticsTracking();

  const handleSaveRecording = async (recording: Recording) => {
    // Save the recording
    const saved = await dataService.saveVoxerRecording({
      audio_url: recording.url,
      duration: recording.duration,
      transcript: recording.transcript,
      contact_id: activeContactId,
      contact_name: activeContact?.name,
      is_outgoing: true,
      recorded_at: new Date().toISOString()
    });

    if (saved) {
      // ✅ Track the Voxer recording
      await trackMessage({
        id: saved.id,
        channel: 'slack', // Voice messages
        contactIdentifier: activeContactId || 'unknown',
        contactName: activeContact?.name,
        isSent: true,
        timestamp: new Date(),
        content: recording.transcript || '[Voice Recording]'
      });
    }
  };

  // Rest of your component...
};
```

---

## 5. Backfill Historical Data

To populate analytics from existing Pulse data:

### Create a Backfill Script

**File: `src/scripts/backfillPulseAnalytics.ts`**

```typescript
import { supabase } from '../services/supabase';
import analyticsCollector from '../services/analyticsCollector';

export async function backfillPulseAnalytics(daysBack: number = 90) {
  console.log(`Starting Pulse analytics backfill for last ${daysBack} days...`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('User not authenticated');
    return;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  // 1. Backfill Pulse Messages
  console.log('Backfilling Pulse messages...');
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      *,
      threads!inner(contact_id, contact_name)
    `)
    .gte('timestamp', startDate.toISOString())
    .order('timestamp', { ascending: true });

  if (messages) {
    for (const msg of messages) {
      await analyticsCollector.trackMessageEvent({
        id: msg.id,
        channel: 'sms',
        contactIdentifier: msg.threads.contact_id,
        contactName: msg.threads.contact_name,
        isSent: msg.sender === 'me',
        timestamp: new Date(msg.timestamp),
        content: msg.text
      });
    }
    console.log(`✓ Processed ${messages.length} Pulse messages`);
  }

  // 2. Backfill Voxer Recordings
  console.log('Backfilling Voxer recordings...');
  const { data: recordings } = await supabase
    .from('voxer_recordings')
    .select('*')
    .eq('user_id', user.id)
    .gte('recorded_at', startDate.toISOString())
    .order('recorded_at', { ascending: true });

  if (recordings) {
    for (const rec of recordings) {
      await analyticsCollector.trackMessageEvent({
        id: rec.id,
        channel: 'slack',
        contactIdentifier: rec.contact_id || rec.contact_name || 'unknown',
        contactName: rec.contact_name,
        isSent: rec.is_outgoing,
        timestamp: new Date(rec.recorded_at),
        content: rec.transcript || rec.title || '[Voice Recording]'
      });
    }
    console.log(`✓ Processed ${recordings.length} Voxer recordings`);
  }

  // 3. Backfill Emails (if you have them stored)
  // Add email backfill logic here if needed

  console.log('✅ Pulse analytics backfill complete!');
}
```

**Run the backfill from Settings or a debug panel:**

```typescript
import { backfillPulseAnalytics } from '../scripts/backfillPulseAnalytics';

function SettingsPage() {
  const handleBackfill = async () => {
    await backfillPulseAnalytics(90);
    alert('Analytics backfill complete!');
  };

  return (
    <button onClick={handlefill}>
      Rebuild Pulse Analytics (90 days)
    </button>
  );
}
```

---

## 6. Testing Your Integration

### Test Each Channel

**1. Test Pulse Messages:**
```typescript
// Send a message in Pulse
// Check console for: "Analytics tracking..." logs
// Check Analytics Dashboard for new message count
```

**2. Test Voxer:**
```typescript
// Record and save a Voxer message
// Check console for analytics tracking
// Check Analytics Dashboard for voice message count
```

**3. Test Email:**
```typescript
// Send an email through Pulse
// Check console for analytics tracking
// Check Analytics Dashboard for email count
```

### Verify Data in Dashboard

1. Open Analytics Dashboard
2. Check "Total Messages" card - should show your test messages
3. Check "Channel Distribution" - should show breakdown by type
4. Check "Active Contacts" - should show contacts you messaged

---

## Channel Mapping

| Pulse Feature | Analytics Channel | Notes |
|--------------|-------------------|-------|
| **Pulse Messages** | `'sms'` | Built-in messaging threads |
| **Emails** | `'email'` | Emails sent through Pulse |
| **Voxer (Voice/Video)** | `'slack'` | Voice recordings |

> **Why these mappings?** The analytics system supports 3 channels: 'email', 'sms', 'slack'. We map Pulse messages to 'sms' (text-based), emails to 'email', and Voxer to 'slack' (real-time communication).

---

## Quick Start Checklist

- [ ] Add `import analyticsCollector from './analyticsCollector'` to `dataService.ts`
- [ ] Add tracking to `addMessage()` function
- [ ] Add tracking to `saveVoxerRecording()` function  
- [ ] Add tracking to email sending function
- [ ] Test by sending a Pulse message
- [ ] Test by recording a Voxer message
- [ ] Test by sending an email
- [ ] Run backfill script for historical data
- [ ] Check Analytics Dashboard for data

---

## Troubleshooting

### No data showing?
1. Check browser console for errors
2. Verify `analyticsCollector` import is correct
3. Check that tracking code is actually being called (add `console.log`)
4. Run the backfill script

### Messages not being counted?
1. Verify the `channel` parameter is correct ('email', 'sms', or 'slack')
2. Check that `contactIdentifier` is not empty
3. Verify database migration `027_analytics_helper_functions.sql` is applied

### Voxer recordings not tracked?
1. Make sure tracking is in `saveVoxerRecording()` not just the UI
2. Check that `is_outgoing` is set correctly
3. Verify `contact_id` or `contact_name` is provided

---

## Next Steps

1. ✅ Integrate tracking into `dataService.ts`
2. ✅ Test with a few messages
3. ✅ Run backfill for historical data
4. ✅ Check Analytics Dashboard
5. ✅ Monitor for any errors in console

For more details, see:
- `docs/ANALYTICS_IMPLEMENTATION.md` - Full technical documentation
- `docs/ANALYTICS_INTEGRATION_EXAMPLES.md` - General integration examples
- `src/services/analyticsCollector.ts` - Core tracking logic

---

**Ready to track your Pulse communications!** 🎉
