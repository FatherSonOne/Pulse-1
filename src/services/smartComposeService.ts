// Smart Compose Service (Scaffold)
// Provides AI-powered inline completion suggestions for email drafts

import { emailAIService } from './emailAIService';
import type { CachedEmail } from './emailSyncService';

export interface SmartComposeSuggestion {
  text: string;
  confidence: number; // 0-1
  type: 'completion' | 'next_sentence' | 'closing';
}

export interface SmartComposeContext {
  partialText: string;
  replyTo?: CachedEmail;
  recipientEmail?: string;
  tone?: 'professional' | 'friendly' | 'formal' | 'concise';
}

class SmartComposeService {
  /**
   * Check if Smart Compose is available
   */
  isAvailable(): boolean {
    return emailAIService.isAvailable();
  }

  /**
   * Get smart compose suggestions (scaffold implementation)
   */
  async getSuggestions(context: SmartComposeContext): Promise<SmartComposeSuggestion[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const tone = context.tone || 'professional';

    const prompt = `Continue this email draft with 1-2 natural sentences. 
Return ONLY the continuation text, no quotes or extra explanation.

Draft so far:
${context.partialText}
`;

    try {
      const generated = await emailAIService.generateDraft({
        intent: prompt,
        tone,
        replyTo: context.replyTo,
        context: context.recipientEmail ? `Recipient: ${context.recipientEmail}` : undefined,
      });

      const suggestion = generated.trim();
      if (!suggestion) return [];

      return [{
        text: suggestion,
        confidence: 0.6,
        type: 'completion',
      }];
    } catch (error) {
      console.error('[SmartComposeService] Failed to generate suggestion:', error);
      return [];
    }
  }

  /**
   * Placeholder for future real-time suggestion engine
   */
  async getInlineSuggestion(_context: SmartComposeContext): Promise<SmartComposeSuggestion | null> {
    // TODO: Implement streaming suggestions based on keystrokes
    return null;
  }
}

export const smartComposeService = new SmartComposeService();
export default smartComposeService;
