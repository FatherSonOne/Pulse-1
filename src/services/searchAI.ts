/**
 * AI-Powered Search Features
 * Categorization, tagging, and semantic enhancements
 */

const apiKey = import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';

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
   * AI-powered categorization of content
   */
  async categorizeContent(
    title: string,
    content: string,
    existingCategories?: string[]
  ): Promise<AICategory> {
    if (!apiKey) {
      return { category: 'general', confidence: 0 };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Analyze this content and suggest the best category from: ${existingCategories?.join(', ') || 'ideas, todo, reference, conversation, project, personal, work'}

Title: "${title}"
Content: "${content.substring(0, 500)}"

Return JSON: {"category": "category_name", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`
              }]
            }],
          }),
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
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
    if (!apiKey) {
      return { tags: [], confidence: 0 };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Analyze this content and suggest 3-5 relevant tags. ${existingTags?.length ? `Existing tags: ${existingTags.join(', ')}` : ''}

Title: "${title}"
Content: "${content.substring(0, 500)}"

Return JSON: {"tags": ["tag1", "tag2"], "confidence": 0.0-1.0}`
              }]
            }],
          }),
        }
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
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
    if (!apiKey || results.length === 0) {
      return '';
    }

    try {
      const context = results.slice(0, 10).map((r, i) => 
        `${i + 1}. ${r.title}: ${r.content.substring(0, 200)}`
      ).join('\n\n');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Summarize these search results into a brief, actionable summary (2-3 sentences):

${context}

Summary:`
              }]
            }],
          }),
        }
      );

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      console.error('AI summarization error:', error);
      return '';
    }
  }
}

export const searchAI = new SearchAI();