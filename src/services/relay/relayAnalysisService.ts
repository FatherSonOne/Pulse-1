// Relay Analysis Service
// AI-powered analysis of voice messages: summaries, action items, sentiment, and more.
//
// All LLM calls route through the central `ai-router` edge function which
// handles provider selection, metering, hard caps, fallback on outage, and
// prompt caching automatically.

import {
  VoxAnalysis,
  ActionItem,
  SuggestedResponse,
  SentimentType,
  UrgencyLevel,
  EmotionType,
} from './relayTypes';
import { withFormattedOutput } from '../aiFormattingService';
import { invokeAIJson, invokeAIPrompt } from '../ai/aiService';
import { getCurrentWorkspaceId } from '../ai/getWorkspaceId';

// ============================================
// ANALYSIS SERVICE CLASS
// ============================================

export class RelayAnalysisService {
  private workspaceId?: string;

  constructor(workspaceId?: string) {
    this.workspaceId = workspaceId;
  }

  private resolveWorkspaceId(workspaceId?: string): string {
    const wsId = workspaceId ?? this.workspaceId ?? getCurrentWorkspaceId();
    if (!wsId) {
      throw new Error('No active workspace — AI unavailable');
    }
    return wsId;
  }

  // ============================================
  // MAIN ANALYSIS METHOD
  // ============================================

  async analyzeVox(
    transcription: string,
    context?: {
      senderName?: string;
      previousMessages?: string[];
      channelType?: 'direct' | 'group';
    },
    workspaceId?: string,
  ): Promise<VoxAnalysis> {
    const startTime = Date.now();
    const wsId = this.resolveWorkspaceId(workspaceId);

    const contextInfo = context ? `
Context:
- Sender: ${context.senderName || 'Unknown'}
- Channel: ${context.channelType || 'direct'}
${context.previousMessages?.length ? `- Previous messages:\n${context.previousMessages.slice(-3).join('\n')}` : ''}
` : '';

    const basePrompt = `Analyze this voice message transcription and extract comprehensive insights.

${contextInfo}

Voice Message:
"${transcription}"

Provide a thorough analysis in JSON format with the following structure:
{
  "summary": "1-2 sentence concise summary",
  "keyPoints": ["array of 3-5 main points discussed"],
  "actionItems": [
    {
      "text": "action item description",
      "assignedTo": "person name if mentioned, or null",
      "priority": "low|medium|high",
      "dueDate": "ISO date if mentioned, or null"
    }
  ],
  "questions": ["questions asked in the message"],
  "decisions": ["decisions or commitments made"],
  "suggestedFollowUps": ["suggested follow-up questions or topics"],
  "suggestedResponses": [
    {
      "text": "suggested response text",
      "tone": "professional|casual|friendly|formal",
      "intent": "acknowledge|answer|clarify|confirm|decline"
    }
  ],
  "sentiment": "positive|neutral|negative|mixed",
  "urgency": "low|medium|high|urgent",
  "emotion": "excited|calm|concerned|frustrated|happy|neutral",
  "toneDescription": "brief description of the speaker's tone",
  "topics": ["main topics discussed"],
  "mentions": {
    "people": ["names mentioned"],
    "dates": [{ "text": "date text", "isRelative": true|false }],
    "locations": ["locations mentioned"],
    "numbers": [{ "text": "number text", "value": 123, "type": "currency|percentage|quantity|time|other" }],
    "organizations": ["company/org names"],
    "events": ["events mentioned"]
  }
}

Rules:
1. Be thorough but concise
2. Extract ALL action items, even implicit ones
3. For suggested responses, provide 2-3 options with different tones
4. Identify urgency based on language cues (ASAP, urgent, deadline, etc.)
5. If no items exist for a category, use empty array []
6. Return ONLY valid JSON, no markdown or explanations`;

    const prompt = withFormattedOutput(basePrompt, 'voice-analysis');

    try {
      const parsed = await invokeAIJson<Record<string, unknown>>(
        'voxer_transcript_summary',
        prompt,
        { workspaceId: wsId, temperature: 0.3 },
      );

      const processingTime = Date.now() - startTime;
      return this.formatAnalysisResult(parsed, transcription, processingTime);
    } catch (error) {
      console.error('Vox analysis error:', error);
      throw error;
    }
  }

  // ============================================
  // QUICK ANALYSIS (Lightweight)
  // ============================================

