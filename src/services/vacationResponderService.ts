// Vacation Responder Service
// Manages out-of-office auto-replies

import { supabase } from './supabase';
import type { CachedEmail } from './emailSyncService';

export interface VacationResponderConfig {
  id: string;
  user_id: string;
  enabled: boolean;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  subject: string;
  message_html: string;
  message_text: string;
  only_contacts: boolean;
  only_first_email: boolean;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type VacationResponderInput = Omit<
  VacationResponderConfig,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_sent_at'
>;

class VacationResponderService {
  /**
   * Get current user's vacation responder config
   */
  async getConfig(): Promise<VacationResponderConfig | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('vacation_responder')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Create or update vacation responder config
   */
  async saveConfig(config: VacationResponderInput): Promise<VacationResponderConfig> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('vacation_responder')
      .upsert({
        user_id: user.id,
        enabled: config.enabled,
        start_date: config.start_date,
        end_date: config.end_date,
        subject: config.subject,
        message_html: config.message_html,
        message_text: config.message_text,
        only_contacts: config.only_contacts,
        only_first_email: config.only_first_email,
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('[VacationResponderService] Save failed:', error);
      throw new Error(`Failed to save vacation responder: ${error.message}`);
    }

    return data;
  }

  /**
   * Enable vacation responder
   */
  async enable(): Promise<void> {
    await this.setEnabled(true);
  }

  /**
   * Disable vacation responder
   */
  async disable(): Promise<void> {
    await this.setEnabled(false);
  }

  private async setEnabled(enabled: boolean): Promise<void> {
    const config = await this.getConfig();
    if (!config) throw new Error('Vacation responder not configured');

    const { error } = await supabase
      .from('vacation_responder')
      .update({ enabled })
      .eq('id', config.id);

    if (error) {
      throw new Error(`Failed to update vacation responder: ${error.message}`);
    }
  }

  /**
   * Check if vacation responder is active (enabled and within date range)
   */
  async isActive(): Promise<boolean> {
    const config = await this.getConfig();
    if (!config || !config.enabled) return false;

    const today = new Date();
    const start = new Date(`${config.start_date}T00:00:00Z`);
    const end = new Date(`${config.end_date}T23:59:59Z`);

    return today >= start && today <= end;
  }

  /**
   * Check if we should send an auto-reply for a specific email
   */
  async shouldSendResponse(email: CachedEmail): Promise<boolean> {
    const config = await this.getConfig();
    if (!config || !config.enabled) return false;

    const today = new Date();
    const start = new Date(`${config.start_date}T00:00:00Z`);
    const end = new Date(`${config.end_date}T23:59:59Z`);

    // Check date range
    if (today < start || today > end) return false;

    // Do not auto-reply to self
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email && email.from_email.toLowerCase() === user.email.toLowerCase()) {
      return false;
    }

    // Check if sender is a contact (if required)
    if (config.only_contacts) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user?.id)
        .eq('email', email.from_email)
        .limit(1)
        .single();

      if (!contact) return false;
    }

    // Check if already replied to this sender during this period
    if (config.only_first_email) {
      const alreadySent = await this.hasSentToRecipient(config.id, email.from_email);
      if (alreadySent) return false;
    }

    return true;
  }

  /**
   * Record that an auto-reply was sent
   */
  async recordResponseSent(configId: string, recipientEmail: string, originalEmailId?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('vacation_responder_log')
      .insert({
        responder_id: configId,
        user_id: user.id,
        recipient_email: recipientEmail,
        original_email_id: originalEmailId || null,
      });

    if (error) {
      console.error('[VacationResponderService] Failed to log response:', error);
    }

    // Update last_sent_at
    await supabase
      .from('vacation_responder')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', configId);
  }

  /**
   * Check if we already sent an auto-reply to this recipient
   */
  async hasSentToRecipient(configId: string, recipientEmail: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('vacation_responder_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('responder_id', configId)
      .ilike('recipient_email', recipientEmail)
      .limit(1);

    if (error) {
      console.error('[VacationResponderService] Failed to check log:', error);
      return false;
    }

    return (data?.length || 0) > 0;
  }
}

export const vacationResponderService = new VacationResponderService();
export default vacationResponderService;
