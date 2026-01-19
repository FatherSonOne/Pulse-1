# In-App Messaging System - Integration Guide

## Overview
This guide shows you how to integrate the in-app messaging system into your Pulse application.

## Quick Start

### 1. Wrap Your App with MessageContainer

In your main `App.tsx` or root component:

```tsx
import React from 'react';
import MessageContainer from './components/MessageContainer';
import { useAuth } from './context/AuthContext'; // Your auth context

function App() {
  const { user } = useAuth();

  return (
    <MessageContainer userId={user?.id || ''} maxQueueSize={3}>
      {/* Your app components */}
      <YourAppComponents />
    </MessageContainer>
  );
}

export default App;
```

### 2. Trigger Messages from Components

Use the `useCommonTriggers` hook in your components:

```tsx
import React from 'react';
import { useCommonTriggers } from './hooks/useMessageTrigger';
import { useAuth } from './context/AuthContext';

function ChatInterface() {
  const { user } = useAuth();
  const {
    onFirstMessage,
    onMessageSent,
    onGroupCreated,
  } = useCommonTriggers(user?.id || '');

  const handleSendMessage = async (messageText: string) => {
    // Your message sending logic
    const message = await sendMessage(messageText);

    // Trigger in-app message
    onMessageSent(message.id, message.workspace_id);
  };

  const handleCreateGroup = async (groupName: string) => {
    // Your group creation logic
    const group = await createGroup(groupName);

    // Trigger in-app message
    onGroupCreated(group.id, group.name);
  };

  return (
    <div>
      {/* Your UI */}
    </div>
  );
}
```

### 3. Environment Setup

Create or update your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Available Trigger Events

The system supports these event triggers:

| Event | Description | When to Use |
|-------|-------------|-------------|
| `user_signup` | New user registration | After successful signup |
| `first_message_sent` | User sent their first message | On first message send |
| `first_group_joined` | User joined their first group | When user joins a group for the first time |
| `workspace_created` | New workspace created | After workspace creation |
| `team_invited` | User invited team members | When invitations are sent |
| `no_activity_24h` | User hasn't been active for 24 hours | Background check |
| `no_activity_7d` | User hasn't been active for 7 days | Background check |
| `profile_incomplete` | User profile is missing info | On profile check |
| `message_sent` | Any message sent (generic) | On every message send |
| `group_created` | New group created | When user creates a group |
| `page_view` | Custom page view event | On specific page loads |

## Usage Examples

### Example 1: Welcome New Users

```tsx
import { useCommonTriggers } from './hooks/useMessageTrigger';

function SignupPage() {
  const { onUserSignup } = useCommonTriggers(userId);

  const handleSignup = async (email: string, password: string) => {
    const user = await createUser(email, password);

    // Trigger welcome message
    onUserSignup();

    // Navigate to dashboard
    navigate('/dashboard');
  };

  return <SignupForm onSubmit={handleSignup} />;
}
```

### Example 2: Encourage Team Collaboration

```tsx
import { useCommonTriggers } from './hooks/useMessageTrigger';

function TeamInviteModal() {
  const { user } = useAuth();
  const { onTeamInvited } = useCommonTriggers(user.id);

  const handleInviteTeam = async (emails: string[]) => {
    await sendInvitations(emails);

    // Trigger message encouraging collaboration
    onTeamInvited(emails);

    closeModal();
  };

  return <InviteForm onSubmit={handleInviteTeam} />;
}
```

### Example 3: Check for Profile Completion

```tsx
import { useEffect } from 'react';
import { useCommonTriggers } from './hooks/useMessageTrigger';

function Dashboard() {
  const { user } = useAuth();
  const { onProfileIncomplete } = useCommonTriggers(user.id);

  useEffect(() => {
    // Check if profile is complete
    const missingFields = [];
    if (!user.avatar) missingFields.push('avatar');
    if (!user.bio) missingFields.push('bio');
    if (!user.phone) missingFields.push('phone');

    if (missingFields.length > 0) {
      onProfileIncomplete(missingFields);
    }
  }, [user, onProfileIncomplete]);

  return <DashboardUI />;
}
```

### Example 4: Track Page Views

```tsx
import { useEffect } from 'react';
import { useCommonTriggers } from './hooks/useMessageTrigger';

function PricingPage() {
  const { user } = useAuth();
  const { onPageView } = useCommonTriggers(user.id);

  useEffect(() => {
    // Track when user views pricing page
    onPageView('pricing');
  }, [onPageView]);

  return <PricingContent />;
}
```

