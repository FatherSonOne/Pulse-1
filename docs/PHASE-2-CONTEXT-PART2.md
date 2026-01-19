# 🧠 PHASE 2 PART 2: Summary & Priority Services + UI

## Service 3: Summary Service

File: `src/services/summaryService.ts`

```typescript
import { supabase } from './supabaseClient';
import { generateAI } from './geminiService';

interface ThreadSummary {
  summary_text: string;
  key_points: string[];
  participants: string[];
  decision_count: number;
  action_item_count: number;
}

class SummaryService {
  // Generate AI summary for a thread
  async generateThreadSummary(threadId: string): Promise<ThreadSummary> {
    // Get thread messages
    const { data: messages } = await supabase
      .from('pulse_messages')
      .select('*, user:pulse_users(*)')
      .eq('thread_id', threadId)
      .order('created_at');

    if (!messages || messages.length === 0) {
      return {
        summary_text: 'No messages in this thread yet.',
        key_points: [],
        participants: [],
        decision_count: 0,
        action_item_count: 0
      };
    }

    // Format messages for AI
    const conversation = messages
      .map(m => `${m.user.full_name}: ${m.content}`)
      .join('\n');

    const prompt = `Summarize this conversation thread:

${conversation}

Return JSON with:
{
  "summary": "2-3 sentence overview",
  "key_points": ["important point 1", "important point 2", ...],
  "participants": ["name1", "name2", ...],
  "decisions": ["decision 1", "decision 2", ...],
  "action_items": ["action 1", "action 2", ...]
}`;

    try {
      const response = await generateAI(prompt);
      const parsed = JSON.parse(response);

      const summary: ThreadSummary = {
        summary_text: parsed.summary,
        key_points: parsed.key_points || [],
        participants: parsed.participants || [],
        decision_count: (parsed.decisions || []).length,
        action_item_count: (parsed.action_items || []).length
      };

      // Save to database
      await this.saveSummary(threadId, summary);

      return summary;
    } catch (error) {
      console.error('Summary generation failed:', error);
      return {
        summary_text: 'Unable to generate summary.',
        key_points: [],
        participants: messages.map(m => m.user.full_name),
        decision_count: 0,
        action_item_count: 0
      };
    }
  }

  private async saveSummary(threadId: string, summary: ThreadSummary) {
    // Set summary valid for 24 hours
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 24);

    await supabase.from('pulse_thread_summaries').upsert({
      thread_id: threadId,
      summary_text: summary.summary_text,
      key_points: summary.key_points,
      participants: summary.participants,
      decision_count: summary.decision_count,
      action_item_count: summary.action_item_count,
      valid_until: validUntil.toISOString()
    });
  }

  // Get cached summary if valid
  async getSummary(threadId: string): Promise<ThreadSummary | null> {
    const { data } = await supabase
      .from('pulse_thread_summaries')
      .select('*')
      .eq('thread_id', threadId)
      .gt('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    return {
      summary_text: data.summary_text,
      key_points: data.key_points || [],
      participants: data.participants || [],
      decision_count: data.decision_count,
      action_item_count: data.action_item_count
    };
  }

  // Get or generate summary
  async getOrGenerateSummary(threadId: string): Promise<ThreadSummary> {
    const cached = await this.getSummary(threadId);
    if (cached) return cached;

    return this.generateThreadSummary(threadId);
  }
}

export const summaryService = new SummaryService();
```

---

## Service 4: Priority Scoring Service

File: `src/services/priorityService.ts`

