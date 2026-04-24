/**
 * AI-Powered Search Features
 * Categorization, tagging, and semantic enhancements.
 *
 * All calls route through the central `ai-router` edge function which handles
 * provider selection, metering, hard caps, and prompt caching automatically.
 */

import { invokeAIJson, invokeAIPrompt } from './ai/aiService';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';
import { AIRouterError } from './ai/errors';

export interface AICategory {
  category: string;
  confidence: number;
  reasoning?: string;
}

export interface AITags {
  tags: string[];
  confidence: number;
}

interface CategoryRaw {
  category?: string;
  confidence?: number;
  reasoning?: string;
}

interface TagsRaw {
  tags?: string[];
  confidence?: number;
}

export class SearchAI {
  /**
   * AI-powered categorization of content.
   *
   * @param title Title to categorise.
   * @param content Content body (first 500 chars used).
   * @param existingCategories Optional list of allowed categories.
   * @param workspaceId Optional workspace override. Falls back to
   *   `getCurrentWorkspaceId()`.
   */
  async categorizeContent(
    title: string,
    content: string,
    existingCategories?: string[],
    workspaceId?: string
  ): Promise<AICategory> {
    try {
      const wsId = workspaceId ?? getCurrentWorkspaceId();
      if (!wsId) {
        throw new Error('No active workspace — AI unavailable');
      }

      const prompt = `Analyze this content and suggest the best category from: ${existingCategories?.join(', ') || 'ideas, todo, reference, conversation, project, personal, work'}

Title: "${title}"
Content: "${content.substring(0, 500)}"

Return JSON: {"category": "category_name", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

      const parsed = await invokeAIJson<CategoryRaw>(
        'auto_tag',
        prompt,
        { workspaceId: wsId, temperature: 0.3 },
      );

      return {
        category: parsed.category || 'general',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      // Re-throw router errors so UI can surface caps / trial / provider issues
      if (error instanceof AIRouterError) throw error;
      console.error('AI categorization error:', error);
      return { category: 'general', confidence: 0 };
    }
  }

  /**
   * AI-powered tag suggestions.
   *
   * @param title Title to analyse.
   * @param content Content body (first 500 chars used).
   * @param existingTags Optional existing tags to consider/align with.
   * @param workspaceId Optional workspace override. Falls back to
   *   `getCurrentWorkspaceId()`.
   */
  async suggestTags(
    title: string,
    content: string,
    existingTags?: string[],
    workspaceId?: string
  ): Promise<AITags> {
    try {
      const wsId = workspaceId ?? getCurrentWorkspaceId();
      if (!wsId) {
        throw new Error('No active workspace — AI unavailable');
      }

      const prompt = `Analyze this content and suggest 3-5 relevant tags. ${existingTags?.length ? `Existing tags: ${existingTags.join(', ')}` : ''}

Title: "${title}"
Content: "${content.substring(0, 500)}"

Return JSON: {"tags": ["tag1", "tag2"], "confidence": 0.0-1.0}`;

      const parsed = await invokeAIJson<TagsRaw>(
        'auto_tag',
        prompt,
        { workspaceId: wsId, temperature: 0.3 },
      );

      return {
        tags: parsed.tags || [],
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      // Re-throw router errors so UI can surface caps / trial / provider issues
      if (error instanceof AIRouterError) throw error;
      console.error('AI tag suggestion error:', error);
      return { tags: [], confidence: 0 };
    }
  }

  /**
   * Summarize multiple search results.
   *
   * @param results Up to 10 results summarised into 2-3 sentences.
   * @param workspaceId Optional workspace override. Falls back to
   *   `getCurrentWorkspaceId()`.
   */
  async summarizeResults(
    results: Array<{ title: string; content: string }>,
    workspaceId?: string
  ): Promise<string> {
    if (results.length === 0) return '';

    try {
      const wsId = workspaceId ?? getCurrentWorkspaceId();
      if (!wsId) {
        throw new Error('No active workspace — AI unavailable');
      }

      const context = results.slice(0, 10).map((r, i) =>
        `${i + 1}. ${r.title}: ${r.content.substring(0, 200)}`
      ).join('\n\n');

      const prompt = `Summarize these search results into a brief, actionable summary (2-3 sentences):

${context}

Summary:`;

      return await invokeAIPrompt(
        'smart_search_rewrite',
        prompt,
        { workspaceId: wsId, temperature: 0.3 },
      );
    } catch (error) {
      // Re-throw router errors so UI can surface caps / trial / provider issues
      if (error instanceof AIRouterError) throw error;
      console.error('AI summarization error:', error);
      return '';
    }
  }
}

export const searchAI = new SearchAI();
