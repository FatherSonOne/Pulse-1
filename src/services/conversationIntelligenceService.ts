// src/services/conversationIntelligenceService.ts
// Conversation Intelligence Service
// Provides real-time sentiment analysis, topic detection, and engagement metrics

import { supabase } from './supabase';
import { processWithModel } from './geminiService';
import { ChannelMessage } from '../types/messages';

// ==================== Types ====================

export interface ConversationIntelligence {
  channelId: string;
  sentiment: SentimentAnalysis;
  topics: TopicDetection[];
  engagement: EngagementMetrics;
  followUpSuggestions: string[];
  lastAnalyzed: Date;
}

export interface SentimentAnalysis {
  current: 'positive' | 'neutral' | 'negative' | 'mixed';
  score: number; // -1 to 1
  reason: string;
  trend: 'improving' | 'declining' | 'stable';
  history: SentimentSnapshot[];
}

export interface SentimentSnapshot {
  sentiment: string;
  score: number;
  timestamp: Date;
}

export interface TopicDetection {
  topic: string;
  confidence: number; // 0 to 1
  firstMentioned: Date;
  mentionCount: number;
}

export interface EngagementMetrics {
  score: number; // 0 to 100
  trend: 'increasing' | 'stable' | 'declining';
  participants: ParticipantEngagement[];
  averageResponseTime?: number; // in minutes
  messageVelocity: number; // messages per hour
}

export interface ParticipantEngagement {
  userId: string;
  userName: string;
  messageCount: number;
  engagementScore: number; // 0 to 100
  lastActive: Date;
}

// ==================== Analysis Cache ====================

