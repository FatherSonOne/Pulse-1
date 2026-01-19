# 🧠 PHASE 2: CONTEXT-AWARE MESSAGING

## Overview

Make Pulse understand message intent, automatically show relevant context, and help users prioritize what matters.

### Features:
1. **Intent Detection** - Classify messages (question, decision, task, FYI)
2. **Auto-Context Panels** - Show related threads, files, decisions
3. **Smart Summaries** - AI-generated thread summaries
4. **Priority Scoring** - Calculate message importance

### ⏱️ Time Required: 5-7 hours

---

## 📊 DATABASE MIGRATIONS

### Migration 1: Message Intent & Priority

Run in Supabase SQL Editor:

```sql
-- Add intent and priority to messages
ALTER TABLE pulse_messages
ADD COLUMN IF NOT EXISTS intent VARCHAR(50),
ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS context_data JSONB DEFAULT '{}';

-- Create index for faster intent queries
CREATE INDEX IF NOT EXISTS idx_messages_intent 
ON pulse_messages(intent);

CREATE INDEX IF NOT EXISTS idx_messages_priority 
ON pulse_messages(priority_score DESC);
```

### Migration 2: Thread Summaries

```sql
-- Create table for thread summaries
CREATE TABLE IF NOT EXISTS pulse_thread_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES pulse_threads(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  key_points JSONB DEFAULT '[]',
  participants UUID[] DEFAULT '{}',
  decision_count INTEGER DEFAULT 0,
  action_item_count INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_summaries_thread ON pulse_thread_summaries(thread_id);
CREATE INDEX idx_summaries_valid ON pulse_thread_summaries(valid_until);
```

### Migration 3: Context Relationships

```sql
-- Create table to link related content
CREATE TABLE IF NOT EXISTS pulse_context_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_message_id UUID REFERENCES pulse_messages(id) ON DELETE CASCADE,
  target_type VARCHAR(50) NOT NULL, -- 'thread', 'file', 'decision', 'contact'
  target_id UUID NOT NULL,
  relevance_score FLOAT DEFAULT 0.5,
  link_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_context_source ON pulse_context_links(source_message_id);
CREATE INDEX idx_context_target ON pulse_context_links(target_type, target_id);
CREATE INDEX idx_context_relevance ON pulse_context_links(relevance_score DESC);
```

---

## 🛠️ SERVICES

### Service 1: Intent Detection Service

File: `src/services/intentService.ts`

```typescript
import { supabase } from './supabaseClient';
import { generateAI } from './geminiService';

export type MessageIntent = 
  | 'question'
  | 'decision_request'
  | 'task_assignment'
  | 'fyi'
  | 'discussion'
  | 'agreement'
  | 'objection';

interface IntentResult {
  intent: MessageIntent;
  confidence: number;
  entities: {
    people?: string[];
    deadlines?: string[];
    topics?: string[];
  };
}

class IntentService {
  // Quick pattern matching for common intents
  private quickDetect(content: string): MessageIntent | null {
    const lower = content.toLowerCase();

    // Question detection
    if (/\?$/.test(content) || /^(what|when|where|who|why|how|can|could|would|should|is|are)\b/i.test(content)) {
      return 'question';
    }

    // Decision detection
    if (/\b(decide|choose|pick|select|vote|prefer|option)\b/i.test(lower)) {
      return 'decision_request';
    }

    // Task assignment
    if (/\b(please|could you|can you|need you to|assign|task)\b/i.test(lower) &&
        /\b(do|complete|finish|handle|take care of)\b/i.test(lower)) {
      return 'task_assignment';
    }

    // Agreement
    if (/^(yes|agree|sounds good|makes sense|perfect|approved|lgtm|👍)/i.test(content)) {
      return 'agreement';
    }

    // Objection
    if (/^(no|disagree|i think not|not sure|concern|problem|issue)/i.test(lower)) {
      return 'objection';
    }

    return null;
  }

  // AI-powered intent detection for complex messages
  async detectWithAI(content: string): Promise<IntentResult> {
    const prompt = `Analyze this message and classify its intent.

Message: "${content}"

Return JSON with:
{
  "intent": "question" | "decision_request" | "task_assignment" | "fyi" | "discussion" | "agreement" | "objection",
  "confidence": 0-100,
  "entities": {
    "people": ["names mentioned"],
    "deadlines": ["dates or times mentioned"],
    "topics": ["key subjects"]
  }
}`;

    try {
      const response = await generateAI(prompt);
      const parsed = JSON.parse(response);
      return parsed;
    } catch (error) {
      console.error('AI intent detection failed:', error);
      return {
        intent: 'discussion',
        confidence: 30,
        entities: {}
      };
    }
  }

  // Main detection method
  async detectIntent(messageId: string, content: string): Promise<IntentResult> {
    // Try quick detection first
    const quickIntent = this.quickDetect(content);
    
    if (quickIntent && content.length < 100) {
      // Simple message, quick detection is enough
      const result: IntentResult = {
        intent: quickIntent,
        confidence: 85,
        entities: {}
      };

      await this.saveIntent(messageId, result);
      return result;
    }

    // Complex message, use AI
    const aiResult = await this.detectWithAI(content);
    await this.saveIntent(messageId, aiResult);
    return aiResult;
  }

  private async saveIntent(messageId: string, result: IntentResult) {
    await supabase
      .from('pulse_messages')
      .update({
        intent: result.intent,
        context_data: {
          intent_confidence: result.confidence,
          entities: result.entities
        }
      })
      .eq('id', messageId);
  }

  // Get messages by intent
  async getMessagesByIntent(
    channelId: string,
    intent: MessageIntent,
    limit: number = 10
  ) {
    const { data } = await supabase
      .from('pulse_messages')
      .select('*, user:pulse_users(*)')
      .eq('channel_id', channelId)
      .eq('intent', intent)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  // Get unanswered questions
  async getUnansweredQuestions(channelId: string) {
    const { data: questions } = await supabase
      .from('pulse_messages')
      .select('*, user:pulse_users(*)')
      .eq('channel_id', channelId)
      .eq('intent', 'question')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!questions) return [];

    // Check if questions have follow-up messages
    const unanswered = [];
    for (const question of questions) {
      const { data: replies } = await supabase
        .from('pulse_messages')
        .select('id')
        .eq('channel_id', channelId)
        .gt('created_at', question.created_at)
        .limit(1);

      if (!replies || replies.length === 0) {
        unanswered.push(question);
      }
    }

    return unanswered;
  }
}

export const intentService = new IntentService();
```

