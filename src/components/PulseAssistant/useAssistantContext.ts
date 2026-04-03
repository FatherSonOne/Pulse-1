import { useState, useEffect } from 'react';
import { AppView, User } from '../../types';
import { AssistantContext, pulseAssistantService } from '../../services/pulseAssistantService';
import { decisionService } from '../../services/decisionService';
import { taskService } from '../../services/taskService';
import { dataService } from '../../services/dataService';
import { emailSyncService } from '../../services/emailSyncService';
import { googleCalendarService } from '../../services/googleCalendarService';

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
): { context: AssistantContext; sectionSummary: string; isLoading: boolean } {
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

      // ── Messages / Threads ─────────────────────────────────────────────
      if (activeView === AppView.MESSAGES) {
        try {
          const threads = await dataService.getThreads();
          newCtx.threads = threads.slice(0, 20);
        } catch (e) {
          console.error('[PulseAssistant] Failed to load threads:', e);
          newCtx.threads = [];
        }
      }

      // ── Email ──────────────────────────────────────────────────────────
      if (activeView === AppView.EMAIL) {
        try {
          const [emails, unreadCount] = await Promise.all([
            emailSyncService.getEmailsByFolder('inbox', 15, 0),
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
      if (CALENDAR_SECTIONS.includes(activeView)) {
        try {
          const [todayEvents, upcomingEvents] = await Promise.all([
            googleCalendarService.getTodayEvents(),
            googleCalendarService.getUpcomingEvents(7),
          ]);
          // Merge and deduplicate by id
          const seen = new Set<string>();
          const allEvents = [...todayEvents, ...upcomingEvents].filter(e => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
          });
          newCtx.events = allEvents.slice(0, 20);
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

      // ── Voxer recordings ───────────────────────────────────────────────
      if (activeView === AppView.VOXER) {
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

  return { context, sectionSummary, isLoading };
}
