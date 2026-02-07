/**
 * AI Insights Service
 * Claude AI-powered analysis for communication patterns, sentiment, and personalized recommendations
 */

import { supabase } from './supabase';
import { generateClaudeResponse } from './anthropicService';

export interface AIInsight {
  id: string;
  type: 'pattern' | 'sentiment' | 'recommendation' | 'alert' | 'celebration';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  context: Record<string, any>;
  actions: Array<{ label: string; action: string }>;
  created_at: string;
}

export interface SentimentAnalysisResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  confidence: number;
  emotions: string[];
  tone: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface ConflictAnalysisResult {
  has_conflict: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conflict_type: string;
  topic: string;
  tension_score: number;
  keywords: string[];
  resolution_suggestions: string[];
}

export interface RecognitionAnalysisResult {
  has_recognition: boolean;
  recognition_type: 'kudos' | 'appreciation' | 'praise' | 'celebration';
  category: string;
  impact_level: 'low' | 'medium' | 'high';
  keywords: string[];
  positivity_score: number;
}

export interface CommunicationInsight {
  insight_type: string;
  summary: string;
  details: string[];
  recommendations: string[];
  confidence: number;
}

/**
 * Analyze sentiment in message content using Claude AI
 */
export async function analyzeSentiment(
  messageContent: string,
  context?: string
): Promise<{
  success: boolean;
  data?: SentimentAnalysisResult;
  error?: string;
}> {
  try {
    // Get user's API key
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('anthropic_key')
      .eq('user_id', user.id)
      .single();

    if (!apiKeyData?.anthropic_key) {
      // Fallback to basic sentiment analysis if no API key
      return { success: true, data: basicSentimentAnalysis(messageContent) };
    }

    const prompt = `Analyze the sentiment of this message${context ? ` (context: ${context})` : ''}:

"${messageContent}"

Provide a JSON response with:
- sentiment: "positive", "neutral", or "negative"
- score: number from -1 (very negative) to 1 (very positive)
- confidence: 0-1 indicating certainty
- emotions: array of detected emotions (e.g., ["happy", "excited", "grateful"])
- tone: brief description of the tone (e.g., "professional", "casual", "urgent")
- urgency: "low", "medium", or "high"

Return only valid JSON, no other text.`;

    const response = await generateClaudeResponse(
      apiKeyData.anthropic_key,
      prompt,
      'claude-3-5-sonnet-20241022'
    );

    const result = JSON.parse(response) as SentimentAnalysisResult;

    return { success: true, data: result };
  } catch (err: any) {
    console.error('Error analyzing sentiment with AI:', err);
    // Fallback to basic analysis
    return { success: true, data: basicSentimentAnalysis(messageContent) };
  }
}

/**
 * Analyze message for conflict patterns using Claude AI
 */
export async function analyzeForConflict(
  messageContent: string,
  conversationHistory?: string[]
): Promise<{
  success: boolean;
  data?: ConflictAnalysisResult;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('anthropic_key')
      .eq('user_id', user.id)
      .single();

    if (!apiKeyData?.anthropic_key) {
      // Fallback to basic conflict detection
      return { success: true, data: basicConflictAnalysis(messageContent) };
    }

    const historyContext = conversationHistory && conversationHistory.length > 0
      ? `\n\nRecent conversation history:\n${conversationHistory.join('\n')}`
      : '';

    const prompt = `Analyze this message for signs of conflict or disagreement${historyContext}:

"${messageContent}"

Provide a JSON response with:
- has_conflict: boolean
- severity: "low", "medium", "high", or "critical"
- conflict_type: type of conflict (e.g., "disagreement", "misunderstanding", "tension")
- topic: the subject matter causing conflict
- tension_score: 0-1 indicating level of tension
- keywords: array of conflict-indicating words found
- resolution_suggestions: array of 2-3 actionable suggestions

Return only valid JSON, no other text.`;

    const response = await generateClaudeResponse(
      apiKeyData.anthropic_key,
      prompt,
      'claude-3-5-sonnet-20241022'
    );

    const result = JSON.parse(response) as ConflictAnalysisResult;

    return { success: true, data: result };
  } catch (err: any) {
    console.error('Error analyzing conflict with AI:', err);
    return { success: true, data: basicConflictAnalysis(messageContent) };
  }
}

/**
 * Analyze message for recognition/kudos using Claude AI
 */
