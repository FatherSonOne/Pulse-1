// Email Accounts Service
// Manage multiple email accounts for unified inbox
// Uses Supabase directly (no API routes needed)

import { supabase } from './supabase';

export interface EmailAccount {
  id: string;
  user_id: string;
  provider: 'google' | 'microsoft' | 'imap';
  email_address: string;
  display_name: string | null;
  is_primary: boolean;
  sync_enabled: boolean;
  last_sync_at: string | null;
  integration_id: string | null;
  created_at: string;
  updated_at: string;
}

export type EmailAccountInput = Omit<
  EmailAccount,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_sync_at'
>;

class EmailAccountsService {
  private async getUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    return user.id;
  }

  async list(): Promise<EmailAccount[]> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('[EmailAccountsService] Error listing accounts:', error);
      throw new Error(`Failed to list accounts: ${error.message}`);
    }

    return data || [];
  }

  async getPrimary(): Promise<EmailAccount | null> {
    const accounts = await this.list();
    return accounts.find(account => account.is_primary) || null;
  }

  async create(input: EmailAccountInput): Promise<EmailAccount> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('email_accounts')
      .insert({
        user_id: userId,
        provider: input.provider,
        email_address: input.email_address.toLowerCase(),
        display_name: input.display_name,
        is_primary: input.is_primary,
        sync_enabled: input.sync_enabled,
        integration_id: input.integration_id,
      })
      .select()
      .single();

    if (error) {
      console.error('[EmailAccountsService] Error creating account:', error);
      throw new Error(`Failed to create account: ${error.message}`);
    }

    return data;
  }

  async update(id: string, updates: Partial<EmailAccountInput>): Promise<EmailAccount> {
    const userId = await this.getUserId();

    const { data, error } = await supabase
      .from('email_accounts')
      .update({
        ...updates,
        email_address: updates.email_address?.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[EmailAccountsService] Error updating account:', error);
      throw new Error(`Failed to update account: ${error.message}`);
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const userId = await this.getUserId();

    const { error } = await supabase
      .from('email_accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[EmailAccountsService] Error deleting account:', error);
      throw new Error(`Failed to delete account: ${error.message}`);
    }
  }

  async setPrimary(id: string): Promise<EmailAccount> {
    const userId = await this.getUserId();

    // Unset all other primaries first
    await supabase
      .from('email_accounts')
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .neq('id', id);

    return this.update(id, { is_primary: true });
  }

  async setSyncEnabled(id: string, enabled: boolean): Promise<EmailAccount> {
    return this.update(id, { sync_enabled: enabled });
  }
}

export const emailAccountsService = new EmailAccountsService();
export default emailAccountsService;
