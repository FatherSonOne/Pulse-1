// Email Accounts Service
// Manage multiple email accounts for unified inbox

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
  private async getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error('Not authenticated');
    }
    return data.session.access_token;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Request failed');
    }

    return (payload?.data ?? payload) as T;
  }

  async list(): Promise<EmailAccount[]> {
    return this.request<EmailAccount[]>('/api/email/accounts');
  }

  async getPrimary(): Promise<EmailAccount | null> {
    const accounts = await this.list();
    return accounts.find(account => account.is_primary) || null;
  }

  async create(input: EmailAccountInput): Promise<EmailAccount> {
    return this.request<EmailAccount>('/api/email/accounts', {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        email_address: input.email_address.toLowerCase(),
      }),
    });
  }

  async update(id: string, updates: Partial<EmailAccountInput>): Promise<EmailAccount> {
    return this.request<EmailAccount>(`/api/email/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...updates,
        email_address: updates.email_address?.toLowerCase(),
      }),
    });
  }

  async delete(id: string): Promise<void> {
    await this.request(`/api/email/accounts/${id}`, {
      method: 'DELETE',
    });
  }

  async setPrimary(id: string): Promise<EmailAccount> {
    return this.update(id, { is_primary: true });
  }

  async setSyncEnabled(id: string, enabled: boolean): Promise<EmailAccount> {
    return this.update(id, { sync_enabled: enabled });
  }
}

export const emailAccountsService = new EmailAccountsService();
export default emailAccountsService;
