import { supabase } from './supabase';
import { GmailService } from './gmailService';
import searchQueryParser from './searchQueryParser';

/**
 * Unified Search Service
 * Searches across all data sources: messages, emails, voxes, notes, tasks, events, threads, contacts
 */

export type SearchResultType =
  | 'message'
  | 'email'
  | 'vox'
  | 'note'
  | 'task'
  | 'event'
  | 'thread'
  | 'contact'
  | 'sms'
  | 'unified_message'
  | 'archive';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  content: string;
  timestamp: Date;
  source?: string;
  sender?: string;
  senderEmail?: string;
  metadata?: Record<string, any>;
  relevance?: number;
}

export interface SearchFilters {
  types?: SearchResultType[];
  dateFrom?: Date;
  dateTo?: Date;
  sender?: string;
  source?: string;
  tags?: string[];
  contactId?: string;
  threadId?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface SearchSortOptions {
  field: 'timestamp' | 'relevance' | 'title';
  order: 'asc' | 'desc';
}

export interface SearchSourceError {
  source: string;
  error: string;
}

export class UnifiedSearchService {
  // ── In-memory result cache (30s TTL) ─────────────────────────────────────
  private searchCache = new Map<
    string,
    { results: SearchResult[]; errors: SearchSourceError[]; timestamp: number }
  >();
  private readonly CACHE_TTL_MS = 30_000;

  private getCacheKey(query: string, userId: string, filters?: SearchFilters, sort?: SearchSortOptions): string {
    return `${userId}:${query}:${JSON.stringify(filters ?? {})}:${JSON.stringify(sort ?? {})}`;
  }

  private getCached(key: string) {
    const hit = this.searchCache.get(key);
    if (hit && Date.now() - hit.timestamp < this.CACHE_TTL_MS) return hit;
    this.searchCache.delete(key);
    return null;
  }

  private setCache(key: string, data: { results: SearchResult[]; errors: SearchSourceError[] }) {
    this.searchCache.set(key, { ...data, timestamp: Date.now() });
    // Evict stale entries when cache grows large
    if (this.searchCache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.searchCache) {
        if (now - v.timestamp > this.CACHE_TTL_MS) this.searchCache.delete(k);
      }
    }
  }

