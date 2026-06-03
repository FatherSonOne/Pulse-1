// Email Sync Service - Gmail sync with local caching
import { supabase } from './supabase';
import { getGmailService, GmailMessage } from './gmailService';
import { settingsService } from './settingsService';
import { emailAIService } from './emailAIService';
import { isEmailEnabled } from '../lib/emailFeature';

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
export type EmailCategory = 'primary' | 'social' | 'promotions' | 'updates' | 'forums';

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

  /**
   * Background AI analysis of recently synced unread emails
   * Analyzes up to 10 unread emails that haven't been analyzed yet
   */
  private async backgroundAnalyzeNewEmails(userId: string): Promise<void> {
    if (!emailAIService.isAvailable()) return;

    const { data: unanalyzed } = await supabase
      .from('cached_emails')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .is('analyzed_at', null)
      .order('received_at', { ascending: false })
      .limit(10);

    if (!unanalyzed || unanalyzed.length === 0) return;

    console.log(`[EmailSync] Background analyzing ${unanalyzed.length} unread emails`);

    for (const email of unanalyzed) {
      try {
        await emailAIService.analyzeAndSave(email as CachedEmail);
        // Rate limit: 1 analysis per second to avoid API throttling
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        console.log('[EmailSync] AI analysis failed for email:', email.id, err);
        break; // Stop on first failure (likely API quota)
      }
    }
  }

  // ========================================
  // SYNC METHODS
  // ========================================

  /**
   * Perform full email sync from Gmail
   */
  async fullSync(maxResults: number = 100): Promise<{ synced: number; errors: number; categories: Record<string, number> }> {
    // Email section disabled (Settings → Features & Labs): skip the Gmail fetch
    // entirely so no background sync hits the Gmail API / token.
    if (!isEmailEnabled()) {
      return { synced: 0, errors: 0, categories: {} };
    }

    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return { synced: 0, errors: 0, categories: {} };
    }

    this.syncInProgress = true;
    let syncedCount = 0;
    let errorCount = 0;
    const categoryCounts: Record<string, number> = {
      social: 0,
      promotions: 0,
      updates: 0,
      forums: 0,
      primary: 0
    };

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update sync state to syncing
      await this.updateSyncState(user.id, { sync_status: 'syncing' });

      // Get Gmail service
      const gmail = getGmailService();
      const fetchedSyncState = await this.getSyncState();

      // Try incremental sync via historyId (much more efficient)
      if (fetchedSyncState?.history_id) {
        try {
          console.log(`[EmailSync] Attempting incremental sync from historyId ${fetchedSyncState.history_id}`);
          const historyResult = await gmail.getHistory(fetchedSyncState.history_id, 500);

          // Collect changed message IDs
          const changedIds = new Set<string>();
          for (const entry of historyResult.history) {
            entry.messagesAdded?.forEach((m) => changedIds.add(m.message.id));
            entry.labelsAdded?.forEach((m) => changedIds.add(m.message.id));
            entry.labelsRemoved?.forEach((m) => changedIds.add(m.message.id));
          }

          if (changedIds.size > 0) {
            console.log(`[EmailSync] Incremental: ${changedIds.size} changed messages`);
            // Fetch full details for changed messages and cache them
            for (const msgId of changedIds) {
              try {
                const messages = await gmail.getMessages(1, 'INBOX', `rfc822msgid:${msgId}`);
                if (messages.length > 0) {
                  await this.cacheEmail(user.id, messages[0]);
                  syncedCount++;
                }
              } catch {
                // Message may have been deleted
              }
            }
          }

          // Update historyId for next sync
          await this.updateSyncState(user.id, {
            sync_status: 'idle',
            history_id: historyResult.historyId,
            last_incremental_sync_at: new Date().toISOString(),
            last_full_sync_at: new Date().toISOString(),
            total_emails_cached: syncedCount,
            error_count: errorCount,
          });

          // Background AI analysis
          if (syncedCount > 0) {
            this.backgroundAnalyzeNewEmails(user.id).catch((err) =>
              console.log('[EmailSync] Background AI analysis skipped:', err.message)
            );
          }

          return { synced: syncedCount, errors: errorCount, categories: categoryCounts };
        } catch (historyError) {
          // historyId expired or invalid — fall through to full sync
          console.log('[EmailSync] Incremental sync failed, falling back to full sync:', historyError);
        }
      }

      // Full sync fallback — fetch by date or all recent
      let query: string | undefined = undefined;
      if (fetchedSyncState?.last_full_sync_at) {
        const lastSyncDate = new Date(fetchedSyncState.last_full_sync_at);
        lastSyncDate.setDate(lastSyncDate.getDate() - 1);
        const formattedDate = `${lastSyncDate.getFullYear()}/${String(lastSyncDate.getMonth() + 1).padStart(2, '0')}/${String(lastSyncDate.getDate()).padStart(2, '0')}`;
        query = `after:${formattedDate}`;
        console.log(`[EmailSync] Full sync: fetching emails after ${formattedDate}`);
      } else {
        console.log('[EmailSync] First sync - fetching all recent emails');
      }

      // Fetch messages from Gmail
      const messages = await gmail.getMessages(maxResults, 'INBOX', query);
      console.log(`[EmailSync] Fetched ${messages.length} inbox messages`);

      // Also fetch sent, starred
      const [sentMessages, starredMessages] = await Promise.all([
        gmail.getSentMessages(50, query),
        gmail.getStarredMessages(50, query),
      ]);

      console.log(`[EmailSync] Fetched ${sentMessages.length} sent, ${starredMessages.length} starred`);

      // Combine and dedupe
      const allMessages = [...messages, ...sentMessages, ...starredMessages];
      const uniqueMessages = Array.from(
        new Map(allMessages.map(m => [m.id, m])).values()
      );

      console.log(`[EmailSync] Total unique messages to cache: ${uniqueMessages.length}`);

      // Cache each message
      for (const msg of uniqueMessages) {
        try {
          await this.cacheEmail(user.id, msg);
          syncedCount++;

          // Track category stats
          const labels: string[] = (msg as any).tags || (msg as any).metadata?.labels || [];
          if (labels.includes('CATEGORY_SOCIAL')) categoryCounts.social++;
          else if (labels.includes('CATEGORY_PROMOTIONS')) categoryCounts.promotions++;
          else if (labels.includes('CATEGORY_UPDATES')) categoryCounts.updates++;
          else if (labels.includes('CATEGORY_FORUMS')) categoryCounts.forums++;
          else categoryCounts.primary++;

        } catch (error) {
          console.error('Error caching email:', error);
          errorCount++;
        }
      }

      console.log(`[EmailSync] Successfully cached ${syncedCount} emails, ${errorCount} errors`);

      // Get current historyId for future incremental syncs
      let historyId: string | null = null;
      try {
        const profile = await gmail.getProfile();
        // Gmail profile returns historyId as part of response
        historyId = (profile as any).historyId || null;
      } catch { /* non-critical */ }

      // Update sync state
      await this.updateSyncState(user.id, {
        sync_status: 'idle',
        last_full_sync_at: new Date().toISOString(),
        total_emails_cached: syncedCount,
        error_count: errorCount,
        ...(historyId ? { history_id: historyId } : {}),
      });

      // Background AI analysis of new unread emails (non-blocking)
      if (syncedCount > 0) {
        this.backgroundAnalyzeNewEmails(user.id).catch((err) =>
          console.log('[EmailSync] Background AI analysis skipped:', err.message)
        );
      }

      return { synced: syncedCount, errors: errorCount, categories: categoryCounts };
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
        body_html: msg.metadata?.bodyHtml || '',
        labels: labels,
        is_read: isRead,
        is_starred: isStarred,
        is_important: isImportant,
        is_draft: isDraft,
        is_sent: isSent,
        is_archived: isArchived,
        is_trashed: isTrashed,
        has_attachments: (msg.metadata?.attachments?.length || 0) > 0,
        attachments: msg.metadata?.attachments || [],
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
  async getEmailsByFolder(
    folder: EmailFolder,
    limit: number = 50,
    offset: number = 0,
    categoryFilter?: EmailCategory
  ): Promise<CachedEmail[]> {
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

        // Apply category filter for inbox
        if (categoryFilter) {
          switch (categoryFilter) {
            case 'social':
              query = query.contains('labels', '["CATEGORY_SOCIAL"]');
              break;
            case 'promotions':
              query = query.contains('labels', '["CATEGORY_PROMOTIONS"]');
              break;
            case 'updates':
              query = query.contains('labels', '["CATEGORY_UPDATES"]');
              break;
            case 'forums':
              query = query.contains('labels', '["CATEGORY_FORUMS"]');
              break;
            case 'primary':
              // Primary is complex: It's usually "not the others"
              // But Supabase doesn't support advanced "NOT contains AND NOT contains" easily in one builder chain without raw SQL or multiple filters
              // We'll approximate by filtering OUT the known tags if possible, or we might validly use 'CATEGORY_PERSONAL' if Gmail sync adds it.
              // Assuming Gmail sync adds 'CATEGORY_PERSONAL' or we rely on absence of others.
              // For now, let's try assuming absence of others is hard in simple query builder.
              // We'll rely on our service to tag 'primary' in ai_category or specific logic.
              // For robust filtering, we might need to filter client side or use a stored procedure/view.
              // Let's try to query for where labels DOES NOT contain Social/Promotions/Updates
              // Unfortunately .not('labels', 'cs', '{"CATEGORY_SOCIAL"}') etc.
              // Use JSON array syntax for JSONB column filtering
              query = query.not('labels', 'cs', '["CATEGORY_SOCIAL"]')
                .not('labels', 'cs', '["CATEGORY_PROMOTIONS"]')
                .not('labels', 'cs', '["CATEGORY_UPDATES"]')
                .not('labels', 'cs', '["CATEGORY_FORUMS"]');
              break;
          }
        }
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
        query = query.contains('labels', '["SPAM"]');
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

  /**
   * Get unread counts for specific categories
   */
  async getCategoryUnreadCounts(): Promise<Record<string, number>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { primary: 0, social: 0, promotions: 0, updates: 0 };

    const baseQuery = supabase
      .from('cached_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('is_trashed', false)
      .eq('is_archived', false)
      .eq('is_draft', false)
      .eq('is_sent', false);

    const [social, promotions, updates, forums, allInbox] = await Promise.all([
      baseQuery.contains('labels', '["CATEGORY_SOCIAL"]').then(r => r.count || 0),
      baseQuery.contains('labels', '["CATEGORY_PROMOTIONS"]').then(r => r.count || 0),
      baseQuery.contains('labels', '["CATEGORY_UPDATES"]').then(r => r.count || 0),
      baseQuery.contains('labels', '["CATEGORY_FORUMS"]').then(r => r.count || 0),
      baseQuery.then(r => r.count || 0)
    ]);

    const primary = Math.max(0, allInbox - social - promotions - updates - forums);

    return {
      primary,
      social,
      promotions,
      updates,
      forums
    };
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
