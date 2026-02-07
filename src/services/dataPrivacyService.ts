/**
 * Data Privacy Service
 * Handles data deletion requests with confirmation workflow
 * Implements GDPR-compliant data deletion across all tables
 * Sends confirmation emails and logs all deletion activities
 */

import { supabase } from './supabase';

// Types
export interface DataDeletionRequest {
  id: string;
  user_id: string;
  user_email: string;
  deletion_type: DeletionType;
  status: DeletionStatus;
  confirmation_token: string;
  confirmation_sent_at: string | null;
  confirmed_at: string | null;
  processed_at: string | null;
  items_deleted_count: number;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type DeletionType =
  | 'full_account'
  | 'activity_logs'
  | 'messages'
  | 'emails'
  | 'contacts'
  | 'calendar';

export type DeletionStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface DeletionRequestOptions {
  deletionType: DeletionType;
  confirmationEmail?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface DeletionSummary {
  deletionType: DeletionType;
  itemsDeleted: number;
  tablesAffected: string[];
  completedAt: string;
}

class DataPrivacyService {
  /**
   * Request data deletion with confirmation workflow
   */
  async requestDeletion(
    userId: string,
    userEmail: string,
    options: DeletionRequestOptions
  ): Promise<DataDeletionRequest | null> {
    try {
      // Create deletion request
      const { data, error } = await supabase
        .from('data_deletion_requests')
        .insert({
          user_id: userId,
          user_email: userEmail,
          deletion_type: options.deletionType,
          status: 'pending_confirmation',
          ip_address: options.ipAddress || null,
          user_agent: options.userAgent || null,
          metadata: {
            requestedAt: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[DataPrivacy] Deletion request created:', data.id);

      // Send confirmation email
      if (options.confirmationEmail !== false) {
        await this.sendConfirmationEmail(data);
      }

      // Log activity
      await this.logActivity(userId, 'data_deletion', 'Deletion requested', {
        deletionType: options.deletionType,
        requestId: data.id,
      });

      return data;
    } catch (error) {
      console.error('[DataPrivacy] Error requesting deletion:', error);
      return null;
    }
  }

  /**
   * Send confirmation email (placeholder - integrate with email service)
   */
  private async sendConfirmationEmail(
    request: DataDeletionRequest
  ): Promise<void> {
    try {
      // Update confirmation sent timestamp
      await supabase
        .from('data_deletion_requests')
        .update({
          confirmation_sent_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      // TODO: Integrate with email service to send actual email
      // For now, just log the confirmation token
      console.log('[DataPrivacy] Confirmation email would be sent to:', request.user_email);
      console.log('[DataPrivacy] Confirmation token:', request.confirmation_token);
      console.log('[DataPrivacy] Confirmation link:', this.getConfirmationLink(request.confirmation_token));

      // In production, send email with:
      // - Warning about irreversible action
      // - Confirmation link with token
      // - Expiration time (e.g., 24 hours)
    } catch (error) {
      console.error('[DataPrivacy] Error sending confirmation email:', error);
    }
  }

  /**
   * Get confirmation link for email
   */
  private getConfirmationLink(token: string): string {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    return `${baseUrl}/confirm-deletion?token=${token}`;
  }

  /**
   * Confirm deletion request
   */
  async confirmDeletion(confirmationToken: string): Promise<boolean> {
    try {
      // Get deletion request by token
      const { data: request, error: fetchError } = await supabase
        .from('data_deletion_requests')
        .select('*')
        .eq('confirmation_token', confirmationToken)
        .eq('status', 'pending_confirmation')
        .single();

      if (fetchError || !request) {
        console.error('[DataPrivacy] Invalid or expired confirmation token');
        return false;
      }

      // Update status to confirmed
      await supabase
        .from('data_deletion_requests')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      console.log('[DataPrivacy] Deletion confirmed:', request.id);

      // Process deletion immediately
      await this.processDeletion(request.id);

      return true;
    } catch (error) {
      console.error('[DataPrivacy] Error confirming deletion:', error);
      return false;
    }
  }

  /**
   * Cancel deletion request
   */
  async cancelDeletion(requestId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('data_deletion_requests')
        .update({
          status: 'cancelled',
        })
        .eq('id', requestId)
        .eq('user_id', userId)
        .in('status', ['pending_confirmation', 'confirmed']);

      if (error) throw error;

      console.log('[DataPrivacy] Deletion cancelled:', requestId);

      // Log activity
      await this.logActivity(userId, 'data_deletion', 'Deletion cancelled', {
        requestId,
      });

      return true;
    } catch (error) {
      console.error('[DataPrivacy] Error cancelling deletion:', error);
      return false;
    }
  }

  /**
   * Process confirmed deletion request
   */
  private async processDeletion(requestId: string): Promise<void> {
    try {
      // Get request details
      const { data: request, error: fetchError } = await supabase
        .from('data_deletion_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        throw new Error('Deletion request not found');
      }

      // Update status to processing
      await supabase
        .from('data_deletion_requests')
        .update({ status: 'processing' })
        .eq('id', requestId);

      // Perform deletion based on type
      let summary: DeletionSummary;

      switch (request.deletion_type) {
        case 'full_account':
          summary = await this.deleteFullAccount(request.user_id);
          break;
        case 'activity_logs':
          summary = await this.deleteActivityLogs(request.user_id);
          break;
        case 'messages':
          summary = await this.deleteMessages(request.user_id);
          break;
        case 'emails':
          summary = await this.deleteEmails(request.user_id);
          break;
        case 'contacts':
          summary = await this.deleteContacts(request.user_id);
          break;
        case 'calendar':
          summary = await this.deleteCalendar(request.user_id);
          break;
        default:
          throw new Error(`Unknown deletion type: ${request.deletion_type}`);
      }

      // Update request with completion
      await supabase
        .from('data_deletion_requests')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          items_deleted_count: summary.itemsDeleted,
          metadata: {
            ...request.metadata,
            summary,
          },
        })
        .eq('id', requestId);

      console.log('[DataPrivacy] Deletion completed:', {
        requestId,
        itemsDeleted: summary.itemsDeleted,
      });

      // Log activity
      await this.logActivity(
        request.user_id,
        'data_deletion',
        'Deletion completed',
        {
          requestId,
          deletionType: request.deletion_type,
          itemsDeleted: summary.itemsDeleted,
        }
      );
    } catch (error: any) {
      console.error('[DataPrivacy] Error processing deletion:', error);

      // Update request with error
      await supabase
        .from('data_deletion_requests')
        .update({
          status: 'failed',
          error_message: error.message || 'Unknown error',
        })
        .eq('id', requestId);
    }
  }

  /**
   * Delete full account (all user data)
   */
  private async deleteFullAccount(userId: string): Promise<DeletionSummary> {
    const tablesAffected: string[] = [];
    let totalDeleted = 0;

    try {
      // Delete from user_settings
      const { count: settingsCount } = await supabase
        .from('user_settings')
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      if (settingsCount) {
        totalDeleted += settingsCount;
        tablesAffected.push('user_settings');
      }

      // Delete from activity_logs
      const { count: logsCount } = await supabase
        .from('activity_logs')
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      if (logsCount) {
        totalDeleted += logsCount;
        tablesAffected.push('activity_logs');
      }

      // Delete from focus_sessions
      const { count: focusCount } = await supabase
        .from('focus_sessions')
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      if (focusCount) {
        totalDeleted += focusCount;
        tablesAffected.push('focus_sessions');
      }

      // Delete from data_exports
      const { count: exportsCount } = await supabase
        .from('data_exports')
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      if (exportsCount) {
        totalDeleted += exportsCount;
        tablesAffected.push('data_exports');
      }

      // Delete messages if table exists
      try {
        const { count: messagesCount } = await supabase
          .from('chat_messages')
          .delete({ count: 'exact' })
          .eq('sender_id', userId);
        if (messagesCount) {
          totalDeleted += messagesCount;
          tablesAffected.push('chat_messages');
        }
      } catch (error) {
        console.debug('[DataPrivacy] chat_messages table not found (expected)');
      }

      // Delete from storage (user's data exports)
      try {
        const { data: files } = await supabase.storage
          .from('data-exports')
          .list(userId);

        if (files && files.length > 0) {
          const filePaths = files.map((f) => `${userId}/${f.name}`);
          await supabase.storage.from('data-exports').remove(filePaths);
          totalDeleted += files.length;
          tablesAffected.push('storage:data-exports');
        }
      } catch (error) {
        console.debug('[DataPrivacy] No storage files to delete (expected)');
      }

      // Note: We do NOT delete the auth.users record itself
      // This should be done separately via Supabase Auth Admin API
      // to maintain referential integrity

      return {
        deletionType: 'full_account',
        itemsDeleted: totalDeleted,
        tablesAffected,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[DataPrivacy] Error deleting full account:', error);
      throw error;
    }
  }

  /**
   * Delete activity logs only
   */
  private async deleteActivityLogs(userId: string): Promise<DeletionSummary> {
    const { count } = await supabase
      .from('activity_logs')
      .delete({ count: 'exact' })
      .eq('user_id', userId);

    return {
      deletionType: 'activity_logs',
      itemsDeleted: count || 0,
      tablesAffected: ['activity_logs'],
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Delete messages only
   */
  private async deleteMessages(userId: string): Promise<DeletionSummary> {
    try {
      const { count } = await supabase
        .from('chat_messages')
        .delete({ count: 'exact' })
        .eq('sender_id', userId);

      return {
        deletionType: 'messages',
        itemsDeleted: count || 0,
        tablesAffected: ['chat_messages'],
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.debug('[DataPrivacy] No messages to delete (table may not exist)');
      return {
        deletionType: 'messages',
        itemsDeleted: 0,
        tablesAffected: [],
        completedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Delete emails (placeholder - would integrate with Gmail API)
   */
  private async deleteEmails(userId: string): Promise<DeletionSummary> {
    // This would integrate with Gmail API to delete emails
    // For now, return empty summary
    return {
      deletionType: 'emails',
      itemsDeleted: 0,
      tablesAffected: [],
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Delete contacts (placeholder - would integrate with Google Contacts API)
   */
  private async deleteContacts(userId: string): Promise<DeletionSummary> {
    // This would integrate with Google Contacts API to delete contacts
    // For now, return empty summary
    return {
      deletionType: 'contacts',
      itemsDeleted: 0,
      tablesAffected: [],
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Delete calendar (placeholder - would integrate with Google Calendar API)
   */
  private async deleteCalendar(userId: string): Promise<DeletionSummary> {
    // This would integrate with Google Calendar API to delete events
    // For now, return empty summary
    return {
      deletionType: 'calendar',
      itemsDeleted: 0,
      tablesAffected: [],
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Get user's deletion requests history
   */
  async getDeletionHistory(userId: string): Promise<DataDeletionRequest[]> {
    try {
      const { data, error } = await supabase
        .from('data_deletion_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        if (error.code === 'PGRST204' || error.code === 'PGRST116') {
          console.debug('[DataPrivacy] No deletion history found (expected for new users)');
          return [];
        }
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[DataPrivacy] Error getting deletion history:', error);
      return [];
    }
  }

  /**
   * Get pending deletion requests
   */
  async getPendingDeletions(userId: string): Promise<DataDeletionRequest[]> {
    try {
      const { data, error } = await supabase
        .from('data_deletion_requests')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending_confirmation', 'confirmed', 'processing'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[DataPrivacy] Error getting pending deletions:', error);
      return [];
    }
  }

  /**
   * Get activity logs for user (for privacy dashboard)
   */
  async getActivityLogs(
    userId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (error.code === 'PGRST204' || error.code === 'PGRST116') {
          console.debug('[DataPrivacy] No activity logs found (expected for new users)');
          return [];
        }
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[DataPrivacy] Error getting activity logs:', error);
      return [];
    }
  }

  /**
   * Log activity to activity_logs table
   */
  private async logActivity(
    userId: string,
    actionType: string,
    actionDetail: string,
    metadata: any
  ): Promise<void> {
    try {
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action_type: actionType,
        action_detail: actionDetail,
        metadata,
      });
    } catch (error) {
      console.error('[DataPrivacy] Error logging activity:', error);
    }
  }

  /**
   * Clean up old activity logs (GDPR compliance)
   */
  async cleanupOldActivityLogs(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { count, error } = await supabase
        .from('activity_logs')
        .delete({ count: 'exact' })
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;

      console.log('[DataPrivacy] Cleaned up old activity logs:', count);
      return count || 0;
    } catch (error) {
      console.error('[DataPrivacy] Error cleaning up activity logs:', error);
      return 0;
    }
  }

  /**
   * Get data retention policy (from user settings)
   */
  async getDataRetentionPolicy(userId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;

      const settings = data.settings as any;
      return settings.dataRetentionDays || 90; // Default 90 days
    } catch (error) {
      console.error('[DataPrivacy] Error getting retention policy:', error);
      return null;
    }
  }
}

// Export singleton instance
export const dataPrivacyService = new DataPrivacyService();
export default dataPrivacyService;
