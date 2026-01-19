// Email Sync Service - Gmail sync with local caching
import { supabase } from './supabase';
import { getGmailService, GmailMessage } from './gmailService';
import { settingsService } from './settingsService';

// ========================================
// TYPES
// ========================================

export interface CachedEmail {
  id: string;
  thread_id: string;
  user_id: string;
  gmail_id: string;
  from_email: string;
  from_name: string | null;
  to_emails: { email: string; name?: string }[];
  cc_emails: { email: string; name?: string }[];
  bcc_emails: { email: string; name?: string }[];
  subject: string;
  snippet: string;
  body_text: string;
  body_html: string;
  labels: string[];
  is_read: boolean;
  is_starred: boolean;
  is_important: boolean;
  is_draft: boolean;
  is_sent: boolean;
  is_archived: boolean;
  is_trashed: boolean;
  has_attachments: boolean;
  attachments: any[];
  ai_summary: string | null;
  ai_category: string | null;
  ai_priority_score: number;
  ai_action_items: string[];
  ai_sentiment: string | null;
  ai_suggested_replies: string[];
  ai_entities: Record<string, any>;
  received_at: string;
  synced_at: string;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailThread {
  id: string;
  user_id: string;
  subject: string;
  participant_emails: string[];
  participant_names: string[];
  message_count: number;
  unread_count: number;
  last_message_at: string;
  first_message_at: string;
  ai_thread_summary: string | null;
  ai_thread_status: string | null;
  created_at: string;
  updated_at: string;
  // Computed/joined
  messages?: CachedEmail[];
  latest_message?: CachedEmail;
}

export interface SyncState {
  id: string;
  user_id: string;
  history_id: string | null;
  last_full_sync_at: string | null;
  last_incremental_sync_at: string | null;
  sync_status: 'idle' | 'syncing' | 'error';
  last_error: string | null;
  error_count: number;
  total_emails_cached: number;
  total_threads_cached: number;
}

export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'important' | 'snoozed' | 'trash' | 'spam' | 'all';

export interface EmailTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  subject?: string;
  body: string;
  category?: string;
  variables?: string[];
  use_count: number;
  created_at: string;
  updated_at: string;
}

// ========================================
// EMAIL SYNC SERVICE
// ========================================

class EmailSyncService {
  private syncInProgress = false;
  private syncListeners: ((status: SyncState) => void)[] = [];
  private lastAutoArchiveCheckAt: number | null = null;

  private async applyAutoArchive(userId: string): Promise<void> {
    try {
      const days = await settingsService.get('emailAutoArchiveDays');
      if (!days || days <= 0) return;

      const now = Date.now();
      if (this.lastAutoArchiveCheckAt && now - this.lastAutoArchiveCheckAt < 5 * 60 * 1000) {
        return;
      }
      this.lastAutoArchiveCheckAt = now;

      const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('cached_emails')
        .update({ is_archived: true })
        .eq('user_id', userId)
        .eq('is_read', true)
        .eq('is_archived', false)
        .eq('is_trashed', false)
        .eq('is_draft', false)
        .eq('is_sent', false)
        .eq('is_starred', false)
        .eq('is_important', false)
        .lt('received_at', cutoff);

      if (error) {
        console.error('Auto-archive failed:', error);
      }
    } catch (error) {
      console.error('Auto-archive error:', error);
    }
  }

  // ========================================
  // SYNC METHODS
  // ========================================

  /**
   * Perform full email sync from Gmail
   */
  async fullSync(maxResults: number = 100): Promise<{ synced: number; errors: number }> {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return { synced: 0, errors: 0 };
    }

    this.syncInProgress = true;
    let syncedCount = 0;
    let errorCount = 0;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update sync state to syncing
      await this.updateSyncState(user.id, { sync_status: 'syncing' });

      // Get Gmail service
      const gmail = getGmailService();

      // Fetch messages from Gmail
      const messages = await gmail.getMessages(maxResults, 'INBOX');

