// ============================================
// RELATIONSHIP INTELLIGENCE SERVICE
// Core service for relationship management, scoring, and AI insights
// ============================================

import { supabase } from './supabase';
import { askAI } from './unifiedAIService';
import {
  RelationshipProfile,
  RelationshipProfileRow,
  ContactInteraction,
  ContactInteractionRow,
  RelationshipAlert,
  SmartContactGroup,
  SmartContactGroupRow,
  SmartListType,
  SmartListCriteria,
  ProfileQueryOptions,
  RelationshipInsights,
  HealthFactor,
  RelationshipSuggestion,
  EmailAggregation,
  CalendarAggregation,
  MeetingPrepCard,
  MeetingPrepCardRow,
  AttendeeProfile,
  InteractionType,
  SYSTEM_SMART_LISTS,
  RelationshipTrend,
  CommunicationFrequency,
} from '../types/relationshipTypes';

// ==================== TYPE CONVERTERS ====================

function rowToProfile(row: RelationshipProfileRow): RelationshipProfile {
  return {
    id: row.id,
    userId: row.user_id,
    contactEmail: row.contact_email,
    contactName: row.contact_name,
    relationshipScore: row.relationship_score,
    relationshipTrend: row.relationship_trend as RelationshipTrend,
    relationshipType: row.relationship_type as any,
    communicationFrequency: row.communication_frequency as CommunicationFrequency,
    preferredChannel: row.preferred_channel as any,
    avgResponseTimeHours: row.avg_response_time_hours,
    responseRate: row.response_rate,
    totalEmailsSent: row.total_emails_sent,
    totalEmailsReceived: row.total_emails_received,
    totalMeetings: row.total_meetings,
    totalSharedFiles: row.total_shared_files,
    totalCalls: row.total_calls,
    lastEmailSentAt: row.last_email_sent_at ? new Date(row.last_email_sent_at) : undefined,
    lastEmailReceivedAt: row.last_email_received_at ? new Date(row.last_email_received_at) : undefined,
    lastMeetingAt: row.last_meeting_at ? new Date(row.last_meeting_at) : undefined,
    lastCallAt: row.last_call_at ? new Date(row.last_call_at) : undefined,
    lastInteractionAt: row.last_interaction_at ? new Date(row.last_interaction_at) : undefined,
    firstInteractionAt: row.first_interaction_at ? new Date(row.first_interaction_at) : undefined,
    aiCommunicationStyle: row.ai_communication_style as any,
    aiTopics: row.ai_topics,
    aiSentimentAverage: row.ai_sentiment_average,
    aiRelationshipSummary: row.ai_relationship_summary,
    aiTalkingPoints: row.ai_talking_points,
    aiNextActionSuggestion: row.ai_next_action_suggestion,
    aiBuyingSignals: row.ai_buying_signals,
    company: row.company,
    title: row.title,
    department: row.department,
    linkedinUrl: row.linkedin_url,
    twitterHandle: row.twitter_handle,
    phone: row.phone,
    timezone: row.timezone,
    location: row.location,
    extractedSignature: row.extracted_signature,
    canonicalEmail: row.canonical_email,
    mergedFrom: row.merged_from,
    isMerged: row.is_merged,
    customTags: row.custom_tags,
    customNotes: row.custom_notes,
    isFavorite: row.is_favorite,
    isVip: row.is_vip,
    isBlocked: row.is_blocked,
    birthday: row.birthday ? new Date(row.birthday) : undefined,
    anniversary: row.anniversary ? new Date(row.anniversary) : undefined,
    source: row.source as any,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastAnalyzedAt: row.last_analyzed_at ? new Date(row.last_analyzed_at) : undefined,
  };
}

