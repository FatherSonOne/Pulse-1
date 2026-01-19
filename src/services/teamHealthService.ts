import { supabase } from './supabaseClient';

export interface TeamHealthMetrics {
  communicationHealth: {
    avgResponseTime: number; // minutes
    messageVolume: { sent: number; received: number };
    activeConversations: number;
    unreadCount: number;
    engagementScore: number; // 0-100
  };
  votes: {
    activeDecisions: number;
    pendingVotes: number;
    consensusRate: number; // 0-100
    decisionsMade: number;
  };
  projects: {
    activeOutcomes: number;
    completionRate: number; // 0-100
    avgProgress: number; // 0-100
    blockers: number;
  };
}

/**
 * Calculate team health metrics for a list of team member user IDs
 */
export async function calculateTeamHealthMetrics(
  teamMemberIds: string[],
  currentUserId: string
): Promise<TeamHealthMetrics> {
  if (teamMemberIds.length === 0) {
    return getEmptyMetrics();
  }

  // Calculate communication health
  const communicationHealth = await calculateCommunicationHealth(
    teamMemberIds,
    currentUserId
  );

  // Calculate votes/decisions metrics
  const votes = await calculateVotesMetrics(teamMemberIds, currentUserId);

  // Calculate projects/outcomes metrics
  const projects = await calculateProjectsMetrics(teamMemberIds, currentUserId);

  return {
    communicationHealth,
    votes,
    projects,
  };
}

async function calculateCommunicationHealth(
  teamMemberIds: string[],
  currentUserId: string
): Promise<TeamHealthMetrics['communicationHealth']> {
  try {
    // Get conversations with team members
    const { data: conversations } = await supabase
      .from('pulse_conversations')
      .select('*')
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
      .order('last_message_at', { ascending: false });

    if (!conversations || conversations.length === 0) {
      return {
        avgResponseTime: 0,
        messageVolume: { sent: 0, received: 0 },
        activeConversations: 0,
        unreadCount: 0,
        engagementScore: 0,
      };
    }

    // Filter to only conversations with team members
    const teamConversations = conversations.filter(conv => {
      const otherUserId = conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id;
      return teamMemberIds.includes(otherUserId);
    });

    const conversationIds = teamConversations.map(c => c.id);
    if (conversationIds.length === 0) {
      return {
        avgResponseTime: 0,
        messageVolume: { sent: 0, received: 0 },
        activeConversations: teamConversations.length,
        unreadCount: 0,
        engagementScore: 0,
      };
    }

    // Get messages from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: messages } = await supabase
      .from('pulse_messages')
      .select('*')
      .in('thread_id', conversationIds)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return {
        avgResponseTime: 0,
        messageVolume: { sent: 0, received: 0 },
        activeConversations: teamConversations.length,
        unreadCount: 0,
        engagementScore: 0,
      };
    }

    // Calculate sent/received
    const sent = messages.filter(m => m.sender_id === currentUserId).length;
    const received = messages.filter(m => m.recipient_id === currentUserId).length;

    // Calculate response times (time between received message and sent reply)
    const responseTimes: number[] = [];
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      const nextMsg = messages[i + 1];

      // If we received a message and then sent a reply
      if (msg.recipient_id === currentUserId && nextMsg.sender_id === currentUserId && msg.thread_id === nextMsg.thread_id) {
        const responseTime = (new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime()) / (1000 * 60); // minutes
        if (responseTime > 0 && responseTime < 1440) { // Less than 24 hours
          responseTimes.push(responseTime);
        }
      }
    }

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Calculate unread count
    const unreadCount = teamConversations.reduce((sum, conv) => {
      return sum + (conv.user1_id === currentUserId ? conv.user1_unread_count : conv.user2_unread_count);
    }, 0);

    // Calculate engagement score (0-100)
    // Based on: message volume, response time, conversation activity
    const messageVolumeScore = Math.min(100, (sent + received) * 2); // Up to 50 messages = 100
    const responseTimeScore = avgResponseTime > 0 ? Math.max(0, 100 - (avgResponseTime / 60) * 10) : 50; // Better response time = higher score
    const activityScore = teamConversations.length > 0 ? Math.min(100, teamConversations.length * 10) : 0;

    const engagementScore = Math.round((messageVolumeScore * 0.4 + responseTimeScore * 0.3 + activityScore * 0.3));

    return {
      avgResponseTime: Math.round(avgResponseTime * 10) / 10,
      messageVolume: { sent, received },
      activeConversations: teamConversations.length,
      unreadCount,
      engagementScore: Math.min(100, Math.max(0, engagementScore)),
    };
  } catch (error) {
    console.error('Error calculating communication health:', error);
    return {
      avgResponseTime: 0,
      messageVolume: { sent: 0, received: 0 },
      activeConversations: 0,
      unreadCount: 0,
      engagementScore: 0,
    };
  }
}