  async quickAnalyze(
    transcription: string,
    workspaceId?: string,
  ): Promise<{
    sentiment: SentimentType;
    urgency: UrgencyLevel;
    hasActionItems: boolean;
    hasQuestions: boolean;
    topicCount: number;
  }> {
    const wsId = this.resolveWorkspaceId(workspaceId);

    const prompt = `Quickly analyze this voice message. Return JSON only:
{
  "sentiment": "positive|neutral|negative|mixed",
  "urgency": "low|medium|high|urgent",
  "hasActionItems": true|false,
  "hasQuestions": true|false,
  "topicCount": number
}

Message: "${transcription.slice(0, 500)}"`;

    try {
      return await invokeAIJson<{
        sentiment: SentimentType;
        urgency: UrgencyLevel;
        hasActionItems: boolean;
        hasQuestions: boolean;
        topicCount: number;
      }>('sentiment_analysis', prompt, { workspaceId: wsId, temperature: 0.2 });
    } catch (error) {
      console.error('Quick analysis error:', error);
    }

    return {
      sentiment: 'neutral',
      urgency: 'low',
      hasActionItems: false,
      hasQuestions: transcription.includes('?'),
      topicCount: 1,
    };
  }

  // ============================================
  // EXTRACT ACTION ITEMS ONLY
  // ============================================

  async extractActionItems(
    transcription: string,
    workspaceId?: string,
  ): Promise<ActionItem[]> {
    const wsId = this.resolveWorkspaceId(workspaceId);

    const prompt = `Extract all action items from this message. Include both explicit ("Please do X") and implicit ("We need to X") tasks.

Message: "${transcription}"

Return JSON with a single "items" array:
{
  "items": [
    {
      "text": "task description",
      "assignedTo": "person or null",
      "priority": "low|medium|high",
      "extractedFrom": "relevant quote from message"
    }
  ]
}

Return ONLY the JSON, no explanations.`;

    try {
      const parsed = await invokeAIJson<{ items?: Array<Record<string, unknown>> }>(
        'voxer_transcript_summary',
        prompt,
        { workspaceId: wsId, temperature: 0.2 },
      );
      const items = parsed.items ?? [];
      return items.map((item, index: number) => ({
        id: `action-${Date.now()}-${index}`,
        text: (item.text as string) || '',
        assignedTo: (item.assignedTo as string) || undefined,
        priority: (item.priority as 'low' | 'medium' | 'high') || 'medium',
        extractedFrom: item.extractedFrom as string | undefined,
        completed: false,
      }));
    } catch (error) {
      console.error('Extract action items error:', error);
    }

    return [];
  }

  // ============================================
  // GENERATE RESPONSE SUGGESTIONS
  // ============================================

  async generateResponses(
    transcription: string,
    context?: { relationship?: string; previousExchange?: string },
    workspaceId?: string,
  ): Promise<SuggestedResponse[]> {
    const wsId = this.resolveWorkspaceId(workspaceId);

    const contextInfo = context ? `
Relationship: ${context.relationship || 'colleague'}
${context.previousExchange ? `Previous exchange: ${context.previousExchange}` : ''}
` : '';

    const basePrompt = `Generate 3 response suggestions for this voice message.
${contextInfo}

Message: "${transcription}"

Provide diverse responses in JSON with a single "suggestions" array:
{
  "suggestions": [
    {
      "text": "response text",
      "tone": "professional|casual|friendly|formal",
      "intent": "acknowledge|answer|clarify|confirm|decline"
    }
  ]
}

Make responses natural and appropriate. Return ONLY JSON.`;

    const prompt = withFormattedOutput(basePrompt, 'chat');

    try {
      const parsed = await invokeAIJson<{ suggestions?: Array<Record<string, unknown>> }>(
        'quick_reply_suggestions',
        prompt,
        { workspaceId: wsId, temperature: 0.6 },
      );
      const suggestions = parsed.suggestions ?? [];
      return suggestions.map((s, index: number) => ({
        id: `resp-${Date.now()}-${index}`,
        text: (s.text as string) || '',
        tone: (s.tone as SuggestedResponse['tone']) || 'professional',
        intent: (s.intent as SuggestedResponse['intent']) || 'acknowledge',
      }));
    } catch (error) {
      console.error('Generate responses error:', error);
    }

    return [];
  }

  // ============================================
  // COMPARE & SUMMARIZE CONVERSATION
  // ============================================

