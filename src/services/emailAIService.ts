// Email AI Service - AI analysis and generation for emails using Gemini
import { supabase } from './supabase';
import { CachedEmail } from './emailSyncService';
import { withFormattedOutput, getContextualFormattingHints } from './aiFormattingService';

// ========================================
// TYPES
// ========================================

export interface EmailAnalysis {
  summary: string;
  category: 'priority' | 'updates' | 'social' | 'promotions' | 'newsletters' | 'spam';
  priorityScore: number; // 0-100
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  actionItems: string[];
  entities: {
    dates: { text: string; parsed: string }[];
    people: { name: string; email?: string }[];
    amounts: { text: string; value: number; currency: string }[];
    links: { text: string; url: string }[];
    meetingRequests: boolean;
  };
  suggestedReplies: string[];
}

export interface DraftGenerationParams {
  intent: string;
  tone: 'professional' | 'friendly' | 'formal' | 'concise';
  replyTo?: CachedEmail;
  context?: string;
}

export interface ToneCheckResult {
  appropriate: boolean;
  currentTone: string;
  issues: string[];
  suggestions: string[];
}

// ========================================
// EMAIL AI SERVICE
// ========================================

class EmailAIService {
  private apiKey: string | null = null;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  constructor() {
    // API key should be fetched from environment or secure storage
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || null;
  }

  /**
   * Check if AI features are available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Make a request to Gemini API
   */
  private async geminiRequest(prompt: string, formattingContext?: 'email-draft' | 'email-analysis' | 'summary' | 'chat'): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Apply formatting if context provided
    const formattedPrompt = formattingContext
      ? withFormattedOutput(prompt, formattingContext)
      : prompt;