```typescript
import { supabase } from './supabaseClient';

interface PriorityFactors {
  fromImportantPerson: boolean;    // +30
  mentionsMe: boolean;              // +25
  isQuestion: boolean;              // +20
  isDecision: boolean;              // +25
  isUrgent: boolean;                // +30
  threadActivity: number;           // 0-20
  recency: number;                  // 0-15
}

class PriorityService {
  // Calculate priority score (0-100)
  async calculatePriority(
    messageId: string,
    content: string,
    senderId: string,
    currentUserId: string,
    threadId: string
  ): Promise<number> {
    const factors: PriorityFactors = {
      fromImportantPerson: await this.isImportantPerson(senderId, currentUserId),
      mentionsMe: this.mentionsUser(content, currentUserId),
      isQuestion: /\?/.test(content),
      isDecision: /\b(decide|choose|vote)\b/i.test(content),
      isUrgent: this.hasUrgencyIndicators(content),
      threadActivity: await this.getThreadActivityScore(threadId),
      recency: this.getRecencyScore()
    };

    let score = 50; // Base score

    if (factors.fromImportantPerson) score += 30;
    if (factors.mentionsMe) score += 25;
    if (factors.isQuestion) score += 20;
    if (factors.isDecision) score += 25;
    if (factors.isUrgent) score += 30;
    score += factors.threadActivity; // 0-20
    score += factors.recency;        // 0-15

    // Cap at 100
    score = Math.min(100, score);

    // Save to database
    await supabase
      .from('pulse_messages')
      .update({ priority_score: score })
      .eq('id', messageId);

    return score;
  }

  private async isImportantPerson(
    senderId: string,
    currentUserId: string
  ): Promise<boolean> {
    // Check if sender is:
    // 1. User's manager
    // 2. User's direct report
    // 3. Someone user frequently messages

    const { data: interactions } = await supabase
      .from('pulse_messages')
      .select('id')
      .or(`user_id.eq.${senderId},user_id.eq.${currentUserId}`)
      .limit(10);

    return (interactions?.length || 0) >= 5;
  }

  private mentionsUser(content: string, userId: string): boolean {
    // Check for @mentions or direct addressing
    return new RegExp(`@${userId}|@all|@channel|@everyone`, 'i').test(content);
  }

  private hasUrgencyIndicators(content: string): boolean {
    const urgentWords = [
      'urgent', 'asap', 'immediately', 'critical', 'emergency',
      'now', 'today', 'deadline', 'blocker', 'blocked'
    ];

    const lower = content.toLowerCase();
    return urgentWords.some(word => lower.includes(word));
  }

  private async getThreadActivityScore(threadId: string): Promise<number> {
    // More active threads = higher priority
    const { data: messages } = await supabase
      .from('pulse_messages')
      .select('id')
      .eq('thread_id', threadId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const count = messages?.length || 0;
    
    // 0-5 messages = 0, 6-10 = 10, 11-20 = 15, 20+ = 20
    if (count <= 5) return 0;
    if (count <= 10) return 10;
    if (count <= 20) return 15;
    return 20;
  }

  private getRecencyScore(): number {
    // All messages are recent when initially scored
    // This would be updated over time in a real system
    return 15;
  }

  // Get high-priority messages
  async getHighPriorityMessages(
    userId: string,
    channelId: string,
    limit: number = 10
  ) {
    const { data } = await supabase
      .from('pulse_messages')
      .select('*, user:pulse_users(*)')
      .eq('channel_id', channelId)
      .gte('priority_score', 70)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }
}

export const priorityService = new PriorityService();
```

---

## 🎨 UI COMPONENTS

### Component 1: Intent Badge

File: `src/components/IntentBadge.tsx`

```typescript
import React from 'react';
import { MessageIntent } from '../services/intentService';
import { HelpCircle, AlertCircle, CheckSquare, Info, MessageCircle, ThumbsUp, X } from 'lucide-react';
import './IntentBadge.css';

interface IntentBadgeProps {
  intent: MessageIntent;
  confidence?: number;
  size?: 'small' | 'medium' | 'large';
}

export const IntentBadge: React.FC<IntentBadgeProps> = ({
  intent,
  confidence = 85,
  size = 'small'
}) => {
  const getConfig = () => {
    switch (intent) {
      case 'question':
        return {
          icon: <HelpCircle size={16} />,
          label: 'Question',
          color: '#3b82f6'
        };
      case 'decision_request':
        return {
          icon: <AlertCircle size={16} />,
          label: 'Decision Needed',
          color: '#f59e0b'
        };
      case 'task_assignment':
        return {
          icon: <CheckSquare size={16} />,
          label: 'Task',
          color: '#10b981'
        };
      case 'fyi':
        return {
          icon: <Info size={16} />,
          label: 'FYI',
          color: '#6b7280'
        };
      case 'agreement':
        return {
          icon: <ThumbsUp size={16} />,
          label: 'Agreed',
          color: '#22c55e'
        };
      case 'objection':
        return {
          icon: <X size={16} />,
          label: 'Objection',
          color: '#ef4444'
        };
      default:
        return {
          icon: <MessageCircle size={16} />,
          label: 'Discussion',
          color: '#8b5cf6'
        };
    }
  };

  const config = getConfig();
  const opacity = confidence >= 70 ? 1 : 0.6;

  return (
    <div 
      className={`intent-badge intent-${size}`}
      style={{ 
        backgroundColor: `${config.color}15`,
        borderColor: config.color,
        opacity
      }}
      title={`${config.label} (${confidence}% confident)`}
    >
      <span style={{ color: config.color }}>
        {config.icon}
      </span>
      <span className="intent-label" style={{ color: config.color }}>
        {config.label}
      </span>
    </div>
  );
};
```

