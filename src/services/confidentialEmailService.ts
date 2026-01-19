// Confidential Email Service
// Manage confidential mode metadata for emails

import { supabase } from './supabase';

export interface ConfidentialEmail {
  id: string;
  user_id: string;
  email_id: string | null;
  thread_id: string | null;
  expires_at: string | null;
  require_passcode: boolean;
  passcode_hash: string | null;
  disable_forward: boolean;
  disable_copy: boolean;
  disable_print: boolean;
  disable_download: boolean;
  revoked: boolean;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfidentialEmailInput {
  email_id?: string | null;
  thread_id?: string | null;
  expires_at?: string | null;
  require_passcode?: boolean;
  passcode?: string | null;
  disable_forward?: boolean;
  disable_copy?: boolean;
  disable_print?: boolean;
  disable_download?: boolean;
}

class ConfidentialEmailService {
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

  /**
   * Create confidential metadata for an email
   */
  async create(input: ConfidentialEmailInput): Promise<ConfidentialEmail> {
    const passcodeHash = input.passcode
      ? await this.hashPasscode(input.passcode)
      : null;
    return this.request<ConfidentialEmail>('/api/email/confidential', {
      method: 'POST',
      body: JSON.stringify({
        email_id: input.email_id || null,
        thread_id: input.thread_id || null,
        expires_at: input.expires_at || null,
        require_passcode: input.require_passcode ?? false,
        passcode_hash: passcodeHash,
        disable_forward: input.disable_forward ?? true,
        disable_copy: input.disable_copy ?? true,
        disable_print: input.disable_print ?? true,
        disable_download: input.disable_download ?? true,
      }),
    });
  }

  /**
   * Revoke confidential access
   */
  async revoke(id: string): Promise<ConfidentialEmail> {
    return this.request<ConfidentialEmail>(`/api/email/confidential/${id}/revoke`, {
      method: 'POST',
    });
  }

  /**
   * Check if confidential email is still valid
   */
  isValid(confidential: ConfidentialEmail): boolean {
    if (confidential.revoked) return false;
    if (confidential.expires_at) {
      return new Date(confidential.expires_at) > new Date();
    }
    return true;
  }

  /**
   * Verify passcode
   */
  async verifyPasscode(confidential: ConfidentialEmail, passcode: string): Promise<boolean> {
    if (!confidential.require_passcode) return true;
    if (!confidential.passcode_hash) return false;
    const hash = await this.hashPasscode(passcode);
    return hash === confidential.passcode_hash;
  }

  /**
   * Hash passcode using SHA-256
   */
  private async hashPasscode(passcode: string): Promise<string> {
    if (!crypto?.subtle) {
      throw new Error('Crypto API not available');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(passcode);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

export const confidentialEmailService = new ConfidentialEmailService();
export default confidentialEmailService;