export async function analyzeForRecognition(
  messageContent: string
): Promise<{
  success: boolean;
  data?: RecognitionAnalysisResult;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('anthropic_key')
      .eq('user_id', user.id)
      .single();

    if (!apiKeyData?.anthropic_key) {
      return { success: true, data: basicRecognitionAnalysis(messageContent) };
    }

    const prompt = `Analyze this message for recognition, appreciation, or kudos:

"${messageContent}"

Provide a JSON response with:
- has_recognition: boolean
- recognition_type: "kudos", "appreciation", "praise", or "celebration"
- category: specific category (e.g., "technical skill", "teamwork", "achievement")
- impact_level: "low", "medium", or "high"
- keywords: array of recognition-indicating words found
- positivity_score: 0-1 indicating strength of positive sentiment

Return only valid JSON, no other text.`;

    const response = await generateClaudeResponse(
      apiKeyData.anthropic_key,
      prompt,
      'claude-3-5-sonnet-20241022'
    );

    const result = JSON.parse(response) as RecognitionAnalysisResult;

    return { success: true, data: result };
  } catch (err: any) {
    console.error('Error analyzing recognition with AI:', err);
    return { success: true, data: basicRecognitionAnalysis(messageContent) };
  }
}

/**
 * Generate personalized communication insights
 */
