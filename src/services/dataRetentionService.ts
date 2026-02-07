/**
 * Data Retention Service
 * Manages automatic data cleanup policies and execution
 * Provides secure, user-controlled data retention with audit logging
 */

import { supabase } from './supabase';

// ================================================
// Types
// ================================================

export interface DataRetentionPolicy {
  id: string;
  user_id: string;

  // Retention periods (in days, -1 = never delete)
  emails_retention_days: number;
  calendar_retention_days: number;
  contacts_retention_days: number;
  messages_retention_days: number;

  // Policy settings
  auto_cleanup_enabled: boolean;
  cleanup_time_utc: string; // HH:MM:SS format
  last_cleanup_at: string | null;
  next_cleanup_at: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface DataCleanupLog {
  id: string;
  user_id: string;
  cleanup_type: 'emails' | 'calendar' | 'contacts' | 'messages';
  items_deleted: number;
  retention_days: number;
  status: 'completed' | 'failed' | 'partial';
  error_message?: string;
  execution_time_ms: number;
  created_at: string;
}

export interface CleanupStats {
  emails_eligible: number;
  calendar_eligible: number;
  contacts_eligible: number;
  messages_eligible: number;
  total_eligible: number;
}

export interface RetentionOption {
  value: number;
  label: string;
  description: string;
}

// ================================================
// Constants
// ================================================

export const RETENTION_OPTIONS: RetentionOption[] = [
  { value: 30, label: '30 days', description: 'Delete data older than 1 month' },
  { value: 90, label: '90 days', description: 'Delete data older than 3 months (Recommended)' },
  { value: 180, label: '180 days', description: 'Delete data older than 6 months' },
  { value: 365, label: '1 year', description: 'Delete data older than 1 year' },
  { value: 730, label: '2 years', description: 'Delete data older than 2 years' },
  { value: -1, label: 'Never', description: 'Keep data indefinitely' },
];

// ================================================
// Service Class
// ================================================

class DataRetentionService {
  /**
   * Get user's data retention policy
   */
  async getPolicy(): Promise<DataRetentionPolicy | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('data_retention_policies')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No policy exists, create default
        return this.createDefaultPolicy();
      }
      console.error('[DataRetention] Error fetching policy:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create default retention policy for user
   */
  async createDefaultPolicy(): Promise<DataRetentionPolicy> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const defaultPolicy = {
      user_id: user.id,
      emails_retention_days: 90,
      calendar_retention_days: 365,
      contacts_retention_days: -1, // Never delete contacts
      messages_retention_days: 180,
      auto_cleanup_enabled: false, // Opt-in
      cleanup_time_utc: '02:00:00', // 2 AM UTC
    };

    const { data, error } = await supabase
      .from('data_retention_policies')
      .insert(defaultPolicy)
      .select()
      .single();

    if (error) {
      console.error('[DataRetention] Error creating policy:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update retention policy
   */
  async updatePolicy(updates: Partial<DataRetentionPolicy>): Promise<DataRetentionPolicy> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('data_retention_policies')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[DataRetention] Error updating policy:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update retention period for a specific data type
   */
  async updateRetentionPeriod(
    dataType: 'emails' | 'calendar' | 'contacts' | 'messages',
    days: number
  ): Promise<void> {
    const fieldName = `${dataType}_retention_days` as keyof DataRetentionPolicy;

    await this.updatePolicy({
      [fieldName]: days,
    } as Partial<DataRetentionPolicy>);
  }

  /**
   * Enable or disable automatic cleanup
   */
  async setAutoCleanup(enabled: boolean): Promise<void> {
    await this.updatePolicy({ auto_cleanup_enabled: enabled });
  }

  /**
   * Get cleanup statistics (items eligible for deletion)
   */
  async getCleanupStats(): Promise<CleanupStats> {
    const policy = await this.getPolicy();
    if (!policy) {
      return {
        emails_eligible: 0,
        calendar_eligible: 0,
        contacts_eligible: 0,
        messages_eligible: 0,
        total_eligible: 0,
      };
    }

    // Get counts for each data type
    const stats: CleanupStats = {
      emails_eligible: await this.getEligibleCount('emails', policy.emails_retention_days),
      calendar_eligible: await this.getEligibleCount('calendar', policy.calendar_retention_days),
      contacts_eligible: await this.getEligibleCount('contacts', policy.contacts_retention_days),
      messages_eligible: await this.getEligibleCount('messages', policy.messages_retention_days),
      total_eligible: 0,
    };

    stats.total_eligible =
      stats.emails_eligible +
      stats.calendar_eligible +
      stats.contacts_eligible +
      stats.messages_eligible;

    return stats;
  }

  /**
   * Get count of items eligible for cleanup
   */
  private async getEligibleCount(
    dataType: 'emails' | 'calendar' | 'contacts' | 'messages',
    retentionDays: number
  ): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || retentionDays === -1) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      // Map data types to table names
      const tableMap: Record<string, string> = {
        emails: 'emails', // Placeholder - update with actual table
        calendar: 'events',
        contacts: 'contacts',
        messages: 'messages',
      };

      const tableName = tableMap[dataType];
      if (!tableName) return 0;

      // Try to count from the table
      // This assumes tables have created_at or similar timestamp fields
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        // Table might not exist or have different schema
        console.debug(`[DataRetention] Table ${tableName} not found or different schema`);
        return 0;
      }

      return count || 0;
    } catch (err) {
      console.debug(`[DataRetention] Error counting ${dataType}:`, err);
      return 0;
    }
  }

  /**
   * Execute cleanup for a specific data type
   * This is typically called by the Edge Function, but can be triggered manually
   */
  async executeCleanup(
    dataType: 'emails' | 'calendar' | 'contacts' | 'messages'
  ): Promise<DataCleanupLog> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const policy = await this.getPolicy();
    if (!policy) {
      throw new Error('No retention policy found');
    }

    const startTime = Date.now();
    const retentionDays = policy[`${dataType}_retention_days` as keyof DataRetentionPolicy] as number;

    // Don't cleanup if retention is -1 (never delete)
    if (retentionDays === -1) {
      return this.logCleanup(dataType, 0, retentionDays, 'completed', 0);
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deletedCount = await this.deleteOldData(dataType, cutoffDate);

      const executionTime = Date.now() - startTime;

      // Update last cleanup time
      await this.updatePolicy({
        last_cleanup_at: new Date().toISOString(),
      });

      return this.logCleanup(dataType, deletedCount, retentionDays, 'completed', executionTime);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return this.logCleanup(
        dataType,
        0,
        retentionDays,
        'failed',
        executionTime,
        errorMessage
      );
    }
  }

  /**
   * Delete old data for a specific type
   */
  private async deleteOldData(
    dataType: 'emails' | 'calendar' | 'contacts' | 'messages',
    cutoffDate: Date
  ): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const tableMap: Record<string, string> = {
      emails: 'emails',
      calendar: 'events',
      contacts: 'contacts',
      messages: 'messages',
    };

    const tableName = tableMap[dataType];

    const { data, error } = await supabase
      .from(tableName)
      .delete()
      .eq('user_id', user.id)
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error(`[DataRetention] Error deleting ${dataType}:`, error);
      throw error;
    }

    return data?.length || 0;
  }

  /**
   * Log cleanup operation
   */
  private async logCleanup(
    cleanupType: 'emails' | 'calendar' | 'contacts' | 'messages',
    itemsDeleted: number,
    retentionDays: number,
    status: 'completed' | 'failed' | 'partial',
    executionTimeMs: number,
    errorMessage?: string
  ): Promise<DataCleanupLog> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('data_cleanup_logs')
      .insert({
        user_id: user.id,
        cleanup_type: cleanupType,
        items_deleted: itemsDeleted,
        retention_days: retentionDays,
        status,
        execution_time_ms: executionTimeMs,
        error_message: errorMessage,
      })
      .select()
      .single();

    if (error) {
      console.error('[DataRetention] Error logging cleanup:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get cleanup history
   */
  async getCleanupHistory(limit: number = 50): Promise<DataCleanupLog[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('data_cleanup_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[DataRetention] Error fetching history:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Execute full cleanup (all data types)
   */
  async executeFullCleanup(): Promise<DataCleanupLog[]> {
    const dataTypes: Array<'emails' | 'calendar' | 'contacts' | 'messages'> = [
      'emails',
      'calendar',
      'contacts',
      'messages',
    ];

    const results: DataCleanupLog[] = [];

    for (const dataType of dataTypes) {
      try {
        const log = await this.executeCleanup(dataType);
        results.push(log);
      } catch (error) {
        console.error(`[DataRetention] Error cleaning ${dataType}:`, error);
      }
    }

    return results;
  }

  /**
   * Preview cleanup (without deleting)
   */
  async previewCleanup(): Promise<{
    policy: DataRetentionPolicy;
    stats: CleanupStats;
    estimatedSavings: string;
  }> {
    const policy = await this.getPolicy();
    if (!policy) {
      throw new Error('No retention policy found');
    }

    const stats = await this.getCleanupStats();

    // Rough estimate: 50KB per email, 10KB per event, 5KB per contact, 20KB per message
    const estimatedBytes =
      stats.emails_eligible * 50 * 1024 +
      stats.calendar_eligible * 10 * 1024 +
      stats.contacts_eligible * 5 * 1024 +
      stats.messages_eligible * 20 * 1024;

    const estimatedSavings = this.formatBytes(estimatedBytes);

    return {
      policy,
      stats,
      estimatedSavings,
    };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

export const dataRetentionService = new DataRetentionService();
export default dataRetentionService;