      // Also fetch sent, starred, drafts
      const [sentMessages, starredMessages] = await Promise.all([
        gmail.getSentMessages(50),
        gmail.getStarredMessages(50)
      ]);

      // Combine and dedupe
      const allMessages = [...messages, ...sentMessages, ...starredMessages];
      const uniqueMessages = Array.from(
        new Map(allMessages.map(m => [m.id, m])).values()
      );

      // Cache each message
      for (const msg of uniqueMessages) {
        try {
          await this.cacheEmail(user.id, msg);
          syncedCount++;
        } catch (error) {
          console.error('Error caching email:', error);
          errorCount++;
        }
      }

      // Update sync state
      await this.updateSyncState(user.id, {
        sync_status: 'idle',
        last_full_sync_at: new Date().toISOString(),
        total_emails_cached: syncedCount,
        error_count: errorCount
      });

      return { synced: syncedCount, errors: errorCount };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await this.updateSyncState(user.id, {
          sync_status: 'error',
          last_error: errorMsg
        });
      }
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Cache a single email from Gmail UnifiedMessage format
   */
  private async cacheEmail(userId: string, msg: any): Promise<void> {
    // Extract Gmail message data from UnifiedMessage
    const gmailId = msg.metadata?.gmailMessageId || msg.id.replace('gmail-', '');
    const threadId = msg.metadata?.gmailThreadId || msg.conversationGraphId;

    // Parse sender info
    const fromEmail = msg.senderEmail || msg.senderId;
    const fromName = msg.senderName || null;

    // Parse recipient info
    const toEmails = this.parseRecipients(msg.metadata?.to || '');

    // Determine labels and flags
    const labels = msg.tags || msg.metadata?.labels || [];
    const isRead = msg.isRead ?? !labels.includes('UNREAD');
    const isStarred = msg.starred ?? labels.includes('STARRED');
    const isImportant = labels.includes('IMPORTANT');
    const isDraft = labels.includes('DRAFT');
    const isSent = labels.includes('SENT');
    const isTrashed = labels.includes('TRASH');
    const isArchived = !labels.includes('INBOX') && !isTrashed && !isDraft;

    // Extract subject and body
    const content = msg.content || '';
    const [subject, ...bodyParts] = content.split('\n\n');
    const bodyText = bodyParts.join('\n\n');

    // Ensure thread exists
    await this.ensureThread(userId, threadId, msg.metadata?.subject || subject);

    // Upsert the cached email
    const { error } = await supabase
      .from('cached_emails')
      .upsert({
        id: `${userId}-${gmailId}`,
        thread_id: threadId,
        user_id: userId,
        gmail_id: gmailId,
        from_email: fromEmail,
        from_name: fromName,
        to_emails: toEmails,
        cc_emails: [],
        bcc_emails: [],
        subject: msg.metadata?.subject || subject,
        snippet: content.substring(0, 200),
        body_text: bodyText,
        body_html: '',
        labels: labels,
        is_read: isRead,
        is_starred: isStarred,
        is_important: isImportant,
        is_draft: isDraft,
        is_sent: isSent,
        is_archived: isArchived,
        is_trashed: isTrashed,
        has_attachments: false,
        attachments: [],
        received_at: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : new Date(msg.timestamp).toISOString(),
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Error caching email:', error);
      throw error;
    }
  }

  /**
   * Ensure a thread exists in the database
   */
  private async ensureThread(userId: string, threadId: string, subject: string): Promise<void> {
    const { error } = await supabase
      .from('email_threads')
      .upsert({
        id: threadId,
        user_id: userId,
        subject: subject,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: true
      });

    if (error && error.code !== '23505') { // Ignore unique violation
      console.error('Error ensuring thread:', error);
    }
  }

  /**
   * Parse recipient string into array of email objects
   */
  private parseRecipients(recipientStr: string): { email: string; name?: string }[] {
    if (!recipientStr) return [];

    return recipientStr.split(',').map(r => {
      const match = r.trim().match(/^(.*?)\s*<(.+?)>$/) || [null, r.trim(), r.trim()];
      return {
        name: match[1]?.trim() || undefined,
        email: match[2] || r.trim()
      };
    }).filter(r => r.email);
  }

  /**
   * Update sync state for a user
   */
  private async updateSyncState(userId: string, updates: Partial<SyncState>): Promise<void> {
    const { error } = await supabase
      .from('email_sync_state')
      .upsert({
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error updating sync state:', error);
    }

    // Notify listeners
    const state = await this.getSyncState();
    if (state) {
      this.syncListeners.forEach(listener => listener(state));
    }
  }

  /**
   * Get current sync state
   */
  async getSyncState(): Promise<SyncState | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('email_sync_state')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching sync state:', error);
    }

    return data || null;
  }

  /**
   * Subscribe to sync state changes
   */
  onSyncStateChange(callback: (state: SyncState) => void): () => void {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== callback);
    };
  }

  // ========================================
  // QUERY METHODS
  // ========================================

  /**
   * Get emails by folder
   */
  async getEmailsByFolder(folder: EmailFolder, limit: number = 50, offset: number = 0): Promise<CachedEmail[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    if (folder === 'inbox' || folder === 'all') {
      await this.applyAutoArchive(user.id);
    }

    let query = supabase
      .from('cached_emails')
      .select('*')
      .eq('user_id', user.id)
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply folder filters
    switch (folder) {
      case 'inbox':
        query = query.eq('is_trashed', false).eq('is_archived', false).eq('is_draft', false).eq('is_sent', false);
        break;
      case 'sent':
        query = query.eq('is_sent', true).eq('is_trashed', false);
        break;
      case 'drafts':
        query = query.eq('is_draft', true).eq('is_trashed', false);
        break;
      case 'starred':
        query = query.eq('is_starred', true).eq('is_trashed', false);
        break;
      case 'important':
        query = query.eq('is_important', true).eq('is_trashed', false);
        break;
      case 'trash':
        query = query.eq('is_trashed', true);
        break;
      case 'spam':
        query = query.contains('labels', ['SPAM']);
        break;
      case 'all':
        query = query.eq('is_trashed', false);
        break;
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching emails:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get email threads for a folder
   */
  async getThreadsByFolder(folder: EmailFolder, limit: number = 50): Promise<EmailThread[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    if (folder === 'inbox' || folder === 'all') {
      await this.applyAutoArchive(user.id);
    }

    // Get threads with latest message
    const { data: threads, error } = await supabase
      .from('email_threads')
      .select('*')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching threads:', error);
      return [];
    }

    // For each thread, get the latest message
    const threadsWithMessages = await Promise.all(
      (threads || []).map(async (thread) => {
        const { data: messages } = await supabase
          .from('cached_emails')
          .select('*')
          .eq('thread_id', thread.id)
          .eq('user_id', user.id)
          .order('received_at', { ascending: false })
          .limit(1);

        return {
          ...thread,
          latest_message: messages?.[0] || null
        };
      })
    );

    // Filter by folder based on latest message
    return threadsWithMessages.filter(thread => {
      const msg = thread.latest_message;
      if (!msg) return false;

      switch (folder) {
        case 'inbox':
          return !msg.is_trashed && !msg.is_archived && !msg.is_draft && !msg.is_sent;
        case 'sent':
          return msg.is_sent && !msg.is_trashed;
        case 'starred':
          return msg.is_starred && !msg.is_trashed;
        case 'trash':
          return msg.is_trashed;
        default:
          return !msg.is_trashed;
      }
    });
  }

  /**
   * Get a single email by ID
   */
  async getEmail(emailId: string): Promise<CachedEmail | null> {
    const { data, error } = await supabase
      .from('cached_emails')
      .select('*')
      .eq('id', emailId)
      .single();

    if (error) {
      console.error('Error fetching email:', error);
      return null;
    }

    return data;
  }

  /**
   * Get all emails in a thread
   */
  async getThreadMessages(threadId: string): Promise<CachedEmail[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('cached_emails')
      .select('*')
      .eq('thread_id', threadId)
      .eq('user_id', user.id)
      .order('received_at', { ascending: true });

    if (error) {
      console.error('Error fetching thread messages:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get thread by ID
   */
  async getThread(threadId: string): Promise<EmailThread | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: thread, error } = await supabase
      .from('email_threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching thread:', error);
      return null;
    }

    // Get all messages in thread
    const messages = await this.getThreadMessages(threadId);

    return {
      ...thread,
      messages
    };
  }

  /**
   * Search emails
   */
  async searchEmails(query: string, limit: number = 50): Promise<CachedEmail[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('cached_emails')
      .select('*')
      .eq('user_id', user.id)
      .or(`subject.ilike.%${query}%,body_text.ilike.%${query}%,from_email.ilike.%${query}%,from_name.ilike.%${query}%`)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching emails:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get folder counts
   */
  async getFolderCounts(): Promise<Record<EmailFolder, number>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { inbox: 0, sent: 0, drafts: 0, starred: 0, important: 0, snoozed: 0, trash: 0, spam: 0, all: 0 };

    // Get counts in parallel
    const [inbox, sent, drafts, starred, trash, all] = await Promise.all([
      supabase.from('cached_emails').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_trashed', false).eq('is_archived', false).eq('is_draft', false).eq('is_sent', false),
      supabase.from('cached_emails').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_sent', true).eq('is_trashed', false),
      supabase.from('cached_emails').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_draft', true).eq('is_trashed', false),
      supabase.from('cached_emails').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_starred', true).eq('is_trashed', false),
      supabase.from('cached_emails').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_trashed', true),
      supabase.from('cached_emails').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_trashed', false)
    ]);

    return {
      inbox: inbox.count || 0,
      sent: sent.count || 0,
      drafts: drafts.count || 0,
      starred: starred.count || 0,
      important: 0, // TODO: implement
      snoozed: 0, // TODO: implement
      trash: trash.count || 0,
      spam: 0, // TODO: implement
      all: all.count || 0
    };
  }

  /**
   * Get unread count for folder
   */
  async getUnreadCount(folder: EmailFolder = 'inbox'): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    let query = supabase
      .from('cached_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    // Apply folder filter
    switch (folder) {
      case 'inbox':
        query = query.eq('is_trashed', false).eq('is_archived', false).eq('is_draft', false).eq('is_sent', false);
        break;
      default:
        query = query.eq('is_trashed', false);
    }

    const { count } = await query;
    return count || 0;
  }

  // ========================================
  // ACTION METHODS
  // ========================================

  /**
   * Mark email as read in cache and Gmail
   */
  async markAsRead(emailId: string): Promise<void> {
    const email = await this.getEmail(emailId);
    if (!email) return;

    // Update local cache
    await supabase
      .from('cached_emails')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('id', emailId);

    // Update Gmail
    try {
      const gmail = getGmailService();
      await gmail.markAsRead(email.gmail_id);
    } catch (error) {
      console.error('Error marking as read in Gmail:', error);
    }
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(emailId: string): Promise<void> {
    const email = await this.getEmail(emailId);
    if (!email) return;

    await supabase
      .from('cached_emails')
      .update({ is_read: false, updated_at: new Date().toISOString() })
      .eq('id', emailId);

    try {
      const gmail = getGmailService();
      await gmail.markAsUnread(email.gmail_id);
    } catch (error) {
      console.error('Error marking as unread in Gmail:', error);
    }
  }

  /**
   * Star/unstar email
   */
  async toggleStar(emailId: string): Promise<boolean> {
    const email = await this.getEmail(emailId);
    if (!email) return false;

    const newStarred = !email.is_starred;

    await supabase
      .from('cached_emails')
      .update({ is_starred: newStarred, updated_at: new Date().toISOString() })
      .eq('id', emailId);

    try {
      const gmail = getGmailService();
      if (newStarred) {
        await gmail.starMessage(email.gmail_id);
      } else {
        await gmail.unstarMessage(email.gmail_id);
      }
    } catch (error) {
      console.error('Error toggling star in Gmail:', error);
    }

    return newStarred;
  }

  /**
   * Archive email
   */
  async archiveEmail(emailId: string): Promise<void> {
    const email = await this.getEmail(emailId);
    if (!email) return;

    await supabase
      .from('cached_emails')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', emailId);

    try {
      const gmail = getGmailService();
      await gmail.archiveMessage(email.gmail_id);
    } catch (error) {
      console.error('Error archiving in Gmail:', error);
    }
  }

  /**
   * Move email to trash
   */
  async trashEmail(emailId: string): Promise<void> {
    const email = await this.getEmail(emailId);
    if (!email) return;

    await supabase
      .from('cached_emails')
      .update({ is_trashed: true, updated_at: new Date().toISOString() })
      .eq('id', emailId);

    try {
      const gmail = getGmailService();
      await gmail.trashMessage(email.gmail_id);
    } catch (error) {
      console.error('Error trashing in Gmail:', error);
    }
  }

  /**
   * Permanently delete email
   */
  async deleteEmail(emailId: string): Promise<void> {
    const email = await this.getEmail(emailId);
    if (!email) return;

    // Delete from cache
    await supabase
      .from('cached_emails')
      .delete()
      .eq('id', emailId);

    try {
      const gmail = getGmailService();
      await gmail.deleteMessage(email.gmail_id);
    } catch (error) {
      console.error('Error deleting in Gmail:', error);
    }
  }

  // ========================================
  // SNOOZE METHODS
  // ========================================

  /**
   * Snooze an email until a specified time
   */
  async snoozeEmail(emailId: string, snoozeUntil: Date): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const email = await this.getEmail(emailId);
    if (!email) throw new Error('Email not found');

    // Create snooze record
    const { error: snoozeError } = await supabase
      .from('snoozed_emails')
      .insert({
        user_id: user.id,
        email_id: emailId,
        gmail_id: email.gmail_id,
        snooze_until: snoozeUntil.toISOString(),
        original_labels: email.labels,
        status: 'snoozed'
      });

    if (snoozeError) throw snoozeError;

    // Archive the email locally (hide from inbox)
    await supabase
      .from('cached_emails')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', emailId);
  }

  /**
   * Get snoozed emails
   */
  async getSnoozedEmails(): Promise<{ snooze: any; email: CachedEmail }[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('snoozed_emails')
      .select(`
        *,
        email:cached_emails(*)
      `)
      .eq('user_id', user.id)
      .eq('status', 'snoozed')
      .order('snooze_until', { ascending: true });

    if (error) {
      console.error('Error fetching snoozed emails:', error);
      return [];
    }

    return (data || []).map(item => ({
      snooze: item,
      email: item.email
    }));
  }

  /**
   * Unsnooze an email (restore to inbox)
   */
  async unsnoozeEmail(snoozeId: string): Promise<void> {
    const { data: snooze, error: fetchError } = await supabase
      .from('snoozed_emails')
      .select('*, email:cached_emails(*)')
      .eq('id', snoozeId)
      .single();

    if (fetchError || !snooze) throw new Error('Snooze record not found');

    // Update snooze status
    await supabase
      .from('snoozed_emails')
      .update({
        status: 'restored',
        restored_at: new Date().toISOString()
      })
      .eq('id', snoozeId);

    // Restore email to inbox
    await supabase
      .from('cached_emails')
      .update({
        is_archived: false,
        is_read: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', snooze.email_id);
  }

  /**
   * Check and restore due snoozed emails
   */
  async checkSnoozedEmails(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const now = new Date().toISOString();

    // Get snoozed emails that are due
    const { data: dueSnoozed } = await supabase
      .from('snoozed_emails')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'snoozed')
      .lte('snooze_until', now);

    if (!dueSnoozed || dueSnoozed.length === 0) return 0;

    // Unsnooze each one
    for (const snooze of dueSnoozed) {
      await this.unsnoozeEmail(snooze.id);
    }

    return dueSnoozed.length;
  }

  /**
   * Get snoozed count
   */
  async getSnoozedCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count } = await supabase
      .from('snoozed_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'snoozed');

    return count || 0;
  }

  // ========================================
  // SCHEDULED SEND METHODS
  // ========================================

  /**
   * Schedule an email to be sent later
   */
  async scheduleEmail(params: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
    threadId?: string;
    scheduledFor: Date;
  }): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('scheduled_emails')
      .insert({
        user_id: user.id,
        to_emails: params.to,
        cc_emails: params.cc || [],
        bcc_emails: params.bcc || [],
        subject: params.subject,
        body: params.body,
        is_html: params.isHtml || false,
        thread_id: params.threadId,
        scheduled_for: params.scheduledFor.toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Get scheduled emails
   */
  async getScheduledEmails(): Promise<any[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('scheduled_emails')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('Error fetching scheduled emails:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Cancel a scheduled email
   */
  async cancelScheduledEmail(scheduleId: string): Promise<void> {
    await supabase
      .from('scheduled_emails')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId);
  }

  /**
   * Send scheduled emails that are due
   */
  async sendDueScheduledEmails(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const now = new Date().toISOString();

    // Get pending scheduled emails that are due
    const { data: dueEmails } = await supabase
      .from('scheduled_emails')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lte('scheduled_for', now);

    if (!dueEmails || dueEmails.length === 0) return 0;

    const gmail = getGmailService();
    let sentCount = 0;

    for (const scheduled of dueEmails) {
      try {
        await gmail.sendEmail({
          to: scheduled.to_emails,
          cc: scheduled.cc_emails,
          bcc: scheduled.bcc_emails,
          subject: scheduled.subject,
          body: scheduled.body,
          isHtml: scheduled.is_html,
          threadId: scheduled.thread_id
        });

        await supabase
          .from('scheduled_emails')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', scheduled.id);

        sentCount++;
      } catch (error) {
        console.error('Error sending scheduled email:', error);
        await supabase
          .from('scheduled_emails')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            retry_count: scheduled.retry_count + 1
          })
          .eq('id', scheduled.id);
      }
    }

    return sentCount;
  }

  // ========================================
  // EMAIL TEMPLATES METHODS
  // ========================================

  /**
   * Get all templates
   */
  async getTemplates(): Promise<EmailTemplate[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('use_count', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Create a new template
   */
  async createTemplate(template: {
    name: string;
    description?: string;
    subject?: string;
    body: string;
    category?: string;
  }): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Extract variables like {{name}}, {{company}}
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variableRegex.exec(template.body)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    if (template.subject) {
      while ((match = variableRegex.exec(template.subject)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }
    }

    const { data, error } = await supabase
      .from('email_templates')
      .insert({
        user_id: user.id,
        name: template.name,
        description: template.description,
        subject: template.subject,
        body: template.body,
        category: template.category,
        variables
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Update a template
   */
  async updateTemplate(templateId: string, updates: {
    name?: string;
    description?: string;
    subject?: string;
    body?: string;
    category?: string;
    is_favorite?: boolean;
  }): Promise<void> {
    const { error } = await supabase
      .from('email_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId);

    if (error) throw error;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    await supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId);
  }

  /**
   * Use a template (increment use count)
   */
  async useTemplate(templateId: string): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw error;

    // Increment use count
    await supabase
      .from('email_templates')
      .update({
        use_count: (data.use_count || 0) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', templateId);

    return data;
  }

  /**
   * Apply template variables
   */
  applyTemplateVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }
}

// Singleton instance
export const emailSyncService = new EmailSyncService();