async function calculateVotesMetrics(
  teamMemberIds: string[],
  currentUserId: string
): Promise<TeamHealthMetrics['votes']> {
  try {
    // Get all decisions where team members are involved
    // Since decisions are workspace-based, we'll need to get decisions from workspaces
    // For now, we'll calculate based on the user's decisions and votes
    // TODO: Enhance when team workspaces are implemented

    // Get user's decisions
    const { data: decisions } = await supabase
      .from('decisions')
      .select('*, votes:decision_votes(*)')
      .eq('created_by', currentUserId)
      .or('status.eq.open,status.eq.approved');

    if (!decisions) {
      return {
        activeDecisions: 0,
        pendingVotes: 0,
        consensusRate: 0,
        decisionsMade: 0,
      };
    }

    const activeDecisions = decisions.filter(d => d.status === 'open').length;
    const decisionsMade = decisions.filter(d => d.status === 'approved' || d.status === 'rejected').length;

    // Calculate pending votes (decisions where user hasn't voted yet)
    let pendingVotes = 0;
    for (const decision of decisions) {
      if (decision.status === 'open') {
        const hasVoted = decision.votes && decision.votes.some((v: any) => v.user_id === currentUserId);
        if (!hasVoted) {
          pendingVotes++;
        }
      }
    }

    // Calculate consensus rate (approve votes / total votes)
    let totalVotes = 0;
    let approveVotes = 0;
    for (const decision of decisions) {
      if (decision.votes && decision.votes.length > 0) {
        totalVotes += decision.votes.length;
        approveVotes += decision.votes.filter((v: any) => v.choice === 'approve').length;
      }
    }

    const consensusRate = totalVotes > 0
      ? Math.round((approveVotes / totalVotes) * 100)
      : 0;

    return {
      activeDecisions,
      pendingVotes,
      consensusRate,
      decisionsMade,
    };
  } catch (error) {
    console.error('Error calculating votes metrics:', error);
    return {
      activeDecisions: 0,
      pendingVotes: 0,
      consensusRate: 0,
      decisionsMade: 0,
    };
  }
}

async function calculateProjectsMetrics(
  teamMemberIds: string[],
  currentUserId: string
): Promise<TeamHealthMetrics['projects']> {
  try {
    // Get workspace outcomes
    const { data: outcomes } = await supabase
      .from('workspace_outcomes')
      .select('*')
      .in('workspace_id', []) // TODO: Filter by team workspaces when implemented
      .or('status.eq.on_track,status.eq.at_risk,status.eq.blocked');

    // For now, get user's outcomes
    const { data: userOutcomes } = await supabase
      .from('workspace_outcomes')
      .select('*')
      .neq('status', 'completed');

    if (!userOutcomes || userOutcomes.length === 0) {
      return {
        activeOutcomes: 0,
        completionRate: 0,
        avgProgress: 0,
        blockers: 0,
      };
    }

    const activeOutcomes = userOutcomes.length;
    const completedOutcomes = userOutcomes.filter(o => o.status === 'completed').length;
    const completionRate = activeOutcomes > 0
      ? Math.round((completedOutcomes / activeOutcomes) * 100)
      : 0;

    const avgProgress = userOutcomes.length > 0
      ? Math.round(userOutcomes.reduce((sum, o) => sum + (o.progress || 0), 0) / userOutcomes.length)
      : 0;

    // Count blockers (outcomes with status 'blocked' or 'at_risk')
    const blockers = userOutcomes.filter(o => o.status === 'blocked' || o.status === 'at_risk').length;

    return {
      activeOutcomes,
      completionRate,
      avgProgress,
      blockers,
    };
  } catch (error) {
    console.error('Error calculating projects metrics:', error);
    return {
      activeOutcomes: 0,
      completionRate: 0,
      avgProgress: 0,
      blockers: 0,
    };
  }
}

function getEmptyMetrics(): TeamHealthMetrics {
  return {
    communicationHealth: {
      avgResponseTime: 0,
      messageVolume: { sent: 0, received: 0 },
      activeConversations: 0,
      unreadCount: 0,
      engagementScore: 0,
    },
    votes: {
      activeDecisions: 0,
      pendingVotes: 0,
      consensusRate: 0,
      decisionsMade: 0,
    },
    projects: {
      activeOutcomes: 0,
      completionRate: 0,
      avgProgress: 0,
      blockers: 0,
    },
  };
}