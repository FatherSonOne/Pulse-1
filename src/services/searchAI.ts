/**
 * AI-Powered Search Features
 * Categorization, tagging, and semantic enhancements
 * All calls proxied through gemini-proxy edge function (no client-side API keys)
 */

import { supabase } from './supabase';

export interface AICategory {
  category: string;
  confidence: number;
  reasoning?: string;
}

export interface AITags {
  tags: string[];
  confidence: number;
}

export class SearchAI {
  /**
   * Call Gemini via the secure edge function proxy
   */
  private async callGeminiProxy(prompt: string, operation: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        prompt,
        operation,
        model: 'gemini-2.5-flash',
        temperature: 0.3,
      },
    });

    if (error) {
      throw new Error(`Gemini proxy error: ${error.message}`);
    }

    return data?.result || '';
  }

  /**
   * AI-powered categorization of content
   */
  async categorizeContent(
    title: string,
    content: string,
    existingCategories?: string[]
  ): Promise<AICategory> {
    try {
      const prompt = `Analyze this content and suggest the best category from: ${existingCategories?.join(', ') || 'ideas, todo, reference, conversation, project, personal, work'}

Title: "${title}"
Content: "${content.substring(0, 500)}"

Return JSON: {"category": "category_name", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

      const text = await this.callGeminiProxy(prompt, 'searchCategorize');
      const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));

      return {
        category: parsed.category || 'general',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      console.error('AI categorization error:', error);
      return { category: 'general', confidence: 0 };
    }
  }

  /**
   * AI-powered tag suggestions
   */
  async suggestTags(title: string, content: string, existingTags?: string[]): Promise<AITags> {
    try {
      const prompt = `Analyze this content and suggest 3-5 relevant tags. ${existingTags?.length ? `Existing tags: ${existingTags.join(', ')}` : ''}

Title: "${title}"
Content: "${content.substring(0, 500)}"

Return JSON: {"tags": ["tag1", "tag2"], "confidence": 0.0-1.0}`;

      const text = await this.callGeminiProxy(prompt, 'searchTags');
      const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));

      return {
        tags: parsed.tags || [],
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error('AI tag suggestion error:', error);
      return { tags: [], confidence: 0 };
    }
  }

  /**
   * Summarize multiple search results
   */
  async summarizeResults(results: Array<{ title: string; content: string }>): Promise<string> {
    if (results.length === 0) return '';

    try {
      const context = results.slice(0, 10).map((r, i) =>
        `${i + 1}. ${r.title}: ${r.content.substring(0, 200)}`
      ).join('\n\n');

      const prompt = `Summarize these search results into a brief, actionable summary (2-3 sentences):

${context}

Summary:`;

      return await this.callGeminiProxy(prompt, 'searchSummarize');
    } catch (error) {
      console.error('AI summarization error:', error);
      return '';
    }
  }
}

export const searchAI = new SearchAI();
