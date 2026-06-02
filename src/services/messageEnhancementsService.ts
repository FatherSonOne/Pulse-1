// Message Enhancements Service
// Central service for all message enhancement features

import { invokeAIPrompt, invokeAIJson } from './ai/aiService';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';
import type {
  MessageMood,
  RichMessageCard,
  SmartComposeSuggestion,
  AICoachSuggestion,
  ConversationHealth,
  MessageImpact,
  Achievement,
  ProactiveInsight,
  MessageTranslation,
  NetworkNode,
  ConversationMemory,
  Milestone
} from '../types/messageEnhancements';
import type { Thread, Message } from '../types';

class MessageEnhancementsService {
  
  // ============= MOOD DETECTION =============
  
  detectMessageMood(text: string): MessageMood {
    const lower = text.toLowerCase();
    
    // Urgent indicators
    if (lower.includes('urgent') || lower.includes('asap') || lower.includes('immediately') || 
        lower.includes('!!!') || lower.includes('emergency')) {
      return {
        sentiment: 'urgent',
        confidence: 0.9,
        emoji: '⚠️',
        color: '#ef4444',
        label: 'Urgent'
      };
    }
    
    // Question indicators
    if (text.includes('?') || lower.startsWith('can you') || lower.startsWith('could you') ||
        lower.startsWith('would you') || lower.startsWith('how') || lower.startsWith('what') ||
        lower.startsWith('when') || lower.startsWith('where') || lower.startsWith('why')) {
      return {
        sentiment: 'question',
        confidence: 0.95,
        emoji: '❓',
        color: '#3b82f6',
        label: 'Question'
      };
    }
    
    // Positive indicators
    const positiveWords = ['great', 'awesome', 'excellent', 'perfect', 'amazing', 'fantastic', 
                          'wonderful', 'thanks', 'thank you', '👍', '❤️', '🎉', '✅'];
    const positiveCount = positiveWords.filter(word => lower.includes(word)).length;
    
    if (positiveCount >= 2) {
      return {
        sentiment: 'positive',
        confidence: 0.85,
        emoji: '😊',
        color: '#22c55e',
        label: 'Positive'
      };
    }
    
    // Negative indicators
    const negativeWords = ['problem', 'issue', 'error', 'fail', 'bug', 'broken', 'wrong', 
                          'concern', 'worried', 'blocker', '❌', '⚠️'];
    const negativeCount = negativeWords.filter(word => lower.includes(word)).length;
    
    if (negativeCount >= 1) {
      return {
        sentiment: 'negative',
        confidence: 0.8,
        emoji: '😟',
        color: '#f59e0b',
        label: 'Concern'
      };
    }
    
    // Default neutral
    return {
      sentiment: 'neutral',
      confidence: 0.7,
      emoji: '💬',
      color: '#6b7280',
      label: 'Info'
    };
  }
  
  // ============= RICH MESSAGE CARDS =============
  
  detectRichContent(text: string): RichMessageCard[] {
    const cards: RichMessageCard[] = [];
    
    // URL detection with enhanced preview
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    
    if (urls) {
      urls.forEach(url => {
        // GitHub detection
        if (url.includes('github.com')) {
          cards.push({
            type: 'link',
            title: 'GitHub Repository',
            description: url.split('github.com/')[1],
            metadata: { url, platform: 'github' }
          });
        }
        // YouTube detection
        else if (url.includes('youtube.com') || url.includes('youtu.be')) {
          cards.push({
            type: 'link',
            title: 'YouTube Video',
            metadata: { url, platform: 'youtube', embedable: true }
          });
        }
        // Generic link
        else {
          cards.push({
            type: 'link',
            title: 'Link',
            metadata: { url }
          });
        }
      });
    }
    
    // Code block detection
    if (text.includes('```')) {
      const codeRegex = /```(\w+)?\n([\s\S]+?)```/g;
      let match;
      while ((match = codeRegex.exec(text)) !== null) {
        cards.push({
          type: 'code',
          title: `Code${match[1] ? ` (${match[1]})` : ''}`,
          metadata: { 
            language: match[1] || 'text',
            code: match[2],
            runnable: ['javascript', 'python', 'typescript'].includes(match[1] || '')
          }
        });
      }
    }
    
    // Calendar/time detection
    const timeRegex = /(tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday) at (\d{1,2}:\d{2}|(\d{1,2})(am|pm))/gi;
    if (timeRegex.test(text)) {
      cards.push({
        type: 'calendar',
        title: 'Meeting Time Detected',
        description: text.match(timeRegex)?.[0],
        metadata: { suggestCalendarEvent: true }
      });
    }
    
    // Task detection
    if (text.toLowerCase().includes('todo') || text.toLowerCase().includes('task:') || 
        text.match(/- \[ \]/)) {
      cards.push({
        type: 'task',
        title: 'Task Detected',
        metadata: { convertToTask: true }
      });
    }
    
    return cards;
  }
  
