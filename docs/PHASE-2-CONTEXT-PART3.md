# 🧠 PHASE 2 PART 3: Summary UI & Integration

## Component 3: Thread Summary

File: `src/components/ThreadSummary.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { summaryService } from '../services/summaryService';
import { FileText, Users, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import './ThreadSummary.css';

interface ThreadSummaryProps {
  threadId: string;
}

interface Summary {
  summary_text: string;
  key_points: string[];
  participants: string[];
  decision_count: number;
  action_item_count: number;
}

export const ThreadSummary: React.FC<ThreadSummaryProps> = ({ threadId }) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [threadId]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const result = await summaryService.getOrGenerateSummary(threadId);
      setSummary(result);
    } catch (error) {
      console.error('Failed to load summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const regenerateSummary = async () => {
    setLoading(true);
    try {
      const result = await summaryService.generateThreadSummary(threadId);
      setSummary(result);
    } catch (error) {
      console.error('Failed to regenerate summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="thread-summary loading">
        <div className="spinner"></div>
        <p>Generating summary...</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className={`thread-summary ${expanded ? 'expanded' : ''}`}>
      <div className="summary-header" onClick={() => setExpanded(!expanded)}>
        <FileText size={18} />
        <span>Thread Summary</span>
        <button
          className="regenerate-btn"
          onClick={(e) => {
            e.stopPropagation();
            regenerateSummary();
          }}
          title="Regenerate summary"
        >
          <RefreshCw size={14} />
        </button>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>

      <div className="summary-preview">
        <p>{summary.summary_text}</p>
      </div>

      {expanded && (
        <div className="summary-details">
          {summary.key_points.length > 0 && (
            <div className="summary-section">
              <h4>
                <CheckCircle size={14} />
                Key Points
              </h4>
              <ul>
                {summary.key_points.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="summary-stats">
            <div className="stat">
              <Users size={14} />
              <span>{summary.participants.length} participants</span>
            </div>
            {summary.decision_count > 0 && (
              <div className="stat">
                <AlertCircle size={14} />
                <span>{summary.decision_count} decisions</span>
              </div>
            )}
            {summary.action_item_count > 0 && (
              <div className="stat">
                <CheckCircle size={14} />
                <span>{summary.action_item_count} action items</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

File: `src/components/ThreadSummary.css`

```css
.thread-summary {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #667eea30;
  transition: all 0.3s;
}

.thread-summary.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
}

.thread-summary.loading p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  margin-bottom: 12px;
  font-weight: 600;
  color: #667eea;
}

.regenerate-btn {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #667eea;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.regenerate-btn:hover {
  background: #667eea20;
  transform: rotate(180deg);
}

.expand-icon {
  font-size: 10px;
  transition: transform 0.3s;
}

.thread-summary.expanded .expand-icon {
  transform: rotate(90deg);
}

.summary-preview {
  padding-left: 28px;
}

.summary-preview p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
}

.summary-details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #667eea20;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.summary-section {
  margin-bottom: 16px;
}

.summary-section h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.summary-section ul {
  margin: 0;
  padding-left: 20px;
  list-style: none;
}

.summary-section li {
  position: relative;
  font-size: 13px;
  line-height: 1.6;
  color: #666;
  padding-left: 16px;
  margin-bottom: 6px;
}

.summary-section li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #667eea;
  font-weight: bold;
}

.summary-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  background: white;
  padding: 6px 12px;
  border-radius: 6px;
}

.stat svg {
  color: #667eea;
}
```

---

## Component 4: Priority Indicator

File: `src/components/PriorityIndicator.tsx`

```typescript
import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import './PriorityIndicator.css';

interface PriorityIndicatorProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export const PriorityIndicator: React.FC<PriorityIndicatorProps> = ({
  score,
  size = 'small',
  showLabel = false
}) => {
  const getConfig = () => {
    if (score >= 80) {
      return {
        icon: <AlertCircle size={16} />,
        label: 'High Priority',
        color: '#ef4444',
        bgColor: '#ef444410'
      };
    }
    if (score >= 60) {
      return {
        icon: <AlertTriangle size={16} />,
        label: 'Medium Priority',
        color: '#f59e0b',
        bgColor: '#f59e0b10'
      };
    }
    return {
      icon: <Info size={16} />,
      label: 'Normal Priority',
      color: '#6b7280',
      bgColor: '#6b728010'
    };
  };

  const config = getConfig();

  return (
    <div
      className={`priority-indicator priority-${size}`}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.color
      }}
      title={`Priority: ${score}/100`}
    >
      <span style={{ color: config.color }}>
        {config.icon}
      </span>
      {showLabel && (
        <span className="priority-label" style={{ color: config.color }}>
          {config.label}
        </span>
      )}
      <span className="priority-score" style={{ color: config.color }}>
        {score}
      </span>
    </div>
  );
};
```

File: `src/components/PriorityIndicator.css`

```css
.priority-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid;
  border-radius: 12px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
}

.priority-small {
  padding: 2px 8px;
  font-size: 11px;
}

