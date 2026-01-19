import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { Capacitor } from '@capacitor/core';
import { ragService, AISession, KnowledgeDoc, AIMessage, AIProject, PromptSuggestion, ThinkingStep } from '../services/ragService';
import { processWithModel, generateSpeech } from '../services/geminiService';
import toast from 'react-hot-toast';
import './WarRoomStyles.css';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { ModeSwitcher, WarRoomMode, MissionType, RoomType } from './WarRoom/ModeSwitcher';
import { FocusMode, AnalystMode, DataAnalystModeRedesigned, StrategistMode, StrategistModeRedesigned, BrainstormMode, BrainstormModeRedesigned, DebriefMode, DebriefModeRedesigned, ConversationModeRedesigned } from './WarRoom/modes';
import { ResearchMission, DecisionMission, BrainstormMission, PlanMission, AnalyzeMission, CreateMission } from './WarRoom/missions';

// NotebookLM-style components
import { DocumentViewer } from './WarRoom/DocumentViewer';
import { DocumentSearch } from './WarRoom/Search';
import { processDocument, getAcceptString } from '../services/documentProcessors';
import { StudyGuideGenerator, FAQGenerator, TimelineGenerator, PodcastGenerator } from './WarRoom/ContentGenerators';
import { OrganizationSidebar, FavoriteButton, TagManager } from './WarRoom/Organization';
import { recordDocumentView } from '../services/organizationService';
import { ShareModal, ActivityBadge, SharedWithMe } from './WarRoom/Collaboration';
import { recordActivity } from '../services/collaborationService';
import { AdvancedAIPanel } from './WarRoom/AdvancedAI';
import { warRoomExportService, WarRoomExportData } from '../services/warRoomExportService';

// Lazy load heavy components that may crash on mobile
const AudioVisualizer = lazy(() => import('./WarRoom/AudioVisualizer').then(m => ({ default: m.AudioVisualizer })));
const TokenStream = lazy(() => import('./WarRoom/TokenStream').then(m => ({ default: m.TokenStream })));
const VoiceControl = lazy(() => import('./WarRoom/VoiceControl').then(m => ({ default: m.VoiceControl })));
const ThinkingPanel = lazy(() => import('./WarRoom/ThinkingPanel').then(m => ({ default: m.ThinkingPanel })));
const NeuralTerminal = lazy(() => import('./WarRoom/modes/NeuralTerminal').then(m => ({ default: m.NeuralTerminal })));
const SentientInterface = lazy(() => import('./WarRoom/modes/SentientInterface').then(m => ({ default: m.SentientInterface })));
const XRayMode = lazy(() => import('./WarRoom/modes/XRayMode').then(m => ({ default: m.XRayMode })));
const CommandCenter = lazy(() => import('./WarRoom/modes/CommandCenter').then(m => ({ default: m.CommandCenter })));
const ElegantInterface = lazy(() => import('./WarRoom/modes/ElegantInterface').then(m => ({ default: m.ElegantInterface })));
const MatrixRain = lazy(() => import('./WarRoom/effects/MatrixRain').then(m => ({ default: m.MatrixRain })));
const GlitchEffect = lazy(() => import('./WarRoom/effects/GlitchEffect').then(m => ({ default: m.GlitchEffect })));
const VoiceAgentPanel = lazy(() => import('./WarRoom/VoiceAgentPanel').then(m => ({ default: m.VoiceAgentPanel })));
const WarRoomRedesigned = lazy(() => import('./WarRoom/WarRoomRedesigned').then(m => ({ default: m.WarRoomRedesigned })));
const FocusModeRedesigned = lazy(() => import('./WarRoom/modes/FocusModeRedesigned').then(m => ({ default: m.FocusModeRedesigned })));
const WarRoomHub = lazy(() => import('./WarRoom/WarRoomHub').then(m => ({ default: m.WarRoomHub })));
const FloatingModeDock = lazy(() => import('./WarRoom/FloatingModeDock').then(m => ({ default: m.FloatingModeDock })));

// New War Room Sidebar component
import { WarRoomSidebar, WarRoomProject, WarRoomSession, AIMessage as SidebarAIMessage } from './WarRoom/WarRoomSidebar';

// Import voice synthesis hook - this is lightweight
import { useVoiceSynthesis } from './WarRoom/VoiceSynthesis';

// Check if we're on a mobile/native platform
const isMobilePlatform = Capacitor.isNativePlatform() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Loading fallback component
const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="h-full w-full flex items-center justify-center bg-gray-900/50">
    <div className="text-center">
      <i className="fa fa-spinner fa-spin text-2xl text-rose-500 mb-2"></i>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  </div>
);

interface Token {
  text: string;
  confidence: number;
  alternatives?: string[];
  timestamp: number;
}

interface LiveDashboardProps {
  apiKey: string;
  userId: string;
}

// Agent type
type AgentType = 'general' | 'skeptic' | 'scribe' | 'deep-diver';

// Agent definitions for the selector
const AGENTS: { id: AgentType; name: string; icon: string; description: string; color: string }[] = [
  { id: 'general', name: 'General', icon: 'fa-lightbulb', description: 'Balanced AI assistant for any task', color: 'from-amber-500 to-yellow-500' },
  { id: 'skeptic', name: 'Skeptic', icon: 'fa-scale-balanced', description: 'Critical thinker, questions assumptions', color: 'from-purple-500 to-indigo-500' },
  { id: 'scribe', name: 'Scribe', icon: 'fa-pen-fancy', description: 'Note-taker and summarizer', color: 'from-emerald-500 to-teal-500' },
  { id: 'deep-diver', name: 'Deep Diver', icon: 'fa-microscope', description: 'In-depth analysis and research', color: 'from-blue-500 to-cyan-500' },
];

