// src/services/aiLabService.ts
import { supabase } from './supabase';
import { dataService } from './dataService';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: Array<{
    agentId: string;
    prompt?: string;
    useOutputFromPrevious?: boolean;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  agentId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const aiLabService = {
  // ==================== WORKFLOWS ====================

  async getWorkflows(): Promise<Workflow[]> {
    const userId = dataService.getUserId();
    const { data, error } = await supabase
      .from('ai_lab_workflows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workflows:', error);
      return [];
    }

    return (data || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      steps: w.steps || [],
      createdAt: w.created_at ? new Date(w.created_at) : undefined,
      updatedAt: w.updated_at ? new Date(w.updated_at) : undefined,
    }));
  },

  async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow | null> {
    const userId = dataService.getUserId();
    const { data, error } = await supabase
      .from('ai_lab_workflows')
      .insert([{
        user_id: userId,
        name: workflow.name,
        description: workflow.description,
        steps: workflow.steps,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating workflow:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      steps: data.steps || [],
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    };
  },

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow | null> {
    const { data, error } = await supabase
      .from('ai_lab_workflows')
      .update({
        name: updates.name,
        description: updates.description,
        steps: updates.steps,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workflow:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      steps: data.steps || [],
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    };
  },

  async deleteWorkflow(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('ai_lab_workflows')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting workflow:', error);
      return false;
    }
    return true;
  },

  // ==================== TEMPLATES ====================

  async getTemplates(): Promise<PromptTemplate[]> {
    const userId = dataService.getUserId();
    const { data, error } = await supabase
      .from('ai_lab_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      prompt: t.prompt,
      agentId: t.agent_id,
      createdAt: t.created_at ? new Date(t.created_at) : undefined,
      updatedAt: t.updated_at ? new Date(t.updated_at) : undefined,
    }));
  },

  async createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptTemplate | null> {
    const userId = dataService.getUserId();
    const { data, error } = await supabase
      .from('ai_lab_templates')
      .insert([{
        user_id: userId,
        name: template.name,
        prompt: template.prompt,
        agent_id: template.agentId,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      prompt: data.prompt,
      agentId: data.agent_id,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    };
  },

  async updateTemplate(id: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate | null> {
    const { data, error } = await supabase
      .from('ai_lab_templates')
      .update({
        name: updates.name,
        prompt: updates.prompt,
        agent_id: updates.agentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      prompt: data.prompt,
      agentId: data.agent_id,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    };
  },

  async deleteTemplate(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('ai_lab_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      return false;
    }
    return true;
  },
};
