// Bulk Operations Service
// Handle bulk email operations efficiently

import { supabase } from './supabase';
import { labelService } from './labelService';
import { emailSyncService, EmailFolder } from './emailSyncService';
import type { CachedEmail } from './emailSyncService';

export type BulkAction = 
  | 'mark_read' 
  | 'mark_unread' 
  | 'star' 
  | 'unstar' 
  | 'archive' 
  | 'unarchive'
  | 'trash' 
  | 'delete' 
  | 'apply_label' 
  | 'remove_label' 
  | 'move_to_folder'
  | 'mark_important'
  | 'unmark_important';

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: BulkOperationError[];
  totalProcessed: number;
}

export interface BulkOperationError {
  emailId: string;
  error: string;
}

export interface BulkOperationOptions {
  action: BulkAction;
  emailIds: string[];
  params?: Record<string, any>; // For actions like apply_label
  batchSize?: number; // Process in batches for large operations
}

class BulkOperationsService {
  private readonly DEFAULT_BATCH_SIZE = 50;

  /**
   * Execute a bulk operation on multiple emails
   */
  async execute(options: BulkOperationOptions): Promise<BulkOperationResult> {
    const { action, emailIds, params = {}, batchSize = this.DEFAULT_BATCH_SIZE } = options;

    console.log(`[BulkOperationsService] Executing ${action} on ${emailIds.length} emails`);

    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: [],
      totalProcessed: 0,
    };

    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < emailIds.length; i += batchSize) {
      const batch = emailIds.slice(i, i + batchSize);
      const batchResult = await this.processBatch(action, batch, params);

      result.success += batchResult.success;
      result.failed += batchResult.failed;
      result.errors.push(...batchResult.errors);
      result.totalProcessed += batch.length;
    }

    console.log(`[BulkOperationsService] Completed: ${result.success} success, ${result.failed} failed`);

    return result;
  }

  /**
   * Process a batch of emails
   */
  private async processBatch(
    action: BulkAction,
    emailIds: string[],
    params: Record<string, any>
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: [],
      totalProcessed: emailIds.length,
    };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    try {
      switch (action) {
        case 'mark_read':
          await this.bulkMarkRead(emailIds, user.id);
          result.success = emailIds.length;
          break;

        case 'mark_unread':
          await this.bulkMarkUnread(emailIds, user.id);
          result.success = emailIds.length;
          break;

        case 'star':
          await this.bulkStar(emailIds, user.id, true);
          result.success = emailIds.length;
          break;

        case 'unstar':
          await this.bulkStar(emailIds, user.id, false);
          result.success = emailIds.length;
          break;

        case 'archive':
          await this.bulkArchive(emailIds, user.id, true);
          result.success = emailIds.length;
          break;

        case 'unarchive':
          await this.bulkArchive(emailIds, user.id, false);
          result.success = emailIds.length;
          break;

        case 'trash':
          await this.bulkTrash(emailIds, user.id);
          result.success = emailIds.length;
          break;

        case 'delete':
          await this.bulkDelete(emailIds, user.id);
          result.success = emailIds.length;
          break;

        case 'mark_important':
          await this.bulkMarkImportant(emailIds, user.id, true);
          result.success = emailIds.length;
          break;

        case 'unmark_important':
          await this.bulkMarkImportant(emailIds, user.id, false);
          result.success = emailIds.length;
          break;

        case 'apply_label':
          if (!params.labelId) {
            throw new Error('labelId parameter required for apply_label action');
          }
          const applyResult = await this.bulkApplyLabel(emailIds, params.labelId);
          result.success = applyResult.success;
          result.failed = applyResult.failed;
          break;

        case 'remove_label':
          if (!params.labelId) {
            throw new Error('labelId parameter required for remove_label action');
          }
          const removeResult = await this.bulkRemoveLabel(emailIds, params.labelId);
          result.success = removeResult.success;
          result.failed = removeResult.failed;
          break;

        case 'move_to_folder':
          if (!params.folder) {
            throw new Error('folder parameter required for move_to_folder action');
          }
          // TODO: Implement folder moving logic
          console.warn('[BulkOperationsService] move_to_folder not fully implemented');
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('[BulkOperationsService] Batch processing error:', error);
      // Mark all as failed
      result.failed = emailIds.length;
      result.success = 0;
      result.errors = emailIds.map(id => ({
        emailId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }

    return result;
  }

  /**
   * Bulk mark emails as read
   */
  private async bulkMarkRead(emailIds: string[], userId: string): Promise<void> {
    const { error } = await supabase
      .from('cached_emails')
      .update({ is_read: true })
      .eq('user_id', userId)
      .in('id', emailIds);

    if (error) {
      throw new Error(`Failed to mark emails as read: ${error.message}`);
    }
  }

  /**
   * Bulk mark emails as unread
   */
  private async bulkMarkUnread(emailIds: string[], userId: string): Promise<void> {
    const { error } = await supabase
      .from('cached_emails')
      .update({ is_read: false })
      .eq('user_id', userId)
      .in('id', emailIds);

    if (error) {
      throw new Error(`Failed to mark emails as unread: ${error.message}`);
    }
  }

  /**
   * Bulk star/unstar emails
   */
  private async bulkStar(emailIds: string[], userId: string, starred: boolean): Promise<void> {
    const { error } = await supabase
      .from('cached_emails')
      .update({ is_starred: starred })
      .eq('user_id', userId)
      .in('id', emailIds);

    if (error) {
      throw new Error(`Failed to ${starred ? 'star' : 'unstar'} emails: ${error.message}`);
    }
  }

  /**
   * Bulk archive/unarchive emails
   */
  private async bulkArchive(emailIds: string[], userId: string, archived: boolean): Promise<void> {
    const { error } = await supabase
      .from('cached_emails')
      .update({ is_archived: archived })
      .eq('user_id', userId)
      .in('id', emailIds);

    if (error) {
      throw new Error(`Failed to ${archived ? 'archive' : 'unarchive'} emails: ${error.message}`);
    }
  }

  /**
   * Bulk move emails to trash
   */
  private async bulkTrash(emailIds: string[], userId: string): Promise<void> {
    const { error } = await supabase
      .from('cached_emails')
      .update({ is_trashed: true })
      .eq('user_id', userId)
      .in('id', emailIds);

    if (error) {
      throw new Error(`Failed to trash emails: ${error.message}`);
    }
  }

  /**
   * Bulk permanently delete emails
   */
  private async bulkDelete(emailIds: string[], userId: string): Promise<void> {
    const { error } = await supabase
      .from('cached_emails')
      .delete()
      .eq('user_id', userId)
      .in('id', emailIds);

    if (error) {
      throw new Error(`Failed to delete emails: ${error.message}`);
    }
  }

  /**
   * Bulk mark emails as important
   */
  private async bulkMarkImportant(emailIds: string[], userId: string, important: boolean): Promise<void> {
    const { error } = await supabase
      .from('cached_emails')
      .update({ is_important: important })
      .eq('user_id', userId)
      .in('id', emailIds);

    if (error) {
      throw new Error(`Failed to mark emails as ${important ? 'important' : 'not important'}: ${error.message}`);
    }
  }

  /**
   * Bulk apply label to emails
   */
  private async bulkApplyLabel(emailIds: string[], labelId: string): Promise<{ success: number; failed: number }> {
    return await labelService.bulkApplyLabel(emailIds, labelId);
  }

  /**
   * Bulk remove label from emails
   */
  private async bulkRemoveLabel(emailIds: string[], labelId: string): Promise<{ success: number; failed: number }> {
    return await labelService.bulkRemoveLabel(emailIds, labelId);
  }

  /**
   * Select all emails in a folder
   */
  async selectAllInFolder(folder: EmailFolder): Promise<string[]> {
    const emails = await emailSyncService.getEmailsByFolder(folder);
    return emails.map(e => e.id);
  }

  /**
   * Select emails matching criteria
   */
  async selectByCriteria(criteria: {
    folder?: EmailFolder;
    isUnread?: boolean;
    isStarred?: boolean;
    isImportant?: boolean;
    hasLabel?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('cached_emails')
      .select('id')
      .eq('user_id', user.id);

    // Apply criteria filters
    if (criteria.isUnread !== undefined) {
      query = query.eq('is_read', !criteria.isUnread);
    }

    if (criteria.isStarred !== undefined) {
      query = query.eq('is_starred', criteria.isStarred);
    }

    if (criteria.isImportant !== undefined) {
      query = query.eq('is_important', criteria.isImportant);
    }

    if (criteria.fromDate) {
      query = query.gte('received_at', criteria.fromDate.toISOString());
    }

    if (criteria.toDate) {
      query = query.lte('received_at', criteria.toDate.toISOString());
    }

    // TODO: Add folder and label filters

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to select emails: ${error.message}`);
    }

    return (data || []).map((item: any) => item.id);
  }

  /**
   * Invert selection (select all except specified)
   */
  async invertSelection(selectedIds: string[], folder?: EmailFolder): Promise<string[]> {
    const allIds = folder 
      ? await this.selectAllInFolder(folder)
      : await this.selectByCriteria({});

    return allIds.filter(id => !selectedIds.includes(id));
  }

  /**
   * Get selection stats
   */
  async getSelectionStats(emailIds: string[]): Promise<{
    total: number;
    unread: number;
    starred: number;
    important: number;
    hasAttachments: number;
  }> {
    if (emailIds.length === 0) {
      return {
        total: 0,
        unread: 0,
        starred: 0,
        important: 0,
        hasAttachments: 0,
      };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('cached_emails')
      .select('is_read, is_starred, is_important, has_attachments')
      .eq('user_id', user.id)
      .in('id', emailIds);

    if (error) {
      throw new Error(`Failed to get selection stats: ${error.message}`);
    }

    const stats = {
      total: emailIds.length,
      unread: 0,
      starred: 0,
      important: 0,
      hasAttachments: 0,
    };

    (data || []).forEach((email: any) => {
      if (!email.is_read) stats.unread++;
      if (email.is_starred) stats.starred++;
      if (email.is_important) stats.important++;
      if (email.has_attachments) stats.hasAttachments++;
    });

    return stats;
  }

  /**
   * Preview bulk operation impact
   */
  async previewOperation(options: BulkOperationOptions): Promise<{
    affectedCount: number;
    stats: {
      total: number;
      unread: number;
      starred: number;
      important: number;
      hasAttachments: number;
    };
    estimatedTime: number; // milliseconds
  }> {
    const stats = await this.getSelectionStats(options.emailIds);
    
    // Estimate time (rough estimate: ~10ms per email)
    const estimatedTime = options.emailIds.length * 10;

    return {
      affectedCount: options.emailIds.length,
      stats,
      estimatedTime,
    };
  }

  /**
   * Undo last bulk operation (if possible)
   */
  // TODO: Implement undo functionality with operation history
  async undoLastOperation(): Promise<void> {
    console.warn('[BulkOperationsService] Undo not yet implemented');
    throw new Error('Undo functionality not yet implemented');
  }
}

// Singleton instance
export const bulkOperationsService = new BulkOperationsService();
export default bulkOperationsService;