  // ============= SMART COMPOSE =============
  
  /**
   * Generate compose suggestions for a partial message draft.
   *
   * @param apiKey DEPRECATED — unused. The router manages provider keys
   *   server-side. Retained for call-site backward compatibility.
   */
  async generateSmartSuggestions(
    partialText: string,
    context: { contactName: string; recentMessages: string[] },
    apiKey?: string
  ): Promise<SmartComposeSuggestion[]> {
    void apiKey; // deprecated — router handles keys
    const suggestions: SmartComposeSuggestion[] = [];

    // Time-based suggestions (offline-friendly fallback)
    if (partialText.toLowerCase().includes('meeting') || partialText.toLowerCase().includes('call')) {
      const hour = new Date().getHours();
      const suggestedTime = hour < 12 ? '2pm' : hour < 15 ? '4pm' : 'tomorrow at 10am';
      suggestions.push({
        text: `${partialText} ${suggestedTime}?`,
        confidence: 0.8,
        context: 'time-suggestion',
        type: 'time'
      });
    }

    // Common completions (offline-friendly fallback)
    const completions: Record<string, string> = {
      'can we': 'schedule a quick call to discuss this?',
      'let me': 'know if you need anything else.',
      'thanks for': 'the update! Really appreciate it.',
      'looking forward': 'to hearing from you.',
      "i'll": 'get back to you shortly with an update.'
    };

    const lowerPartial = partialText.toLowerCase();
    Object.entries(completions).forEach(([trigger, completion]) => {
      if (lowerPartial.endsWith(trigger)) {
        suggestions.push({
          text: `${partialText} ${completion}`,
          confidence: 0.85,
          context: 'common-phrase',
          type: 'complete'
        });
      }
    });

    // Router-backed completions — replaces the previous chatWithBot
    // detour. Uses the dedicated quick_reply_suggestions task so trial
    // gating + workspace metering apply.
    if (partialText.length > 20) {
      try {
        const workspaceId = getCurrentWorkspaceId();
        if (workspaceId) {
          const recent = context.recentMessages.slice(-2).filter(Boolean).join(' | ');
          const aiText = await invokeAIPrompt(
            'quick_reply_suggestions',
            `Complete the user's in-progress message naturally and professionally.
Recipient: ${context.contactName}
Recent context: ${recent || '(none)'}

Current draft: "${partialText}"

Return 1-2 distinct completions, one per line. No numbering, no quotes, no preamble. Each line must be a full message ready to send.`,
            { workspaceId, temperature: 0.6 }
          );
          if (aiText) {
            const lines = aiText.split('\n').map(l => l.trim()).filter(Boolean);
            lines.slice(0, 2).forEach(line => {
              // Use the model's full sentence if it already includes the
              // draft prefix, otherwise append it.
              const full = line.toLowerCase().startsWith(partialText.toLowerCase().slice(0, 12))
                ? line
                : `${partialText} ${line}`;
              suggestions.push({
                text: full,
                confidence: 0.75,
                context: 'ai-powered',
                type: 'complete'
              });
            });
          }
        }
      } catch (error) {
        // Silent fail — caller still gets the static fallbacks above.
        console.error('AI suggestion failed:', error);
      }
    }

    return suggestions.slice(0, 3); // Max 3 suggestions
  }
  
  // ============= AI CONVERSATION COACH =============
  
