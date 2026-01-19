// Label Service
// Manages custom email labels with nested structure and Gmail sync

import { supabase } from './supabase';
import { getGmailService } from './gmailService';
import type { CachedEmail } from './emailSyncService';

export interface CustomLabel {
  id: string;
  user_id: string;
  name: string;
  color: string;
  parent_label_id: string | null;
  gmail_label_id: string | null;
  is_system: boolean;
  message_count: number;
  unread_count: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface LabelTreeNode extends CustomLabel {
  children: LabelTreeNode[];
  depth: number;
}

export type CreateLabelInput = Omit<CustomLabel, 'id' | 'user_id' | 'is_system' | 'message_count' | 'unread_count' | 'created_at' | 'updated_at'>;
export type UpdateLabelInput = Partial<Pick<CustomLabel, 'name' | 'color' | 'parent_label_id' | 'display_order'>>;

// Available label colors
export const LABEL_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#6b7280', // gray (default)
];

class LabelService {
  /**
   * Create a new custom label
   */
  async createLabel(label: CreateLabelInput): Promise<CustomLabel> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate color
    if (!LABEL_COLORS.includes(label.color)) {
      throw new Error(`Invalid color. Must be one of: ${LABEL_COLORS.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('custom_labels')
      .insert({
        user_id: user.id,
        name: label.name,
        color: label.color,
        parent_label_id: label.parent_label_id,
        gmail_label_id: label.gmail_label_id,
        display_order: label.display_order || 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[LabelService] Error creating label:', error);
      throw new Error(`Failed to create label: ${error.message}`);
    }

    console.log('[LabelService] Created label:', data.id, data.name);

    // Sync to Gmail if not already synced
    if (!data.gmail_label_id) {
      try {
        await this.syncLabelToGmail(data.id);
      } catch (e) {
        console.warn('[LabelService] Failed to sync new label to Gmail:', e);
      }
    }

    return data;
  }

  /**
   * Get all labels for current user
   */
  async getLabels(): Promise<CustomLabel[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('custom_labels')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('[LabelService] Error fetching labels:', error);
      throw new Error(`Failed to fetch labels: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get label by ID
   */
  async getLabel(id: string): Promise<CustomLabel | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('custom_labels')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[LabelService] Error fetching label:', error);
      throw new Error(`Failed to fetch label: ${error.message}`);
    }

    return data;
  }

