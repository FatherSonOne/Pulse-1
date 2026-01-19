/**
 * Real Data Service - Replaces all mock data with Supabase
 * This service provides CRUD operations for all app data types
 */

import { supabase } from './supabase';
import analyticsCollector from './analyticsCollector';
import type {
  Contact,
  CalendarEvent,
  Task,
  Thread,
  Message,
  Email,
  ArchiveItem,
  UnifiedMessage,
  Outcome
} from '../types';

// ============= DATABASE TYPES =============

export interface DBContact {
  id: string;
  user_id: string;
  name: string;
  role: string;
  company?: string;
  avatar_color: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
  case_notes?: string;
  website?: string;
  birthday?: string;
  groups?: string[];
  source: 'local' | 'google' | 'vision';
  last_synced?: string;
  created_at: string;
  updated_at: string;
}

export interface DBCalendarEvent {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  color: string;
  description?: string;
  location?: string;
  attendees?: string[];
  calendar_id: string;
  all_day: boolean;
  event_type: 'event' | 'meet' | 'reminder' | 'call' | 'deadline';
  created_at: string;
  updated_at: string;
}

export interface DBTask {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  due_date?: string;
  list_id: string;
  assignee_id?: string;
  origin_message_id?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

export interface DBThread {
  id: string;
  user_id: string;
  contact_id: string;
  contact_name: string;
  avatar_color: string;
  unread: boolean;
  pinned: boolean;
  outcome_goal?: string;
  outcome_status?: 'on_track' | 'at_risk' | 'completed' | 'blocked';
  outcome_progress?: number;
  outcome_blockers?: string[];
  created_at: string;
  updated_at: string;
}

export interface DBMessage {
  id: string;
  thread_id: string;
  sender: 'me' | 'other';
  text: string;
  timestamp: string;
  source?: 'pulse' | 'slack' | 'email' | 'sms';
  attachment_type?: 'image' | 'file' | 'audio';
  attachment_name?: string;
  attachment_url?: string;
  attachment_size?: string;
  attachment_duration?: number;
  reply_to_id?: string;
  reactions?: { emoji: string; count: number; me: boolean }[];
  status?: 'sent' | 'delivered' | 'read';
  decision_data?: string; // JSON stringified
  related_task_id?: string;
  voice_analysis?: string; // JSON stringified
  created_at: string;
}

export interface DBUnifiedMessage {
  id: string;
  user_id: string;
  source: string;
  sender_name: string;
  sender_id?: string;
  sender_email?: string;
  content: string;
  timestamp: string;
  channel_id?: string;
  channel_name?: string;
  thread_id?: string;
  is_read: boolean;
  starred: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  message_type?: 'text' | 'image' | 'file' | 'voice';
  conversation_graph_id?: string;
  tags?: string[];
  media_url?: string;
  metadata?: string; // JSON stringified
  created_at: string;
}

// ============= HELPER FUNCTIONS =============

function dbToContact(db: DBContact): Contact {
  return {
    id: db.id,
    name: db.name,
    role: db.role,
    company: db.company,
    avatarColor: db.avatar_color,
    status: db.status,
    email: db.email,
    phone: db.phone,
    address: db.address,
    notes: db.notes,
    caseNotes: db.case_notes,
    website: db.website,
    birthday: db.birthday,
    groups: db.groups || [],
    source: db.source,
    lastSynced: db.last_synced ? new Date(db.last_synced) : undefined,
  };
}

function contactToDb(contact: Partial<Contact>, userId: string): Partial<DBContact> {
  return {
    user_id: userId,
    name: contact.name,
    role: contact.role,
    company: contact.company,
    avatar_color: contact.avatarColor,
    status: contact.status,
    email: contact.email,
    phone: contact.phone,
    address: contact.address,
    notes: contact.notes,
    case_notes: contact.caseNotes,
    website: contact.website,
    birthday: contact.birthday,
    groups: contact.groups,
    source: contact.source,
    last_synced: contact.lastSynced?.toISOString(),
  };
}

function dbToEvent(db: DBCalendarEvent): CalendarEvent {
  return {
    id: db.id,
    title: db.title,
    start: new Date(db.start_time),
    end: new Date(db.end_time),
    color: db.color,
    description: db.description,
    location: db.location,
    attendees: db.attendees,
    calendarId: db.calendar_id,
    allDay: db.all_day,
    type: db.event_type,
  };
}

function eventToDb(event: Partial<CalendarEvent>, userId: string): Partial<DBCalendarEvent> {
  return {
    user_id: userId,
    title: event.title,
    start_time: event.start?.toISOString(),
    end_time: event.end?.toISOString(),
    color: event.color,
    description: event.description,
    location: event.location,
    attendees: event.attendees,
    calendar_id: event.calendarId,
    all_day: event.allDay,
    event_type: event.type,
  };
}

function dbToTask(db: DBTask): Task {
  return {
    id: db.id,
    title: db.title,
    completed: db.completed,
    dueDate: db.due_date ? new Date(db.due_date) : undefined,
    listId: db.list_id,
    assigneeId: db.assignee_id,
    originMessageId: db.origin_message_id,
    priority: db.priority,
  };
}

function taskToDb(task: Partial<Task>, userId: string): Partial<DBTask> {
  return {
    user_id: userId,
    title: task.title,
    completed: task.completed,
    due_date: task.dueDate?.toISOString(),
    list_id: task.listId,
    assignee_id: task.assigneeId,
    origin_message_id: task.originMessageId,
    priority: task.priority,
  };
}

function dbToThread(db: DBThread, messages: Message[]): Thread {
  return {
    id: db.id,
    contactId: db.contact_id,
    contactName: db.contact_name,
    avatarColor: db.avatar_color,
    messages,
    unread: db.unread,
    pinned: db.pinned,
    outcome: db.outcome_goal ? {
      goal: db.outcome_goal,
      status: db.outcome_status || 'on_track',
      progress: db.outcome_progress || 0,
      blockers: db.outcome_blockers || [],
    } : undefined,
  };
}

function dbToMessage(db: DBMessage): Message {
  return {
    id: db.id,
    sender: db.sender,
    text: db.text,
    timestamp: new Date(db.timestamp),
    source: db.source,
    attachment: db.attachment_type ? {
      type: db.attachment_type,
      name: db.attachment_name || '',
      url: db.attachment_url,
      size: db.attachment_size,
      duration: db.attachment_duration,
    } : undefined,
    replyToId: db.reply_to_id,
    reactions: db.reactions,
    status: db.status,
    decisionData: db.decision_data ? JSON.parse(db.decision_data) : undefined,
    relatedTaskId: db.related_task_id,
    voiceAnalysis: db.voice_analysis ? JSON.parse(db.voice_analysis) : undefined,
  };
}

function dbToUnifiedMessage(db: DBUnifiedMessage): UnifiedMessage {
  return {
    id: db.id,
    source: db.source as UnifiedMessage['source'],
    senderName: db.sender_name,
    senderId: db.sender_id,
    senderEmail: db.sender_email,
    text: db.content,
    content: db.content,
    timestamp: new Date(db.timestamp),
    channelId: db.channel_id,
    channelName: db.channel_name,
    threadId: db.thread_id,
    isRead: db.is_read,
    starred: db.starred,
    priority: db.priority,
    type: db.message_type,
    conversationGraphId: db.conversation_graph_id,
    tags: db.tags,
    mediaUrl: db.media_url,
    metadata: db.metadata ? JSON.parse(db.metadata) : undefined,
  };
}

// ============= DATA SERVICE CLASS =============

class DataService {
  private userId: string | null = null;

