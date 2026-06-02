import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { useWarRoomStore } from '../store/warRoomStore';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { settingsService } from '../services/settingsService';
import { Capacitor } from '@capacitor/core';
import { ragService, AISession, KnowledgeDoc, AIMessage, AIProject, PromptSuggestion, ThinkingStep, AICitation } from '../services/ragService';
import { processWithModel, generateSpeech } from '../services/geminiService';
import toast from 'react-hot-toast';
import './WarRoomStyles.css';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { WarRoomMode, MissionType, RoomType } from './WarRoom/warRoom.types';

// Phase 1 — War Room unified interface
import { StudioLayout } from './WarRoom/StudioLayout';
import { NotebookShell } from './WarRoom/notebook/NotebookShell';
import { ChatPane } from './WarRoom/notebook/ChatPane';
import { useFeature } from '../lib/featureFlags';
import { StudioHeader } from './WarRoom/StudioHeader';
import { PulseStudio } from './WarRoom/PulseStudio';
import { StudioOnboarding, hasCompletedOnboarding } from './WarRoom/StudioOnboarding';

// Document processing (used by file upload handler)
import { processDocument } from '../services/documentProcessors';
import { warRoomExportService, WarRoomExportData } from '../services/warRoomExportService';

// War Room sidebar, modals & services
import { WarRoomSidebar, WarRoomProject, WarRoomSession, AIMessage as SidebarAIMessage } from './WarRoom/WarRoomSidebar';
import { WarRoomModalStack } from './WarRoom/WarRoomModalStack';
import { useBoardNotes } from './WarRoom/useBoardNotes';
import { AgentType } from './WarRoom/AgentSelector';
import { warRoomRealtimeService } from '../services/warRoomRealtimeService';

// Import voice synthesis hook - this is lightweight
import { useVoiceSynthesis } from './WarRoom/VoiceSynthesis';

import { Activity, AlertTriangle, BookOpen, Brain, Check, ChevronDown, ChevronUp, Clipboard, Code, Database, Download, EllipsisVertical, Eye, FileText, FolderOpen, Headphones, Info, Layers, LayoutGrid, Loader2, Mail, MessageSquare, Mic, MicOff, Paperclip, Plus, Send, Share2, Sparkles, Tags, Trash2, Volume2, Wand2, X } from 'lucide-react';

// Check if we're on a mobile/native platform
const isMobilePlatform = Capacitor.isNativePlatform() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Loading fallback component
const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  const EnhancedLoadingScreen = lazy(() => import('./EnhancedLoadingScreen'));
  return (
    <Suspense fallback={
      <div className="h-full w-full flex items-center justify-center bg-gray-900/50">
        <div className="text-center">
          <Loader2 className="fa text-2xl text-rose-500 mb-2 animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <EnhancedLoadingScreen currentStageLabel={message} inline />
    </Suspense>
  );
};

interface LiveDashboardProps {
  /** @deprecated no-op — AI routing is server-side via edge functions. */
  apiKey?: string;
  userId: string;
}

