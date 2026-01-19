# 🎯 PHASE 3: DECISION & TASK WORKFLOWS

## Overview

Transform scattered discussions into structured decisions and trackable tasks. Help teams make better decisions and follow through.

### Features:
1. **Decision Tracking** - Create, vote on, and track decisions
2. **Task Extraction** - Auto-detect tasks from messages
3. **Outcome Threading** - Link decisions to their results
4. **Voting System** - In-line polls for quick consensus

### ⏱️ Time Required: 6-8 hours

---

## 📊 DATABASE MIGRATIONS

### Migration 1: Decisions Table

Run in Supabase SQL Editor:

```sql
-- Create decisions table
CREATE TABLE IF NOT EXISTS pulse_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thread_id UUID REFERENCES pulse_threads(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES pulse_channels(id) ON DELETE CASCADE,
  created_by UUID REFERENCES pulse_users(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, voting, decided, implemented
  decision_type VARCHAR(50), -- binary, multiple_choice, ranking
  options JSONB DEFAULT '[]',
  deadline TIMESTAMPTZ,
  final_choice TEXT,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decisions_thread ON pulse_decisions(thread_id);
CREATE INDEX idx_decisions_status ON pulse_decisions(status);
CREATE INDEX idx_decisions_deadline ON pulse_decisions(deadline);
```

### Migration 2: Votes Table

```sql
-- Create votes table
CREATE TABLE IF NOT EXISTS pulse_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES pulse_decisions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES pulse_users(id) ON DELETE CASCADE,
  choice TEXT NOT NULL,
  reasoning TEXT,
  confidence INTEGER CHECK (confidence >= 1 AND confidence <= 5), -- 1=low, 5=high
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(decision_id, user_id)
);

CREATE INDEX idx_votes_decision ON pulse_votes(decision_id);
CREATE INDEX idx_votes_user ON pulse_votes(user_id);
```

### Migration 3: Tasks Table

```sql
-- Create tasks table
CREATE TABLE IF NOT EXISTS pulse_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  source_message_id UUID REFERENCES pulse_messages(id),
  source_decision_id UUID REFERENCES pulse_decisions(id),
  assigned_to UUID REFERENCES pulse_users(id),
  created_by UUID REFERENCES pulse_users(id),
  status VARCHAR(20) DEFAULT 'todo', -- todo, in_progress, blocked, done
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_assigned ON pulse_tasks(assigned_to);
CREATE INDEX idx_tasks_status ON pulse_tasks(status);
CREATE INDEX idx_tasks_due_date ON pulse_tasks(due_date);
CREATE INDEX idx_tasks_source_decision ON pulse_tasks(source_decision_id);
```

### Migration 4: Decision Outcomes Table

```sql
-- Create decision outcomes table
CREATE TABLE IF NOT EXISTS pulse_decision_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES pulse_decisions(id) ON DELETE CASCADE,
  outcome_type VARCHAR(50), -- success, failure, partial, ongoing
  description TEXT NOT NULL,
  metrics JSONB DEFAULT '{}',
  lessons_learned TEXT,
  related_tasks UUID[] DEFAULT '{}',
  reported_by UUID REFERENCES pulse_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outcomes_decision ON pulse_decision_outcomes(decision_id);
CREATE INDEX idx_outcomes_type ON pulse_decision_outcomes(outcome_type);
```

---

## 🛠️ SERVICES

### Service 1: Decision Service

File: `src/services/decisionService.ts`

