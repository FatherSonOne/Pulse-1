// Voxer AI Feedback Service
// Provides AI-powered feedback on voice messages before sending

import { GoogleGenAI } from "@google/genai";
import {
  VoxFeedback,
  FeedbackIssue,
  FeedbackSuggestion,
  FeedbackSeverity,
  FeedbackCategory,
} from './voxerTypes';

// ============================================
// FEEDBACK SERVICE CLASS
// ============================================

export class VoxerFeedbackService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
    }
  ): Promise<VoxFeedback> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const resultText = response.text || '{}';
      let parsed: any;
      
      try {
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
      } catch (e) {
        console.error('Failed to parse feedback JSON:', e);
        parsed = {};
      }

      return this.formatFeedbackResult(parsed, transcription);
    } catch (error) {
      console.error('Feedback analysis error:', error);
      throw error;
    }
  }

  // ============================================
  // QUICK FEEDBACK (Lightweight)
  // ============================================

  async quickFeedback(transcription: string): Promise<{
    score: number;
    isReady: boolean;
    topIssue: string | null;
    topSuggestion: string | null;
  }> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const prompt = `Quickly review this voice message before sending. Return JSON only:
{
  "score": 0-100,
  "isReady": true|false,
  "topIssue": "main issue or null",
  "topSuggestion": "main suggestion or null"
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

  async analyzeTone(transcription: string): Promise<{
    dominantTone: string;
    toneScore: number;
    isAppropriate: boolean;
    suggestions: string[];
  }> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const jsonMatch = response.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
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
    expectedElements?: string[]
  ): Promise<{
    isComplete: boolean;
    missingElements: string[];
    completenessScore: number;
  }> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const jsonMatch = response.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
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
    improvements: Array<'clarity' | 'tone' | 'brevity' | 'professionalism' | 'completeness'>
  ): Promise<{
    improved: string;
    changes: string[];
  }> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const prompt = `Improve this voice message focusing on: ${improvements.join(', ')}

Original: "${transcription}"

Return JSON:
{
  "improved": "improved version of the message",
  "changes": ["list of changes made"]
}

Keep the speaker's voice and intent, just improve based on the requested areas.`;

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
    style: 'professional' | 'casual' | 'formal' | 'friendly' | 'concise'
  ): Promise<string[]> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const prompt = `Provide 3 alternative phrasings for this text in a ${style} style:

"${text}"

Return JSON array of strings: ["option 1", "option 2", "option 3"]`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const jsonMatch = response.text?.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
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

let feedbackServiceInstance: VoxerFeedbackService | null = null;

export const getVoxerFeedbackService = (apiKey?: string): VoxerFeedbackService => {
  if (!feedbackServiceInstance && apiKey) {
    feedbackServiceInstance = new VoxerFeedbackService(apiKey);
  }
  if (!feedbackServiceInstance) {
    throw new Error('VoxerFeedbackService not initialized. Provide an API key.');
  }
  return feedbackServiceInstance;
};

export default VoxerFeedbackService;
