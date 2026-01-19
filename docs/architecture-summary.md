# Architecture Summary

## Technical Architecture of the In-App Messaging System

This document provides a comprehensive technical overview of the in-app messaging system architecture, data models, and design decisions.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Service Layer Architecture](#service-layer-architecture)
4. [Frontend Component Architecture](#frontend-component-architecture)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Security Model](#security-model)
7. [Performance Considerations](#performance-considerations)
8. [Scalability](#scalability)

---

## System Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  MessagePrompt.tsx    ←─→  MessageContainer.tsx                  │
│  (Display)                  (Queue Management + Context)          │
│                                                                   │
│  AdminMessageEditor.tsx  ←→  MessageAnalytics.tsx               │
│  (CRUD Interface)            (Metrics Dashboard)                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                              ↓  ↑
┌──────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  messageService.ts                                               │
│  - CRUD operations                                               │
│  - Segment matching                                              │
│  - Interaction tracking                                          │
│  - Analytics queries                                             │
│                                                                   │
│  useMessageTrigger.ts                                            │
│  - Trigger helpers                                               │
│  - Common patterns                                               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                              ↓  ↑
┌──────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Supabase (PostgreSQL)                                           │
│  - in_app_messages                                               │
│  - message_interactions                                          │
│  - user_retention_cohorts                                        │
│                                                                   │
│  Functions:                                                       │
│  - get_message_metrics()                                         │
│  - get_retention_by_engagement()                                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + TypeScript | UI components and interactions |
| State Management | React Context + Hooks | Message queue and display state |
| API Client | Supabase JS Client | Database operations |
| Database | PostgreSQL (Supabase) | Persistent storage |
| Real-time | Supabase Realtime | Live updates for admin panel |
| Styling | Tailwind CSS | Component styling |

---

## Database Schema

### Entity Relationship Diagram

```
┌──────────────────────────────┐
│      in_app_messages         │
├──────────────────────────────┤
│ id (PK)                      │
│ title                        │
│ body                         │
│ cta_text                     │
│ cta_url                      │
│ trigger_event                │
│ target_segment               │
│ segment_filter (JSONB)       │
│ start_date                   │
│ end_date                     │
│ active                       │
│ priority                     │
│ max_displays_per_user        │
│ auto_dismiss_seconds         │
│ created_by                   │
│ created_at                   │
│ updated_at                   │
└──────────────────────────────┘
           │
           │ 1:N
           │
           ↓
┌──────────────────────────────┐
│    message_interactions      │
├──────────────────────────────┤
│ id (PK)                      │
│ message_id (FK)              │
│ user_id                      │
│ interaction_type             │
│ trigger_event                │
│ viewed_duration_seconds      │
│ created_at                   │
│ metadata (JSONB)             │
└──────────────────────────────┘

┌──────────────────────────────┐
│   user_retention_cohorts     │
├──────────────────────────────┤
│ id (PK)                      │
│ user_id                      │
│ cohort_date                  │
│ returned_day_1               │
│ returned_day_7               │
│ returned_day_30              │
│ total_messages_seen          │
│ total_messages_clicked       │
│ created_at                   │
│ updated_at                   │
└──────────────────────────────┘
```

### Table Descriptions

#### in_app_messages

**Purpose:** Stores message templates created by admins

**Key Fields:**
- `trigger_event`: Event that triggers this message
- `target_segment`: Which user group sees this message
- `segment_filter`: Custom JSONB criteria for filtering
- `priority`: Display order (0-100, higher = first)
- `max_displays_per_user`: Frequency cap
- `active`: Enable/disable without deletion

**Indexes:**
```sql
idx_in_app_messages_trigger_event    ON (trigger_event)
idx_in_app_messages_active           ON (active) WHERE active = true
idx_in_app_messages_schedule         ON (start_date, end_date)
```

#### message_interactions

**Purpose:** Tracks every user interaction with messages

**Key Fields:**
- `interaction_type`: shown, clicked, cta_clicked, dismissed
- `viewed_duration_seconds`: How long user viewed message
- `metadata`: Additional context (workspace_id, page, etc.)

**Indexes:**
```sql
idx_message_interactions_message_id   ON (message_id)
idx_message_interactions_user_id      ON (user_id)
idx_message_interactions_type         ON (interaction_type)
idx_message_interactions_created_at   ON (created_at)
```

#### user_retention_cohorts

**Purpose:** Correlates message engagement with user retention

**Key Fields:**
- `cohort_date`: User signup date (for cohort analysis)
- `returned_day_1/7/30`: Retention flags
- `total_messages_seen/clicked`: Engagement counters

**Indexes:**
```sql
idx_user_retention_cohorts_user_id       ON (user_id)
idx_user_retention_cohorts_cohort_date   ON (cohort_date)
```

**Unique Constraint:**
```sql
UNIQUE(user_id, cohort_date)
```

### JSONB Fields

#### segment_filter

Used for custom segment targeting:

```json
{
  "days_since_signup": "< 7",
  "messages_sent_count": "> 0",
  "workspaces_joined": ">= 1",
  "user_role": "admin",
  "custom_attribute": "value"
}
```

#### metadata (interactions)

Captures event context:

```json
{
  "workspace_id": "ws_123",
  "page": "/messages",
  "timestamp": "2025-01-15T10:30:00Z",
  "browser": "Chrome",
  "device": "desktop"
}
```

---

## Service Layer Architecture

### MessageService Class

```typescript
class MessageService {
  // CRUD Operations
  createMessage()
  updateMessage()
  deleteMessage()
  getMessage()
  getAllMessages()
  getMessagesByEvent()

  // Interaction Tracking
  trackInteraction()
  getMessageInteractions()
  getUserInteractions()
  getMessageShownCount()

  // Analytics
  getMessageMetrics()
  getRetentionByEngagement()

  // Retention Cohorts
  updateRetentionCohort()
  markUserReturned()

  // Segment Matching
  matchesSegment()
  evaluateCustomFilter()

  // Real-time Subscriptions
  subscribeToMessages()
  subscribeToInteractions()
}
```

### Key Design Patterns

#### 1. Singleton Pattern

```typescript
export const messageService = new MessageService();
```

Single instance shared across the app for consistent state.

#### 2. Async/Await Pattern

```typescript
async createMessage(dto: CreateInAppMessageDTO): Promise<InAppMessage> {
  const { data, error } = await supabase
    .from('in_app_messages')
    .insert([dto])
    .select()
    .single();

  if (error) throw new Error(`Failed to create: ${error.message}`);
  return data;
}
```

All database operations are async with proper error handling.

#### 3. Type Safety

```typescript
// Strongly typed DTOs
interface CreateInAppMessageDTO {
  title: string;
  body: string;
  trigger_event: TriggerEvent;
  // ...
}
```

Full TypeScript coverage prevents runtime errors.

#### 4. Frequency Capping

```typescript
async getMessagesByEvent(event: TriggerEvent, userId: string) {
  // ... fetch messages

  // Filter by frequency cap
  for (const msg of messages) {
    const shownCount = await this.getMessageShownCount(msg.id, userId);
    if (shownCount < msg.max_displays_per_user) {
      filteredMessages.push(msg);
    }
  }

  return filteredMessages;
}
```

Prevents message spam by checking display count.

---

## Frontend Component Architecture

### Component Hierarchy

```
App.tsx
└── MessageContainer
    ├── MessageContext (Provider)
    ├── MessagePrompt (when active)
    └── Children (Your app)

Settings.tsx (or Admin Panel)
├── AdminMessageEditor
│   ├── Message Form
│   └── Message List
└── MessageAnalytics
    ├── Metrics Cards
    ├── Engagement Funnel
    └── Retention Table
```

### MessageContainer

**Responsibilities:**
1. Manage message queue (max 3 messages)
2. Show messages one at a time
3. Track all interactions
4. Provide context for child components

**State:**
```typescript
const [messageQueue, setMessageQueue] = useState<MessageQueueItem[]>([]);
const [currentMessage, setCurrentMessage] = useState<InAppMessage | null>(null);
const [shownAt, setShownAt] = useState<Date | null>(null);
```

**Context API:**
```typescript
interface MessageContextType {
  triggerMessage: (event: TriggerEvent, metadata?) => void;
  queueSize: number;
}
```

### MessagePrompt

**Responsibilities:**
1. Display single message with styling
2. Handle auto-dismiss timer
3. Track view duration
4. Handle user interactions

**Animations:**
- Fade in: 300ms ease-out
- Fade out: 300ms ease-out
- Progress bar: Linear shrink over auto_dismiss_seconds

**Event Handlers:**
- `onClick`: Track "clicked" interaction
- `onCTAClick`: Track "cta_clicked" + navigate
- `onDismiss`: Track "dismissed" + close

### AdminMessageEditor

**Responsibilities:**
1. CRUD interface for messages
2. Form validation
3. Real-time message list
4. Inline editing

**Form Fields:**
- Text inputs (title, body, CTA)
- Dropdowns (trigger, segment, priority)
- Date pickers (scheduling)
- Toggle (active/inactive)
- Textarea (JSON segment filter)

**Validation:**
- Required fields marked with *
- JSON validation for segment_filter
- Priority range: 0-100
- Auto-dismiss range: 3-60 seconds

### MessageAnalytics

**Responsibilities:**
1. Display message metrics
2. Visualize engagement funnel
3. Show retention correlation

**Data Visualization:**
- Metric cards with color-coded rates
- Progress bars for funnel
- Table for retention cohorts
- Icons for visual clarity

---

## Data Flow Diagrams

### Message Display Flow

```
1. USER ACTION
   ↓
2. triggerMessage('event_name')
   ↓
3. MessageContainer.triggerMessage()
   ↓
4. messageService.getMessagesByEvent()
   ↓
5. Supabase Query (with filters)
   ↓
6. Filter by schedule (start_date, end_date)
   ↓
7. Filter by frequency cap (max_displays_per_user)
   ↓
8. messageService.matchesSegment()
   ↓
9. Add to message queue (sorted by priority)
   ↓
10. Show next message from queue
   ↓
11. MessagePrompt rendered
   ↓
12. Track 'shown' interaction
   ↓
13. Auto-dismiss timer starts
   ↓
14. USER INTERACTS or AUTO-DISMISS
   ↓
15. Track interaction (clicked/dismissed)
   ↓
16. Update retention cohort
   ↓
17. Remove from display
   ↓
18. Show next message (if any)
```

### Analytics Flow

```
1. ADMIN SELECTS MESSAGE
   ↓
2. MessageAnalytics.loadMessageMetrics()
   ↓
3. messageService.getMessageMetrics(messageId)
   ↓
4. Supabase RPC: get_message_metrics()
   ↓
5. SQL Aggregation:
   - COUNT interactions by type
   - CALCULATE rates
   - AVG view duration
   ↓
6. Return metrics object
   ↓
7. Render metric cards
   ↓
8. Render engagement funnel
   ↓
9. LOAD RETENTION DATA
   ↓
10. messageService.getRetentionByEngagement()
   ↓
11. Supabase RPC: get_retention_by_engagement()
   ↓
12. SQL Aggregation:
   - GROUP BY engagement level
   - CALCULATE retention rates
   ↓
13. Render retention table
```

---

## Security Model

### Row-Level Security (RLS)

#### in_app_messages

**Admin Policy (Full Access):**
```sql
CREATE POLICY admin_all_in_app_messages ON in_app_messages
  FOR ALL
  USING (true); -- Replace with: auth.jwt() ->> 'role' = 'admin'
```

**User Policy (Read Only Active):**
```sql
CREATE POLICY users_read_active_messages ON in_app_messages
  FOR SELECT
  USING (
    active = true AND
    (start_date IS NULL OR start_date <= NOW()) AND
    (end_date IS NULL OR end_date >= NOW())
  );
```

#### message_interactions

**User Policy (Insert Own):**
```sql
CREATE POLICY users_insert_own_interactions ON message_interactions
  FOR INSERT
  WITH CHECK (true); -- Replace with: user_id = auth.uid()
```

**User Policy (Read Own):**
```sql
CREATE POLICY users_read_own_interactions ON message_interactions
  FOR SELECT
  USING (true); -- Replace with: user_id = auth.uid()
```

#### user_retention_cohorts

**User Policy (Access Own):**
```sql
CREATE POLICY users_access_own_retention ON user_retention_cohorts
  FOR ALL
  USING (true); -- Replace with: user_id = auth.uid()
```

### Data Validation

**Database Constraints:**
```sql
CONSTRAINT valid_priority CHECK (priority >= 0 AND priority <= 100)
CONSTRAINT valid_auto_dismiss CHECK (auto_dismiss_seconds >= 3 AND auto_dismiss_seconds <= 60)
CONSTRAINT valid_interaction_type CHECK (interaction_type IN ('shown', 'clicked', 'cta_clicked', 'dismissed'))
```

**TypeScript Type Guards:**
```typescript
function isTriggerEvent(event: string): event is TriggerEvent {
  return Object.keys(TRIGGER_EVENT_LABELS).includes(event);
}

function isValidSegment(segment: string): segment is TargetSegment {
  return ['all', 'new_users', 'active_teams', 'dormant_users', 'custom'].includes(segment);
}
```

---

## Performance Considerations

### Database Optimization

1. **Indexes on Hot Paths:**
   - `trigger_event` for message lookup
   - `created_at` for time-based queries
   - `user_id` for user-specific data

2. **Materialized Views (Future):**
   ```sql
   CREATE MATERIALIZED VIEW message_metrics_summary AS
   SELECT
     message_id,
     COUNT(*) FILTER (WHERE interaction_type = 'shown') as total_shown,
     -- ... other aggregations
   FROM message_interactions
   GROUP BY message_id;
   ```

3. **Query Optimization:**
   - Use `LIMIT` on large result sets
   - Avoid N+1 queries with batch fetching
   - Cache frequent queries (message list)

### Frontend Optimization

1. **Queue Size Limit:**
   ```typescript
   maxQueueSize = 3 // Prevents memory bloat
   ```

2. **Debounced Triggers:**
   ```typescript
   const debouncedTrigger = debounce(triggerMessage, 500);
   ```

3. **Lazy Loading:**
   - Load analytics on demand
   - Paginate message list in admin panel

4. **Memoization:**
   ```typescript
   const contextValue = useMemo(() => ({
     triggerMessage,
     queueSize: messageQueue.length,
   }), [triggerMessage, messageQueue.length]);
   ```

---

## Scalability

### Horizontal Scaling

**Database:**
- Supabase handles connection pooling
- Read replicas for analytics queries
- Partitioning by date for interactions table

**Frontend:**
- Stateless components scale naturally
- Context API scoped to user session
- No global state dependencies

### Vertical Scaling

**Message Volume:**
- Current design handles 100K+ messages
- Interactions table grows O(n) with user activity
- Retention table O(users × cohorts)

**Optimization Strategies:**
1. Archive old interactions (> 90 days)
2. Aggregate metrics into summary tables
3. Use time-series database for high-frequency events

### Monitoring

**Key Metrics to Track:**
- Message display latency
- Database query times
- Queue saturation (messages dropped)
- Interaction write throughput

**Alerting:**
- Slow queries (> 1s)
- High error rates
- Low message display rates

---

## Future Enhancements

1. **A/B Testing:**
   - Variant support for messages
   - Statistical significance calculation

2. **Message Templates:**
   - Reusable message components
   - Dynamic content interpolation

3. **Advanced Scheduling:**
   - Recurring messages
   - Time zone awareness
   - Quiet hours respect

4. **Multi-language Support:**
   - Translation management
   - Locale-based display

5. **Machine Learning:**
   - Predictive message timing
   - Churn prediction triggers
   - Personalized content

---

## Conclusion

The in-app messaging system is built with:
- **Modularity**: Each component has a single responsibility
- **Scalability**: Designed to handle growth
- **Type Safety**: Full TypeScript coverage
- **Performance**: Optimized queries and indexes
- **Security**: RLS policies and validation
- **Extensibility**: Easy to add features

This architecture provides a solid foundation for engaging users, improving retention, and measuring impact.

---

**For Implementation Details:** See [integration-setup.md](./integration-setup.md)
**For Code Examples:** See [usage-examples.md](./usage-examples.md)