```typescript
import { supabase } from './supabaseClient';

export type DecisionStatus = 'pending' | 'voting' | 'decided' | 'implemented';
export type DecisionType = 'binary' | 'multiple_choice' | 'ranking';

interface Decision {
  id: string;
  title: string;
  description?: string;
  thread_id?: string;
  channel_id: string;
  created_by: string;
  status: DecisionStatus;
  decision_type: DecisionType;
  options: string[];
  deadline?: string;
  final_choice?: string;
  rationale?: string;
  created_at: string;
  decided_at?: string;
}

interface Vote {
  decision_id: string;
  user_id: string;
  choice: string;
  reasoning?: string;
  confidence: number;
}

interface VoteResults {
  total_votes: number;
  choices: Record<string, {
    count: number;
    percentage: number;
    voters: string[];
  }>;
  average_confidence: number;
}

class DecisionService {
  // Create a new decision
  async createDecision(
    title: string,
    channelId: string,
    createdBy: string,
    options: {
      description?: string;
      threadId?: string;
      decisionType?: DecisionType;
      choices?: string[];
      deadline?: Date;
    } = {}
  ): Promise<Decision> {
    const decisionData = {
      title,
      description: options.description,
      channel_id: channelId,
      thread_id: options.threadId,
      created_by: createdBy,
      status: 'voting' as DecisionStatus,
      decision_type: options.decisionType || 'binary',
      options: options.choices || ['Yes', 'No'],
      deadline: options.deadline?.toISOString()
    };

    const { data, error } = await supabase
      .from('pulse_decisions')
      .insert(decisionData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Vote on a decision
  async vote(
    decisionId: string,
    userId: string,
    choice: string,
    options: {
      reasoning?: string;
      confidence?: number;
    } = {}
  ): Promise<void> {
    const voteData = {
      decision_id: decisionId,
      user_id: userId,
      choice,
      reasoning: options.reasoning,
      confidence: options.confidence || 3
    };

    const { error } = await supabase
      .from('pulse_votes')
      .upsert(voteData);

    if (error) throw error;
  }

  // Get vote results
  async getResults(decisionId: string): Promise<VoteResults> {
    const { data: votes } = await supabase
      .from('pulse_votes')
      .select('*, user:pulse_users(full_name)')
      .eq('decision_id', decisionId);

    if (!votes) {
      return {
        total_votes: 0,
        choices: {},
        average_confidence: 0
      };
    }

    // Group by choice
    const choiceMap: Record<string, any> = {};
    let totalConfidence = 0;

    votes.forEach(vote => {
      if (!choiceMap[vote.choice]) {
        choiceMap[vote.choice] = {
          count: 0,
          percentage: 0,
          voters: []
        };
      }
      choiceMap[vote.choice].count++;
      choiceMap[vote.choice].voters.push(vote.user.full_name);
      totalConfidence += vote.confidence;
    });

    // Calculate percentages
    Object.keys(choiceMap).forEach(choice => {
      choiceMap[choice].percentage = Math.round(
        (choiceMap[choice].count / votes.length) * 100
      );
    });

    return {
      total_votes: votes.length,
      choices: choiceMap,
      average_confidence: votes.length > 0 
        ? Math.round(totalConfidence / votes.length * 10) / 10 
        : 0
    };
  }

  // Finalize a decision
  async finalizeDecision(
    decisionId: string,
    finalChoice: string,
    rationale?: string
  ): Promise<void> {
    await supabase
      .from('pulse_decisions')
      .update({
        status: 'decided',
        final_choice: finalChoice,
        rationale,
        decided_at: new Date().toISOString()
      })
      .eq('id', decisionId);
  }

  // Get decisions for a channel
  async getDecisions(
    channelId: string,
    status?: DecisionStatus
  ): Promise<Decision[]> {
    let query = supabase
      .from('pulse_decisions')
      .select('*, created_by_user:pulse_users!created_by(full_name)')
      .eq('channel_id', channelId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data } = await query.order('created_at', { ascending: false });
    return data || [];
  }

  // Get decision by ID
  async getDecision(decisionId: string): Promise<Decision | null> {
    const { data } = await supabase
      .from('pulse_decisions')
      .select('*, created_by_user:pulse_users!created_by(full_name)')
      .eq('id', decisionId)
      .single();

    return data;
  }

  // Check if user has voted
  async hasVoted(decisionId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('pulse_votes')
      .select('id')
      .eq('decision_id', decisionId)
      .eq('user_id', userId)
      .single();

    return !!data;
  }

  // Get user's vote
  async getUserVote(decisionId: string, userId: string): Promise<Vote | null> {
    const { data } = await supabase
      .from('pulse_votes')
      .select('*')
      .eq('decision_id', decisionId)
      .eq('user_id', userId)
      .single();

    return data;
  }

  // Record decision outcome
  async recordOutcome(
    decisionId: string,
    outcomeType: 'success' | 'failure' | 'partial' | 'ongoing',
    description: string,
    reportedBy: string,
    options: {
      metrics?: Record<string, any>;
      lessonsLearned?: string;
      relatedTasks?: string[];
    } = {}
  ): Promise<void> {
    await supabase
      .from('pulse_decision_outcomes')
      .insert({
        decision_id: decisionId,
        outcome_type: outcomeType,
        description,
        metrics: options.metrics || {},
        lessons_learned: options.lessonsLearned,
        related_tasks: options.relatedTasks || [],
        reported_by: reportedBy
      });

    // Update decision status
    await supabase
      .from('pulse_decisions')
      .update({ status: 'implemented' })
      .eq('id', decisionId);
  }

  // Get outcomes for a decision
  async getOutcomes(decisionId: string) {
    const { data } = await supabase
      .from('pulse_decision_outcomes')
      .select('*, reporter:pulse_users!reported_by(full_name)')
      .eq('decision_id', decisionId)
      .order('created_at', { ascending: false });

    return data || [];
  }
}

export const decisionService = new DecisionService();
```

---

### Service 2: Task Service

File: `src/services/taskService.ts`

