### Step 4: Create Meeting Deflection Service

Create file: `src/services/meetingDeflectionService.ts`

```typescript
import { supabase } from './supabase';
import { geminiService } from './geminiService';
import { Message } from '../types';

export interface AsyncSuggestion {
  detected: boolean;
  type: 'poll' | 'video' | 'doc';
  reason: string;
  template: string;
}

export class MeetingDeflectionService {
  // Detect if thread is heading towards unnecessary meeting
  static async analyzeTh for_meeting(
    threadId: string,
    recentMessages: Message[]
  ): Promise<AsyncSuggestion> {
    if (recentMessages.length < 3) {
      return { detected: false, type: 'doc', reason: '', template: '' };
    }

    // Look for meeting indicators
    const meetingKeywords = [
      'let\\'s meet',
      'schedule a call',
      'hop on a call',
      'quick sync',
      'can we meet',
      'meeting invite'
    ];

    const conversationText = recentMessages
      .map(m => m.text.toLowerCase())
      .join(' ');

    const hasMeetingMention = meetingKeywords.some(kw => 
      conversationText.includes(kw)
    );

    if (!hasMeetingMention) {
      return { detected: false, type: 'doc', reason: '', template: '' };
    }

    // Use AI to determine best async alternative
    const prompt = `Analyze this conversation and suggest the best async alternative to a meeting:

Recent messages:
${recentMessages.map(m => `- ${m.text}`).join('\\n')}

Respond in JSON format:
{
  "shouldDeflect": true/false,
  "type": "poll" | "video" | "doc",
  "reason": "explanation",
  "template": "suggested template"
}`;

    try {
      const result = await geminiService.generateText(prompt);
      const suggestion = JSON.parse(result);

      if (suggestion.shouldDeflect) {
        // Store suggestion in database
        await supabase
          .from('pulse_meeting_deflections')
          .insert({
            thread_id: threadId,
            deflection_type: suggestion.type,
            reason: suggestion.reason,
            template: suggestion.template
          });

        return {
          detected: true,
          type: suggestion.type,
          reason: suggestion.reason,
          template: suggestion.template
        };
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
    }

    return { detected: false, type: 'doc', reason: '', template: '' };
  }

  // Mark suggestion as accepted/rejected
  static async recordUserDecision(
    deflectionId: string,
    accepted: boolean
  ): Promise<void> {
    await supabase
      .from('pulse_meeting_deflections')
      .update({ accepted })
      .eq('id', deflectionId);
  }

  // Get templates for async alternatives
  static getTemplate(type: 'poll' | 'video' | 'doc'): string {
    const templates = {
      poll: `📊 Quick Decision Poll

Question: [Your question here]

Options:
 A) [Option 1]
 B) [Option 2]
 C) [Option 3]

Vote with emoji reactions! ⬆️ Results in 24h`,

      video: `🎥 Async Video Update

I'll record a quick Loom/video covering:
• [Point 1]
• [Point 2]
• [Point 3]

Will share link by EOD. Feel free to respond async!`,

      doc: `📝 Decision Document

I've created a doc to capture:
• Context & Background
• Options & Trade-offs
• Recommendation

Please review and leave comments by [date]. We can finalize async!`
    };

    return templates[type];
  }
}
```

✅ Save this file

---

## 🎨 CREATE UI COMPONENTS

### Step 5: Attention Dashboard Component

Create file: `src/components/AttentionDashboard.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { AttentionService, AttentionBudget, BatchedNotification } from '../services/attentionService';

interface AttentionDashboardProps {
  userId: string;
}

export const AttentionDashboard: React.FC<AttentionDashboardProps> = ({ userId }) => {
  const [budget, setBudget] = useState<AttentionBudget>({
    currentLoad: 0,
    maxLoad: 100,
    status: 'healthy',
    batchedCount: 0
  });
  const [batchedNotifications, setBatchedNotifications] = useState<BatchedNotification[]>([]);
  const [showBatched, setShowBatched] = useState(false);

  useEffect(() => {
    loadBudget();
    const interval = setInterval(loadBudget, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [userId]);

  const loadBudget = async () => {
    const data = await AttentionService.getBudget(userId);
    setBudget(data);

    if (data.batchedCount > 0) {
      const batched = await AttentionService.getBatchedNotifications(userId);
      setBatchedNotifications(batched);
    }
  };

  const handleReleaseBatch = async () => {
    await AttentionService.releaseBatch(userId);
    loadBudget();
    setShowBatched(false);
  };

  const getLoadColor = () => {
    if (budget.status === 'healthy') return 'bg-green-500';
    if (budget.status === 'strained') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusEmoji = () => {
    if (budget.status === 'healthy') return '✅';
    if (budget.status === 'strained') return '⚠️';
    return '🔴';
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          {getStatusEmoji()} Attention Budget
        </h3>
        <span className="text-sm text-zinc-500 capitalize">{budget.status}</span>
      </div>

      {/* Load Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-zinc-600 dark:text-zinc-400">Current Load</span>
          <span className="font-bold text-zinc-900 dark:text-white">{budget.currentLoad}%</span>
        </div>
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getLoadColor()} transition-all duration-500`}
            style={{ width: `${budget.currentLoad}%` }}
          />
        </div>
      </div>

      {/* Batched Notifications */}
      {budget.batchedCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              📬 {budget.batchedCount} notifications batched
            </span>
            <button
              onClick={() => setShowBatched(!showBatched)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showBatched ? 'Hide' : 'View'}
            </button>
          </div>

          {showBatched && (
            <div className="space-y-2 mt-3">
              {batchedNotifications.map(notif => (
                <div key={notif.id} className="text-sm bg-white dark:bg-zinc-800 rounded p-2">
                  <div className="font-medium text-zinc-900 dark:text-white">{notif.source}</div>
                  <div className="text-zinc-600 dark:text-zinc-400 text-xs">{notif.message}</div>
                </div>
              ))}
              <button
                onClick={handleReleaseBatch}
                className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
              >
                Release All Notifications
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status Description */}
      <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {budget.status === 'healthy' && '✨ Great! Your attention is well-managed.'}
        {budget.status === 'strained' && '⚡ Getting busy. Non-urgent items are being batched.'}
        {budget.status === 'overloaded' && '🚨 High load! Consider enabling focus mode.'}
      </div>
    </div>
  );
};
```

✅ Save this file

---

### Step 6: Focus Mode Component

Create file: `src/components/FocusMode.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { FocusService, FocusSession, FocusDigest } from '../services/focusService';
import { Thread } from '../types';

