// Relay AI Feedback Service
// Provides AI-powered feedback on voice messages before sending.
//
// All LLM calls route through the central `ai-router` edge function which
// handles provider selection, metering, hard caps, fallback on outage, and
// prompt caching automatically.

import {
  VoxFeedback,
  FeedbackIssue,
  FeedbackSuggestion,
  FeedbackSeverity,
  FeedbackCategory,
} from './relayTypes';
import { invokeAIJson } from '../ai/aiService';
import { getCurrentWorkspaceId } from '../ai/getWorkspaceId';

// ============================================
// FEEDBACK SERVICE CLASS
// ============================================

export class RelayFeedbackService {
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
  // MAIN FEEDBACK METHOD
  // ============================================

  async analyzeFeedback(
    transcription: string,
    context?: {
      recipientName?: string;
      relationship?: 'professional' | 'casual' | 'formal';
      purpose?: 'update' | 'request' | 'response' | 'general';
      previousMessages?: string[];
    },
    workspaceId?: string,
  ): Promise<VoxFeedback> {
    const wsId = this.resolveWorkspaceId(workspaceId);

    const contextInfo = context ? `
Context:
- Recipient: ${context.recipientName || 'Unknown'}
- Relationship: ${context.relationship || 'professional'}
- Purpose: ${context.purpose || 'general'}
${context.previousMessages?.length ? `- Previous context: ${context.previousMessages.slice(-2).join(' | ')}` : ''}
` : '';

    const prompt = `You are an AI communication coach analyzing a voice message BEFORE it's sent. Help the user improve their message.

${contextInfo}

Voice Message Transcription:
"${transcription}"

Analyze the message and provide comprehensive feedback in JSON format:
{
  "overallScore": 0-100,
  "isReadyToSend": true|false,

  "contentIssues": [
    {
      "category": "content",
      "severity": "info|warning|critical",
      "message": "description of the issue",
      "suggestion": "how to fix it",
      "highlightText": "relevant text from message"
    }
  ],

  "toneIssues": [
    {
      "category": "tone",
      "severity": "info|warning|critical",
      "message": "tone issue description",
      "suggestion": "how to improve"
    }
  ],

  "clarityIssues": [
    {
      "category": "clarity",
      "severity": "info|warning|critical",
      "message": "clarity issue description",
      "suggestion": "how to clarify"
    }
  ],

  "suggestions": [
    {
      "type": "rephrase|add_context|clarify|soften|strengthen|structure",
      "originalText": "original problematic text or null",
      "suggestedText": "improved version",
      "reason": "why this change helps"
    }
  ],

  "improvedTranscription": "full improved version of the message (or null if not needed)",

  "wordCount": number,
  "hasActionItems": true|false,
  "hasQuestions": true|false
}

Feedback Rules:
1. Look for missing information (e.g., "meeting" without time, "project" without name)
2. Check for unclear references (e.g., "that thing", "the issue")
3. Identify potentially harsh or inappropriate tone
4. Flag incomplete sentences or cut-off thoughts
5. Suggest more professional alternatives if needed
6. Check if questions are clear and answerable
7. Verify action items have owners and deadlines
8. Score generously - most messages are fine to send (70+ is good)
9. Only mark isReadyToSend as false if there are critical issues

Return ONLY valid JSON.`;

    try {
      // Coaching feedback is user-facing quality-sensitive work → pulse_assistant_chat.
      const parsed = await invokeAIJson<Record<string, unknown>>(
        'pulse_assistant_chat',
        prompt,
        { workspaceId: wsId, temperature: 0.4 },
      );
      return this.formatFeedbackResult(parsed, transcription);
    } catch (error) {
      console.error('Feedback analysis error:', error);
      throw error;
    }
  }

  // ============================================
  // QUICK FEEDBACK (Lightweight)
  // ============================================

  async quickFeedback(
    transcription: string,
    workspaceId?: string,
  ): Promise<{
    score: number;
    isReady: boolean;
    topIssue: string | null;
    topSuggestion: string | null;
  }> {
    const wsId = this.resolveWorkspaceId(workspaceId);

    const prompt = `Quickly review this voice message before sending. Return JSON only:
{
  "score": 0-100,
  "isReady": true|false,
  "topIssue": "main issue or null",
  "topSuggestion": "main suggestion or null"
}

Message: "${transcription.slice(0, 500)}"`;

    try {
      return await invokeAIJson<{
        score: number;
        isReady: boolean;
        topIssue: string | null;
        topSuggestion: string | null;
      }>('quick_reply_suggestions', prompt, { workspaceId: wsId, temperature: 0.3 });
    } catch (error) {
      console.error('Quick feedback error:', error);
    }

    return {
      score: 85,
      isReady: true,
      topIssue: null,
      topSuggestion: null,
    };
  }

  // ============================================
  // TONE ANALYSIS
  // ============================================

  async analyzeTone(
    transcription: string,
    workspaceId?: string,
  ): Promise<{
    dominantTone: string;
    toneScore: number;
    isAppropriate: boolean;
    suggestions: string[];
  }> {
    const wsId = this.resolveWorkspaceId(workspaceId);

    const prompt = `Analyze the tone of this voice message:

"${transcription}"

Return JSON:
{
  "dominantTone": "professional|casual|formal|urgent|friendly|neutral|aggressive|passive",
  "toneScore": 0-100 (how appropriate for professional communication),
  "isAppropriate": true|false,
  "suggestions": ["tone improvement suggestions"]
}`;

    try {
      return await invokeAIJson<{
        dominantTone: string;
        toneScore: number;
        isAppropriate: boolean;
        suggestions: string[];
      }>('sentiment_analysis', prompt, { workspaceId: wsId, temperature: 0.2 });
    } catch (error) {
      console.error('Tone analysis error:', error);
    }

    return {
      dominantTone: 'neutral',
      toneScore: 80,
      isAppropriate: true,
      suggestions: [],
    };
  }