function rowToGroup(row: SmartContactGroupRow): SmartContactGroup {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    groupType: row.group_type as any,
    criteria: row.criteria,
    icon: row.icon,
    color: row.color,
    emoji: row.emoji,
    memberProfileIds: row.member_profile_ids || [],
    memberCount: row.member_count,
    aiConfidence: row.ai_confidence,
    aiReasoning: row.ai_reasoning,
    aiSuggestedAt: row.ai_suggested_at ? new Date(row.ai_suggested_at) : undefined,
    isPinned: row.is_pinned,
    isSystem: row.is_system,
    isHidden: row.is_hidden,
    autoRefresh: row.auto_refresh,
    lastRefreshedAt: row.last_refreshed_at ? new Date(row.last_refreshed_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToMeetingPrepCard(row: MeetingPrepCardRow): MeetingPrepCard {
  return {
    id: row.id,
    userId: row.user_id,
    calendarEventId: row.calendar_event_id,
    eventTitle: row.event_title,
    eventDescription: row.event_description,
    eventStart: new Date(row.event_start),
    eventEnd: row.event_end ? new Date(row.event_end) : undefined,
    eventLocation: row.event_location,
    eventType: row.event_type as any,
    attendeeProfiles: row.attendee_profiles || [],
    attendeeCount: row.attendee_count,
    knownAttendees: row.known_attendees,
    aiSummary: row.ai_summary,
    aiMeetingPurpose: row.ai_meeting_purpose,
    aiTalkingPoints: row.ai_talking_points || [],
    aiQuestionsToAsk: row.ai_questions_to_ask || [],
    aiTopicsToAvoid: row.ai_topics_to_avoid || [],
    aiRelationshipNotes: row.ai_relationship_notes || {},
    aiRecentContext: row.ai_recent_context,
    aiFollowUpItems: row.ai_follow_up_items || [],
    recentEmails: row.recent_emails || [],
    recentMeetings: row.recent_meetings || [],
    sharedFiles: row.shared_files || [],
    openActionItems: row.open_action_items || [],
    userNotes: row.user_notes,
    userObjectives: row.user_objectives || [],
    status: row.status as any,
    viewedAt: row.viewed_at ? new Date(row.viewed_at) : undefined,
    generatedAt: new Date(row.generated_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ==================== RELATIONSHIP INTELLIGENCE SERVICE ====================

export class RelationshipIntelligenceService {
  private userId: string | null = null;

  setUserId(userId: string) {
    this.userId = userId;
  }

  private getUserId(): string {
    if (!this.userId) {
      throw new Error('User ID not set. Call setUserId() first.');
    }
    return this.userId;
  }

  // ==================== PROFILE MANAGEMENT ====================

  async getOrCreateProfile(email: string, name?: string): Promise<RelationshipProfile> {
    const userId = this.getUserId();
    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing profile
    const { data: existing } = await supabase
      .from('relationship_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_email', normalizedEmail)
      .single();

    if (existing) {
      return rowToProfile(existing);
    }

    // Create new profile
    const { data: newProfile, error } = await supabase
      .from('relationship_profiles')
      .insert({
        user_id: userId,
        contact_email: normalizedEmail,
        contact_name: name,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    return rowToProfile(newProfile);
  }

  async getProfile(profileId: string): Promise<RelationshipProfile | null> {
    const userId = this.getUserId();

    const { data, error } = await supabase
      .from('relationship_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return rowToProfile(data);
  }

  async getProfileByEmail(email: string): Promise<RelationshipProfile | null> {
    const userId = this.getUserId();

    const { data, error } = await supabase
      .from('relationship_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_email', email.toLowerCase().trim())
      .single();

    if (error || !data) return null;
    return rowToProfile(data);
  }

  async getProfiles(options: ProfileQueryOptions): Promise<RelationshipProfile[]> {
    let query = supabase
      .from('relationship_profiles')
      .select('*')
      .eq('user_id', options.userId);

    // Apply filters
    if (options.search) {
      query = query.or(`contact_name.ilike.%${options.search}%,contact_email.ilike.%${options.search}%,company.ilike.%${options.search}%`);
    }

    if (options.relationshipTypes?.length) {
      query = query.in('relationship_type', options.relationshipTypes);
    }

    if (options.minScore !== undefined) {
      query = query.gte('relationship_score', options.minScore);
    }

    if (options.maxScore !== undefined) {
      query = query.lte('relationship_score', options.maxScore);
    }

    if (options.trends?.length) {
      query = query.in('relationship_trend', options.trends);
    }

    if (options.frequencies?.length) {
      query = query.in('communication_frequency', options.frequencies);
    }

    if (options.companies?.length) {
      query = query.in('company', options.companies);
    }

    if (options.isVip !== undefined) {
      query = query.eq('is_vip', options.isVip);
    }

    if (options.isFavorite !== undefined) {
      query = query.eq('is_favorite', options.isFavorite);
    }

    if (options.daysSinceContact !== undefined) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.daysSinceContact);
      query = query.lte('last_interaction_at', cutoffDate.toISOString());
    }

    // Sorting
    const sortColumn = {
      score: 'relationship_score',
      lastInteraction: 'last_interaction_at',
      name: 'contact_name',
      company: 'company',
    }[options.sortBy || 'score'];

    query = query.order(sortColumn, { ascending: options.sortOrder === 'asc' });

    // Pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching profiles:', error);
      return [];
    }

    return (data || []).map(rowToProfile);
  }

  async updateProfile(profileId: string, updates: Partial<RelationshipProfile>): Promise<RelationshipProfile | null> {
    const userId = this.getUserId();

    // Convert to snake_case
    const dbUpdates: any = {};
    if (updates.contactName !== undefined) dbUpdates.contact_name = updates.contactName;
    if (updates.relationshipType !== undefined) dbUpdates.relationship_type = updates.relationshipType;
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.customTags !== undefined) dbUpdates.custom_tags = updates.customTags;
    if (updates.customNotes !== undefined) dbUpdates.custom_notes = updates.customNotes;
    if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
    if (updates.isVip !== undefined) dbUpdates.is_vip = updates.isVip;
    if (updates.isBlocked !== undefined) dbUpdates.is_blocked = updates.isBlocked;
    if (updates.birthday !== undefined) dbUpdates.birthday = updates.birthday?.toISOString().split('T')[0];
    if (updates.anniversary !== undefined) dbUpdates.anniversary = updates.anniversary?.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('relationship_profiles')
      .update(dbUpdates)
      .eq('id', profileId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return null;
    }

    return rowToProfile(data);
  }

  // ==================== INTERACTION LOGGING ====================

  async logInteraction(
    profileId: string,
    type: InteractionType,
    date: Date,
    details: Partial<ContactInteraction>
  ): Promise<void> {
    const userId = this.getUserId();

    const { error } = await supabase
      .from('contact_interactions')
      .insert({
        user_id: userId,
        profile_id: profileId,
        interaction_type: type,
        interaction_date: date.toISOString(),
        source_type: details.sourceType,
        source_id: details.sourceId,
        thread_id: details.threadId,
        subject: details.subject,
        snippet: details.snippet,
        sentiment: details.sentiment,
        sentiment_label: details.sentimentLabel,
        participants: details.participants,
        participant_count: details.participantCount || 1,
        has_attachment: details.hasAttachment || false,
        meeting_duration_minutes: details.meetingDurationMinutes,
        meeting_type: details.meetingType,
        response_time_hours: details.responseTimeHours,
        is_response: details.isResponse || false,
      });

    if (error) {
      console.error('Error logging interaction:', error);
    }
  }

  async getInteractions(profileId: string, limit = 50): Promise<ContactInteraction[]> {
    const userId = this.getUserId();

    const { data, error } = await supabase
      .from('contact_interactions')
      .select('*')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .order('interaction_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching interactions:', error);
      return [];
    }

    return (data || []).map((row: ContactInteractionRow) => ({
      id: row.id,
      userId: row.user_id,
      profileId: row.profile_id,
      interactionType: row.interaction_type as InteractionType,
      interactionDate: new Date(row.interaction_date),
      sourceType: row.source_type as any,
      sourceId: row.source_id,
      threadId: row.thread_id,
      subject: row.subject,
      snippet: row.snippet,
      bodyPreview: row.body_preview,
      sentiment: row.sentiment,
      sentimentLabel: row.sentiment_label as any,
      participants: row.participants,
      participantCount: row.participant_count,
      hasAttachment: row.has_attachment,
      attachmentCount: row.attachment_count,
      attachmentTypes: row.attachment_types,
      meetingDurationMinutes: row.meeting_duration_minutes,
      meetingType: row.meeting_type as any,
      meetingOutcome: row.meeting_outcome,
      responseTimeHours: row.response_time_hours,
      isResponse: row.is_response,
      respondedToId: row.responded_to_id,
      aiTopics: row.ai_topics,
      aiActionItems: row.ai_action_items,
      aiKeyPoints: row.ai_key_points,
      createdAt: new Date(row.created_at),
    }));
  }

  // ==================== SCORE COMPUTATION ====================

  async computeRelationshipScore(profileId: string): Promise<number> {
    const profile = await this.getProfile(profileId);
    if (!profile) return 50;

    // Calculate days since last interaction
    const daysSinceInteraction = profile.lastInteractionAt
      ? Math.floor((Date.now() - profile.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const totalInteractions =
      profile.totalEmailsSent +
      profile.totalEmailsReceived +
      profile.totalMeetings +
      profile.totalCalls;

    // Response rate factor (0-25 points)
    const responseRateFactor = (profile.responseRate || 0.5) * 25;

    // Response time factor (0-20 points)
    let responseTimeFactor = 10;
    if (profile.avgResponseTimeHours !== undefined) {
      if (profile.avgResponseTimeHours <= 1) responseTimeFactor = 20;
      else if (profile.avgResponseTimeHours <= 4) responseTimeFactor = 17;
      else if (profile.avgResponseTimeHours <= 24) responseTimeFactor = 14;
      else if (profile.avgResponseTimeHours <= 72) responseTimeFactor = 10;
      else responseTimeFactor = 5;
    }

    // Recency factor (0-25 points)
    let recencyFactor = 12;
    if (daysSinceInteraction !== null) {
      if (daysSinceInteraction <= 1) recencyFactor = 25;
      else if (daysSinceInteraction <= 7) recencyFactor = 22;
      else if (daysSinceInteraction <= 14) recencyFactor = 18;
      else if (daysSinceInteraction <= 30) recencyFactor = 14;
      else if (daysSinceInteraction <= 60) recencyFactor = 10;
      else if (daysSinceInteraction <= 90) recencyFactor = 6;
      else recencyFactor = 2;
    }

    // Volume factor (0-15 points)
    let volumeFactor = totalInteractions;
    if (totalInteractions >= 100) volumeFactor = 15;
    else if (totalInteractions >= 50) volumeFactor = 13;
    else if (totalInteractions >= 20) volumeFactor = 11;
    else if (totalInteractions >= 10) volumeFactor = 9;
    else if (totalInteractions >= 5) volumeFactor = 7;

    // Sentiment factor (0-15 points)
    let sentimentFactor = 7.5;
    if (profile.aiSentimentAverage !== undefined) {
      sentimentFactor = ((profile.aiSentimentAverage + 1) / 2) * 15;
    }

    const score = Math.round(
      responseRateFactor + responseTimeFactor + recencyFactor + volumeFactor + sentimentFactor
    );

    // Clamp to 0-100
    const finalScore = Math.min(Math.max(score, 0), 100);

    // Update the profile with new score
    await supabase
      .from('relationship_profiles')
      .update({
        relationship_score: finalScore,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId);

    return finalScore;
  }

  async computeTrend(profileId: string): Promise<RelationshipTrend> {
    const userId = this.getUserId();

    // Get interactions from last 30 days vs previous 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const { data: recentInteractions } = await supabase
      .from('contact_interactions')
      .select('id')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .gte('interaction_date', thirtyDaysAgo.toISOString())
      .lt('interaction_date', now.toISOString());

    const { data: previousInteractions } = await supabase
      .from('contact_interactions')
      .select('id')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .gte('interaction_date', sixtyDaysAgo.toISOString())
      .lt('interaction_date', thirtyDaysAgo.toISOString());

    const recentCount = recentInteractions?.length || 0;
    const previousCount = previousInteractions?.length || 0;

    let trend: RelationshipTrend = 'stable';
    if (previousCount > 0) {
      const changePercent = ((recentCount - previousCount) / previousCount) * 100;
      if (changePercent >= 20) trend = 'rising';
      else if (changePercent <= -20) trend = 'falling';
    } else if (recentCount > 0) {
      trend = 'rising';
    }

    // Update profile
    await supabase
      .from('relationship_profiles')
      .update({ relationship_trend: trend })
      .eq('id', profileId);

    return trend;
  }

  // ==================== SMART LISTS ====================

  async initializeSmartLists(): Promise<void> {
    const userId = this.getUserId();

    try {
      // Call the database function
      const { error } = await supabase.rpc('initialize_user_smart_lists', { p_user_id: userId });
      if (error) {
        // RPC might not exist if migration hasn't run
        if (error.code === 'PGRST204' || error.message?.includes('function') || error.code === '42883') {
          console.log('initialize_user_smart_lists function not found. Run the migration.');
          return;
        }
        console.error('Error initializing smart lists:', error);
      }
    } catch (err) {
      // Silently fail if migration hasn't been applied
      console.log('Could not initialize smart lists - migration may not be applied yet');
    }
  }

  async getSmartLists(): Promise<SmartContactGroup[]> {
    const userId = this.getUserId();

    try {
      // Ensure smart lists exist
      await this.initializeSmartLists();

      const { data, error } = await supabase
        .from('smart_contact_groups')
        .select('*')
        .eq('user_id', userId)
        .eq('is_hidden', false)
        .order('is_pinned', { ascending: false })
        .order('is_system', { ascending: false })
        .order('name');

      if (error) {
        // Check if table doesn't exist yet
        if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          console.log('Smart contact groups table not yet created. Run the migration.');
          return [];
        }
        console.error('Error fetching smart lists:', error);
        return [];
      }

      return (data || []).map(rowToGroup);
    } catch (err) {
      console.error('Error in getSmartLists:', err);
      return [];
    }
  }

  async getSmartListContacts(listType: SmartListType): Promise<RelationshipProfile[]> {
    const userId = this.getUserId();
    const config = SYSTEM_SMART_LISTS.find(l => l.id === listType);
    if (!config) return [];

    return this.evaluateSmartListCriteria(userId, config.criteria);
  }

  async evaluateSmartListCriteria(userId: string, criteria: SmartListCriteria): Promise<RelationshipProfile[]> {
    let query = supabase
      .from('relationship_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_blocked', false);
    let postFilter: ((rows: RelationshipProfile[]) => RelationshipProfile[]) | null = null;

    switch (criteria.type) {
      case 'needs_follow_up':
        // Contacts where we sent email but haven't received response
        query = query.not('last_email_sent_at', 'is', null);
        if (criteria.daysSinceResponse) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - criteria.daysSinceResponse);
          query = query
            .gte('last_email_sent_at', cutoff.toISOString());
        }
        // PostgREST doesn't support comparing columns; filter client-side
        postFilter = (rows) =>
          rows.filter((row) => {
            if (!row.lastEmailSentAt) return false;
            if (!row.lastEmailReceivedAt) return true;
            return row.lastEmailReceivedAt < row.lastEmailSentAt;
          });
        break;

      case 'warm_leads':
        if (criteria.minScore) {
          query = query.gte('relationship_score', criteria.minScore);
        }
        if (criteria.trends?.length) {
          query = query.in('relationship_trend', criteria.trends);
        }
        break;

      case 'inactive_30_days':
        const inactiveCutoff = new Date();
        inactiveCutoff.setDate(inactiveCutoff.getDate() - (criteria.daysSinceContact || 30));
        query = query.lt('last_interaction_at', inactiveCutoff.toISOString());
        break;

      case 'vip':
        query = query.eq('is_vip', true);
        break;

      case 'hot_leads':
        if (criteria.minLeadScore) {
          // Join with lead_scores - for now filter by relationship_score
          query = query.gte('relationship_score', criteria.minLeadScore);
        }
        break;

      case 'at_risk':
        query = query.eq('relationship_trend', 'falling');
        break;

      case 'company':
        if (criteria.companyName) {
          query = query.ilike('company', `%${criteria.companyName}%`);
        }
        break;

      case 'tag':
        if (criteria.tags?.length) {
          query = query.contains('custom_tags', criteria.tags);
        }
        break;
    }

    const { data, error } = await query.order('relationship_score', { ascending: false }).limit(100);

    if (error) {
      console.error('Error evaluating smart list:', error);
      return [];
    }

    let profiles = (data || []).map(rowToProfile);
    if (postFilter) {
      profiles = postFilter(profiles);
    }
    return profiles;
  }

  async getSmartListCount(listType: SmartListType): Promise<number> {
    const profiles = await this.getSmartListContacts(listType);
    return profiles.length;
  }

  // ==================== AI INSIGHTS ====================

  async analyzeRelationship(profileId: string): Promise<RelationshipInsights | null> {
    const profile = await this.getProfile(profileId);
    if (!profile) return null;

    const interactions = await this.getInteractions(profileId, 20);

    // Build health factors
    const healthFactors: HealthFactor[] = [];

    // Response time factor
    if (profile.avgResponseTimeHours !== undefined) {
      const isGood = profile.avgResponseTimeHours <= 24;
      healthFactors.push({
        factor: 'Response Time',
        score: isGood ? 85 : 50,
        impact: isGood ? 'positive' : 'neutral',
        description: isGood
          ? `Quick responses (avg ${profile.avgResponseTimeHours.toFixed(1)}h)`
          : `Slow responses (avg ${profile.avgResponseTimeHours.toFixed(1)}h)`
      });
    }

    // Response rate factor
    if (profile.responseRate !== undefined) {
      const isGood = profile.responseRate >= 0.7;
      healthFactors.push({
        factor: 'Response Rate',
        score: Math.round(profile.responseRate * 100),
        impact: isGood ? 'positive' : profile.responseRate >= 0.4 ? 'neutral' : 'negative',
        description: `${Math.round(profile.responseRate * 100)}% of messages get responses`
      });
    }

    // Frequency factor
    healthFactors.push({
      factor: 'Communication Frequency',
      score: profile.communicationFrequency === 'daily' ? 95 :
             profile.communicationFrequency === 'weekly' ? 80 :
             profile.communicationFrequency === 'monthly' ? 60 :
             profile.communicationFrequency === 'sporadic' ? 40 : 20,
      impact: ['daily', 'weekly'].includes(profile.communicationFrequency) ? 'positive' :
              profile.communicationFrequency === 'monthly' ? 'neutral' : 'negative',
      description: `${profile.communicationFrequency} communication pattern`
    });

    // Build suggestions
    const suggestions: RelationshipSuggestion[] = [];

    if (profile.relationshipTrend === 'falling') {
      suggestions.push({
        type: 'warning',
        title: 'Relationship Declining',
        description: 'Engagement has decreased. Consider reaching out to reconnect.',
        actionType: 'send_email',
        priority: 90
      });
    }

    const daysSinceContact = profile.lastInteractionAt
      ? Math.floor((Date.now() - profile.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    if (daysSinceContact && daysSinceContact > 30) {
      suggestions.push({
        type: 'action',
        title: 'Re-engage Contact',
        description: `It's been ${daysSinceContact} days since your last interaction.`,
        actionType: 'send_email',
        priority: 70
      });
    }

    if (profile.birthday) {
      const today = new Date();
      const birthday = new Date(profile.birthday);
      birthday.setFullYear(today.getFullYear());
      const daysUntil = Math.ceil((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil > 0 && daysUntil <= 7) {
        suggestions.push({
          type: 'action',
          title: 'Birthday Coming Up',
          description: `${profile.contactName}'s birthday is in ${daysUntil} days.`,
          actionType: 'send_message',
          priority: 85
        });
      }
    }

    // Generate AI talking points
    let talkingPoints = profile.aiTalkingPoints || [];
    if (talkingPoints.length === 0 && interactions.length > 0) {
      talkingPoints = await this.generateTalkingPoints(profileId);
    }

    return {
      profile,
      healthScore: profile.relationshipScore,
      healthTrend: profile.relationshipTrend,
      healthFactors,
      suggestions: suggestions.sort((a, b) => b.priority - a.priority),
      talkingPoints,
      recentTopics: profile.aiTopics || [],
      sentimentTrend: profile.aiSentimentAverage !== undefined
        ? (profile.aiSentimentAverage > 0.3 ? 'positive' : profile.aiSentimentAverage < -0.3 ? 'negative' : 'neutral')
        : 'neutral',
      nextBestAction: profile.aiNextActionSuggestion || suggestions[0]?.title || 'Keep the conversation going'
    };
  }

  async generateTalkingPoints(profileId: string): Promise<string[]> {
    const profile = await this.getProfile(profileId);
    if (!profile) return [];

    const interactions = await this.getInteractions(profileId, 10);
    if (interactions.length === 0) return [];

    // Build context from recent interactions
    const context = interactions
      .filter(i => i.subject || i.snippet)
      .slice(0, 5)
      .map(i => `- ${i.subject || ''}: ${i.snippet || ''}`.trim())
      .join('\n');

    if (!context) return [];

    try {
      const prompt = `Based on these recent interactions with ${profile.contactName || profile.contactEmail}, suggest 3-5 talking points for the next conversation. Keep them brief and actionable.

Recent interactions:
${context}

${profile.company ? `Company: ${profile.company}` : ''}
${profile.title ? `Title: ${profile.title}` : ''}

Return as a JSON array of strings, e.g., ["Point 1", "Point 2"]`;

      const response = await askAI(prompt);
      if (response) {
        try {
          const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const points = JSON.parse(cleaned);
          if (Array.isArray(points)) {
            // Save to profile
            await supabase
              .from('relationship_profiles')
              .update({ ai_talking_points: points, last_analyzed_at: new Date().toISOString() })
              .eq('id', profileId);
            return points;
          }
        } catch {
          // Parse failed, try line-by-line
          const lines = response.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
          return lines.map(l => l.replace(/^[-\d.]\s*/, '').trim()).filter(Boolean);
        }
      }
    } catch (error) {
      console.error('Error generating talking points:', error);
    }

    return [];
  }

  async detectCommunicationStyle(profileId: string): Promise<string | null> {
    const interactions = await this.getInteractions(profileId, 10);
    if (interactions.length < 3) return null;

    const snippets = interactions
      .filter(i => i.snippet)
      .map(i => i.snippet)
      .join('\n---\n');

    if (!snippets) return null;

    try {
      const prompt = `Analyze the communication style from these message snippets. Classify as one of: formal, casual, brief, detailed.

Messages:
${snippets}

Return only one word: formal, casual, brief, or detailed`;

      const response = await askAI(prompt);
      if (response) {
        const style = response.toLowerCase().trim();
        if (['formal', 'casual', 'brief', 'detailed'].includes(style)) {
          await supabase
            .from('relationship_profiles')
            .update({ ai_communication_style: style })
            .eq('id', profileId);
          return style;
        }
      }
    } catch (error) {
      console.error('Error detecting communication style:', error);
    }

    return null;
  }

  // ==================== MEETING PREP ====================

  async generateMeetingPrepCard(
    eventId: string,
    eventTitle: string,
    eventStart: Date,
    eventEnd: Date | undefined,
    attendeeEmails: string[]
  ): Promise<MeetingPrepCard | null> {
    const userId = this.getUserId();

    // Check if card already exists
    const { data: existing } = await supabase
      .from('meeting_prep_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('calendar_event_id', eventId)
      .single();

    if (existing) {
      return rowToMeetingPrepCard(existing);
    }

    // Build attendee profiles
    const attendeeProfiles: AttendeeProfile[] = [];
    for (const email of attendeeEmails) {
      const profile = await this.getProfileByEmail(email);
      attendeeProfiles.push({
        profileId: profile?.id,
        email,
        name: profile?.contactName,
        relationshipScore: profile?.relationshipScore,
        relationshipType: profile?.relationshipType,
        lastInteraction: profile?.lastInteractionAt,
        company: profile?.company,
        title: profile?.title,
      });
    }

    // Generate AI content
    let aiTalkingPoints: string[] = [];
    let aiQuestionsToAsk: string[] = [];
    let aiSummary: string | undefined;

    // Get recent interactions for known attendees
    const knownProfiles = attendeeProfiles.filter(a => a.profileId);
    if (knownProfiles.length > 0) {
      const recentContext: string[] = [];
      for (const attendee of knownProfiles.slice(0, 3)) {
        if (attendee.profileId) {
          const interactions = await this.getInteractions(attendee.profileId, 5);
          const context = interactions
            .filter(i => i.subject)
            .map(i => `${attendee.name || attendee.email}: ${i.subject}`)
            .slice(0, 3);
          recentContext.push(...context);
        }
      }

      if (recentContext.length > 0) {
        try {
          const prompt = `Generate meeting prep for "${eventTitle}" with these attendees and recent context:

Attendees: ${attendeeProfiles.map(a => `${a.name || a.email} (${a.company || 'Unknown'})`).join(', ')}

Recent interactions:
${recentContext.join('\n')}

Return JSON with:
{
  "summary": "Brief meeting context",
  "talkingPoints": ["Point 1", "Point 2"],
  "questionsToAsk": ["Question 1"]
}`;

          const response = await askAI(prompt);
          if (response) {
            const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleaned);
            aiSummary = parsed.summary;
            aiTalkingPoints = parsed.talkingPoints || [];
            aiQuestionsToAsk = parsed.questionsToAsk || [];
          }
        } catch (error) {
          console.error('Error generating meeting prep:', error);
        }
      }
    }

    // Create the card
    const { data: card, error } = await supabase
      .from('meeting_prep_cards')
      .insert({
        user_id: userId,
        calendar_event_id: eventId,
        event_title: eventTitle,
        event_start: eventStart.toISOString(),
        event_end: eventEnd?.toISOString(),
        attendee_profiles: attendeeProfiles,
        attendee_count: attendeeEmails.length,
        known_attendees: knownProfiles.length,
        ai_summary: aiSummary,
        ai_talking_points: aiTalkingPoints,
        ai_questions_to_ask: aiQuestionsToAsk,
        status: 'generated',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating meeting prep card:', error);
      return null;
    }

    return rowToMeetingPrepCard(card);
  }

  async getUpcomingMeetingPreps(hoursAhead = 24): Promise<MeetingPrepCard[]> {
    const userId = this.getUserId();
    const now = new Date();
    const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('meeting_prep_cards')
      .select('*')
      .eq('user_id', userId)
      .gte('event_start', now.toISOString())
      .lte('event_start', cutoff.toISOString())
      .neq('status', 'archived')
      .order('event_start');

    if (error) {
      console.error('Error fetching meeting preps:', error);
      return [];
    }

    return (data || []).map(rowToMeetingPrepCard);
  }

  // ==================== BACKGROUND PROCESSING ====================

  async runDailyAnalysis(): Promise<void> {
    const userId = this.getUserId();

    // Get all profiles
    const { data: profiles } = await supabase
      .from('relationship_profiles')
      .select('id')
      .eq('user_id', userId);

    if (!profiles) return;

    // Update scores for each profile
    for (const profile of profiles) {
      await this.computeRelationshipScore(profile.id);
      await this.computeTrend(profile.id);
    }

    // Refresh smart list counts
    const lists = await this.getSmartLists();
    for (const list of lists) {
      const profiles = await this.evaluateSmartListCriteria(userId, list.criteria);
      await supabase
        .from('smart_contact_groups')
        .update({
          member_profile_ids: profiles.map(p => p.id),
          member_count: profiles.length,
          last_refreshed_at: new Date().toISOString(),
        })
        .eq('id', list.id);
    }
  }

  async syncEmailInteractions(): Promise<void> {
    // This would hook into emailSyncService to populate contact_interactions
    // Called after email sync completes
    console.log('Email interaction sync - implement integration with emailSyncService');
  }
}

// Export singleton instance
export const relationshipIntelligenceService = new RelationshipIntelligenceService();
