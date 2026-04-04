// src/store/warRoomStore.ts
// Zustand store for War Room — projects, sessions, documents, modes, voice, UI state
// Replaces 50+ useState hooks from LiveDashboard

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { WarRoomMode, MissionType, RoomType } from '../components/WarRoom/ModeSwitcher';
import type { AIProject, AISession, AIMessage, KnowledgeDoc, ThinkingStep, PromptSuggestion } from '../services/ragService';
import type { AgentType } from '../components/WarRoom/AgentSelector';

// ── Token type (used by TokenStream) ────────────────────────────────────────
export interface Token {
  text: string;
  confidence?: number;
  alternatives?: string[];
}

// ── Presence type (used by Realtime collaboration) ──────────────────────────
export interface PresenceUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  activeMode?: string;
  joinedAt: string;
}

// ── State interface ─────────────────────────────────────────────────────────

interface WarRoomState {
  // ── Project slice ───────────────────────────────────────────────────────
  projects: AIProject[];
  selectedProjectId: string | null;
  showCreateProject: boolean;
  newProjectName: string;

  // ── Session slice ──────────────────────────────────────────────────────
  sessions: AISession[];
  selectedSessionId: string | null;
  messages: AIMessage[];
  input: string;
  isLoading: boolean;
  missionMessages: Map<string, AIMessage[]>;
  isCreatingSession: boolean;
  newSessionTitle: string;
  activeAgent: AgentType;

  // ── Document slice ─────────────────────────────────────────────────────
  documents: KnowledgeDoc[];
  showDocUpload: boolean;
  uploadingFiles: Set<string>;
  uploadProgress: Map<string, number>;
  activeContextDocs: Set<string>;
  showActiveContext: boolean;
  isDeletingDoc: boolean;
  viewingDoc: KnowledgeDoc | null;
  viewerHighlightText: string | undefined;
  viewerScrollOffset: number | undefined;

  // ── UI slice ───────────────────────────────────────────────────────────
  isSidebarOpen: boolean;
  isMobile: boolean;
  showMobileMenu: boolean;
  contextPanelOpen: boolean;
  showKnowledgeBank: boolean;
  showShareModal: boolean;
  sharingDoc: KnowledgeDoc | null;
  showExportModal: boolean;
  showSessionExport: boolean;
  isExporting: boolean;
  expandedRooms: Set<string>;

  // Content generator modals
  showMindMap: boolean;
  showChartGenerator: boolean;
  generatedChart: string | null;
  showStudyGuide: boolean;
  showFAQ: boolean;
  showTimeline: boolean;
  showPodcast: boolean;
  showOrganize: boolean;
  organizingDocId: string | undefined;
  showAdvancedAI: boolean;

  // ── Voice slice ────────────────────────────────────────────────────────
  voiceEnabled: boolean;
  voiceMode: 'push-to-talk' | 'always-on' | 'wake-word';
  voiceSynthesisEnabled: boolean;
  voiceGender: 'male' | 'female' | 'neutral';
  showVoiceAgentPanel: boolean;
  voiceAgentExpanded: boolean;
  audioUrl: string | null;
  isGeneratingAudio: boolean;
  audioData: number[];
  visualizerType: 'listening' | 'thinking' | 'speaking' | 'idle';
  currentTokens: Token[];
  isAIStreaming: boolean;

  // ── Mode slice ─────────────────────────────────────────────────────────
  warRoomMode: WarRoomMode;
  currentMission: MissionType;
  currentRoom: RoomType;
  showWarRoomHub: boolean;
  showMissionLauncher: boolean;
  glitchTrigger: boolean;
  showThinkingLogs: boolean;

  // Thinking state
  thinkingLogs: Map<string, ThinkingStep[]>;
  expandedThinking: Set<string>;
  enableExtendedThinking: boolean;

  // Suggestions
  suggestions: PromptSuggestion[];
  showSuggestions: boolean;

  // ── Presence slice ─────────────────────────────────────────────────────
  presence: Map<string, PresenceUser>;

  // ── Actions ────────────────────────────────────────────────────────────

  // Project actions
  setProjects: (projects: AIProject[]) => void;
  setSelectedProjectId: (id: string | null) => void;
  setShowCreateProject: (show: boolean) => void;
  setNewProjectName: (name: string) => void;