  analyzeMessageForCoaching(text: string, context: {
    recentMessages: Message[];
    contactName: string;
  }): AICoachSuggestion[] {
    const suggestions: AICoachSuggestion[] = [];
    const lower = text.toLowerCase();
    
    // Tone detection
    const aggressiveWords = ['wrong', 'bad', 'terrible', 'should have', 'must', 'always', 'never'];
    const aggressiveCount = aggressiveWords.filter(word => lower.includes(word)).length;
    
    if (aggressiveCount >= 2) {
      suggestions.push({
        type: 'tone',
        severity: 'warning',
        message: 'This message might sound confrontational.',
        suggestion: 'Consider softening the tone',
        alternativeText: text.replace(/wrong/gi, 'not quite right')
                             .replace(/terrible/gi, 'could be better')
                             .replace(/must/gi, 'it would be great if')
      });
    }
    
    // Length check
    if (text.length > 500) {
      suggestions.push({
        type: 'clarity',
        severity: 'info',
        message: 'Long message detected. Consider breaking into multiple messages or summarizing.',
        suggestion: 'Shorter messages often get better responses'
      });
    }
    
    // Follow-up reminder
    const daysSinceLastMessage = this.getDaysSinceLastMessage(context.recentMessages, context.contactName);
    if (daysSinceLastMessage > 3) {
      suggestions.push({
        type: 'follow-up',
        severity: 'info',
        message: `You haven't responded to ${context.contactName} in ${daysSinceLastMessage} days`,
        suggestion: 'Consider acknowledging the delay'
      });
    }
    
    // Question without question mark
    const questionWords = ['what', 'when', 'where', 'who', 'why', 'how', 'can you', 'could you', 'would you'];
    const hasQuestionWord = questionWords.some(word => lower.includes(word));
    const hasQuestionMark = text.includes('?');
    
    if (hasQuestionWord && !hasQuestionMark) {
      suggestions.push({
        type: 'clarity',
        severity: 'info',
        message: 'This looks like a question but is missing a question mark.',
        suggestion: 'Adding a ? makes it clearer'
      });
    }
    
    return suggestions;
  }
  
