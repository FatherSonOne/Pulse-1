# Usage Examples

## Comprehensive Code Examples for In-App Messaging

This document provides 20+ practical examples for implementing in-app messages in Pulse.

---

## Table of Contents

1. [Basic Triggers](#basic-triggers)
2. [Common Patterns](#common-patterns)
3. [Advanced Triggers](#advanced-triggers)
4. [Admin Operations](#admin-operations)
5. [Analytics Queries](#analytics-queries)
6. [Custom Integrations](#custom-integrations)

---

## Basic Triggers

### Example 1: User Signup

```tsx
import { useMessageTrigger } from '../hooks/useMessageTrigger';

function SignupForm() {
  const { triggerMessage } = useMessageTrigger();

  const handleSignup = async (email: string, password: string) => {
    const user = await authService.signup(email, password);

    // Trigger welcome message
    triggerMessage('user_signup', {
      user_id: user.id,
      email: user.email,
      signup_date: new Date().toISOString(),
    });

    // Navigate to dashboard
    navigate('/dashboard');
  };

  return (
    <form onSubmit={handleSignup}>
      {/* form fields */}
    </form>
  );
}
```

### Example 2: First Message Sent

```tsx
function MessageComposer() {
  const { triggerMessage } = useMessageTrigger();
  const [messageCount, setMessageCount] = useState(0);

  const sendMessage = async (content: string) => {
    // Send message via API
    await api.sendMessage(content);

    // Track message count
    const newCount = messageCount + 1;
    setMessageCount(newCount);

    // Trigger on first message only
    if (newCount === 1) {
      triggerMessage('first_message_sent', {
        workspace_id: currentWorkspace.id,
        message_length: content.length,
      });
    } else {
      // Trigger generic message sent event
      triggerMessage('message_sent', {
        workspace_id: currentWorkspace.id,
      });
    }
  };

  return (
    <textarea onBlur={(e) => sendMessage(e.target.value)} />
  );
}
```

### Example 3: Workspace Created

```tsx
function CreateWorkspaceButton() {
  const { triggerMessage } = useMessageTrigger();

  const handleCreate = async () => {
    const workspace = await api.createWorkspace({
      name: workspaceName,
      duration: 60,
    });

    triggerMessage('workspace_created', {
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      created_at: workspace.created_at,
    });

    navigate(`/workspace/${workspace.id}`);
  };

  return (
    <button onClick={handleCreate}>
      Create New Workspace
    </button>
  );
}
```

---

## Common Patterns

### Example 4: Using Common Trigger Hooks

```tsx
import { useCommonTriggers } from '../hooks/useMessageTrigger';

function TeamInviteModal() {
  const { onTeamInvited } = useCommonTriggers();

  const sendInvites = async (emails: string[]) => {
    await api.inviteUsers(emails);

    // Automatically triggers 'team_invited' event
    onTeamInvited(emails);

    setShowModal(false);
  };

  return (
    <div>
      <input type="email" />
      <button onClick={() => sendInvites([email])}>
        Invite
      </button>
    </div>
  );
}
```

### Example 5: Conditional Trigger

```tsx
function ProfileForm() {
  const { triggerIf } = useMessageTrigger();

  const handleSave = async (profile: UserProfile) => {
    await api.updateProfile(profile);

    // Only trigger if profile is incomplete
    const missingFields = getMissingFields(profile);
    triggerIf(
      missingFields.length > 0,
      'profile_incomplete',
      { missing_fields: missingFields }
    );
  };

  return <form onSubmit={handleSave}>{/* fields */}</form>;
}

function getMissingFields(profile: UserProfile): string[] {
  const fields: string[] = [];
  if (!profile.avatar) fields.push('avatar');
  if (!profile.bio) fields.push('bio');
  if (!profile.location) fields.push('location');
  return fields;
}
```

### Example 6: Multiple Triggers

```tsx
function FirstTimeSetup() {
  const { triggerMultiple } = useMessageTrigger();

  const completeSetup = async () => {
    // Create workspace + invite team + complete profile
    await Promise.all([
      api.createWorkspace(),
      api.inviteTeam(teamEmails),
      api.completeProfile(userData),
    ]);

    // Trigger multiple events at once
    triggerMultiple(
      ['workspace_created', 'team_invited', 'user_signup'],
      { setup_completed: true }
    );

    navigate('/dashboard');
  };

  return (
    <button onClick={completeSetup}>
      Complete Setup
    </button>
  );
}
```

---

## Advanced Triggers

### Example 7: Page View Tracking

```tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCommonTriggers } from '../hooks/useMessageTrigger';

function AppRouter() {
  const location = useLocation();
  const { onPageView } = useCommonTriggers();

  useEffect(() => {
    // Trigger page view on route change
    onPageView(location.pathname);
  }, [location.pathname, onPageView]);

  return <Routes>{/* routes */}</Routes>;
}
```

### Example 8: Inactivity Detection

```tsx
import { useActivityTracking } from '../hooks/useMessageTrigger';

function ActivityMonitor() {
  const { checkInactivity } = useActivityTracking();
  const [lastActive, setLastActive] = useState(new Date());

  useEffect(() => {
    // Check inactivity every hour
    const interval = setInterval(() => {
      checkInactivity(lastActive);
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, [lastActive, checkInactivity]);

  // Update last active on any user interaction
  useEffect(() => {
    const handleActivity = () => setLastActive(new Date());

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('click', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, []);

  return null; // Silent monitoring component
}
```

### Example 9: First Group Joined

```tsx
function GroupList() {
  const { triggerMessage } = useMessageTrigger();
  const [joinedGroups, setJoinedGroups] = useState<string[]>([]);

  const joinGroup = async (groupId: string) => {
    await api.joinGroup(groupId);

    const newJoinedGroups = [...joinedGroups, groupId];
    setJoinedGroups(newJoinedGroups);

    // Trigger on first group joined
    if (newJoinedGroups.length === 1) {
      triggerMessage('first_group_joined', {
        group_id: groupId,
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <div>
      {groups.map((group) => (
        <button key={group.id} onClick={() => joinGroup(group.id)}>
          Join {group.name}
        </button>
      ))}
    </div>
  );
}
```

### Example 10: Custom Event with Complex Metadata

```tsx
function PurchaseComplete() {
  const { triggerMessage } = useMessageTrigger();

  const handlePurchase = async (plan: Plan) => {
    const purchase = await api.completePurchase(plan.id);

    // Trigger custom event with rich metadata
    triggerMessage('upgrade_purchased', {
      plan_id: plan.id,
      plan_name: plan.name,
      price: plan.price,
      billing_cycle: plan.billingCycle,
      purchase_id: purchase.id,
      currency: 'USD',
      payment_method: 'credit_card',
      timestamp: new Date().toISOString(),
    });

    navigate('/thank-you');
  };

  return (
    <button onClick={() => handlePurchase(selectedPlan)}>
      Upgrade Now
    </button>
  );
}
```

---

## Admin Operations

### Example 11: Create Message Programmatically

```tsx
import { messageService } from '../services/messageService';

async function createWelcomeMessage() {
  const message = await messageService.createMessage(
    {
      title: 'Welcome to Pulse!',
      body: 'Get started by sending your first message.',
      cta_text: 'Send Message',
      cta_url: '/messages',
      trigger_event: 'user_signup',
      target_segment: 'new_users',
      priority: 90,
      max_displays_per_user: 1,
      auto_dismiss_seconds: 10,
      active: true,
    },
    'admin_user_id'
  );

  console.log('Created message:', message);
}
```

### Example 12: Update Existing Message

```tsx
async function pauseMessage(messageId: string) {
  const updated = await messageService.updateMessage({
    id: messageId,
    active: false, // Pause the message
  });

  console.log('Message paused:', updated);
}

async function updateMessageContent(messageId: string) {
  const updated = await messageService.updateMessage({
    id: messageId,
    title: 'Updated Title',
    body: 'Updated body text with new information.',
    priority: 80, // Increase priority
  });

  console.log('Message updated:', updated);
}
```

### Example 13: Bulk Message Creation

```tsx
async function createOnboardingMessages() {
  const messages = [
    {
      title: 'Welcome!',
      body: 'Start by creating your first workspace.',
      trigger_event: 'user_signup',
      target_segment: 'new_users',
      priority: 100,
    },
    {
      title: 'Great job!',
      body: 'Now invite your team to collaborate.',
      trigger_event: 'first_message_sent',
      target_segment: 'new_users',
      priority: 90,
    },
    {
      title: 'You\'re on fire!',
      body: 'Keep the momentum going.',
      trigger_event: 'team_invited',
      target_segment: 'new_users',
      priority: 80,
    },
  ];

  for (const msg of messages) {
    await messageService.createMessage(msg, 'admin_user_id');
  }

  console.log('Created', messages.length, 'messages');
}
```

### Example 14: Schedule Campaign

```tsx
async function scheduleHolidayCampaign() {
  const startDate = new Date('2025-12-01');
  const endDate = new Date('2025-12-31');

  const message = await messageService.createMessage(
    {
      title: 'Happy Holidays!',
      body: 'Special offer: 20% off all plans this December.',
      cta_text: 'Claim Offer',
      cta_url: '/pricing',
      trigger_event: 'page_view',
      target_segment: 'all',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      priority: 95,
      max_displays_per_user: 3, // Show up to 3 times
      auto_dismiss_seconds: 15,
      active: true,
    },
    'admin_user_id'
  );

  console.log('Campaign scheduled:', message);
}
```

---

## Analytics Queries

### Example 15: Get Message Performance

```tsx
import { messageService } from '../services/messageService';

async function analyzeMessage(messageId: string) {
  const metrics = await messageService.getMessageMetrics(messageId);

  console.log('Total Shown:', metrics.total_shown);
  console.log('Open Rate:', metrics.open_rate + '%');
  console.log('Click Rate:', metrics.click_rate + '%');
  console.log('CTA Conversion:', metrics.cta_conversion_rate + '%');
  console.log('Avg Duration:', metrics.avg_view_duration + 's');

  // Determine message effectiveness
  if (metrics.open_rate > 20 && metrics.cta_conversion_rate > 10) {
    console.log('✅ High-performing message!');
  } else if (metrics.open_rate < 5) {
    console.log('⚠️ Low engagement - consider updating content');
  }
}
```

### Example 16: Compare Message Performance

```tsx
async function compareMessages(messageIds: string[]) {
  const comparisons = await Promise.all(
    messageIds.map(async (id) => {
      const message = await messageService.getMessage(id);
      const metrics = await messageService.getMessageMetrics(id);
      return { message, metrics };
    })
  );

  // Sort by CTA conversion rate
  comparisons.sort(
    (a, b) => b.metrics.cta_conversion_rate - a.metrics.cta_conversion_rate
  );

  console.log('Best performing messages:');
  comparisons.forEach(({ message, metrics }) => {
    console.log(
      `${message.title}: ${metrics.cta_conversion_rate}% conversion`
    );
  });
}
```

### Example 17: Retention Analysis

```tsx
async function analyzeRetentionImpact() {
  const retention = await messageService.getRetentionByEngagement();

  retention.forEach((cohort) => {
    console.log(`\n${cohort.engagement_level}:`);
    console.log(`  Users: ${cohort.total_users}`);
    console.log(`  Day 1: ${cohort.day_1_retention_rate}%`);
    console.log(`  Day 7: ${cohort.day_7_retention_rate}%`);
    console.log(`  Day 30: ${cohort.day_30_retention_rate}%`);
  });

  // Calculate retention lift
  const high = retention.find((r) => r.engagement_level === 'High Engagement');
  const none = retention.find((r) => r.engagement_level === 'No Engagement');

  if (high && none) {
    const day7Lift =
      ((high.day_7_retention_rate - none.day_7_retention_rate) /
        none.day_7_retention_rate) *
      100;

    console.log(`\nDay 7 Retention Lift: +${day7Lift.toFixed(1)}%`);
  }
}
```

### Example 18: User Interaction History

```tsx
async function getUserMessageHistory(userId: string) {
  const interactions = await messageService.getUserInteractions(userId);

  // Group by message
  const byMessage = interactions.reduce((acc, interaction) => {
    if (!acc[interaction.message_id]) {
      acc[interaction.message_id] = [];
    }
    acc[interaction.message_id].push(interaction);
    return acc;
  }, {} as Record<string, typeof interactions>);

  console.log(`User ${userId} has interacted with`, Object.keys(byMessage).length, 'messages');

  // Analyze engagement
  const clicked = interactions.filter((i) =>
    ['clicked', 'cta_clicked'].includes(i.interaction_type)
  ).length;
  const dismissed = interactions.filter((i) => i.interaction_type === 'dismissed').length;

  console.log(`Engagement: ${clicked} clicks, ${dismissed} dismissals`);
}
```

---

## Custom Integrations

### Example 19: Integrate with Existing Analytics

```tsx
import { messageService } from '../services/messageService';
import { analytics } from '../services/analytics'; // Your existing analytics

// Wrap message service to track in your analytics
async function trackMessageShown(messageId: string, userId: string) {
  const interaction = await messageService.trackInteraction({
    message_id: messageId,
    user_id: userId,
    interaction_type: 'shown',
    trigger_event: 'custom_trigger',
  });

  // Also track in your existing analytics
  analytics.track('in_app_message_shown', {
    message_id: messageId,
    user_id: userId,
    timestamp: interaction.created_at,
  });

  return interaction;
}

async function trackMessageClicked(messageId: string, userId: string) {
  const interaction = await messageService.trackInteraction({
    message_id: messageId,
    user_id: userId,
    interaction_type: 'cta_clicked',
    trigger_event: 'custom_trigger',
  });

  // Track in your existing analytics
  analytics.track('in_app_message_clicked', {
    message_id: messageId,
    user_id: userId,
    timestamp: interaction.created_at,
  });

  return interaction;
}
```

### Example 20: Custom Segment Matcher

```tsx
// Extend messageService to add custom segment matching
import { messageService } from '../services/messageService';

// Custom function to check if user is in a specific segment
async function isUserInCustomSegment(
  userId: string,
  segmentFilter: any
): Promise<boolean> {
  // Fetch user data
  const user = await api.getUser(userId);
  const userActivity = await api.getUserActivity(userId);

  // Evaluate custom conditions
  if (segmentFilter.days_since_signup) {
    const daysSince = getDaysSinceSignup(user.created_at);
    if (!evalCondition(daysSince, segmentFilter.days_since_signup)) {
      return false;
    }
  }

  if (segmentFilter.messages_sent_count) {
    if (!evalCondition(userActivity.message_count, segmentFilter.messages_sent_count)) {
      return false;
    }
  }

  if (segmentFilter.workspaces_joined) {
    if (!evalCondition(userActivity.workspace_count, segmentFilter.workspaces_joined)) {
      return false;
    }
  }

  return true;
}

// Helper to evaluate conditions like "< 7", "> 10", "== 5"
function evalCondition(value: number, condition: string): boolean {
  const match = condition.match(/(<=?|>=?|==)\s*(\d+)/);
  if (!match) return false;

  const [, operator, threshold] = match;
  const thresholdNum = parseInt(threshold, 10);

  switch (operator) {
    case '<':
      return value < thresholdNum;
    case '<=':
      return value <= thresholdNum;
    case '>':
      return value > thresholdNum;
    case '>=':
      return value >= thresholdNum;
    case '==':
      return value === thresholdNum;
    default:
      return false;
  }
}
```

### Example 21: Real-time Message Updates

```tsx
import { useEffect, useState } from 'react';
import { messageService } from '../services/messageService';

function AdminDashboard() {
  const [messages, setMessages] = useState<InAppMessage[]>([]);

  useEffect(() => {
    // Load initial messages
    messageService.getAllMessages().then(setMessages);

    // Subscribe to real-time updates
    const subscription = messageService.subscribeToMessages((message) => {
      console.log('Message updated:', message);

      // Update local state
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === message.id);
        if (index >= 0) {
          // Update existing
          const updated = [...prev];
          updated[index] = message;
          return updated;
        } else {
          // Add new
          return [...prev, message];
        }
      });
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div>
      <h1>Messages ({messages.length})</h1>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.title}</div>
      ))}
    </div>
  );
}
```

### Example 22: Message A/B Testing (Custom Implementation)

```tsx
// Custom A/B testing for messages
async function createABTest(baseMessage: CreateInAppMessageDTO) {
  // Variant A: Original
  const variantA = await messageService.createMessage(
    {
      ...baseMessage,
      title: baseMessage.title + ' (A)',
      segment_filter: { ab_test_group: 'A' },
    },
    'admin_id'
  );

  // Variant B: Alternative
  const variantB = await messageService.createMessage(
    {
      ...baseMessage,
      title: 'Alternative Title (B)',
      body: 'Alternative body text to test performance.',
      segment_filter: { ab_test_group: 'B' },
    },
    'admin_id'
  );

  console.log('A/B test created:', { variantA, variantB });

  return { variantA, variantB };
}

// Assign users to A/B test groups
function assignABTestGroup(userId: string): 'A' | 'B' {
  // Simple hash-based assignment (50/50 split)
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return hash % 2 === 0 ? 'A' : 'B';
}

// Compare A/B test results
async function compareABTest(variantAId: string, variantBId: string) {
  const [metricsA, metricsB] = await Promise.all([
    messageService.getMessageMetrics(variantAId),
    messageService.getMessageMetrics(variantBId),
  ]);

  console.log('Variant A:');
  console.log('  Open Rate:', metricsA.open_rate + '%');
  console.log('  CTA Conversion:', metricsA.cta_conversion_rate + '%');

  console.log('\nVariant B:');
  console.log('  Open Rate:', metricsB.open_rate + '%');
  console.log('  CTA Conversion:', metricsB.cta_conversion_rate + '%');

  // Determine winner
  if (metricsB.cta_conversion_rate > metricsA.cta_conversion_rate) {
    console.log('\n🏆 Variant B wins!');
    return 'B';
  } else {
    console.log('\n🏆 Variant A wins!');
    return 'A';
  }
}
```

---

## Best Practices

### 1. Always Include Metadata

```tsx
// ❌ Bad: No metadata
triggerMessage('workspace_created');

// ✅ Good: Rich metadata
triggerMessage('workspace_created', {
  workspace_id: workspace.id,
  workspace_name: workspace.name,
  user_role: 'owner',
  created_at: new Date().toISOString(),
  source: 'dashboard',
});
```

### 2. Handle Errors Gracefully

```tsx
const handleAction = async () => {
  try {
    await performAction();
    triggerMessage('action_completed');
  } catch (error) {
    console.error('Action failed:', error);
    // Don't trigger success message on error
  }
};
```

### 3. Use Type-Safe Triggers

```tsx
// Define custom trigger types
type CustomTriggerEvent =
  | TriggerEvent
  | 'upgrade_purchased'
  | 'trial_expired'
  | 'feature_discovered';

const triggerCustomMessage = (event: CustomTriggerEvent, metadata?: any) => {
  triggerMessage(event as TriggerEvent, metadata);
};
```

### 4. Debounce Frequent Events

```tsx
import { debounce } from 'lodash';

const debouncedTrigger = debounce(
  (event: TriggerEvent, metadata: any) => {
    triggerMessage(event, metadata);
  },
  1000 // Wait 1 second before triggering
);

// Use in high-frequency events
window.addEventListener('scroll', () => {
  debouncedTrigger('page_view', { section: 'features' });
});
```

### 5. Test Messages Before Activating

```tsx
// Create inactive message for testing
const testMessage = await messageService.createMessage(
  {
    title: 'Test Message',
    body: 'This is a test.',
    trigger_event: 'user_signup',
    target_segment: 'all',
    active: false, // Start inactive
  },
  'admin_id'
);

// Test manually by temporarily activating
// Then deactivate before going live
```

---

## Next Steps

1. **Copy examples** that match your use cases
2. **Adapt code** to your specific needs
3. **Test thoroughly** before deploying
4. **Monitor analytics** to optimize performance
5. **Iterate** based on user feedback and data

---

**For More Information:**
- [Integration Setup](./integration-setup.md)
- [Architecture Summary](./architecture-summary.md)
- [README](./in-app-messaging-README.md)
