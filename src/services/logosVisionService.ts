// ============================================
// LOGOS VISION CRM SERVICE
// Direct Supabase connection to Logos Vision database
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  LogosProject,
  LogosClient,
  LogosCase,
  LogosCaseComment,
  LogosTask,
  LogosActivity,
  LogosTeamMember,
  LogosVolunteer,
  LogosDonation,
} from '../types/logosVisionTypes';

/**
 * Logos Vision CRM Service
 * Handles all communication with Logos Vision Supabase database
 */
export class LogosVisionService {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  // ==================== PROJECTS ====================

  /**
   * Get all projects from Logos Vision
   */
  async getProjects(filters?: {
    status?: string;
    clientId?: string;
  }): Promise<LogosProject[]> {
    try {
      let query = this.client
        .from('projects')
        .select('*, clients(name), team_members!projects_created_by_id_fkey(name)');

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((p: any) => this.mapToLogosProject(p));
    } catch (error) {
      throw this.handleError('Failed to fetch projects', error);
    }
  }

  /**
   * Get single project by ID
   */
  async getProject(projectId: string): Promise<LogosProject> {
    try {
      const { data, error } = await this.client
        .from('projects')
        .select('*, clients(name), team_members!projects_created_by_id_fkey(name)')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      return this.mapToLogosProject(data);
    } catch (error) {
      throw this.handleError('Failed to fetch project', error);
    }
  }

  /**
   * Get project team members
   */
  async getProjectTeamMembers(projectId: string): Promise<LogosTeamMember[]> {
    try {
      const { data, error } = await this.client
        .from('project_team_members')
        .select('team_members(*)')
        .eq('project_id', projectId);

      if (error) throw error;

      return (data || []).map((ptm: any) => this.mapToLogosTeamMember(ptm.team_members));
    } catch (error) {
      throw this.handleError('Failed to fetch project team members', error);
    }
  }

  // ==================== CLIENTS ====================

  /**
   * Get all clients from Logos Vision
   */
  async getClients(filters?: {
    isActive?: boolean;
  }): Promise<LogosClient[]> {
    try {
      let query = this.client.from('clients').select('*');

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((c: any) => this.mapToLogosClient(c));
    } catch (error) {
      throw this.handleError('Failed to fetch clients', error);
    }
  }

