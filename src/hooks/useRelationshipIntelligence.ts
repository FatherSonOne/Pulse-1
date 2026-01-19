// ============================================
// USE RELATIONSHIP INTELLIGENCE HOOK
// Central hook for relationship management features
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { relationshipIntelligenceService } from '../services/relationshipIntelligenceService';
import { relationshipAlertService } from '../services/relationshipAlertService';
import { leadScoringService } from '../services/leadScoringService';
import { contactEnrichmentService } from '../services/contactEnrichmentService';
import {
  RelationshipProfile,
  RelationshipAlert,
  SmartContactGroup,
  LeadScore,
  RelationshipInsights,
  SmartListType,
  ProfileQueryOptions,
  DuplicateGroup,
  MeetingPrepCard,
  SYSTEM_SMART_LISTS,
} from '../types/relationshipTypes';

interface UseRelationshipIntelligenceReturn {
  // State
  isLoading: boolean;
  error: string | null;

  // Profiles
  profiles: RelationshipProfile[];
  selectedProfile: RelationshipProfile | null;
  profileInsights: RelationshipInsights | null;
  getProfile: (email: string) => Promise<RelationshipProfile | null>;
  getProfiles: (options: Partial<ProfileQueryOptions>) => Promise<RelationshipProfile[]>;
  updateProfile: (profileId: string, updates: Partial<RelationshipProfile>) => Promise<void>;
  refreshProfileScore: (profileId: string) => Promise<number>;
  selectProfile: (profile: RelationshipProfile | null) => void;
  loadProfileInsights: (profileId: string) => Promise<void>;
  // Sync helpers for looking up by email
  getProfileByEmail: (email: string) => RelationshipProfile | null;
  getLeadScoreByEmail: (email: string) => LeadScore | null;
  getInsightsByEmail: (email: string) => RelationshipInsights | null;

  // Smart Lists
  smartLists: SmartContactGroup[];
  smartListCounts: Record<SmartListType, number>;
  activeSmartList: SmartListType | null;
  setActiveSmartList: (listType: SmartListType | null) => void;
  getSmartListContacts: (listType: SmartListType) => Promise<RelationshipProfile[]>;
  refreshSmartLists: () => Promise<void>;

  // Alerts
  alerts: RelationshipAlert[];
  alertCount: number;
  dismissAlert: (alertId: string, reason?: string) => Promise<void>;
  snoozeAlert: (alertId: string, until: Date) => Promise<void>;
  actionAlert: (alertId: string, actionType: string) => Promise<void>;
  handleAlertAction: (alertId: string, actionType: string) => Promise<void>;
  refreshAlerts: () => Promise<void>;
  runAlertChecks: () => Promise<void>;

  // Lead Scoring
  leadScores: Map<string, LeadScore>;
  getLeadScore: (profileId: string) => Promise<LeadScore | null>;
  topLeads: LeadScore[];
  refreshLeadScores: () => Promise<void>;
  detectBuyingSignals: (profileId: string) => Promise<void>;

  // Enrichment
  duplicates: DuplicateGroup[];
  findDuplicates: () => Promise<void>;
  mergeDuplicates: (primaryId: string, duplicateIds: string[]) => Promise<boolean>;
  mergeProfiles: (primaryId: string, duplicateIds: string[]) => Promise<boolean>;
  dismissDuplicate: (groupId: string) => Promise<void>;
  enrichFromSignature: (profileId: string, signature: string) => Promise<boolean>;
  autoTagContact: (profileId: string) => Promise<string[]>;

  // Meeting Prep
  upcomingMeetingPreps: MeetingPrepCard[];
  generateMeetingPrep: (eventId: string, title: string, start: Date, end: Date | undefined, attendees: string[]) => Promise<MeetingPrepCard | null>;
  refreshMeetingPreps: () => Promise<void>;

  // Full Refresh
  refreshAll: () => Promise<void>;
}

