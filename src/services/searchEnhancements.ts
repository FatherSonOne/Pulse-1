import { unifiedSearchService, SearchResult, SearchFilters, SearchSourceError } from './unifiedSearchService';
import searchQueryParser from './searchQueryParser';
import { supabase } from './supabase';

// Uses searchQueryParser.parseToFlatOperators() — no local adapter needed

/**
 * Enhanced Search with AI Semantic Search and Auto-suggestions
 */

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'operator' | 'contact' | 'tag';
  icon?: string;
}

export class SearchEnhancements {
  /**
   * Get search suggestions based on query
   */
  async getSuggestions(
    query: string,
    userId: string,
    limit: number = 10
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    const queryLower = query.toLowerCase().trim();

    // Operator suggestions
    if (queryLower.startsWith('from:')) {
      const contacts = await this.getContactSuggestions(userId);
      suggestions.push(...contacts.map(c => ({
        id: `contact-${c.id}`,
        text: `from:${c.name}`,
        type: 'contact' as const,
        icon: '👤',
      })));
    } else if (queryLower.startsWith('type:')) {
      const types = ['message', 'email', 'vox', 'task', 'event', 'contact', 'note'];
      suggestions.push(...types.filter(t => t.includes(queryLower.replace('type:', '')))
        .map(t => ({
          id: `type-${t}`,
          text: `type:${t}`,
          type: 'operator' as const,
          icon: '📋',
        })));
    } else if (queryLower.startsWith('tag:')) {
      const tags = await this.getTagSuggestions(userId);
      suggestions.push(...tags.map(t => ({
        id: `tag-${t}`,
        text: `tag:${t}`,
        type: 'tag' as const,
        icon: '🏷️',
      })));
    } else {
      // Recent searches
      const recent = await this.getRecentSearches(userId, limit);
      suggestions.push(...recent.map((s, i) => ({
        id: `recent-${i}`,
        text: s,
        type: 'recent' as const,
        icon: '🕐',
      })));

      // Popular searches (if query matches)
      if (queryLower.length > 2) {
        const popular = await this.getPopularSearches(userId, queryLower, limit);
        suggestions.push(...popular.map((s, i) => ({
          id: `popular-${i}`,
          text: s,
          type: 'popular' as const,
          icon: '🔥',
        })));
      }
    }

    return suggestions.slice(0, limit);
  }

  /**
   * Enhanced search with AI semantic search
   */
  async enhancedSearch(
    query: string,
    userId: string,
    filters?: SearchFilters,
    useAI: boolean = true,
    onSourceComplete?: (results: SearchResult[], completedSource: string) => void
  ): Promise<{ results: SearchResult[]; errors: SearchSourceError[] }> {
    const parsed = searchQueryParser.parseToFlatOperators(query);

    // Perform regular search
    const { results: rawResults, errors } = await unifiedSearchService.search(
      parsed.baseQuery || query,
      userId,
      this.applyOperatorsToFilters(parsed.operators, filters),
      { field: 'timestamp', order: 'desc' },
      onSourceComplete
    );

    let results = rawResults;

    // If AI is enabled and we have results, enhance with semantic search
    if (useAI && results.length > 0 && parsed.baseQuery) {
      try {
        const aiResults = await this.semanticSearch(query, results);
        // Merge and deduplicate
        const resultMap = new Map<string, SearchResult>();
        results.forEach(r => resultMap.set(r.id, r));
        aiResults.forEach(r => {
          if (!resultMap.has(r.id)) {
            resultMap.set(r.id, r);
          }
        });
        results = Array.from(resultMap.values());
      } catch (error) {
        console.error('AI search error:', error);
        // Continue with regular results if AI fails
      }
    }

    return { results, errors };
  }

