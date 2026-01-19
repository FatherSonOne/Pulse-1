# Analytics Implementation Guide

## Overview

The Pulse Analytics system provides comprehensive insights into communication patterns, response times, contact engagement, and sentiment analysis. This guide explains how the system works and how to integrate it with your message flows.

## Architecture

### Database Tables

1. **`analytics_daily_metrics`** - Daily aggregated metrics per user
   - Message counts by channel (email, SMS, Slack)
   - Response time statistics
   - Sentiment scores
   - Peak activity hours

2. **`analytics_contact_engagement`** - Per-contact engagement tracking
   - Engagement scores (0-100)
   - Communication frequency
   - Response rates
   - Sentiment history

3. **`analytics_period_summary`** - Weekly/monthly rollups
   - Period comparisons
   - Trend analysis
   - AI-generated insights

4. **`analytics_response_times`** - Individual response tracking
   - Message-to-response pairs
   - Business hours tracking
   - Channel-specific metrics

### Core Services

#### `analyticsService.ts`
- Database queries and RPC function calls
- Data retrieval for dashboard
- Provides typed interfaces for all analytics data

#### `analyticsCollector.ts`
- **Main integration point** for tracking messages
- Automatic sentiment analysis
- Contact engagement scoring
- Response time calculation
- Batch processing for historical data

#### `useAnalyticsTracking.ts`
- React hook for easy integration
- Automatic daily aggregation
- Backfill functionality

## Integration Guide

### Step 1: Wrap Your App

Add the `AnalyticsInitializer` to your main App component:

```typescript
import { AnalyticsInitializer } from './components/Analytics';

function App() {
  return (
    <AnalyticsInitializer>
      {/* Your app content */}
    </AnalyticsInitializer>
  );
}
```

This will:
- Show a one-time setup wizard to backfill historical data
- Run daily aggregations automatically
- Initialize the analytics system

### Step 2: Track Messages

Whenever a message is sent or received, call the analytics tracker:

```typescript
import { useAnalyticsTracking, createMessageEvent } from '../hooks/useAnalyticsTracking';

function MessageComponent() {
  const { trackMessage } = useAnalyticsTracking();

  const handleSendMessage = async (message) => {
    // Send your message...
    await sendMessageToAPI(message);

    // Track it for analytics
    const event = createMessageEvent(message, 'email', true);
    await trackMessage(event);
  };

  const handleReceiveMessage = async (message) => {
    // Process received message...
    
    // Track it for analytics
    const event = createMessageEvent(message, 'email', false);
    await trackMessage(event);
  };
}
```

### Step 3: Integration Points

Add tracking to these key locations:

#### Email Service
```typescript
// In src/services/emailService.ts or enhancedEmailService.ts
import analyticsCollector from './analyticsCollector';

async function sendEmail(to, subject, body) {
  const result = await sendViaAPI(to, subject, body);
  
  // Track the sent email
  await analyticsCollector.trackMessageEvent({
    id: result.id,
    channel: 'email',
    contactIdentifier: to,
    isSent: true,
    timestamp: new Date(),
    content: body
  });
  
  return result;
}
```

#### SMS Service
```typescript
// In src/services/smsService.ts
import analyticsCollector from './analyticsCollector';

async function sendSMS(to, message) {
  const result = await sendViaAPI(to, message);
  
  await analyticsCollector.trackMessageEvent({
    id: result.id,
    channel: 'sms',
    contactIdentifier: to,
    isSent: true,
    timestamp: new Date(),
    content: message
  });
  
  return result;
}
```

#### Slack Integration
```typescript
// In src/services/slackService.ts
import analyticsCollector from './analyticsCollector';

async function postMessage(channel, text) {
  const result = await slackAPI.post(channel, text);
  
  await analyticsCollector.trackMessageEvent({
    id: result.ts,
    channel: 'slack',
    contactIdentifier: channel,
    isSent: true,
    timestamp: new Date(),
    content: text
  });
  
  return result;
}
```

### Step 4: Backfill Historical Data

For existing users with message history, run the backfill:

```typescript
import { useAnalyticsTracking } from '../hooks/useAnalyticsTracking';

function SettingsPage() {
  const { backfillAnalytics } = useAnalyticsTracking();

  const handleBackfill = async () => {
    // Analyze last 90 days of messages
    await backfillAnalytics(90);
    alert('Analytics backfill complete!');
  };

  return (
    <button onClick={handleBackfill}>
      Rebuild Analytics Data
    </button>
  );
}
```

## Database Migrations

Run these migrations in order:

