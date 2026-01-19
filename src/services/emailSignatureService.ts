// Email Signature Service
// Manages user email signatures with rich text formatting

import { supabase } from './supabase';

export interface EmailSignature {
  id: string;
  user_id: string;
  name: string;
  content_html: string;
  content_text: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateSignatureInput = Omit<EmailSignature, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type UpdateSignatureInput = Partial<Omit<EmailSignature, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

class EmailSignatureService {
  /**
   * Create a new email signature
   */
  async createSignature(signature: CreateSignatureInput): Promise<EmailSignature> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_signatures')
      .insert({
        user_id: user.id,
        name: signature.name,
        content_html: signature.content_html,
        content_text: signature.content_text,
        is_default: signature.is_default,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating signature:', error);
      throw new Error(`Failed to create signature: ${error.message}`);
    }

    console.log('[EmailSignatureService] Created signature:', data.id);
    return data;
  }

  /**
   * Get all signatures for current user
   */
  async getSignatures(): Promise<EmailSignature[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_signatures')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false }) // Default first
      .order('created_at', { ascending: false }); // Then by newest

    if (error) {
      console.error('Error fetching signatures:', error);
      throw new Error(`Failed to fetch signatures: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single signature by ID
   */
  async getSignature(id: string): Promise<EmailSignature | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_signatures')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching signature:', error);
      throw new Error(`Failed to fetch signature: ${error.message}`);
    }

    return data;
  }

  /**
   * Get the default signature for current user
   */
  async getDefaultSignature(): Promise<EmailSignature | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_signatures')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No default signature set
      }
      console.error('Error fetching default signature:', error);
      throw new Error(`Failed to fetch default signature: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing signature
   */
  async updateSignature(id: string, updates: UpdateSignatureInput): Promise<EmailSignature> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('email_signatures')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating signature:', error);
      throw new Error(`Failed to update signature: ${error.message}`);
    }

    console.log('[EmailSignatureService] Updated signature:', id);
    return data;
  }

  /**
   * Set a signature as default
   */
  async setDefaultSignature(id: string): Promise<EmailSignature> {
    return this.updateSignature(id, { is_default: true });
  }

  /**
   * Delete a signature
   */
  async deleteSignature(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('email_signatures')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting signature:', error);
      throw new Error(`Failed to delete signature: ${error.message}`);
    }

    console.log('[EmailSignatureService] Deleted signature:', id);
  }

  /**
   * Replace variables in signature content
   * Supports: {{name}}, {{email}}, {{date}}, {{time}}
   */
  replaceVariables(content: string, variables: {
    name?: string;
    email?: string;
    date?: string;
    time?: string;
  }): string {
    let result = content;

    // Replace each variable
    if (variables.name) {
      result = result.replace(/\{\{name\}\}/g, variables.name);
    }
    if (variables.email) {
      result = result.replace(/\{\{email\}\}/g, variables.email);
    }
    if (variables.date) {
      result = result.replace(/\{\{date\}\}/g, variables.date);
    } else {
      // Default to current date
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      result = result.replace(/\{\{date\}\}/g, today);
    }
    if (variables.time) {
      result = result.replace(/\{\{time\}\}/g, variables.time);
    } else {
      // Default to current time
      const now = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
      result = result.replace(/\{\{time\}\}/g, now);
    }

    return result;
  }

  /**
   * Get signature content ready for insertion into email
   */
  async getSignatureForEmail(options: {
    signatureId?: string; // Specific signature ID, or use default
    userName?: string;
    userEmail?: string;
  }): Promise<{ html: string; text: string } | null> {
    let signature: EmailSignature | null = null;

    if (options.signatureId) {
      signature = await this.getSignature(options.signatureId);
    } else {
      signature = await this.getDefaultSignature();
    }

    if (!signature) {
      return null;
    }

    // Replace variables
    const variables = {
      name: options.userName,
      email: options.userEmail,
    };

    return {
      html: this.replaceVariables(signature.content_html, variables),
      text: this.replaceVariables(signature.content_text, variables),
    };
  }

  /**
   * Convert HTML signature to plain text
   * Basic implementation - strips HTML tags
   */
  htmlToPlainText(html: string): string {
    // Remove HTML tags
    let text = html.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  /**
   * Validate signature name (no duplicates for same user)
   */
  async validateSignatureName(name: string, excludeId?: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('email_signatures')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error validating signature name:', error);
      throw new Error(`Failed to validate signature name: ${error.message}`);
    }

    return data.length === 0; // Valid if no duplicates found
  }
}

// Singleton instance
export const emailSignatureService = new EmailSignatureService();
export default emailSignatureService;
