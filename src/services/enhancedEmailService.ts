// src/services/enhancedEmailService.ts
import { supabase } from './supabase';
import { Email, EmailDraft, EmailTemplate, EmailFilter, EmailLabel } from '../types/email';
import { getGmailService, SendEmailParams } from './gmailService';

export const enhancedEmailService = {
  // ==================== Email Operations ====================

  async getEmails(folder: string = 'inbox', limit: number = 50): Promise<Email[]> {
    try {
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .contains('labels', [folder])
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as Email[]) || [];
    } catch (error) {
      console.error('Failed to get emails:', error);
      return [];
    }
  },

  async getEmail(emailId: string): Promise<Email | null> {
    try {
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('id', emailId)
        .single();

      if (error) throw error;
      return data as Email;
    } catch (error) {
      console.error('Failed to get email:', error);
      return null;
    }
  },

  async searchEmails(query: string): Promise<Email[]> {
    try {
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .or(`subject.ilike.%${query}%,body.ilike.%${query}%`)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data as Email[]) || [];
    } catch (error) {
      console.error('Failed to search emails:', error);
      return [];
    }
  },

  async markAsRead(emailId: string): Promise<void> {
    try {
      await supabase
        .from('emails')
        .update({ isRead: true })
        .eq('id', emailId);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  },

  async markAsUnread(emailId: string): Promise<void> {
    try {
      await supabase
        .from('emails')
        .update({ isRead: false })
        .eq('id', emailId);
    } catch (error) {
      console.error('Failed to mark as unread:', error);
    }
  },

  async toggleStar(emailId: string, isStarred: boolean): Promise<void> {
    try {
      await supabase
        .from('emails')
        .update({ isStarred })
        .eq('id', emailId);
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  },

  async toggleImportant(emailId: string, isImportant: boolean): Promise<void> {
    try {
      await supabase
        .from('emails')
        .update({ isImportant })
        .eq('id', emailId);
    } catch (error) {
      console.error('Failed to toggle important:', error);
    }
  },

  async moveToTrash(emailId: string): Promise<void> {
    try {
      await supabase
        .from('emails')
        .update({ isTrashed: true, labels: ['trash'] })
        .eq('id', emailId);
    } catch (error) {
      console.error('Failed to move to trash:', error);
    }
  },

  async archiveEmail(emailId: string): Promise<void> {
    try {
      await supabase
        .from('emails')
        .update({ isArchived: true, labels: ['archive'] })
        .eq('id', emailId);
    } catch (error) {
      console.error('Failed to archive:', error);
    }
  },

  async restoreEmail(emailId: string): Promise<void> {
    try {
      await supabase
        .from('emails')
        .update({ isTrashed: false, isArchived: false, labels: ['inbox'] })
        .eq('id', emailId);
    } catch (error) {
      console.error('Failed to restore:', error);
    }
  },

  async deleteEmail(emailId: string): Promise<void> {
    try {
      await supabase
        .from('emails')
        .delete()
        .eq('id', emailId);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  },

  async applyLabel(emailId: string, labelId: string): Promise<void> {
    try {
      const email = await this.getEmail(emailId);
      if (email) {
        const labels = [...new Set([...email.labels, labelId])];
        await supabase
          .from('emails')
          .update({ labels })
          .eq('id', emailId);
      }
    } catch (error) {
      console.error('Failed to apply label:', error);
    }
  },

  async removeLabel(emailId: string, labelId: string): Promise<void> {
    try {
      const email = await this.getEmail(emailId);
      if (email) {
        const labels = email.labels.filter(l => l !== labelId);
        await supabase
          .from('emails')
          .update({ labels })
          .eq('id', emailId);
      }
    } catch (error) {
      console.error('Failed to remove label:', error);
    }
  },

  // ==================== Draft Operations ====================

  async saveDraft(draft: Partial<EmailDraft>): Promise<EmailDraft> {
    try {
      const { data, error } = await supabase
        .from('email_drafts')
        .upsert([{ ...draft, savedAt: new Date().toISOString() }])
        .select()
        .single();

      if (error) throw error;
      return data as EmailDraft;
    } catch (error) {
      console.error('Failed to save draft:', error);
      return {
        id: Date.now().toString(),
        to: draft.to || [],
        subject: draft.subject || '',
        body: draft.body || '',
        savedAt: new Date().toISOString(),
      };
    }
  },

  async getDrafts(): Promise<EmailDraft[]> {
    try {
      const { data, error } = await supabase
        .from('email_drafts')
        .select('*')
        .order('savedAt', { ascending: false });

      if (error) throw error;
      return (data as EmailDraft[]) || [];
    } catch (error) {
      console.error('Failed to get drafts:', error);
      return [];
    }
  },

  async deleteDraft(draftId: string): Promise<void> {
    try {
      await supabase
        .from('email_drafts')
        .delete()
        .eq('id', draftId);
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
  },

  // ==================== Labels ====================

  async getLabels(): Promise<EmailLabel[]> {
    try {
      const { data, error } = await supabase
        .from('email_labels')
        .select('*')
        .order('name');

      if (error) throw error;
      return (data as EmailLabel[]) || [];
    } catch (error) {
      console.error('Failed to get labels:', error);
      return [];
    }
  },

  async createLabel(name: string, color: string): Promise<EmailLabel> {
    try {
      const { data, error } = await supabase
        .from('email_labels')
        .insert([{ name, color, type: 'user' }])
        .select()
        .single();

      if (error) throw error;
      return data as EmailLabel;
    } catch (error) {
      console.error('Failed to create label:', error);
      return {
        id: Date.now().toString(),
        name,
        color,
        type: 'user',
        messageCount: 0,
        unreadCount: 0,
      };
    }
  },

  async deleteLabel(labelId: string): Promise<void> {
    try {
      await supabase
        .from('email_labels')
        .delete()
        .eq('id', labelId);
    } catch (error) {
      console.error('Failed to delete label:', error);
    }
  },

  // ==================== Templates ====================

  async getTemplates(): Promise<EmailTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      return (data as EmailTemplate[]) || [];
    } catch (error) {
      console.error('Failed to get templates:', error);
      return [];
    }
  },

  async saveTemplate(template: Partial<EmailTemplate>): Promise<EmailTemplate> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .upsert([{ ...template, updatedAt: new Date().toISOString() }])
        .select()
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    } catch (error) {
      console.error('Failed to save template:', error);
      return {
        id: Date.now().toString(),
        name: template.name || 'Untitled',
        subject: template.subject || '',
        body: template.body || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  },

  // ==================== Filters ====================

  async getFilters(): Promise<EmailFilter[]> {
    try {
      const { data, error } = await supabase
        .from('email_filters')
        .select('*')
        .order('name');

      if (error) throw error;
      return (data as EmailFilter[]) || [];
    } catch (error) {
      console.error('Failed to get filters:', error);
      return [];
    }
  },

  async saveFilter(filter: Partial<EmailFilter>): Promise<EmailFilter> {
    try {
      const { data, error } = await supabase
        .from('email_filters')
        .upsert([filter])
        .select()
        .single();

      if (error) throw error;
      return data as EmailFilter;
    } catch (error) {
      console.error('Failed to save filter:', error);
      return {
        id: Date.now().toString(),
        name: filter.name || 'Untitled Filter',
        isEnabled: true,
        criteria: filter.criteria || {},
        actions: filter.actions || {},
        createdAt: new Date().toISOString(),
      };
    }
  },

  // ==================== Send Email ====================

  async sendEmail(email: Partial<Email>): Promise<boolean> {
    try {
      // Try to send via Gmail API if user is authenticated with Google
      const gmailService = getGmailService();

      // Build the recipients list
      const to = email.to?.map(t => typeof t === 'string' ? t : t.email) || [];
      const cc = email.cc?.map(c => typeof c === 'string' ? c : c.email);
      const bcc = email.bcc?.map(b => typeof b === 'string' ? b : b.email);

      if (to.length === 0) {
        throw new Error('No recipients specified');
      }

      const sendParams: SendEmailParams = {
        to,
        cc,
        bcc,
        subject: email.subject || '(No Subject)',
        body: email.body || '',
        isHtml: email.body?.includes('<') && email.body?.includes('>'),
        threadId: email.threadId,
        inReplyTo: email.replyTo
      };

      const result = await gmailService.sendEmail(sendParams);
      console.log('Email sent via Gmail API:', result);

      // Also save to local database for quick access
      try {
        await supabase
          .from('emails')
          .insert([{
            ...email,
            id: result.id,
            messageId: result.id,
            threadId: result.threadId,
            labels: ['sent'],
            timestamp: Date.now(),
            date: new Date().toISOString(),
          }]);
      } catch (dbError) {
        console.warn('Could not save to local DB:', dbError);
      }

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  },

  // ==================== Stats ====================

  async getStats(): Promise<{ inbox: number; unread: number; drafts: number; sent: number }> {
    try {
      const inbox = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .contains('labels', ['inbox']);

      const unread = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('isRead', false);

      const drafts = await supabase
        .from('email_drafts')
        .select('*', { count: 'exact', head: true });

      const sent = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .contains('labels', ['sent']);

      return {
        inbox: inbox.count || 0,
        unread: unread.count || 0,
        drafts: drafts.count || 0,
        sent: sent.count || 0,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        inbox: 0,
        unread: 0,
        drafts: 0,
        sent: 0,
      };
    }
  },
};

export default enhancedEmailService;
