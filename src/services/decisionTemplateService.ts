import { supabase } from './supabaseClient';

/**
 * Decision Template Service
 * Manages decision templates for quick decision creation
 * Phase 2: Decision-to-Task Pipeline
 */

export interface DecisionTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  title_template: string;
  description_template?: string;
  suggested_tasks: SuggestedTask[];
  default_decision_type?: string;
  usage_count: number;
  last_used_at?: string;
  is_active: boolean;
  is_system: boolean;
  created_by?: string;
  workspace_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SuggestedTask {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  deadline_offset_days?: number;
}

export interface TemplateVariables {
  [key: string]: string;
}

export const decisionTemplateService = {
  /**
   * Get all active templates (system + workspace)
   */
  async getTemplates(workspaceId?: string): Promise<DecisionTemplate[]> {
    let query = supabase
      .from('decision_templates')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    // Get both system templates (workspace_id = null) and workspace-specific templates
    if (workspaceId) {
      query = query.or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`);
    } else {
      query = query.is('workspace_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: string, workspaceId?: string): Promise<DecisionTemplate[]> {
    const templates = await this.getTemplates(workspaceId);
    return templates.filter(t => t.category === category);
  },

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string): Promise<DecisionTemplate | null> {
    const { data, error } = await supabase
      .from('decision_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      return null;
    }

    return data;
  },

  /**
   * Create a custom template
   */
  async createTemplate(template: Omit<DecisionTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'last_used_at'>): Promise<DecisionTemplate | null> {
    const { data, error } = await supabase
      .from('decision_templates')
      .insert({
        ...template,
        is_system: false, // User templates are never system templates
        usage_count: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return null;
    }

    return data;
  },

  /**
   * Update a template (non-system only)
   */
  async updateTemplate(id: string, updates: Partial<DecisionTemplate>): Promise<boolean> {
    const { error } = await supabase
      .from('decision_templates')
      .update(updates)
      .eq('id', id)
      .eq('is_system', false); // Can only update non-system templates

    if (error) {
      console.error('Error updating template:', error);
      return false;
    }

    return true;
  },

  /**
   * Delete a template (non-system only)
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('decision_templates')
      .delete()
      .eq('id', id)
      .eq('is_system', false); // Can only delete non-system templates

    if (error) {
      console.error('Error deleting template:', error);
      return false;
    }

    return true;
  },

  /**
   * Apply template to create decision data
   * Fills in template variables with provided values
   */
  applyTemplate(
    template: DecisionTemplate,
    variables: TemplateVariables = {}
  ): {
    title: string;
    description?: string;
    decision_type: string;
    template_id: string;
    suggested_tasks: SuggestedTask[];
  } {
    // Replace variables in title template
    let title = template.title_template;
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      title = title.replace(new RegExp(placeholder, 'g'), value);
    });

    // Replace variables in description template
    let description = template.description_template;
    if (description) {
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        description = description!.replace(new RegExp(placeholder, 'g'), value);
      });
    }

    return {
      title,
      description,
      decision_type: template.default_decision_type || 'consensus',
      template_id: template.id,
      suggested_tasks: template.suggested_tasks
    };
  },

  /**
   * Extract template variables from template string
   * Returns array of variable names found in {curly braces}
   */
  extractVariables(templateString: string): string[] {
    const matches = templateString.match(/\{([^}]+)\}/g);
    if (!matches) return [];

    return matches.map(match => match.slice(1, -1)); // Remove { and }
  },

  /**
   * Get all categories with template counts
   */
  async getCategories(workspaceId?: string): Promise<Array<{ category: string; count: number; icon?: string }>> {
    const templates = await this.getTemplates(workspaceId);

    const categoryMap = new Map<string, { count: number; icon?: string }>();

    templates.forEach(template => {
      const category = template.category || 'Other';
      const existing = categoryMap.get(category) || { count: 0 };
      categoryMap.set(category, {
        count: existing.count + 1,
        icon: template.icon || existing.icon
      });
    });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.count - a.count);
  },

  /**
   * Track template usage (increments usage_count)
   * Called when a decision is created from a template
   */
  async trackUsage(templateId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_template_usage', {
      template_id: templateId
    });

    if (error) {
      console.error('Error tracking template usage:', error);
    }
  }
};