  /**
   * Get labels organized as a tree structure
   */
  async getLabelTree(): Promise<LabelTreeNode[]> {
    const labels = await this.getLabels();
    const labelMap = new Map<string, LabelTreeNode>();
    const roots: LabelTreeNode[] = [];

    // First pass: create nodes
    labels.forEach(label => {
      labelMap.set(label.id, {
        ...label,
        children: [],
        depth: 0,
      });
    });

    // Second pass: build tree
    labels.forEach(label => {
      const node = labelMap.get(label.id)!;
      
      if (label.parent_label_id) {
        const parent = labelMap.get(label.parent_label_id);
        if (parent) {
          node.depth = parent.depth + 1;
          parent.children.push(node);
        } else {
          // Parent not found, treat as root
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  /**
   * Update a label
   */
  async updateLabel(id: string, updates: UpdateLabelInput): Promise<CustomLabel> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate color if provided
    if (updates.color && !LABEL_COLORS.includes(updates.color)) {
      throw new Error(`Invalid color. Must be one of: ${LABEL_COLORS.join(', ')}`);
    }

    const { data, error} = await supabase
      .from('custom_labels')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_system', false) // Can't update system labels
      .select()
      .single();

    if (error) {
      console.error('[LabelService] Error updating label:', error);
      throw new Error(`Failed to update label: ${error.message}`);
    }

    console.log('[LabelService] Updated label:', id);

    // Sync changes to Gmail
    if (data.gmail_label_id) {
      try {
        await this.syncLabelToGmail(id);
      } catch (e) {
        console.warn('[LabelService] Failed to sync label update to Gmail:', e);
      }
    }

    return data;
  }

  /**
   * Delete a label
   */
  async deleteLabel(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get label first to check if it has Gmail ID
    const label = await this.getLabel(id);
    if (!label) {
      throw new Error('Label not found');
    }

    if (label.is_system) {
      throw new Error('Cannot delete system labels');
    }

    // Delete from database (cascade will handle email_labels junction table)
    const { error } = await supabase
      .from('custom_labels')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_system', false);

    if (error) {
      console.error('[LabelService] Error deleting label:', error);
      throw new Error(`Failed to delete label: ${error.message}`);
    }

    console.log('[LabelService] Deleted label:', id);

    // Delete from Gmail
    if (label.gmail_label_id) {
      try {
        const gmail = getGmailService();
        await gmail.deleteLabel(label.gmail_label_id);
      } catch (e) {
        console.warn('[LabelService] Failed to delete label from Gmail:', e);
      }
    }
  }

  /**
   * Apply label to email
   */
  async applyLabel(emailId: string, labelId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify email belongs to user
    const { data: email } = await supabase
      .from('cached_emails')
      .select('id, user_id, gmail_id')
      .eq('id', emailId)
      .eq('user_id', user.id)
      .single();

    if (!email) {
      throw new Error('Email not found');
    }

    // Apply label in database
    const { error } = await supabase
      .from('email_labels')
      .insert({
        email_id: emailId,
        label_id: labelId,
      })
      .select();

    if (error) {
      if (error.code === '23505') {
        // Label already applied
        return;
      }
      console.error('[LabelService] Error applying label:', error);
      throw new Error(`Failed to apply label: ${error.message}`);
    }

    console.log('[LabelService] Applied label', labelId, 'to email', emailId);

    // Apply label in Gmail
    const label = await this.getLabel(labelId);
    if (label?.gmail_label_id && email.gmail_id) {
      try {
        const gmail = getGmailService();
        await gmail.addLabelToMessage(email.gmail_id, label.gmail_label_id);
      } catch (e) {
        console.warn('[LabelService] Failed to apply label in Gmail:', e);
      }
    }
  }

  /**
   * Remove label from email
   */
  async removeLabel(emailId: string, labelId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify email belongs to user
    const { data: email } = await supabase
      .from('cached_emails')
      .select('id, user_id, gmail_id')
      .eq('id', emailId)
      .eq('user_id', user.id)
      .single();

    if (!email) {
      throw new Error('Email not found');
    }

    // Remove label from database
    const { error } = await supabase
      .from('email_labels')
      .delete()
      .eq('email_id', emailId)
      .eq('label_id', labelId);

    if (error) {
      console.error('[LabelService] Error removing label:', error);
      throw new Error(`Failed to remove label: ${error.message}`);
    }

    console.log('[LabelService] Removed label', labelId, 'from email', emailId);

    // Remove label from Gmail
    const label = await this.getLabel(labelId);
    if (label?.gmail_label_id && email.gmail_id) {
      try {
        const gmail = getGmailService();
        await gmail.removeLabelFromMessage(email.gmail_id, label.gmail_label_id);
      } catch (e) {
        console.warn('[LabelService] Failed to remove label from Gmail:', e);
      }
    }
  }

  /**
   * Get all emails with a specific label
   */
  async getEmailsByLabel(labelId: string): Promise<CachedEmail[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_labels')
      .select(`
        email_id,
        cached_emails!inner(*)
      `)
      .eq('label_id', labelId);

    if (error) {
      console.error('[LabelService] Error fetching emails by label:', error);
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }

    return data.map((item: any) => item.cached_emails) || [];
  }

  /**
   * Get labels for a specific email
   */
  async getEmailLabels(emailId: string): Promise<CustomLabel[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_labels')
      .select(`
        label_id,
        custom_labels!inner(*)
      `)
      .eq('email_id', emailId);

    if (error) {
      console.error('[LabelService] Error fetching email labels:', error);
      throw new Error(`Failed to fetch email labels: ${error.message}`);
    }

    return data.map((item: any) => item.custom_labels) || [];
  }

  /**
   * Sync label to Gmail (create or update)
   */
  private async syncLabelToGmail(labelId: string): Promise<void> {
    const label = await this.getLabel(labelId);
    if (!label) return;

    const gmail = getGmailService();

    if (label.gmail_label_id) {
      // Update existing Gmail label
      await gmail.updateLabel(label.gmail_label_id, {
        name: label.name,
      });
    } else {
      // Create new Gmail label
      const gmailLabel = await gmail.createLabel({
        name: label.name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      });

      // Store Gmail label ID
      await supabase
        .from('custom_labels')
        .update({ gmail_label_id: gmailLabel.id })
        .eq('id', labelId);
    }
  }

  /**
   * Sync all labels from Gmail
   */
  async syncFromGmail(): Promise<{ created: number; updated: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let created = 0;
    let updated = 0;

    try {
      const gmail = getGmailService();
      const gmailLabels = await gmail.listLabels();

      for (const gmailLabel of gmailLabels) {
        // Skip system labels
        if (gmailLabel.type === 'system') continue;

        // Check if label exists locally
        const { data: existing } = await supabase
          .from('custom_labels')
          .select('*')
          .eq('gmail_label_id', gmailLabel.id)
          .eq('user_id', user.id)
          .single();

        if (existing) {
          // Update existing label
          await supabase
            .from('custom_labels')
            .update({
              name: gmailLabel.name,
            })
            .eq('id', existing.id);
          updated++;
        } else {
          // Create new label
          await supabase
            .from('custom_labels')
            .insert({
              user_id: user.id,
              name: gmailLabel.name,
              color: LABEL_COLORS[created % LABEL_COLORS.length], // Assign color
              gmail_label_id: gmailLabel.id,
            });
          created++;
        }
      }

      console.log(`[LabelService] Gmail sync complete: ${created} created, ${updated} updated`);
    } catch (error) {
      console.error('[LabelService] Error syncing from Gmail:', error);
      throw new Error(`Failed to sync from Gmail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { created, updated };
  }

  /**
   * Bulk apply label to multiple emails
   */
  async bulkApplyLabel(emailIds: string[], labelId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const emailId of emailIds) {
      try {
        await this.applyLabel(emailId, labelId);
        success++;
      } catch (e) {
        console.error(`[LabelService] Failed to apply label to ${emailId}:`, e);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Bulk remove label from multiple emails
   */
  async bulkRemoveLabel(emailIds: string[], labelId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const emailId of emailIds) {
      try {
        await this.removeLabel(emailId, labelId);
        success++;
      } catch (e) {
        console.error(`[LabelService] Failed to remove label from ${emailId}:`, e);
        failed++;
      }
    }

    return { success, failed };
  }
}

// Singleton instance
export const labelService = new LabelService();
export default labelService;
