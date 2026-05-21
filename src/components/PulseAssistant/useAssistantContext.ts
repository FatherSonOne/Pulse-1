import { useState, useEffect } from 'react';
import { AppView, User } from '../../types';
import { AssistantContext, pulseAssistantService } from '../../services/pulseAssistantService';
import { decisionService } from '../../services/decisionService';
import { taskService } from '../../services/taskService';
import { dataService } from '../../services/dataService';
import { emailSyncService } from '../../services/emailSyncService';
import { googleCalendarService } from '../../services/googleCalendarService';
import { workspaceService } from '../../services/workspaceService';
import { teamService } from '../../services/teamService';
import { settingsService } from '../../services/settingsService';
import { savedSearchesService } from '../../services/savedSearches';
import { supabase } from '../../services/supabase';

// Sections that load decisions + tasks
const DECISION_TASK_SECTIONS: AppView[] = [AppView.DECISIONS_TASKS, AppView.DASHBOARD];
// Sections that load calendar events
const CALENDAR_SECTIONS: AppView[] = [AppView.CALENDAR, AppView.MEETINGS];
// Sections that load analytics
const ANALYTICS_SECTIONS: AppView[] = [AppView.ANALYTICS];

export function useAssistantContext(
  activeView: AppView,
  isOpen: boolean,
  user: User,
  workspaceId: string,
): { context: AssistantContext; sectionSummary: string; isLoading: boolean; refreshSummary: () => void } {
  const [context, setContext] = useState<AssistantContext>({
    section: activeView,
    user,
    workspaceId,
  });
  const [sectionSummary, setSectionSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Keep section in sync immediately when the active view changes
  useEffect(() => {
    setContext(prev => ({ ...prev, section: activeView }));
    // Clear summary when switching sections so it re-loads
    setSectionSummary('');
  }, [activeView]);

  // Lazy-load section data only when the panel is open
  useEffect(() => {
    if (!isOpen || !workspaceId) {
      if (!isOpen) setSectionSummary('');
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const loadData = async () => {
      const newCtx: AssistantContext = {
        section: activeView,
        user,
        workspaceId,
      };

      // ── Decisions & Tasks ──────────────────────────────────────────────
      if (DECISION_TASK_SECTIONS.includes(activeView)) {
        try {
          const [decResult, tskResult] = await Promise.all([
            decisionService.getWorkspaceDecisions(workspaceId),
            taskService.getWorkspaceTasks(workspaceId),
          ]);
          newCtx.decisions = decResult.decisions;
          newCtx.tasks = tskResult.tasks;
        } catch (e) {
          console.error('[PulseAssistant] Failed to load decisions/tasks:', e);
          newCtx.decisions = [];
          newCtx.tasks = [];
        }
      }

      // Dashboard is the cross-section overview, so it pulls a slim slice of
      // threads + email + today's calendar alongside decisions/tasks. This is
      // what makes "who needs my attention first?" and "who messaged me last?"
      // answerable from Dashboard instead of forcing a section switch.
      const isDashboard = activeView === AppView.DASHBOARD;

      // ── Messages / Threads ─────────────────────────────────────────────
      if (activeView === AppView.MESSAGES || isDashboard) {
        try {
          const threads = await dataService.getThreads();
          newCtx.threads = threads.slice(0, isDashboard ? 8 : 20);
        } catch (e) {
          console.error('[PulseAssistant] Failed to load threads:', e);
          newCtx.threads = [];
        }
      }

      // ── Email ──────────────────────────────────────────────────────────
      if (activeView === AppView.EMAIL || isDashboard) {
        try {
          const limit = isDashboard ? 5 : 15;
          const [emails, unreadCount] = await Promise.all([
            emailSyncService.getEmailsByFolder('inbox', limit, 0),
            emailSyncService.getUnreadCount('inbox'),
          ]);
          newCtx.emails = emails;
          newCtx.emailUnreadCount = unreadCount;
        } catch (e) {
          console.error('[PulseAssistant] Failed to load emails:', e);
          newCtx.emails = [];
          newCtx.emailUnreadCount = 0;
        }
      }

      // ── Calendar & Meetings ────────────────────────────────────────────
      if (CALENDAR_SECTIONS.includes(activeView) || isDashboard) {
        try {
          const [todayEvents, upcomingEvents] = await Promise.all([
            googleCalendarService.getTodayEvents(),
            googleCalendarService.getUpcomingEvents(isDashboard ? 3 : 7),
          ]);
          // Merge and deduplicate by id
          const seen = new Set<string>();
          const allEvents = [...todayEvents, ...upcomingEvents].filter(e => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
          });
          newCtx.events = allEvents.slice(0, isDashboard ? 8 : 20);
        } catch (e) {
          console.error('[PulseAssistant] Failed to load calendar events:', e);
          newCtx.events = [];
        }
      }

      // ── Contacts ───────────────────────────────────────────────────────
      if (activeView === AppView.CONTACTS) {
        try {
          const contacts = await dataService.getContacts();
          newCtx.contacts = contacts.slice(0, 30);
        } catch (e) {
          console.error('[PulseAssistant] Failed to load contacts:', e);
          newCtx.contacts = [];
        }
      }

      // ── Relay recordings ───────────────────────────────────────────────
      if (activeView === AppView.RELAY) {
        try {
          const recordings = await dataService.getVoxerRecordings();
          newCtx.voxerRecordings = recordings.slice(0, 20);
        } catch (e) {
          console.error('[PulseAssistant] Failed to load voxer recordings:', e);
          newCtx.voxerRecordings = [];
        }
      }

      // ── Analytics ──────────────────────────────────────────────────────
      if (ANALYTICS_SECTIONS.includes(activeView)) {
        try {
          const metrics = await dataService.getProductivityMetrics();
          newCtx.analyticsMetrics = metrics;
        } catch (e) {
          console.error('[PulseAssistant] Failed to load analytics:', e);
        }
      }

      // ── Settings ─────────────────────────────────────────────────────
      if (activeView === AppView.SETTINGS) {
        try {
          const [workspace, members, teams, settings] = await Promise.all([
            workspaceService.getWorkspace(workspaceId),
            workspaceService.getMembers(workspaceId),
            teamService.getTeams(),
            settingsService.getAll(),
          ]);
          const integrationsActive: string[] = [];
          // Detect active integrations from settings/API keys
          if (settings.emailNotifications) integrationsActive.push('Email Notifications');
          if (settings.aiSuggestionsEnabled) integrationsActive.push('AI Suggestions');
          if (settings.smartRepliesEnabled) integrationsActive.push('Smart Replies');
          newCtx.settingsContext = {
            workspaceName: workspace?.name,
            workspacePlan: workspace?.plan,
            memberCount: members.length,
            teamCount: teams.length,
            theme: settings.theme,
            aiModel: settings.primaryAIModel || 'gemini-2.5-flash',
            integrationsActive,
          };
        } catch (e) {
          console.error('[PulseAssistant] Failed to load settings context:', e);
        }
      }

      // ── Search ─────────────────────────────────────────────────────────
      // Sources from search_history (the global search source of truth);
      // the assistant context ran on message-thread-search recents before,
      // which mismatched the surface the user was actually looking at.
      if (activeView === AppView.MULTI_MODAL) {
        try {
          let recentSearches: string[] = [];
          try {
            const { data } = await supabase
              .from('search_history')
              .select('query')
              .eq('user_id', user.id)
              .order('updated_at', { ascending: false })
              .limit(10);
            recentSearches = (data || []).map((r: any) => r.query);
          } catch { /* table might not exist — empty list is fine */ }

          let savedSearchCount = 0;
          try {
            const saved = await savedSearchesService.getSavedSearches(user.id);
            savedSearchCount = saved.length;
          } catch { /* saved searches optional */ }
          newCtx.searchContext = {
            recentSearches,
            savedSearchCount,
          };
        } catch (e) {
          console.error('[PulseAssistant] Failed to load search context:', e);
        }
      }

      // ── Archives ───────────────────────────────────────────────────────
      if (activeView === AppView.ARCHIVES) {
        try {
          const archives = await dataService.getArchives();
          newCtx.archives = archives.slice(0, 20);
        } catch (e) {
          console.error('[PulseAssistant] Failed to load archives:', e);
          newCtx.archives = [];
        }
      }

      if (cancelled) return;

      setContext(newCtx);
      setSectionSummary(pulseAssistantService.getSectionSummary(newCtx));
      setIsLoading(false);
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeView, workspaceId, user]);

  // Allow callers to refresh the summary without a full data reload
  const refreshSummary = () => {
    setSectionSummary(pulseAssistantService.getSectionSummary(context));
  };

  return { context, sectionSummary, isLoading, refreshSummary };
}