File: `src/components/IntentBadge.css`

```css
.intent-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid;
  border-radius: 12px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.intent-small {
  padding: 2px 8px;
  font-size: 11px;
}

.intent-medium {
  padding: 4px 10px;
  font-size: 12px;
}

.intent-large {
  padding: 6px 14px;
  font-size: 14px;
}

.intent-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.intent-label {
  font-weight: 600;
}
```

---

### Component 2: Context Panel

File: `src/components/ContextPanel.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { contextService } from '../services/contextService';
import { Link, FileText, MessageSquare, User, ExternalLink } from 'lucide-react';
import './ContextPanel.css';

interface ContextPanelProps {
  messageId: string;
  messageContent: string;
  threadId: string;
  channelId: string;
}

interface ContextLink {
  type: 'thread' | 'file' | 'decision' | 'contact';
  id: string;
  title: string;
  relevance: number;
  reason: string;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  messageId,
  messageContent,
  threadId,
  channelId
}) => {
  const [context, setContext] = useState<{
    threads: ContextLink[];
    files: ContextLink[];
    decisions: ContextLink[];
    people: ContextLink[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadContext();
  }, [messageId]);

  const loadContext = async () => {
    setLoading(true);
    try {
      const result = await contextService.getContextForMessage(
        messageId,
        messageContent,
        threadId,
        channelId
      );
      setContext(result);
    } catch (error) {
      console.error('Failed to load context:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="context-panel loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!context) return null;

  const totalLinks = 
    context.threads.length +
    context.files.length +
    context.decisions.length +
    context.people.length;

  if (totalLinks === 0) return null;

  const renderIcon = (type: string) => {
    switch (type) {
      case 'thread': return <MessageSquare size={14} />;
      case 'file': return <FileText size={14} />;
      case 'decision': return <Link size={14} />;
      case 'contact': return <User size={14} />;
      default: return null;
    }
  };

  const renderLink = (link: ContextLink) => (
    <div key={link.id} className="context-link">
      <div className="link-icon">{renderIcon(link.type)}</div>
      <div className="link-content">
        <div className="link-title">{link.title}</div>
        <div className="link-reason">{link.reason}</div>
      </div>
      <ExternalLink size={12} className="link-action" />
    </div>
  );

  return (
    <div className={`context-panel ${expanded ? 'expanded' : ''}`}>
      <div className="context-header" onClick={() => setExpanded(!expanded)}>
        <Link size={16} />
        <span>Related Context ({totalLinks})</span>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="context-body">
          {context.threads.length > 0 && (
            <div className="context-section">
              <h4>Related Threads</h4>
              {context.threads.map(renderLink)}
            </div>
          )}

          {context.files.length > 0 && (
            <div className="context-section">
              <h4>Related Files</h4>
              {context.files.map(renderLink)}
            </div>
          )}

          {context.decisions.length > 0 && (
            <div className="context-section">
              <h4>Related Decisions</h4>
              {context.decisions.map(renderLink)}
            </div>
          )}

          {context.people.length > 0 && (
            <div className="context-section">
              <h4>People Mentioned</h4>
              {context.people.map(renderLink)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

File: `src/components/ContextPanel.css`

```css
.context-panel {
  background: #f8f9fa;
  border-radius: 8px;
  margin-top: 8px;
  overflow: hidden;
  transition: all 0.3s;
}

.context-panel.loading {
  padding: 20px;
  display: flex;
  justify-content: center;
}

.context-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  transition: background 0.2s;
}

.context-header:hover {
  background: #e9ecef;
}

.expand-icon {
  margin-left: auto;
  font-size: 10px;
  transition: transform 0.3s;
}

.context-panel.expanded .expand-icon {
  transform: rotate(90deg);
}

.context-body {
  padding: 0 12px 12px;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.context-section {
  margin-bottom: 16px;
}

.context-section:last-child {
  margin-bottom: 0;
}

.context-section h4 {
  margin: 0 0 8px 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  letter-spacing: 0.5px;
}

.context-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: white;
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.context-link:hover {
  background: #f0f7ff;
  transform: translateX(4px);
}

.link-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  background: #667eea15;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667eea;
}

.link-content {
  flex: 1;
  min-width: 0;
}

.link-title {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-reason {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.link-action {
  flex-shrink: 0;
  color: #9ca3af;
  opacity: 0;
  transition: opacity 0.2s;
}

.context-link:hover .link-action {
  opacity: 1;
}
```

---

**Continuing in next file with ThreadSummary component and integration...**