  // Session actions
  setSessions: (sessions: AISession[]) => void;
  setSelectedSessionId: (id: string | null) => void;
  setMessages: (messages: AIMessage[]) => void;
  setInput: (input: string) => void;
  setIsLoading: (loading: boolean) => void;
  setMissionMessages: (updater: Map<string, AIMessage[]> | ((prev: Map<string, AIMessage[]>) => Map<string, AIMessage[]>)) => void;
  setIsCreatingSession: (creating: boolean) => void;
  setNewSessionTitle: (title: string) => void;
  setActiveAgent: (agent: AgentType) => void;

  // Document actions
  setDocuments: (documents: KnowledgeDoc[]) => void;
  setShowDocUpload: (show: boolean) => void;
  setUploadingFiles: (files: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setUploadProgress: (progress: Map<string, number> | ((prev: Map<string, number>) => Map<string, number>)) => void;
  setActiveContextDocs: (docs: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setShowActiveContext: (show: boolean) => void;
  setIsDeletingDoc: (deleting: boolean) => void;
  setViewingDoc: (doc: KnowledgeDoc | null) => void;
  setViewerHighlightText: (text: string | undefined) => void;
  setViewerScrollOffset: (offset: number | undefined) => void;

  // UI actions
  setIsSidebarOpen: (open: boolean) => void;
  setIsMobile: (mobile: boolean) => void;
  setShowMobileMenu: (show: boolean) => void;
  setContextPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setShowKnowledgeBank: (show: boolean) => void;
  setShowShareModal: (show: boolean) => void;
  setSharingDoc: (doc: KnowledgeDoc | null) => void;
  setShowExportModal: (show: boolean) => void;
  setShowSessionExport: (show: boolean) => void;
  setIsExporting: (exporting: boolean) => void;
  setExpandedRooms: (rooms: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setShowMindMap: (show: boolean) => void;
  setShowChartGenerator: (show: boolean) => void;
  setGeneratedChart: (chart: string | null) => void;
  setShowStudyGuide: (show: boolean) => void;
  setShowFAQ: (show: boolean) => void;
  setShowTimeline: (show: boolean) => void;
  setShowPodcast: (show: boolean) => void;
  setShowOrganize: (show: boolean) => void;
  setOrganizingDocId: (id: string | undefined) => void;
  setShowAdvancedAI: (show: boolean) => void;

  // Voice actions
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceMode: (mode: 'push-to-talk' | 'always-on' | 'wake-word') => void;
  setVoiceSynthesisEnabled: (enabled: boolean) => void;
  setVoiceGender: (gender: 'male' | 'female' | 'neutral') => void;
  setShowVoiceAgentPanel: (show: boolean) => void;
  setVoiceAgentExpanded: (expanded: boolean) => void;
  setAudioUrl: (url: string | null) => void;
  setIsGeneratingAudio: (generating: boolean) => void;
  setAudioData: (data: number[]) => void;
  setVisualizerType: (type: 'listening' | 'thinking' | 'speaking' | 'idle') => void;
  setCurrentTokens: (tokens: Token[]) => void;
  setIsAIStreaming: (streaming: boolean) => void;

  // Mode actions
  setWarRoomMode: (mode: WarRoomMode) => void;
  setCurrentMission: (mission: MissionType) => void;
  setCurrentRoom: (room: RoomType) => void;
  setShowWarRoomHub: (show: boolean) => void;
  setShowMissionLauncher: (show: boolean) => void;
  setGlitchTrigger: (trigger: boolean) => void;
  setShowThinkingLogs: (show: boolean) => void;
  setThinkingLogs: (logs: Map<string, ThinkingStep[]> | ((prev: Map<string, ThinkingStep[]>) => Map<string, ThinkingStep[]>)) => void;
  setExpandedThinking: (expanded: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setEnableExtendedThinking: (enable: boolean) => void;
  setSuggestions: (suggestions: PromptSuggestion[]) => void;
  setShowSuggestions: (show: boolean) => void;

  // Presence actions
  setPresence: (presence: Map<string, PresenceUser>) => void;
}

// ── Helper to load mission messages from localStorage ────────────────────────

function loadMissionMessages(): Map<string, AIMessage[]> {
  try {
    const stored = localStorage.getItem('war-room-mission-messages');
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.error('Failed to load mission messages from localStorage:', e);
  }
  return new Map();
}

// ── Helper to check mobile ───────────────────────────────────────────────────

function checkIsMobile(): boolean {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isSmallScreen = Math.min(width, height) <= 768;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return isSmallScreen || (isTouchDevice && width <= 1024);
}

// ── Helper for updater-style setters (supports both value and function) ──────

function resolveUpdater<T>(updater: T | ((prev: T) => T), prev: T): T {
  return typeof updater === 'function' ? (updater as (prev: T) => T)(prev) : updater;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useWarRoomStore = create<WarRoomState>()(
  subscribeWithSelector((set) => ({
    // ── Initial state ──────────────────────────────────────────────────

    // Project
    projects: [],
    selectedProjectId: null,
    showCreateProject: false,
    newProjectName: '',

    // Session
    sessions: [],
    selectedSessionId: null,
    messages: [],
    input: '',
    isLoading: false,
    missionMessages: loadMissionMessages(),
    isCreatingSession: false,
    newSessionTitle: '',
    activeAgent: 'general' as AgentType,

    // Document
    documents: [],
    showDocUpload: false,
    uploadingFiles: new Set<string>(),
    uploadProgress: new Map<string, number>(),
    activeContextDocs: new Set<string>(),
    showActiveContext: true,
    isDeletingDoc: false,
    viewingDoc: null,
    viewerHighlightText: undefined,
    viewerScrollOffset: undefined,

    // UI
    isSidebarOpen: false,
    isMobile: checkIsMobile(),
    showMobileMenu: false,
    contextPanelOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
    showKnowledgeBank: false,
    showShareModal: false,
    sharingDoc: null,
    showExportModal: false,
    showSessionExport: false,
    isExporting: false,
    expandedRooms: new Set<string>(),
    showMindMap: false,
    showChartGenerator: false,
    generatedChart: null,
    showStudyGuide: false,
    showFAQ: false,
    showTimeline: false,
    showPodcast: false,
    showOrganize: false,
    organizingDocId: undefined,
    showAdvancedAI: false,

    // Voice
    voiceEnabled: false,
    voiceMode: 'push-to-talk',
    voiceSynthesisEnabled: false,
    voiceGender: 'female',
    showVoiceAgentPanel: false,
    voiceAgentExpanded: false,
    audioUrl: null,
    isGeneratingAudio: false,
    audioData: [],
    visualizerType: 'idle',
    currentTokens: [],
    isAIStreaming: false,

    // Mode
    warRoomMode: 'tactical' as WarRoomMode,
    currentMission: 'research' as MissionType,
    currentRoom: 'war-room' as RoomType,
    showWarRoomHub: true,
    showMissionLauncher: false,
    glitchTrigger: false,
    showThinkingLogs: true,
    thinkingLogs: new Map<string, ThinkingStep[]>(),
    expandedThinking: new Set<string>(),
    enableExtendedThinking: false,
    suggestions: [],
    showSuggestions: true,

    // Presence
    presence: new Map<string, PresenceUser>(),

    // ── Actions ────────────────────────────────────────────────────────

    // Project
    setProjects: (projects) => set({ projects: Array.isArray(projects) ? projects : [] }),
    setSelectedProjectId: (id) => set({ selectedProjectId: id }),
    setShowCreateProject: (show) => set({ showCreateProject: show }),
    setNewProjectName: (name) => set({ newProjectName: name }),

    // Session
    setSessions: (sessions) => set({ sessions: Array.isArray(sessions) ? sessions : [] }),
    setSelectedSessionId: (id) => set({ selectedSessionId: id }),
    setMessages: (messages) => set({ messages: Array.isArray(messages) ? messages : [] }),
    setInput: (input) => set({ input }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setMissionMessages: (updater) => set((state) => ({
      missionMessages: resolveUpdater(updater, state.missionMessages),
    })),
    setIsCreatingSession: (creating) => set({ isCreatingSession: creating }),
    setNewSessionTitle: (title) => set({ newSessionTitle: title }),
    setActiveAgent: (agent) => set({ activeAgent: agent }),

    // Document
    setDocuments: (documents) => set({ documents: Array.isArray(documents) ? documents : [] }),
    setShowDocUpload: (show) => set({ showDocUpload: show }),
    setUploadingFiles: (updater) => set((state) => ({
      uploadingFiles: resolveUpdater(updater, state.uploadingFiles),
    })),
    setUploadProgress: (updater) => set((state) => ({
      uploadProgress: resolveUpdater(updater, state.uploadProgress),
    })),
    setActiveContextDocs: (updater) => set((state) => ({
      activeContextDocs: resolveUpdater(updater, state.activeContextDocs),
    })),
    setShowActiveContext: (show) => set({ showActiveContext: show }),
    setIsDeletingDoc: (deleting) => set({ isDeletingDoc: deleting }),
    setViewingDoc: (doc) => set({ viewingDoc: doc }),
    setViewerHighlightText: (text) => set({ viewerHighlightText: text }),
    setViewerScrollOffset: (offset) => set({ viewerScrollOffset: offset }),

    // UI
    setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
    setIsMobile: (mobile) => set({ isMobile: mobile }),
    setShowMobileMenu: (show) => set({ showMobileMenu: show }),
    setContextPanelOpen: (updater) => set((state) => ({
      contextPanelOpen: resolveUpdater(updater, state.contextPanelOpen),
    })),
    setShowKnowledgeBank: (show) => set({ showKnowledgeBank: show }),
    setShowShareModal: (show) => set({ showShareModal: show }),
    setSharingDoc: (doc) => set({ sharingDoc: doc }),
    setShowExportModal: (show) => set({ showExportModal: show }),
    setShowSessionExport: (show) => set({ showSessionExport: show }),
    setIsExporting: (exporting) => set({ isExporting: exporting }),
    setExpandedRooms: (updater) => set((state) => ({
      expandedRooms: resolveUpdater(updater, state.expandedRooms),
    })),
    setShowMindMap: (show) => set({ showMindMap: show }),
    setShowChartGenerator: (show) => set({ showChartGenerator: show }),
    setGeneratedChart: (chart) => set({ generatedChart: chart }),
    setShowStudyGuide: (show) => set({ showStudyGuide: show }),
    setShowFAQ: (show) => set({ showFAQ: show }),
    setShowTimeline: (show) => set({ showTimeline: show }),
    setShowPodcast: (show) => set({ showPodcast: show }),
    setShowOrganize: (show) => set({ showOrganize: show }),
    setOrganizingDocId: (id) => set({ organizingDocId: id }),
    setShowAdvancedAI: (show) => set({ showAdvancedAI: show }),

    // Voice
    setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
    setVoiceMode: (mode) => set({ voiceMode: mode }),
    setVoiceSynthesisEnabled: (enabled) => set({ voiceSynthesisEnabled: enabled }),
    setVoiceGender: (gender) => set({ voiceGender: gender }),
    setShowVoiceAgentPanel: (show) => set({ showVoiceAgentPanel: show }),
    setVoiceAgentExpanded: (expanded) => set({ voiceAgentExpanded: expanded }),
    setAudioUrl: (url) => set({ audioUrl: url }),
    setIsGeneratingAudio: (generating) => set({ isGeneratingAudio: generating }),
    setAudioData: (data) => set({ audioData: data }),
    setVisualizerType: (type) => set({ visualizerType: type }),
    setCurrentTokens: (tokens) => set({ currentTokens: tokens }),
    setIsAIStreaming: (streaming) => set({ isAIStreaming: streaming }),

    // Mode
    setWarRoomMode: (mode) => set({ warRoomMode: mode }),
    setCurrentMission: (mission) => set({ currentMission: mission }),
    setCurrentRoom: (room) => set({ currentRoom: room }),
    setShowWarRoomHub: (show) => set({ showWarRoomHub: show }),
    setShowMissionLauncher: (show) => set({ showMissionLauncher: show }),
    setGlitchTrigger: (trigger) => set({ glitchTrigger: trigger }),
    setShowThinkingLogs: (show) => set({ showThinkingLogs: show }),
    setThinkingLogs: (updater) => set((state) => ({
      thinkingLogs: resolveUpdater(updater, state.thinkingLogs),
    })),
    setExpandedThinking: (updater) => set((state) => ({
      expandedThinking: resolveUpdater(updater, state.expandedThinking),
    })),
    setEnableExtendedThinking: (enable) => set({ enableExtendedThinking: enable }),
    setSuggestions: (suggestions) => set({ suggestions }),
    setShowSuggestions: (show) => set({ showSuggestions: show }),

    // Presence
    setPresence: (presence) => set({ presence }),
  }))
);

// ── localStorage sync for missionMessages ────────────────────────────────────

useWarRoomStore.subscribe(
  (state) => state.missionMessages,
  (missionMessages) => {
    try {
      const obj = Object.fromEntries(missionMessages);
      localStorage.setItem('war-room-mission-messages', JSON.stringify(obj));
    } catch (e) {
      console.error('Failed to save mission messages to localStorage:', e);
    }
  }
);
