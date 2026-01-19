# Pulse Email 2.0 - AI-Powered Email Revolution

## Overview
Complete overhaul of Pulse Email to create the most advanced AI-native email client, featuring intelligent inbox management, contextual AI composition, and seamless Gmail integration with local caching.

---

## Phase 1: Core Infrastructure (Foundation)

### 1.1 Database Schema - Email Caching
```sql
-- Cached emails for offline access & fast search
CREATE TABLE cached_emails (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  gmail_id TEXT UNIQUE,

  -- Core fields
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails JSONB,
  cc_emails JSONB,
  bcc_emails JSONB,
  subject TEXT,
  snippet TEXT,
  body_text TEXT,
  body_html TEXT,

  -- Metadata
  labels JSONB DEFAULT '[]',
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_trashed BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',

  -- AI-generated fields
  ai_summary TEXT,
  ai_category TEXT, -- 'priority', 'updates', 'social', 'promotions', 'spam'
  ai_priority_score INTEGER DEFAULT 50, -- 0-100
  ai_action_items JSONB DEFAULT '[]',
  ai_sentiment TEXT, -- 'positive', 'neutral', 'negative', 'urgent'
  ai_suggested_replies JSONB DEFAULT '[]',
  ai_entities JSONB DEFAULT '{}', -- extracted dates, people, amounts, etc.

  -- Timestamps
  received_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email threads for conversation view
CREATE TABLE email_threads (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  subject TEXT,
  participant_emails JSONB,
  participant_names JSONB,
  message_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  ai_thread_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled emails
CREATE TABLE scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  to_emails JSONB NOT NULL,
  cc_emails JSONB,
  bcc_emails JSONB,
  subject TEXT,
  body TEXT,
  is_html BOOLEAN DEFAULT false,
  thread_id TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snoozed emails
CREATE TABLE snoozed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email_id TEXT REFERENCES cached_emails(id),
  snooze_until TIMESTAMPTZ NOT NULL,
  original_labels JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  variables JSONB DEFAULT '[]', -- {{name}}, {{company}}, etc.
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact intelligence
CREATE TABLE email_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  title TEXT,
  avatar_url TEXT,
  last_contacted_at TIMESTAMPTZ,
  email_count INTEGER DEFAULT 0,
  avg_response_time_hours FLOAT,
  relationship_strength INTEGER DEFAULT 50, -- 0-100
  ai_notes TEXT,
  custom_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Search index for semantic search
CREATE TABLE email_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT REFERENCES cached_emails(id),
  embedding vector(768), -- For semantic search
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Gmail Sync Service
- Background sync every 5 minutes
- Push notifications via Gmail watch API
- Delta sync (only new/changed emails)
- Attachment handling & storage
- Draft sync bidirectional

### 1.3 Offline Support
- IndexedDB for instant access
- Queue operations when offline
- Sync on reconnection

---

## Phase 2: AI Intelligence Layer

### 2.1 Email Analysis Pipeline (on sync)
For each new email, run through Gemini:

```typescript
interface EmailAnalysis {
  summary: string;           // 1-2 sentence TL;DR
  category: 'priority' | 'updates' | 'social' | 'promotions' | 'newsletters';
  priorityScore: number;     // 0-100
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  actionItems: string[];     // Extracted tasks
  entities: {
    dates: { text: string; parsed: Date }[];
    people: { name: string; email?: string }[];
    amounts: { text: string; value: number; currency: string }[];
    links: { text: string; url: string }[];
    meetingRequests: boolean;
  };
  suggestedReplies: string[]; // 3 quick reply options
}
```

### 2.2 Smart Categorization
- **Priority**: Direct emails requiring response, from important contacts
- **Updates**: Receipts, confirmations, status updates
- **Social**: Social media notifications
- **Promotions**: Marketing, deals
- **Newsletters**: Subscribed content

### 2.3 Priority Scoring Algorithm
```
Score =
  + 30 if from known contact with high relationship_strength
  + 20 if direct (not CC'd)
  + 15 if contains question to user
  + 10 if mentions user by name
  + 10 if marked important by sender
  + 5 if recent thread activity
  - 20 if bulk/marketing detected
  - 10 if from unsubscribe-able source
```

---

## Phase 3: AI Composition Features

### 3.1 Smart Compose (Real-time)
- Sentence auto-complete as user types
- Context-aware suggestions
- Learns from user's writing style

### 3.2 One-Click Draft Generation
- Input: Brief intent ("decline meeting politely", "follow up on invoice")
- Output: Complete professional email
- Multiple tone options with preview

### 3.3 Email Enhancement Tools
- **Shorten**: Condense while keeping meaning
- **Elaborate**: Add professional detail
- **Tone Shift**: Professional ↔ Friendly ↔ Formal
- **Fix Grammar**: Correct errors
- **Translate**: Multi-language support

### 3.4 Contextual Reply Generation
- Analyzes full thread context
- Suggests 3 full reply options
- One-click insert with editing

### 3.5 Tone Check (Pre-send)
- Warns if email sounds:
  - Too harsh/aggressive
  - Too casual for context
  - Missing important elements (greeting, closing)
  - Contains potential issues

---

## Phase 4: Intelligent Inbox Features

### 4.1 Pulse Daily Briefing
Morning summary card:
```
Good morning, Frankie!

📬 12 new emails overnight
⚡ 3 need your attention today
📅 2 meeting requests detected
💰 1 invoice requires review

Top Priority:
1. "Q4 Budget Approval" from CFO - awaiting your sign-off
2. "Client Meeting Follow-up" - Sarah needs response by noon
3. "Contract Review" - Legal deadline tomorrow
```

### 4.2 Smart Nudge System
- Detect sent emails without response after X days
- Suggest follow-up with draft
- Track response rates per contact

### 4.3 Meeting Extractor
- Detect meeting requests in emails
- One-click "Add to Calendar"
- Auto-suggest time slots
- Create calendar event with context

### 4.4 Action Item Extraction
- Pull tasks from emails
- "Add to Tasks" button
- Link task back to source email

### 4.5 Relationship Intelligence Panel
When viewing email, show sidebar:
```
About: Sarah Chen
━━━━━━━━━━━━━━━━━━
Company: Acme Corp
Title: VP of Sales
Last contact: 2 days ago
Emails exchanged: 47
Avg response time: 4 hours

Recent threads:
• Q4 Planning (3 days ago)
• Contract Discussion (1 week ago)

Your notes:
"Key decision maker for enterprise deal"
```

---

## Phase 5: Core Email Features

### 5.1 Mailbox Views
- **Inbox** (with AI categories as tabs)
- **Starred**
- **Snoozed**
- **Sent**
- **Drafts**
- **Scheduled**
- **All Mail**
- **Trash**
- **Spam**

### 5.2 Email Actions
- Reply / Reply All / Forward
- Star / Unstar
- Mark read/unread
- Archive
- Delete / Trash
- Snooze (pick date/time)
- Schedule Send
- Move to folder/label
- Create filter
- Block sender
- Report spam

### 5.3 Thread View
- Gmail-style conversation threading
- Collapse/expand individual messages
- Quick reply at bottom
- Thread-level actions

### 5.4 Undo Send
- 30-second delay option
- Cancel button during delay
- Configurable delay time

### 5.5 Search
- Basic text search
- AI semantic search ("that email about budget from last month")
- Advanced filters (from, to, subject, date, has:attachment)
- Search within thread

### 5.6 Templates
- Create/edit/delete templates
- Variable substitution
- Quick insert from compose

---

## Phase 6: UI/UX Design

### 6.1 Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Pulse Email                    🔍 Search...           [Compose]│
├──────────┬────────────────────────────────┬─────────────────────┤
│          │ ○ Primary  ○ Updates  ○ Social │                     │
│ Inbox  5 │──────────────────────────────────│   Email Content    │
│ Starred  │ ☆ ○ Sarah Chen         2:30 PM │   or               │
│ Snoozed  │   Q4 Planning Meeting           │   Thread View      │
│ Sent     │   Let's discuss the roadmap...  │                     │
│ Drafts 2 │──────────────────────────────────│   [AI Summary]     │
│ Scheduled│ ★ ● Marcus Johnson     1:15 PM │   [Action Items]   │
│ ──────── │   Brand Guidelines Update       │   [Quick Reply]    │
│ All Mail │   I've attached the updated...  │                     │
│ Trash    │──────────────────────────────────│ ─────────────────  │
│ Spam     │ ☆ ○ GitHub            12:45 PM │   Relationship     │
│          │   [pulse] New PR: Feature/...   │   Intelligence     │
│ LABELS   │──────────────────────────────────│   Panel            │
│ • Work   │                                  │                     │
│ • Personal                                  │                     │
└──────────┴────────────────────────────────┴─────────────────────┘
```

### 6.2 Compose Modal
```
┌─────────────────────────────────────────────────────────────────┐
│ New Message                                          _ □ ✕      │
├─────────────────────────────────────────────────────────────────┤
│ To: sarah.chen@company.com                          Cc Bcc      │
│─────────────────────────────────────────────────────────────────│
│ Subject: Re: Q4 Planning Meeting                                │
│─────────────────────────────────────────────────────────────────│
│                                                                 │
│ ┌─ AI ASSISTANT ─────────────────────────────────────────────┐ │
│ │ 💡 "confirm meeting attendance"  [Generate Draft]          │ │
│ │                                                             │ │
│ │ Tone: ○ Professional  ● Friendly  ○ Formal  ○ Concise     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Hi Sarah,                                                       │
│                                                                 │
│ Thanks for sending over the meeting details. I'll be there!    │
│ |                                                               │
│                                                                 │
│ ┌─ TONE CHECK ───────────────────────────────────────────────┐ │
│ │ ✓ Appropriate tone  ✓ Clear message  ⚠ Consider adding ETA │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [B] [I] [U] [Link] [📎] [📷] [Templates] [...]                 │
├─────────────────────────────────────────────────────────────────┤
│ [Discard]                    [Schedule ▾] [Send] [▾ Send Later]│
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Daily Briefing Card (Dashboard)
```
┌─────────────────────────────────────────────────────────────────┐
│ 📬 Your Email Pulse                                    View All │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Good morning, Frankie!                                         │
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │   12    │  │    3    │  │    2    │  │    1    │           │
│  │  new    │  │ urgent  │  │meetings │  │ follow  │           │
│  │ emails  │  │         │  │detected │  │   up    │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                                                 │
│  ⚡ Top Priority                                                │
│  ├─ "Q4 Budget" from CFO - needs approval                      │
│  ├─ "Client Meeting" from Sarah - respond by noon              │
│  └─ "Contract Review" from Legal - deadline tomorrow           │
│                                                                 │
│  [Open Priority Inbox]                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 7: Technical Implementation

### 7.1 New Services
- `emailSyncService.ts` - Gmail sync & caching
- `emailAIService.ts` - AI analysis & generation
- `emailSearchService.ts` - Search & semantic matching
- `emailSchedulerService.ts` - Scheduled/snoozed handling

### 7.2 New Components
- `PulseEmailClient.tsx` - Main container
- `EmailSidebar.tsx` - Folders & labels
- `EmailList.tsx` - Message list with categories
- `EmailThread.tsx` - Conversation view
- `EmailViewer.tsx` - Single message view
- `EmailComposer.tsx` - Enhanced compose (overhaul)
- `AIAssistantPanel.tsx` - Composition AI
- `RelationshipPanel.tsx` - Contact intelligence
- `DailyBriefing.tsx` - Morning summary
- `EmailSearch.tsx` - Smart search
- `SnoozeModal.tsx` - Snooze picker
- `ScheduleModal.tsx` - Send later picker
- `TemplateManager.tsx` - Template CRUD
- `ToneChecker.tsx` - Pre-send analysis

### 7.3 State Management
- React Context for email state
- Optimistic updates for actions
- Background sync with status indicator

---

## Implementation Order

### Sprint 1: Foundation (Core)
1. Database schema migration
2. Enhanced Gmail sync service
3. Email caching layer
4. Basic folder views (Inbox, Sent, Drafts, Trash)
5. Thread view implementation
6. Core actions (read, star, archive, delete)

### Sprint 2: AI Intelligence
1. Email analysis pipeline (Gemini)
2. Auto-categorization
3. Priority scoring
4. Summary generation
5. Action item extraction

### Sprint 3: AI Composition
1. Enhanced compose modal
2. AI draft generation
3. Tone selector
4. Smart replies
5. Tone check pre-send

### Sprint 4: Advanced Features
1. Snooze functionality
2. Schedule send
3. Undo send
4. Templates system
5. Semantic search

### Sprint 5: Intelligence Features
1. Daily briefing
2. Smart nudge / follow-up
3. Relationship intelligence panel
4. Meeting extractor
5. Task integration

### Sprint 6: Polish
1. Keyboard shortcuts
2. Offline support
3. Performance optimization
4. Mobile responsiveness
5. Accessibility

---

## API Costs Estimate

### Gemini API (per 1000 emails analyzed)
- Summary + categorization: ~$0.50
- Reply suggestions: ~$0.30
- Composition assistance: ~$0.20/draft

### Estimated monthly (active user, 100 emails/day)
- Analysis: ~$1.50
- Composition: ~$0.60
- Search: ~$0.30
- **Total: ~$2.40/user/month**

---

## Success Metrics
- Email response time reduction
- Time spent in inbox reduction
- User satisfaction score
- AI suggestion acceptance rate
- Feature adoption rates

---

## Ready to Build!

This plan creates the most advanced AI-powered email experience available. Every feature is designed to save time, reduce cognitive load, and make email feel magical.

Shall we begin with Sprint 1?
