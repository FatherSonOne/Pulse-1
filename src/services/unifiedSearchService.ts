import { supabase } from './supabase';
import { GmailService } from './gmailService';

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

export class UnifiedSearchService {
  /**
   * Perform unified search across all data sources
   */
  async search(
    query: string,
    userId: string,
    filters?: SearchFilters,
    sort?: SearchSortOptions
  ): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const results: SearchResult[] = [];
    const searchTerm = query.toLowerCase().trim();

    // Search all sources in parallel, including Gmail if connected
    const [
      unifiedMessages,
      messages,
      emails,
      gmailEmails,
      voxes,
      tasks,
      events,
      threads,
      contacts,
      smsMessages,
      notes,
      archives
    ] = await Promise.all([
      this.searchUnifiedMessages(searchTerm, userId, filters),
      this.searchMessages(searchTerm, userId, filters),
      this.searchEmails(searchTerm, userId, filters),
      this.searchGmail(searchTerm, userId, filters).catch(err => {
        console.log('Gmail search not available:', err.message);
        return [];
      }),
      this.searchVoxes(searchTerm, userId, filters),
      this.searchTasks(searchTerm, userId, filters),
      this.searchEvents(searchTerm, userId, filters),
      this.searchThreads(searchTerm, userId, filters),
      this.searchContacts(searchTerm, userId, filters),
      this.searchSMS(searchTerm, userId, filters),
      this.searchNotes(searchTerm, userId, filters),
      this.searchArchives(searchTerm, userId, filters),
    ]);

    results.push(
      ...unifiedMessages,
      ...messages,
      ...emails,
      ...gmailEmails,
      ...voxes,
      ...tasks,
      ...events,
      ...threads,
      ...contacts,
      ...smsMessages,
      ...notes,
      ...archives
    );

    // Apply sorting
    const sortedResults = this.sortResults(results, sort || { field: 'timestamp', order: 'desc' });

    // Calculate relevance scores
    return this.calculateRelevance(sortedResults, searchTerm);
  }

  /**
   * Search unified_messages table
   */
  private async searchUnifiedMessages(
    query: string,
    userId: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    const queryParam = `%${query}%`;
    let searchQuery = supabase
      .from('unified_messages')
      .select('*')
      .eq('user_id', userId)
      .or(`content.ilike.${queryParam},sender_name.ilike.${queryParam},channel_name.ilike.${queryParam}`);

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
      .ilike('text', `%${query}%`);

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
    const queryParam = `%${query}%`;
    let searchQuery = supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .or(`subject.ilike.${queryParam},body.ilike.${queryParam},from_address.ilike.${queryParam},snippet.ilike.${queryParam}`);

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
    const queryParam = `%${query}%`;
    let searchQuery = supabase
      .from('voxer_recordings')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.${queryParam},transcript.ilike.${queryParam},contact_name.ilike.${queryParam}`);

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
    const queryParam = `%${query}%`;
    let searchQuery = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.${queryParam}`);

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
      content: `Task - ${task.completed ? 'Completed' : 'Pending'}`,
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
    const queryParam = `%${query}%`;
    let searchQuery = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.${queryParam},description.ilike.${queryParam},location.ilike.${queryParam}`);

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
      .ilike('contact_name', `%${query}%`);

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
    const queryParam = `%${query}%`;
    let searchQuery = supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .or(`name.ilike.${queryParam},email.ilike.${queryParam},company.ilike.${queryParam},notes.ilike.${queryParam}`);

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
      .ilike('text', `%${query}%`);

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
      .ilike('content', `%${query}%`);

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
    const queryParam = `%${query}%`;
    let searchQuery = supabase
      .from('archives')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.${queryParam},content.ilike.${queryParam},tags.cs.{${query}}`);

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