---

### Service 2: Context Service

File: `src/services/contextService.ts`

```typescript
import { supabase } from './supabaseClient';
import { generateAI } from './geminiService';

interface ContextLink {
  type: 'thread' | 'file' | 'decision' | 'contact';
  id: string;
  title: string;
  relevance: number;
  reason: string;
}

class ContextService {
  // Find related threads based on message content
  async findRelatedThreads(
    messageContent: string,
    currentThreadId: string,
    limit: number = 5
  ): Promise<ContextLink[]> {
    // Extract key terms from message
    const keywords = this.extractKeywords(messageContent);
    if (keywords.length === 0) return [];

    // Search threads by keywords
    const { data: threads } = await supabase
      .from('pulse_threads')
      .select('id, title, created_at')
      .neq('id', currentThreadId)
      .or(keywords.map(k => `title.ilike.%${k}%`).join(','))
      .limit(limit);

    if (!threads) return [];

    return threads.map(t => ({
      type: 'thread' as const,
      id: t.id,
      title: t.title,
      relevance: 0.7,
      reason: 'Similar topic discussed'
    }));
  }

  // Find related files
  async findRelatedFiles(
    messageContent: string,
    channelId: string,
    limit: number = 3
  ): Promise<ContextLink[]> {
    const keywords = this.extractKeywords(messageContent);
    if (keywords.length === 0) return [];

    const { data: files } = await supabase
      .from('pulse_files')
      .select('id, name, mime_type')
      .eq('channel_id', channelId)
      .or(keywords.map(k => `name.ilike.%${k}%`).join(','))
      .limit(limit);

    if (!files) return [];

    return files.map(f => ({
      type: 'file' as const,
      id: f.id,
      title: f.name,
      relevance: 0.6,
      reason: 'Related file attachment'
    }));
  }

  // Find related decisions
  async findRelatedDecisions(
    messageContent: string,
    limit: number = 3
  ): Promise<ContextLink[]> {
    const keywords = this.extractKeywords(messageContent);
    if (keywords.length === 0) return [];

    const { data: decisions } = await supabase
      .from('pulse_decisions')
      .select('id, title, status')
      .or(keywords.map(k => `title.ilike.%${k}%`).join(','))
      .limit(limit);

    if (!decisions) return [];

    return decisions.map(d => ({
      type: 'decision' as const,
      id: d.id,
      title: d.title,
      relevance: 0.8,
      reason: `Related ${d.status} decision`
    }));
  }

  // Find mentioned people
  async findMentionedPeople(messageContent: string): Promise<ContextLink[]> {
    // Extract @mentions or common names
    const mentions = messageContent.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];
    const { data: users } = await supabase
      .from('pulse_users')
      .select('id, full_name, email')
      .or(mentions.map(m => `full_name.ilike.%${m}%,email.ilike.%${m}%`).join(','));

    if (!users) return [];

    return users.map(u => ({
      type: 'contact' as const,
      id: u.id,
      title: u.full_name,
      relevance: 0.9,
      reason: 'Mentioned in message'
    }));
  }

  // Get all context for a message
  async getContextForMessage(
    messageId: string,
    messageContent: string,
    threadId: string,
    channelId: string
  ): Promise<{
    threads: ContextLink[];
    files: ContextLink[];
    decisions: ContextLink[];
    people: ContextLink[];
  }> {
    const [threads, files, decisions, people] = await Promise.all([
      this.findRelatedThreads(messageContent, threadId, 3),
      this.findRelatedFiles(messageContent, channelId, 2),
      this.findRelatedDecisions(messageContent, 2),
      this.findMentionedPeople(messageContent)
    ]);

    // Save context links to database
    await this.saveContextLinks(messageId, [
      ...threads,
      ...files,
      ...decisions,
      ...people
    ]);

    return { threads, files, decisions, people };
  }

  private async saveContextLinks(messageId: string, links: ContextLink[]) {
    const rows = links.map(link => ({
      source_message_id: messageId,
      target_type: link.type,
      target_id: link.id,
      relevance_score: link.relevance,
      link_reason: link.reason
    }));

    if (rows.length > 0) {
      await supabase.from('pulse_context_links').insert(rows);
    }
  }

  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
      'in', 'with', 'to', 'for', 'of', 'as', 'by', 'from', 'this', 'that'
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !stopWords.has(word) &&
        /^[a-z]+$/.test(word)
      )
      .slice(0, 5);
  }
}

export const contextService = new ContextService();
```

---

**Continuing in next file...**
