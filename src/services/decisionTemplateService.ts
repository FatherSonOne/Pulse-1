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
  /** Wizard state snapshot. Null for legacy system templates. Phase 1.8. */
  template_config?: WizardTemplateConfig | null;
}

/** Wizard state snapshot persisted on a template. */
export interface WizardTemplateConfig {
  frameId: string;
  step2: Record<string, unknown>;
  step4: {
    decideByDate: string | null;
    shipByDate: string | null;
    checkInCadence: 'none' | 'daily' | 'twice_weekly' | 'weekly';
    remindBeforeDays: 0 | 1 | 3 | 7;
    retrospectiveDays: 0 | 30 | 60 | 90;
  };
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
  },

  /**
   * Phase 1.8: Save the wizard state as a reusable template.
   *
   * Personal templates have is_system=false and a created_by. Workspace-shared
   * templates set workspace_id to the current workspace; personal-only
   * templates leave workspace_id null so they don't leak across workspaces.
   *
   * The legacy title_template / description_template columns are still
   * required by the schema — we synthesize lightweight string templates
   * from the wizard's frame so old code paths keep working until they're
   * migrated.
   */
  async saveWizardAsTemplate(opts: {
    workspaceId: string;
    userId: string;
    templateName: string;
    description?: string;
    config: WizardTemplateConfig;
    sharedWithWorkspace: boolean;
    /** Synthesized from the frame's deriveDecisionTitle for legacy compat. */
    titleTemplate: string;
    /** Synthesized from the frame's deriveDecisionDescription. */
    descriptionTemplate?: string;
    suggestedTasks: SuggestedTask[];
    defaultDecisionType?: string;
    category?: string;
  }): Promise<DecisionTemplate | null> {
    const { data, error } = await supabase
      .from('decision_templates')
      .insert({
        name: opts.templateName,
        description: opts.description ?? null,
        category: opts.category ?? null,
        icon: null,
        title_template: opts.titleTemplate,
        description_template: opts.descriptionTemplate ?? null,
        suggested_tasks: opts.suggestedTasks,
        default_decision_type: opts.defaultDecisionType ?? 'consensus',
        is_system: false,
        is_active: true,
        created_by: opts.userId,
        workspace_id: opts.sharedWithWorkspace ? opts.workspaceId : null,
        template_config: opts.config,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving wizard as template:', error);
      return null;
    }
    return data as DecisionTemplate;
  },

  /**
   * Phase 1.8: Load a saved template back into wizard state.
   * Returns null for legacy templates (template_config is null).
   */
  async loadTemplateAsWizardState(templateId: string): Promise<WizardTemplateConfig | null> {
    const { data, error } = await supabase
      .from('decision_templates')
      .select('template_config')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      console.error('Error loading template:', error);
      return null;
    }
    return (data.template_config as WizardTemplateConfig | null) ?? null;
  },

  /**
   * Phase 1.8: List personal and workspace-shared templates for the wizard's
   * "start from a saved template" surface. Personal templates (created_by =
   * userId, workspace_id null) and workspace-shared templates (workspace_id
   * = workspaceId) both surface; legacy system templates are excluded.
   */
  async listPersonalTemplates(workspaceId: string, userId: string): Promise<DecisionTemplate[]> {
    const { data, error } = await supabase
      .from('decision_templates')
      .select('*')
      .eq('is_active', true)
      .eq('is_system', false)
      .or(`created_by.eq.${userId},workspace_id.eq.${workspaceId}`)
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error listing personal templates:', error);
      return [];
    }
    return (data ?? []) as DecisionTemplate[];
  }
};