1. **`019_advanced_analytics.sql`** - Creates all analytics tables and base functions
2. **`027_analytics_helper_functions.sql`** - Adds helper functions for scoring and trends

Apply migrations:
```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase dashboard SQL editor
```

## Features

### Engagement Scoring

Contacts are scored 0-100 based on:
- **Volume** (0-25 points): More messages = higher score
- **Response Rate** (0-30 points): How often you respond
- **Recency** (0-25 points): More recent contact = higher score
- **Sentiment** (0-20 points): Positive sentiment = higher score

### Sentiment Analysis

Simple keyword-based sentiment analysis (can be upgraded to AI):
- Positive words: "thanks", "great", "awesome", "excellent", etc.
- Negative words: "sorry", "issue", "problem", "error", etc.
- Score range: -1 (negative) to +1 (positive)

### Response Time Tracking

Automatically calculates:
- Average response time per contact
- Fastest/slowest responses
- Business hours vs. after-hours responses
- Response rate percentage

### Communication Frequency

Automatically categorized as:
- **Daily**: ≥1 message per day
- **Weekly**: ~1 message per week
- **Monthly**: ~1 message per month
- **Sporadic**: Less frequent

## Dashboard Features

The Analytics Dashboard (`AnalyticsDashboard.tsx`) provides:

### Overview Tab
- Total messages (sent/received)
- Average response time
- Overall sentiment
- Active contacts count
- Channel distribution charts
- Daily activity graphs

### Response Times Tab
- Average response time
- Fastest/slowest responses
- Distribution (within 1h, 1-24h, 24h+)
- Per-channel breakdown

### Sentiment Tab
- Overall sentiment score
- Sentiment trend (improving/declining/stable)
- Positive/neutral/negative breakdown
- Sentiment timeline

### Contacts Tab
- Top engaged contacts
- Engagement scores
- Engagement trends
- Contact metadata

## Performance Considerations

### Batch Processing
For bulk imports or initial setup:
```typescript
const events = messages.map(msg => createMessageEvent(msg, 'email', true));
await analyticsCollector.trackMessageBatch(events);
```

### Daily Aggregation
Runs automatically once per day per session:
- Updates contact recency
- Calculates peak hours
- Aggregates daily metrics

### Async Tracking
All analytics tracking is non-blocking:
```typescript
// Fire and forget - won't slow down message sending
trackMessage(event).catch(err => console.error('Analytics error:', err));
```

## Troubleshooting

### No Data Showing

1. **Check if tables exist**:
   ```sql
   SELECT * FROM analytics_daily_metrics LIMIT 1;
   ```

2. **Run backfill**:
   ```typescript
   await backfillAnalytics(90);
   ```

3. **Verify RLS policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename LIKE 'analytics%';
   ```

### Engagement Scores Not Updating

1. **Recalculate scores**:
   ```sql
   SELECT recalculate_all_engagement_scores(auth.uid());
   ```

2. **Check contact tracking**:
   ```sql
   SELECT * FROM analytics_contact_engagement WHERE user_id = auth.uid();
   ```

### Response Times Missing

Ensure you're tracking replies with `replyToId`:
```typescript
await trackMessage({
  ...event,
  replyToId: originalMessageId  // Important!
});
```

## Future Enhancements

### AI Sentiment Analysis
Replace simple keyword matching with:
- OpenAI API
- Google Natural Language API
- Hugging Face models

### Predictive Analytics
- Predict response times
- Identify at-risk relationships
- Suggest optimal contact times

### Advanced Insights
- Topic extraction
- Conversation clustering
- Relationship strength scoring

## API Reference

### `analyticsCollector.trackMessageEvent(event)`
Track a single message event.

**Parameters:**
- `event.id` - Unique message ID
- `event.channel` - 'email' | 'sms' | 'slack'
- `event.contactIdentifier` - Email, phone, or Slack user ID
- `event.isSent` - true if sent by user, false if received
- `event.timestamp` - Message timestamp
- `event.content` - Message content (for sentiment)
- `event.replyToId` - ID of message being replied to (optional)

### `analyticsCollector.backfillAnalytics(daysBack)`
Process historical messages for analytics.

**Parameters:**
- `daysBack` - Number of days to look back (default: 90)

### `analyticsCollector.runDailyAggregation()`
Run daily aggregation tasks.

## Support

For issues or questions:
1. Check the console for error messages
2. Verify database migrations are applied
3. Ensure RLS policies allow access
4. Check that messages are being tracked

## License

Part of the Pulse communication platform.