const analysisCache = new Map<
  string,
  { data: ConversationIntelligence; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for real-time analysis

function getCachedAnalysis(channelId: string): ConversationIntelligence | null {
  const cached = analysisCache.get(channelId);
  if (!cached || Date.now() - cached.timestamp > CACHE_TTL) {
    analysisCache.delete(channelId);
    return null;
  }
  return cached.data;
}

function setCachedAnalysis(channelId: string, data: ConversationIntelligence): void {
  analysisCache.set(channelId, { data, timestamp: Date.now() });
}

// ==================== Service Class ====================

class ConversationIntelligenceService {
  /**
   * Analyze conversation in real-time
   */
  async analyzeConversation(
    channelId: string,
    messages: ChannelMessage[],
    userId: string,
    apiKey: string
  ): Promise<ConversationIntelligence> {
    try {
      // Check cache for recent analysis
      const cached = getCachedAnalysis(channelId);
      if (cached) {
        return cached;
      }

      // Use most recent 50 messages for analysis
      const recentMessages = messages.slice(-50);

      if (recentMessages.length === 0) {
        return this.getEmptyIntelligence(channelId);
      }

      // Run analysis in parallel
      const [sentiment, topics, followUps] = await Promise.all([
        this.analyzeSentiment(recentMessages, apiKey),
        this.detectTopics(recentMessages, apiKey),
        this.generateFollowUpSuggestions(recentMessages, apiKey),
      ]);

      // Calculate engagement metrics
      const engagement = this.calculateEngagement(messages);

      const intelligence: ConversationIntelligence = {
        channelId,
        sentiment,
        topics,
        engagement,
        followUpSuggestions: followUps,
        lastAnalyzed: new Date(),
      };

      // Cache the analysis
      setCachedAnalysis(channelId, intelligence);

      // Save to database
      await this.saveIntelligence(userId, intelligence);

      return intelligence;
    } catch (error) {
      console.error('[Intelligence] Error analyzing conversation:', error);
      return this.getEmptyIntelligence(channelId);
    }
  }

  /**
   * Analyze sentiment of conversation
   */
  private async analyzeSentiment(
    messages: ChannelMessage[],
    apiKey: string
  ): Promise<SentimentAnalysis> {
    try {
      // Build context from recent messages
      const context = messages
        .slice(-20) // Last 20 messages for sentiment
        .map((m) => m.content)
        .join('\n');

      const prompt = `Analyze the sentiment of this conversation:

${context}

Determine:
1. Overall current sentiment (positive, neutral, negative, or mixed)
2. Sentiment score from -1 (very negative) to +1 (very positive)
3. Brief reason explaining the sentiment (1 sentence)
4. Sentiment trend (improving, declining, or stable) based on message progression

Return as JSON:
{
  "current": "positive/neutral/negative/mixed",
  "score": 0.5,
  "reason": "explanation here",
  "trend": "improving/declining/stable"
}`;

      const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
      const parsed = this.parseJSONResponse(response || '{}');

      return {
        current: parsed.current || 'neutral',
        score: typeof parsed.score === 'number' ? parsed.score : 0,
        reason: parsed.reason || 'Unable to determine sentiment',
        trend: parsed.trend || 'stable',
        history: [],
      };
    } catch (error) {
      console.error('[Intelligence] Error analyzing sentiment:', error);
      return {
        current: 'neutral',
        score: 0,
        reason: 'Analysis failed',
        trend: 'stable',
        history: [],
      };
    }
  }

  /**
   * Detect main topics in conversation
   */
  private async detectTopics(
    messages: ChannelMessage[],
    apiKey: string
  ): Promise<TopicDetection[]> {
    try {
      const context = messages.map((m) => m.content).join('\n');

      const prompt = `Identify the main topics being discussed in this conversation:

${context}

Determine:
1. 3-5 main topics (be specific and concise)
2. Confidence level for each topic (0 to 1)

Return as JSON array:
[
  {"topic": "topic name", "confidence": 0.9},
  {"topic": "another topic", "confidence": 0.75}
]`;

      const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
      const parsed = this.parseJSONResponse(response || '[]');

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((t: any) => ({
        topic: t.topic || 'Unknown Topic',
        confidence: typeof t.confidence === 'number' ? t.confidence : 0.5,
        firstMentioned: new Date(),
        mentionCount: 1,
      }));
    } catch (error) {
      console.error('[Intelligence] Error detecting topics:', error);
      return [];
    }
  }

  /**
   * Generate follow-up suggestions
   */
  private async generateFollowUpSuggestions(
    messages: ChannelMessage[],
    apiKey: string
  ): Promise<string[]> {
    try {
      const context = messages
        .slice(-10)
        .map((m) => `${m.sender_name}: ${m.content}`)
        .join('\n');

      const prompt = `Based on this conversation, suggest 2-3 intelligent follow-up actions or questions:

${context}

Focus on:
- Unanswered questions
- Pending decisions
- Next logical steps
- Clarifications needed

Return as JSON array of strings:
["suggestion 1", "suggestion 2", "suggestion 3"]`;

      const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash-lite');
      const parsed = this.parseJSONResponse(response || '[]');

      if (Array.isArray(parsed)) {
        return parsed.slice(0, 3);
      }

      return [];
    } catch (error) {
      console.error('[Intelligence] Error generating follow-ups:', error);
      return [];
    }
  }

  /**
   * Calculate engagement metrics
   */
  private calculateEngagement(messages: ChannelMessage[]): EngagementMetrics {
    if (messages.length === 0) {
      return {
        score: 0,
        trend: 'stable',
        participants: [],
        messageVelocity: 0,
      };
    }

    // Calculate participant engagement
    const participantMap = new Map<string, ParticipantEngagement>();

    for (const msg of messages) {
      const userId = msg.sender_id;
      const userName = msg.sender_name || 'Unknown';

      if (!participantMap.has(userId)) {
        participantMap.set(userId, {
          userId,
          userName,
          messageCount: 0,
          engagementScore: 0,
          lastActive: new Date(msg.created_at),
        });
      }

      const participant = participantMap.get(userId)!;
      participant.messageCount++;
      participant.lastActive = new Date(msg.created_at);
    }

    // Calculate engagement scores for each participant
    const maxMessages = Math.max(...Array.from(participantMap.values()).map((p) => p.messageCount));

    for (const participant of participantMap.values()) {
      // Score based on message count and recency
      const messageScore = (participant.messageCount / maxMessages) * 60;
      const recencyScore = this.calculateRecencyScore(participant.lastActive) * 40;
      participant.engagementScore = Math.min(100, messageScore + recencyScore);
    }

    const participants = Array.from(participantMap.values()).sort(
      (a, b) => b.engagementScore - a.engagementScore
    );

    // Calculate message velocity (messages per hour)
    const timeSpan = this.calculateTimeSpan(messages);
    const messageVelocity = timeSpan > 0 ? (messages.length / timeSpan) * 60 : 0;

    // Calculate overall engagement score
    const avgEngagement =
      participants.reduce((sum, p) => sum + p.engagementScore, 0) / participants.length;

    // Determine trend (simplified - compare recent vs older messages)
    const halfwayPoint = Math.floor(messages.length / 2);
    const recentVelocity =
      halfwayPoint > 0
        ? (messages.length - halfwayPoint) /
          this.calculateTimeSpan(messages.slice(halfwayPoint))
        : 0;
    const olderVelocity =
      halfwayPoint > 0 ? halfwayPoint / this.calculateTimeSpan(messages.slice(0, halfwayPoint)) : 0;

    let trend: 'increasing' | 'stable' | 'declining' = 'stable';
    if (recentVelocity > olderVelocity * 1.2) {
      trend = 'increasing';
    } else if (recentVelocity < olderVelocity * 0.8) {
      trend = 'declining';
    }

    return {
      score: Math.round(avgEngagement),
      trend,
      participants,
      messageVelocity: Math.round(messageVelocity * 100) / 100,
    };
  }

  /**
   * Calculate recency score (0-1) based on how recently someone was active
   */
  private calculateRecencyScore(lastActive: Date): number {
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);

    if (diffMinutes < 5) return 1.0;
    if (diffMinutes < 30) return 0.8;
    if (diffMinutes < 60) return 0.6;
    if (diffMinutes < 1440) return 0.4; // 24 hours
    return 0.2;
  }

  /**
   * Calculate time span of messages in hours
   */
  private calculateTimeSpan(messages: ChannelMessage[]): number {
    if (messages.length < 2) return 0;

    const first = new Date(messages[0].created_at);
    const last = new Date(messages[messages.length - 1].created_at);
    const diffMs = last.getTime() - first.getTime();

    return diffMs / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Parse JSON response from AI
   */
  private parseJSONResponse(response: string): any {
    try {
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
      }
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }

      return JSON.parse(cleaned.trim());
    } catch (error) {
      console.error('[Intelligence] Error parsing JSON:', error);
      return {};
    }
  }

  /**
   * Get empty intelligence object
   */
  private getEmptyIntelligence(channelId: string): ConversationIntelligence {
    return {
      channelId,
      sentiment: {
        current: 'neutral',
        score: 0,
        reason: 'No messages to analyze',
        trend: 'stable',
        history: [],
      },
      topics: [],
      engagement: {
        score: 0,
        trend: 'stable',
        participants: [],
        messageVelocity: 0,
      },
      followUpSuggestions: [],
      lastAnalyzed: new Date(),
    };
  }

  /**
   * Save intelligence data to database
   */
  private async saveIntelligence(
    userId: string,
    intelligence: ConversationIntelligence
  ): Promise<void> {
    try {
      // Prepare data
      const data = {
        channel_id: intelligence.channelId,
        user_id: userId,
        current_sentiment: intelligence.sentiment.current,
        sentiment_score: intelligence.sentiment.score,
        sentiment_history: intelligence.sentiment.history,
        detected_topics: intelligence.topics.map((t) => t.topic),
        topic_confidence: intelligence.topics.reduce((acc, t) => {
          acc[t.topic] = t.confidence;
          return acc;
        }, {} as Record<string, number>),
        participant_engagement: intelligence.engagement.participants.reduce((acc, p) => {
          acc[p.userId] = {
            name: p.userName,
            count: p.messageCount,
            score: p.engagementScore,
          };
          return acc;
        }, {} as Record<string, any>),
        engagement_trend: intelligence.engagement.trend,
        suggested_followups: intelligence.followUpSuggestions,
        last_analyzed_at: intelligence.lastAnalyzed.toISOString(),
      };

      // Upsert (update or insert)
      const { error } = await supabase
        .from('conversation_intelligence')
        .upsert(data, {
          onConflict: 'channel_id,user_id',
        });

      if (error) {
        console.error('[Intelligence] Error saving intelligence:', error);
      }
    } catch (error) {
      console.error('[Intelligence] Error in saveIntelligence:', error);
    }
  }

  /**
   * Get saved intelligence from database
   */
  async getIntelligence(
    channelId: string,
    userId: string
  ): Promise<ConversationIntelligence | null> {
    try {
      const { data, error } = await supabase
        .from('conversation_intelligence')
        .select('*')
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      // Transform database format to service format
      return {
        channelId: data.channel_id,
        sentiment: {
          current: data.current_sentiment,
          score: data.sentiment_score,
          reason: 'Retrieved from cache',
          trend: data.engagement_trend || 'stable',
          history: Array.isArray(data.sentiment_history) ? data.sentiment_history : [],
        },
        topics:
          data.detected_topics?.map((topic: string) => ({
            topic,
            confidence: data.topic_confidence?.[topic] || 0.5,
            firstMentioned: new Date(data.last_analyzed_at),
            mentionCount: 1,
          })) || [],
        engagement: {
          score: 0, // Calculate from participant data
          trend: data.engagement_trend || 'stable',
          participants: [],
          messageVelocity: 0,
        },
        followUpSuggestions: data.suggested_followups || [],
        lastAnalyzed: new Date(data.last_analyzed_at),
      };
    } catch (error) {
      console.error('[Intelligence] Error getting intelligence:', error);
      return null;
    }
  }

  /**
   * Get sentiment history for a channel
   */
  async getSentimentHistory(
    channelId: string,
    userId: string,
    days: number = 7
  ): Promise<SentimentSnapshot[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('sentiment_history')
        .select('sentiment, sentiment_score, recorded_at')
        .eq('channel_id', channelId)
        .gte('recorded_at', startDate.toISOString())
        .order('recorded_at', { ascending: true });

      if (error || !data) {
        return [];
      }

      return data.map((record: any) => ({
        sentiment: record.sentiment,
        score: record.sentiment_score,
        timestamp: new Date(record.recorded_at),
      }));
    } catch (error) {
      console.error('[Intelligence] Error getting sentiment history:', error);
      return [];
    }
  }

  /**
   * Clear cache for a channel (force re-analysis)
   */
  clearCache(channelId?: string): void {
    if (channelId) {
      analysisCache.delete(channelId);
    } else {
      analysisCache.clear();
    }
  }
}

// Export singleton instance
export const conversationIntelligenceService = new ConversationIntelligenceService();
export default conversationIntelligenceService;