.priority-medium {
  padding: 4px 10px;
  font-size: 12px;
}

.priority-large {
  padding: 6px 14px;
  font-size: 14px;
}

.priority-label {
  font-weight: 600;
}

.priority-score {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
```

---

## 🔗 INTEGRATION INSTRUCTIONS

### Step 1: Update Messages.tsx

Add intent badges and context panels to messages:

```typescript
// Add imports at top
import { IntentBadge } from '../components/IntentBadge';
import { ContextPanel } from '../components/ContextPanel';
import { PriorityIndicator } from '../components/PriorityIndicator';
import { intentService } from '../services/intentService';
import { priorityService } from '../services/priorityService';
import { useEffect } from 'react';

// Add state
const [messageIntents, setMessageIntents] = useState<Record<string, any>>({});

// Add effect to detect intents for new messages
useEffect(() => {
  if (!messages.length || !currentUser) return;

  const lastMessage = messages[messages.length - 1];
  if (lastMessage && !messageIntents[lastMessage.id]) {
    detectIntent(lastMessage);
    calculatePriority(lastMessage);
  }
}, [messages]);

const detectIntent = async (message: any) => {
  const result = await intentService.detectIntent(
    message.id,
    message.content
  );
  
  setMessageIntents(prev => ({
    ...prev,
    [message.id]: result
  }));
};

const calculatePriority = async (message: any) => {
  if (!currentUser) return;
  
  await priorityService.calculatePriority(
    message.id,
    message.content,
    message.user_id,
    currentUser.id,
    message.thread_id || message.channel_id
  );
};

// Update message rendering
{messages.map(msg => {
  const intent = messageIntents[msg.id];
  return (
    <div key={msg.id} className="message">
      <div className="message-header">
        <strong>{msg.user?.full_name}</strong>
        {intent && <IntentBadge intent={intent.intent} confidence={intent.confidence} />}
        {msg.priority_score >= 60 && (
          <PriorityIndicator score={msg.priority_score} />
        )}
        <span className="time">{formatTime(msg.created_at)}</span>
      </div>
      <div className="message-content">{msg.content}</div>
      
      {/* Add context panel for important messages */}
      {msg.priority_score >= 70 && (
        <ContextPanel
          messageId={msg.id}
          messageContent={msg.content}
          threadId={msg.thread_id || msg.channel_id}
          channelId={msg.channel_id}
        />
      )}
    </div>
  );
})}
```

### Step 2: Add Thread Summary to Thread View

If you have a thread detail view, add the summary:

```typescript
// In ThreadDetail.tsx or similar
import { ThreadSummary } from '../components/ThreadSummary';

// At the top of the thread
<ThreadSummary threadId={selectedThread} />
```

### Step 3: Add Priority Filter to Messages

Add a filter button to show high-priority messages:

```typescript
// Add state
const [showOnlyHighPriority, setShowOnlyHighPriority] = useState(false);

// Filter messages
const displayMessages = showOnlyHighPriority
  ? messages.filter(m => m.priority_score >= 70)
  : messages;

// Add button in header
<button
  className="filter-btn"
  onClick={() => setShowOnlyHighPriority(!showOnlyHighPriority)}
>
  {showOnlyHighPriority ? 'Show All' : 'High Priority Only'}
</button>
```

---

## ✅ TESTING CHECKLIST

### Intent Detection:
- [ ] Send "What time is the meeting?" → Shows Question badge
- [ ] Send "We need to decide on the vendor" → Shows Decision badge
- [ ] Send "Can you complete the report?" → Shows Task badge
- [ ] Send "FYI: Server is down" → Shows FYI badge

### Context Panel:
- [ ] Send message mentioning another thread → Related thread appears
- [ ] Upload file then reference it → File appears in context
- [ ] Mention team member → Person appears in context
- [ ] Context panel is expandable/collapsible

### Thread Summary:
- [ ] Open thread with 5+ messages
- [ ] Summary appears automatically
- [ ] Click to expand full details
- [ ] Key points are extracted
- [ ] Click regenerate button → New summary appears

### Priority Scoring:
- [ ] Urgent message gets high score (red indicator)
- [ ] @mention increases priority
- [ ] Questions from manager get high priority
- [ ] Filter by high priority shows only important messages

---

## 🎉 PHASE 2 COMPLETE!

You now have:
- ✅ Automatic intent detection
- ✅ Smart context panels
- ✅ AI-generated summaries
- ✅ Priority scoring system

**Commit your work:**

```powershell
git add .
git commit -m "Phase 2: Context-Aware Messaging features"
```

---

## 📊 PROGRESS UPDATE

**Completed:**
- Phase 1: Time & Attention Intelligence ✅
- Phase 2: Context-Aware Messaging ✅

**Remaining:**
- Phase 3: Decision & Task Workflows (next!)
- Phase 4: Relationship & Social Health
- Phase 5: Cross-App Intelligence

**Total time so far:** ~11-13 hours

Let me know when you're ready for Phase 3! 🚀
