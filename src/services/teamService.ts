import { supabase } from './supabaseClient';

export interface Team {
  id: string;
  userId: string;
  name: string;
  description?: string;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  memberType: 'pulse_user' | 'contact';
  memberId: string;
  role: 'owner' | 'admin' | 'member';
  addedAt: string;
  // Resolved data (populated when fetching)
  name?: string;
  avatarColor?: string;
  status?: 'online' | 'offline' | 'busy' | 'away';
  isPulseUser?: boolean;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

class TeamService {
  /**
   * Get current user ID
   */
  private async getUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    return user.id;
  }

  /**
   * Create a new team
   */
  async createTeam(
    name: string,
    description?: string,
    avatarColor?: string,
    memberIds?: Array<{ type: 'pulse_user' | 'contact'; id: string }>
  ): Promise<TeamWithMembers> {
    const userId = await this.getUserId();

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('user_teams')
      .insert({
        user_id: userId,
        name,
        description,
        avatar_color: avatarColor || '#ec4899',
      })
      .select()
      .single();

    if (teamError) throw teamError;

    // Add members if provided
    if (memberIds && memberIds.length > 0) {
      await this.addMembers(team.id, memberIds);
    }

    // Fetch team with members
    return this.getTeam(team.id) as Promise<TeamWithMembers>;
  }

  /**
   * Get all teams for current user
   */
  async getTeams(): Promise<TeamWithMembers[]> {
    const userId = await this.getUserId();

    const { data: teams, error } = await supabase
      .from('user_teams')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Fetch members for each team
    const teamsWithMembers = await Promise.all(
      (teams || []).map(async (team) => {
        const members = await this.getTeamMembers(team.id);
        return {
          ...team,
          userId: team.user_id,
          avatarColor: team.avatar_color,
          createdAt: team.created_at,
          updatedAt: team.updated_at,
          members,
        } as TeamWithMembers;
      })
    );

    return teamsWithMembers;
  }

  /**
   * Get a single team by ID
   */
  async getTeam(teamId: string): Promise<TeamWithMembers | null> {
    const userId = await this.getUserId();

    const { data: team, error } = await supabase
      .from('user_teams')
      .select('*')
      .eq('id', teamId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    const members = await this.getTeamMembers(teamId);

    return {
      ...team,
      userId: team.user_id,
      avatarColor: team.avatar_color,
      createdAt: team.created_at,
      updatedAt: team.updated_at,
      members,
    } as TeamWithMembers;
  }

  /**
   * Update a team
   */
  async updateTeam(
    teamId: string,
    updates: Partial<Pick<Team, 'name' | 'description' | 'avatarColor'>>
  ): Promise<Team> {
    const userId = await this.getUserId();

    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.avatarColor) updateData.avatar_color = updates.avatarColor;

    const { data: team, error } = await supabase
      .from('user_teams')
      .update(updateData)
      .eq('id', teamId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return {
      ...team,
      userId: team.user_id,
      avatarColor: team.avatar_color,
      createdAt: team.created_at,
      updatedAt: team.updated_at,
    } as Team;
  }

  /**
   * Delete a team
   */
  async deleteTeam(teamId: string): Promise<void> {
    const userId = await this.getUserId();

    const { error } = await supabase
      .from('user_teams')
      .delete()
      .eq('id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Get members of a team
   */
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const { data: members, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('added_at', { ascending: true });

    if (error) throw error;

    // Resolve member data (names, avatars, etc.)
    const resolvedMembers = await Promise.all(
      (members || []).map(async (member) => {
        const resolved: TeamMember = {
          id: member.id,
          teamId: member.team_id,
          memberType: member.member_type as 'pulse_user' | 'contact',
          memberId: member.member_id,
          role: member.role as 'owner' | 'admin' | 'member',
          addedAt: member.added_at,
          isPulseUser: member.member_type === 'pulse_user',
        };

        // Fetch member details
        if (member.member_type === 'pulse_user') {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('display_name, full_name, avatar_url')
            .eq('id', member.member_id)
            .single();

          if (profile) {
            resolved.name = profile.display_name || profile.full_name || 'Pulse User';
            resolved.avatarColor = 'bg-gradient-to-tr from-emerald-500 to-cyan-500';
            resolved.status = 'online'; // TODO: Get real status from presence system
          }
        } else {
          // Contact
          const { data: contact } = await supabase
            .from('contacts')
            .select('name, avatar_color, status')
            .eq('id', member.member_id)
            .single();

          if (contact) {
            resolved.name = contact.name;
            resolved.avatarColor = contact.avatar_color;
            resolved.status = contact.status as 'online' | 'offline' | 'busy' | 'away';
          }
        }

        return resolved;
      })
    );

    return resolvedMembers;
  }

  /**
   * Add members to a team
   */
  async addMembers(
    teamId: string,
    members: Array<{ type: 'pulse_user' | 'contact'; id: string }>
  ): Promise<void> {
    const userId = await this.getUserId();

    // Verify team ownership
    const { data: team } = await supabase
      .from('user_teams')
      .select('id')
      .eq('id', teamId)
      .eq('user_id', userId)
      .single();

    if (!team) throw new Error('Team not found or access denied');

    // Insert members
    const membersToInsert = members.map(m => ({
      team_id: teamId,
      member_type: m.type,
      member_id: m.id,
      role: 'member' as const,
    }));

    const { error } = await supabase
      .from('team_members')
      .insert(membersToInsert);

    if (error) throw error;
  }

  /**
   * Remove a member from a team
   */
  async removeMember(teamId: string, memberId: string): Promise<void> {
    const userId = await this.getUserId();

    // Verify team ownership
    const { data: team } = await supabase
      .from('user_teams')
      .select('id')
      .eq('id', teamId)
      .eq('user_id', userId)
      .single();

    if (!team) throw new Error('Team not found or access denied');

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('member_id', memberId);

    if (error) throw error;
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    teamId: string,
    memberId: string,
    role: 'owner' | 'admin' | 'member'
  ): Promise<void> {
    const userId = await this.getUserId();

    // Verify team ownership
    const { data: team } = await supabase
      .from('user_teams')
      .select('id')
      .eq('id', teamId)
      .eq('user_id', userId)
      .single();

    if (!team) throw new Error('Team not found or access denied');

    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('member_id', memberId);

    if (error) throw error;
  }
}

export const teamService = new TeamService();