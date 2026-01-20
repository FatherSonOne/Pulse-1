/**
 * Email Template Service
 * Handles CRUD operations for email templates and template categories
 */

import { supabase } from './supabase';

export interface EmailTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  subject?: string;
  body?: string;
  body_html?: string;
  variables: string[];
  category?: string;
  is_favorite: boolean;
  is_shared?: boolean;
  use_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  name: string;
  label: string;
  description: string;
  category: 'Contact' | 'Message' | 'User' | 'Dynamic';
  example: string;
}

// Predefined template variables
export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Contact variables
  { name: 'firstName', label: 'First Name', description: 'Contact first name', category: 'Contact', example: 'John' },
  { name: 'lastName', label: 'Last Name', description: 'Contact last name', category: 'Contact', example: 'Doe' },
  { name: 'fullName', label: 'Full Name', description: 'Contact full name', category: 'Contact', example: 'John Doe' },
  { name: 'email', label: 'Email', description: 'Contact email address', category: 'Contact', example: 'john@example.com' },
  { name: 'company', label: 'Company', description: 'Contact company name', category: 'Contact', example: 'Acme Corp' },
  { name: 'title', label: 'Job Title', description: 'Contact job title', category: 'Contact', example: 'CEO' },
  { name: 'phone', label: 'Phone', description: 'Contact phone number', category: 'Contact', example: '+1-555-0123' },

  // Message context
  { name: 'subject', label: 'Subject', description: 'Email subject line', category: 'Message', example: 'Re: Your inquiry' },
  { name: 'previousSubject', label: 'Previous Subject', description: 'Subject from previous email', category: 'Message', example: 'Product demo request' },
  { name: 'threadContext', label: 'Thread Context', description: 'Summary of conversation', category: 'Message', example: 'We discussed pricing...' },
  { name: 'lastMessage', label: 'Last Message', description: 'Excerpt from last message', category: 'Message', example: 'Thanks for reaching out...' },

  // User variables
  { name: 'senderName', label: 'Sender Name', description: 'Your name', category: 'User', example: 'Jane Smith' },
  { name: 'senderEmail', label: 'Sender Email', description: 'Your email', category: 'User', example: 'jane@company.com' },
  { name: 'senderTitle', label: 'Sender Title', description: 'Your job title', category: 'User', example: 'Account Manager' },
  { name: 'senderCompany', label: 'Sender Company', description: 'Your company', category: 'User', example: 'Pulse' },
  { name: 'senderPhone', label: 'Sender Phone', description: 'Your phone', category: 'User', example: '+1-555-9876' },

  // Dynamic variables
  { name: 'currentDate', label: 'Current Date', description: 'Today\'s date', category: 'Dynamic', example: 'January 19, 2026' },
  { name: 'currentTime', label: 'Current Time', description: 'Current time', category: 'Dynamic', example: '2:30 PM' },
  { name: 'customField1', label: 'Custom Field 1', description: 'Custom variable', category: 'Dynamic', example: 'Custom value' },
  { name: 'customField2', label: 'Custom Field 2', description: 'Custom variable', category: 'Dynamic', example: 'Custom value' },
];

