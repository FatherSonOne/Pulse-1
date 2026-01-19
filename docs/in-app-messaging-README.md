# In-App Messaging System - README

## OneSignal-Style Event-Based Messaging for Pulse

A complete, production-ready in-app messaging system that allows you to create contextual, event-triggered messages to guide users, improve onboarding, and boost retention.

---

## Table of Contents

1. [Features](#features)
2. [Quick Start](#quick-start)
3. [Architecture Overview](#architecture-overview)
4. [File Structure](#file-structure)
5. [Key Concepts](#key-concepts)
6. [Usage Examples](#usage-examples)
7. [Analytics & Tracking](#analytics--tracking)
8. [Configuration](#configuration)
9. [FAQs](#faqs)

---

## Features

### For Users
- **Non-intrusive messaging**: Bottom-right toast-style prompts
- **Smart timing**: Event-triggered messages appear at the right moment
- **Auto-dismiss**: Messages automatically close after configurable duration
- **Call-to-action**: Optional CTA buttons for user engagement

### For Admins
- **No-code editor**: Create and manage messages without deployments
- **Event-based triggers**: 11+ pre-defined events (user_signup, first_message_sent, etc.)
- **Segment targeting**: Target specific user groups (new users, dormant users, etc.)
- **Scheduling**: Set start/end dates for campaigns
- **Priority system**: Control which messages show first

### For Analytics
- **Engagement metrics**: Open rate, click rate, CTA conversion
- **Retention tracking**: Measure impact on Day 1, 7, and 30 retention
- **Real-time dashboard**: Live analytics for all messages
- **Cohort analysis**: Compare retention by engagement level

---

## Quick Start

### 1. Run Database Migration

Open your Supabase SQL Editor and run:

```sql
-- See: database-migration-in-app-messaging.sql
-- This creates:
-- - in_app_messages table
-- - message_interactions table
-- - user_retention_cohorts table
-- - RLS policies
-- - Analytics functions
```

### 2. Wrap Your App with MessageContainer

In your `App.tsx` or main component:

```tsx
import MessageContainer from './components/MessageContainer';

function App() {
  const user = getCurrentUser(); // Your user retrieval logic

  return (
    <MessageContainer userId={user.id}>
      {/* Your existing app */}
      <YourRoutes />
    </MessageContainer>
  );
}
```

### 3. Trigger Messages in Components

```tsx
import { useMessageTrigger } from '../hooks/useMessageTrigger';

function MyComponent() {
  const { triggerMessage } = useMessageTrigger();

  const handleUserAction = () => {
    // ... your logic
    triggerMessage('first_message_sent', { workspace_id: workspaceId });
  };

  return <button onClick={handleUserAction}>Send Message</button>;
}
```

### 4. Create Your First Message

Access the Admin Message Editor at `/admin/messages` (or integrate into Settings):

```tsx
import AdminMessageEditor from './components/AdminMessageEditor';

function AdminPanel() {
  return <AdminMessageEditor userId={currentUser.id} />;
}
```

**Done!** Your in-app messaging system is live.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USER FLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Action  →  triggerMessage()  →  Match Active Messages│
│       ↓                                                     │
│  Check Segment  →  Queue Message  →  Display Prompt        │
│       ↓                                                     │
│  Track Interaction  →  Update Analytics  →  Close          │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      ADMIN FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Create Message  →  Configure Trigger & Segment             │
│       ↓                                                     │
│  Set Priority & Schedule  →  Activate Message               │
│       ↓                                                     │
│  View Analytics  →  Optimize Based on Data                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Admin** creates a message with trigger event and target segment
2. **User** performs an action that fires a trigger event
3. **MessageContainer** fetches matching messages from Supabase
4. **Segment matching** filters messages for the user
5. **Message queue** manages display order by priority
6. **MessagePrompt** renders the message with auto-dismiss timer
7. **Interactions** (shown, clicked, dismissed) are tracked in real-time
8. **Analytics** aggregates data for insights and retention correlation

---

## File Structure

```
pulse/
├── database-migration-in-app-messaging.sql    # Database setup
├── src/
│   ├── types/
│   │   └── message-types.ts                   # TypeScript definitions
│   ├── services/
│   │   └── messageService.ts                  # Core service layer
│   ├── components/
│   │   ├── MessagePrompt.tsx                  # Display component
│   │   ├── MessageContainer.tsx               # Container & context
│   │   ├── AdminMessageEditor.tsx             # No-code admin UI
│   │   └── MessageAnalytics.tsx               # Analytics dashboard
│   └── hooks/
│       └── useMessageTrigger.ts               # Trigger hooks
└── docs/
    ├── in-app-messaging-README.md             # This file
    ├── integration-setup.md                   # Step-by-step guide
    ├── architecture-summary.md                # Technical architecture
    └── usage-examples.md                      # Code examples
```

---

## Key Concepts

### Trigger Events

Events that can show messages:

| Event | Description | Use Case |
|-------|-------------|----------|
| `user_signup` | New user registration | Welcome message |
| `first_message_sent` | User sends first message | Encourage team invite |
| `first_group_joined` | User joins first group | Explain group features |
| `workspace_created` | New workspace created | Setup tips |
| `team_invited` | User invites team | Acknowledge action |
| `no_activity_24h` | No activity for 24 hours | Re-engagement |
| `no_activity_7d` | No activity for 7 days | Win-back campaign |
| `profile_incomplete` | Missing profile info | Complete profile prompt |
| `message_sent` | Any message sent | General tips |
| `group_created` | New group created | Collaboration tips |
| `page_view` | Custom page view | Feature discovery |

### Target Segments

Pre-defined user segments:

- **all**: Show to all users
- **new_users**: Users who signed up < 7 days ago
- **active_teams**: Users in teams with 3+ active members
- **dormant_users**: Users inactive for 7+ days
- **custom**: Define your own criteria with JSON filters

### Priority System

Messages are shown in priority order (0-100):
- **0-25**: Low priority
- **26-50**: Medium priority
- **51-75**: High priority
- **76-100**: Urgent

### Frequency Capping

Control how many times a user sees a message with `max_displays_per_user`.

---

## Usage Examples

### Basic Trigger

```tsx
import { useMessageTrigger } from '../hooks/useMessageTrigger';

function SendMessageButton() {
  const { triggerMessage } = useMessageTrigger();

  const handleSend = () => {
    // ... send logic
    triggerMessage('message_sent', { message_id: 'msg_123' });
  };

  return <button onClick={handleSend}>Send</button>;
}
```

### Using Common Triggers

```tsx
import { useCommonTriggers } from '../hooks/useMessageTrigger';

function WorkspaceCreator() {
  const { onWorkspaceCreated } = useCommonTriggers();

  const createWorkspace = async () => {
    const workspace = await api.createWorkspace();
    onWorkspaceCreated(workspace.id);
  };

  return <button onClick={createWorkspace}>Create Workspace</button>;
}
```

### Conditional Trigger

```tsx
const { triggerIf } = useMessageTrigger();

// Only trigger if user hasn't completed profile
triggerIf(!user.profileComplete, 'profile_incomplete', {
  missing_fields: ['avatar', 'bio']
});
```

### Multiple Triggers

```tsx
const { triggerMultiple } = useMessageTrigger();

triggerMultiple(['workspace_created', 'team_invited'], {
  workspace_id: 'ws_123'
});
```

---

## Analytics & Tracking

### Metrics Tracked

For each message:
- **Total Shown**: Number of times displayed
- **Open Rate**: % of users who clicked
- **Click Rate**: % of shows that got clicked
- **CTA Conversion**: % of shows that clicked CTA button
- **Avg View Duration**: Average time viewed before dismissing
- **Dismissal Rate**: % dismissed without interaction

### Retention Correlation

Track how message engagement correlates with retention:
- **Day 1 Retention**: Did user return next day?
- **Day 7 Retention**: Did user return after 7 days?
- **Day 30 Retention**: Did user return after 30 days?

Compare across engagement levels:
- High Engagement (3+ message clicks)
- Medium Engagement (1-2 message clicks)
- No Engagement (0 message clicks)

### Accessing Analytics

```tsx
import MessageAnalytics from './components/MessageAnalytics';

function AnalyticsPage() {
  return <MessageAnalytics />;
}
```

---

## Configuration

### Environment Variables

Already configured in your `.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### MessageContainer Props

```tsx
<MessageContainer
  userId={user.id}              // Required: Current user ID
  maxQueueSize={3}              // Optional: Max messages in queue (default: 3)
>
  {children}
</MessageContainer>
```

### Message Display Settings

Configured per message in AdminMessageEditor:
- **Auto-Dismiss**: 3-60 seconds (default: 8s)
- **Priority**: 0-100 (default: 50)
- **Max Displays**: 1-∞ (default: 1)

---

## FAQs

### Q: How do I add a custom trigger event?

Just use a custom string:
```tsx
triggerMessage('custom_event_name', { custom: 'data' });
```

Then create a message with that trigger in the admin panel.

### Q: Can I customize the message appearance?

Yes! Edit `MessagePrompt.tsx` to change colors, position, animations, etc.

### Q: How do I prevent duplicate messages?

The system automatically:
1. Checks `max_displays_per_user` frequency cap
2. Prevents same message from queueing twice
3. Limits queue size to prevent spam

### Q: Can I test messages before activating?

Yes! Set `active: false` when creating, test manually, then activate.

### Q: How do I handle multiple languages?

Store translations in message body:
```tsx
const message = isSpanish
  ? 'Bienvenido a Pulse'
  : 'Welcome to Pulse';
```

Or create separate messages per language with custom segment filters.

### Q: What if a user is offline?

Messages are triggered on client-side events, so they'll only show when user is active and online.

### Q: Can I schedule recurring messages?

Not natively, but you can:
1. Create multiple messages with different start dates
2. Use cron jobs to reactivate messages
3. Build a scheduler on top of the service

---

## Next Steps

1. **Read [integration-setup.md](./integration-setup.md)** for detailed implementation steps
2. **Review [architecture-summary.md](./architecture-summary.md)** for technical details
3. **Explore [usage-examples.md](./usage-examples.md)** for more code patterns
4. **Create your first message** and start tracking retention impact!

---

## Support

For issues or questions:
1. Check the documentation in `/docs`
2. Review code comments in source files
3. Inspect Supabase logs for errors
4. Test with `console.log` in messageService.ts

---

**Built for Pulse** | OneSignal-style in-app messaging
