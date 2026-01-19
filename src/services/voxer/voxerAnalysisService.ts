// Voxer Analysis Service
// AI-powered analysis of voice messages: summaries, action items, sentiment, and more

import { GoogleGenAI, Type } from "@google/genai";
import {
  VoxAnalysis,
  ActionItem,
  SuggestedResponse,
  VoxMentions,
  SentimentType,
  UrgencyLevel,
  EmotionType,
} from './voxerTypes';
import { withFormattedOutput, getContextualFormattingHints } from '../aiFormattingService';

// ============================================
// ANALYSIS SERVICE CLASS
// ============================================

export class VoxerAnalysisService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
    }
  ): Promise<VoxAnalysis> {
    const startTime = Date.now();
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const resultText = response.text || '{}';
      let parsed: any;
      
      try {
        // Try to extract JSON from response
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
      } catch (e) {
        console.error('Failed to parse analysis JSON:', e);
        parsed = {};
      }

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

  async quickAnalyze(transcription: string): Promise<{
    sentiment: SentimentType;
    urgency: UrgencyLevel;
    hasActionItems: boolean;
    hasQuestions: boolean;
    topicCount: number;
  }> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const jsonMatch = response.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
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

  async extractActionItems(transcription: string): Promise<ActionItem[]> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const prompt = `Extract all action items from this message. Include both explicit ("Please do X") and implicit ("We need to X") tasks.

Message: "${transcription}"

Return JSON array:
[
  {
    "text": "task description",
    "assignedTo": "person or null",
    "priority": "low|medium|high",
    "extractedFrom": "relevant quote from message"
  }
]

Return ONLY the JSON array, no explanations.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const jsonMatch = response.text?.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const items = JSON.parse(jsonMatch[0]);
        return items.map((item: any, index: number) => ({
          id: `action-${Date.now()}-${index}`,
          text: item.text || '',
          assignedTo: item.assignedTo || undefined,
          priority: item.priority || 'medium',
          extractedFrom: item.extractedFrom,
          completed: false,
        }));
      }
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
    context?: { relationship?: string; previousExchange?: string }
  ): Promise<SuggestedResponse[]> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const contextInfo = context ? `
Relationship: ${context.relationship || 'colleague'}
${context.previousExchange ? `Previous exchange: ${context.previousExchange}` : ''}
` : '';

    const basePrompt = `Generate 3 response suggestions for this voice message.
${contextInfo}

Message: "${transcription}"

Provide diverse responses in JSON:
[
  {
    "text": "response text",
    "tone": "professional|casual|friendly|formal",
    "intent": "acknowledge|answer|clarify|confirm|decline"
  }
]

Make responses natural and appropriate. Return ONLY JSON array.`;

    const prompt = withFormattedOutput(basePrompt, 'chat');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const jsonMatch = response.text?.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        return suggestions.map((s: any, index: number) => ({
          id: `resp-${Date.now()}-${index}`,
          text: s.text || '',
          tone: s.tone || 'professional',
          intent: s.intent || 'acknowledge',
        }));
      }
    } catch (error) {
      console.error('Generate responses error:', error);
    }

    return [];
  }

  // ============================================
  // COMPARE & SUMMARIZE CONVERSATION
  // ============================================

  async summarizeConversation(
    messages: Array<{ sender: string; text: string; timestamp: Date }>
  ): Promise<{
    summary: string;
    totalActionItems: ActionItem[];
    openQuestions: string[];
    keyDecisions: string[];
    nextSteps: string[];
  }> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const jsonMatch = response.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || '',
          totalActionItems: (parsed.totalActionItems || []).map((a: any, i: number) => ({
            id: `action-conv-${i}`,
            text: a.text,
            assignedTo: a.assignedTo,
            priority: a.priority || 'medium',
          })),
          openQuestions: parsed.openQuestions || [],
          keyDecisions: parsed.keyDecisions || [],
          nextSteps: parsed.nextSteps || [],
        };
      }
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
    transcription: string,
    processingTime: number
  ): VoxAnalysis {
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

  // ============================================
  // API KEY MANAGEMENT
  // ============================================

  setApiKey(key: string): void {
    this.apiKey = key;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let analysisServiceInstance: VoxerAnalysisService | null = null;

export const getVoxerAnalysisService = (apiKey?: string): VoxerAnalysisService => {
  if (!analysisServiceInstance && apiKey) {
    analysisServiceInstance = new VoxerAnalysisService(apiKey);
  }
  if (!analysisServiceInstance) {
    throw new Error('VoxerAnalysisService not initialized. Provide an API key.');
  }
  return analysisServiceInstance;
};

export default VoxerAnalysisService;
