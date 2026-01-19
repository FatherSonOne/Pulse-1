// Email Filter Service
// Automated email processing with custom rules and actions

import { supabase } from './supabase';
import { labelService } from './labelService';
import type { CachedEmail } from './emailSyncService';

export interface EmailFilter {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  execution_order: number;
  match_type: 'all' | 'any';
  conditions: FilterCondition[];
  actions: FilterAction[];
  emails_processed: number;
  last_applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FilterCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'has_attachment' | 'size' | 'label' | 'is_starred' | 'is_important';
  operator: 'contains' | 'not_contains' | 'is' | 'is_not' | 'starts_with' | 'ends_with' | 'matches_regex' | 'greater_than' | 'less_than';
  value: string | number | boolean;
}

export interface FilterAction {
  type: 'apply_label' | 'remove_label' | 'mark_read' | 'mark_unread' | 'star' | 'unstar' | 'archive' | 'trash' | 'forward' | 'mark_important' | 'categorize';
  params: Record<string, any>;
}

export interface FilterExecutionLog {
  id: string;
  filter_id: string;
  email_id: string;
  executed_at: string;
  matched: boolean;
  actions_applied: FilterAction[];
  error_message: string | null;
  execution_time_ms: number;
}

export type CreateFilterInput = Omit<EmailFilter, 'id' | 'user_id' | 'emails_processed' | 'last_applied_at' | 'created_at' | 'updated_at'>;
export type UpdateFilterInput = Partial<CreateFilterInput>;

class EmailFilterService {
  /**
   * Create a new filter
   */
  async createFilter(filter: CreateFilterInput): Promise<EmailFilter> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_filters')
      .insert({
        user_id: user.id,
        name: filter.name,
        enabled: filter.enabled,
        execution_order: filter.execution_order,
        match_type: filter.match_type,
        conditions: filter.conditions,
        actions: filter.actions,
      })
      .select()
      .single();

    if (error) {
      console.error('[EmailFilterService] Error creating filter:', error);
      throw new Error(`Failed to create filter: ${error.message}`);
    }