### Example 5: Custom Trigger with Manual Control

```tsx
import { useMessageTrigger } from './hooks/useMessageTrigger';
import type { TriggerEvent } from './types/inAppMessages';

function CustomFeature() {
  const { user } = useAuth();
  const { triggerMessage } = useMessageTrigger();

  const handleSpecialAction = async () => {
    // Your custom logic
    await performAction();

    // Create custom trigger event
    const event: TriggerEvent = {
      type: 'message_sent', // or any event type
      userId: user.id,
      metadata: {
        custom_field: 'value',
        action_type: 'special',
      },
      timestamp: new Date(),
    };

    // Trigger message manually
    triggerMessage(event);
  };

  return <button onClick={handleSpecialAction}>Do Something</button>;
}
```

### Example 6: Monitor Inactive Users

```tsx
import { useEffect } from 'react';
import { useActivityTracking } from './hooks/useMessageTrigger';

function useInactivityMonitor() {
  const { user } = useAuth();
  const { checkInactivity } = useActivityTracking(user.id);

  useEffect(() => {
    // Check every hour
    const interval = setInterval(() => {
      const lastActive = new Date(user.last_active_at);
      checkInactivity(lastActive);
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, [user, checkInactivity]);
}

// Use in your App component
function App() {
  useInactivityMonitor();

  return <YourApp />;
}
```

## Creating Messages in Supabase Dashboard

### Step 1: Navigate to In-App Messages Table

1. Go to your Supabase dashboard
2. Click on "Table Editor"
3. Select `in_app_messages` table
4. Click "Insert row"

### Step 2: Fill in Message Details

```sql
-- Example message for new users
INSERT INTO in_app_messages (
  title,
  body,
  cta_text,
  cta_url,
  event_trigger,
  segment,
  is_active,
  priority,
  display_duration_seconds,
  position,
  style_type
) VALUES (
  'Welcome to Pulse!',
  'Get started by sending your first message to a team member.',
  'Send Message',
  '/messages',
  'user_signup',
  'new_users',
  true,
  100,
  10,
  'bottom-right',
  'success'
);
```

## User Segments

Target specific user groups:

- **all**: Show to all users
- **new_users**: Users who signed up in the last 7 days
- **active_teams**: Users in teams with 3+ members who sent messages in last 48h
- **dormant_users**: Users who haven't been active in 7+ days
- **custom**: Define custom rules with segment query

## Message Styling

Available style types:

- **info**: Blue border/button (default)
- **success**: Green border/button
- **warning**: Orange border/button
- **tip**: Purple border/button

## Message Positions

Available positions:

- `bottom-right` (default)
- `bottom-left`
- `top-right`
- `top-left`
- `center`

## Testing Your Integration

### 1. Create a Test Message

```sql
INSERT INTO in_app_messages (
  title,
  body,
  event_trigger,
  segment,
  is_active
) VALUES (
  'Test Message',
  'This is a test message to verify integration.',
  'page_view',
  'all',
  true
);
```

### 2. Trigger from Console

```tsx
// In your browser console or component
const event = {
  type: 'page_view',
  userId: 'your-user-id',
  metadata: {},
  timestamp: new Date(),
};

// Trigger manually
triggerMessage(event);
```

## Troubleshooting

### Messages Not Showing?

1. **Check Supabase connection**
   ```bash
   # Verify environment variables are set
   echo $VITE_SUPABASE_URL
   echo $VITE_SUPABASE_ANON_KEY
   ```

2. **Verify message is active**
   ```sql
   SELECT * FROM in_app_messages WHERE is_active = true;
   ```

3. **Check browser console**
   - Look for errors related to message service
   - Verify user ID is correct

4. **Check message schedule**
   - Ensure `starts_at` is not in the future
   - Ensure `ends_at` is not in the past

### TypeScript Errors?

Make sure all imports use the correct paths:

```tsx
import type { TriggerEvent, MessageEventTrigger } from './types/inAppMessages';
import { messageService } from './services/messageService';
import { MessagePrompt } from './components/MessagePrompt';
```

## Next Steps

1. ✅ Set up environment variables
2. ✅ Wrap app with MessageContainer
3. ✅ Create test messages in Supabase
4. ✅ Add triggers to your components
5. 📊 View analytics (see MessageAnalytics component)
6. 🎨 Customize message styling
7. 🎯 Create targeted campaigns

## Support

For issues or questions:
- Check the Supabase logs for errors
- Review the type definitions in `src/types/inAppMessages.ts`
- Inspect network requests in browser DevTools