const LiveDashboard: React.FC<LiveDashboardProps> = ({ apiKey = '', userId }) => {
  // ── Zustand store — all War Room state ───────────────────────────────────
  const {
    projects, setProjects,
    selectedProjectId, setSelectedProjectId,
    showCreateProject, setShowCreateProject,
    newProjectName, setNewProjectName,
    sessions, setSessions,
    selectedSessionId, setSelectedSessionId,
    messages, setMessages,
    input, setInput,
    isLoading, setIsLoading,
    missionMessages, setMissionMessages,
    isCreatingSession, setIsCreatingSession,
    newSessionTitle, setNewSessionTitle,
    activeAgent, setActiveAgent,
    documents, setDocuments,
    showDocUpload, setShowDocUpload,
    uploadingFiles, setUploadingFiles,
    uploadProgress, setUploadProgress,
    activeContextDocs, setActiveContextDocs,
    showActiveContext, setShowActiveContext,
    isDeletingDoc, setIsDeletingDoc,
    showStudyGuide, setShowStudyGuide,
    showFAQ, setShowFAQ,
    showTimeline, setShowTimeline,
    showPodcast, setShowPodcast,
    showOrganize, setShowOrganize,
    organizingDocId, setOrganizingDocId,
    showAdvancedAI, setShowAdvancedAI,
    contextPanelOpen, setContextPanelOpen,
    showKnowledgeBank, setShowKnowledgeBank,
    showShareModal, setShowShareModal,
    sharingDoc, setSharingDoc,
    viewingDoc, setViewingDoc,
    viewerHighlightText, setViewerHighlightText,
    viewerScrollOffset, setViewerScrollOffset,
    isSidebarOpen, setIsSidebarOpen,
    isMobile, setIsMobile,
    showMobileMenu, setShowMobileMenu,
    audioUrl, setAudioUrl,
    isGeneratingAudio, setIsGeneratingAudio,
    showExportModal, setShowExportModal,
    expandedRooms, setExpandedRooms,
    showSessionExport, setShowSessionExport,
    isExporting, setIsExporting,
    warRoomMode, setWarRoomMode,
    currentMission, setCurrentMission,
    currentRoom, setCurrentRoom,
    voiceEnabled, setVoiceEnabled,
    voiceMode, setVoiceMode,
    currentTokens, setCurrentTokens,
    isAIStreaming, setIsAIStreaming,
    audioData, setAudioData,
    visualizerType, setVisualizerType,
    voiceSynthesisEnabled, setVoiceSynthesisEnabled,
    voiceGender, setVoiceGender,
    showThinkingLogs, setShowThinkingLogs,
    thinkingLogs, setThinkingLogs,
    expandedThinking, setExpandedThinking,
    enableExtendedThinking, setEnableExtendedThinking,
    suggestions, setSuggestions,
    showSuggestions, setShowSuggestions,
    showVoiceAgentPanel, setShowVoiceAgentPanel,
    voiceAgentExpanded, setVoiceAgentExpanded,
    setPresence,
  } = useWarRoomStore();

  // ── Local refs & hooks (not in store) ────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Ephemeral OpenAI Realtime token fetched lazily from the openai-realtime-token
  // edge function. Platform-managed keys only — never reads env/localStorage.
  // Fetched on-demand when the Voice Agent panel is opened so we don't pay the
  // round-trip cost on every dashboard mount.
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  // Workspace id is required by the openai-realtime-token edge function for
  // hosted-mode tier-gating (mirrors Summit). Without it the mint 400s with
  // NOT_MEMBER and voice never connects.
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? '';
  const [isResolvingOpenaiToken, setIsResolvingOpenaiToken] = useState<boolean>(false);

  useEffect(() => {
    // Only fetch when the voice agent panel is actually opened, and only once
    // the workspace is loaded (the edge function requires workspace_id).
    if (!showVoiceAgentPanel || openaiApiKey || isResolvingOpenaiToken || !workspaceId) return;

    let cancelled = false;
    const resolveToken = async () => {
      setIsResolvingOpenaiToken(true);
      try {
        const { supabase } = await import('../services/supabase');
        const { data, error } = await supabase.functions.invoke('openai-realtime-token', {
          body: { model: 'gpt-4o-realtime-preview', voice: 'alloy', workspace_id: workspaceId },
        });

        if (cancelled) return;

        if (error || !data?.token) {
          console.error('[LiveDashboard] Failed to fetch ephemeral OpenAI token:', error);
          toast.error('OpenAI Realtime unavailable. Please try again later.');
          setOpenaiApiKey('');
        } else {
          setOpenaiApiKey(data.token);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[LiveDashboard] Exception fetching ephemeral OpenAI token:', err);
          toast.error('OpenAI Realtime unavailable. Please try again later.');
          setOpenaiApiKey('');
        }
      } finally {
        if (!cancelled) setIsResolvingOpenaiToken(false);
      }
    };

    resolveToken();
    return () => { cancelled = true; };
  }, [showVoiceAgentPanel, openaiApiKey, isResolvingOpenaiToken, workspaceId]);

  const [showOnboarding, setShowOnboarding] = useState(() => !hasCompletedOnboarding());

  // Mobile detection helper (kept local for resize handler)
  const checkIsMobile = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isSmallScreen = Math.min(width, height) <= 768;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return isSmallScreen || (isTouchDevice && width <= 1024);
  };

  // Voice Synthesis Hook
  const { speak, isSpeaking } = useVoiceSynthesis(voiceSynthesisEnabled, voiceGender);

  // The Board — persistent notes across all modes
  const { notes: boardNotes, addNote: addBoardNote, deleteNote: deleteBoardNote, clearNotes: clearBoardNotes } = useBoardNotes();

  // Load persisted agent selection
  useEffect(() => {
    settingsService.get('liveBoardSelectedAgent').then((agent) => {
      if (agent && ['general', 'skeptic', 'scribe', 'deep-diver'].includes(agent)) {
        setActiveAgent(agent as 'general' | 'skeptic' | 'scribe' | 'deep-diver');
      }
    });
  }, []);

  // Load saved War Room default mode from settings
  useEffect(() => {
    settingsService.get('warRoomDefaultMode').then((mode) => {
      if (mode) setWarRoomMode(mode as WarRoomMode);
    });
  }, []);

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

  // Real-time presence & message sync
  useEffect(() => {
    if (!selectedSessionId || !userId) return;

    warRoomRealtimeService.joinSession(
      selectedSessionId,
      {
        userId,
        displayName: userId,
        joinedAt: new Date().toISOString(),
      },
      {
        onPresenceSync: (users) => {
          setPresence(users);
        },
        onNewMessage: (msg) => {
          // Dedup: only append if not already in messages
          const current = useWarRoomStore.getState().messages;
          if (!current.some((m) => m.id === msg.id)) {
            useWarRoomStore.getState().setMessages([...current, msg]);
          }
        },
      }
    );

    // Subscribe to collaborative artifact events
    warRoomRealtimeService.onArtifactEvent((event, payload) => {
      if (payload.userId === userId) return; // ignore own events
      if (event === 'pin') {
        addBoardNote(payload.content, payload.type as any, {
          sourceDocTitle: `Shared by ${payload.userName || 'collaborator'}`,
        });
        toast(`Collaborator pinned an artifact`, { icon: '📌', duration: 2000 });
      }
    });

    return () => {
      warRoomRealtimeService.leaveSession();
      setPresence(new Map());
    };
  }, [selectedSessionId, userId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await ragService.getProjects(userId);
      if (Array.isArray(data)) setProjects(data);
    } catch (e) {
      console.error("Failed to load projects", e);
    }
  }, [userId]);

  const loadSessions = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await ragService.getSessions(userId, selectedProjectId || undefined);
      if (Array.isArray(data)) setSessions(data);
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  }, [userId, selectedProjectId]);

  const loadDocuments = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await ragService.getDocuments(userId, selectedProjectId || undefined);
      if (Array.isArray(data)) {
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
      if (Array.isArray(data)) setMessages(data);
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  };

  const loadSuggestions = async () => {
    if (!selectedSessionId) return;
    try {
      const { data } = await ragService.getSuggestions(selectedSessionId);
      if (Array.isArray(data)) setSuggestions(data);
    } catch (e) {
      console.error("Failed to load suggestions", e);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    
    try {
      console.log('[War Room] Creating project:', newProjectName);
      const { data, error } = await ragService.createProject(userId, newProjectName);
      
      if (error) {
        console.error('[War Room] Project creation error:', error);
        toast.error(`Failed to create project: ${error.message || 'Unknown error'}`);
        return;
      }
      
      if (data) {
        console.log('[War Room] Project created successfully:', data);
        toast.success('Project created!');
        setProjects([data, ...projects]);
        setSelectedProjectId(data.id);
        setNewProjectName('');
        setShowCreateProject(false);
      } else {
        console.error('[War Room] No data returned from createProject');
        toast.error('Failed to create project: No data returned');
      }
    } catch (e) {
      console.error('[War Room] Project creation exception:', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Failed to create project: ${errorMessage}`);
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

  // Ensure a session exists before chatting. War Room is usable immediately —
  // the composer is always visible and the first send (or example prompt)
  // lazily creates a session under the active project, instead of dead-ending
  // when none is selected. Returns the session id to use for THIS send (state
  // updates are async, so callers must use the returned id, not selectedSessionId).
  const ensureSession = async (): Promise<string | null> => {
    if (selectedSessionId) return selectedSessionId;
    try {
      const { data, error } = await ragService.createSession(
        userId,
        'War Room Chat',
        undefined,
        selectedProjectId || undefined,
      );
      if (error || !data) {
        console.error('[War Room] ensureSession failed:', error);
        toast.error('Could not start a session');
        return null;
      }
      setSessions(prev => [data, ...prev]);
      setSelectedSessionId(data.id);
      return data.id;
    } catch (e) {
      console.error('[War Room] ensureSession exception:', e);
      toast.error('Could not start a session');
      return null;
    }
  };

  // Direct send message function that accepts message as parameter
  const sendMessageDirect = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    const sessionId = await ensureSession();
    if (!sessionId) return;

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
      const { data: userMsg } = await ragService.addMessage(sessionId, userId, 'user', userMessage);
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
      // Rich citation records for the message (Sources-Used panel + inline
      // chips). Parallel to `citations` (titles), which the prompt text still
      // uses. WI-5, repair plan 2026-06-02.
      const citationSources: AICitation[] = [];

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
            citationSources.push({
              title: d.doc_title,
              source: d.doc_url || undefined,
              excerpt: d.content,
              similarity: d.similarity,
            });
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
          toast.success(scopeMsg);

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
          toast(noResultsMsg);

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
      const structuredOutputGuidance =
        '\n\nFORMATTING GUIDELINES: When appropriate, structure your response using markdown sections with ## headings. ' +
        'For comparisons use ## Pros / ## Cons sections. For tasks use ## Action Items with bullet lists. ' +
        'For data comparisons use markdown tables. For brainstorming use ## Ideas with bullet lists. ' +
        'For project phases use ## Timeline with labeled bullet points (Phase: description). ' +
        'For summaries use ## Key Points or ## Summary with bullet lists. ' +
        'For risk analysis use ## Risks with bullet lists or tables. ' +
        'Always include a brief introductory paragraph before structured sections.';

      const agentPrompts: Record<string, string> = {
        general: 'You are a helpful AI assistant with access to a knowledge base.' + structuredOutputGuidance,
        skeptic: 'You are a critical thinker with access to a knowledge base. Question assumptions and challenge ideas constructively based on the provided sources.' + structuredOutputGuidance,
        scribe: 'You are a meticulous note-taker with access to a knowledge base. Organize information clearly with bullet points and structure, citing sources.' + structuredOutputGuidance,
        'deep-diver': 'You are an analytical researcher with access to a knowledge base. Provide comprehensive explanations with nuance, always citing your sources.' + structuredOutputGuidance
      };

      if (enableExtendedThinking) {
        thinkingSteps.push({
          step: 4,
          thought: `Formulating response as ${activeAgent} persona...`,
          duration_ms: Date.now() - stepStartTime
        });
        stepStartTime = Date.now();
      }

      // Intel Mode: strict source-grounding prompt overrides agent persona
      const intelSystemPrompt =
        `You are an intelligence analyst in Intel Mode. ` +
        `Answer ONLY from the provided source documents. ` +
        `Every factual claim MUST include an inline citation using bracket notation, e.g. [1] or [2][3]. ` +
        `End your response with a References section in exactly this format:\n` +
        `References:\n[1] Document Title - "relevant passage"\n[2] Document Title - "relevant passage"\n` +
        `If the information is not present in the provided sources, respond with: ` +
        `"This information is not available in the current intel."`;

      const systemPrompt = warRoomMode === 'intel'
        ? intelSystemPrompt
        : (agentPrompts[activeAgent] || agentPrompts.general);

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

      const response = await processWithModel(fullPrompt);

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
        sessionId,
        null,
        'assistant',
        response || 'I encountered an issue processing your request.',
        citationSources
      );

      if (aiMsg) {
        // Update mission-specific messages
        const latestMessages = getMissionMessages();
        setMissionMessagesForCurrent([...latestMessages, aiMsg]);
        // Also update global messages for backward compatibility
        setMessages(prev => [...prev, aiMsg]);

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

  // Wrapper that uses input state (for UI send button). Session is ensured
  // inside sendMessageDirect, so no session gate here.
  const handleSendMessage = async () => {
    if (!input.trim()) return;
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

        toast.success(`${file.name}${metaInfo} indexed with AI summary!`, {
          duration: 3000,
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
        `Provide a brief 30-second audio summary of this conversation:\n\n${conversationSummary}`
      );

      if (summaryText) {
        const audio = await generateSpeech(summaryText);
        if (audio) {
          const blob = new Blob([audio], { type: 'audio/mp3' });
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          toast.success('Audio overview ready!');
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
      toast.success('Project deleted');
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
        a.download = `studio-${selectedSessionId?.slice(0, 8)}-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported as Markdown!');
      } else if (format === 'json') {
        const content = JSON.stringify(exportToJSON(), null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studio-${selectedSessionId?.slice(0, 8)}-${Date.now()}.json`;
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

  const selectedProject = Array.isArray(projects) ? projects.find(p => p.id === selectedProjectId) : undefined;

  // Note: War Room hub / mode selection removed in Phase 1 (War Room redesign).
  // The unified PulseStudio component replaces all 7 modes.

  // War Room "Notebook" redesign (Path A) — flag-gated. ON renders NotebookShell,
  // OFF renders the legacy StudioLayout. Both wrap the same props/children.
  // Declared BEFORE artifactsPanelOpen — its initializer reads this flag.
  const useNotebookShell = useFeature('warRoomNotebook', userId);
  const StudioShell = useNotebookShell ? NotebookShell : StudioLayout;
  const ChatComponent = useNotebookShell ? ChatPane : PulseStudio;

  // Artifacts/Studio panel state (controlled from here, passed to the shell).
  // The Notebook's Studio column is open by default on desktop so the generator
  // rail is visible (matches the mockup); legacy StudioLayout stays closed.
  const [artifactsPanelOpen, setArtifactsPanelOpen] = useState(
    () => useNotebookShell && typeof window !== 'undefined' && window.innerWidth >= 1160,
  );

  // File upload trigger for PulseStudio
  const handleUploadClick = () => {
    const fileInput = document.querySelector('input[type="file"][accept]') as HTMLInputElement;
    fileInput?.click();
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
  const sidebarProjects: WarRoomProject[] = useMemo(() => (Array.isArray(projects) ? projects : []).map(p => ({
    id: p.id,
    name: p.name,
    icon: p.icon || 'fa-rocket',
    color: p.color || '#f43f5e',
    created_at: p.created_at,
  })), [projects]);

  const sidebarSessions: WarRoomSession[] = useMemo(() => (Array.isArray(sessions) ? sessions : []).map(s => ({
    id: s.id,
    title: s.title,
    project_id: s.project_id,
    created_at: s.created_at,
  })), [sessions]);

  // Memoized callbacks for sidebar to prevent re-renders
  const handleSidebarToggle = useCallback(() => {
    const current = useWarRoomStore.getState().isSidebarOpen;
    setIsSidebarOpen(!current);
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
    let markdown = `# Project: ${project.name}\n\n`;
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
    a.download = `studio-${project.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Exported Project: ${project.name}`);
  }, [projects, sessions, getSessionMessagesForExport]);

  // Handle export for a single session
  const handleExportSingleSession = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const sessionMessages = getSessionMessagesForExport(sessionId);
    const project = session.project_id ? projects.find(p => p.id === session.project_id) : null;

    let markdown = `# Session: ${session.title}\n\n`;
    if (project) {
      markdown += `**Project:** ${project.name}\n`;
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

  // Handle creating a project from sidebar.
  // ragService.createProject(userId, name, description?, color?) → { data, error }.
  const handleSidebarCreateProject = useCallback((name: string) => {
    setNewProjectName(name);
    const createProject = async () => {
      try {
        const { data: newProject, error } = await ragService.createProject(userId, name, undefined, '#f43f5e');
        if (error || !newProject) {
          console.error('Failed to create project:', error);
          toast.error('Failed to create project');
          return;
        }
        setProjects(prev => [...prev, newProject]);
        setSelectedProjectId(newProject.id);
        toast.success(`Created Project: ${name}`);
      } catch (error) {
        console.error('Failed to create project:', error);
        toast.error('Failed to create project');
      }
    };
    createProject();
  }, [userId]);

  // Handle creating a session from sidebar.
  // ragService.createSession(userId, title, description?, projectId?) → { data, error }.
  const handleSidebarCreateSession = useCallback((title: string, projectId?: string) => {
    const createSession = async () => {
      try {
        const { data: newSession, error } = await ragService.createSession(
          userId,
          title,
          undefined,
          projectId || selectedProjectId || undefined,
        );
        if (error || !newSession) {
          console.error('Failed to create session:', error);
          toast.error('Failed to create session');
          return;
        }
        setSessions(prev => [newSession, ...prev]);
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

  // Project/session nav folded into the Notebook's Sources pane (replaces the
  // standalone WarRoomSidebar column on the flag-ON path).
  const notebookNav = useNotebookShell
    ? {
        projects: sidebarProjects,
        sessions: sidebarSessions,
        selectedProjectId,
        selectedSessionId,
        onSelectProject: setSelectedProjectId,
        onSelectSession: handleSidebarSelectSession,
        onCreateProject: handleSidebarCreateProject,
        onCreateSession: handleSidebarCreateSession,
        onDeleteProject: handleDeleteProject,
        onDeleteSession: handleDeleteSession,
      }
    : undefined;

  return (
    <div className="pulse-studio-container h-screen flex overflow-hidden relative">
      {/* War Room project/session sidebar. On the Notebook path this column is
          folded into the Sources pane (see `notebookNav` → SourcesPane), so the
          standalone sidebar is suppressed there. */}
      {!useNotebookShell && (
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
      )}

      {/* Main Content — War Room unified interface.
          The Notebook supplies its own per-pane headers + chat masthead, so the
          legacy StudioHeader bar is suppressed on the flag-ON path. */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!useNotebookShell && (
        <StudioHeader
          selectedProject={selectedProject}
          selectedSessionId={selectedSessionId}
          sessions={sessions}
          isMobile={isMobile}
          contextPanelOpen={contextPanelOpen}
          setContextPanelOpen={setContextPanelOpen}
          activeContextDocs={activeContextDocs}
          showVoiceAgentPanel={showVoiceAgentPanel}
          setShowVoiceAgentPanel={setShowVoiceAgentPanel}
          messages={messages}
          setShowExportModal={setShowExportModal}
          voiceEnabled={voiceEnabled}
          setVoiceEnabled={setVoiceEnabled}
          enableExtendedThinking={enableExtendedThinking}
          setEnableExtendedThinking={setEnableExtendedThinking}
          voiceSynthesisEnabled={voiceSynthesisEnabled}
          setVoiceSynthesisEnabled={setVoiceSynthesisEnabled}
          activeAgent={activeAgent}
          setActiveAgent={setActiveAgent}
          isGeneratingAudio={isGeneratingAudio}
          handleGenerateAudioOverview={handleGenerateAudioOverview}
        />
        )}

        <StudioShell
          className="flex-1 min-h-0"
          {...(useNotebookShell ? ({ nav: notebookNav } as any) : {})}
          apiKey={apiKey}
          onVoiceSend={(text) => sendMessageDirect(text)}
          sourceOpen={contextPanelOpen}
          onSourceChange={setContextPanelOpen}
          artifactsOpen={artifactsPanelOpen}
          onArtifactsChange={setArtifactsPanelOpen}
          onKnowledgeBank={() => setShowKnowledgeBank(true)}
          documents={documents}
          activeContextDocs={activeContextDocs}
          uploadingFiles={uploadingFiles}
          uploadProgress={uploadProgress}
          onToggleDoc={toggleDocInContext}
          onDeleteDoc={handleDeleteDoc}
          onViewDoc={(id) => {
            const doc = documents.find((d) => d.id === id);
            if (doc) setViewingDoc(doc);
          }}
          onUploadDocs={handleFileUpload}
          onAddAllDocs={addAllDocsToContext}
          onClearAllDocs={clearActiveContext}
          notes={boardNotes}
          onAddNote={addBoardNote}
          onDeleteNote={deleteBoardNote}
          onClearNotes={clearBoardNotes}
        >
          <ChatComponent
            selectedSessionId={selectedSessionId}
            messages={messages}
            isLoading={isLoading}
            thinkingLogs={thinkingLogs}
            input={input}
            setInput={setInput}
            onSendMessage={handleSendMessage}
            onSendDirect={sendMessageDirect}
            activeAgent={activeAgent}
            setActiveAgent={setActiveAgent}
            documents={documents}
            activeContextDocs={activeContextDocs}
            voiceEnabled={voiceEnabled}
            setVoiceEnabled={setVoiceEnabled}
            voiceMode={voiceMode}
            enableExtendedThinking={enableExtendedThinking}
            setEnableExtendedThinking={setEnableExtendedThinking}
            expandedThinking={expandedThinking}
            toggleThinking={toggleThinking}
            suggestions={suggestions}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
            handleUseSuggestion={handleUseSuggestion}
            onToggleSources={() => setContextPanelOpen(v => !v)}
            onToggleArtifacts={() => setArtifactsPanelOpen(v => !v)}
            sourcesOpen={contextPanelOpen}
            artifactsOpen={artifactsPanelOpen}
            onUploadClick={handleUploadClick}
            onPinArtifact={(content, type) => {
              const note = addBoardNote(content, type);
              // Broadcast to collaborators
              warRoomRealtimeService.broadcastArtifact('pin', {
                artifactId: note.id,
                content: content.substring(0, 500),
                type,
                userId,
              });
            }}
            isMobile={isMobile}
            {...(useNotebookShell ? ({ voiceUserId: userId, openaiApiKey, workspaceId } as any) : {})}
          />
        </StudioShell>

        {/* Audio Player */}
        {audioUrl && (
          <div className="px-4 pb-4">
            <audio src={audioUrl} controls className="w-full" />
          </div>
        )}
      </div>

      {/* Onboarding overlay — first visit only. Superseded by the Notebook's
          teaching EmptyState, so it's suppressed on the flag-ON path (Phase 7). */}
      {showOnboarding && !useNotebookShell && (
        <StudioOnboarding onComplete={() => setShowOnboarding(false)} />
      )}

      <WarRoomModalStack
        dockVoiceInline={useNotebookShell}
        showExportModal={showExportModal}
        showVoiceAgentPanel={showVoiceAgentPanel}
        voiceAgentExpanded={voiceAgentExpanded}
        viewingDoc={viewingDoc}
        viewerHighlightText={viewerHighlightText}
        viewerScrollOffset={viewerScrollOffset}
        showStudyGuide={showStudyGuide}
        showFAQ={showFAQ}
        showTimeline={showTimeline}
        showPodcast={showPodcast}
        showAdvancedAI={showAdvancedAI}
        showOrganize={showOrganize}
        organizingDocId={organizingDocId}
        showKnowledgeBank={showKnowledgeBank}
        showShareModal={showShareModal}
        sharingDoc={sharingDoc}
        documents={documents}
        activeContextDocs={activeContextDocs}
        apiKey={apiKey}
        openaiApiKey={openaiApiKey}
        workspaceId={workspaceId}
        userId={userId}
        selectedProjectId={selectedProjectId}
        selectedSessionId={selectedSessionId}
        setShowExportModal={setShowExportModal}
        setShowVoiceAgentPanel={setShowVoiceAgentPanel}
        setVoiceAgentExpanded={setVoiceAgentExpanded}
        setViewingDoc={setViewingDoc}
        setViewerHighlightText={setViewerHighlightText}
        setViewerScrollOffset={setViewerScrollOffset}
        setShowStudyGuide={setShowStudyGuide}
        setShowFAQ={setShowFAQ}
        setShowTimeline={setShowTimeline}
        setShowPodcast={setShowPodcast}
        setShowAdvancedAI={setShowAdvancedAI}
        setShowOrganize={setShowOrganize}
        setOrganizingDocId={setOrganizingDocId}
        setShowKnowledgeBank={setShowKnowledgeBank}
        setShowShareModal={setShowShareModal}
        setSharingDoc={setSharingDoc}
        handleExport={handleExport}
        exportToMarkdown={exportToMarkdown}
        handleFileUpload={handleFileUpload}
        handleDeleteDoc={handleDeleteDoc}
        toggleDocInContext={toggleDocInContext}
      />

    </div>
  );
};

// Wrap the entire component with error boundary for mobile safety
const LiveDashboardWithErrorBoundary: React.FC<LiveDashboardProps> = (props) => (
  <ErrorBoundary
    componentName="War Room"
    onError={(error) => {
      console.error('[WarRoom] Critical error:', error);
      if (isMobilePlatform) {
        toast.error('War Room encountered an issue. Some features may be limited on mobile.');
      }
    }}
  >
    <LiveDashboard {...props} />
  </ErrorBoundary>
);

export default LiveDashboardWithErrorBoundary;