interface FocusModeProps {
  userId: string;
  threads: Thread[];
  onThreadsFiltered: (filteredThreads: Thread[]) => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({ 
  userId, 
  threads, 
  onThreadsFiltered 
}) => {
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [topic, setTopic] = useState('');
  const [selectedThreads, setSelectedThreads] = useState<string[]>([]);
  const [digest, setDigest] = useState<FocusDigest | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    loadActiveSession();
  }, [userId]);

  const loadActiveSession = async () => {
    const session = await FocusService.getActiveSession(userId);
    setActiveSession(session);
    
    if (session) {
      const filtered = FocusService.filterThreadsForFocus(threads, session.hiddenThreads);
      onThreadsFiltered(filtered);
    }
  };

  const handleStartFocus = async () => {
    if (!topic.trim() || selectedThreads.length === 0) return;

    const sessionId = await FocusService.startFocus(userId, topic, selectedThreads);
    await loadActiveSession();
    setShowSetup(false);
    setTopic('');
    setSelectedThreads([]);
  };

  const handleEndFocus = async () => {
    if (!activeSession) return;

    await FocusService.endFocus(activeSession.id);
    const generatedDigest = await FocusService.generateDigest(activeSession.id, threads);
    setDigest(generatedDigest);
    setActiveSession(null);
    onThreadsFiltered(threads); // Show all threads again
  };

  const toggleThreadSelection = (threadId: string) => {
    setSelectedThreads(prev =>
      prev.includes(threadId)
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  };

  if (activeSession) {
    return (
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
              <i className="fa-solid fa-eye-slash text-white"></i>
            </div>
            <div>
              <h3 className="font-bold text-purple-900 dark:text-purple-100">Focus Mode Active</h3>
              <p className="text-sm text-purple-700 dark:text-purple-300">{activeSession.topic}</p>
            </div>
          </div>
          <button
            onClick={handleEndFocus}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
          >
            End Focus
          </button>
        </div>

        <div className="text-sm text-purple-700 dark:text-purple-300">
          ⏰ Started {new Date(activeSession.startTime).toLocaleTimeString()}
          <br />
          🔕 {activeSession.hiddenThreads.length} conversations hidden
        </div>
      </div>
    );
  }

  if (digest) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-4">
          📊 Focus Session Complete
        </h3>
        
        <div className="space-y-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">{digest.summary}</p>
          
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4">
            <div className="text-sm font-medium mb-2">📬 {digest.missedMessages} messages while focused</div>
            
            {digest.importantUpdates.length > 0 && (
              <div className="mt-3">
                <div className="font-medium text-xs text-zinc-600 dark:text-zinc-400 mb-2">Important Updates:</div>
                {digest.importantUpdates.map((update, i) => (
                  <div key={i} className="text-sm text-zinc-700 dark:text-zinc-300 mb-1">• {update}</div>
                ))}
              </div>
            )}

            {digest.decisions.length > 0 && (
              <div className="mt-3">
                <div className="font-medium text-xs text-zinc-600 dark:text-zinc-400 mb-2">Decisions Made:</div>
                {digest.decisions.map((decision, i) => (
                  <div key={i} className="text-sm text-zinc-700 dark:text-zinc-300 mb-1">• {decision}</div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setDigest(null)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Got it!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!showSetup ? (
        <button
          onClick={() => setShowSetup(true)}
          className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition font-medium flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-eye-slash"></i>
          Enable Focus Mode
        </button>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800">
          <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white">Setup Focus Session</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
              What are you focusing on?
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., 'Writing quarterly report'"
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
              Hide these conversations:
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {threads.map(thread => (
                <label key={thread.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                  <input
                    type="checkbox"
                    checked={selectedThreads.includes(thread.id)}
                    onChange={() => toggleThreadSelection(thread.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-zinc-900 dark:text-white">{thread.contactName}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleStartFocus}
              disabled={!topic.trim() || selectedThreads.length === 0}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Focus
            </button>
            <button
              onClick={() => setShowSetup(false)}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

✅ Save this file

---

(Part 2 continues in PHASE-1-ATTENTION-PART2.md)