    const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: formattedPrompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Analyze an email for AI insights
   */
  async analyzeEmail(email: CachedEmail): Promise<EmailAnalysis> {
    const prompt = `Analyze this email and provide structured insights.

EMAIL:
From: ${email.from_name || email.from_email} <${email.from_email}>
Subject: ${email.subject}
Body: ${email.body_text?.substring(0, 2000) || email.snippet}

Respond in JSON format ONLY with this structure:
{
  "summary": "1-2 sentence TL;DR",
  "category": "priority|updates|social|promotions|newsletters|spam",
  "priorityScore": 0-100,
  "sentiment": "positive|neutral|negative|urgent",
  "actionItems": ["list", "of", "tasks"],
  "entities": {
    "dates": [{"text": "original text", "parsed": "ISO date"}],
    "people": [{"name": "Person Name", "email": "email@example.com"}],
    "amounts": [{"text": "$500", "value": 500, "currency": "USD"}],
    "links": [],
    "meetingRequests": true|false
  },
  "suggestedReplies": ["Short reply 1", "Short reply 2", "Short reply 3"]
}`;

    try {
      const result = await this.geminiRequest(prompt);

      // Parse JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON in response');
      }

      const analysis = JSON.parse(jsonMatch[0]) as EmailAnalysis;
      return analysis;
    } catch (error) {
      console.error('Email analysis error:', error);
      // Return default analysis on error
      return {
        summary: email.snippet || 'Unable to generate summary',
        category: 'updates',
        priorityScore: 50,
        sentiment: 'neutral',
        actionItems: [],
        entities: {
          dates: [],
          people: [],
          amounts: [],
          links: [],
          meetingRequests: false
        },
        suggestedReplies: []
      };
    }
  }

  /**
   * Generate an email draft based on user intent
   */
  async generateDraft(params: DraftGenerationParams): Promise<string> {
    const toneDescriptions = {
      professional: 'professional and courteous, suitable for business communication',
      friendly: 'warm and friendly, personable but still appropriate',
      formal: 'formal and respectful, suitable for official correspondence',
      concise: 'brief and to the point, no unnecessary words'
    };

    let prompt = `Generate an email draft with the following requirements:

INTENT: ${params.intent}
TONE: ${toneDescriptions[params.tone]}`;

    if (params.replyTo) {
      prompt += `

REPLYING TO:
From: ${params.replyTo.from_name || params.replyTo.from_email}
Subject: ${params.replyTo.subject}
Content: ${params.replyTo.body_text?.substring(0, 1000) || params.replyTo.snippet}`;
    }

    if (params.context) {
      prompt += `

ADDITIONAL CONTEXT: ${params.context}`;
    }

    prompt += `

Generate ONLY the email body text, no subject line. Do not include greetings like "Dear [Name]" if replying - start naturally.`;

    try {
      const draft = await this.geminiRequest(prompt, 'email-draft');
      return draft.trim();
    } catch (error) {
      console.error('Draft generation error:', error);
      throw new Error('Failed to generate draft');
    }
  }

  /**
   * Check the tone of an email before sending
   */
  async checkTone(emailBody: string, recipientContext?: string): Promise<ToneCheckResult> {
    const prompt = `Analyze the tone of this email and provide feedback.

EMAIL BODY:
${emailBody}

${recipientContext ? `CONTEXT: ${recipientContext}` : ''}

Respond in JSON format ONLY:
{
  "appropriate": true|false,
  "currentTone": "description of current tone",
  "issues": ["list of potential issues"],
  "suggestions": ["list of improvement suggestions"]
}`;

    try {
      const result = await this.geminiRequest(prompt);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON in response');
      }

      return JSON.parse(jsonMatch[0]) as ToneCheckResult;
    } catch (error) {
      console.error('Tone check error:', error);
      return {
        appropriate: true,
        currentTone: 'Unable to analyze',
        issues: [],
        suggestions: []
      };
    }
  }

  /**
   * Enhance/rewrite email text
   */
  async enhanceEmail(
    emailBody: string,
    action: 'shorten' | 'elaborate' | 'formalize' | 'casualize' | 'fix_grammar'
  ): Promise<string> {
    const actionDescriptions = {
      shorten: 'Make this email more concise while keeping all important information',
      elaborate: 'Add more professional detail and context to this email',
      formalize: 'Rewrite this email in a more formal, professional tone',
      casualize: 'Rewrite this email in a more casual, friendly tone',
      fix_grammar: 'Fix any grammar, spelling, or punctuation errors in this email'
    };

    const prompt = `${actionDescriptions[action]}:

${emailBody}

Return ONLY the improved email text, nothing else.`;

    try {
      const enhanced = await this.geminiRequest(prompt, 'email-draft');
      return enhanced.trim();
    } catch (error) {
      console.error('Email enhancement error:', error);
      throw new Error('Failed to enhance email');
    }
  }

  /**
   * Generate a thread summary
   */
  async summarizeThread(emails: CachedEmail[]): Promise<string> {
    const threadContent = emails.map((e, i) => `
Message ${i + 1} (${new Date(e.received_at).toLocaleDateString()}):
From: ${e.from_name || e.from_email}
${e.body_text?.substring(0, 500) || e.snippet}
`).join('\n---\n');

    const prompt = `Summarize this email thread in 2-3 sentences, highlighting key points and any pending action items:

${threadContent}`;

    try {
      const summary = await this.geminiRequest(prompt, 'summary');
      return summary.trim();
    } catch (error) {
      console.error('Thread summary error:', error);
      return 'Unable to generate summary';
    }
  }

  /**
   * Calculate priority score based on various factors
   */
  calculatePriorityScore(email: CachedEmail, contactStrength?: number): number {
    let score = 50; // Base score

    // Direct vs CC'd
    if (email.to_emails?.some(t => t.email === email.user_id)) {
      score += 20;
    }

    // Contact relationship strength
    if (contactStrength && contactStrength > 70) {
      score += 30;
    } else if (contactStrength && contactStrength > 40) {
      score += 15;
    }

    // Email markers
    if (email.is_important) score += 10;
    if (email.is_starred) score += 5;

    // Negative factors
    if (email.labels?.includes('CATEGORY_PROMOTIONS')) score -= 20;
    if (email.labels?.includes('CATEGORY_SOCIAL')) score -= 10;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Analyze and save email insights to database
   */
  async analyzeAndSave(email: CachedEmail): Promise<void> {
    if (!this.isAvailable()) {
      console.log('AI service not available, skipping analysis');
      return;
    }

    try {
      const analysis = await this.analyzeEmail(email);

      // Update the cached email with AI insights
      const { error } = await supabase
        .from('cached_emails')
        .update({
          ai_summary: analysis.summary,
          ai_category: analysis.category,
          ai_priority_score: analysis.priorityScore,
          ai_sentiment: analysis.sentiment,
          ai_action_items: analysis.actionItems,
          ai_suggested_replies: analysis.suggestedReplies,
          ai_entities: analysis.entities,
          analyzed_at: new Date().toISOString()
        })
        .eq('id', email.id);

      if (error) {
        console.error('Error saving email analysis:', error);
      }
    } catch (error) {
      console.error('Error analyzing email:', error);
    }
  }

  /**
   * Generate daily briefing summary
   */
  async generateDailyBriefing(emails: CachedEmail[]): Promise<{
    summary: string;
    priorities: { email: CachedEmail; reason: string }[];
    actionItems: { item: string; fromEmail: string }[];
  }> {
    const newEmails = emails.filter(e => {
      const receivedAt = new Date(e.received_at);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return receivedAt > oneDayAgo;
    });

    // Get high priority emails
    const priorities = newEmails
      .filter(e => (e.ai_priority_score || 50) >= 70)
      .slice(0, 5)
      .map(e => ({
        email: e,
        reason: e.ai_summary || 'High priority based on sender'
      }));

    // Collect action items
    const actionItems: { item: string; fromEmail: string }[] = [];
    for (const email of newEmails) {
      if (email.ai_action_items) {
        for (const item of email.ai_action_items) {
          actionItems.push({
            item,
            fromEmail: email.from_name || email.from_email
          });
        }
      }
    }

    // Generate summary
    const urgentCount = newEmails.filter(e => e.ai_sentiment === 'urgent').length;
    const meetingCount = newEmails.filter(e => e.ai_entities?.meetingRequests).length;

    const summary = `You have ${newEmails.length} new emails. ${
      urgentCount > 0 ? `${urgentCount} need urgent attention. ` : ''
    }${
      meetingCount > 0 ? `${meetingCount} meeting requests detected. ` : ''
    }${
      actionItems.length > 0 ? `${actionItems.length} action items extracted.` : ''
    }`;

    return {
      summary,
      priorities,
      actionItems: actionItems.slice(0, 10)
    };
  }
}

// Singleton instance
export const emailAIService = new EmailAIService();