  /**
   * Semantic search using AI (proxied through gemini-proxy edge function)
   */
  private async semanticSearch(
    query: string,
    existingResults: SearchResult[]
  ): Promise<SearchResult[]> {
    // Create context from existing results
    const context = existingResults.slice(0, 20).map(r => ({
      id: r.id,
      content: `${r.title}: ${r.content.substring(0, 200)}`,
      type: r.type,
    }));

    try {
      const prompt = `You are a semantic search assistant. Given this search query and context, identify which items are most relevant semantically.

Search Query: "${query}"

Context Items:
${context.map((c, i) => `${i + 1}. [${c.type}] ${c.content}`).join('\n')}

IMPORTANT: Return ONLY a valid JSON array of item numbers ranked by semantic relevance. No explanation, no text, just the array.
Example correct response: [3, 1, 5, 2, 4]
Do not include any other text or markdown formatting.`;

      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          prompt,
          operation: 'semanticRerank',
          model: 'gemini-2.5-flash',
          temperature: 0.1,
        },
      });

      if (error) {
        console.error('Semantic search proxy error:', error.message);
        return existingResults;
      }

      const text = data?.result || '[]';

      // Clean up the response more aggressively
      let cleanedText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^[^[]*/, '') // Remove anything before the array
        .replace(/[^\]]*$/, '') // Remove anything after the array (keep the ])
        .trim();

      // If we still can't find a valid array, return original results
      if (!cleanedText.startsWith('[') || !cleanedText.endsWith(']')) {
        console.log('Could not parse AI response, using original order');
        return existingResults;
      }

      const rankedIds = JSON.parse(cleanedText);

      // Validate that rankedIds is an array of numbers
      if (!Array.isArray(rankedIds) || !rankedIds.every(id => typeof id === 'number')) {
        return existingResults;
      }

      // Reorder results based on AI ranking
      const rankedResults: SearchResult[] = [];
      rankedIds.forEach((idx: number) => {
        if (context[idx - 1]) {
          const original = existingResults.find(r => r.id === context[idx - 1].id);
          if (original) rankedResults.push(original);
        }
      });

      // Add any remaining results
      existingResults.forEach(r => {
        if (!rankedResults.find(rr => rr.id === r.id)) {
          rankedResults.push(r);
        }
      });

      return rankedResults;
    } catch (error) {
      console.error('Semantic search error:', error);
      return existingResults;
    }
  }

  /**
   * Apply parsed operators to filters
   */
  private applyOperatorsToFilters(
    operators: Record<string, string>,
    existingFilters?: SearchFilters
  ): SearchFilters {
    const filters: SearchFilters = { ...existingFilters };

    if (operators.from) {
      filters.sender = operators.from;
    }

    if (operators.type) {
      filters.types = [operators.type as any];
    }

    if (operators.tag) {
      filters.tags = [operators.tag];
    }

    if (operators.date) {
      const date = this.parseDateOperator(operators.date);
      if (date) {
        filters.dateFrom = date.start;
        filters.dateTo = date.end;
      }
    }

    if (operators.priority) {
      filters.priority = operators.priority as any;
    }

    return filters;
  }

  /**
   * Parse date operator (supports: 2024-01, 2024-01-15, last week, etc.)
   */
  private parseDateOperator(dateStr: string): { start?: Date; end?: Date } | null {
    const now = new Date();
    const lower = dateStr.toLowerCase();

    // Relative dates
    if (lower.includes('last week')) {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo, end: now };
    }
    if (lower.includes('last month')) {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: monthAgo, end: now };
    }
    if (lower.includes('today')) {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      return { start: today, end: now };
    }

    // YYYY-MM format
    const yearMonthMatch = dateStr.match(/^(\d{4})-(\d{2})$/);
    if (yearMonthMatch) {
      const year = parseInt(yearMonthMatch[1]);
      const month = parseInt(yearMonthMatch[2]);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      return { start, end };
    }

    // YYYY-MM-DD format
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const day = parseInt(dateMatch[3]);
      const start = new Date(year, month - 1, day, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59);
      return { start, end };
    }

    return null;
  }

  /**
   * Get recent searches
   */
  private async getRecentSearches(userId: string, limit: number): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('search_history')
        .select('query')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      return (data || []).map((r: any) => r.query);
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  /**
   * Get popular searches
   * Ranked by execution count (incremented on each run by saveSearchToHistory),
   * with recency as a tiebreaker.
   */
  private async getPopularSearches(userId: string, query: string, limit: number): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('search_history')
        .select('query')
        .eq('user_id', userId)
        .ilike('query', `%${query}%`)
        .order('count', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        return [];
      }

      return (data || []).map((r: any) => r.query);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get contact suggestions
   */
  private async getContactSuggestions(userId: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const { data } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('user_id', userId)
        .limit(10);

      return (data || []).map((c: any) => ({ id: c.id, name: c.name }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get tag suggestions
   */
  private async getTagSuggestions(userId: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('search_clipboard')
        .select('tags')
        .eq('user_id', userId)
        .not('tags', 'is', null);

      const allTags = new Set<string>();
      (data || []).forEach((item: any) => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((tag: string) => allTags.add(tag));
        }
      });

      return Array.from(allTags).slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  /**
   * Save search to history.
   * Increments `count` on existing rows so getPopularSearches can rank by usage.
   */
  async saveSearchToHistory(userId: string, query: string): Promise<void> {
    try {
      const { data: existing, error: selectError } = await supabase
        .from('search_history')
        .select('id, count')
        .eq('user_id', userId)
        .eq('query', query)
        .maybeSingle();

      if (selectError) {
        // Table might not exist - silently fail
        return;
      }

      if (existing) {
        await supabase
          .from('search_history')
          .update({
            updated_at: new Date().toISOString(),
            count: (existing.count ?? 1) + 1,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('search_history')
          .insert([{
            user_id: userId,
            query,
          }]);
      }
    } catch (error) {
      // Table might not exist - that's okay, silently fail
    }
  }

}

export const searchEnhancements = new SearchEnhancements();