```typescript
import { supabase } from './supabaseClient';
import { generateAI } from './geminiService';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface Task {
  id: string;
  title: string;
  description?: string;
  source_message_id?: string;
  source_decision_id?: string;
  assigned_to?: string;
  created_by: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  completed_at?: string;
  created_at: string;
}

interface ExtractedTask {
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  priority: TaskPriority;
}

class TaskService {
  // Extract tasks from message using AI
  async extractTasksFromMessage(
    messageContent: string,
    participants: string[]
  ): Promise<ExtractedTask[]> {
    const prompt = `Extract action items from this message:

Message: "${messageContent}"

Team members: ${participants.join(', ')}

Return JSON array of tasks:
[
  {
    "title": "Task description",
    "description": "Additional details if any",
    "assignee": "Person's name if mentioned, or null",
    "dueDate": "ISO date if mentioned, or null",
    "priority": "low" | "medium" | "high" | "urgent"
  }
]

Only return tasks that are clear action items. Empty array if no tasks.`;

    try {
      const response = await generateAI(prompt);
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Task extraction failed:', error);
      return [];
    }
  }

  // Quick pattern-based task detection
  private quickTaskDetection(content: string): boolean {
    const taskPatterns = [
      /\b(todo|task|action item|need to|should|must)\b/i,
      /\b(please|could you|can you)\b.*\b(do|complete|finish|handle)\b/i,
      /^[-*•]\s+/m, // List items
      /\b(deadline|due|by)\b/i
    ];

    return taskPatterns.some(pattern => pattern.test(content));
  }

  // Create task
  async createTask(
    title: string,
    createdBy: string,
    options: {
      description?: string;
      sourceMessageId?: string;
      sourceDecisionId?: string;
      assignedTo?: string;
      priority?: TaskPriority;
      dueDate?: Date;
    } = {}
  ): Promise<Task> {
    const taskData = {
      title,
      description: options.description,
      source_message_id: options.sourceMessageId,
      source_decision_id: options.sourceDecisionId,
      assigned_to: options.assignedTo,
      created_by: createdBy,
      status: 'todo' as TaskStatus,
      priority: options.priority || 'medium',
      due_date: options.dueDate?.toISOString()
    };

    const { data, error } = await supabase
      .from('pulse_tasks')
      .insert(taskData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update task status
  async updateStatus(taskId: string, status: TaskStatus): Promise<void> {
    const updates: any = { status };
    if (status === 'done') {
      updates.completed_at = new Date().toISOString();
    }

    await supabase
      .from('pulse_tasks')
      .update(updates)
      .eq('id', taskId);
  }

  // Assign task
  async assignTask(taskId: string, userId: string): Promise<void> {
    await supabase
      .from('pulse_tasks')
      .update({ assigned_to: userId })
      .eq('id', taskId);
  }

  // Get tasks for user
  async getTasksForUser(
    userId: string,
    status?: TaskStatus
  ): Promise<Task[]> {
    let query = supabase
      .from('pulse_tasks')
      .select('*, assignee:pulse_users!assigned_to(full_name), creator:pulse_users!created_by(full_name)')
      .eq('assigned_to', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data } = await query.order('due_date', { ascending: true });
    return data || [];
  }

  // Get tasks from decision
  async getTasksFromDecision(decisionId: string): Promise<Task[]> {
    const { data } = await supabase
      .from('pulse_tasks')
      .select('*, assignee:pulse_users!assigned_to(full_name)')
      .eq('source_decision_id', decisionId);

    return data || [];
  }

  // Get overdue tasks
  async getOverdueTasks(userId: string): Promise<Task[]> {
    const { data } = await supabase
      .from('pulse_tasks')
      .select('*, assignee:pulse_users!assigned_to(full_name)')
      .eq('assigned_to', userId)
      .neq('status', 'done')
      .lt('due_date', new Date().toISOString());

    return data || [];
  }

  // Auto-create tasks from message
  async autoCreateTasksFromMessage(
    messageId: string,
    messageContent: string,
    channelId: string,
    senderId: string,
    participants: string[]
  ): Promise<Task[]> {
    // Quick check first
    if (!this.quickTaskDetection(messageContent)) {
      return [];
    }

    // Use AI to extract tasks
    const extracted = await this.extractTasksFromMessage(
      messageContent,
      participants
    );

    if (extracted.length === 0) {
      return [];
    }

    // Create tasks
    const tasks: Task[] = [];
    for (const item of extracted) {
      // Try to find user ID from assignee name
      let assignedTo: string | undefined;
      if (item.assignee) {
        const { data: user } = await supabase
          .from('pulse_users')
          .select('id')
          .ilike('full_name', `%${item.assignee}%`)
          .single();
        
        if (user) {
          assignedTo = user.id;
        }
      }

      const task = await this.createTask(item.title, senderId, {
        description: item.description,
        sourceMessageId: messageId,
        assignedTo,
        priority: item.priority,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined
      });

      tasks.push(task);
    }

    return tasks;
  }
}

export const taskService = new TaskService();
```

---

**Continuing in next file with UI components...**
