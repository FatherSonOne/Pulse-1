// src/store/emailUIStore.ts
// Zustand store for email UI preferences — zoom, theme, modals, sidebar

import { create } from 'zustand';
import type { EmailCampaign } from '../services/emailCampaignService';

type AccentColor = 'rose' | 'blue' | 'purple' | 'green';
type Density = 'comfortable' | 'compact' | 'default';

export type EmailHybridMode = 'cockpit' | 'triage';

// ─── Filter state (Phase 12.5) ────────────────────────────────────────────
export type ReadStatusFilter = 'all' | 'unread' | 'read';
export type StarredFilter = 'all' | 'starred';
export type AttachmentFilter = 'all' | 'with-attachment';
export type LaneFilter = 'all' | 'work' | 'admin' | 'tools' | 'news' | 'personal';
export type DateRangeFilter = 'all' | 'today' | 'this-week' | 'this-month';

export interface EmailFilters {
  readStatus: ReadStatusFilter;
  starred: StarredFilter;
  attachment: AttachmentFilter;
  lane: LaneFilter;
  dateRange: DateRangeFilter;
}

export const DEFAULT_EMAIL_FILTERS: EmailFilters = {
  readStatus: 'all',
  starred: 'all',
  attachment: 'all',
  lane: 'all',
  dateRange: 'all',
};

export function countActiveFilters(filters: EmailFilters): number {
  let n = 0;
  if (filters.readStatus !== 'all') n++;
  if (filters.starred !== 'all') n++;
  if (filters.attachment !== 'all') n++;
  if (filters.lane !== 'all') n++;
  if (filters.dateRange !== 'all') n++;
  return n;
}

export interface TriageActedLast {
  label: string;
  sender: string;
  idx: number;
  emailId: string;
}

export interface TriageState {
  idx: number;
  actedLast: TriageActedLast | null;
}

interface EmailUIState {
  // Zoom & density
  zoomLevel: number;
  density: Density;
  accentColor: AccentColor;

  // Sidebar
  sidebarOpen: boolean;

  // Feature panels
  showBriefing: boolean;
  showFollowUps: boolean;
  dismissedFollowUps: Set<string>;
  showKeyboardShortcuts: boolean;
  showEmailSettings: boolean;
  showReauthModal: boolean;
  nudgeFocused: boolean;

  // Campaign view
  currentView: 'inbox' | 'campaigns';
  editingCampaign: EmailCampaign | null | undefined;
  campaignRefreshKey: number;

  // Email Hybrid (Cockpit + Triage) — see docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md §5.2
  emailHybridMode: EmailHybridMode;
  triageState: TriageState;
  /**
   * Frozen-at-session-start list of email IDs to process during this triage
   * session. Reset to [] via resetTriageState() so the next session re-freezes
   * from current inbox state. Empty means "no session yet".
   */
  triageQueueIds: string[];
  expandedSignalRowId: string | null;
  /** Keyboard-driven focus cursor in the Cockpit Signal section. */
  focusedSignalRowId: string | null;
  /** When non-null, the hybrid surface renders SnoozeModal targeting this email. */
  snoozeTargetEmailId: string | null;
  /** When non-null, the hybrid surface renders the slide-out EmailReaderPanel for this email. */
  readerPanelEmailId: string | null;
  /** Active filter state — applies to Cockpit + FolderListView; resets on folder change. */
  emailFilters: EmailFilters;

  // Actions
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  setDensity: (density: Density) => void;
  setAccentColor: (color: AccentColor) => void;
  setSidebarOpen: (open: boolean) => void;
  setShowBriefing: (show: boolean) => void;
  setShowFollowUps: (show: boolean) => void;
  dismissFollowUp: (emailId: string) => void;
  setShowKeyboardShortcuts: (show: boolean) => void;
  setShowEmailSettings: (show: boolean) => void;
  setShowReauthModal: (show: boolean) => void;
  setNudgeFocused: (focused: boolean) => void;
  setCurrentView: (view: 'inbox' | 'campaigns') => void;
  setEditingCampaign: (campaign: EmailCampaign | null | undefined) => void;
  incrementCampaignRefreshKey: () => void;
  setEmailHybridMode: (mode: EmailHybridMode) => void;
  setTriageState: (state: TriageState | ((s: TriageState) => TriageState)) => void;
  setTriageQueueIds: (ids: string[]) => void;
  resetTriageState: () => void;
  setExpandedSignalRowId: (id: string | null) => void;
  setFocusedSignalRowId: (id: string | null) => void;
  setSnoozeTargetEmailId: (id: string | null) => void;
  setReaderPanelEmailId: (id: string | null) => void;
  setEmailFilter: <K extends keyof EmailFilters>(key: K, value: EmailFilters[K]) => void;
  resetEmailFilters: () => void;
}