export function useRelationshipIntelligence(): UseRelationshipIntelligenceReturn {
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile state
  const [profiles, setProfiles] = useState<RelationshipProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<RelationshipProfile | null>(null);
  const [profileInsights, setProfileInsights] = useState<RelationshipInsights | null>(null);

  // Smart Lists state
  const [smartLists, setSmartLists] = useState<SmartContactGroup[]>([]);
  const [smartListCounts, setSmartListCounts] = useState<Record<SmartListType, number>>({
    needs_follow_up: 0,
    warm_leads: 0,
    inactive_30_days: 0,
    vip: 0,
    hot_leads: 0,
    at_risk: 0,
    cold_leads: 0,
    company: 0,
    tag: 0,
    custom: 0,
  });
  const [activeSmartList, setActiveSmartList] = useState<SmartListType | null>(null);

  // Alerts state
  const [alerts, setAlerts] = useState<RelationshipAlert[]>([]);

  // Lead scoring state
  const [topLeads, setTopLeads] = useState<LeadScore[]>([]);
  const [leadScoresMap, setLeadScoresMap] = useState<Map<string, LeadScore>>(new Map());

  // Insights cache (by email)
  const [insightsCache, setInsightsCache] = useState<Map<string, RelationshipInsights>>(new Map());

  // Enrichment state
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);

  // Meeting prep state
  const [upcomingMeetingPreps, setUpcomingMeetingPreps] = useState<MeetingPrepCard[]>([]);

  // Initialize services with user ID
  useEffect(() => {
    if (userId) {
      relationshipIntelligenceService.setUserId(userId);
      relationshipAlertService.setUserId(userId);
      leadScoringService.setUserId(userId);
    }
  }, [userId]);

  // Load initial data
  useEffect(() => {
    if (userId) {
      loadAllProfiles();
      refreshSmartLists();
      refreshAlerts();
      refreshMeetingPreps();
      loadAllLeadScores();
    }
  }, [userId]);

  // Load all profiles for the user
  const loadAllProfiles = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const allProfiles = await relationshipIntelligenceService.getProfiles({
        userId,
        limit: 500,
        sortBy: 'score',
        sortOrder: 'desc',
      });
      setProfiles(allProfiles);
    } catch (err: any) {
      if (err?.code === 'PGRST205' || err?.message?.includes('Could not find the table')) {
        console.log('Relationship profiles table not yet created.');
      } else {
        console.error('Error loading profiles:', err);
      }
    }
  }, [userId]);

  // Load all lead scores for profiles
  const loadAllLeadScores = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const leads = await leadScoringService.getTopLeads(100);
      setTopLeads(leads);

      // Build email-to-score map
      const scoreMap = new Map<string, LeadScore>();
      for (const lead of leads) {
        // We need to get the profile email for this lead
        const profile = profiles.find(p => p.id === lead.profileId);
        if (profile) {
          scoreMap.set(profile.contactEmail, lead);
        }
      }
      setLeadScoresMap(scoreMap);
    } catch (err: any) {
      if (err?.code === 'PGRST205' || err?.message?.includes('Could not find the table')) {
        console.log('Lead scores table not yet created.');
      } else {
        console.error('Error loading lead scores:', err);
      }
    }
  }, [userId, profiles]);

  // ==================== PROFILE FUNCTIONS ====================

  const getProfile = useCallback(async (email: string): Promise<RelationshipProfile | null> => {
    if (!userId) return null;
    try {
      return await relationshipIntelligenceService.getProfileByEmail(email);
    } catch (err) {
      console.error('Error getting profile:', err);
      return null;
    }
  }, [userId]);

  const getProfiles = useCallback(async (options: Partial<ProfileQueryOptions>): Promise<RelationshipProfile[]> => {
    if (!userId) return [];
    setIsLoading(true);
    try {
      const result = await relationshipIntelligenceService.getProfiles({
        userId,
        ...options,
      });
      setProfiles(result);
      return result;
    } catch (err) {
      setError('Failed to load profiles');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const updateProfile = useCallback(async (profileId: string, updates: Partial<RelationshipProfile>): Promise<void> => {
    if (!userId) return;
    try {
      const updated = await relationshipIntelligenceService.updateProfile(profileId, updates);
      if (updated) {
        setProfiles(prev => prev.map(p => p.id === profileId ? updated : p));
        if (selectedProfile?.id === profileId) {
          setSelectedProfile(updated);
        }
      }
    } catch (err) {
      setError('Failed to update profile');
    }
  }, [userId, selectedProfile]);

  const refreshProfileScore = useCallback(async (profileId: string): Promise<number> => {
    if (!userId) return 0;
    try {
      const score = await relationshipIntelligenceService.computeRelationshipScore(profileId);
      await relationshipIntelligenceService.computeTrend(profileId);
      return score;
    } catch (err) {
      console.error('Error refreshing score:', err);
      return 0;
    }
  }, [userId]);

  const selectProfile = useCallback((profile: RelationshipProfile | null) => {
    setSelectedProfile(profile);
    setProfileInsights(null);
    if (profile) {
      loadProfileInsights(profile.id);
    }
  }, []);

  const loadProfileInsights = useCallback(async (profileId: string): Promise<void> => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const insights = await relationshipIntelligenceService.analyzeRelationship(profileId);
      setProfileInsights(insights);
    } catch (err) {
      console.error('Error loading insights:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // ==================== SMART LISTS FUNCTIONS ====================

  const refreshSmartLists = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const lists = await relationshipIntelligenceService.getSmartLists();
      setSmartLists(lists);

      // Get counts for system lists
      const counts: Record<string, number> = {};
      for (const listConfig of SYSTEM_SMART_LISTS) {
        try {
          const count = await relationshipIntelligenceService.getSmartListCount(listConfig.id);
          counts[listConfig.id] = count;
        } catch {
          // Table might not exist yet - just use 0
          counts[listConfig.id] = 0;
        }
      }
      setSmartListCounts(counts as Record<SmartListType, number>);
    } catch (err: any) {
      // Check if it's a "table not found" error - ignore those gracefully
      if (err?.code === 'PGRST205' || err?.message?.includes('Could not find the table')) {
        console.log('Relationship tables not yet created. Run the migration to enable this feature.');
      } else {
        console.error('Error refreshing smart lists:', err);
      }
    }
  }, [userId]);

  const getSmartListContacts = useCallback(async (listType: SmartListType): Promise<RelationshipProfile[]> => {
    if (!userId) return [];
    setIsLoading(true);
    try {
      const contacts = await relationshipIntelligenceService.getSmartListContacts(listType);
      setProfiles(contacts);
      return contacts;
    } catch (err) {
      setError('Failed to load smart list');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // ==================== ALERTS FUNCTIONS ====================

  const refreshAlerts = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const activeAlerts = await relationshipAlertService.getActiveAlerts();
      setAlerts(activeAlerts);
    } catch (err) {
      console.error('Error refreshing alerts:', err);
    }
  }, [userId]);

  const runAlertChecks = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setIsLoading(true);
    try {
      await relationshipAlertService.runAllChecks();
      await refreshAlerts();
    } catch (err) {
      setError('Failed to run alert checks');
    } finally {
      setIsLoading(false);
    }
  }, [userId, refreshAlerts]);

  const dismissAlert = useCallback(async (alertId: string, reason?: string): Promise<void> => {
    const success = await relationshipAlertService.dismissAlert(alertId, reason);
    if (success) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    }
  }, []);

  const snoozeAlert = useCallback(async (alertId: string, until: Date): Promise<void> => {
    const success = await relationshipAlertService.snoozeAlert(alertId, until);
    if (success) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    }
  }, []);

  const actionAlert = useCallback(async (alertId: string, actionType: string): Promise<void> => {
    const success = await relationshipAlertService.markActioned(alertId, actionType);
    if (success) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    }
  }, []);

  // ==================== LEAD SCORING FUNCTIONS ====================

  const getLeadScore = useCallback(async (profileId: string): Promise<LeadScore | null> => {
    if (!userId) return null;
    try {
      return await leadScoringService.getLeadScore(profileId);
    } catch (err) {
      console.error('Error getting lead score:', err);
      return null;
    }
  }, [userId]);

  const refreshLeadScores = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const leads = await leadScoringService.getTopLeads(20);
      setTopLeads(leads);
    } catch (err) {
      console.error('Error refreshing lead scores:', err);
    }
  }, [userId]);

  const detectBuyingSignals = useCallback(async (profileId: string): Promise<void> => {
    if (!userId) return;
    try {
      await leadScoringService.detectBuyingSignals(profileId);
    } catch (err) {
      console.error('Error detecting buying signals:', err);
    }
  }, [userId]);

  // ==================== ENRICHMENT FUNCTIONS ====================

  const findDuplicates = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const dups = await contactEnrichmentService.findDuplicates(userId);
      setDuplicates(dups);
    } catch (err) {
      setError('Failed to find duplicates');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const mergeProfiles = useCallback(async (primaryId: string, duplicateIds: string[]): Promise<boolean> => {
    if (!userId) return false;
    try {
      const success = await contactEnrichmentService.mergeProfiles(userId, primaryId, duplicateIds);
      if (success) {
        await findDuplicates(); // Refresh duplicates list
      }
      return success;
    } catch (err) {
      setError('Failed to merge profiles');
      return false;
    }
  }, [userId, findDuplicates]);

  const enrichFromSignature = useCallback(async (profileId: string, signature: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      return await contactEnrichmentService.enrichFromEmail(userId, profileId, signature);
    } catch (err) {
      console.error('Error enriching from signature:', err);
      return false;
    }
  }, [userId]);

  const autoTagContact = useCallback(async (profileId: string): Promise<string[]> => {
    if (!userId) return [];
    try {
      return await contactEnrichmentService.suggestTags(userId, profileId);
    } catch (err) {
      console.error('Error auto-tagging:', err);
      return [];
    }
  }, [userId]);

  // ==================== MEETING PREP FUNCTIONS ====================

  const refreshMeetingPreps = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const preps = await relationshipIntelligenceService.getUpcomingMeetingPreps(48);
      setUpcomingMeetingPreps(preps);
    } catch (err) {
      console.error('Error refreshing meeting preps:', err);
    }
  }, [userId]);

  const generateMeetingPrep = useCallback(async (
    eventId: string,
    title: string,
    start: Date,
    end: Date | undefined,
    attendees: string[]
  ): Promise<MeetingPrepCard | null> => {
    if (!userId) return null;
    try {
      const card = await relationshipIntelligenceService.generateMeetingPrepCard(
        eventId,
        title,
        start,
        end,
        attendees
      );
      if (card) {
        setUpcomingMeetingPreps(prev => [...prev.filter(p => p.id !== card.id), card]);
      }
      return card;
    } catch (err) {
      console.error('Error generating meeting prep:', err);
      return null;
    }
  }, [userId]);

  // Computed values
  const alertCount = useMemo(() => alerts.length, [alerts]);

  // ==================== SYNC HELPER FUNCTIONS ====================

  // Get profile by email (synchronous - from cached profiles)
  const getProfileByEmail = useCallback((email: string): RelationshipProfile | null => {
    if (!email) return null;
    return profiles.find(p => p.contactEmail.toLowerCase() === email.toLowerCase()) || null;
  }, [profiles]);

  // Get lead score by email (synchronous - from cached scores)
  const getLeadScoreByEmail = useCallback((email: string): LeadScore | null => {
    if (!email) return null;
    return leadScoresMap.get(email.toLowerCase()) || null;
  }, [leadScoresMap]);

  // Get insights by email (synchronous - from cache)
  const getInsightsByEmail = useCallback((email: string): RelationshipInsights | null => {
    if (!email) return null;
    return insightsCache.get(email.toLowerCase()) || null;
  }, [insightsCache]);

  // Handle alert action (wrapper for actionAlert)
  const handleAlertAction = useCallback(async (alertId: string, actionType: string): Promise<void> => {
    await actionAlert(alertId, actionType);
  }, [actionAlert]);

  // Dismiss a duplicate group
  const dismissDuplicate = useCallback(async (groupId: string): Promise<void> => {
    setDuplicates(prev => prev.filter(d => d.groupId !== groupId));
  }, []);

  // Alias for mergeProfiles
  const mergeDuplicates = useCallback(async (primaryId: string, duplicateIds: string[]): Promise<boolean> => {
    return mergeProfiles(primaryId, duplicateIds);
  }, [mergeProfiles]);

  // Refresh all data
  const refreshAll = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setIsLoading(true);
    try {
      await Promise.all([
        loadAllProfiles(),
        refreshSmartLists(),
        refreshAlerts(),
        refreshMeetingPreps(),
        loadAllLeadScores(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, loadAllProfiles, refreshSmartLists, refreshAlerts, refreshMeetingPreps, loadAllLeadScores]);

  return {
    // State
    isLoading,
    error,

    // Profiles
    profiles,
    selectedProfile,
    profileInsights,
    getProfile,
    getProfiles,
    updateProfile,
    refreshProfileScore,
    selectProfile,
    loadProfileInsights,
    // Sync helpers
    getProfileByEmail,
    getLeadScoreByEmail,
    getInsightsByEmail,

    // Smart Lists
    smartLists,
    smartListCounts,
    activeSmartList,
    setActiveSmartList,
    getSmartListContacts,
    refreshSmartLists,

    // Alerts
    alerts,
    alertCount,
    dismissAlert,
    snoozeAlert,
    actionAlert,
    handleAlertAction,
    refreshAlerts,
    runAlertChecks,

    // Lead Scoring
    leadScores: leadScoresMap,
    getLeadScore,
    topLeads,
    refreshLeadScores,
    detectBuyingSignals,

    // Enrichment
    duplicates,
    findDuplicates,
    mergeDuplicates,
    mergeProfiles,
    dismissDuplicate,
    enrichFromSignature,
    autoTagContact,

    // Meeting Prep
    upcomingMeetingPreps,
    generateMeetingPrep,
    refreshMeetingPreps,

    // Full Refresh
    refreshAll,
  };
}