  // ── Per-source 8-second timeout ───────────────────────────────────────────
  private withTimeout<T>(promise: Promise<T>, ms = 8_000): Promise<T> {
    const timer = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timer]);
  }

  // ── Per-source timing (warns on slow sources) ─────────────────────────────
  private withTiming<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    return fn().finally(() => {
      const ms = Date.now() - start;
      if (ms > 1000) console.warn(`Slow search source "${name}": ${ms}ms`);
    });
  }

  /**
   * Perform unified search across all data sources
   */
  async search(
    query: string,
    userId: string,
    filters?: SearchFilters,
    sort?: SearchSortOptions,
    onSourceComplete?: (results: SearchResult[], completedSource: string) => void
  ): Promise<{ results: SearchResult[]; errors: SearchSourceError[] }> {
    if (!query.trim()) {
      return { results: [], errors: [] };
    }

    const cacheKey = this.getCacheKey(query, userId, filters, sort);
    const cached = this.getCached(cacheKey);
    if (cached) return { results: cached.results, errors: cached.errors };

    // Parse Gmail-style operators (from:, after:, before:, etc.)
    const parsed = searchQueryParser.parse(query);
    const searchTerm = (parsed.freeText || query).toLowerCase().trim();

    // Merge parsed operator hints into filters
    const mergedFilters: SearchFilters = { ...filters };
    for (const op of parsed.operators) {
      if (op.negate) continue;
      switch (op.field) {
        case 'from':
          if (!mergedFilters.sender) mergedFilters.sender = String(op.value);
          break;
        case 'date':
          // 'after:' sets dateFrom, 'before:' sets dateTo
          if (op.operator === 'after' && !mergedFilters.dateFrom) mergedFilters.dateFrom = op.value as Date;
          if (op.operator === 'before' && !mergedFilters.dateTo)  mergedFilters.dateTo  = op.value as Date;
          break;
      }
    }

    const sources: Array<{ name: string; fn: () => Promise<SearchResult[]> }> = [
      { name: 'unified_messages', fn: () => this.withTimeout(this.withTiming('unified_messages', () => this.searchUnifiedMessages(searchTerm, userId, mergedFilters))) },
      { name: 'messages',         fn: () => this.withTimeout(this.withTiming('messages',         () => this.searchMessages(searchTerm, userId, mergedFilters))) },
      { name: 'emails',           fn: () => this.withTimeout(this.withTiming('emails',           () => this.searchEmails(searchTerm, userId, mergedFilters))) },
      { name: 'gmail',            fn: () => this.withTimeout(this.withTiming('gmail',            () => this.searchGmail(searchTerm, userId, mergedFilters))) },
      { name: 'voxes',            fn: () => this.withTimeout(this.withTiming('voxes',            () => this.searchVoxes(searchTerm, userId, mergedFilters))) },
      { name: 'tasks',            fn: () => this.withTimeout(this.withTiming('tasks',            () => this.searchTasks(searchTerm, userId, mergedFilters))) },
      { name: 'events',           fn: () => this.withTimeout(this.withTiming('events',           () => this.searchEvents(searchTerm, userId, mergedFilters))) },
      { name: 'threads',          fn: () => this.withTimeout(this.withTiming('threads',          () => this.searchThreads(searchTerm, userId, mergedFilters))) },
      { name: 'contacts',         fn: () => this.withTimeout(this.withTiming('contacts',         () => this.searchContacts(searchTerm, userId, mergedFilters))) },
      { name: 'sms',              fn: () => this.withTimeout(this.withTiming('sms',              () => this.searchSMS(searchTerm, userId, mergedFilters))) },
      { name: 'notes',            fn: () => this.withTimeout(this.withTiming('notes',            () => this.searchNotes(searchTerm, userId, mergedFilters))) },
      { name: 'archives',         fn: () => this.withTimeout(this.withTiming('archives',         () => this.searchArchives(searchTerm, userId, mergedFilters))) },
    ];

    const accumulated: SearchResult[] = [];

    const settled = await Promise.allSettled(
      sources.map(s =>
        s.fn().then(sourceResults => {
          accumulated.push(...sourceResults);
          if (onSourceComplete) {
            try {
              const deduped = this.deduplicateResults([...accumulated]);
              const sorted = this.sortResults(deduped, sort || { field: 'timestamp', order: 'desc' });
              onSourceComplete(this.calculateRelevance(sorted, searchTerm), s.name);
            } catch (callbackError) {
              console.error('Error in onSourceComplete callback:', callbackError);
            }
          }
          return sourceResults;
        })
      )
    );

    const results: SearchResult[] = [];
    const errors: SearchSourceError[] = [];

    settled.forEach((outcome, i) => {
      if (outcome.status === 'fulfilled') {
        results.push(...outcome.value);
      } else {
        errors.push({ source: sources[i].name, error: outcome.reason?.message ?? 'Unknown error' });
        console.error(`Search source "${sources[i].name}" failed:`, outcome.reason);
      }
    });

    // Apply sorting
    const sortedResults = this.sortResults(results, sort || { field: 'timestamp', order: 'desc' });

    // Calculate relevance scores
    const final = { results: this.calculateRelevance(sortedResults, searchTerm), errors };

    // Cache results (only cache if no errors, so partial results aren't stale)
    if (errors.length === 0) this.setCache(cacheKey, final);

    return final;
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    // Primary dedup: by id, keep higher relevance
    const seen = new Map<string, SearchResult>();
    for (const r of results) {
      const existing = seen.get(r.id);
      if (!existing || (r.relevance ?? 0) > (existing.relevance ?? 0)) {
        seen.set(r.id, r);
      }
    }
    // Secondary dedup: same type + same leading content, keep higher relevance
    const contentSeen = new Map<string, SearchResult>();
    for (const r of seen.values()) {
      const contentKey = `${r.type}:${r.content.slice(0, 100)}`;
      const existing = contentSeen.get(contentKey);
      if (!existing || (r.relevance ?? 0) > (existing.relevance ?? 0)) {
        contentSeen.set(contentKey, r);
      }
    }
    return Array.from(contentSeen.values());
  }

  /**
   * Search unified_messages table
   */
  private async searchUnifiedMessages(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('unified_messages')
      .select('*')
      .eq('user_id', userId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    if (filters?.dateFrom) {
      searchQuery = searchQuery.gte('timestamp', filters.dateFrom.toISOString());
    }
    if (filters?.dateTo) {
      searchQuery = searchQuery.lte('timestamp', filters.dateTo.toISOString());
    }
    if (filters?.source) {
      searchQuery = searchQuery.eq('source', filters.source);
    }
    if (filters?.sender) {
      searchQuery = searchQuery.ilike('sender_name', `%${filters.sender}%`);
    }

    const { data, error } = await searchQuery.order('timestamp', { ascending: false }).limit(100);

    if (error) {
      console.error('Error searching unified messages:', error);
      return [];
    }

    return (data || []).map((msg: any) => ({
      id: msg.id,
      type: 'unified_message' as SearchResultType,
      title: `${msg.sender_name} - ${msg.channel_name || msg.source}`,
      content: msg.content || '',
      timestamp: new Date(msg.timestamp || msg.created_at),
      source: msg.source,
      sender: msg.sender_name,
      senderEmail: msg.sender_email,
      metadata: {
        channelId: msg.channel_id,
        channelName: msg.channel_name,
        threadId: msg.thread_id,
        tags: msg.tags || [],
      },
    }));
  }

  /**
   * Search messages table (thread messages)
   */
  private async searchMessages(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('messages')
      .select('*, threads!inner(user_id, contact_name)')
      .eq('threads.user_id', userId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    if (filters?.dateFrom) {
      searchQuery = searchQuery.gte('timestamp', filters.dateFrom.toISOString());
    }
    if (filters?.dateTo) {
      searchQuery = searchQuery.lte('timestamp', filters.dateTo.toISOString());
    }
    if (filters?.threadId) {
      searchQuery = searchQuery.eq('thread_id', filters.threadId);
    }

    const { data, error } = await searchQuery.order('timestamp', { ascending: false }).limit(100);

    if (error) {
      console.error('Error searching messages:', error);
      return [];
    }

    return (data || []).map((msg: any) => ({
      id: msg.id,
      type: 'message' as SearchResultType,
      title: `Message from ${msg.threads?.contact_name || 'Unknown'}`,
      content: msg.text || '',
      timestamp: new Date(msg.timestamp || msg.created_at),
      source: msg.source || 'pulse',
      sender: msg.threads?.contact_name,
      metadata: {
        threadId: msg.thread_id,
        sender: msg.sender,
        attachmentType: msg.attachment_type,
      },
    }));
  }

  /**
   * Search emails table
   */
  private async searchEmails(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    if (filters?.dateFrom) {
      searchQuery = searchQuery.gte('date', filters.dateFrom.toISOString());
    }
    if (filters?.dateTo) {
      searchQuery = searchQuery.lte('date', filters.dateTo.toISOString());
    }
    if (filters?.sender) {
      searchQuery = searchQuery.ilike('from_address', `%${filters.sender}%`);
    }

    const { data, error } = await searchQuery.order('date', { ascending: false }).limit(100);

    if (error) {
      console.error('Error searching emails:', error);
      return [];
    }

    return (data || []).map((email: any) => ({
      id: email.id,
      type: 'email' as SearchResultType,
      title: email.subject || 'No Subject',
      content: email.body || email.snippet || '',
      timestamp: new Date(email.date || email.created_at),
      source: 'email',
      sender: email.from_address,
      senderEmail: email.from_address,
      metadata: {
        toAddresses: email.to_addresses,
        folder: email.folder,
        labels: email.labels || [],
        threadId: email.thread_id,
      },
    }));
  }

  /**
   * Search Gmail directly via Gmail API
   */
  private async searchGmail(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    try {
      // Get Gmail service instance
      const gmailService = new GmailService();
      
      // Search Gmail inbox (max 50 results)
      const gmailMessages = await gmailService.searchMessages(query, 50);
      
      return gmailMessages.map((msg) => ({
        id: `gmail-${msg.metadata?.gmailMessageId || msg.id}`,
        type: 'email' as SearchResultType,
        title: msg.metadata?.subject || 'No Subject',
        content: msg.content || '',
        timestamp: msg.timestamp,
        source: 'gmail',
        sender: msg.senderName,
        senderEmail: msg.senderEmail,
        metadata: {
          gmailMessageId: msg.metadata?.gmailMessageId,
          gmailThreadId: msg.metadata?.gmailThreadId,
          labels: msg.tags || [],
          to: msg.metadata?.to,
        },
      }));
    } catch (error: any) {
      // Gmail not connected or error - return empty array
      if (error.message?.includes('Not authenticated') || error.message?.includes('401')) {
        return [];
      }
      console.error('Error searching Gmail:', error);
      return [];
    }
  }

  /**
   * Search voxer_recordings table
   */
  private async searchVoxes(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('voxer_recordings')
      .select('*')
      .eq('user_id', userId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    if (filters?.dateFrom) {
      searchQuery = searchQuery.gte('recorded_at', filters.dateFrom.toISOString());
    }
    if (filters?.dateTo) {
      searchQuery = searchQuery.lte('recorded_at', filters.dateTo.toISOString());
    }
    if (filters?.contactId) {
      searchQuery = searchQuery.eq('contact_id', filters.contactId);
    }

    const { data, error } = await searchQuery.order('recorded_at', { ascending: false }).limit(100);

    if (error) {
      console.error('Error searching voxes:', error);
      return [];
    }

    return (data || []).map((vox: any) => ({
      id: vox.id,
      type: 'vox' as SearchResultType,
      title: vox.title || `Vox with ${vox.contact_name || 'Unknown'}`,
      content: vox.transcript || '',
      timestamp: new Date(vox.recorded_at || vox.created_at),
      source: 'voxer',
      sender: vox.contact_name,
      metadata: {
        contactId: vox.contact_id,
        duration: vox.duration,
        audioUrl: vox.audio_url,
        isOutgoing: vox.is_outgoing,
      },
    }));
  }

  /**
   * Search tasks table
   */
  private async searchTasks(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    if (filters?.dateFrom) {
      searchQuery = searchQuery.gte('created_at', filters.dateFrom.toISOString());
    }
    if (filters?.dateTo) {
      searchQuery = searchQuery.lte('created_at', filters.dateTo.toISOString());
    }
    if (filters?.priority) {
      searchQuery = searchQuery.eq('priority', filters.priority);
    }

    const { data, error } = await searchQuery.order('created_at', { ascending: false }).limit(100);

    if (error) {
      console.error('Error searching tasks:', error);
      return [];
    }

    return (data || []).map((task: any) => ({
      id: task.id,
      type: 'task' as SearchResultType,
      title: task.title,
      content: `Task — ${task.completed ? 'Completed' : 'Pending'}`,
      timestamp: new Date(task.created_at),
      metadata: {
        completed: task.completed,
        dueDate: task.due_date,
        priority: task.priority,
        listId: task.list_id,
      },
    }));
  }

  /**
   * Search calendar_events table
   */
  private async searchEvents(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    if (filters?.dateFrom) {
      searchQuery = searchQuery.gte('start_time', filters.dateFrom.toISOString());
    }
    if (filters?.dateTo) {
      searchQuery = searchQuery.lte('start_time', filters.dateTo.toISOString());
    }

    const { data, error } = await searchQuery.order('start_time', { ascending: false }).limit(100);

    if (error) {
      console.error('Error searching events:', error);
      return [];
    }

    return (data || []).map((event: any) => ({
      id: event.id,
      type: 'event' as SearchResultType,
      title: event.title,
      content: event.description || event.location || '',
      timestamp: new Date(event.start_time),
      metadata: {
        endTime: event.end_time,
        location: event.location,
        eventType: event.event_type,
        attendees: event.attendees || [],
      },
    }));
  }

  /**
   * Search threads table
   */
  private async searchThreads(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('threads')
      .select('*')
      .eq('user_id', userId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    if (filters?.contactId) {
      searchQuery = searchQuery.eq('contact_id', filters.contactId);
    }

    const { data, error } = await searchQuery.order('updated_at', { ascending: false }).limit(50);

    if (error) {
      console.error('Error searching threads:', error);
      return [];
    }

    return (data || []).map((thread: any) => ({
      id: thread.id,
      type: 'thread' as SearchResultType,
      title: `Thread with ${thread.contact_name}`,
      content: thread.outcome_goal || '',
      timestamp: new Date(thread.updated_at || thread.created_at),
      sender: thread.contact_name,
      metadata: {
        contactId: thread.contact_id,
        outcomeStatus: thread.outcome_status,
        outcomeProgress: thread.outcome_progress,
      },
    }));
  }

  /**
   * Search contacts table
   */
  private async searchContacts(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    const { data, error } = await searchQuery.limit(50);

    if (error) {
      console.error('Error searching contacts:', error);
      return [];
    }

    return (data || []).map((contact: any) => ({
      id: contact.id,
      type: 'contact' as SearchResultType,
      title: contact.name,
      content: `${contact.company || ''} ${contact.email || ''} ${contact.notes || ''}`.trim(),
      timestamp: new Date(contact.updated_at || contact.created_at),
      sender: contact.name,
      senderEmail: contact.email,
      metadata: {
        company: contact.company,
        role: contact.role,
        groups: contact.groups || [],
      },
    }));
  }

  /**
   * Search SMS messages
   */
  private async searchSMS(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('sms_messages')
      .select('*, sms_conversations!inner(user_id, contact_name, phone_number)')
      .eq('sms_conversations.user_id', userId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    if (filters?.dateFrom) {
      searchQuery = searchQuery.gte('timestamp', filters.dateFrom.toISOString());
    }
    if (filters?.dateTo) {
      searchQuery = searchQuery.lte('timestamp', filters.dateTo.toISOString());
    }

    const { data, error } = await searchQuery.order('timestamp', { ascending: false }).limit(100);

    if (error) {
      console.error('Error searching SMS:', error);
      return [];
    }

    return (data || []).map((sms: any) => ({
      id: sms.id,
      type: 'sms' as SearchResultType,
      title: `SMS from ${sms.sms_conversations?.contact_name || sms.sms_conversations?.phone_number}`,
      content: sms.text || '',
      timestamp: new Date(sms.timestamp || sms.created_at),
      source: 'sms',
      sender: sms.sms_conversations?.contact_name || sms.sms_conversations?.phone_number,
      metadata: {
        conversationId: sms.conversation_id,
        sender: sms.sender,
        status: sms.status,
      },
    }));
  }

  /**
   * Search logos_notes (team notes from CRM)
   */
  private async searchNotes(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    // Check if logos_notes table exists, if not return empty array
    let searchQuery = supabase
      .from('logos_notes')
      .select('*')
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    if (filters?.dateFrom) {
      searchQuery = searchQuery.gte('created_at', filters.dateFrom.toISOString());
    }
    if (filters?.dateTo) {
      searchQuery = searchQuery.lte('created_at', filters.dateTo.toISOString());
    }

    const { data, error } = await searchQuery.order('created_at', { ascending: false }).limit(100);

    // If table doesn't exist, just return empty array
    if (error && error.code !== 'PGRST116') {
      console.error('Error searching notes:', error);
      return [];
    }

    return (data || []).map((note: any) => ({
      id: note.id,
      type: 'note' as SearchResultType,
      title: `Note ${note.case_id ? 'on Case' : note.project_id ? 'on Project' : ''}`,
      content: note.content || '',
      timestamp: new Date(note.created_at || note.updated_at),
      source: 'logos',
      metadata: {
        caseId: note.case_id,
        projectId: note.project_id,
        contactId: note.contact_id,
        createdBy: note.created_by,
      },
    }));
  }

  /**
   * Search archives table - transcripts, meeting notes, journals, summaries, etc.
   */
  private async searchArchives(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    let searchQuery = supabase
      .from('archives')
      .select('*')
      .eq('user_id', userId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' });

    if (filters?.dateFrom) {
      searchQuery = searchQuery.gte('date', filters.dateFrom.toISOString());
    }
    if (filters?.dateTo) {
      searchQuery = searchQuery.lte('date', filters.dateTo.toISOString());
    }
    if (filters?.tags?.length) {
      searchQuery = searchQuery.overlaps('tags', filters.tags);
    }

    const { data, error } = await searchQuery.order('date', { ascending: false }).limit(100);

    if (error) {
      console.error('Error searching archives:', error);
      return [];
    }

    const typeLabels: Record<string, string> = {
      transcript: 'Transcript',
      meeting_note: 'Meeting Note',
      vox_transcript: 'Vox Transcript',
      journal: 'Journal',
      summary: 'AI Summary',
      decision_log: 'Decision Log',
      artifact: 'Artifact',
      research: 'Research',
      image: 'Image',
      video: 'Video',
      document: 'Document',
    };

    return (data || []).map((archive: any) => ({
      id: archive.id,
      type: 'archive' as SearchResultType,
      title: archive.title,
      content: archive.content || '',
      timestamp: new Date(archive.date || archive.created_at),
      source: 'archive',
      metadata: {
        archiveType: archive.archive_type,
        archiveTypeLabel: typeLabels[archive.archive_type] || archive.archive_type,
        tags: archive.tags || [],
        aiTags: archive.ai_tags || [],
        sentiment: archive.sentiment,
        starred: archive.starred,
        collectionId: archive.collection_id,
        driveFileId: archive.drive_file_id,
        relatedContactId: archive.related_contact_id,
        decisionStatus: archive.decision_status,
      },
    }));
  }

  /**
   * Sort search results
   */
  private sortResults(results: SearchResult[], sort: SearchSortOptions): SearchResult[] {
    return [...results].sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'relevance':
          comparison = (b.relevance || 0) - (a.relevance || 0);
          break;
      }

      return sort.order === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Calculate relevance scores based on query matches
   */
  private calculateRelevance(results: SearchResult[], query: string): SearchResult[] {
    const queryWords = query.toLowerCase().split(/\s+/);

    return results.map(result => {
      let score = 0;
      const titleLower = result.title.toLowerCase();
      const contentLower = result.content.toLowerCase();

      // Exact match in title = highest score
      if (titleLower.includes(query.toLowerCase())) {
        score += 100;
      }

      // Word matches in title
      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          score += 50;
        }
      });

      // Word matches in content
      queryWords.forEach(word => {
        if (contentLower.includes(word)) {
          score += 10;
        }
      });

      // Sender match
      if (result.sender?.toLowerCase().includes(query.toLowerCase())) {
        score += 30;
      }

      result.relevance = score;
      return result;
    }).sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  }
}

export const unifiedSearchService = new UnifiedSearchService();