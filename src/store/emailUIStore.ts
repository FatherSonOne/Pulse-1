// src/store/emailUIStore.ts
// Zustand store for email UI preferences — zoom, theme, modals, sidebar

import { create } from 'zustand';
import type { EmailCampaign } from '../services/emailCampaignService';

type AccentColor = 'rose' | 'blue' | 'purple' | 'green';
type Density = 'comfortable' | 'compact' | 'default';

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
}));