  setUserId(userId: string) {
    this.userId = userId;
    // Also persist to localStorage for consistency across sessions
    if (userId) {
      localStorage.setItem('pulse_user_id', userId);
    }
  }

  getUserId(): string {
    if (!this.userId) {
      // Try to get from local storage as fallback
      const stored = localStorage.getItem('pulse_user_id');
      if (stored) {
        this.userId = stored;
        return stored;
      }
      // Don't generate a random ID - this causes data loss
      // Return empty string and let the caller handle the auth state
      console.warn('No user ID set - user may need to log in');
      return '';
    }
    return this.userId;
  }

  // Initialize user ID from Supabase session
  async initFromSession(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        this.setUserId(session.user.id);
        return session.user.id;
      }
      // Fallback to stored ID
      const stored = localStorage.getItem('pulse_user_id');
      if (stored) {
        this.userId = stored;
        return stored;
      }
      return null;
    } catch (error) {
      console.error('Error initializing user from session:', error);
      return null;
    }
  }

  // ============= CONTACTS =============

  async getContacts(): Promise<Contact[]> {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', this.getUserId())
        .order('name');

      if (error) {
        console.error('Error fetching contacts:', error);
        return [];
      }
      return (data || []).map(dbToContact);
    } catch (err: any) {
      console.error('Error fetching contacts:', {
        message: err.message,
        details: err.toString(),
        hint: 'This may be due to network connectivity or Supabase configuration issues.',
        code: err.code || '',
      });
      return [];
    }
  }

  async getContact(id: string): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return dbToContact(data);
  }

  async createContact(contact: Omit<Contact, 'id'>): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .insert([contactToDb(contact, this.getUserId())])
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      return null;
    }
    return dbToContact(data);
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .update({ ...contactToDb(updates, this.getUserId()), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating contact:', error);
      return null;
    }
    return dbToContact(data);
  }

  async deleteContact(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting contact:', error);
      return false;
    }
    return true;
  }

  // ============= CALENDAR EVENTS =============

  async getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', this.getUserId());

    if (startDate) {
      query = query.gte('start_time', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('end_time', endDate.toISOString());
    }

    const { data, error } = await query.order('start_time');

    if (error) {
      console.error('Error fetching events:', error);
      return [];
    }
    return (data || []).map(dbToEvent);
  }

  async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent | null> {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert([eventToDb(event, this.getUserId())])
      .select()
      .single();

    if (error) {
      console.error('Error creating event:', error);
      return null;
    }
    return dbToEvent(data);
  }

  async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
    const { data, error } = await supabase
      .from('calendar_events')
      .update({ ...eventToDb(updates, this.getUserId()), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating event:', error);
      return null;
    }
    return dbToEvent(data);
  }

  async deleteEvent(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting event:', error);
      return false;
    }
    return true;
  }

  // ============= TASKS =============

  async getTasks(listId?: string): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', this.getUserId());

    if (listId) {
      query = query.eq('list_id', listId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
    return (data || []).map(dbToTask);
  }

  async createTask(task: Omit<Task, 'id'>): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskToDb(task, this.getUserId())])
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return null;
    }
    return dbToTask(data);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ ...taskToDb(updates, this.getUserId()), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return null;
    }
    return dbToTask(data);
  }

  async deleteTask(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      return false;
    }
    return true;
  }

  async toggleTaskComplete(id: string): Promise<Task | null> {
    const task = await this.getTask(id);
    if (!task) return null;
    return this.updateTask(id, { completed: !task.completed });
  }

  async getTask(id: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return dbToTask(data);
  }

  // ============= THREADS & MESSAGES =============

  async getThreads(): Promise<Thread[]> {
    const { data: threadsData, error: threadsError } = await supabase
      .from('threads')
      .select('*')
      .eq('user_id', this.getUserId())
      .order('updated_at', { ascending: false });

    if (threadsError) {
      console.error('Error fetching threads:', threadsError);
      return [];
    }

    const threads: Thread[] = [];
    for (const threadDb of threadsData || []) {
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadDb.id)
        .order('timestamp');

      const messages = (messagesData || []).map(dbToMessage);
      threads.push(dbToThread(threadDb, messages));
    }

    return threads;
  }

  async getThread(id: string): Promise<Thread | null> {
    const { data: threadData, error } = await supabase
      .from('threads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;

    const { data: messagesData } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', id)
      .order('timestamp');

    const messages = (messagesData || []).map(dbToMessage);
    return dbToThread(threadData, messages);
  }

  async createThread(thread: Omit<Thread, 'id' | 'messages'>): Promise<Thread | null> {
    const { data, error } = await supabase
      .from('threads')
      .insert([{
        user_id: this.getUserId(),
        contact_id: thread.contactId,
        contact_name: thread.contactName,
        avatar_color: thread.avatarColor,
        unread: thread.unread,
        pinned: thread.pinned,
        outcome_goal: thread.outcome?.goal,
        outcome_status: thread.outcome?.status,
        outcome_progress: thread.outcome?.progress,
        outcome_blockers: thread.outcome?.blockers,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating thread:', error);
      return null;
    }
    return dbToThread(data, []);
  }

  async addMessage(threadId: string, message: Omit<Message, 'id'>): Promise<Message | null> {
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        thread_id: threadId,
        sender: message.sender,
        text: message.text,
        timestamp: message.timestamp.toISOString(),
        source: message.source,
        attachment_type: message.attachment?.type,
        attachment_name: message.attachment?.name,
        attachment_url: message.attachment?.url,
        attachment_size: message.attachment?.size,
        attachment_duration: message.attachment?.duration,
        reply_to_id: message.replyToId,
        reactions: message.reactions,
        status: message.status,
        decision_data: message.decisionData ? JSON.stringify(message.decisionData) : null,
        related_task_id: message.relatedTaskId,
        voice_analysis: message.voiceAnalysis ? JSON.stringify(message.voiceAnalysis) : null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding message:', error);
      return null;
    }

    const newMessage = dbToMessage(data);

    // Update thread's updated_at
    await supabase
      .from('threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);

    // Track the Pulse message for analytics
    try {
      const thread = await this.getThread(threadId);
      if (thread) {
        analyticsCollector.trackMessageEvent({
          id: newMessage.id,
          channel: 'pulse',
          contactIdentifier: thread.contactId,
          contactName: thread.contactName,
          isSent: message.sender === 'me',
          timestamp: newMessage.timestamp,
          content: message.text,
          threadId: threadId,
          replyToId: message.replyToId,
          messageType: 'standard'
        }).catch(err => console.error('Analytics tracking failed:', err));
      }
    } catch (analyticsError) {
      console.error('Analytics tracking failed:', analyticsError);
    }

    return newMessage;
  }

  async markThreadRead(threadId: string): Promise<boolean> {
    const { error } = await supabase
      .from('threads')
      .update({ unread: false })
      .eq('id', threadId);

    return !error;
  }

  async toggleThreadPin(threadId: string): Promise<boolean> {
    const thread = await this.getThread(threadId);
    if (!thread) return false;

    const { error } = await supabase
      .from('threads')
      .update({ pinned: !thread.pinned })
      .eq('id', threadId);

    return !error;
  }

  async deleteThread(threadId: string): Promise<boolean> {
    // First delete all messages in the thread
    const { error: msgError } = await supabase
      .from('messages')
      .delete()
      .eq('thread_id', threadId);

    if (msgError) {
      console.error('Error deleting thread messages:', msgError);
      // Continue to try deleting the thread even if messages fail
    }

    // Then delete the thread itself
    const { error } = await supabase
      .from('threads')
      .delete()
      .eq('id', threadId);

    if (error) {
      console.error('Error deleting thread:', error);
      return false;
    }

    return true;
  }

  // ============= UNIFIED INBOX =============

  async getUnifiedMessages(filters?: {
    source?: string;
    isRead?: boolean;
    starred?: boolean;
    limit?: number;
  }): Promise<UnifiedMessage[]> {
    let query = supabase
      .from('unified_messages')
      .select('*')
      .eq('user_id', this.getUserId());

    if (filters?.source) {
      query = query.eq('source', filters.source);
    }
    if (filters?.isRead !== undefined) {
      query = query.eq('is_read', filters.isRead);
    }
    if (filters?.starred !== undefined) {
      query = query.eq('starred', filters.starred);
    }

    query = query.order('timestamp', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching unified messages:', error);
      return [];
    }
    return (data || []).map(dbToUnifiedMessage);
  }

  async createUnifiedMessage(message: Omit<UnifiedMessage, 'id'>): Promise<UnifiedMessage | null> {
    const { data, error } = await supabase
      .from('unified_messages')
      .insert([{
        user_id: this.getUserId(),
        source: message.source,
        sender_name: message.senderName,
        sender_id: message.senderId,
        sender_email: message.senderEmail,
        content: message.text || message.content || '',
        timestamp: message.timestamp.toISOString(),
        channel_id: message.channelId,
        channel_name: message.channelName,
        thread_id: message.threadId,
        is_read: message.isRead ?? false,
        starred: message.starred ?? false,
        priority: message.priority,
        message_type: message.type,
        conversation_graph_id: message.conversationGraphId,
        tags: message.tags,
        media_url: message.mediaUrl,
        metadata: message.metadata ? JSON.stringify(message.metadata) : null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating unified message:', error);
      return null;
    }
    return dbToUnifiedMessage(data);
  }

  async markMessageRead(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('unified_messages')
      .update({ is_read: true })
      .eq('id', id);

    return !error;
  }

  async toggleMessageStar(id: string): Promise<boolean> {
    const { data: existing } = await supabase
      .from('unified_messages')
      .select('starred')
      .eq('id', id)
      .single();

    if (!existing) return false;

    const { error } = await supabase
      .from('unified_messages')
      .update({ starred: !existing.starred })
      .eq('id', id);

    return !error;
  }

  async bulkMarkRead(ids: string[]): Promise<boolean> {
    const { error } = await supabase
      .from('unified_messages')
      .update({ is_read: true })
      .in('id', ids);

    return !error;
  }

  async bulkDelete(ids: string[]): Promise<boolean> {
    const { error } = await supabase
      .from('unified_messages')
      .delete()
      .in('id', ids);

    return !error;
  }

  // ============= ARCHIVES =============

  async getArchives(): Promise<ArchiveItem[]> {
    const { data, error } = await supabase
      .from('archives')
      .select('*')
      .eq('user_id', this.getUserId())
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching archives:', error);
      return [];
    }
    return (data || []).map(db => ({
      id: db.id,
      type: db.archive_type,
      title: db.title,
      content: db.content,
      date: new Date(db.date),
      tags: db.tags || [],
      relatedContactId: db.related_contact_id,
      decisionStatus: db.decision_status,
    }));
  }

  async createArchive(archive: Omit<ArchiveItem, 'id'>): Promise<ArchiveItem | null> {
    const { data, error } = await supabase
      .from('archives')
      .insert([{
        user_id: this.getUserId(),
        archive_type: archive.type,
        title: archive.title,
        content: archive.content,
        date: archive.date.toISOString(),
        tags: archive.tags,
        related_contact_id: archive.relatedContactId,
        decision_status: archive.decisionStatus,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating archive:', error);
      return null;
    }
    return {
      id: data.id,
      type: data.archive_type,
      title: data.title,
      content: data.content,
      date: new Date(data.date),
      tags: data.tags || [],
      relatedContactId: data.related_contact_id,
      decisionStatus: data.decision_status,
    };
  }

  // ============= REAL-TIME SUBSCRIPTIONS =============

  subscribeToContacts(callback: (contact: Contact) => void) {
    return supabase
      .channel('contacts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${this.getUserId()}`
        },
        (payload) => {
          if (payload.new) {
            callback(dbToContact(payload.new as DBContact));
          }
        }
      )
      .subscribe();
  }

  subscribeToMessages(threadId: string, callback: (message: Message) => void) {
    return supabase
      .channel(`messages_${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          callback(dbToMessage(payload.new as DBMessage));
        }
      )
      .subscribe();
  }

  subscribeToUnifiedInbox(callback: (message: UnifiedMessage) => void) {
    return supabase
      .channel('unified_inbox')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'unified_messages',
          filter: `user_id=eq.${this.getUserId()}`
        },
        (payload) => {
          callback(dbToUnifiedMessage(payload.new as DBUnifiedMessage));
        }
      )
      .subscribe();
  }

  // ============= PRODUCTIVITY & ANALYTICS =============

  /**
   * Get weekly productivity data from real data
   */
  async getWeeklyProductivityData(weekOffset: number = 0): Promise<{
    day: string;
    tasks: number;
    messages: number;
    meetings: number;
    date: Date;
  }[]> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() - (weekOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData: { day: string; tasks: number; messages: number; meetings: number; date: Date }[] = [];

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      // Count completed tasks for this day
      const { count: tasksCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.getUserId())
        .eq('completed', true)
        .gte('updated_at', dayStart.toISOString())
        .lt('updated_at', dayEnd.toISOString());

      // Count messages for this day
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', dayStart.toISOString())
        .lt('timestamp', dayEnd.toISOString());

      // Count meetings for this day
      const { count: meetingsCount } = await supabase
        .from('calendar_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.getUserId())
        .eq('event_type', 'meet')
        .gte('start_time', dayStart.toISOString())
        .lt('start_time', dayEnd.toISOString());

      weeklyData.push({
        day: days[i],
        tasks: tasksCount || 0,
        messages: messagesCount || 0,
        meetings: meetingsCount || 0,
        date: dayStart,
      });
    }

    return weeklyData;
  }

  /**
   * Get productivity metrics summary
   */
  async getProductivityMetrics(): Promise<{
    tasksCompleted: number;
    tasksTotal: number;
    messagesSent: number;
    messagesReceived: number;
    meetingsToday: number;
    focusTime: number;
    avgResponseTime: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Tasks completed today
    const { count: tasksCompletedToday } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', this.getUserId())
      .eq('completed', true)
      .gte('updated_at', today.toISOString());

    // Total tasks
    const { count: totalTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', this.getUserId());

    // Messages sent today
    const { count: sentMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'me')
      .gte('timestamp', today.toISOString());

    // Messages received today
    const { count: receivedMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'other')
      .gte('timestamp', today.toISOString());

    // Meetings today
    const { count: meetingsToday } = await supabase
      .from('calendar_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', this.getUserId())
      .eq('event_type', 'meet')
      .gte('start_time', today.toISOString())
      .lt('start_time', tomorrow.toISOString());

    return {
      tasksCompleted: tasksCompletedToday || 0,
      tasksTotal: totalTasks || 0,
      messagesSent: sentMessages || 0,
      messagesReceived: receivedMessages || 0,
      meetingsToday: meetingsToday || 0,
      focusTime: 180, // TODO: Implement focus session tracking
      avgResponseTime: 12, // TODO: Calculate from message timestamps
    };
  }

  /**
   * Get today's priority items
   */
  async getTodaysPriorities(): Promise<{
    type: 'task' | 'event' | 'message';
    id: string;
    title: string;
    urgency: 'urgent' | 'high' | 'medium' | 'low';
    dueTime?: Date;
    source?: string;
  }[]> {
    const priorities: {
      type: 'task' | 'event' | 'message';
      id: string;
      title: string;
      urgency: 'urgent' | 'high' | 'medium' | 'low';
      dueTime?: Date;
      source?: string;
    }[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Get urgent/high priority tasks due today or overdue
    const { data: urgentTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', this.getUserId())
      .eq('completed', false)
      .in('priority', ['urgent', 'high'])
      .lte('due_date', tomorrow.toISOString())
      .order('due_date')
      .limit(3);

    if (urgentTasks) {
      for (const task of urgentTasks) {
        priorities.push({
          type: 'task',
          id: task.id,
          title: task.title,
          urgency: task.priority || 'medium',
          dueTime: task.due_date ? new Date(task.due_date) : undefined,
        });
      }
    }

    // Get upcoming events today
    const now = new Date();
    const { data: upcomingEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', this.getUserId())
      .gte('start_time', now.toISOString())
      .lt('start_time', tomorrow.toISOString())
      .order('start_time')
      .limit(3);

    if (upcomingEvents) {
      for (const event of upcomingEvents) {
        priorities.push({
          type: 'event',
          id: event.id,
          title: event.title,
          urgency: event.event_type === 'meet' ? 'high' : 'medium',
          dueTime: new Date(event.start_time),
        });
      }
    }

    // Get unread messages
    const { data: unreadMessages } = await supabase
      .from('unified_messages')
      .select('*')
      .eq('user_id', this.getUserId())
      .eq('is_read', false)
      .order('timestamp', { ascending: false })
      .limit(2);

    if (unreadMessages) {
      for (const msg of unreadMessages) {
        priorities.push({
          type: 'message',
          id: msg.id,
          title: `Message from ${msg.sender_name}`,
          urgency: msg.priority || 'medium',
          source: msg.source,
        });
      }
    }

    // Sort by urgency and return top 5
    const urgencyOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorities
      .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
      .slice(0, 5);
  }

  /**
   * Get team members with real contact data
   */
  async getTeamMembers(): Promise<{
    id: string;
    name: string;
    avatarColor: string;
    status: 'online' | 'offline' | 'busy' | 'away';
    lastActive?: Date;
    unreadCount: number;
  }[]> {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', this.getUserId())
      .order('name')
      .limit(10);

    if (!contacts) return [];

    // Get unread message counts for each contact
    const teamMembers = [];
    for (const contact of contacts) {
      // Count unread threads for this contact
      const { count: unreadCount } = await supabase
        .from('threads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.getUserId())
        .eq('contact_id', contact.id)
        .eq('unread', true);

      teamMembers.push({
        id: contact.id,
        name: contact.name,
        avatarColor: contact.avatar_color,
        status: contact.status,
        lastActive: contact.updated_at ? new Date(contact.updated_at) : undefined,
        unreadCount: unreadCount || 0,
      });
    }

    return teamMembers;
  }

  // ============= VOXER RECORDINGS =============

  async getVoxerRecordings(): Promise<any[]> {
    const { data, error } = await supabase
      .from('voxer_recordings')
      .select('*')
      .eq('user_id', this.getUserId())
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('Error fetching voxer recordings:', error);
      return [];
    }

    return data || [];
  }

  async saveVoxerRecording(recording: {
    id?: string;
    title?: string;
    audio_url?: string;
    video_url?: string;
    duration: number;
    transcript?: string;
    contact_id?: string;
    contact_name?: string;
    is_outgoing: boolean;
    starred?: boolean;
    tags?: string[];
    analysis?: any;
    recorded_at?: string;
  }): Promise<any | null> {
    const userId = this.getUserId();
    if (!userId) return null;

    const recordingData: any = {
      user_id: userId,
      title: recording.title,
      audio_url: recording.audio_url,
      duration: recording.duration,
      transcript: recording.transcript,
      contact_id: recording.contact_id,
      contact_name: recording.contact_name,
      is_outgoing: recording.is_outgoing,
      played: false,
      starred: recording.starred || false,
      tags: recording.tags || [],
      analysis: recording.analysis || null,
      recorded_at: recording.recorded_at || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    
    // Store video_url in analysis JSON if video_url exists (since schema doesn't have video_url column)
    if (recording.video_url) {
      recordingData.analysis = {
        ...(recording.analysis || {}),
        video_url: recording.video_url,
      };
    }

    let result;
    if (recording.id) {
      // Update existing
      const { data, error } = await supabase
        .from('voxer_recordings')
        .update(recordingData)
        .eq('id', recording.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating voxer recording:', error);
        return null;
      }
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('voxer_recordings')
        .insert([recordingData])
        .select()
        .single();

      if (error) {
        console.error('Error saving voxer recording:', error);
        return null;
      }
      result = data;
    }

    // Track Voxer recording for analytics
    try {
      analyticsCollector.trackMessageEvent({
        id: result.id,
        channel: 'voxer',
        contactIdentifier: recording.contact_id || recording.contact_name || 'unknown',
        contactName: recording.contact_name,
        isSent: recording.is_outgoing,
        timestamp: new Date(recording.recorded_at || Date.now()),
        content: recording.transcript || recording.title || '[Voice Recording]',
        duration: recording.duration,
        messageType: 'standard'
      }).catch(err => console.error('Analytics tracking failed:', err));
    } catch (analyticsError) {
      console.error('Analytics tracking failed:', analyticsError);
    }

    return result;
  }

  async updateVoxerRecording(id: string, updates: {
    starred?: boolean;
    tags?: string[];
    transcript?: string;
    analysis?: any;
    played?: boolean;
    notes?: any;
  }): Promise<boolean> {
    const userId = this.getUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('voxer_recordings')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating voxer recording:', error);
      return false;
    }

    return true;
  }

  async deleteVoxerRecording(id: string): Promise<boolean> {
    const userId = this.getUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('voxer_recordings')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting voxer recording:', error);
      return false;
    }

    return true;
  }

  async uploadVoxerMedia(blob: Blob, recordingId: string, type: 'audio' | 'video'): Promise<string | null> {
    const userId = this.getUserId();
    if (!userId) return null;

    const fileExt = type === 'audio' ? 'webm' : 'mp4';
    const fileName = `${userId}/${recordingId}.${fileExt}`;
    const filePath = `voxer/${fileName}`;

    const { data, error } = await supabase.storage
      .from('voxer-media')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Error uploading voxer media:', error);
      // Try to create bucket if it doesn't exist
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('voxer-media')
      .getPublicUrl(filePath);

    return urlData?.publicUrl || null;
  }

  // ============= OUTCOMES (GOALS) =============

  async getOutcomes(): Promise<Outcome[]> {
    const { data, error } = await supabase
      .from('outcomes')
      .select('*, key_results(*)')
      .eq('user_id', this.getUserId())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching outcomes:', error);
      return [];
    }

    return (data || []).map(db => ({
      id: db.id,
      workspace_id: db.workspace_id || this.getUserId(),
      thread_id: db.thread_id,
      title: db.title,
      description: db.description,
      status: db.status,
      progress: db.progress,
      target_date: db.target_date ? new Date(db.target_date) : undefined,
      created_at: new Date(db.created_at),
      updated_at: new Date(db.updated_at),
      blockers: db.blockers || [],
      key_results: (db.key_results || []).map((kr: { id: string; outcome_id: string; title: string; current_value: number; target_value: number; unit: string }) => ({
        id: kr.id,
        outcome_id: kr.outcome_id,
        title: kr.title,
        current_value: kr.current_value,
        target_value: kr.target_value,
        unit: kr.unit,
      })),
    }));
  }

  async createOutcome(outcome: Omit<Outcome, 'id' | 'created_at' | 'updated_at'>): Promise<Outcome | null> {
    const { data, error } = await supabase
      .from('outcomes')
      .insert([{
        user_id: this.getUserId(),
        workspace_id: outcome.workspace_id,
        thread_id: outcome.thread_id,
        title: outcome.title,
        description: outcome.description,
        status: outcome.status || 'active',
        progress: outcome.progress || 0,
        target_date: outcome.target_date?.toISOString(),
        blockers: outcome.blockers,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating outcome:', error);
      return null;
    }

    return {
      id: data.id,
      workspace_id: data.workspace_id || this.getUserId(),
      title: data.title,
      description: data.description,
      status: data.status,
      progress: data.progress,
      target_date: data.target_date ? new Date(data.target_date) : undefined,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      blockers: data.blockers || [],
      key_results: [],
    };
  }

  async updateOutcome(id: string, updates: Partial<Outcome>): Promise<boolean> {
    const { error } = await supabase
      .from('outcomes')
      .update({
        title: updates.title,
        description: updates.description,
        status: updates.status,
        progress: updates.progress,
        target_date: updates.target_date?.toISOString(),
        blockers: updates.blockers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return !error;
  }

  // ============= REAL-TIME DASHBOARD SUBSCRIPTIONS =============

  subscribeToDashboardUpdates(callbacks: {
    onTaskUpdate?: (task: Task) => void;
    onEventUpdate?: (event: CalendarEvent) => void;
    onMessageUpdate?: (message: UnifiedMessage) => void;
  }) {
    const channels = [];

    if (callbacks.onTaskUpdate) {
      const taskChannel = supabase
        .channel('dashboard_tasks')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${this.getUserId()}`
        }, (payload) => {
          if (payload.new) {
            callbacks.onTaskUpdate!(dbToTask(payload.new as DBTask));
          }
        })
        .subscribe();
      channels.push(taskChannel);
    }

    if (callbacks.onEventUpdate) {
      const eventChannel = supabase
        .channel('dashboard_events')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          filter: `user_id=eq.${this.getUserId()}`
        }, (payload) => {
          if (payload.new) {
            callbacks.onEventUpdate!(dbToEvent(payload.new as DBCalendarEvent));
          }
        })
        .subscribe();
      channels.push(eventChannel);
    }

    if (callbacks.onMessageUpdate) {
      const messageChannel = supabase
        .channel('dashboard_messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'unified_messages',
          filter: `user_id=eq.${this.getUserId()}`
        }, (payload) => {
          if (payload.new) {
            callbacks.onMessageUpdate!(dbToUnifiedMessage(payload.new as DBUnifiedMessage));
          }
        })
        .subscribe();
      channels.push(messageChannel);
    }

    // Return unsubscribe function
    return () => {
      channels.forEach(channel => channel.unsubscribe());
    };
  }
}

// Export singleton instance
export const dataService = new DataService();