  // ============================================
  // COMPLETENESS CHECK
  // ============================================

  async checkCompleteness(
    transcription: string,
    expectedElements?: string[],
    workspaceId?: string,
  ): Promise<{
    isComplete: boolean;
    missingElements: string[];
    completenessScore: number;
  }> {
    const wsId = this.resolveWorkspaceId(workspaceId);

    const elementsPrompt = expectedElements?.length
      ? `Expected elements: ${expectedElements.join(', ')}`
      : 'Check for: greeting, main point, action items (if any), closing';

    const prompt = `Check if this message is complete:

"${transcription}"

${elementsPrompt}

Return JSON:
{
  "isComplete": true|false,
  "missingElements": ["list of missing elements"],
  "completenessScore": 0-100
}`;

    try {
      return await invokeAIJson<{
        isComplete: boolean;
        missingElements: string[];
        completenessScore: number;
      }>('voxer_transcript_summary', prompt, { workspaceId: wsId, temperature: 0.3 });
    } catch (error) {
      console.error('Completeness check error:', error);
    }

    return {
      isComplete: true,
      missingElements: [],
      completenessScore: 90,
    };
  }

  // ============================================
  // IMPROVE MESSAGE
  // ============================================

  async improveMessage(
    transcription: string,
    improvements: Array<'clarity' | 'tone' | 'brevity' | 'professionalism' | 'completeness'>,
    workspaceId?: string,
  ): Promise<{
    improved: string;
    changes: string[];
  }> {
    const wsId = this.resolveWorkspaceId(workspaceId);

    const prompt = `Improve this voice message focusing on: ${improvements.join(', ')}

Original: "${transcription}"

Return JSON:
{
  "improved": "improved version of the message",
  "changes": ["list of changes made"]
}

Keep the speaker's voice and intent, just improve based on the requested areas.`;

    try {
      return await invokeAIJson<{ improved: string; changes: string[] }>(
        'quick_reply_suggestions',
        prompt,
        { workspaceId: wsId, temperature: 0.5 },
      );
    } catch (error) {
      console.error('Improve message error:', error);
    }

    return {
      improved: transcription,
      changes: [],
    };
  }

  // ============================================
  // REPHRASE SPECIFIC TEXT
  // ============================================

  async rephrase(
    text: string,
    style: 'professional' | 'casual' | 'formal' | 'friendly' | 'concise',
    workspaceId?: string,
  ): Promise<string[]> {
    const wsId = this.resolveWorkspaceId(workspaceId);

    const prompt = `Provide 3 alternative phrasings for this text in a ${style} style:

"${text}"

Return JSON with a single "options" array:
{ "options": ["option 1", "option 2", "option 3"] }`;

    try {
      const parsed = await invokeAIJson<{ options?: string[] }>(
        'quick_reply_suggestions',
        prompt,
        { workspaceId: wsId, temperature: 0.6 },
      );
      if (Array.isArray(parsed.options) && parsed.options.length > 0) {
        return parsed.options;
      }
    } catch (error) {
      console.error('Rephrase error:', error);
    }

    return [text];
  }

  // ============================================
  // HELPER: FORMAT FEEDBACK RESULT
  // ============================================

  private formatFeedbackResult(parsed: any, transcription: string): VoxFeedback {
    const formatIssues = (issues: any[], category: FeedbackCategory): FeedbackIssue[] => {
      return (issues || []).map((issue: any, index: number) => ({
        id: `issue-${category}-${index}`,
        category,
        severity: (issue.severity as FeedbackSeverity) || 'info',
        message: issue.message || '',
        suggestion: issue.suggestion,
        highlightText: issue.highlightText,
        position: issue.position,
      }));
    };

    const formatSuggestions = (suggestions: any[]): FeedbackSuggestion[] => {
      return (suggestions || []).map((s: any, index: number) => ({
        id: `sug-${index}`,
        type: s.type || 'clarify',
        originalText: s.originalText,
        suggestedText: s.suggestedText || '',
        reason: s.reason || '',
      }));
    };

    return {
      id: `feedback-${Date.now()}`,
      voxId: '',

      overallScore: parsed.overallScore ?? 85,
      isReadyToSend: parsed.isReadyToSend ?? true,

      contentIssues: formatIssues(parsed.contentIssues, 'content'),
      toneIssues: formatIssues(parsed.toneIssues, 'tone'),
      clarityIssues: formatIssues(parsed.clarityIssues, 'clarity'),

      suggestions: formatSuggestions(parsed.suggestions),

      improvedTranscription: parsed.improvedTranscription,

      wordCount: parsed.wordCount ?? transcription.split(/\s+/).length,
      estimatedDuration: (parsed.wordCount ?? transcription.split(/\s+/).length) / 150 * 60,
      hasActionItems: parsed.hasActionItems ?? false,
      hasQuestions: parsed.hasQuestions ?? transcription.includes('?'),

      analyzedAt: new Date(),
    };
  }

  /** Set the workspace ID used for router calls. */
  setWorkspaceId(workspaceId: string): void {
    this.workspaceId = workspaceId;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let feedbackServiceInstance: RelayFeedbackService | null = null;

export const getRelayFeedbackService = (): RelayFeedbackService => {
  if (!feedbackServiceInstance) {
    feedbackServiceInstance = new RelayFeedbackService();
  }
  return feedbackServiceInstance;
};

export default RelayFeedbackService;
