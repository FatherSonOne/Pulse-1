// Blocked Senders Service
// Manage blocked email addresses and domains

import { supabase } from './supabase';

export interface BlockedSender {
  id: string;
  user_id: string;
  email_address: string | null;
  domain: string | null;
  reason: string | null;
  auto_delete: boolean;
  blocked_at: string;
  created_at: string;
  updated_at: string;
}

export type BlockedSenderInput = {
  email_address?: string;
  domain?: string;
  reason?: string;
  auto_delete?: boolean;
};

class BlockedSendersService {
  /**
   * Block a specific email address
   */
  async blockEmail(email: string, options?: { reason?: string; autoDelete?: boolean }): Promise<BlockedSender> {
    return this.block({
      email_address: email.toLowerCase(),
      reason: options?.reason,
      auto_delete: options?.autoDelete ?? false,
    });
  }

  /**
   * Block an entire domain
   */
  async blockDomain(domain: string, options?: { reason?: string; autoDelete?: boolean }): Promise<BlockedSender> {
    return this.block({
      domain: domain.toLowerCase(),
      reason: options?.reason,
      auto_delete: options?.autoDelete ?? false,
    });
  }

  /**
   * Generic block method
   */
  private async block(input: BlockedSenderInput): Promise<BlockedSender> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (!input.email_address && !input.domain) {
      throw new Error('Either email_address or domain is required');
    }

    const { data, error } = await supabase
      .from('blocked_senders')
      .insert({
        user_id: user.id,
        email_address: input.email_address || null,
        domain: input.domain || null,
        reason: input.reason || null,
        auto_delete: input.auto_delete ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error('[BlockedSendersService] Block failed:', error);
      throw new Error(`Failed to block sender: ${error.message}`);
    }

    return data;
  }

  /**
   * Unblock a sender by ID
   */
  async unblock(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('blocked_senders')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Failed to unblock sender: ${error.message}`);
    }
  }

  /**
   * Unblock by email or domain
   */
  async unblockByValue(value: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const lower = value.toLowerCase();

    const { error } = await supabase
      .from('blocked_senders')
      .delete()
      .eq('user_id', user.id)
      .or(`email_address.eq.${lower},domain.eq.${lower}`);

    if (error) {
      throw new Error(`Failed to unblock sender: ${error.message}`);
    }
  }

  /**
   * List all blocked senders
   */
  async list(): Promise<BlockedSender[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('blocked_senders')
      .select('*')
      .eq('user_id', user.id)
      .order('blocked_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch blocked senders: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Check if an email is blocked
   */
  async isBlocked(email: string): Promise<{ blocked: boolean; autoDelete: boolean }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const lower = email.toLowerCase();
    const domain = lower.split('@')[1];

    const { data, error } = await supabase
      .from('blocked_senders')
      .select('auto_delete')
      .eq('user_id', user.id)
      .or(`email_address.eq.${lower},domain.eq.${domain}`)
      .limit(1);

    if (error) {
      console.error('[BlockedSendersService] isBlocked check failed:', error);
      return { blocked: false, autoDelete: false };
    }

    if (data && data.length > 0) {
      return { blocked: true, autoDelete: !!data[0].auto_delete };
    }

    return { blocked: false, autoDelete: false };
  }
}

export const blockedSendersService = new BlockedSendersService();
export default blockedSendersService;
