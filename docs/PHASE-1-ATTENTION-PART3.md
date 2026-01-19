# 🎯 PHASE 1 PART 3: Meeting Deflector Component & Integration

## ⏱️ Time Required: 1-2 hours

---

## 📦 Component 3: MeetingDeflector

### File: `src/components/MeetingDeflector.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { Calendar, FileText, Video, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { meetingDeflectionService, DeflectionSuggestion } from '../services/meetingDeflectionService';
import './MeetingDeflector.css';

interface MeetingDeflectorProps {
  threadId: string;
  messages: Array<{ content: string; created_at: string }>;
  onClose: () => void;
  onAccept: (suggestion: DeflectionSuggestion) => void;
}

export const MeetingDeflector: React.FC<MeetingDeflectorProps> = ({
  threadId,
  messages,
  onClose,
  onAccept
}) => {
  const [suggestion, setSuggestion] = useState<DeflectionSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  useEffect(() => {
    analyzeMeetingRequest();
  }, [threadId, messages]);

  const analyzeMeetingRequest = async () => {
    setLoading(true);
    try {
      const result = await meetingDeflectionService.analyzeThread(
        threadId,
        messages.map(m => m.content).join('\n\n')
      );
      
      if (result) {
        setSuggestion(result);
      }
    } catch (error) {
      console.error('Failed to analyze thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!suggestion) return;

    await meetingDeflectionService.recordUserDecision(
      suggestion.deflection_id,
      'accepted'
    );

    onAccept(suggestion);
  };

  const handleReject = async () => {
    if (!suggestion) return;

    await meetingDeflectionService.recordUserDecision(
      suggestion.deflection_id,
      'rejected'
    );

    onClose();
  };

  const loadTemplate = async (altType: string) => {
    const template = await meetingDeflectionService.getTemplate(altType);
    setSelectedTemplate(template);
  };

  if (loading) {
    return (
      <div className="meeting-deflector">
        <div className="deflector-loading">
          <div className="spinner"></div>
          <p>Analyzing conversation...</p>
        </div>
      </div>
    );
  }

  if (!suggestion) {
    return null;
  }

  const getIcon = () => {
    switch (suggestion.alternative_type) {
      case 'poll':
        return <FileText size={24} />;
      case 'async_video':
        return <Video size={24} />;
      case 'decision_doc':
        return <FileText size={24} />;
      default:
        return <Calendar size={24} />;
    }
  };

  const getTitle = () => {
    switch (suggestion.alternative_type) {
      case 'poll':
        return 'Try a Quick Poll Instead?';
      case 'async_video':
        return 'Record an Async Video?';
      case 'decision_doc':
        return 'Create a Decision Doc?';
      default:
        return 'Alternative Suggestion';
    }
  };

  return (
    <div className="meeting-deflector">
      <div className="deflector-card">
        <button className="deflector-close" onClick={onClose}>
          <X size={16} />
        </button>

        <div className="deflector-header">
          <div className="deflector-icon">{getIcon()}</div>
          <h3>{getTitle()}</h3>
        </div>

        <div className="deflector-body">
          <p className="deflector-reason">{suggestion.reasoning}</p>

          <div className="deflector-template">
            <button
              className="template-btn"
              onClick={() => loadTemplate(suggestion.alternative_type)}
            >
              Show template
            </button>

            {selectedTemplate && (
              <div className="template-content">
                <pre>{selectedTemplate}</pre>
                <button
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(selectedTemplate)}
                >
                  Copy Template
                </button>
              </div>
            )}
          </div>

          <div className="deflector-benefits">
            <h4>Benefits:</h4>
            <ul>
              {suggestion.alternative_type === 'poll' && (
                <>
                  <li>✓ Get answers in minutes, not hours</li>
                  <li>✓ No calendar conflicts</li>
                  <li>✓ Clear data for decision-making</li>
                </>
              )}
              {suggestion.alternative_type === 'async_video' && (
                <>
                  <li>✓ Watch on their schedule</li>
                  <li>✓ Pause, rewatch, and absorb</li>
                  <li>✓ No timezone hassles</li>
                </>
              )}
              {suggestion.alternative_type === 'decision_doc' && (
                <>
                  <li>✓ Document options clearly</li>
                  <li>✓ Asynchronous input</li>
                  <li>✓ Track decision rationale</li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="deflector-actions">
          <button className="deflector-reject" onClick={handleReject}>
            <ThumbsDown size={16} />
            No, Schedule Meeting
          </button>
          <button className="deflector-accept" onClick={handleAccept}>
            <ThumbsUp size={16} />
            Try This Instead
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

### File: `src/components/MeetingDeflector.css`

```css
.meeting-deflector {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.deflector-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  width: 380px;
  max-height: 90vh;
  overflow: auto;
  position: relative;
}

.deflector-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #666;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.deflector-close:hover {
  background: #f0f0f0;
  color: #333;
}

.deflector-header {
  padding: 24px 24px 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.deflector-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.deflector-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.deflector-body {
  padding: 20px 24px;
}

.deflector-reason {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
  margin-bottom: 16px;
}

.deflector-template {
  margin-bottom: 20px;
}

.template-btn {
  background: transparent;
  border: 1px solid #667eea;
  color: #667eea;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.template-btn:hover {
  background: #667eea;
  color: white;
}

.template-content {
  margin-top: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
}

.template-content pre {
  font-size: 12px;
  color: #333;
  white-space: pre-wrap;
  margin: 0 0 8px 0;
  font-family: 'Courier New', monospace;
}

.copy-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #5568d3;
}

.deflector-benefits {
  background: #f0f7ff;
  border-radius: 8px;
  padding: 16px;
}

.deflector-benefits h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.deflector-benefits ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.deflector-benefits li {
  font-size: 13px;
  color: #555;
  padding: 4px 0;
  line-height: 1.4;
}

.deflector-actions {
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 12px;
}

.deflector-reject,
.deflector-accept {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.deflector-reject {
  background: #f0f0f0;
  color: #666;
}

.deflector-reject:hover {
  background: #e0e0e0;
  color: #333;
}

.deflector-accept {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.deflector-accept:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.deflector-loading {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  padding: 40px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 3px solid #f0f0f0;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.deflector-loading p {
  margin: 0;
  color: #666;
  font-size: 14px;
}
```

---

## 🔗 INTEGRATION INSTRUCTIONS

### Step 1: Update Messages.tsx

Add MeetingDeflector to the Messages component:

```typescript
// At the top of Messages.tsx, add import
import { MeetingDeflector } from '../components/MeetingDeflector';
import { useState, useEffect } from 'react';

// Inside Messages component, add state
const [showDeflector, setShowDeflector] = useState(false);
const [deflectorMessages, setDeflectorMessages] = useState<any[]>([]);

// Add useEffect to detect meeting keywords
useEffect(() => {
  if (!messages.length) return;

  const recentMessages = messages.slice(-5);
  const hasMeetingKeyword = recentMessages.some(msg =>
    /\b(meeting|schedule|call|sync|zoom|meet)\b/i.test(msg.content)
  );

  if (hasMeetingKeyword && !showDeflector) {
    setShowDeflector(true);
    setDeflectorMessages(recentMessages);
  }
}, [messages]);

// In the render section, add before closing div
{showDeflector && (
  <MeetingDeflector
    threadId={selectedChannel || ''}
    messages={deflectorMessages}
    onClose={() => setShowDeflector(false)}
    onAccept={(suggestion) => {
      // Insert the template as a message
      setNewMessage(suggestion.template || '');
      setShowDeflector(false);
    }}
  />
)}
```

### Step 2: Update Dashboard.tsx

Add AttentionDashboard and FocusMode to the Dashboard:

```typescript
// At the top of Dashboard.tsx, add imports
import { AttentionDashboard } from '../components/AttentionDashboard';
import { FocusMode } from '../components/FocusMode';

// In the render section, add a new section
<div className="dashboard-section">
  <h2>🎯 Attention & Focus</h2>
  
  <div className="attention-widgets">
    <AttentionDashboard userId={currentUser.id} />
    <FocusMode userId={currentUser.id} />
  </div>
</div>
```

### Step 3: Add Dashboard Styles

Add to `src/views/Dashboard.css`:

```css
.attention-widgets {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .attention-widgets {
    grid-template-columns: 1fr;
  }
}
```

---

## ✅ TESTING CHECKLIST

### Attention Budget:
- [ ] Open Dashboard
- [ ] See current load percentage
- [ ] Load changes color at 60% and 85%
- [ ] Batched notifications appear when load is high
- [ ] "Release All" shows notifications

### Focus Mode:
- [ ] Click "Start Focus Session"
- [ ] Enter topic and select threads to hide
- [ ] Selected threads disappear from Messages view
- [ ] Click "End Focus" after 5 minutes
- [ ] Digest shows missed messages and decisions

### Meeting Deflector:
- [ ] Go to Messages
- [ ] Type "Let's schedule a meeting"
- [ ] Deflector card appears in bottom-right
- [ ] Click "Show template"
- [ ] Template appears with copy button
- [ ] Click "Try This Instead" - template fills message input
- [ ] Click "No, Schedule Meeting" - deflector closes

---

## 🎉 PHASE 1 COMPLETE!

You now have:
- ✅ Smart attention budget tracking
- ✅ Notification batching for focus
- ✅ Focus mode with digests
- ✅ Meeting deflection with AI suggestions

**Time to commit your work:**

```powershell
git add .
git commit -m "Phase 1: Time & Attention Intelligence features"
```

---

## 🚀 READY FOR PHASE 2?

Phase 2 will add **Context-Aware Messaging**:
- Intent detection
- Auto-context panels
- Smart summaries
- Priority scoring

Let me know when you're ready!