  private getDaysSinceLastMessage(messages: Message[], contactName: string): number {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return 0;
    
    const daysDiff = Math.floor((Date.now() - lastMessage.timestamp.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff;
  }
  
  // ============= CONVERSATION HEALTH =============
  
  analyzeConversationHealth(thread: Thread, messages: Message[]): ConversationHealth {
    // Calculate response time
    const responseTimes: number[] = [];
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].sender !== messages[i-1].sender) {
        const diff = messages[i].timestamp.getTime() - messages[i-1].timestamp.getTime();
        responseTimes.push(diff / (1000 * 60 * 60)); // hours
      }
    }
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b) / responseTimes.length 
      : 0;
    
    const recentAvg = responseTimes.slice(-5).reduce((a, b) => a + b, 0) / Math.max(responseTimes.slice(-5).length, 1);
    const oldAvg = responseTimes.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(responseTimes.slice(0, 5).length, 1);
    const responseTrend = recentAvg < oldAvg ? 'improving' : recentAvg > oldAvg ? 'declining' : 'stable';
    
    // Engagement
    const participationRate = messages.length / Math.max((Date.now() - thread.messages[0].timestamp.getTime()) / (1000 * 60 * 60 * 24), 1);
    const engagementLevel = participationRate > 5 ? 'high' : participationRate > 2 ? 'medium' : 'low';
    
    // Sentiment analysis
    const positiveCount = messages.filter(m => {
      const lower = m.text?.toLowerCase() || '';
      return lower.includes('thanks') || lower.includes('great') || lower.includes('awesome');
    }).length;
    
    const negativeCount = messages.filter(m => {
      const lower = m.text?.toLowerCase() || '';
      return lower.includes('problem') || lower.includes('issue') || lower.includes('concern');
    }).length;
    
    const sentimentScore = positiveCount - negativeCount;
    const overallSentiment = sentimentScore > 2 ? 'positive' : sentimentScore < -2 ? 'negative' : 'neutral';
    
    // Productivity metrics
    const tasksCreated = messages.filter(m => m.relatedTaskId).length;
    const decisionsCount = messages.filter(m => m.decisionData).length;
    const actionItemsCreated = messages.filter(m => 
      m.text?.toLowerCase().includes('action:') || m.text?.toLowerCase().includes('todo:')
    ).length;
    
    // Communication style
    const questionCount = messages.filter(m => m.text?.includes('?')).length;
    const statementCount = messages.length - questionCount;
    const communicationStyle = questionCount > statementCount * 0.5 ? 'collaborative' : 
                               messages.filter(m => m.text?.includes('please') || m.text?.includes('could')).length > messages.length * 0.3 ? 'collaborative' :
                               'informational';
    
    // Issues and recommendations
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (avgResponseTime > 24) {
      issues.push('Slow response times');
      recommendations.push('Try to respond within 24 hours');
    }
    
    if (engagementLevel === 'low') {
      issues.push('Low engagement');
      recommendations.push('Schedule a quick sync call');
    }
    
    if (overallSentiment === 'negative') {
      issues.push('Negative sentiment detected');
      recommendations.push('Address concerns proactively');
    }
    
    // Calculate overall score
    const score = Math.min(100, Math.max(0,
      50 + // Base score
      (avgResponseTime < 12 ? 20 : avgResponseTime < 24 ? 10 : -10) +
      (engagementLevel === 'high' ? 15 : engagementLevel === 'medium' ? 5 : -10) +
      (sentimentScore * 3) +
      (tasksCreated + decisionsCount) * 2
    ));
    
    return {
      score,
      responseTime: {
        average: avgResponseTime,
        trend: responseTrend
      },
      engagement: {
        level: engagementLevel,
        participationRate
      },
      sentiment: {
        overall: overallSentiment,
        trend: 'stable' // Would need historical data for trend
      },
      productivity: {
        tasksCreated,
        decisionsCount,
        actionItemsCreated
      },
      communicationStyle,
      issues,
      recommendations
    };
  }
  
  // ============= MESSAGE IMPACT =============
  
  calculateMessageImpact(message: Message, thread: Thread, allMessages: Message[]): MessageImpact {
    // Immediate readers (within 5 minutes)
    const fiveMinutesAfter = message.timestamp.getTime() + (5 * 60 * 1000);
    const immediateResponses = allMessages.filter(m => 
      m.timestamp.getTime() > message.timestamp.getTime() &&
      m.timestamp.getTime() <= fiveMinutesAfter &&
      m.sender !== message.sender
    );
    
    // Referenced count (replies to this message)
    const referencedCount = allMessages.filter(m => m.replyToId === message.id).length;
    
    // Decisions and actions generated
    const decisionsGenerated = allMessages.filter(m => 
      m.timestamp.getTime() > message.timestamp.getTime() &&
      m.decisionData &&
      (m.replyToId === message.id || m.text?.includes(message.text?.substring(0, 30) || ''))
    ).length;
    
    const actionsGenerated = allMessages.filter(m =>
      m.timestamp.getTime() > message.timestamp.getTime() &&
      m.relatedTaskId &&
      (m.replyToId === message.id || Math.abs(m.timestamp.getTime() - message.timestamp.getTime()) < 600000)
    ).length;
    
    // Calculate score
    const score = Math.min(10,
      (immediateResponses.length * 1.5) +
      (referencedCount * 0.5) +
      (decisionsGenerated * 2) +
      (actionsGenerated * 1.5) +
      (message.reactions ? Object.values(message.reactions).flat().length * 0.3 : 0)
    );
    
    return {
      messageId: message.id,
      score,
      immediateReaders: immediateResponses.length,
      totalReaders: thread.messages.length, // Simplified
      decisionsGenerated,
      actionsGenerated,
      referencedCount,
      crossChannelMentions: 0, // Would need cross-thread data
      engagementRate: (immediateResponses.length / Math.max(1, thread.messages.length)) * 100
    };
  }
  
  // ============= ACHIEVEMENTS =============
  
  private achievementDefinitions: Omit<Achievement, 'progress' | 'unlocked' | 'unlockedAt'>[] = [
    {
      id: 'fast-responder',
      title: 'Lightning Fast',
      description: 'Respond within 1 hour 50 times',
      icon: '⚡',
      category: 'communication',
      maxProgress: 50,
      rarity: 'common'
    },
    {
      id: 'helpful-hero',
      title: 'Helpful Hero',
      description: 'Help 10 teammates this week',
      icon: '🦸',
      category: 'collaboration',
      maxProgress: 10,
      rarity: 'rare'
    },
    {
      id: 'decision-maker',
      title: 'Decision Maker',
      description: 'Make 25 decisions',
      icon: '⚖️',
      category: 'productivity',
      maxProgress: 25,
      rarity: 'epic'
    },
    {
      id: 'task-master',
      title: 'Task Master',
      description: 'Create 100 tasks from conversations',
      icon: '✅',
      category: 'productivity',
      maxProgress: 100,
      rarity: 'epic'
    },
    {
      id: 'social-butterfly',
      title: 'Social Butterfly',
      description: 'Active conversations with 20+ people',
      icon: '🦋',
      category: 'social',
      maxProgress: 20,
      rarity: 'rare'
    },
    {
      id: 'communication-champion',
      title: 'Communication Champion',
      description: 'Send 1000 messages',
      icon: '🏆',
      category: 'communication',
      maxProgress: 1000,
      rarity: 'legendary'
    }
  ];
  
  calculateAchievements(threads: Thread[], currentUserId: string): Achievement[] {
    const allMessages = threads.flatMap(t => t.messages);
    const myMessages = allMessages.filter(m => m.sender === 'me'); // Simplified
    
    return this.achievementDefinitions.map(def => {
      let progress = 0;
      
      switch (def.id) {
        case 'fast-responder':
          progress = myMessages.filter((m, i) => {
            const prevMsg = allMessages[i - 1];
            return prevMsg && prevMsg.sender !== 'me' &&
                   (m.timestamp.getTime() - prevMsg.timestamp.getTime()) < 3600000; // 1 hour
          }).length;
          break;
        
        case 'helpful-hero':
          progress = myMessages.filter(m => 
            m.text?.toLowerCase().includes('here to help') ||
            m.text?.toLowerCase().includes('let me help') ||
            m.relatedTaskId
          ).length;
          break;
        
        case 'decision-maker':
          progress = myMessages.filter(m => m.decisionData).length;
          break;
        
        case 'task-master':
          progress = myMessages.filter(m => m.relatedTaskId).length;
          break;
        
        case 'social-butterfly':
          progress = new Set(threads.map(t => t.contactId)).size;
          break;
        
        case 'communication-champion':
          progress = myMessages.length;
          break;
      }
      
      return {
        ...def,
        progress,
        unlocked: progress >= def.maxProgress,
        unlockedAt: progress >= def.maxProgress ? new Date() : undefined
      };
    });
  }
  
  // ============= PROACTIVE INSIGHTS =============
  
  /**
   * Proactive insights for a thread. Routes through the central `ai-router`
   * edge function (server-side auth/metering per Pulse convention — no client
   * API key, no direct provider SDK). The deterministic keyword heuristics are
   * kept as a graceful fallback when there is no workspace context or the
   * router call fails/returns nothing. (W5·C5 — was a pure-heuristic stub that
   * took an unused `apiKey`.)
   */
  async generateProactiveInsights(
    thread: Thread,
    messages: Message[]
  ): Promise<ProactiveInsight[]> {
    const heuristic = this.heuristicProactiveInsights(messages);

    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return heuristic;

    const transcript = messages
      .slice(-20)
      .map((m) => `${m.sender === 'me' ? 'Me' : thread.contactName || 'Them'}: ${m.text ?? ''}`)
      .filter((line) => line.trim().length > line.indexOf(':') + 2)
      .join('\n');

    if (!transcript.trim()) return heuristic;

    try {
      const parsed = await invokeAIJson<{ insights?: Array<Partial<ProactiveInsight>> }>(
        'pulse_assistant_chat',
        `You are a proactive communication assistant. Analyze this conversation with ${
          thread.contactName || 'a contact'
        } and surface up to 3 forward-looking insights (predictions, prep suggestions, useful connections, or blockers).

Conversation (most recent last):
"""
${transcript}
"""

Return ONLY a JSON object: { "insights": [ { ... } ] } where each insight has:
- type: one of "prediction" | "preparation" | "connection" | "blocker"
- title: short headline (<= 8 words)
- description: one sentence of why it matters
- suggestedActions: array of 2-3 concrete next actions
- confidence: number 0-1

Return an empty array if nothing actionable. No prose outside the JSON.`,
        { workspaceId, temperature: 0.4 }
      );

      const allowed: ProactiveInsight['type'][] = ['prediction', 'preparation', 'connection', 'blocker'];
      const aiInsights: ProactiveInsight[] = (parsed.insights ?? [])
        .filter((i) => i && typeof i.title === 'string' && i.title.trim())
        .slice(0, 3)
        .map((i) => ({
          type: allowed.includes(i.type as ProactiveInsight['type'])
            ? (i.type as ProactiveInsight['type'])
            : 'prediction',
          title: String(i.title).trim(),
          description: typeof i.description === 'string' ? i.description.trim() : '',
          suggestedActions: Array.isArray(i.suggestedActions)
            ? i.suggestedActions.filter((a): a is string => typeof a === 'string').slice(0, 3)
            : [],
          relevantDocs: [],
          relatedPeople: [],
          confidence:
            typeof i.confidence === 'number' ? Math.max(0, Math.min(1, i.confidence)) : 0.6,
        }));

      return aiInsights.length > 0 ? aiInsights : heuristic;
    } catch (err) {
      // Non-critical, advisory feature — degrade to heuristics on any router
      // failure (mirrors translateMessage's fallback behavior).
      console.error('[messageEnhancements] proactive insights AI failed, using heuristics:', err);
      return heuristic;
    }
  }

  /** Deterministic keyword-based insights — baseline + AI fallback. */
  private heuristicProactiveInsights(messages: Message[]): ProactiveInsight[] {
    const insights: ProactiveInsight[] = [];

    const recentTopics = this.extractTopics(messages.slice(-10));
    if (recentTopics.includes('budget') && recentTopics.includes('timeline')) {
      insights.push({
        type: 'prediction',
        title: 'Resource Discussion Likely Next',
        description: 'Based on budget and timeline talk, resource allocation usually comes up next',
        suggestedActions: [
          'Review current team capacity',
          'Prepare resource allocation doc',
          'Check contractor availability'
        ],
        relevantDocs: [],
        relatedPeople: [],
        confidence: 0.75
      });
    }

    const blockerMentions = messages.filter(m =>
      m.text?.toLowerCase().includes('blocker') ||
      m.text?.toLowerCase().includes('blocked') ||
      m.text?.toLowerCase().includes('waiting for')
    );
    if (blockerMentions.length > 0) {
      insights.push({
        type: 'blocker',
        title: 'Potential Blocker Detected',
        description: 'Multiple mentions of blockers or delays in recent messages',
        suggestedActions: [
          'Schedule unblocking session',
          'Identify dependencies',
          'Escalate if needed'
        ],
        relevantDocs: [],
        relatedPeople: [],
        confidence: 0.85
      });
    }

    return insights;
  }
  
  private extractTopics(messages: Message[]): string[] {
    const topicKeywords = [
      'budget', 'timeline', 'resource', 'design', 'development',
      'testing', 'launch', 'deadline', 'milestone', 'feature'
    ];
    
    const text = messages.map(m => m.text?.toLowerCase() || '').join(' ');
    return topicKeywords.filter(keyword => text.includes(keyword));
  }
  
  // ============= CONVERSATION DNA =============
  
  analyzeConversationDNA(thread: Thread, messages: Message[]): ConversationMemory {
    const patterns = {
      commonTopics: this.extractTopics(messages),
      usualParticipants: [thread.contactName],
      typicalDeadlines: this.extractDeadlines(messages),
      frequentLinks: this.extractLinks(messages)
    };
    
    const milestones: Milestone[] = this.extractMilestones(messages);
    
    // Generate DNA hash
    const dna = `${patterns.commonTopics.join('-')}-${patterns.usualParticipants.length}p-${milestones.length}m`;
    
    return {
      conversationId: thread.id,
      patterns,
      milestones,
      dna
    };
  }
  
  private extractDeadlines(messages: Message[]): string[] {
    const deadlines: string[] = [];
    const deadlineRegex = /(by|before|due) (tomorrow|today|monday|tuesday|wednesday|thursday|friday|next week|end of week)/gi;
    
    messages.forEach(m => {
      const matches = m.text?.match(deadlineRegex);
      if (matches) deadlines.push(...matches);
    });
    
    return [...new Set(deadlines)];
  }
  
  private extractLinks(messages: Message[]): string[] {
    const links: string[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    messages.forEach(m => {
      const matches = m.text?.match(urlRegex);
      if (matches) links.push(...matches);
    });
    
    return [...new Set(links)].slice(0, 5);
  }
  
  private extractMilestones(messages: Message[]): Milestone[] {
    const milestones: Milestone[] = [];
    
    // Detect project starts
    if (messages.length > 0) {
      milestones.push({
        date: messages[0].timestamp,
        event: 'Conversation Started',
        description: 'First message in this thread',
        participants: ['me']
      });
    }
    
    // Detect decisions
    messages.filter(m => m.decisionData).forEach(m => {
      milestones.push({
        date: m.timestamp,
        event: 'Decision Made',
        description: m.text?.substring(0, 50) || 'Decision',
        participants: ['me']
      });
    });
    
    return milestones;
  }
}

export const messageEnhancementsService = new MessageEnhancementsService();
