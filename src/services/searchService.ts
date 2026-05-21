/**
 * Search Service
 * Full-text search for messages with filters and suggestions
 */

import { supabase } from './supabase';

// ==================== Types ====================

export interface SearchOptions {
  query: string;
  threadId?: string;
  senderIds?: string[];
  dateRange?: { start: Date; end: Date };
  hasAttachments?: boolean;
  limit?: number;
  offset?: number;
}

export interface MessageSearchResult {
  id: string;
  content: string;
  threadId: string;
  senderId: string;
  senderName: string;
  createdAt: Date;
  attachments?: any[];
  rank: number;
  highlights?: string[];
}

export interface SearchSuggestion {
  suggestion: string;
  frequency: number;
}

// ==================== Search Service ====================

class SearchService {
  /**
   * Search messages with full-text search and filters
   */
  async searchMessages(options: SearchOptions): Promise<MessageSearchResult[]> {
    const {
      query,
      threadId,
      senderIds,
      dateRange,
      hasAttachments,
      limit = 50,
      offset = 0
    } = options;

    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      // Use the database function for advanced search
      const { data, error } = await supabase.rpc('search_messages', {
        search_query: query,
        p_thread_id: threadId || null,
        p_sender_ids: senderIds || null,
        p_start_date: dateRange?.start?.toISOString() || null,
        p_end_date: dateRange?.end?.toISOString() || null,
        p_has_attachments: hasAttachments ?? null,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        console.error('Search error:', error);
        // Fallback to simple ILIKE search
        return this.fallbackSearch(options);
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        content: row.content,
        threadId: row.thread_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        createdAt: new Date(row.created_at),
        attachments: row.attachments,
        rank: row.rank,
        highlights: this.extractHighlights(row.content, query)
      }));
    } catch (error) {
      console.error('Search failed:', error);
      return this.fallbackSearch(options);
    }
  }

  /**
   * Fallback search using ILIKE when full-text search is unavailable
   */
  private async fallbackSearch(options: SearchOptions): Promise<MessageSearchResult[]> {
    const { query, threadId, senderIds, dateRange, hasAttachments, limit = 50 } = options;

    let queryBuilder = supabase
      .from('messages')
      .select('id, content, thread_id, sender_id, sender_name, created_at, attachments')
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (threadId) {
      queryBuilder = queryBuilder.eq('thread_id', threadId);
    }

    if (senderIds && senderIds.length > 0) {
      queryBuilder = queryBuilder.in('sender_id', senderIds);
    }

    if (dateRange?.start) {
      queryBuilder = queryBuilder.gte('created_at', dateRange.start.toISOString());
    }

    if (dateRange?.end) {
      queryBuilder = queryBuilder.lte('created_at', dateRange.end.toISOString());
    }

    if (hasAttachments === true) {
      queryBuilder = queryBuilder.not('attachments', 'is', null);
    } else if (hasAttachments === false) {
      queryBuilder = queryBuilder.is('attachments', null);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Fallback search error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      content: row.content,
      threadId: row.thread_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      createdAt: new Date(row.created_at),
      attachments: row.attachments,
      rank: 1,
      highlights: this.extractHighlights(row.content, query)
    }));
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSuggestions(partialQuery: string, userId: string): Promise<SearchSuggestion[]> {
    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }

    try {
      const { data, error } = await supabase.rpc('get_search_suggestions', {
        partial_query: partialQuery,
        p_user_id: userId,
        p_limit: 10
      });

      if (error) {
        console.error('Suggestions error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Extract highlighted snippets from content matching query
   */
  private extractHighlights(content: string, query: string): string[] {
    if (!content || !query) return [];

    const words = query.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
    const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    const highlights: string[] = [];

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (words.some(word => lowerSentence.includes(word))) {
        // Highlight matching words
        let highlighted = sentence;
        for (const word of words) {
          const regex = new RegExp(`(${word})`, 'gi');
          highlighted = highlighted.replace(regex, '**$1**');
        }
        highlights.push(highlighted);
        if (highlights.length >= 2) break;
      }
    }

    return highlights;
  }

  // ── Thread-message-search recents ─────────────────────────────────────
  // Local-only history specific to the in-thread message Search Panel. The
  // global Search section uses the `search_history` Supabase table; do not
  // conflate the two.

  getRecentSearches(): string[] {
    try {
      const stored = localStorage.getItem('pulse:thread-search:recents');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  saveRecentSearch(query: string): void {
    try {
      const recent = this.getRecentSearches();
      const filtered = recent.filter(q => q.toLowerCase() !== query.toLowerCase());
      filtered.unshift(query);
      const trimmed = filtered.slice(0, 10);
      localStorage.setItem('pulse:thread-search:recents', JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save recent search:', error);
    }
  }

  clearRecentSearches(): void {
    localStorage.removeItem('pulse:thread-search:recents');
  }
}

export const searchService = new SearchService();
