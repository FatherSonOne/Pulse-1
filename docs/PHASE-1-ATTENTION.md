# 📍 PHASE 1: TIME & ATTENTION INTELLIGENCE

## 🎯 What You'll Build

In this phase, you'll implement three powerful features:

1. **Personal Attention Budget** - Smart notification prioritization and batching
2. **Meeting Deflection** - Detect when conversations should stay async
3. **Focus Mode** - Temporarily hide non-critical conversations with smart digests

---

## ⏰ Time Required: 4-6 hours

---

## 📊 DATABASE MIGRATIONS

### Step 1: Run These SQL Commands in Supabase

Go to: https://supabase.com/dashboard → Your Project → SQL Editor

#### Migration 1.1: Attention Budget Table

```sql
-- Table to track user attention budget and load
CREATE TABLE IF NOT EXISTS pulse_attention_budget (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES pulse_users(id) NOT NULL,
    current_load INTEGER DEFAULT 0 CHECK (current_load >= 0 AND current_load <= 100),
    max_load INTEGER DEFAULT 100,
    status TEXT CHECK (status IN ('healthy', 'strained', 'overloaded')) DEFAULT 'healthy',
    batched_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for fast lookups
CREATE INDEX idx_attention_user ON pulse_attention_budget(user_id);
```

✅ Click **RUN**

#### Migration 1.2: Batched Notifications Table

```sql
-- Table to store batched (delayed) notifications
CREATE TABLE IF NOT EXISTS pulse_batched_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES pulse_users(id) NOT NULL,
    source TEXT NOT NULL, -- 'message', 'email', 'calendar', etc.
    message TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'low',
    batch_time TIMESTAMPTZ DEFAULT NOW(),
    released_at TIMESTAMPTZ, -- When notification was shown to user
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_batched_user ON pulse_batched_notifications(user_id);
CREATE INDEX idx_batched_released ON pulse_batched_notifications(released_at) WHERE released_at IS NULL;
```

✅ Click **RUN**

#### Migration 1.3: Focus Mode Sessions

```sql
-- Table to track focus mode sessions
CREATE TABLE IF NOT EXISTS pulse_focus_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES pulse_users(id) NOT NULL,
    topic TEXT NOT NULL, -- What user is focusing on
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    digest_generated BOOLEAN DEFAULT FALSE,
    hidden_threads UUID[], -- Array of thread IDs hidden during focus
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active sessions
CREATE INDEX idx_focus_active ON pulse_focus_sessions(user_id, end_time) 
    WHERE end_time IS NULL;
```

✅ Click **RUN**

#### Migration 1.4: Meeting Deflection Suggestions

```sql
-- Table to track when system suggests async alternatives
CREATE TABLE IF NOT EXISTS pulse_meeting_deflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES pulse_threads(id) NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    deflection_type TEXT CHECK (deflection_type IN ('poll', 'video', 'doc')) NOT NULL,
    reason TEXT NOT NULL,
    template TEXT, -- Suggested template for async alternative
    accepted BOOLEAN DEFAULT NULL, -- NULL = not decided, TRUE/FALSE = user choice
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for recent suggestions
CREATE INDEX idx_deflection_thread ON pulse_meeting_deflections(thread_id, created_at DESC);
```

✅ Click **RUN**

---

## 🔧 CREATE NEW SERVICES

### Step 2: Create Attention Service

Create file: `src/services/attentionService.ts`

```typescript
import { supabase } from './supabase';

export interface AttentionBudget {
  currentLoad: number;
  maxLoad: number;
  status: 'healthy' | 'strained' | 'overloaded';
  batchedCount: number;
}

export interface BatchedNotification {
  id: string;
  source: string;
  message: string;
  time: Date;
  priority: 'low' | 'medium' | 'high';
}

export class AttentionService {
  // Calculate attention load based on recent activity
  static calculateLoad(
    messageCount: number,
    threadCount: number,
    unreadCount: number
  ): number {
    // Weighted formula - adjust as needed
    const messageWeight = 0.3;
    const threadWeight = 0.4;
    const unreadWeight = 0.3;

    const normalizedMessages = Math.min(messageCount / 50, 1) * 100;
    const normalizedThreads = Math.min(threadCount / 20, 1) * 100;
    const normalizedUnread = Math.min(unreadCount / 30, 1) * 100;

    return Math.round(
      normalizedMessages * messageWeight +
      normalizedThreads * threadWeight +
      normalizedUnread * unreadWeight
    );
  }

  // Get current attention budget for user
  static async getBudget(userId: string): Promise<AttentionBudget> {
    const { data, error } = await supabase
      .from('pulse_attention_budget')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Create default budget
      const defaultBudget = {
        user_id: userId,
        current_load: 0,
        max_load: 100,
        status: 'healthy',
        batched_count: 0
      };
      
      await supabase.from('pulse_attention_budget').insert(defaultBudget);
      
      return {
        currentLoad: 0,
        maxLoad: 100,
        status: 'healthy',
        batchedCount: 0
      };
    }

    return {
      currentLoad: data.current_load,
      maxLoad: data.max_load,
      status: data.status,
      batchedCount: data.batched_count
    };
  }

  // Update attention budget
  static async updateBudget(
    userId: string,
    load: number
  ): Promise<void> {
    const status = 
      load < 60 ? 'healthy' : 
      load < 85 ? 'strained' : 
      'overloaded';

    await supabase
      .from('pulse_attention_budget')
      .upsert({
        user_id: userId,
        current_load: load,
        status,
        updated_at: new Date().toISOString()
      });
  }

  // Batch a low-priority notification
  static async batchNotification(
    userId: string,
    source: string,
    message: string,
    priority: 'low' | 'medium' = 'low'
  ): Promise<void> {
    await supabase
      .from('pulse_batched_notifications')
      .insert({
        user_id: userId,
        source,
        message,
        priority
      });

    // Update batched count
    const { data } = await supabase
      .from('pulse_attention_budget')
      .select('batched_count')
      .eq('user_id', userId)
      .single();

    if (data) {
      await supabase
        .from('pulse_attention_budget')
        .update({ batched_count: (data.batched_count || 0) + 1 })
        .eq('user_id', userId);
    }
  }

  // Get batched notifications
  static async getBatchedNotifications(
    userId: string
  ): Promise<BatchedNotification[]> {
    const { data, error } = await supabase
      .from('pulse_batched_notifications')
      .select('*')
      .eq('user_id', userId)
      .is('released_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(n => ({
      id: n.id,
      source: n.source,
      message: n.message,
      time: new Date(n.created_at),
      priority: n.priority
    }));
  }

  // Release all batched notifications
  static async releaseBatch(userId: string): Promise<void> {
    await supabase
      .from('pulse_batched_notifications')
      .update({ released_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('released_at', null);

    // Reset batched count
    await supabase
      .from('pulse_attention_budget')
      .update({ batched_count: 0 })
      .eq('user_id', userId);
  }

  // Determine if notification should be batched
  static shouldBatch(
    priority: 'low' | 'medium' | 'high',
    currentLoad: number,
    workingHours: boolean
  ): boolean {
    // High priority: never batch
    if (priority === 'high') return false;

    // Outside working hours: batch medium priority
    if (!workingHours && priority === 'medium') return true;

    // High load: batch low priority
    if (currentLoad > 70 && priority === 'low') return true;

    return false;
  }
}
```