  async summarizeConversation(
    messages: Array<{ sender: string; text: string; timestamp: Date }>,
    workspaceId?: string,
  ): Promise<{
    summary: string;
    totalActionItems: ActionItem[];
    openQuestions: string[];
    keyDecisions: string[];
    nextSteps: string[];
  }> {
    const wsId = this.resolveWorkspaceId(workspaceId);

    const formattedMessages = messages
      .map(m => `[${m.sender}]: ${m.text}`)
      .join('\n');

    const basePrompt = `Summarize this voice conversation thread:

${formattedMessages}

Return JSON:
{
  "summary": "comprehensive summary of the conversation",
  "totalActionItems": [{ "text": "task", "assignedTo": "person|null", "priority": "low|medium|high" }],
  "openQuestions": ["unanswered questions"],
  "keyDecisions": ["decisions made"],
  "nextSteps": ["recommended next steps"]
}`;

    const prompt = withFormattedOutput(basePrompt, 'summary');

    try {
      const parsed = await invokeAIJson<{
        summary?: string;
        totalActionItems?: Array<Record<string, unknown>>;
        openQuestions?: string[];
        keyDecisions?: string[];
        nextSteps?: string[];
      }>('voxer_transcript_summary', prompt, { workspaceId: wsId, temperature: 0.3 });

      return {
        summary: parsed.summary || '',
        totalActionItems: (parsed.totalActionItems || []).map((a, i: number) => ({
          id: `action-conv-${i}`,
          text: (a.text as string) || '',
          assignedTo: a.assignedTo as string | undefined,
          priority: (a.priority as 'low' | 'medium' | 'high') || 'medium',
          completed: false,
        })),
        openQuestions: parsed.openQuestions || [],
        keyDecisions: parsed.keyDecisions || [],
        nextSteps: parsed.nextSteps || [],
      };
    } catch (error) {
      console.error('Summarize conversation error:', error);
    }

    return {
      summary: 'Unable to generate summary',
      totalActionItems: [],
      openQuestions: [],
      keyDecisions: [],
      nextSteps: [],
    };
  }

  // ============================================
  // HELPER: FORMAT ANALYSIS RESULT
  // ============================================

  private formatAnalysisResult(
    parsed: any,
    _transcription: string,
    processingTime: number,
  ): VoxAnalysis {
    void _transcription; // reserved for future enrichment
    return {
      id: `analysis-${Date.now()}`,
      voxId: '',

      summary: parsed.summary || 'No summary available',
      keyPoints: parsed.keyPoints || [],

      actionItems: (parsed.actionItems || []).map((a: any, i: number) => ({
        id: `action-${Date.now()}-${i}`,
        text: a.text || '',
        assignedTo: a.assignedTo || undefined,
        dueDate: a.dueDate ? new Date(a.dueDate) : undefined,
        priority: a.priority || 'medium',
        completed: false,
        extractedFrom: a.extractedFrom,
      })),

      questions: parsed.questions || [],
      decisions: parsed.decisions || [],

      suggestedFollowUps: parsed.suggestedFollowUps || [],
      suggestedResponses: (parsed.suggestedResponses || []).map((s: any, i: number) => ({
        id: `resp-${Date.now()}-${i}`,
        text: s.text || '',
        tone: s.tone || 'professional',
        intent: s.intent || 'acknowledge',
      })),

      sentiment: (parsed.sentiment as SentimentType) || 'neutral',
      urgency: (parsed.urgency as UrgencyLevel) || 'low',
      emotion: parsed.emotion as EmotionType,
      toneDescription: parsed.toneDescription,

      topics: parsed.topics || [],
      mentions: {
        people: parsed.mentions?.people || [],
        dates: (parsed.mentions?.dates || []).map((d: any) => ({
          text: d.text || '',
          date: d.date ? new Date(d.date) : undefined,
          isRelative: d.isRelative ?? false,
        })),
        locations: parsed.mentions?.locations || [],
        numbers: (parsed.mentions?.numbers || []).map((n: any) => ({
          text: n.text || '',
          value: n.value || 0,
          type: n.type || 'other',
        })),
        organizations: parsed.mentions?.organizations || [],
        events: parsed.mentions?.events || [],
      },

      analyzedAt: new Date(),
      processingTime,
    };
  }

  /** Set the workspace ID used for router calls. */
  setWorkspaceId(workspaceId: string): void {
    this.workspaceId = workspaceId;
  }

  /** Invoke a fire-and-forget text prompt — exposed for ad-hoc callers. */
  protected async invokeText(
    task: Parameters<typeof invokeAIPrompt>[0],
    prompt: string,
    workspaceId?: string,
  ): Promise<string> {
    const wsId = this.resolveWorkspaceId(workspaceId);
    return invokeAIPrompt(task, prompt, { workspaceId: wsId });
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let analysisServiceInstance: RelayAnalysisService | null = null;

export const getRelayAnalysisService = (): RelayAnalysisService => {
  if (!analysisServiceInstance) {
    analysisServiceInstance = new RelayAnalysisService();
  }
  return analysisServiceInstance;
};

export default RelayAnalysisService;
