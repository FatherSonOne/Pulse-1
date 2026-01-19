# Integration Setup Guide

## Step-by-Step Implementation for Pulse In-App Messaging

This guide walks you through integrating the in-app messaging system into your Pulse application. Follow these steps in order for a smooth implementation.

---

## Prerequisites

- Pulse application running with React + TypeScript
- Supabase project set up and connected
- Access to Supabase SQL Editor
- Node.js environment for development

---

## Step 1: Database Setup (5 minutes)

### 1.1 Open Supabase SQL Editor

1. Log into your Supabase dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**

### 1.2 Run Migration Script

Copy the entire contents of `database-migration-in-app-messaging.sql` and execute it.

This creates:
- 3 tables: `in_app_messages`, `message_interactions`, `user_retention_cohorts`
- 8+ indexes for performance
- RLS policies for security
- 2 analytics functions
- 3 sample messages for testing

**Verify:**
```sql
-- Run this to verify tables were created
SELECT tablename FROM pg_tables
WHERE tablename IN ('in_app_messages', 'message_interactions', 'user_retention_cohorts');
```

You should see all 3 tables listed.

---

## Step 2: Copy TypeScript Files (3 minutes)

### 2.1 Copy Type Definitions

**File:** `src/types/message-types.ts`

This file already exists in your project. No action needed if you followed the setup.

### 2.2 Copy Service Layer

**File:** `src/services/messageService.ts`

This provides all CRUD operations, segment matching, and analytics.

### 2.3 Copy Hook

**File:** `src/hooks/useMessageTrigger.ts`

Create the `hooks` folder if it doesn't exist:
```bash
mkdir src/hooks
```

---

## Step 3: Copy React Components (5 minutes)

### 3.1 Display Components

Copy these to `src/components/`:
- `MessagePrompt.tsx` - Individual message display
- `MessageContainer.tsx` - Message queue management

### 3.2 Admin Components

Copy these to `src/components/`:
- `AdminMessageEditor.tsx` - No-code message editor
- `MessageAnalytics.tsx` - Analytics dashboard

**Verify:**
```bash
ls src/components/Message*.tsx
# Should show: MessagePrompt.tsx, MessageContainer.tsx
ls src/components/Admin*.tsx
# Should show: AdminMessageEditor.tsx
ls src/components/MessageAnalytics.tsx
# Should show: MessageAnalytics.tsx
```

---

## Step 4: Update App.tsx (2 minutes)

### 4.1 Import MessageContainer

At the top of `src/App.tsx`:

```tsx
import MessageContainer from './components/MessageContainer';
```

### 4.2 Wrap Your App

Find your main app return statement and wrap it:

**Before:**
```tsx
function App() {
  return (
    <div className="App">
      {/* Your existing app */}
      <Dashboard />
      <Messages />
      {/* etc. */}
    </div>
  );
}
```

**After:**
```tsx
function App() {
  const user = getSessionUser(); // Use your existing user retrieval

  return (
    <MessageContainer userId={user?.id || 'anonymous'}>
      <div className="App">
        {/* Your existing app */}
        <Dashboard />
        <Messages />
        {/* etc. */}
      </div>
    </MessageContainer>
  );
}
```

**Important Notes:**
- Ensure `user.id` is available before wrapping
- If no user is logged in, you can skip MessageContainer or use a default ID
- MessageContainer should wrap ALL routes/views where messages should appear

---

## Step 5: Add Admin Routes (3 minutes)

### 5.1 Create Admin Routes

In your routing setup (likely `App.tsx` or a separate routes file):

```tsx
import AdminMessageEditor from './components/AdminMessageEditor';
import MessageAnalytics from './components/MessageAnalytics';

// In your AppView enum or route definitions:
enum AppView {
  // ... existing views
  MESSAGE_ADMIN = 'MESSAGE_ADMIN',
  MESSAGE_ANALYTICS = 'MESSAGE_ANALYTICS',
}

// In your view renderer:
{currentView === AppView.MESSAGE_ADMIN && (
  <AdminMessageEditor userId={user.id} />
)}

{currentView === AppView.MESSAGE_ANALYTICS && (
  <MessageAnalytics />
)}
```

### 5.2 Add Navigation Links

In your sidebar or settings menu:

```tsx
<button onClick={() => setView(AppView.MESSAGE_ADMIN)}>
  <i className="fa-solid fa-message"></i>
  Manage Messages
</button>

<button onClick={() => setView(AppView.MESSAGE_ANALYTICS)}>
  <i className="fa-solid fa-chart-line"></i>
  Message Analytics
</button>
```

---

## Step 6: Add Your First Trigger (5 minutes)

### 6.1 Choose a Component to Add Trigger

Example: Let's add a trigger when a user sends their first message.

**File:** `src/components/Messages.tsx` (or your messaging component)

### 6.2 Import Hook

```tsx
import { useMessageTrigger } from '../hooks/useMessageTrigger';
```

### 6.3 Use Hook in Component

```tsx
const Messages: React.FC = () => {
  const { triggerMessage } = useMessageTrigger();
  const [messageCount, setMessageCount] = useState(0);

  const handleSendMessage = async (content: string) => {
    // ... your existing send logic

    // Increment counter
    const newCount = messageCount + 1;
    setMessageCount(newCount);

    // Trigger on first message
    if (newCount === 1) {
      triggerMessage('first_message_sent', {
        workspace_id: currentWorkspaceId,
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    // ... your component JSX
  );
};
```

### 6.4 Add More Triggers (Optional)

Common places to add triggers:

**User Signup** (`src/components/Login.tsx`):
```tsx
const handleSignup = async () => {
  const user = await authService.signup(email, password);
  triggerMessage('user_signup', { user_id: user.id });
};
```

**Workspace Creation** (`src/components/Dashboard.tsx`):
```tsx
const createWorkspace = async () => {
  const workspace = await createNewWorkspace();
  triggerMessage('workspace_created', { workspace_id: workspace.id });
};
```

**Team Invite** (`src/components/Settings.tsx`):
```tsx
const inviteTeam = async (emails: string[]) => {
  await sendInvites(emails);
  triggerMessage('team_invited', { invited_count: emails.length });
};
```

---

## Step 7: Create Your First Message (2 minutes)

### 7.1 Access Admin Panel

Navigate to the Message Admin view you set up in Step 5.

### 7.2 Click "New Message"

### 7.3 Fill Out Form

**Example: Welcome Message**

| Field | Value |
|-------|-------|
| Title | Welcome to Pulse! |
| Body | Get started by sending your first message or creating a workspace. |
| CTA Text | Send Message |
| CTA URL | /messages |
| Trigger Event | User Signup |
| Target Segment | New Users |
| Priority | 90 |
| Max Displays | 1 |
| Auto-Dismiss | 8 seconds |
| Active | ✓ Checked |

### 7.4 Save Message

Click **Create Message**. You should see a success message.

---

## Step 8: Test Your Implementation (3 minutes)

### 8.1 Test Message Display

1. In your development environment, trigger the event manually:
   ```tsx
   // In browser console or component
   triggerMessage('user_signup');
   ```

2. You should see a message appear in the bottom-right corner

3. Verify:
   - ✓ Message shows correct title and body
   - ✓ CTA button is visible (if configured)
   - ✓ Message auto-dismisses after 8 seconds
   - ✓ Click on message tracks interaction
   - ✓ Click on CTA navigates to correct URL

### 8.2 Test Admin Panel

1. Navigate to Message Admin
2. Verify:
   - ✓ Your created message appears in list
   - ✓ Edit button opens form with populated data
   - ✓ Can create a second message
   - ✓ Can toggle active/inactive

### 8.3 Test Analytics

1. After displaying a few messages, navigate to Analytics
2. Verify:
   - ✓ Metrics show correct counts
   - ✓ Open rate, click rate calculate correctly
   - ✓ Funnel visualization displays
   - ✓ Retention data appears (after some user activity)

---

## Step 9: Production Checklist

Before deploying to production:

### Database
- [ ] Migration script executed on production Supabase
- [ ] RLS policies verified and tested
- [ ] Indexes created for performance
- [ ] Sample messages removed or deactivated

### Code
- [ ] All TypeScript files compiled without errors
- [ ] No console.error or warnings in browser
- [ ] MessageContainer wraps entire app
- [ ] User ID properly passed to MessageContainer

### Security
- [ ] RLS policies match your authentication system
- [ ] Admin routes protected (only admins can access)
- [ ] User IDs validated before tracking interactions