✅ Save this file

---

### Step 3: Create Focus Mode Service

Create file: `src/services/focusService.ts`

```typescript
import { supabase } from './supabase';
import { Thread } from '../types';

export interface FocusSession {
  id: string;
  topic: string;
  startTime: Date;
  endTime?: Date;
  hiddenThreads: string[];
}

export interface FocusDigest {
  summary: string;
  missedMessages: number;
  importantUpdates: string[];
  decisions: string[];
}

export class FocusService {
  // Start a focus session
  static async startFocus(
    userId: string,
    topic: string,
    threadsToHide: string[]
  ): Promise<string> {
    const { data, error } = await supabase
      .from('pulse_focus_sessions')
      .insert({
        user_id: userId,
        topic,
        hidden_threads: threadsToHide
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  // Get active focus session
  static async getActiveSession(userId: string): Promise<FocusSession | null> {
    const { data, error } = await supabase
      .from('pulse_focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      topic: data.topic,
      startTime: new Date(data.start_time),
      endTime: data.end_time ? new Date(data.end_time) : undefined,
      hiddenThreads: data.hidden_threads || []
    };
  }

  // End focus session
  static async endFocus(sessionId: string): Promise<void> {
    await supabase
      .from('pulse_focus_sessions')
      .update({ 
        end_time: new Date().toISOString(),
        digest_generated: true
      })
      .eq('id', sessionId);
  }

  // Generate digest for ended session
  static async generateDigest(
    sessionId: string,
    threads: Thread[]
  ): Promise<FocusDigest> {
    // Get session details
    const { data: session } = await supabase
      .from('pulse_focus_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return {
        summary: 'No session found',
        missedMessages: 0,
        importantUpdates: [],
        decisions: []
      };
    }

    const hiddenThreadIds = new Set(session.hidden_threads);
    const hiddenThreads = threads.filter(t => hiddenThreadIds.has(t.id));

    // Count messages during focus time
    const focusStart = new Date(session.start_time);
    const focusEnd = session.end_time ? new Date(session.end_time) : new Date();

    let missedCount = 0;
    const updates: string[] = [];
    const decisions: string[] = [];

    hiddenThreads.forEach(thread => {
      const newMessages = thread.messages.filter(m => {
        const msgTime = new Date(m.timestamp);
        return msgTime >= focusStart && msgTime <= focusEnd;
      });

      missedCount += newMessages.length;

      // Extract important info
      newMessages.forEach(msg => {
        if (msg.decisionData) {
          decisions.push(`Decision in ${thread.contactName}: ${msg.text.substring(0, 50)}...`);
        }
        if (msg.text.toLowerCase().includes('urgent') || 
            msg.text.toLowerCase().includes('important')) {
          updates.push(`${thread.contactName}: ${msg.text.substring(0, 60)}...`);
        }
      });
    });

    return {
      summary: `You focused on "${session.topic}" for ${Math.round((focusEnd.getTime() - focusStart.getTime()) / 60000)} minutes`,
      missedMessages: missedCount,
      importantUpdates: updates.slice(0, 5),
      decisions: decisions.slice(0, 3)
    };
  }

  // Filter threads based on focus session
  static filterThreadsForFocus(
    threads: Thread[],
    hiddenThreadIds: string[]
  ): Thread[] {
    const hiddenSet = new Set(hiddenThreadIds);
    return threads.filter(t => !hiddenSet.has(t.id));
  }
}
```

✅ Save this file

---

(continued in next message due to length...)