  /**
   * Get single client by ID
   */
  async getClient(clientId: string): Promise<LogosClient> {
    try {
      const { data, error } = await this.client
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) throw error;

      return this.mapToLogosClient(data);
    } catch (error) {
      throw this.handleError('Failed to fetch client', error);
    }
  }

  // ==================== CASES ====================

  /**
   * Get all cases from Logos Vision
   */
  async getCases(filters?: {
    clientId?: string;
    status?: string;
  }): Promise<LogosCase[]> {
    try {
      let query = this.client
        .from('cases')
        .select('*, clients(name), team_members(name)');

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((c: any) => this.mapToLogosCase(c));
    } catch (error) {
      throw this.handleError('Failed to fetch cases', error);
    }
  }

  /**
   * Get single case by ID
   */
  async getCase(caseId: string): Promise<LogosCase> {
    try {
      const { data, error } = await this.client
        .from('cases')
        .select('*, clients(name), team_members(name)')
        .eq('id', caseId)
        .single();

      if (error) throw error;

      return this.mapToLogosCase(data);
    } catch (error) {
      throw this.handleError('Failed to fetch case', error);
    }
  }

  /**
   * Get case comments
   */
  async getCaseComments(caseId: string): Promise<LogosCaseComment[]> {
    try {
      const { data, error } = await this.client
        .from('case_comments')
        .select('*, team_members(name)')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((cc: any) => this.mapToLogosCaseComment(cc));
    } catch (error) {
      throw this.handleError('Failed to fetch case comments', error);
    }
  }

  // ==================== TASKS ====================

  /**
   * Get all tasks for a project
   */
  async getTasks(projectId: string): Promise<LogosTask[]> {
    try {
      const { data, error } = await this.client
        .from('tasks')
        .select('*, projects(name), team_members(name)')
        .eq('project_id', projectId);

      if (error) throw error;

      return (data || []).map((t: any) => this.mapToLogosTask(t));
    } catch (error) {
      throw this.handleError('Failed to fetch tasks', error);
    }
  }

  /**
   * Get all tasks (across all projects)
   */
  async getAllTasks(filters?: {
    status?: string;
    teamMemberId?: string;
  }): Promise<LogosTask[]> {
    try {
      let query = this.client
        .from('tasks')
        .select('*, projects(name), team_members(name)');

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.teamMemberId) {
        query = query.eq('team_member_id', filters.teamMemberId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((t: any) => this.mapToLogosTask(t));
    } catch (error) {
      throw this.handleError('Failed to fetch tasks', error);
    }
  }

  // ==================== ACTIVITIES ====================

  /**
   * Get all activities
   */
  async getActivities(filters?: {
    clientId?: string;
    projectId?: string;
    type?: string;
  }): Promise<LogosActivity[]> {
    try {
      let query = this.client
        .from('activities')
        .select('*, clients(name), projects(name), team_members(name)');

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((a: any) => this.mapToLogosActivity(a));
    } catch (error) {
      throw this.handleError('Failed to fetch activities', error);
    }
  }

  /**
   * Create activity in Logos Vision
   */
  async createActivity(
    type: string,
    title: string,
    activityDate: Date,
    data: Partial<LogosActivity>
  ): Promise<LogosActivity> {
    try {
      const { data: result, error } = await this.client
        .from('activities')
        .insert({
          type,
          title,
          activity_date: activityDate.toISOString().split('T')[0],
          description: data.description,
          client_id: data.clientId,
          project_id: data.projectId,
          status: data.status || 'Scheduled',
          duration_minutes: data.durationMinutes,
          location: data.location,
          notes: data.notes,
          shared_with_client: data.sharedWithClient || false,
          created_by_id: data.createdById,
        })
        .select()
        .single();

      if (error) throw error;

      return this.mapToLogosActivity(result);
    } catch (error) {
      throw this.handleError('Failed to create activity', error);
    }
  }

  // ==================== TEAM MEMBERS ====================

  /**
   * Get all team members
   */
  async getTeamMembers(filters?: {
    isActive?: boolean;
  }): Promise<LogosTeamMember[]> {
    try {
      let query = this.client.from('team_members').select('*');

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((tm: any) => this.mapToLogosTeamMember(tm));
    } catch (error) {
      throw this.handleError('Failed to fetch team members', error);
    }
  }

  // ==================== VOLUNTEERS ====================

  /**
   * Get all volunteers
   */
  async getVolunteers(filters?: {
    isActive?: boolean;
  }): Promise<LogosVolunteer[]> {
    try {
      let query = this.client.from('volunteers').select('*');

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((v: any) => this.mapToLogosVolunteer(v));
    } catch (error) {
      throw this.handleError('Failed to fetch volunteers', error);
    }
  }

  // ==================== DONATIONS ====================

  /**
   * Get donations
   */
  async getDonations(filters?: {
    clientId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<LogosDonation[]> {
    try {
      let query = this.client.from('donations').select('*');

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.startDate) {
        query = query.gte('donation_date', filters.startDate.toISOString().split('T')[0]);
      }
      if (filters?.endDate) {
        query = query.lte('donation_date', filters.endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((d: any) => this.mapToLogosDonation(d));
    } catch (error) {
      throw this.handleError('Failed to fetch donations', error);
    }
  }

  // ==================== HEALTH CHECK ====================

  /**
   * Check connection to Logos Vision database
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('clients')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Logos Vision health check failed', error);
      return false;
    }
  }

  // ==================== PRIVATE MAPPING METHODS ====================

  private mapToLogosProject(data: any): LogosProject {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      clientId: data.client_id,
      clientName: data.clients?.name,
      status: data.status,
      startDate: data.start_date ? new Date(data.start_date) : undefined,
      endDate: data.end_date ? new Date(data.end_date) : undefined,
      budget: data.budget,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdById: data.created_by_id,
      externalId: data.id,
    };
  }

  private mapToLogosClient(data: any): LogosClient {
    return {
      id: data.id,
      name: data.name,
      contactPerson: data.contact_person,
      email: data.email,
      phone: data.phone,
      location: data.location,
      address: data.address,
      website: data.website,
      notes: data.notes,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      externalId: data.id,
    };
  }

  private mapToLogosCase(data: any): LogosCase {
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      clientId: data.client_id,
      clientName: data.clients?.name,
      assignedToId: data.assigned_to_id,
      assignedToName: data.team_members?.name,
      status: data.status,
      priority: data.priority,
      category: data.category,
      openedDate: new Date(data.opened_date),
      closedDate: data.closed_date ? new Date(data.closed_date) : undefined,
      resolution: data.resolution,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      externalId: data.id,
    };
  }

  private mapToLogosCaseComment(data: any): LogosCaseComment {
    return {
      id: data.id,
      caseId: data.case_id,
      authorId: data.author_id,
      authorName: data.team_members?.name,
      content: data.content,
      isPrivate: data.is_private || false,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      externalId: data.id,
    };
  }

  private mapToLogosTask(data: any): LogosTask {
    return {
      id: data.id,
      projectId: data.project_id,
      projectName: data.projects?.name,
      description: data.description,
      teamMemberId: data.team_member_id,
      teamMemberName: data.team_members?.name,
      status: data.status,
      dueDate: data.due_date ? new Date(data.due_date) : undefined,
      completedDate: data.completed_date ? new Date(data.completed_date) : undefined,
      priority: data.priority,
      phase: data.phase,
      notes: data.notes,
      sharedWithClient: data.shared_with_client || false,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      externalId: data.id,
    };
  }

  private mapToLogosActivity(data: any): LogosActivity {
    return {
      id: data.id,
      type: data.type,
      title: data.title,
      description: data.description,
      clientId: data.client_id,
      projectId: data.project_id,
      status: data.status,
      activityDate: new Date(data.activity_date),
      durationMinutes: data.duration_minutes,
      location: data.location,
      notes: data.notes,
      sharedWithClient: data.shared_with_client || false,
      createdById: data.created_by_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      externalId: data.id,
    };
  }

  private mapToLogosTeamMember(data: any): LogosTeamMember {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      bio: data.bio,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      externalId: data.id,
    };
  }

  private mapToLogosVolunteer(data: any): LogosVolunteer {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      location: data.location,
      skills: data.skills || [],
      availability: data.availability,
      assignedProjectIds: data.assigned_project_ids || [],
      assignedClientIds: data.assigned_client_ids || [],
      isActive: data.is_active !== false,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      externalId: data.id,
    };
  }

  private mapToLogosDonation(data: any): LogosDonation {
    return {
      id: data.id,
      donorName: data.donor_name,
      clientId: data.client_id,
      amount: data.amount,
      donationDate: new Date(data.donation_date),
      campaign: data.campaign,
      paymentMethod: data.payment_method,
      receiptNumber: data.receipt_number,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      externalId: data.id,
    };
  }

  private handleError(message: string, error: any): Error {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`${message}:`, errorMessage);
    return new Error(`${message}: ${errorMessage}`);
  }
}

// Export singleton instance
export const logosVisionService = new LogosVisionService(
  import.meta.env.VITE_LOGOS_VISION_SUPABASE_URL || '',
  import.meta.env.VITE_LOGOS_VISION_SUPABASE_KEY || ''
);
