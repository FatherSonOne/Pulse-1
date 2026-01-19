// Email Search Service - Enhanced search with AI semantic matching
import { emailAIService } from './emailAIService';
import { emailSyncService, CachedEmail } from './emailSyncService';
import { offlineEmailStorage } from './offlineEmailStorage';
import { supabase } from './supabase';

interface SearchResult {
  email: CachedEmail;
  score: number;
  matchType: 'exact' | 'semantic' | 'fuzzy';
  highlights?: {
    field: 'subject' | 'body' | 'sender' | 'recipient';
    text: string;
    matchedText: string;
  }[];
}

interface SearchFilter {
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  isStarred?: boolean;
  isUnread?: boolean;
  dateAfter?: Date;
  dateBefore?: Date;
  folder?: string;
  labels?: string[];
}

interface ParsedQuery {
  terms: string[];
  filters: SearchFilter;
  isSemanticQuery: boolean;
}

class EmailSearchService {
  /**
   * Smart search - combines text search with AI semantic understanding
   */
  async search(
    query: string,
    options: {
      limit?: number;
      useSemanticSearch?: boolean;
      filters?: SearchFilter;
    } = {}
  ): Promise<SearchResult[]> {
    const { limit = 50, useSemanticSearch = true, filters } = options;

    // Parse the query to extract filters and terms
    const parsed = this.parseQuery(query);
    const combinedFilters = { ...parsed.filters, ...filters };

    // Get results from both text search and semantic search
    const [textResults, semanticResults] = await Promise.all([
      this.textSearch(parsed.terms.join(' '), combinedFilters, limit),
      useSemanticSearch && parsed.isSemanticQuery
        ? this.semanticSearch(query, limit)
        : Promise.resolve([])
    ]);

    // Merge and dedupe results
    const resultsMap = new Map<string, SearchResult>();

    // Text results get base score
    for (const result of textResults) {
      resultsMap.set(result.email.id, result);
    }

    // Semantic results boost scores or add new entries
    for (const result of semanticResults) {
      const existing = resultsMap.get(result.email.id);
      if (existing) {
        // Boost score if found in both
        existing.score = Math.min(100, existing.score + result.score * 0.5);
      } else {
        resultsMap.set(result.email.id, result);
      }
    }

    // Sort by score and return
    return Array.from(resultsMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Parse search query to extract filters and terms
   * Supports Gmail-like operators: from:, to:, subject:, has:attachment, is:starred, etc.
   */
  parseQuery(query: string): ParsedQuery {
    const filters: SearchFilter = {};
    const terms: string[] = [];
    let isSemanticQuery = false;

    // Regular expressions for operators
    const operatorRegex = /(\w+):([\w@.]+|"[^"]+")/g;

    // Extract operators
    let match;
    let cleanedQuery = query;

    while ((match = operatorRegex.exec(query)) !== null) {
      const [fullMatch, operator, value] = match;
      const cleanValue = value.replace(/^"(.*)"$/, '$1');

      switch (operator.toLowerCase()) {
        case 'from':
          filters.from = cleanValue;
          break;
        case 'to':
          filters.to = cleanValue;
          break;
        case 'subject':
          filters.subject = cleanValue;
          break;
        case 'has':
          if (cleanValue === 'attachment') {
            filters.hasAttachment = true;
          }
          break;
        case 'is':
          if (cleanValue === 'starred') {
            filters.isStarred = true;
          } else if (cleanValue === 'unread') {
            filters.isUnread = true;
          }
          break;
        case 'after':
          filters.dateAfter = new Date(cleanValue);
          break;
        case 'before':
          filters.dateBefore = new Date(cleanValue);
          break;
        case 'in':
        case 'folder':
          filters.folder = cleanValue;
          break;
        case 'label':
          filters.labels = filters.labels || [];
          filters.labels.push(cleanValue);
          break;
      }

      cleanedQuery = cleanedQuery.replace(fullMatch, '');
    }

    // Remaining terms
    const remainingTerms = cleanedQuery.trim().split(/\s+/).filter(t => t);
    terms.push(...remainingTerms);

    // Detect if this is a natural language / semantic query
    // E.g., "that email about budget from last month"
    const semanticIndicators = [
      'about', 'regarding', 'related to', 'similar to', 'like',
      'that email', 'the email', 'emails where', 'find emails',
      'last week', 'last month', 'yesterday', 'recently',
      'important', 'urgent', 'needs response', 'action required'
    ];

    isSemanticQuery = semanticIndicators.some(indicator =>
      query.toLowerCase().includes(indicator)
    );

    return { terms, filters, isSemanticQuery };
  }

  /**
   * Standard text search with filters
   */
  async textSearch(
    query: string,
    filters: SearchFilter,
    limit: number
  ): Promise<SearchResult[]> {
    // First try online search
    if (navigator.onLine) {
      try {
        const results = await this.onlineTextSearch(query, filters, limit);
        return results;
      } catch (error) {
        console.error('Online search failed, falling back to offline:', error);
      }
    }

    // Fallback to offline search
    return this.offlineTextSearch(query, filters, limit);
  }

  /**
   * Online text search using Supabase
   */
  private async onlineTextSearch(
    query: string,
    filters: SearchFilter,
    limit: number
  ): Promise<SearchResult[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let dbQuery = supabase
      .from('cached_emails')
      .select('*')
      .eq('user_id', user.id)
      .order('received_at', { ascending: false })
      .limit(limit);

    // Apply text search
    if (query) {
      dbQuery = dbQuery.or(
        `subject.ilike.%${query}%,body_text.ilike.%${query}%,from_email.ilike.%${query}%,from_name.ilike.%${query}%,snippet.ilike.%${query}%`
      );
    }

    // Apply filters
    if (filters.from) {
      dbQuery = dbQuery.or(`from_email.ilike.%${filters.from}%,from_name.ilike.%${filters.from}%`);
    }
    if (filters.subject) {
      dbQuery = dbQuery.ilike('subject', `%${filters.subject}%`);
    }
    if (filters.hasAttachment) {
      dbQuery = dbQuery.eq('has_attachments', true);
    }
    if (filters.isStarred) {
      dbQuery = dbQuery.eq('is_starred', true);
    }
    if (filters.isUnread) {
      dbQuery = dbQuery.eq('is_read', false);
    }
    if (filters.dateAfter) {
      dbQuery = dbQuery.gte('received_at', filters.dateAfter.toISOString());
    }
    if (filters.dateBefore) {
      dbQuery = dbQuery.lte('received_at', filters.dateBefore.toISOString());
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error('Search error:', error);
      return [];
    }

    // Convert to search results with scores
    return (data || []).map(email => ({
      email,
      score: this.calculateTextMatchScore(email, query),
      matchType: 'exact' as const,
      highlights: this.generateHighlights(email, query)
    }));
  }

  /**
   * Offline text search using IndexedDB
   */
  private async offlineTextSearch(
    query: string,
    filters: SearchFilter,
    limit: number
  ): Promise<SearchResult[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const emails = await offlineEmailStorage.searchEmails(query, user.id, limit * 2);

    // Apply additional filters
    let filtered = emails;

    if (filters.from) {
      filtered = filtered.filter(e =>
        e.from_email?.toLowerCase().includes(filters.from!.toLowerCase()) ||
        e.from_name?.toLowerCase().includes(filters.from!.toLowerCase())
      );
    }
    if (filters.hasAttachment) {
      filtered = filtered.filter(e => e.has_attachments);
    }
    if (filters.isStarred) {
      filtered = filtered.filter(e => e.is_starred);
    }
    if (filters.isUnread) {
      filtered = filtered.filter(e => !e.is_read);
    }

    return filtered.slice(0, limit).map(email => ({
      email,
      score: this.calculateTextMatchScore(email, query),
      matchType: 'exact' as const,
      highlights: this.generateHighlights(email, query)
    }));
  }

  /**
   * AI-powered semantic search for natural language queries
   */
  async semanticSearch(query: string, limit: number): Promise<SearchResult[]> {
    if (!emailAIService.isAvailable()) {
      return [];
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      // Get recent emails for semantic matching
      const recentEmails = await emailSyncService.getEmailsByFolder('all', 200);

      // Use AI to understand query intent and match emails
      const geminiApiKey = localStorage.getItem('gemini_api_key');
      if (!geminiApiKey) return [];

      // Create a summary of each email for matching
      const emailSummaries = recentEmails.slice(0, 50).map(e => ({
        id: e.id,
        from: e.from_name || e.from_email,
        subject: e.subject,
        snippet: e.snippet?.substring(0, 100),
        date: e.received_at,
        category: e.ai_category,
        priority: e.ai_priority_score,
        summary: e.ai_summary
      }));

      // Ask AI to find matching emails
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are an email search assistant. Given the user's search query and a list of emails, identify which emails best match the query.

Search Query: "${query}"

Emails:
${JSON.stringify(emailSummaries, null, 2)}

Respond with a JSON array of objects with format:
[{ "id": "email_id", "relevance": 0-100, "reason": "brief explanation" }]

Only include emails with relevance > 30. Order by relevance descending.
Maximum 10 results.
Respond with valid JSON only, no markdown.`
              }]
            }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error('Gemini API error');
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

      // Parse AI response
      const matches = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));

      // Map matches back to emails
      const results: SearchResult[] = [];
      for (const match of matches) {
        const email = recentEmails.find(e => e.id === match.id);
        if (email) {
          results.push({
            email,
            score: match.relevance,
            matchType: 'semantic'
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Semantic search error:', error);
      return [];
    }
  }

  /**
   * Calculate text match score
   */
  private calculateTextMatchScore(email: CachedEmail, query: string): number {
    if (!query) return 50;

    const queryLower = query.toLowerCase();
    let score = 0;

    // Subject match (highest weight)
    if (email.subject?.toLowerCase().includes(queryLower)) {
      score += 40;
    }

    // Sender match
    if (email.from_email?.toLowerCase().includes(queryLower) ||
        email.from_name?.toLowerCase().includes(queryLower)) {
      score += 30;
    }

    // Body/snippet match
    if (email.body_text?.toLowerCase().includes(queryLower) ||
        email.snippet?.toLowerCase().includes(queryLower)) {
      score += 20;
    }

    // Boost for unread/starred
    if (!email.is_read) score += 5;
    if (email.is_starred) score += 5;

    return Math.min(100, score);
  }

  /**
   * Generate text highlights for search results
   */
  private generateHighlights(
    email: CachedEmail,
    query: string
  ): SearchResult['highlights'] {
    if (!query) return [];

    const highlights: SearchResult['highlights'] = [];
    const queryLower = query.toLowerCase();

    // Check subject
    if (email.subject?.toLowerCase().includes(queryLower)) {
      const idx = email.subject.toLowerCase().indexOf(queryLower);
      highlights.push({
        field: 'subject',
        text: email.subject,
        matchedText: email.subject.substring(idx, idx + query.length)
      });
    }

    // Check body/snippet
    const text = email.body_text || email.snippet || '';
    if (text.toLowerCase().includes(queryLower)) {
      const idx = text.toLowerCase().indexOf(queryLower);
      const start = Math.max(0, idx - 50);
      const end = Math.min(text.length, idx + query.length + 50);
      highlights.push({
        field: 'body',
        text: `...${text.substring(start, end)}...`,
        matchedText: text.substring(idx, idx + query.length)
      });
    }

    // Check sender
    const sender = email.from_name || email.from_email || '';
    if (sender.toLowerCase().includes(queryLower)) {
      highlights.push({
        field: 'sender',
        text: sender,
        matchedText: query
      });
    }

    return highlights;
  }

  /**
   * Get search suggestions based on history and common patterns
   */
  async getSearchSuggestions(partial: string): Promise<string[]> {
    const suggestions: string[] = [];

    // Add operator suggestions
    if (partial.includes(':') === false) {
      const operators = [
        'from:', 'to:', 'subject:', 'has:attachment',
        'is:starred', 'is:unread', 'after:', 'before:', 'label:'
      ];

      for (const op of operators) {
        if (op.startsWith(partial.toLowerCase())) {
          suggestions.push(op);
        }
      }
    }

    // Add common search terms from recent emails
    if (partial.length >= 2 && navigator.onLine) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get unique sender names/emails
          const { data: senders } = await supabase
            .from('cached_emails')
            .select('from_email, from_name')
            .eq('user_id', user.id)
            .ilike('from_name', `%${partial}%`)
            .limit(5);

          if (senders) {
            for (const s of senders) {
              if (s.from_name) {
                suggestions.push(`from:${s.from_name}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error getting suggestions:', error);
      }
    }

    return suggestions.slice(0, 8);
  }
}

// Singleton instance
export const emailSearchService = new EmailSearchService();
export default emailSearchService;