// War Room styled Agent Selector component
const AgentSelector: React.FC<{
  activeAgent: AgentType;
  onAgentChange: (agent: AgentType) => void;
}> = ({ activeAgent, onAgentChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedAgent = AGENTS.find(a => a.id === activeAgent) || AGENTS[0];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="war-room-btn px-3 py-1.5 flex items-center gap-2"
      >
        <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${selectedAgent.color}`} />
        <i className={`fa ${selectedAgent.icon} text-sm`}></i>
        <span className="text-sm font-medium hidden sm:inline">{selectedAgent.name}</span>
        <i className={`fa fa-chevron-down text-xs war-room-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute top-full right-0 mt-2 w-64 war-room-panel z-50 overflow-hidden"
        >
          <div className="text-xs war-room-text-secondary px-3 py-2 font-semibold uppercase tracking-wider border-b border-white/10">
            AI Agent Persona
          </div>
          <div className="p-1">
            {AGENTS.map(agent => (
              <button
                key={agent.id}
                onClick={() => {
                  onAgentChange(agent.id);
                  setIsOpen(false);
                }}
                className={`war-room-list-item w-full p-2.5 text-left ${
                  activeAgent === agent.id ? 'active' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.color} bg-opacity-20 flex items-center justify-center`}>
                    <i className={`fa ${agent.icon} text-sm ${activeAgent === agent.id ? 'text-white' : ''}`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{agent.name}</div>
                    <div className={`text-xs truncate ${activeAgent === agent.id ? 'text-white/70' : 'war-room-text-secondary'}`}>
                      {agent.description}
                    </div>
                  </div>
                  {activeAgent === agent.id && (
                    <i className="fa fa-check text-xs"></i>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LiveDashboard: React.FC<LiveDashboardProps> = ({ apiKey, userId }) => {
  // Projects / War Rooms
  const [projects, setProjects] = useState<AIProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Sessions
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Per-mission conversation history storage
  // Format: { missionType-sessionId: AIMessage[] }
  const [missionMessages, setMissionMessages] = useState<Map<string, AIMessage[]>>(() => {
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
  });
  
  // Documents with enhanced visibility
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());
  
  // Active Context Management
  const [activeContextDocs, setActiveContextDocs] = useState<Set<string>>(new Set());
  const [showActiveContext, setShowActiveContext] = useState(true);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  
  // NotebookLM Features
  const [showMindMap, setShowMindMap] = useState(false);
  const [showChartGenerator, setShowChartGenerator] = useState(false);
  const [generatedChart, setGeneratedChart] = useState<string | null>(null);

  // Content Generators (Phase 2 & 3)
  const [showStudyGuide, setShowStudyGuide] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showPodcast, setShowPodcast] = useState(false);
  const [showOrganize, setShowOrganize] = useState(false);
  const [organizingDocId, setOrganizingDocId] = useState<string | undefined>(undefined);
  const [showAdvancedAI, setShowAdvancedAI] = useState(false);

  // Context Panel Collapsible State - Now in header toolbar
  const [isContextPanelExpanded, setIsContextPanelExpanded] = useState(false);
  const [showKnowledgeBank, setShowKnowledgeBank] = useState(false);

  // Sharing State
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingDoc, setSharingDoc] = useState<KnowledgeDoc | null>(null);

  // Document Viewer State
  const [viewingDoc, setViewingDoc] = useState<KnowledgeDoc | null>(null);
  const [viewerHighlightText, setViewerHighlightText] = useState<string | undefined>(undefined);
  const [viewerScrollOffset, setViewerScrollOffset] = useState<number | undefined>(undefined);
  
  // UI State
  // Use a function to detect mobile more reliably
  const checkIsMobile = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Consider mobile if width is small OR if it's a touch device with small screen
    const isSmallScreen = Math.min(width, height) <= 768;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return isSmallScreen || (isTouchDevice && width <= 1024);
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Collapsed by default
  const [isMobile, setIsMobile] = useState(checkIsMobile);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // New Session State
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');

  // Agent Persona State
  const [activeAgent, setActiveAgent] = useState<'general' | 'skeptic' | 'scribe' | 'deep-diver'>('general');

  // AI Thinking Visibility
  const [thinkingLogs, setThinkingLogs] = useState<Map<string, ThinkingStep[]>>(new Map());
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const [enableExtendedThinking, setEnableExtendedThinking] = useState(false);

  // Prompt Suggestions
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Export
  const [showExportModal, setShowExportModal] = useState(false);

  // Sidebar tree expansion state
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const [showSessionExport, setShowSessionExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // War Room Neural Interface
  const [warRoomMode, setWarRoomMode] = useState<WarRoomMode>('tactical');
  const [currentMission, setCurrentMission] = useState<MissionType>('research');
  const [currentRoom, setCurrentRoom] = useState<RoomType>('war-room');
  const [showWarRoomHub, setShowWarRoomHub] = useState(true); // Show landing page on start
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'push-to-talk' | 'always-on' | 'wake-word'>('push-to-talk');
  const [currentTokens, setCurrentTokens] = useState<Token[]>([]);
  const [isAIStreaming, setIsAIStreaming] = useState(false);
  const [audioData, setAudioData] = useState<number[]>([]);
  const [visualizerType, setVisualizerType] = useState<'listening' | 'thinking' | 'speaking' | 'idle'>('idle');
  const [voiceSynthesisEnabled, setVoiceSynthesisEnabled] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female' | 'neutral'>('female');
  const [glitchTrigger, setGlitchTrigger] = useState(false);

  // Voice Synthesis Hook
  const { speak, isSpeaking } = useVoiceSynthesis(voiceSynthesisEnabled, voiceGender);
  
  const [showThinkingLogs, setShowThinkingLogs] = useState(true);

  // OpenAI Realtime Voice Agent
  const [showVoiceAgentPanel, setShowVoiceAgentPanel] = useState(false);
  const [voiceAgentExpanded, setVoiceAgentExpanded] = useState(false);
  const openaiApiKey = localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '';


  // Handle resize and orientation changes for mobile responsiveness
  useEffect(() => {
    const handleResize = () => {
      const mobile = checkIsMobile();
      setIsMobile(mobile);
      if (mobile && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
      // Close mobile menu on orientation change
      setShowMobileMenu(false);
    };

    // Listen for both resize and orientation change
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Also check on visibility change (when app comes back to foreground)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleResize();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSidebarOpen]);

  // Load initial data
  useEffect(() => {
    if (userId) {
      loadProjects();
      loadSessions();
    }
  }, [userId]);

  // Save mission messages to localStorage whenever they change
  useEffect(() => {
    try {
      const obj = Object.fromEntries(missionMessages);
      localStorage.setItem('war-room-mission-messages', JSON.stringify(obj));
    } catch (e) {
      console.error('Failed to save mission messages to localStorage:', e);
    }
  }, [missionMessages]);

  // Helper function to get messages for current mission/session
  const getCurrentMissionKey = () => {
    if (currentRoom === 'missions') {
      return `${currentMission}-${selectedSessionId || 'default'}`;
    } else if (currentRoom === 'war-room') {
      return `${warRoomMode}-${selectedSessionId || 'default'}`;
    }
    return `default-${selectedSessionId || 'default'}`;
  };

  // Get messages for current mission
  const getMissionMessages = (): AIMessage[] => {
    const key = getCurrentMissionKey();
    return missionMessages.get(key) || [];
  };

  // Set messages for current mission
  const setMissionMessagesForCurrent = (newMessages: AIMessage[]) => {
    const key = getCurrentMissionKey();
    setMissionMessages(prev => {
      const updated = new Map(prev);
      updated.set(key, newMessages);
      return updated;
    });
  };

  // Clear messages for current mission (new session)
  const clearMissionMessages = () => {
    const key = getCurrentMissionKey();
    setMissionMessages(prev => {
      const updated = new Map(prev);
      updated.delete(key);
      return updated;
    });
  };

  // Reload documents when project changes (but not during deletion)
  useEffect(() => {
    if (userId && !isDeletingDoc) {
      console.log('[War Room] useEffect triggered - Project:', selectedProjectId, 'Deleting:', isDeletingDoc);
      console.log('[War Room] Loading documents...');
      loadDocuments();
    } else if (isDeletingDoc) {
      console.log('[War Room] SKIPPING reload - deletion in progress');
    }
  }, [userId, selectedProjectId, isDeletingDoc]);

  // Load Messages when session changes
  useEffect(() => {
    if (selectedSessionId) {
      loadMessages(selectedSessionId);
      loadSuggestions();
    } else {
      setMessages([]);
      setSuggestions([]);
    }
  }, [selectedSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await ragService.getProjects(userId);
      if (data) setProjects(data);
    } catch (e) {
      console.error("Failed to load projects", e);
    }
  }, [userId]);

  const loadSessions = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await ragService.getSessions(userId, selectedProjectId || undefined);
      if (data) setSessions(data);
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  }, [userId, selectedProjectId]);

  const loadDocuments = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await ragService.getDocuments(userId, selectedProjectId || undefined);
      if (data) {
        console.log('📚 Loaded documents:', data);
        setDocuments(data);
      }
    } catch (e) {
      console.error("Failed to load documents", e);
    }
  }, [userId, selectedProjectId]);

  const loadMessages = async (sessionId: string) => {
    try {
      const { data } = await ragService.getMessages(sessionId);
      if (data) setMessages(data);
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  };

  const loadSuggestions = async () => {
    if (!selectedSessionId) return;
    try {
      const { data } = await ragService.getSuggestions(selectedSessionId);
      if (data) setSuggestions(data);
    } catch (e) {
      console.error("Failed to load suggestions", e);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a War Room name');
      return;
    }
    
    try {
      console.log('[War Room] Creating project:', newProjectName);
      const { data, error } = await ragService.createProject(userId, newProjectName);
      
      if (error) {
        console.error('[War Room] Project creation error:', error);
        toast.error(`Failed to create War Room: ${error.message || 'Unknown error'}`);
        return;
      }
      
      if (data) {
        console.log('[War Room] Project created successfully:', data);
        toast.success('War Room created! 🎯');
        setProjects([data, ...projects]);
        setSelectedProjectId(data.id);
        setNewProjectName('');
        setShowCreateProject(false);
      } else {
        console.error('[War Room] No data returned from createProject');
        toast.error('Failed to create War Room: No data returned');
      }
    } catch (e) {
      console.error('[War Room] Project creation exception:', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Failed to create War Room: ${errorMessage}`);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionTitle.trim()) {
      toast.error("Please enter a session title");
      return;
    }
    
    try {
      console.log('[War Room] Creating session:', newSessionTitle);
      const { data, error } = await ragService.createSession(
        userId, 
        newSessionTitle, 
        undefined, 
        selectedProjectId || undefined
      );
      
      if (error) {
        console.error("[War Room] Session creation error:", error);
        toast.error(`Failed to create session: ${error.message || 'Unknown error'}`);
        return;
      }
      
      if (data) {
        console.log('[War Room] Session created successfully:', data);
        toast.success("Session created!");
        setSessions([data, ...sessions]);
        setSelectedSessionId(data.id);
        setNewSessionTitle('');
        setIsCreatingSession(false);
      } else {
        console.error('[War Room] No data returned from createSession');
        toast.error('Failed to create session: No data returned');
      }
    } catch (e) {
      console.error("[War Room] Session creation exception:", e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Failed to create session: ${errorMessage}`);
    }
  };

  // Direct send message function that accepts message as parameter
  const sendMessageDirect = async (messageText: string) => {
    if (!selectedSessionId || !messageText.trim()) return;

    const userMessage = messageText.trim();
    setInput('');
    setIsLoading(true);
    setVisualizerType('thinking');
    setIsAIStreaming(true);

    const thinkingSteps: ThinkingStep[] = [];
    let stepStartTime = Date.now();

    try {
      // Get current mission messages
      const currentMessages = getMissionMessages();

      // Add user message
      const { data: userMsg } = await ragService.addMessage(selectedSessionId, userId, 'user', userMessage);
      const updatedMessagesWithUser = userMsg ? [...currentMessages, userMsg] : currentMessages;
      setMissionMessagesForCurrent(updatedMessagesWithUser);
      // Also update global messages for backward compatibility
      if (userMsg) setMessages(prev => [...prev, userMsg]);

      // Step 1: Analyze query
      if (enableExtendedThinking) {
        thinkingSteps.push({
          step: 1,
          thought: `Analyzing user query: "${userMessage.substring(0, 50)}..."`,
          duration_ms: Date.now() - stepStartTime
        });
        stepStartTime = Date.now();
      }

      // Step 2: Search for relevant documents
      let context = '';
      const citations: string[] = [];

      // Determine which documents to search (active context or all)
      const docsToSearch = activeContextDocs.size > 0
        ? documents.filter(d => activeContextDocs.has(d.id))
        : documents;

      console.log('🔍 Starting document search...');
      console.log('   Total documents:', documents.length);
      console.log('   Active context docs:', activeContextDocs.size);
      console.log('   Searching in:', docsToSearch.length, 'documents');
      console.log('   Document titles:', docsToSearch.map(d => d.title));
      console.log('   User question:', userMessage);

      if (docsToSearch.length > 0) {
        if (enableExtendedThinking) {
          const searchScope = activeContextDocs.size > 0
            ? `${activeContextDocs.size} documents in active context`
            : `${documents.length} documents in knowledge base`;
          thinkingSteps.push({
            step: 2,
            thought: `Searching ${searchScope}...`,
            duration_ms: Date.now() - stepStartTime
          });
          stepStartTime = Date.now();
        }

        const similarDocs = await ragService.searchSimilar(
          apiKey,
          userMessage,
          userId,
          selectedProjectId || undefined
        );

        // Filter results to only active context docs if specified
        const filteredDocs = activeContextDocs.size > 0
          ? similarDocs.filter((d: any) => activeContextDocs.has(d.doc_id))
          : similarDocs;

        console.log('🔍 Search complete!');
        console.log('   Similar docs found:', similarDocs.length);
        console.log('   After context filter:', filteredDocs.length);
        console.log('   Filtered docs:', filteredDocs);

        if (filteredDocs.length > 0) {
          // Build comprehensive context
          const contextParts = filteredDocs.map((d: any, i: number) => {
            citations.push(d.doc_title);
            return `### SOURCE ${i + 1}: ${d.doc_title} (Similarity: ${(d.similarity * 100).toFixed(1)}%)\n\n${d.content}\n\n`;
          }).join('---\n\n');

          const contextNote = activeContextDocs.size > 0
            ? `📚 IMPORTANT: You are ONLY using documents from the ACTIVE CONTEXT (${activeContextDocs.size} documents selected by user). You MUST reference and cite these sources when answering.\n\n`
            : `📚 IMPORTANT: You have access to the following documents from the knowledge base. You MUST reference and cite these sources when answering the user's question.\n\n`;

          context = contextNote + contextParts;

          console.log('✅ Context built:');
          console.log('   Length:', context.length);
          console.log('   Citations:', citations);
          console.log('   Preview:', context.substring(0, 200) + '...');

          const scopeMsg = activeContextDocs.size > 0
            ? `Found ${filteredDocs.length} relevant source(s) in active context`
            : `Found ${filteredDocs.length} relevant source(s)`;
          toast.success(scopeMsg, { icon: '📚' });

          if (enableExtendedThinking) {
            thinkingSteps.push({
              step: 3,
              thought: `Found ${filteredDocs.length} relevant document chunks: ${citations.slice(0, 3).join(', ')}${citations.length > 3 ? '...' : ''}`,
              duration_ms: Date.now() - stepStartTime
            });
            stepStartTime = Date.now();
          }
        } else {
          console.log('⚠️ No similar documents found');
          console.log('   This could mean:');
          console.log('   1. No embeddings in database');
          console.log('   2. Similarity threshold too high');
          console.log('   3. Query embedding failed');
          console.log('   4. Active context filter removed all results');

          const noResultsMsg = activeContextDocs.size > 0
            ? `No relevant content found in active context (${activeContextDocs.size} docs)`
            : `No relevant documents found for this query`;
          toast(noResultsMsg, { icon: 'ℹ️' });

          if (enableExtendedThinking) {
            thinkingSteps.push({
              step: 3,
              thought: activeContextDocs.size > 0
                ? 'No relevant content found in active context documents'
                : 'No directly relevant documents found in knowledge base',
              duration_ms: Date.now() - stepStartTime
            });
            stepStartTime = Date.now();
          }
        }
      } else {
        console.log('⚠️ No documents in knowledge base');
      }

      // Step 3: Generate response with agent persona
      const agentPrompts: Record<string, string> = {
        general: 'You are a helpful AI assistant with access to a knowledge base.',
        skeptic: 'You are a critical thinker with access to a knowledge base. Question assumptions and challenge ideas constructively based on the provided sources.',
        scribe: 'You are a meticulous note-taker with access to a knowledge base. Organize information clearly with bullet points and structure, citing sources.',
        'deep-diver': 'You are an analytical researcher with access to a knowledge base. Provide comprehensive explanations with nuance, always citing your sources.'
      };

      if (enableExtendedThinking) {
        thinkingSteps.push({
          step: 4,
          thought: `Formulating response as ${activeAgent} persona...`,
          duration_ms: Date.now() - stepStartTime
        });
        stepStartTime = Date.now();
      }

      const systemPrompt = agentPrompts[activeAgent] || agentPrompts.general;

      // Enhanced prompt structure
      let fullPrompt = systemPrompt + '\n\n';

      if (context) {
        fullPrompt += context;
        fullPrompt += `\n\nIMPORTANT INSTRUCTIONS:\n`;
        fullPrompt += `- Base your answer PRIMARILY on the provided sources above\n`;
        fullPrompt += `- Explicitly mention which source you're referencing (e.g., "According to ${citations[0]}...")\n`;
        fullPrompt += `- If the sources don't contain the answer, say so clearly\n`;
        fullPrompt += `- Do not make up information not present in the sources\n\n`;
      }

      fullPrompt += `USER QUESTION: ${userMessage}\n\n`;
      fullPrompt += `YOUR RESPONSE:`;

      console.log('📤 Sending to AI:');
      console.log('   Prompt length:', fullPrompt.length);
      console.log('   Has context:', !!context);
      console.log('   Full prompt preview:', fullPrompt.substring(0, 300) + '...');

      const response = await processWithModel(apiKey, fullPrompt);

      console.log('📥 AI Response received:');
      console.log('   Length:', response?.length);
      console.log('   Preview:', response?.substring(0, 200));

      if (enableExtendedThinking) {
        thinkingSteps.push({
          step: 5,
          thought: `Generated ${response?.length || 0} character response`,
          duration_ms: Date.now() - stepStartTime
        });
      }

      // Add AI message with citations
      const { data: aiMsg } = await ragService.addMessage(
        selectedSessionId,
        null,
        'assistant',
        response || 'I encountered an issue processing your request.',
        citations.map(c => ({ title: c }))
      );

      if (aiMsg) {
        // Update mission-specific messages
        const latestMessages = getMissionMessages();
        setMissionMessagesForCurrent([...latestMessages, aiMsg]);
        // Also update global messages for backward compatibility
        setMessages(prev => [...prev, aiMsg]);

        // Trigger glitch effect
        setGlitchTrigger(true);
        setTimeout(() => setGlitchTrigger(false), 100);

        // Speak the response if voice synthesis is enabled
        if (voiceSynthesisEnabled && response) {
          setVisualizerType('speaking');
          speak(response).then(() => {
            setVisualizerType('idle');
          }).catch(() => {
            setVisualizerType('idle');
          });
        }

        // Save thinking log
        if (enableExtendedThinking && thinkingSteps.length > 0) {
          const { data: logData } = await ragService.saveThinkingLog(aiMsg.id, thinkingSteps);
          if (logData) {
            setThinkingLogs(new Map(thinkingLogs.set(aiMsg.id, thinkingSteps)));
          }
        }

        // Generate new suggestions
        setTimeout(() => generateNewSuggestions(), 1000);
      }

    } catch (error) {
      console.error('AI processing failed:', error);
      toast.error('Failed to get AI response');
    } finally {
      setIsLoading(false);
      setIsAIStreaming(false);
      setVisualizerType('idle');
    }
  };

  // Wrapper that uses input state (for UI send button)
  const handleSendMessage = async () => {
    if (!selectedSessionId || !input.trim()) return;
    await sendMessageDirect(input);
  };

  const generateNewSuggestions = async () => {
    if (!selectedSessionId || messages.length < 2) return;

    try {
      const recentMsgs = messages.slice(-5).map(m => `${m.role}: ${m.content.substring(0, 100)}`);
      const newSuggestions = await ragService.generateSuggestions(
        apiKey,
        selectedSessionId,
        recentMsgs,
        documents
      );
      
      if (newSuggestions.length > 0) {
        loadSuggestions();
      }
    } catch (e) {
      console.error('Failed to generate suggestions', e);
    }
  };

  const handleUseSuggestion = (suggestion: PromptSuggestion) => {
    setInput(suggestion.suggestion_text);
    ragService.markSuggestionUsed(suggestion.id);
    setSuggestions(suggestions.filter(s => s.id !== suggestion.id));
  };

  const toggleThinking = (messageId: string) => {
    const newExpanded = new Set(expandedThinking);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedThinking(newExpanded);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    console.log('📤 Starting file upload, number of files:', files.length);

    for (const file of Array.from(files)) {
      const fileId = `${file.name}-${Date.now()}`;
      setUploadingFiles(new Set(uploadingFiles.add(fileId)));
      setUploadProgress(new Map(uploadProgress.set(fileId, 0)));

      console.log('📄 Processing file:', file.name, 'Type:', file.type, 'Size:', file.size, 'bytes');

      try {
        // Use document processor for all file types (PDF, DOCX, XLSX, Images, etc.)
        console.log('🔄 Processing file with document processor...');

        const processorResult = await processDocument(file, (progress) => {
          // Progress callback: 0-40% for document processing
          const mappedProgress = progress * 40;
          setUploadProgress(new Map(uploadProgress.set(fileId, mappedProgress)));
        });

        if (processorResult.error) {
          throw new Error(processorResult.error);
        }

        const text = processorResult.text;
        console.log('✅ Document processed:', file.name, 'Content length:', text.length);

        if (!text || text.trim().length === 0) {
          throw new Error('No text content extracted from file');
        }

        setUploadProgress(new Map(uploadProgress.set(fileId, 45))); // 45% - processing complete

        console.log('🚀 Starting ingestion for:', file.name);
        console.log('   User ID:', userId);
        console.log('   Project ID:', selectedProjectId);
        console.log('   Extracted text length:', text.length);
        console.log('   Metadata:', processorResult.metadata);

        // Determine file type for the database
        const extension = file.name.split('.').pop()?.toLowerCase() || 'txt';
        const fileType = ['pdf', 'docx', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'gif'].includes(extension)
          ? extension
          : 'text';

        const result = await ragService.ingestTextDocument(
          apiKey,
          userId,
          file.name,
          text,
          fileType,
          undefined,
          selectedProjectId || undefined,
          (progress: number) => {
            // Progress callback: 45-95%
            const mappedProgress = 45 + (progress * 0.5);
            setUploadProgress(new Map(uploadProgress.set(fileId, mappedProgress)));
          }
        );

        setUploadProgress(new Map(uploadProgress.set(fileId, 100))); // 100% - complete

        console.log('✅ Ingestion complete:', result);
        console.log('   Document ID:', result.id);
        console.log('   Summary:', result.ai_summary);
        console.log('   Keywords:', result.ai_keywords);

        // Clean up progress tracking
        setTimeout(() => {
          uploadingFiles.delete(fileId);
          uploadProgress.delete(fileId);
          setUploadingFiles(new Set(uploadingFiles));
          setUploadProgress(new Map(uploadProgress));
        }, 500);

        loadDocuments();

        // Show success with metadata info
        const metaInfo = processorResult.metadata?.pageCount
          ? ` (${processorResult.metadata.pageCount} pages)`
          : processorResult.metadata?.wordCount
          ? ` (${processorResult.metadata.wordCount} words)`
          : '';

        toast.success(`✅ ${file.name}${metaInfo} indexed with AI summary!`, {
          duration: 3000,
          icon: '📚'
        });

      } catch (error) {
        console.error('❌ Upload failed:', error);
        uploadingFiles.delete(fileId);
        uploadProgress.delete(fileId);
        setUploadingFiles(new Set(uploadingFiles));
        setUploadProgress(new Map(uploadProgress));

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to process ${file.name}: ${errorMessage}`);
      }
    }

    // Reset file input
    e.target.value = '';
  };

  const handleGenerateAudioOverview = async () => {
    if (messages.length === 0) return;

    setIsGeneratingAudio(true);
    try {
      const conversationSummary = messages
        .slice(-10)
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const summaryText = await processWithModel(
        apiKey,
        `Provide a brief 30-second audio summary of this conversation:\n\n${conversationSummary}`
      );

      if (summaryText) {
        const audio = await generateSpeech(apiKey, summaryText);
        if (audio) {
          const blob = new Blob([audio], { type: 'audio/mp3' });
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          toast.success('Audio overview ready! 🎧');
        }
      }
    } catch (e) {
      toast.error('Failed to generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    const docToDelete = documents.find(d => d.id === id);
    console.log('[War Room] DELETE CLICKED - Document:', docToDelete?.title, 'ID:', id);
    
    // Block all reloads during deletion
    setIsDeletingDoc(true);
    
    try {
      // Remove from active context immediately
      if (activeContextDocs.has(id)) {
        console.log('[War Room] Removing from active context');
        setActiveContextDocs(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }

      // Optimistically remove from UI
      console.log('[War Room] Removing from UI optimistically');
      setDocuments(prev => prev.filter(d => d.id !== id));

      // Delete from database
      console.log('[War Room] Calling ragService.deleteDocument...');
      const result = await ragService.deleteDocument(id);

      if (result.error) {
        console.error('[War Room] ❌ DELETE FAILED:', result.error);
        console.error('[War Room] Error details:', JSON.stringify(result.error, null, 2));
        
        // Revert UI on error
        setIsDeletingDoc(false);
        await loadDocuments();
        toast.error(`Failed to delete: ${result.error.message || 'Permission denied'}`);
      } else {
        console.log('[War Room] ✅ DELETE SUCCESS - Database confirmed deletion');
        
        // Wait for DB transaction to fully commit
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now allow reloads and refresh
        setIsDeletingDoc(false);
        console.log('[War Room] Reloading documents to verify...');
        await loadDocuments();
        
        toast.success(`Deleted: ${docToDelete?.title || 'Document'}`);
        console.log('[War Room] ✅ Delete complete and verified');
      }
    } catch (e) {
      console.error('[War Room] ❌ EXCEPTION during delete:', e);
      console.error('[War Room] Exception details:', e);
      
      // Revert on exception
      setIsDeletingDoc(false);
      await loadDocuments();
      
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Delete failed: ${errorMessage}`);
    }
  };

  const handleRetryDoc = async (id: string) => {
    try {
      // Update UI to show processing
      setDocuments(prev => prev.map(d =>
        d.id === id ? { ...d, processing_status: 'processing' } : d
      ));

      toast.loading(`Reprocessing document...`, { id: `retry-${id}` });

      await ragService.retryDocumentProcessing(apiKey, id, (progress: number) => {
        // Could add progress tracking here
      });

      await loadDocuments();
      toast.success('Document processed successfully!', { id: `retry-${id}` });
    } catch (e) {
      console.error('Retry failed:', e);
      await loadDocuments();
      toast.error(`Failed to process document: ${e instanceof Error ? e.message : 'Unknown error'}`, { id: `retry-${id}` });
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await ragService.deleteSession(id);
      setSessions(sessions.filter(s => s.id !== id));
      if (selectedSessionId === id) setSelectedSessionId(null);
      toast.success('Session deleted');
    } catch (e) {
      toast.error('Failed to delete session');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await ragService.deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
      if (selectedProjectId === id) setSelectedProjectId(null);
      toast.success('War Room deleted');
    } catch (e) {
      toast.error('Failed to delete project');
    }
  };

  // Toggle room expansion in tree view
  const toggleRoomExpanded = (roomId: string) => {
    setExpandedRooms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roomId)) {
        newSet.delete(roomId);
      } else {
        newSet.add(roomId);
      }
      return newSet;
    });
  };

  // Export current session to Archives
  const handleExportSession = async () => {
    if (!selectedSessionId) {
      toast.error('Please select a session to export');
      return;
    }

    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) {
      toast.error('Session not found');
      return;
    }

    setIsExporting(true);
    try {
      const currentMessages = getMissionMessages();
      const project = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : undefined;

      const exportData: WarRoomExportData = {
        session,
        project,
        messages: currentMessages,
        mode: currentRoom === 'war-room' ? warRoomMode : 'mission',
        mission: currentRoom === 'missions' ? currentMission : undefined,
        documents: documents
          .filter(d => activeContextDocs.has(d.id))
          .map(d => ({ id: d.id, name: d.name, type: d.content_type })),
        exportedAt: new Date(),
      };

      const result = await warRoomExportService.exportToArchive(exportData, {
        type: 'markdown',
        includeTimestamps: true,
        includeMetadata: true,
        includeDocumentRefs: true,
      });

      if (result.success) {
        toast.success('Session exported to Archives!');
        setShowSessionExport(false);
      } else {
        toast.error(result.error || 'Export failed');
      }
    } catch (e) {
      console.error('Export error:', e);
      toast.error('Failed to export session');
    } finally {
      setIsExporting(false);
    }
  };

  // Download session as file
  const handleDownloadSession = (format: 'markdown' | 'html' | 'json') => {
    if (!selectedSessionId) {
      toast.error('Please select a session to download');
      return;
    }

    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) return;

    const currentMessages = getMissionMessages();
    const project = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : undefined;

    const exportData: WarRoomExportData = {
      session,
      project,
      messages: currentMessages,
      mode: currentRoom === 'war-room' ? warRoomMode : 'mission',
      mission: currentRoom === 'missions' ? currentMission : undefined,
      documents: documents
        .filter(d => activeContextDocs.has(d.id))
        .map(d => ({ id: d.id, name: d.name, type: d.content_type })),
      exportedAt: new Date(),
    };

    warRoomExportService.exportAndDownload(exportData, {
      type: format,
      includeTimestamps: true,
      includeMetadata: true,
      includeDocumentRefs: true,
    });

    toast.success(`Downloaded as ${format.toUpperCase()}`);
  };

  // Active Context Management
  const toggleDocInContext = (docId: string) => {
    setActiveContextDocs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
        toast.success('Removed from active context');
      } else {
        newSet.add(docId);
        toast.success('Added to active context');
      }
      return newSet;
    });
  };

  const addAllDocsToContext = () => {
    const allDocIds = documents
      .filter(d => d.processing_status === 'completed')
      .map(d => d.id);
    setActiveContextDocs(new Set(allDocIds));
    toast.success(`Added ${allDocIds.length} documents to context`);
  };

  const clearActiveContext = () => {
    setActiveContextDocs(new Set());
    toast.success('Cleared active context');
  };

  // Get active context documents
  const activeContextDocuments = documents.filter(d => activeContextDocs.has(d.id));
  
  // Calculate context size estimate (rough estimate)
  const estimateContextTokens = () => {
    return activeContextDocuments.reduce((total, doc) => {
      // Rough estimate: 1 token ≈ 4 characters
      const summaryTokens = (doc.ai_summary?.length || 0) / 4;
      return total + summaryTokens;
    }, 0);
  };

  // Export Functions
  const exportToMarkdown = () => {
    if (!selectedSessionId || messages.length === 0) return '';
    
    const session = sessions.find(s => s.id === selectedSessionId);
    const timestamp = new Date().toLocaleString();
    
    let markdown = `# War Room Session: ${session?.title || 'Untitled'}\n\n`;
    markdown += `**Exported:** ${timestamp}\n`;
    markdown += `**Agent:** ${activeAgent}\n`;
    if (selectedProject) markdown += `**Project:** ${selectedProject.name}\n`;
    markdown += `**Messages:** ${messages.length}\n\n`;
    markdown += `---\n\n`;
    
    messages.forEach((msg, i) => {
      markdown += `## ${msg.role === 'user' ? '👤 User' : '🤖 AI'}\n`;
      markdown += `*${new Date(msg.created_at).toLocaleString()}*\n\n`;
      markdown += `${msg.content}\n\n`;
      
      if (msg.citations && msg.citations.length > 0) {
        markdown += `**Sources:** ${msg.citations.map((c: any) => c.title).join(', ')}\n\n`;
      }
      
      markdown += `---\n\n`;
    });
    
    return markdown;
  };

  const exportToJSON = () => {
    if (!selectedSessionId || messages.length === 0) return null;
    
    const session = sessions.find(s => s.id === selectedSessionId);
    
    return {
      session: {
        id: session?.id,
        title: session?.title,
        description: session?.description,
        project: selectedProject?.name
      },
      agent: activeAgent,
      exported_at: new Date().toISOString(),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
        citations: m.citations
      })),
      documents: documents.map(d => ({
        title: d.title,
        summary: d.ai_summary,
        keywords: d.ai_keywords
      }))
    };
  };

  const generateSummary = async () => {
    if (messages.length === 0) return '';
    
    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');
    
    const summary = await processWithModel(
      apiKey,
      `Create a concise summary of this War Room session. Include key points, decisions, and action items:\n\n${conversationText}`
    );
    
    return summary || 'Failed to generate summary';
  };

  const handleExport = async (format: 'markdown' | 'json' | 'summary') => {
    try {
      if (format === 'markdown') {
        const content = exportToMarkdown();
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `war-room-${selectedSessionId?.slice(0, 8)}-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported as Markdown!');
      } else if (format === 'json') {
        const content = JSON.stringify(exportToJSON(), null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `war-room-${selectedSessionId?.slice(0, 8)}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported as JSON!');
      } else if (format === 'summary') {
        toast.loading('Generating AI summary...');
        const summary = await generateSummary();
        
        // Copy to clipboard
        await navigator.clipboard.writeText(summary);
        toast.success('Summary copied to clipboard!');
        
        // Show summary in modal
        alert(`AI Summary:\n\n${summary}\n\n(Copied to clipboard)`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Handler for mode selection from hub
  const handleModeSelectFromHub = (mode: WarRoomMode) => {
    setWarRoomMode(mode);
    setCurrentRoom('war-room');
    setShowWarRoomHub(false);
  };

  // Handler for mission selection from hub
  const handleMissionSelectFromHub = (mission: MissionType) => {
    setCurrentMission(mission);
    setCurrentRoom('missions');
    setShowWarRoomHub(false);
  };

  // Handler to go back to hub
  const handleBackToHub = () => {
    setShowWarRoomHub(true);
  };

  // Render mode-specific interface
  const renderModeContent = () => {
    // Show War Room Hub landing page
    if (showWarRoomHub) {
      return (
        <Suspense fallback={<LoadingFallback message="Loading War Room Hub..." />}>
          <WarRoomHub
            onModeSelect={handleModeSelectFromHub}
            onMissionSelect={handleMissionSelectFromHub}
            onRoomChange={setCurrentRoom}
            currentMode={warRoomMode}
            currentMission={currentMission}
            currentRoom={currentRoom}
            recentSessions={sessions.slice(0, 5).map(s => ({
              id: s.id,
              title: s.title,
              mode: warRoomMode,
              timestamp: new Date(s.created_at || Date.now())
            }))}
            onSessionSelect={(sessionId) => {
              setSelectedSessionId(sessionId);
              setShowWarRoomHub(false);
            }}
          />
        </Suspense>
      );
    }

    // Get messages for current mission/mode
    const missionSpecificMessages = getMissionMessages();

    const commonProps = {
      messages: missionSpecificMessages,
      isLoading,
      thinkingLogs,
      onSendMessage: (text: string) => {
        // Directly send message without relying on input state
        sendMessageDirect(text);
      },
      onNewSession: () => {
        clearMissionMessages();
        toast.success('Started new session! Previous conversation saved.');
      }
    };

    const sessionTitle = sessions.find(s => s.id === selectedSessionId)?.title || 'Session';
    const docSummaries = documents.map(d => ({ title: d.title, summary: d.ai_summary }));

    // Render Floating Mode Dock for in-session switching
    const renderWithDock = (content: React.ReactNode) => (
      <>
        {content}
        <Suspense fallback={null}>
          <FloatingModeDock
            currentMode={warRoomMode}
            currentMission={currentMission}
            currentRoom={currentRoom}
            onModeChange={(mode) => {
              setWarRoomMode(mode);
              setCurrentRoom('war-room');
            }}
            onMissionChange={(mission) => {
              setCurrentMission(mission);
              setCurrentRoom('missions');
            }}
            onRoomChange={setCurrentRoom}
            onBackToHub={handleBackToHub}
          />
        </Suspense>
      </>
    );

    // Handle Missions Room
    if (currentRoom === 'missions') {
      switch (currentMission) {
        case 'research':
          return renderWithDock(
            <ResearchMission
              {...commonProps}
              sessionId={selectedSessionId || ''}
              sessionTitle={sessionTitle}
              documents={docSummaries}
            />
          );
        case 'decision':
          return renderWithDock(
            <DecisionMission
              {...commonProps}
              sessionId={selectedSessionId || ''}
              sessionTitle={sessionTitle}
              documents={docSummaries}
            />
          );
        case 'brainstorm':
          return renderWithDock(
            <BrainstormMission
              {...commonProps}
              sessionId={selectedSessionId || ''}
              sessionTitle={sessionTitle}
              documents={docSummaries}
            />
          );
        case 'plan':
          return renderWithDock(
            <PlanMission
              {...commonProps}
              sessionId={selectedSessionId || ''}
              sessionTitle={sessionTitle}
              documents={docSummaries}
            />
          );
        case 'analyze':
          return renderWithDock(
            <AnalyzeMission
              {...commonProps}
              sessionId={selectedSessionId || ''}
              sessionTitle={sessionTitle}
              documents={docSummaries}
            />
          );
        case 'create':
          return renderWithDock(
            <CreateMission
              {...commonProps}
              sessionId={selectedSessionId || ''}
              sessionTitle={sessionTitle}
              documents={docSummaries}
            />
          );
        default:
          return renderWithDock(
            <div className="h-full flex items-center justify-center war-room-text-secondary">
              <div className="text-center">
                <i className="fa fa-book-open text-4xl mb-4 opacity-30"></i>
                <p>Mission type coming soon</p>
              </div>
            </div>
          );
      }
    }

    // Handle War Room modes
    switch (warRoomMode) {
      case 'tactical':
        return renderWithDock(
          <Suspense fallback={<LoadingFallback message="Loading Tactical Console..." />}>
            <WarRoomRedesigned
              messages={missionSpecificMessages}
              isLoading={isLoading}
              thinkingLogs={thinkingLogs}
              documents={documents}
              onSendMessage={(text: string) => sendMessageDirect(text)}
              onGenerateAudio={() => toast.success('Audio generation coming soon!')}
              onExport={() => {
                const content = missionSpecificMessages.map(m => `[${m.role}]: ${m.content}`).join('\n\n');
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `war-room-session-${new Date().toISOString().split('T')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Session exported!');
              }}
              currentMode={warRoomMode}
              sessionName={sessionTitle}
              onModeChange={(mode) => setWarRoomMode(mode as WarRoomMode)}
            />
          </Suspense>
        );

      case 'focus':
        return renderWithDock(
          <Suspense fallback={<LoadingFallback message="Loading Focus Mode..." />}>
            <FocusModeRedesigned
              {...commonProps}
              sessionId={selectedSessionId || ''}
              sessionTitle={sessionTitle}
              documents={docSummaries}
              isSpeaking={isSpeaking}
              voiceEnabled={voiceEnabled}
              voiceMode={voiceMode}
              onToggleVoiceEnabled={setVoiceEnabled}
              onChangeVoiceMode={setVoiceMode}
              onListeningChange={(v) => setVisualizerType(v ? 'listening' : 'idle')}
            />
          </Suspense>
        );

      case 'elegant-interface':
        return renderWithDock(
          <ConversationModeRedesigned
            {...commonProps}
            isSpeaking={isSpeaking}
            voiceEnabled={voiceEnabled}
            voiceMode={voiceMode}
            onToggleVoiceEnabled={setVoiceEnabled}
            onChangeVoiceMode={setVoiceMode}
            onListeningChange={(v) => setVisualizerType(v ? 'listening' : 'idle')}
          />
        );

      case 'analyst':
        return renderWithDock(
          <DataAnalystModeRedesigned
            {...commonProps}
            sessionId={selectedSessionId || ''}
            sessionTitle={sessionTitle}
            documents={docSummaries}
            currentMode={warRoomMode}
            currentMission={currentMission}
            currentRoom={currentRoom}
            onModeChange={setWarRoomMode}
            onMissionChange={setCurrentMission}
            onRoomChange={setCurrentRoom}
          />
        );

      case 'strategist':
        return renderWithDock(
          <StrategistModeRedesigned
            {...commonProps}
            sessionId={selectedSessionId || ''}
            sessionTitle={sessionTitle}
            documents={docSummaries}
          />
        );

      case 'brainstorm':
        return renderWithDock(
          <BrainstormModeRedesigned
            {...commonProps}
            sessionId={selectedSessionId || ''}
            sessionTitle={sessionTitle}
            documents={docSummaries}
          />
        );

      case 'debrief':
        return renderWithDock(
          <DebriefModeRedesigned
            {...commonProps}
            sessionId={selectedSessionId || ''}
            sessionTitle={sessionTitle}
            documents={docSummaries}
          />
        );

      default:
        return renderWithDock(<div>Unknown mode</div>);
    }
  };

  // Close mobile menu and agent dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close mobile menu
      if (showMobileMenu && !target.closest('.mobile-menu-container')) {
        setShowMobileMenu(false);
      }
      // Close agent dropdown
      const agentDropdown = document.getElementById('agent-dropdown');
      if (agentDropdown && !agentDropdown.classList.contains('hidden') && !target.closest('#agent-dropdown') && !target.closest('[data-agent-trigger]')) {
        agentDropdown.classList.add('hidden');
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMobileMenu]);

  // Map projects and sessions to sidebar format (memoized to prevent flickering)
  const sidebarProjects: WarRoomProject[] = useMemo(() => projects.map(p => ({
    id: p.id,
    name: p.name,
    icon: p.icon || 'fa-rocket',
    color: p.color || '#f43f5e',
    created_at: p.created_at,
  })), [projects]);

  const sidebarSessions: WarRoomSession[] = useMemo(() => sessions.map(s => ({
    id: s.id,
    title: s.title,
    project_id: s.project_id,
    created_at: s.created_at,
  })), [sessions]);

  // Memoized callbacks for sidebar to prevent re-renders
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const handleSidebarSelectSession = useCallback((id: string) => {
    setSelectedSessionId(id);
    if (isMobile) setIsSidebarOpen(false);
  }, [isMobile]);

  // Get messages for a session (for export)
  const getSessionMessagesForExport = useCallback((sessionId: string): SidebarAIMessage[] => {
    // If it's the current session, return current messages
    if (sessionId === selectedSessionId) {
      return messages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        created_at: m.created_at,
      }));
    }
    // Otherwise, try to load from localStorage or return empty
    return [];
  }, [selectedSessionId, messages]);

  // Handle export for a war room (all sessions)
  const handleExportWarRoom = useCallback(async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const projectSessions = sessions.filter(s => s.project_id === projectId);

    // Generate comprehensive markdown for the entire war room
    let markdown = `# War Room: ${project.name}\n\n`;
    markdown += `**Created:** ${new Date(project.created_at || Date.now()).toLocaleDateString()}\n\n`;
    markdown += `---\n\n`;
    markdown += `## Sessions (${projectSessions.length})\n\n`;

    for (const session of projectSessions) {
      markdown += `### ${session.title}\n\n`;
      const sessionMessages = getSessionMessagesForExport(session.id);
      if (sessionMessages.length > 0) {
        for (const msg of sessionMessages) {
          markdown += `**${msg.role === 'user' ? 'You' : 'AI'}:**\n${msg.content}\n\n`;
        }
      } else {
        markdown += `*No messages in this session*\n\n`;
      }
      markdown += `---\n\n`;
    }

    // Download the file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `war-room-${project.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Exported War Room: ${project.name}`);
  }, [projects, sessions, getSessionMessagesForExport]);

  // Handle export for a single session
  const handleExportSingleSession = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const sessionMessages = getSessionMessagesForExport(sessionId);
    const project = session.project_id ? projects.find(p => p.id === session.project_id) : null;

    let markdown = `# Session: ${session.title}\n\n`;
    if (project) {
      markdown += `**War Room:** ${project.name}\n`;
    }
    markdown += `**Created:** ${new Date(session.created_at || Date.now()).toLocaleDateString()}\n\n`;
    markdown += `---\n\n`;
    markdown += `## Conversation\n\n`;

    if (sessionMessages.length > 0) {
      for (const msg of sessionMessages) {
        markdown += `**${msg.role === 'user' ? 'You' : 'AI'}:**\n${msg.content}\n\n`;
      }
    } else {
      markdown += `*No messages in this session*\n\n`;
    }

    // Download the file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Exported Session: ${session.title}`);
  }, [sessions, projects, getSessionMessagesForExport]);

  // Handle creating a project from sidebar
  const handleSidebarCreateProject = useCallback((name: string) => {
    setNewProjectName(name);
    // Directly create the project
    const createProject = async () => {
      try {
        const newProject = await ragService.createProject({
          name,
          user_id: userId,
          icon: 'fa-rocket',
          color: '#f43f5e',
        });
        setProjects(prev => [...prev, newProject]);
        setSelectedProjectId(newProject.id);
        toast.success(`Created War Room: ${name}`);
      } catch (error) {
        console.error('Failed to create project:', error);
        toast.error('Failed to create War Room');
      }
    };
    createProject();
  }, [userId]);

  // Handle creating a session from sidebar
  const handleSidebarCreateSession = useCallback((title: string, projectId?: string) => {
    const createSession = async () => {
      try {
        const newSession = await ragService.createSession({
          title,
          user_id: userId,
          project_id: projectId || selectedProjectId || undefined,
        });
        setSessions(prev => [...prev, newSession]);
        setSelectedSessionId(newSession.id);
        setMessages([]);
        toast.success(`Created Session: ${title}`);
      } catch (error) {
        console.error('Failed to create session:', error);
        toast.error('Failed to create session');
      }
    };
    createSession();
  }, [userId, selectedProjectId]);

  return (
    <div className="war-room-container h-screen flex overflow-hidden relative">
      {/* New War Room Sidebar Component */}
      <WarRoomSidebar
        isOpen={isSidebarOpen}
        onToggle={handleSidebarToggle}
        projects={sidebarProjects}
        sessions={sidebarSessions}
        selectedProjectId={selectedProjectId}
        selectedSessionId={selectedSessionId}
        onSelectProject={setSelectedProjectId}
        onSelectSession={handleSidebarSelectSession}
        onCreateProject={handleSidebarCreateProject}
        onCreateSession={handleSidebarCreateSession}
        onDeleteProject={handleDeleteProject}
        onDeleteSession={handleDeleteSession}
        onExportWarRoom={handleExportWarRoom}
        onExportSession={handleExportSingleSession}
        getSessionMessages={getSessionMessagesForExport}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="war-room-header relative h-14 md:h-16 flex items-center justify-between px-2 md:px-4 shrink-0 z-30">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Back to Modes button - show when not on hub */}
            {!showWarRoomHub && (
              <button
                type="button"
                onClick={() => setShowWarRoomHub(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700
                  text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                title="Back to Mode Selection"
              >
                <i className="fa fa-th-large"></i>
                <span className="hidden sm:inline">Modes</span>
              </button>
            )}

            {/* War Room title when on hub */}
            {showWarRoomHub && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                  <i className="fa fa-book-open text-white text-sm"></i>
                </div>
                <span className="text-sm font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
                  War Room
                </span>
              </div>
            )}

            {/* Project badge - only show when in a mode */}
            {!showWarRoomHub && selectedProject && !isMobile && (
              <div className="war-room-badge flex items-center gap-2 px-3 py-1.5">
                <i className={`fa ${selectedProject.icon}`} style={{ color: selectedProject.color }}></i>
                <span className="text-sm font-medium">{selectedProject.name}</span>
              </div>
            )}

            {/* Session info - only show when in a mode */}
            {!showWarRoomHub && selectedSessionId && !isMobile && (
              <div className="text-sm flex items-center">
                <span className="war-room-text-secondary">Session:</span>
                <span className="ml-2 font-medium truncate max-w-[150px]">
                  {sessions.find(s => s.id === selectedSessionId)?.title}
                </span>
              </div>
            )}
          </div>

          {/* CENTER: Context Button - Prominent Position */}
          <button
            onClick={() => setIsContextPanelExpanded(!isContextPanelExpanded)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all font-medium text-sm ${
              isContextPanelExpanded
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30'
                : activeContextDocs.size > 0
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
            }`}
          >
            <i className={`fa fa-book-open ${isContextPanelExpanded ? 'animate-pulse' : ''}`}></i>
            <span className="hidden sm:inline">Context</span>
            {activeContextDocs.size > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isContextPanelExpanded ? 'bg-white/20' : 'bg-emerald-500/30'}`}>
                {activeContextDocs.size}
              </span>
            )}
            <i className={`fa fa-chevron-${isContextPanelExpanded ? 'up' : 'down'} text-xs transition-transform`}></i>
          </button>

          {/* Desktop Controls - Simplified */}
          <div className="hidden lg:flex items-center gap-2">
            {/* Mode Switcher */}
            <ModeSwitcher
              currentMode={warRoomMode}
              currentMission={currentMission}
              currentRoom={currentRoom}
              onChange={setWarRoomMode}
              onMissionChange={setCurrentMission}
              onRoomChange={setCurrentRoom}
            />

            {/* Voice Agent Button - OpenAI Realtime */}
            <button
              onClick={() => setShowVoiceAgentPanel(true)}
              className={`px-3 py-1.5 rounded-full text-sm transition-all flex items-center gap-2 font-medium ${
                showVoiceAgentPanel
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:shadow-lg hover:shadow-rose-500/20'
              }`}
              title="Open Voice Agent (OpenAI Realtime)"
            >
              <i className={`fa fa-waveform-lines ${showVoiceAgentPanel ? 'animate-pulse' : ''}`}></i>
              <span className="hidden xl:inline">Voice Agent</span>
            </button>

            {/* Export Button - Only show when there are messages */}
            {messages.length > 0 && (
              <button
                onClick={() => setShowExportModal(true)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 transition-all flex items-center gap-2 font-medium"
              >
                <i className="fa fa-share-nodes"></i>
                <span className="hidden xl:inline">Export</span>
              </button>
            )}
          </div>

          {/* Mobile/Tablet Controls */}
          <div className="flex lg:hidden items-center gap-1">
            {/* Voice Agent Button - Mobile */}
            <button
              onClick={() => setShowVoiceAgentPanel(true)}
              className={`p-2 rounded-full text-sm transition-all ${
                showVoiceAgentPanel
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg'
                  : 'text-rose-400 hover:bg-rose-500/20'
              }`}
              title="Voice Agent"
            >
              <i className="fa fa-waveform-lines"></i>
            </button>

            {/* Quick action buttons on mobile */}
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2 rounded-full text-sm transition-all ${
                voiceEnabled
                  ? 'bg-rose-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <i className="fa fa-microphone"></i>
            </button>

            <button
              onClick={() => setEnableExtendedThinking(!enableExtendedThinking)}
              className={`p-2 rounded-full text-sm transition-all ${
                enableExtendedThinking
                  ? 'bg-rose-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <i className="fa fa-brain"></i>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMobileMenu(!showMobileMenu);
              }}
              className="mobile-menu-container p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <i className="fa fa-ellipsis-v"></i>
            </button>
          </div>
        </div>

        {/* Context Panel - Overlay that respects sidebar */}
        {isContextPanelExpanded && (
          <div
            className="fixed top-0 right-0 bottom-0 z-[100] bg-zinc-900 overflow-y-auto animate-fadeIn"
            style={{ left: 'var(--sidebar-width, 18rem)' }}
          >
            <div className="w-full max-w-none min-h-full flex flex-col px-8 py-6">
              {/* Header with Close */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsContextPanelExpanded(false)}
                    className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                  >
                    <i className="fa fa-arrow-left"></i>
                  </button>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                    <i className="fa fa-book-open text-white text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Context & Sources</h2>
                    <p className="text-sm text-zinc-400">Add documents to enhance AI understanding</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl cursor-pointer transition-colors font-medium">
                    <i className="fa fa-plus"></i>
                    <span>Add Files</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".txt,.md,.json,.pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.bmp,.webp"
                    />
                  </label>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                  <div className="text-2xl font-bold text-white">{documents.length}</div>
                  <div className="text-xs text-zinc-400">Total Documents</div>
                </div>
                <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30">
                  <div className="text-2xl font-bold text-emerald-400">{activeContextDocs.size}</div>
                  <div className="text-xs text-emerald-400/70">Active in Context</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                  <div className="text-2xl font-bold text-white">{uploadProgress.size}</div>
                  <div className="text-xs text-zinc-400">Processing</div>
                </div>
                <button
                  onClick={() => setShowKnowledgeBank(true)}
                  className="bg-purple-500/10 hover:bg-purple-500/20 rounded-lg p-3 border border-purple-500/30 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2 text-purple-400 font-bold">
                    <i className="fa fa-book-open group-hover:scale-110 transition-transform"></i>
                    <span>Open</span>
                  </div>
                  <div className="text-xs text-purple-400/70">Knowledge Bank</div>
                </button>
              </div>

              {/* Document Search */}
              {documents.length > 0 && (
                <div className="mb-4">
                  <DocumentSearch
                    documents={documents}
                    activeContextIds={activeContextDocs}
                    onResultClick={(doc, highlightText, offset) => {
                      setViewingDoc(doc);
                      setViewerHighlightText(highlightText);
                      setViewerScrollOffset(offset);
                    }}
                  />
                </div>
              )}

              {/* Generate Tools Row */}
              {documents.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
                    <i className="fa fa-wand-magic-sparkles mr-1"></i>
                    Generate from Documents
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setShowStudyGuide(true); setIsContextPanelExpanded(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm transition-colors"
                    >
                      <i className="fa fa-book-open"></i>
                      Study Guide
                    </button>
                    <button
                      onClick={() => { setShowFAQ(true); setIsContextPanelExpanded(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm transition-colors"
                    >
                      <i className="fa fa-circle-question"></i>
                      FAQ
                    </button>
                    <button
                      onClick={() => { setShowTimeline(true); setIsContextPanelExpanded(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-400 text-sm transition-colors"
                    >
                      <i className="fa fa-timeline"></i>
                      Timeline
                    </button>
                    <button
                      onClick={() => { setShowPodcast(true); setIsContextPanelExpanded(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 rounded-lg text-pink-400 text-sm transition-colors"
                    >
                      <i className="fa fa-podcast"></i>
                      Audio
                    </button>
                    {documents.length >= 2 && (
                      <button
                        onClick={() => { setShowAdvancedAI(true); setIsContextPanelExpanded(false); }}
                        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 hover:from-blue-500/20 hover:via-purple-500/20 hover:to-pink-500/20 border border-purple-500/30 rounded-lg text-purple-400 text-sm transition-colors"
                      >
                        <i className="fa fa-brain"></i>
                        Advanced AI
                        <span className="text-[9px] px-1 py-0.5 bg-purple-500/30 rounded">NEW</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Active Documents Grid */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider flex items-center justify-between">
                  <span>
                    <i className="fa fa-folder-open mr-1"></i>
                    Documents ({documents.length})
                  </span>
                  {documents.length > 0 && (
                    <button
                      onClick={() => setShowKnowledgeBank(true)}
                      className="text-rose-400 hover:text-rose-300 normal-case font-medium"
                    >
                      View All <i className="fa fa-arrow-right ml-1"></i>
                    </button>
                  )}
                </p>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <i className="fa fa-file-import text-3xl mb-2 block"></i>
                    <p>No documents yet. Upload files to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-2">
                    {documents.slice(0, 6).map((doc) => {
                      const isInContext = activeContextDocs.has(doc.id);
                      return (
                        <div
                          key={doc.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                            isInContext
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
                          }`}
                        >
                          <button
                            onClick={() => toggleDocInContext(doc.id)}
                            className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${
                              isInContext
                                ? 'bg-emerald-500 text-white'
                                : 'bg-zinc-700 text-zinc-400 hover:bg-rose-500 hover:text-white'
                            }`}
                          >
                            <i className={`fa ${isInContext ? 'fa-check' : 'fa-plus'} text-xs`}></i>
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{doc.title}</p>
                            {doc.ai_keywords && doc.ai_keywords.length > 0 && (
                              <p className="text-[10px] text-zinc-500 truncate">
                                {doc.ai_keywords.slice(0, 2).join(', ')}
                              </p>
                            )}
                          </div>
                          {doc.processing_status === 'processing' && (
                            <i className="fa fa-spinner fa-spin text-yellow-400 text-xs"></i>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Spacer to push footer down */}
              <div className="flex-1"></div>

              {/* Done Button - Sticky Footer */}
              <div className="sticky bottom-0 mt-6 py-4 bg-zinc-900 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-500">
                    {activeContextDocs.size > 0 ? (
                      <span className="text-emerald-400">
                        <i className="fa fa-check-circle mr-2"></i>
                        {activeContextDocs.size} document{activeContextDocs.size > 1 ? 's' : ''} ready for AI context
                      </span>
                    ) : (
                      <span>
                        <i className="fa fa-info-circle mr-2"></i>
                        Click + on documents to add them to context
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsContextPanelExpanded(false)}
                    className="px-8 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl font-semibold text-lg hover:shadow-xl hover:shadow-rose-500/30 transition-all hover:scale-105"
                  >
                    <i className="fa fa-arrow-right mr-2"></i>
                    Return to Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && isMobile && (
          <div
            className="mobile-menu-container fixed top-16 right-2 z-[9990] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-rose-500/30 p-3 min-w-[220px] max-h-[calc(100vh-5rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              {/* Mode Switcher for Mobile */}
              <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Mode</span>
                <ModeSwitcher
                  currentMode={warRoomMode}
                  currentMission={currentMission}
                  currentRoom={currentRoom}
                  onChange={(mode) => { setWarRoomMode(mode); setShowMobileMenu(false); }}
                  onMissionChange={(mission) => { setCurrentMission(mission); setShowMobileMenu(false); }}
                  onRoomChange={setCurrentRoom}
                />
              </div>

              {/* Voice Controls */}
              <button
                onClick={() => { setVoiceSynthesisEnabled(!voiceSynthesisEnabled); setShowMobileMenu(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 ${
                  voiceSynthesisEnabled ? 'bg-rose-100 dark:bg-rose-600/20 text-rose-700 dark:text-rose-200' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <i className="fa fa-volume-up w-5"></i>
                Voice Output {voiceSynthesisEnabled ? 'On' : 'Off'}
              </button>

              {/* Agent Selector - War Room Style */}
              <div className="px-3 py-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Agent</span>
                <AgentSelector
                  activeAgent={activeAgent}
                  onAgentChange={(agent) => { setActiveAgent(agent); setShowMobileMenu(false); }}
                />
              </div>


              {/* Audio & Export */}
              {messages.length > 0 && (
                <>
                  <button
                    onClick={() => { handleGenerateAudioOverview(); setShowMobileMenu(false); }}
                    disabled={isGeneratingAudio}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                  >
                    <i className="fa fa-headphones w-5"></i>
                    {isGeneratingAudio ? 'Generating...' : 'Generate Audio'}
                  </button>

                  <button
                    onClick={() => { setShowExportModal(true); setShowMobileMenu(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    <i className="fa fa-share-nodes w-5"></i>
                    Export Session
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Mode-Based Content Rendering - Always show mode content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {renderModeContent()}
        </div>


        {/* Input Area - Only show when not using a mode that has its own input */}
        {selectedSessionId && !['tactical', 'focus', 'elegant-interface', 'analyst', 'strategist', 'brainstorm', 'debrief'].includes(warRoomMode) && (
          <div
            className="p-2 md:p-4 border-t border-rose-200 bg-white/90 dark:border-rose-500/40 dark:bg-[#1c1b23]/95 backdrop-blur-xl shrink-0 md:rounded-2xl shadow-[0_12px_48px_-28px_rgba(255,82,134,0.55)] transition-all duration-300 hover:shadow-[0_16px_60px_-28px_rgba(255,82,134,0.65)]"
          >
            {/* Active Document Indicators - hidden on mobile to save space */}
            {/* Active Context Panel - Above Input */}
            {showActiveContext && (
              <div className="mb-2 p-2 md:p-3 bg-gradient-to-r from-rose-900/20 to-pink-900/20 border border-rose-500/20 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <i className="fa fa-layer-group text-rose-400 text-sm"></i>
                    <span className="text-xs md:text-sm font-semibold text-rose-300">
                      ACTIVE CONTEXT
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-rose-900/40 border border-rose-500/30 rounded-full text-rose-300">
                      {activeContextDocs.size} / {documents.filter(d => d.processing_status === 'completed').length}
                    </span>
                    {!isMobile && (
                      <span className="text-[10px] text-rose-400/70">
                        ~{Math.round(estimateContextTokens())} tokens
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {documents.filter(d => d.processing_status === 'completed').length > 0 && (
                      <>
                        {activeContextDocs.size > 0 && (
                          <button
                            onClick={clearActiveContext}
                            className="text-[10px] md:text-xs px-2 py-0.5 hover:bg-red-900/20 rounded text-red-400 transition-colors"
                            title="Clear all"
                          >
                            <i className="fa fa-times mr-1"></i>
                            {!isMobile && 'Clear'}
                          </button>
                        )}
                        {activeContextDocs.size < documents.filter(d => d.processing_status === 'completed').length && (
                          <button
                            onClick={addAllDocsToContext}
                            className="text-[10px] md:text-xs px-2 py-0.5 hover:bg-rose-900/20 rounded text-rose-300 transition-colors"
                            title="Add all documents"
                          >
                            <i className="fa fa-plus mr-1"></i>
                            {!isMobile && 'Add All'}
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => setShowActiveContext(false)}
                      className="w-5 h-5 flex items-center justify-center hover:bg-rose-900/20 rounded text-rose-400"
                      title="Hide context panel"
                    >
                      <i className="fa fa-chevron-up text-xs"></i>
                    </button>
                  </div>
                </div>
                
                {activeContextDocs.size === 0 ? (
                  <div className="text-center py-2">
                    <p className="text-xs text-rose-300/70 mb-1">
                      <i className="fa fa-info-circle mr-1"></i>
                      No documents in active context
                    </p>
                    {documents.length === 0 ? (
                      <p className="text-xs text-rose-300/50">
                        Upload documents in sidebar to get started →
                      </p>
                    ) : (
                      <p className="text-xs text-rose-300/50">
                        Click checkboxes in sidebar to add documents ✓
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {activeContextDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-1 px-2 py-1 bg-rose-900/30 border border-rose-500/30 rounded-full text-xs group hover:border-rose-400 transition-colors"
                      >
                        <i className="fa fa-file-alt text-rose-400 text-[10px]"></i>
                        <span className="text-rose-200 truncate max-w-[100px] md:max-w-[150px]">
                          {doc.title}
                        </span>
                        {!isMobile && doc.ai_keywords && doc.ai_keywords.length > 0 && (
                          <span className="text-[10px] text-rose-300/70">
                            ({doc.ai_keywords.length} topics)
                          </span>
                        )}
                        <button
                          onClick={() => toggleDocInContext(doc.id)}
                          className="w-4 h-4 flex items-center justify-center hover:bg-red-900/50 rounded-full opacity-70 group-hover:opacity-100 transition-opacity"
                          title="Remove from context"
                        >
                          <i className="fa fa-times text-red-400 text-[10px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Show context panel toggle when hidden */}
            {!showActiveContext && (
              <div className="mb-2 px-3 py-1 bg-rose-900/10 border border-rose-500/20 rounded-lg flex items-center justify-between cursor-pointer hover:bg-rose-900/20 transition-colors" onClick={() => setShowActiveContext(true)}>
                <span className="text-xs text-rose-300">
                  <i className="fa fa-layer-group mr-1"></i>
                  {activeContextDocs.size} document{activeContextDocs.size !== 1 ? 's' : ''} in context
                </span>
                <button
                  className="text-xs px-2 py-0.5 hover:bg-rose-900/20 rounded text-rose-300"
                >
                  <i className="fa fa-chevron-down mr-1"></i>
                  Show
                </button>
              </div>
            )}

            {/* Voice Control */}
            {voiceEnabled && (
              <div className="mb-2 md:mb-3">
                <ErrorBoundary 
                  componentName="Voice Control"
                  fallback={
                    <div className="text-center py-2 text-amber-500 text-sm">
                      <i className="fa fa-microphone-slash mr-2"></i>
                      Voice input unavailable
                    </div>
                  }
                >
                  <Suspense fallback={<div className="h-10 animate-pulse bg-gray-700/50 rounded-lg"></div>}>
                    <VoiceControl
                      enabled={voiceEnabled}
                      mode={voiceMode}
                      wakeWord="hey pulse"
                      onTranscript={(text, isFinal) => {
                        if (isFinal) {
                          setInput(text);
                          handleSendMessage();
                        } else {
                          setInput(text);
                        }
                      }}
                      onCommand={(cmd) => {
                        if (cmd === 'show_thinking') {
                          setShowThinkingLogs(true);
                        } else if (cmd === 'hide_thinking') {
                          setShowThinkingLogs(false);
                        } else if (cmd.startsWith('switch_mode:')) {
                          const mode = cmd.split(':')[1] as WarRoomMode;
                          setWarRoomMode(mode);
                          toast.success(`Switched to ${mode}!`);
                        }
                      }}
                      onListeningChange={(isListening) => {
                        setVisualizerType(isListening ? 'listening' : 'idle');
                      }}
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}

            {/* Enhanced Input Area - Cursor-style with agent selector */}
            <div className="flex flex-col gap-2">
              {/* Quick Actions Row */}
              <div className="flex items-center justify-between px-1">
                {/* Left side: Agent selector + actions */}
                <div className="flex items-center gap-2">
                  {/* Agent/Persona Selector - Cursor-style dropdown */}
                  <div className="relative group">
                    <button
                      data-agent-trigger
                      onClick={() => {
                        const dropdown = document.getElementById('agent-dropdown');
                        dropdown?.classList.toggle('hidden');
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 transition-all"
                    >
                      <i className={`fa ${activeAgent === 'pulse' ? 'fa-robot' : activeAgent === 'analyst' ? 'fa-chart-line' : activeAgent === 'creative' ? 'fa-palette' : activeAgent === 'coder' ? 'fa-code' : 'fa-brain'} text-rose-500`}></i>
                      <span className="hidden sm:inline capitalize">{activeAgent}</span>
                      <i className="fa fa-chevron-down text-[10px] opacity-60"></i>
                    </button>
                    <div
                      id="agent-dropdown"
                      className="hidden absolute bottom-full left-0 mb-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl z-50 py-1"
                    >
                      {['pulse', 'analyst', 'creative', 'coder', 'researcher'].map((agent) => (
                        <button
                          key={agent}
                          onClick={() => {
                            setActiveAgent(agent as any);
                            document.getElementById('agent-dropdown')?.classList.add('hidden');
                          }}
                          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${activeAgent === agent ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                          <i className={`fa ${agent === 'pulse' ? 'fa-robot' : agent === 'analyst' ? 'fa-chart-line' : agent === 'creative' ? 'fa-palette' : agent === 'coder' ? 'fa-code' : 'fa-brain'} w-4`}></i>
                          <span className="capitalize">{agent}</span>
                          {activeAgent === agent && <i className="fa fa-check ml-auto text-xs"></i>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 hidden sm:block"></div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-1">
                    {/* Upload File */}
                    <button
                      onClick={() => {
                        const fileInput = document.querySelector('input[type="file"][accept=".txt,.md,.json,.csv,.pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp"]') as HTMLInputElement;
                        fileInput?.click();
                      }}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-rose-500 transition-all"
                      title="Upload file"
                    >
                      <i className="fa fa-paperclip text-sm"></i>
                    </button>

                    {/* Voice Input Toggle */}
                    <button
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      className={`p-1.5 rounded-lg transition-all ${voiceEnabled ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-rose-500'}`}
                      title={voiceEnabled ? 'Disable voice input' : 'Enable voice input'}
                    >
                      <i className={`fa ${voiceEnabled ? 'fa-microphone' : 'fa-microphone-slash'} text-sm`}></i>
                    </button>

                    {/* Deep Think Toggle */}
                    <button
                      onClick={() => setEnableExtendedThinking(!enableExtendedThinking)}
                      className={`p-1.5 rounded-lg transition-all ${enableExtendedThinking ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-purple-500'}`}
                      title={enableExtendedThinking ? 'Deep thinking enabled' : 'Enable deep thinking'}
                    >
                      <i className="fa fa-brain text-sm"></i>
                    </button>
                  </div>
                </div>

                {/* Right side: Context info */}
                <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                  {/* Context Window Indicator */}
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md" title="Estimated context usage">
                    <i className="fa fa-layer-group text-rose-400"></i>
                    <span>~{Math.round(estimateContextTokens()).toLocaleString()}</span>
                    <span className="text-gray-400">/</span>
                    <span>200K</span>
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden ml-1">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all"
                        style={{ width: `${Math.min((estimateContextTokens() / 200000) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Active docs count - mobile */}
                  <div className="sm:hidden flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                    <i className="fa fa-file-alt text-rose-400"></i>
                    <span>{activeContextDocs.size}</span>
                  </div>
                </div>
              </div>

              {/* Main Input Row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder={isMobile ? 'Ask anything...' : (documents.length > 0 ? 'Ask about your documents...' : 'Ask anything...')}
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-rose-500/30 rounded-full focus:border-rose-500 focus:outline-none text-gray-900 dark:text-white shadow-sm text-sm md:text-base"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !input.trim()}
                  className="px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 rounded-full font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
                >
                  <i className="fa fa-paper-plane"></i>
                </button>
              </div>

              {/* Suggested Prompts - Below Input */}
              {suggestions.length > 0 && showSuggestions && (
                <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                    <i className="fa fa-magic mr-1"></i>
                    Try:
                  </span>
                  {suggestions.slice(0, 3).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleUseSuggestion(s)}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-xs whitespace-nowrap text-gray-600 dark:text-gray-300 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                    >
                      {s.suggestion_text.length > 60 ? s.suggestion_text.substring(0, 60) + '...' : s.suggestion_text}
                    </button>
                  ))}
                  {suggestions.length > 3 && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">+{suggestions.length - 3} more</span>
                  )}
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
                    title="Hide suggestions"
                  >
                    <i className="fa fa-times text-[10px]"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio Player */}
        {audioUrl && (
          <div className="px-4 pb-4">
            <audio src={audioUrl} controls className="w-full" />
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-2xl war-room-modal rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">
                <i className="fa fa-share-nodes mr-2"></i>
                Export Session
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-800/50 rounded-full transition-colors text-gray-600 dark:text-gray-400"
              >
                <i className="fa fa-times text-xl"></i>
              </button>
            </div>

            <div className="space-y-3">
              {/* Markdown Export */}
              <button
                onClick={() => {
                  handleExport('markdown');
                  setShowExportModal(false);
                }}
                className="w-full p-4 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-600/20 dark:to-cyan-600/20 border border-blue-200 dark:border-blue-500/30 rounded-2xl hover:border-blue-400 text-left group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition text-blue-600 dark:text-white">
                    <i className="fa fa-file-text"></i>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-lg text-gray-900 dark:text-white">Export as Markdown</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Download full conversation as .md file</div>
                  </div>
                  <i className="fa fa-download text-blue-400"></i>
                </div>
              </button>

              {/* JSON Export */}
              <button
                onClick={() => {
                  handleExport('json');
                  setShowExportModal(false);
                }}
                className="w-full p-4 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-600/20 dark:to-pink-600/20 border border-purple-200 dark:border-purple-500/30 rounded-2xl hover:border-purple-400 text-left group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition text-purple-600 dark:text-white">
                    <i className="fa fa-code"></i>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-lg text-gray-900 dark:text-white">Export as JSON</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Structured data for integrations</div>
                  </div>
                  <i className="fa fa-download text-purple-400"></i>
                </div>
              </button>

              {/* AI Summary */}
              <button
                onClick={() => {
                  handleExport('summary');
                  setShowExportModal(false);
                }}
                className="w-full p-4 bg-gradient-to-br from-rose-50/50 to-pink-50/50 dark:from-rose-600/20 dark:to-pink-600/20 border border-rose-200 dark:border-rose-500/30 rounded-2xl hover:border-rose-400 text-left group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-rose-100 dark:bg-rose-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition text-rose-600 dark:text-white">
                    <i className="fa fa-sparkles"></i>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-lg text-gray-900 dark:text-white">Generate AI Summary</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Key points & action items (copies to clipboard)</div>
                  </div>
                  <i className="fa fa-clipboard text-rose-400"></i>
                </div>
              </button>

              {/* Share Options */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">Share to:</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const content = exportToMarkdown();
                      navigator.clipboard.writeText(content);
                      toast.success('Copied to clipboard! Paste in Messages app');
                      setShowExportModal(false);
                    }}
                    className="px-4 py-3 bg-green-50 dark:bg-green-600/20 border border-green-200 dark:border-green-500/30 rounded-xl hover:bg-green-100 dark:hover:bg-green-600/30 text-sm flex items-center justify-center text-gray-700 dark:text-white transition-colors"
                  >
                    <i className="fa fa-message mr-2 text-green-600 dark:text-green-400"></i>
                    Messages
                  </button>
                  
                  <button
                    onClick={() => {
                      const content = exportToMarkdown();
                      const mailtoLink = `mailto:?subject=War Room Session&body=${encodeURIComponent(content)}`;
                      window.location.href = mailtoLink;
                      setShowExportModal(false);
                    }}
                    className="px-4 py-3 bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-600/30 text-sm flex items-center justify-center text-gray-700 dark:text-white transition-colors"
                  >
                    <i className="fa fa-envelope mr-2 text-blue-600 dark:text-blue-400"></i>
                    Email
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OpenAI Realtime Voice Agent Panel */}
      {showVoiceAgentPanel && (
        <div className={`fixed z-50 ${
          voiceAgentExpanded
            ? 'inset-2 md:inset-4'
            : 'bottom-2 right-2 left-2 md:left-auto md:bottom-4 md:right-4 md:w-full md:max-w-md'
        }`}>
          <ErrorBoundary 
            componentName="Voice Agent"
            fallback={
              <div className="bg-gray-900/95 backdrop-blur-xl border border-red-500/30 rounded-xl p-6 text-center">
                <i className="fa fa-microphone-slash text-3xl text-red-500 mb-3"></i>
                <p className="text-white font-medium mb-2">Voice Agent Unavailable</p>
                <p className="text-gray-400 text-sm mb-4">
                  {isMobilePlatform 
                    ? 'Voice features may not be fully supported on this device.'
                    : 'The voice agent encountered an error.'}
                </p>
                <button
                  onClick={() => setShowVoiceAgentPanel(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                >
                  Close
                </button>
              </div>
            }
          >
            <Suspense fallback={<LoadingFallback message="Loading Voice Agent..." />}>
              <VoiceAgentPanel
                userId={userId}
                projectId={selectedProjectId || undefined}
                sessionId={selectedSessionId || undefined}
                openaiApiKey={openaiApiKey}
                onClose={() => setShowVoiceAgentPanel(false)}
                isExpanded={voiceAgentExpanded}
                onToggleExpand={() => setVoiceAgentExpanded(!voiceAgentExpanded)}
                documents={documents}
                activeContextIds={activeContextDocs}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <DocumentViewer
          doc={viewingDoc}
          onClose={() => {
            setViewingDoc(null);
            setViewerHighlightText(undefined);
            setViewerScrollOffset(undefined);
          }}
          highlightText={viewerHighlightText}
          scrollToOffset={viewerScrollOffset}
        />
      )}

      {/* Content Generator Modals */}
      {showStudyGuide && (
        <StudyGuideGenerator
          documents={documents}
          activeContextIds={activeContextDocs}
          apiKey={apiKey}
          onClose={() => setShowStudyGuide(false)}
        />
      )}

      {showFAQ && (
        <FAQGenerator
          documents={documents}
          activeContextIds={activeContextDocs}
          apiKey={apiKey}
          onClose={() => setShowFAQ(false)}
        />
      )}

      {showTimeline && (
        <TimelineGenerator
          documents={documents}
          activeContextIds={activeContextDocs}
          apiKey={apiKey}
          onClose={() => setShowTimeline(false)}
        />
      )}

      {showPodcast && (
        <PodcastGenerator
          documents={documents}
          activeContextIds={activeContextDocs}
          apiKey={apiKey}
          onClose={() => setShowPodcast(false)}
        />
      )}

      {/* Advanced AI Panel */}
      {showAdvancedAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-6xl h-[85vh]">
            <AdvancedAIPanel
              documents={documents.filter(d => activeContextDocs.has(d.id) || activeContextDocs.size === 0)}
              apiKey={apiKey}
              onClose={() => setShowAdvancedAI(false)}
            />
          </div>
        </div>
      )}

      {/* Organization Sidebar (Floating) */}
      {showOrganize && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/50"
            onClick={() => {
              setShowOrganize(false);
              setOrganizingDocId(undefined);
            }}
          />
          {/* Sidebar */}
          <OrganizationSidebar
            userId={userId}
            documents={documents.map(d => ({ id: d.id, title: d.title, file_type: d.file_type }))}
            selectedDocId={organizingDocId}
            onDocumentClick={(docId) => {
              const doc = documents.find(d => d.id === docId);
              if (doc && doc.text_content) {
                setViewingDoc(doc);
                setShowOrganize(false);
                setOrganizingDocId(undefined);
                recordDocumentView(userId, docId).catch(console.error);
              }
            }}
            onClose={() => {
              setShowOrganize(false);
              setOrganizingDocId(undefined);
            }}
          />
        </div>
      )}

      {/* Knowledge Bank Modal - Full Document Browser */}
      {showKnowledgeBank && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-700 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <i className="fa fa-book-open text-white"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Knowledge Bank</h2>
                  <p className="text-xs text-zinc-400">{documents.length} documents • {activeContextDocs.size} active</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg cursor-pointer transition-colors">
                  <i className="fa fa-plus"></i>
                  <span>Upload</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".txt,.md,.json,.pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.bmp,.webp"
                  />
                </label>
                <button
                  onClick={() => setShowKnowledgeBank(false)}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <i className="fa fa-times text-lg"></i>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-zinc-800 shrink-0">
              <DocumentSearch
                documents={documents}
                activeContextIds={activeContextDocs}
                onResultClick={(doc, highlightText, offset) => {
                  setViewingDoc(doc);
                  setViewerHighlightText(highlightText);
                  setViewerScrollOffset(offset);
                }}
              />
            </div>

            {/* Document Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {documents.length === 0 ? (
                <div className="text-center py-16 text-zinc-500">
                  <i className="fa fa-folder-open text-5xl mb-4 block"></i>
                  <h3 className="text-lg font-medium text-white mb-2">No Documents Yet</h3>
                  <p className="text-sm">Upload PDFs, Word docs, images, or text files to build your knowledge base.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => {
                    const isInContext = activeContextDocs.has(doc.id);
                    return (
                      <div
                        key={doc.id}
                        className={`rounded-xl border p-4 transition-all hover:shadow-lg ${
                          isInContext
                            ? 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10'
                            : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              doc.file_type === 'pdf' ? 'bg-red-500/20 text-red-400' :
                              doc.file_type === 'docx' ? 'bg-blue-500/20 text-blue-400' :
                              doc.file_type === 'xlsx' ? 'bg-green-500/20 text-green-400' :
                              doc.file_type?.startsWith('image') ? 'bg-purple-500/20 text-purple-400' :
                              'bg-zinc-700 text-zinc-400'
                            }`}>
                              <i className={`fa ${
                                doc.file_type === 'pdf' ? 'fa-file-pdf' :
                                doc.file_type === 'docx' ? 'fa-file-word' :
                                doc.file_type === 'xlsx' ? 'fa-file-excel' :
                                doc.file_type?.startsWith('image') ? 'fa-file-image' :
                                'fa-file-alt'
                              } text-sm`}></i>
                            </div>
                            <div>
                              <h4 className="font-medium text-white text-sm truncate max-w-[150px]">{doc.title}</h4>
                              <p className="text-[10px] text-zinc-500 uppercase">{doc.file_type || 'Document'}</p>
                            </div>
                          </div>
                          {doc.processing_status === 'processing' ? (
                            <i className="fa fa-spinner fa-spin text-yellow-400"></i>
                          ) : doc.processing_status === 'failed' ? (
                            <i className="fa fa-exclamation-triangle text-red-400"></i>
                          ) : (
                            <button
                              onClick={() => toggleDocInContext(doc.id)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                isInContext
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-zinc-700 text-zinc-400 hover:bg-rose-500 hover:text-white'
                              }`}
                            >
                              <i className={`fa ${isInContext ? 'fa-check' : 'fa-plus'}`}></i>
                            </button>
                          )}
                        </div>

                        {doc.ai_summary && (
                          <p className="text-xs text-zinc-400 line-clamp-2 mb-3">{doc.ai_summary}</p>
                        )}

                        {doc.ai_keywords && doc.ai_keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {doc.ai_keywords.slice(0, 4).map((keyword, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 bg-zinc-700/50 text-zinc-400 rounded-full">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2 border-t border-zinc-700/50">
                          <button
                            onClick={() => {
                              setViewingDoc(doc);
                              setViewerHighlightText(undefined);
                              setViewerScrollOffset(undefined);
                            }}
                            className="flex-1 text-xs py-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                          >
                            <i className="fa fa-eye mr-1"></i> View
                          </button>
                          <button
                            onClick={() => {
                              setOrganizingDocId(doc.id);
                              setShowOrganize(true);
                            }}
                            className="flex-1 text-xs py-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                          >
                            <i className="fa fa-tags mr-1"></i> Organize
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="text-xs py-1.5 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <i className="fa fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-700 flex items-center justify-between shrink-0">
              <div className="text-sm text-zinc-400">
                <i className="fa fa-info-circle mr-1"></i>
                Click <i className="fa fa-plus mx-1"></i> to add documents to context
              </div>
              <button
                onClick={() => setShowKnowledgeBank(false)}
                className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-rose-500/30 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && sharingDoc && (
        <ShareModal
          type="document"
          resourceId={sharingDoc.id}
          resourceTitle={sharingDoc.title}
          userId={userId}
          onClose={() => {
            setShowShareModal(false);
            setSharingDoc(null);
          }}
        />
      )}

    </div>
  );
};

// Wrap the entire component with error boundary for mobile safety
const LiveDashboardWithErrorBoundary: React.FC<LiveDashboardProps> = (props) => (
  <ErrorBoundary 
    componentName="War Room"
    onError={(error) => {
      console.error('[War Room] Critical error:', error);
      // On mobile, show a helpful message
      if (isMobilePlatform) {
        toast.error('War Room encountered an issue. Some features may be limited on mobile.');
      }
    }}
  >
    <LiveDashboard {...props} />
  </ErrorBoundary>
);

export default LiveDashboardWithErrorBoundary;