export const useEmailUIStore = create<EmailUIState>()((set) => ({
  zoomLevel: 100,
  density: 'default',
  accentColor: 'rose',
  sidebarOpen: false,
  showBriefing: true,
  showFollowUps: true,
  dismissedFollowUps: new Set(),
  showKeyboardShortcuts: false,
  showEmailSettings: false,
  showReauthModal: false,
  nudgeFocused: false,
  currentView: 'inbox',
  editingCampaign: undefined,
  campaignRefreshKey: 0,
  emailHybridMode: 'cockpit',
  triageState: { idx: 0, actedLast: null },
  triageQueueIds: [],
  expandedSignalRowId: null,
  focusedSignalRowId: null,
  snoozeTargetEmailId: null,
  readerPanelEmailId: null,
  emailFilters: DEFAULT_EMAIL_FILTERS,

  setZoomLevel: (level) => set({ zoomLevel: Math.max(50, Math.min(100, level)) }),
  zoomIn: () => set((s) => ({ zoomLevel: Math.min(s.zoomLevel + 10, 100) })),
  zoomOut: () => set((s) => ({ zoomLevel: Math.max(s.zoomLevel - 10, 50) })),
  zoomReset: () => set({ zoomLevel: 100 }),
  setDensity: (density) => {
    const zoomMap = { comfortable: 100, default: 80, compact: 60 };
    set({ density, zoomLevel: zoomMap[density] });
  },
  setAccentColor: (color) => set({ accentColor: color }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setShowBriefing: (show) => set({ showBriefing: show }),
  setShowFollowUps: (show) => set({ showFollowUps: show }),
  dismissFollowUp: (emailId) => set((s) => ({
    dismissedFollowUps: new Set([...s.dismissedFollowUps, emailId]),
  })),
  setShowKeyboardShortcuts: (show) => set({ showKeyboardShortcuts: show }),
  setShowEmailSettings: (show) => set({ showEmailSettings: show }),
  setShowReauthModal: (show) => set({ showReauthModal: show }),
  setNudgeFocused: (focused) => set({ nudgeFocused: focused }),
  setCurrentView: (view) => set({ currentView: view }),
  setEditingCampaign: (campaign) => set({ editingCampaign: campaign }),
  incrementCampaignRefreshKey: () => set((s) => ({ campaignRefreshKey: s.campaignRefreshKey + 1 })),
  setEmailHybridMode: (mode) => set({ emailHybridMode: mode }),
  setTriageState: (state) => set((s) => ({
    triageState: typeof state === 'function' ? state(s.triageState) : state,
  })),
  setTriageQueueIds: (ids) => set({ triageQueueIds: ids }),
  // Wiping queueIds here too so the next session re-freezes from current inbox.
  resetTriageState: () => set({
    triageState: { idx: 0, actedLast: null },
    triageQueueIds: [],
  }),
  setExpandedSignalRowId: (id) => set({ expandedSignalRowId: id }),
  setFocusedSignalRowId: (id) => set({ focusedSignalRowId: id }),
  setSnoozeTargetEmailId: (id) => set({ snoozeTargetEmailId: id }),
  setReaderPanelEmailId: (id) => set({ readerPanelEmailId: id }),
  setEmailFilter: (key, value) => set((s) => ({
    emailFilters: { ...s.emailFilters, [key]: value },
  })),
  resetEmailFilters: () => set({ emailFilters: DEFAULT_EMAIL_FILTERS }),
}));