class EmailTemplateService {
  /**
   * Get all templates for a user
   */
  async getTemplates(userId: string, category?: string): Promise<{ data: EmailTemplate[] | null; error: any }> {
    try {
      let query = supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      console.error('[EmailTemplateService] getTemplates error:', error);
      return { data: null, error };
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string): Promise<{ data: EmailTemplate | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', id)
        .single();

      return { data, error };
    } catch (error) {
      console.error('[EmailTemplateService] getTemplate error:', error);
      return { data: null, error };
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(template: {
    user_id: string;
    name: string;
    description?: string;
    subject?: string;
    body?: string;
    body_html?: string;
    category?: string;
    variables?: string[];
  }): Promise<{ data: EmailTemplate | null; error: any }> {
    try {
      // Extract variables from body if not provided
      const variables = template.variables || this.extractVariables(template.body || '');

      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          ...template,
          variables,
          is_favorite: false,
          use_count: 0
        })
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('[EmailTemplateService] createTemplate error:', error);
      return { data: null, error };
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<{ data: EmailTemplate | null; error: any }> {
    try {
      // Re-extract variables if body changed
      if (updates.body) {
        updates.variables = this.extractVariables(updates.body);
      }

      const { data, error } = await supabase
        .from('email_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('[EmailTemplateService] updateTemplate error:', error);
      return { data: null, error };
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('[EmailTemplateService] deleteTemplate error:', error);
      return { error };
    }
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(id: string, isFavorite: boolean): Promise<{ data: EmailTemplate | null; error: any }> {
    return this.updateTemplate(id, { is_favorite: isFavorite });
  }

  /**
   * Increment usage count
   */
  async incrementUsage(id: string): Promise<{ error: any }> {
    try {
      const { data: template } = await this.getTemplate(id);

      if (template) {
        const { error } = await supabase
          .from('email_templates')
          .update({
            use_count: (template.use_count || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', id);

        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('[EmailTemplateService] incrementUsage error:', error);
      return { error };
    }
  }

  /**
   * Extract variables from template body
   * Finds all {{variableName}} patterns
   */
  extractVariables(body: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = body.matchAll(regex);
    const variables = Array.from(matches, m => m[1].trim());
    // Return unique variables
    return [...new Set(variables)];
  }

  /**
   * Replace variables with actual values
   */
  replaceVariables(template: string, values: Record<string, string>): string {
    let result = template;

    Object.entries(values).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, value || '');
    });

    return result;
  }

  /**
   * Get template categories
   */
  async getCategories(userId: string): Promise<{ data: TemplateCategory[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('template_categories')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order');

      return { data, error };
    } catch (error) {
      console.error('[EmailTemplateService] getCategories error:', error);
      return { data: null, error };
    }
  }

  /**
   * Create a template category
   */
  async createCategory(category: {
    user_id: string;
    name: string;
    color?: string;
    icon?: string;
    sort_order?: number;
  }): Promise<{ data: TemplateCategory | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('template_categories')
        .insert(category)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('[EmailTemplateService] createCategory error:', error);
      return { data: null, error };
    }
  }

  /**
   * Update a template category
   */
  async updateCategory(id: string, updates: Partial<TemplateCategory>): Promise<{ data: TemplateCategory | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('template_categories')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('[EmailTemplateService] updateCategory error:', error);
      return { data: null, error };
    }
  }

  /**
   * Delete a template category
   */
  async deleteCategory(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('template_categories')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('[EmailTemplateService] deleteCategory error:', error);
      return { error };
    }
  }

  /**
   * Search templates
   */
  async searchTemplates(userId: string, query: string): Promise<{ data: EmailTemplate[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', userId)
        .or(`name.ilike.%${query}%,body.ilike.%${query}%,description.ilike.%${query}%`)
        .order('updated_at', { ascending: false });

      return { data, error };
    } catch (error) {
      console.error('[EmailTemplateService] searchTemplates error:', error);
      return { data: null, error };
    }
  }

  /**
   * Get favorite templates
   */
  async getFavorites(userId: string): Promise<{ data: EmailTemplate[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('is_favorite', true)
        .order('updated_at', { ascending: false });

      return { data, error };
    } catch (error) {
      console.error('[EmailTemplateService] getFavorites error:', error);
      return { data, null, error };
    }
  }

  /**
   * Get most used templates
   */
  async getMostUsed(userId: string, limit: number = 10): Promise<{ data: EmailTemplate[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', userId)
        .order('use_count', { ascending: false })
        .limit(limit);

      return { data, error };
    } catch (error) {
      console.error('[EmailTemplateService] getMostUsed error:', error);
      return { data: null, error };
    }
  }

  /**
   * AI: Generate template from description (stub for future AI integration)
   */
  async generateTemplate(description: string, tone?: string): Promise<{
    subject: string;
    body: string;
    variables: string[];
  }> {
    // TODO: Integrate with existing AI service (Gemini, GPT, Claude)
    // For now, return a basic template
    console.log('[EmailTemplateService] AI generation requested:', description, tone);

    return {
      subject: 'Generated Subject',
      body: `Generated email body based on: ${description}\n\nTone: ${tone || 'professional'}`,
      variables: []
    };
  }
}

export const emailTemplateService = new EmailTemplateService();
export default emailTemplateService;