### Performance
- [ ] Message queries optimized
- [ ] Queue size limited (default: 3)
- [ ] Auto-dismiss configured reasonably (8s default)
- [ ] Frequency caps set on all messages

### Testing
- [ ] Messages display correctly in all browsers
- [ ] Dark mode styling looks good
- [ ] Mobile responsive (test on small screens)
- [ ] No duplicate messages appear
- [ ] Analytics tracking works

---

## Step 10: Advanced Configuration (Optional)

### Custom Segment Filters

Create a message with custom segment filter:

```json
{
  "days_since_signup": "< 7",
  "messages_sent_count": "> 0",
  "workspaces_joined": ">= 1"
}
```

Implement matching logic in `messageService.ts`:

```tsx
private async evaluateCustomFilter(
  userId: string,
  filter: SegmentFilter
): Promise<SegmentMatchResult> {
  // Fetch user data
  const userData = await getUserData(userId);

  // Evaluate conditions
  if (filter.days_since_signup) {
    const days = getDaysSinceSignup(userData.created_at);
    if (!evalCondition(days, filter.days_since_signup)) {
      return { matches: false, reason: 'Days since signup not met' };
    }
  }

  // ... more conditions

  return { matches: true, reason: 'All filters matched' };
}
```

### Scheduled Messages

To schedule recurring messages:

1. Create message with start/end dates in admin panel
2. Use external scheduler (e.g., Supabase cron jobs) to reactivate:

```sql
-- Example: Reactivate dormant user message weekly
SELECT cron.schedule(
  'reactivate-dormant-message',
  '0 0 * * 0', -- Every Sunday midnight
  $$
  UPDATE in_app_messages
  SET active = true, start_date = NOW()
  WHERE trigger_event = 'no_activity_7d' AND id = 'message_id';
  $$
);
```

### Custom Message Styling

Edit `MessagePrompt.tsx` to customize appearance:

```tsx
// Change position
className="fixed bottom-4 left-4 z-50" // Bottom-left

// Change colors
className="bg-blue-50 dark:bg-blue-900" // Blue theme

// Change size
className="max-w-md w-full" // Larger width

// Change animation
className="animate-bounce" // Different animation
```

---

## Troubleshooting

### Messages Not Appearing

**Check:**
1. Is MessageContainer wrapping your app?
2. Is `userId` being passed correctly?
3. Are messages set to `active: true`?
4. Does the trigger event match your `triggerMessage()` call?
5. Check browser console for errors

**Debug:**
```tsx
// Add to MessageContainer.tsx
console.log('Triggering message:', event, userId);
console.log('Messages found:', messages);
```

### Analytics Not Tracking

**Check:**
1. Are interactions being inserted into `message_interactions` table?
2. Check Supabase logs for RLS policy errors
3. Verify `get_message_metrics` function exists

**Debug:**
```sql
-- Check if interactions are being recorded
SELECT * FROM message_interactions
ORDER BY created_at DESC
LIMIT 10;
```

### Admin Panel Not Saving

**Check:**
1. Are you passing correct `userId` to AdminMessageEditor?
2. Check Supabase logs for insert/update errors
3. Verify RLS policies allow admin operations

**Debug:**
```tsx
// Add to AdminMessageEditor.tsx handleSubmit
console.log('Saving message:', dto);
```

### Performance Issues

**Check:**
1. Are indexes created on all tables?
2. Is `maxQueueSize` set to reasonable value (3-5)?
3. Are you fetching too many messages at once?

**Optimize:**
```tsx
// Limit message fetching
const messages = await messageService.getMessagesByEvent(event, userId);
// Instead of fetching all messages every time
```

---

## Next Steps

1. **Read [architecture-summary.md](./architecture-summary.md)** to understand the system design
2. **Review [usage-examples.md](./usage-examples.md)** for more trigger patterns
3. **Experiment** with different messages and segments
4. **Monitor** analytics to optimize your messaging strategy
5. **Iterate** based on retention data

---

## Support Resources

- **Documentation:** `/docs` folder
- **Code Comments:** Inline documentation in all files
- **Supabase Docs:** https://supabase.com/docs
- **React Hooks:** https://react.dev/reference/react

---

**Congratulations!** Your in-app messaging system is now fully integrated.

Start creating messages and tracking their impact on user engagement and retention!