    console.log('[EmailFilterService] Created filter:', data.id, data.name);
    return data;
  }

  /**
   * Get all filters for current user
   */
  async getFilters(): Promise<EmailFilter[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_filters')
      .select('*')
      .eq('user_id', user.id)
      .order('execution_order', { ascending: true });

    if (error) {
      console.error('[EmailFilterService] Error fetching filters:', error);
      throw new Error(`Failed to fetch filters: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get filter by ID
   */
  async getFilter(id: string): Promise<EmailFilter | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_filters')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[EmailFilterService] Error fetching filter:', error);
      throw new Error(`Failed to fetch filter: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a filter
   */
  async updateFilter(id: string, updates: UpdateFilterInput): Promise<EmailFilter> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_filters')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[EmailFilterService] Error updating filter:', error);
      throw new Error(`Failed to update filter: ${error.message}`);
    }

    console.log('[EmailFilterService] Updated filter:', id);
    return data;
  }

  /**
   * Delete a filter
   */
  async deleteFilter(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('email_filters')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[EmailFilterService] Error deleting filter:', error);
      throw new Error(`Failed to delete filter: ${error.message}`);
    }

    console.log('[EmailFilterService] Deleted filter:', id);
  }

  /**
   * Enable/disable a filter
   */
  async toggleFilter(id: string): Promise<EmailFilter> {
    const filter = await this.getFilter(id);
    if (!filter) throw new Error('Filter not found');

    return this.updateFilter(id, { enabled: !filter.enabled });
  }

  /**
   * Evaluate a single condition against an email
   */
  private evaluateCondition(condition: FilterCondition, email: CachedEmail): boolean {
    const { field, operator, value } = condition;

    let fieldValue: any;

    // Extract field value from email
    switch (field) {
      case 'from':
        fieldValue = email.from_email.toLowerCase();
        break;
      case 'to':
        fieldValue = email.to_emails.map(t => (typeof t === 'string' ? t : t.email).toLowerCase()).join(' ');
        break;
      case 'subject':
        fieldValue = (email.subject || '').toLowerCase();
        break;
      case 'body':
        fieldValue = (email.body_text || '').toLowerCase();
        break;
      case 'has_attachment':
        fieldValue = email.has_attachments;
        break;
      case 'size':
        fieldValue = email.body_text?.length || 0; // Approximate size
        break;
      case 'is_starred':
        fieldValue = email.is_starred;
        break;
      case 'is_important':
        fieldValue = email.is_important;
        break;
      case 'label':
        // This requires async call to check labels - will handle separately
        return false; // TODO: Implement label checking
      default:
        return false;
    }

    // Evaluate operator
    switch (operator) {
      case 'contains':
        return String(fieldValue).includes(String(value).toLowerCase());
      
      case 'not_contains':
        return !String(fieldValue).includes(String(value).toLowerCase());
      
      case 'is':
        if (typeof value === 'boolean') {
          return fieldValue === value;
        }
        return String(fieldValue).toLowerCase() === String(value).toLowerCase();
      
      case 'is_not':
        if (typeof value === 'boolean') {
          return fieldValue !== value;
        }
        return String(fieldValue).toLowerCase() !== String(value).toLowerCase();
      
      case 'starts_with':
        return String(fieldValue).startsWith(String(value).toLowerCase());
      
      case 'ends_with':
        return String(fieldValue).endsWith(String(value).toLowerCase());
      
      case 'matches_regex':
        try {
          const regex = new RegExp(String(value), 'i');
          return regex.test(String(fieldValue));
        } catch (e) {
          console.error('[EmailFilterService] Invalid regex:', value);
          return false;
        }
      
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      
      case 'less_than':
        return Number(fieldValue) < Number(value);
      
      default:
        return false;
    }
  }

  /**
   * Check if an email matches a filter's conditions
   */
  private async matchesFilter(filter: EmailFilter, email: CachedEmail): Promise<boolean> {
    const results = filter.conditions.map(condition => 
      this.evaluateCondition(condition, email)
    );

    if (filter.match_type === 'all') {
      return results.every(r => r === true);
    } else {
      return results.some(r => r === true);
    }
  }

  /**
   * Execute a filter action on an email
   */
  private async executeAction(action: FilterAction, email: CachedEmail): Promise<void> {
    switch (action.type) {
      case 'apply_label':
        if (action.params.label_id) {
          await labelService.applyLabel(email.id, action.params.label_id);
        }
        break;
      
      case 'remove_label':
        if (action.params.label_id) {
          await labelService.removeLabel(email.id, action.params.label_id);
        }
        break;
      
      case 'mark_read':
        await supabase
          .from('cached_emails')
          .update({ is_read: true })
          .eq('id', email.id);
        break;
      
      case 'mark_unread':
        await supabase
          .from('cached_emails')
          .update({ is_read: false })
          .eq('id', email.id);
        break;
      
      case 'star':
        await supabase
          .from('cached_emails')
          .update({ is_starred: true })
          .eq('id', email.id);
        break;
      
      case 'unstar':
        await supabase
          .from('cached_emails')
          .update({ is_starred: false })
          .eq('id', email.id);
        break;
      
      case 'archive':
        await supabase
          .from('cached_emails')
          .update({ is_archived: true })
          .eq('id', email.id);
        break;
      
      case 'trash':
        await supabase
          .from('cached_emails')
          .update({ is_trashed: true })
          .eq('id', email.id);
        break;
      
      case 'mark_important':
        await supabase
          .from('cached_emails')
          .update({ is_important: true })
          .eq('id', email.id);
        break;
      
      case 'forward':
        // TODO: Implement forward action
        console.log('[EmailFilterService] Forward action not yet implemented');
        break;
      
      case 'categorize':
        if (action.params.category) {
          await supabase
            .from('cached_emails')
            .update({ ai_category: action.params.category })
            .eq('id', email.id);
        }
        break;
      
      default:
        console.warn('[EmailFilterService] Unknown action type:', action.type);
    }
  }

  /**
   * Apply all enabled filters to an email
   */
  async applyFilters(email: CachedEmail): Promise<{
    matched: string[];
    failed: string[];
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const filters = await this.getFilters();
    const enabledFilters = filters.filter(f => f.enabled);

    const matched: string[] = [];
    const failed: string[] = [];

    for (const filter of enabledFilters) {
      const startTime = Date.now();
      let matchResult = false;
      let actionsApplied: FilterAction[] = [];
      let errorMessage: string | null = null;

      try {
        matchResult = await this.matchesFilter(filter, email);

        if (matchResult) {
          // Execute all actions
          for (const action of filter.actions) {
            try {
              await this.executeAction(action, email);
              actionsApplied.push(action);
            } catch (actionError) {
              console.error(`[EmailFilterService] Action failed:`, action.type, actionError);
              errorMessage = actionError instanceof Error ? actionError.message : 'Unknown error';
            }
          }

          matched.push(filter.id);

          // Update filter statistics
          await supabase
            .from('email_filters')
            .update({
              emails_processed: filter.emails_processed + 1,
              last_applied_at: new Date().toISOString(),
            })
            .eq('id', filter.id);
        }
      } catch (error) {
        console.error(`[EmailFilterService] Filter evaluation failed:`, filter.id, error);
        failed.push(filter.id);
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }

      // Log execution
      const executionTime = Date.now() - startTime;
      await this.logFilterExecution({
        filter_id: filter.id,
        email_id: email.id,
        matched: matchResult,
        actions_applied: actionsApplied,
        error_message: errorMessage,
        execution_time_ms: executionTime,
      });
    }

    return { matched, failed };
  }

  /**
   * Test a filter against an email without executing actions
   */
  async testFilter(filter: EmailFilter | CreateFilterInput, email: CachedEmail): Promise<boolean> {
    // Convert CreateFilterInput to EmailFilter for testing
    const testFilter: EmailFilter = {
      ...(filter as EmailFilter),
      id: filter.id || 'test',
      user_id: '',
      emails_processed: 0,
      last_applied_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return this.matchesFilter(testFilter, email);
  }

  /**
   * Apply a filter to all existing emails (retroactive)
   */
  async applyFilterToExisting(filterId: string): Promise<{
    processed: number;
    matched: number;
    failed: number;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const filter = await this.getFilter(filterId);
    if (!filter) throw new Error('Filter not found');

    // Get all emails for user
    const { data: emails, error } = await supabase
      .from('cached_emails')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_trashed', false);

    if (error) {
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }

    let processed = 0;
    let matched = 0;
    let failed = 0;

    for (const email of emails || []) {
      processed++;
      
      try {
        const matches = await this.matchesFilter(filter, email);
        
        if (matches) {
          // Execute actions
          for (const action of filter.actions) {
            try {
              await this.executeAction(action, email);
            } catch (e) {
              console.error('[EmailFilterService] Action execution failed:', e);
              failed++;
            }
          }
          matched++;
        }
      } catch (e) {
        console.error('[EmailFilterService] Filter evaluation failed:', e);
        failed++;
      }
    }

    // Update filter statistics
    await supabase
      .from('email_filters')
      .update({
        emails_processed: filter.emails_processed + matched,
        last_applied_at: new Date().toISOString(),
      })
      .eq('id', filterId);

    console.log(`[EmailFilterService] Applied filter ${filterId} to existing emails:`, {
      processed,
      matched,
      failed,
    });

    return { processed, matched, failed };
  }

  /**
   * Log filter execution for debugging and analytics
   */
  private async logFilterExecution(log: Omit<FilterExecutionLog, 'id' | 'executed_at'>): Promise<void> {
    try {
      await supabase
        .from('filter_execution_log')
        .insert({
          filter_id: log.filter_id,
          email_id: log.email_id,
          matched: log.matched,
          actions_applied: log.actions_applied,
          error_message: log.error_message,
          execution_time_ms: log.execution_time_ms,
        });
    } catch (error) {
      console.error('[EmailFilterService] Failed to log execution:', error);
    }
  }

  /**
   * Get execution logs for a filter
   */
  async getFilterLogs(filterId: string, limit: number = 100): Promise<FilterExecutionLog[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify filter belongs to user
    const filter = await this.getFilter(filterId);
    if (!filter) throw new Error('Filter not found');

    const { data, error } = await supabase
      .from('filter_execution_log')
      .select('*')
      .eq('filter_id', filterId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[EmailFilterService] Error fetching logs:', error);
      throw new Error(`Failed to fetch logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Reorder filters
   */
  async reorderFilters(filterIds: string[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    for (let i = 0; i < filterIds.length; i++) {
      await supabase
        .from('email_filters')
        .update({ execution_order: i })
        .eq('id', filterIds[i])
        .eq('user_id', user.id);
    }

    console.log('[EmailFilterService] Reordered filters');
  }
}

// Singleton instance
export const emailFilterService = new EmailFilterService();
export default emailFilterService;