export async function generateCommunicationInsights(
  timeframe: 'week' | 'month' | 'quarter' = 'week'
): Promise<{
  success: boolean;
  data?: CommunicationInsight[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get analytics data
    const days = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: metrics } = await supabase
      .from('analytics_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString().split('T')[0]);

    const { data: contacts } = await supabase
      .from('analytics_contact_engagement')
      .select('*')
      .eq('user_id', user.id)
      .order('engagement_score', { ascending: false })
      .limit(10);

    const { data: relationships } = await supabase
      .from('relationship_health')
      .select('*')
      .eq('user_id', user.id);

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('anthropic_key')
      .eq('user_id', user.id)
      .single();

    if (!apiKeyData?.anthropic_key) {
      return { success: true, data: generateBasicInsights(metrics, contacts, relationships) };
    }

    // Prepare data summary for AI analysis
    const dataSummary = {
      timeframe,
      total_messages: metrics?.reduce((sum, m) => sum + m.messages_sent + m.messages_received, 0) || 0,
      avg_response_time: metrics && metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.avg_response_time_minutes || 0), 0) / metrics.length
        : 0,
      top_contacts: contacts?.slice(0, 5).map(c => ({
        name: c.contact_name,
        engagement: c.engagement_score,
        trend: c.engagement_trend
      })) || [],
      relationships_at_risk: relationships?.filter(r => r.health_status === 'at_risk').length || 0,
      avg_sentiment: metrics && metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.avg_sentiment_score || 0), 0) / metrics.length
        : 0
    };

    const prompt = `As a communication analytics expert, analyze this user's ${timeframe} communication data and provide 3-5 actionable insights:

${JSON.stringify(dataSummary, null, 2)}

Provide a JSON array of insights, each with:
- insight_type: category (e.g., "engagement", "sentiment", "workload", "relationships")
- summary: brief one-sentence summary
- details: array of 2-3 specific observations
- recommendations: array of 2-3 actionable suggestions
- confidence: 0-1 indicating certainty of the insight

Focus on patterns, risks, opportunities, and specific actions the user can take.

Return only valid JSON array, no other text.`;

    const response = await generateClaudeResponse(
      apiKeyData.anthropic_key,
      prompt,
      'claude-3-5-sonnet-20241022'
    );

    const insights = JSON.parse(response) as CommunicationInsight[];

    return { success: true, data: insights };
  } catch (err: any) {
    console.error('Error generating AI insights:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Generate relationship improvement suggestions using Claude AI
 */
export async function generateRelationshipSuggestions(
  contactIdentifier: string
): Promise<{
  success: boolean;
  data?: {
    suggestions: string[];
    talking_points: string[];
    best_time_to_reach: string;
    communication_style: string;
  };
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get relationship data
    const { data: relationship } = await supabase
      .from('relationship_health')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .single();

    const { data: engagement } = await supabase
      .from('analytics_contact_engagement')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .single();

    const { data: recognition } = await supabase
      .from('recognition_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (!relationship || !engagement) {
      return { success: false, error: 'No data found for contact' };
    }

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('anthropic_key')
      .eq('user_id', user.id)
      .single();

    if (!apiKeyData?.anthropic_key) {
      return {
        success: true,
        data: {
          suggestions: ['Reach out to reconnect', 'Share something relevant to their interests'],
          talking_points: ['Recent events', 'Shared interests'],
          best_time_to_reach: 'During business hours',
          communication_style: 'Professional and friendly'
        }
      };
    }

    const contactData = {
      health_score: relationship.health_score,
      health_status: relationship.health_status,
      days_since_last_message: relationship.days_since_last_message,
      sentiment_trend: relationship.sentiment_trend,
      preferred_channel: engagement.preferred_channel,
      common_topics: engagement.common_topics,
      recognition: recognition ? {
        most_appreciated_for: recognition.most_appreciated_for,
        reciprocity_score: recognition.reciprocity_score
      } : null
    };

    const prompt = `As a relationship management advisor, analyze this contact relationship and provide personalized suggestions:

${JSON.stringify(contactData, null, 2)}

Provide a JSON response with:
- suggestions: array of 3-5 specific actionable suggestions to improve the relationship
- talking_points: array of 3-4 relevant conversation topics based on history
- best_time_to_reach: recommendation for when to contact them
- communication_style: recommended approach (tone, formality, etc.)

Be specific and actionable. Consider the relationship health and history.

Return only valid JSON, no other text.`;

    const response = await generateClaudeResponse(
      apiKeyData.anthropic_key,
      prompt,
      'claude-3-5-sonnet-20241022'
    );

    const result = JSON.parse(response);

    return { success: true, data: result };
  } catch (err: any) {
    console.error('Error generating relationship suggestions:', err);
    return { success: false, error: err.message };
  }
}

// Fallback functions for when Claude AI is not available

function basicSentimentAnalysis(content: string): SentimentAnalysisResult {
  const positiveWords = ['thank', 'great', 'excellent', 'love', 'happy', 'appreciate', 'wonderful'];
  const negativeWords = ['bad', 'terrible', 'hate', 'angry', 'disappointed', 'frustrated', 'wrong'];

  const lowerContent = content.toLowerCase();
  let score = 0;

  positiveWords.forEach(word => {
    if (lowerContent.includes(word)) score += 0.2;
  });

  negativeWords.forEach(word => {
    if (lowerContent.includes(word)) score -= 0.2;
  });

  score = Math.max(-1, Math.min(1, score));

  return {
    sentiment: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral',
    score,
    confidence: 0.5,
    emotions: score > 0 ? ['positive'] : score < 0 ? ['negative'] : ['neutral'],
    tone: 'neutral',
    urgency: 'medium'
  };
}

function basicConflictAnalysis(content: string): ConflictAnalysisResult {
  const conflictKeywords = ['disagree', 'wrong', 'no', 'but', 'however', 'frustrated', 'problem'];
  const lowerContent = content.toLowerCase();
  const detected = conflictKeywords.filter(kw => lowerContent.includes(kw));

  return {
    has_conflict: detected.length >= 2,
    severity: detected.length >= 3 ? 'high' : detected.length >= 2 ? 'medium' : 'low',
    conflict_type: 'disagreement',
    topic: 'unspecified',
    tension_score: Math.min(detected.length / 10, 1),
    keywords: detected,
    resolution_suggestions: ['Clarify misunderstandings', 'Find common ground']
  };
}

function basicRecognitionAnalysis(content: string): RecognitionAnalysisResult {
  const recognitionKeywords = ['thank', 'great', 'excellent', 'appreciate', 'kudos', 'well done', 'awesome'];
  const lowerContent = content.toLowerCase();
  const detected = recognitionKeywords.filter(kw => lowerContent.includes(kw));

  return {
    has_recognition: detected.length > 0,
    recognition_type: 'kudos',
    category: 'general',
    impact_level: detected.length >= 2 ? 'high' : 'medium',
    keywords: detected,
    positivity_score: Math.min(detected.length / 5, 1)
  };
}

function generateBasicInsights(
  metrics: any[],
  contacts: any[],
  relationships: any[]
): CommunicationInsight[] {
  const insights: CommunicationInsight[] = [];

  if (relationships && relationships.length > 0) {
    const atRisk = relationships.filter(r => r.health_status === 'at_risk').length;
    if (atRisk > 0) {
      insights.push({
        insight_type: 'relationships',
        summary: `${atRisk} relationship${atRisk > 1 ? 's need' : ' needs'} attention`,
        details: ['Some contacts haven\'t been reached out to recently', 'Engagement is declining'],
        recommendations: ['Review at-risk relationships', 'Schedule check-ins'],
        confidence: 0.8
      });
    }
  }

  if (metrics && metrics.length > 0) {
    const avgMessages = metrics.reduce((sum, m) => sum + m.messages_sent + m.messages_received, 0) / metrics.length;
    if (avgMessages > 50) {
      insights.push({
        insight_type: 'workload',
        summary: 'High message volume detected',
        details: ['Processing over 50 messages per day on average'],
        recommendations: ['Consider automation for routine messages', 'Set communication boundaries'],
        confidence: 0.7
      });
    }
  }

  return insights;
}
