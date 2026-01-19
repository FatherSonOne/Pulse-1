import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import { Capacitor } from '@capacitor/core';
import { VoiceSettings, RealtimeVoiceAgentRef, ContextFile, AIParticipantMode } from './WarRoom/RealtimeVoiceAgent';
import { RealtimeHistoryItem } from '../services/realtimeAgentService';
import { getCurrentCitations, clearCitations } from '../services/warRoomToolsService';
import { contextBankService } from '../services/contextBankService';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { VoiceTextButton } from './shared/VoiceTextButton';
import toast from 'react-hot-toast';

// Lazy load heavy voice components that may crash on mobile
const RealtimeVoiceAgent = lazy(() => import('./WarRoom/RealtimeVoiceAgent').then(m => ({ default: m.RealtimeVoiceAgent })));
const VoiceAgentVisualizerEnhanced = lazy(() => import('./WarRoom/VoiceAgentVisualizerEnhanced').then(m => ({ default: m.VoiceAgentVisualizerEnhanced })));

// Check if we're on a mobile/native platform
const isMobilePlatform = Capacitor.isNativePlatform() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Simple loading fallback
const LoadingFallback: React.FC = () => (
  <div className="h-full w-full flex items-center justify-center bg-gray-900/50">
    <div className="text-center">
      <i className="fa fa-spinner fa-spin text-2xl text-rose-500 mb-2"></i>
      <p className="text-sm text-gray-400">Loading voice features...</p>
    </div>
  </div>
);

// Citation type for display
interface DisplayCitation {
  documentName: string;
  excerpt: string;
  similarity: number;
}

interface PulseChatProps {
  apiKey: string;
  userId?: string;
  onClose: () => void;
}

const PulseChatInner: React.FC<PulseChatProps> = ({ apiKey, userId = 'anonymous', onClose }) => {
  const openaiApiKey = localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '';

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentRole, setCurrentRole] = useState<'user' | 'assistant'>('user');
  const [history, setHistory] = useState<RealtimeHistoryItem[]>([]);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voice: 'alloy',
    turnDetection: 'semantic_vad',
    noiseReduction: 'near_field',
  });

  // Context drawer state
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [contextText, setContextText] = useState('');

  // Export menu state
  const [showExportMenu, setShowExportMenu] = useState(false);

  // RAG status state
  const [isSearchingContext, setIsSearchingContext] = useState(false);
  const [lastCitations, setLastCitations] = useState<DisplayCitation[]>([]);
  const [indexingProgress, setIndexingProgress] = useState<number | null>(null);
  const [indexedFileCount, setIndexedFileCount] = useState(0);

  // AI Participant Mode - controls how AI behaves in conversation
  const [aiMode, setAiMode] = useState<AIParticipantMode>('active');

  const agentRef = useRef<RealtimeVoiceAgentRef>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle connection state changes from the agent
  const handleConnectionChange = useCallback((connected: boolean, connecting: boolean) => {
    setIsConnected(connected);
    setIsConnecting(connecting);
  }, []);

  // Handle transcript updates
  const handleTranscript = useCallback((text: string, role: 'user' | 'assistant', isFinal: boolean) => {
    setCurrentTranscript(text);
    setCurrentRole(role);
    setIsListening(role === 'user' && !isFinal);
    setIsSpeaking(role === 'assistant' && !isFinal);
  }, []);

  // Handle audio level updates from voice agent
  const handleAudioLevel = useCallback((level: number, isListeningNow: boolean, isSpeakingNow: boolean) => {
    setAudioLevel(level);
    // Also update listening/speaking states for more responsive UI
    if (isListeningNow) setIsListening(true);
    if (isSpeakingNow) setIsSpeaking(true);
  }, []);

  // Handle history updates
  const handleHistoryUpdate = useCallback((newHistory: RealtimeHistoryItem[]) => {
    setHistory(newHistory);

    // Check for tool calls to update RAG status
    const lastItem = newHistory[newHistory.length - 1];
    if (lastItem?.type === 'function_call') {
      if (lastItem.name === 'rag_search') {
        setIsSearchingContext(true);
      }
    } else if (lastItem?.type === 'function_result') {
      if (lastItem.name === 'rag_search') {
        setIsSearchingContext(false);
        // Get citations from the service
        const citations = getCurrentCitations();
        if (citations.length > 0) {
          setLastCitations(citations);
        }
      } else if (lastItem.name === 'report_grounding') {
        // Clear citations after they've been reported
        setTimeout(() => {
          clearCitations();
        }, 5000);
      }
    }
  }, []);

  // Determine if AI is thinking
  const isThinking = history.length > 0 &&
    history[history.length - 1].role === 'user' &&
    !isSpeaking &&
    !isListening;

  // Connect to voice
  const handleConnect = useCallback(async () => {
    if (agentRef.current) {
      await agentRef.current.connect();
    }
  }, []);

  // Disconnect from voice
  const handleDisconnect = useCallback(async () => {
    if (agentRef.current) {
      await agentRef.current.disconnect();
      setIsListening(false);
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, []);

  // Pause/Resume voice
  const handlePauseResume = useCallback(() => {
    setIsPaused(prev => !prev);
    toast.success(isPaused ? 'Resumed listening' : 'Paused listening');
  }, [isPaused]);

  // Export transcript as text
  const exportTranscriptText = useCallback(() => {
    if (history.length === 0) {
      toast.error('No conversation to export');
      return;
    }

    const header = `Pulse Chat Transcript\nExported: ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n`;
    const content = history
      .filter(h => h.type === 'message')
      .map(msg => {
        const speaker = msg.role === 'user' ? 'You' : 'Pulse AI';
        return `[${speaker}]:\n${msg.content || msg.transcript}\n`;
      }).join('\n');

    const blob = new Blob([header + content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported as TXT');
    setShowExportMenu(false);
  }, [history]);

  // Export transcript as JSON
  const exportTranscriptJSON = useCallback(() => {
    if (history.length === 0) {
      toast.error('No conversation to export');
      return;
    }

    const data = {
      exportedAt: new Date().toISOString(),
      sessionId: 'pulse-chat',
      messages: history.filter(h => h.type === 'message').map(msg => ({
        role: msg.role,
        content: msg.content || msg.transcript,
        timestamp: new Date().toISOString()
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-chat-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported as JSON');
    setShowExportMenu(false);
  }, [history]);

  // Export transcript as Markdown
  const exportTranscriptMarkdown = useCallback(() => {
    if (history.length === 0) {
      toast.error('No conversation to export');
      return;
    }

    const header = `# Pulse Chat Transcript\n\n**Exported:** ${new Date().toLocaleString()}\n\n---\n\n`;
    const content = history
      .filter(h => h.type === 'message')
      .map(msg => {
        const speaker = msg.role === 'user' ? '**You**' : '**Pulse AI**';
        return `${speaker}:\n> ${(msg.content || msg.transcript || '').replace(/\n/g, '\n> ')}\n`;
      }).join('\n');

    const blob = new Blob([header + content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported as Markdown');
    setShowExportMenu(false);
  }, [history]);

  // Handle file upload for context
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const newFile: ContextFile = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: 'file',
          content: content,
          size: file.size
        };
        setContextFiles(prev => [...prev, newFile]);
        toast.success(`Added: ${file.name}`);
      };
      reader.readAsText(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Add text context
  const handleAddTextContext = useCallback(() => {
    if (!contextText.trim()) return;

    const newContext: ContextFile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: `Note ${contextFiles.filter(f => f.type === 'text').length + 1}`,
      type: 'text',
      content: contextText.trim()
    };
    setContextFiles(prev => [...prev, newContext]);
    setContextText('');
    toast.success('Context added');
  }, [contextText, contextFiles]);

  // Remove context file
  const removeContextFile = useCallback((id: string) => {
    setContextFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-gray-50 via-white to-rose-50/30 dark:from-[#050507] dark:via-[#0a0a0c] dark:to-[#0f0a0d] overflow-hidden relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-16 border-b border-gray-200 dark:border-rose-500/20 bg-white/90 dark:bg-black/60 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shadow-sm z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg">
            <i className="fa fa-comments text-white text-lg"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              Pulse Chat
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AI Voice Reasoning & Conversation
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* AI Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-0.5">
            <button
              onClick={() => setAiMode('active')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                aiMode === 'active'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="AI actively participates in conversation"
            >
              <i className="fa fa-comments"></i>
              <span className="hidden sm:inline">Active</span>
            </button>
            <button
              onClick={() => setAiMode('observer')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                aiMode === 'observer'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="AI listens silently, responds only when prompted"
            >
              <i className="fa fa-eye"></i>
              <span className="hidden sm:inline">Observer</span>
            </button>
          </div>

          {/* Export Button */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                showExportMenu
                  ? 'bg-rose-500 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
              title="Export Chat"
            >
              <i className="fa fa-download"></i>
            </button>

            {/* Export Menu Dropdown */}
            {showExportMenu && (
              <div className="absolute right-0 top-11 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-rose-500/30 py-2 z-[70]">
                <button
                  onClick={exportTranscriptText}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                >
                  <i className="fa fa-file-text text-gray-400"></i>
                  Export as TXT
                </button>
                <button
                  onClick={exportTranscriptJSON}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                >
                  <i className="fa fa-code text-gray-400"></i>
                  Export as JSON
                </button>
                <button
                  onClick={exportTranscriptMarkdown}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                >
                  <i className="fa fa-file-code text-gray-400"></i>
                  Export as Markdown
                </button>
              </div>
            )}
          </div>

          {/* Connection Status & Button */}
          <div className="flex items-center gap-2">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                isConnected
                  ? isPaused
                    ? 'bg-yellow-500'
                    : 'bg-green-500 shadow-lg shadow-green-500/50'
                  : isConnecting
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-gray-400'
              }`} />
              <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                {isConnected ? (isPaused ? 'Paused' : 'Connected') : isConnecting ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>

            {/* Connect/Disconnect Button */}
            {isConnected ? (
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full text-sm font-medium transition-all border border-red-500/20"
              >
                <i className="fa fa-phone-slash text-xs"></i>
                <span className="hidden sm:inline">Disconnect</span>
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting || !openaiApiKey}
                className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-full text-sm font-medium transition-all shadow-lg shadow-rose-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <>
                    <i className="fa fa-spinner fa-spin text-xs"></i>
                    <span className="hidden sm:inline">Connecting...</span>
                  </>
                ) : (
                  <>
                    <i className="fa fa-microphone text-xs"></i>
                    <span>Start Voice</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Settings Button */}
          <button
            ref={settingsButtonRef}
            onClick={() => setShowSettings(!showSettings)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              showSettings
                ? 'bg-rose-500 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
            title="Voice Settings"
          >
            <i className="fa fa-cog"></i>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 transition-colors"
            title="Close"
          >
            <i className="fa fa-times"></i>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div
          className="absolute z-[60] top-16 right-4 w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-rose-500/30 p-4 space-y-4"
        >
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <i className="fa fa-sliders text-rose-500"></i>
            Voice Settings
          </h3>

          {/* Voice Selection */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">AI Voice</label>
            <select
              value={voiceSettings.voice}
              onChange={(e) => setVoiceSettings(prev => ({ ...prev, voice: e.target.value as any }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            >
              <option value="alloy">Alloy (Neutral)</option>
              <option value="ash">Ash (Neutral)</option>
              <option value="ballad">Ballad (Female)</option>
              <option value="coral">Coral (Female)</option>
              <option value="echo">Echo (Male)</option>
              <option value="sage">Sage (Neutral)</option>
              <option value="shimmer">Shimmer (Female)</option>
              <option value="verse">Verse (Neutral)</option>
              <option value="marin">Marin (Female)</option>
              <option value="cedar">Cedar (Male)</option>
            </select>
          </div>

          {/* Turn Detection */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">Turn Detection</label>
            <select
              value={voiceSettings.turnDetection}
              onChange={(e) => setVoiceSettings(prev => ({ ...prev, turnDetection: e.target.value as any }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            >
              <option value="semantic_vad">Semantic VAD (Smart)</option>
              <option value="server_vad">Server VAD (Fast)</option>
            </select>
          </div>

          {/* Noise Reduction */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">Noise Reduction</label>
            <select
              value={voiceSettings.noiseReduction}
              onChange={(e) => setVoiceSettings(prev => ({ ...prev, noiseReduction: e.target.value as any }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            >
              <option value="near_field">Near Field (Close Mic)</option>
              <option value="far_field">Far Field (Room Mic)</option>
            </select>
          </div>

          {/* AI Mode Explanation */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2">AI Behavior Mode</label>
            <div className="space-y-2">
              <label className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                <input
                  type="radio"
                  name="aiMode"
                  value="active"
                  checked={aiMode === 'active'}
                  onChange={() => setAiMode('active')}
                  className="mt-0.5 accent-rose-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                    <i className="fa fa-comments text-rose-500"></i> Active Participant
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    AI engages proactively, asks clarifying questions, and drives conversation
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                <input
                  type="radio"
                  name="aiMode"
                  value="observer"
                  checked={aiMode === 'observer'}
                  onChange={() => setAiMode('observer')}
                  className="mt-0.5 accent-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                    <i className="fa fa-eye text-blue-500"></i> Silent Observer
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    AI listens silently, only responds when directly addressed or asked
                  </p>
                </div>
              </label>
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
            Changes apply on next connection
          </p>
        </div>
      )}

      {/* Main Content */}
      <div className="absolute inset-0 pt-16 pb-12">
        {!openaiApiKey ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-md text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto">
                <i className="fa fa-key text-rose-500 text-2xl"></i>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                OpenAI API Key Required
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                To use Pulse Chat with AI voice reasoning, please add your OpenAI API key in Settings.
              </p>
              <button
                onClick={() => {
                  window.location.hash = '#settings';
                }}
                className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-full font-medium transition-all shadow-lg hover:shadow-xl"
              >
                <i className="fa fa-gear mr-2"></i>
                Go to Settings
              </button>
            </div>
          </div>
        ) : !isConnected ? (
          /* Not connected - show connect prompt */
          <div className="h-full flex flex-col items-center justify-center p-6">
            <div className="max-w-md text-center space-y-6">
              {/* Animated voice icon */}
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-500/20 animate-pulse"></div>
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-rose-500/30 to-pink-500/30 animate-ping" style={{ animationDuration: '2s' }}></div>
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
                  <i className="fa fa-microphone text-white text-2xl"></i>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Ready to Chat
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Connect to start a real-time voice conversation with Pulse AI
                </p>
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-8 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-full font-medium transition-all shadow-lg shadow-rose-500/30 hover:shadow-xl disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                {isConnecting ? (
                  <>
                    <i className="fa fa-spinner fa-spin"></i>
                    Connecting...
                  </>
                ) : (
                  <>
                    <i className="fa fa-microphone"></i>
                    Start Voice Chat
                  </>
                )}
              </button>

              {/* Context files indicator */}
              {contextFiles.length > 0 && (
                <p className="text-xs text-rose-500">
                  <i className="fa fa-paperclip mr-1"></i>
                  {contextFiles.length} context file{contextFiles.length > 1 ? 's' : ''} attached
                </p>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500">
                Press the button above or use the header button to connect
              </p>
            </div>
          </div>
        ) : (
          /* Connected - show voice visualizer and agent */
          <div className="h-full flex flex-col relative">
            {/* Visualizer */}
            <div className="flex-1 relative">
              <ErrorBoundary 
                componentName="Voice Visualizer"
                fallback={
                  <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-rose-900/30">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                        <i className="fa fa-microphone text-rose-500 text-2xl"></i>
                      </div>
                      <p className="text-white">Voice Active</p>
                      <p className="text-gray-400 text-sm">Visualizer unavailable on this device</p>
                    </div>
                  </div>
                }
              >
                <Suspense fallback={<LoadingFallback />}>
                  <VoiceAgentVisualizerEnhanced
                    isListening={isListening && !isPaused}
                    isSpeaking={isSpeaking}
                    isThinking={isThinking}
                    audioLevel={isPaused ? 0 : audioLevel}
                    thinkingText={isThinking ? 'Processing...' : ''}
                    transcriptText={currentTranscript}
                  />
                </Suspense>
              </ErrorBoundary>

              {/* Floating Control Panel - positioned at bottom right of visualizer */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-full px-2 py-1.5 shadow-lg border border-gray-200 dark:border-rose-500/30">
                {/* Pause/Resume Button */}
                <button
                  onClick={handlePauseResume}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isPaused
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  }`}
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  <i className={`fa fa-${isPaused ? 'play' : 'pause'} text-xs`}></i>
                </button>

                {/* Stop/End Button */}
                <button
                  onClick={handleDisconnect}
                  className="w-8 h-8 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center transition-all"
                  title="Stop"
                >
                  <i className="fa fa-stop text-xs"></i>
                </button>

                {/* Context Button */}
                <button
                  onClick={() => setShowContextDrawer(true)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all relative ${
                    contextFiles.length > 0
                      ? 'bg-rose-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title="Add Context"
                >
                  <i className="fa fa-paperclip text-xs"></i>
                  {contextFiles.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-white dark:bg-gray-900 text-rose-500 text-[10px] font-bold rounded-full flex items-center justify-center border border-rose-500">
                      {contextFiles.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Conversation History */}
            {history.length > 0 && (
              <div className="shrink-0 max-h-48 overflow-y-auto bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200 dark:border-rose-500/20 p-3">
                <div className="space-y-2">
                  {history.slice(-6).map((item, idx) => {
                    if (item.type !== 'message') return null;
                    const isLastAssistantMessage = item.role === 'assistant' &&
                      idx === history.slice(-6).filter(h => h.type === 'message').length - 1;

                    return (
                      <div
                        key={idx}
                        className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="max-w-[80%]">
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm ${
                              item.role === 'user'
                                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                            }`}
                          >
                            {item.content || item.transcript}
                          </div>

                          {/* Show citations for the last assistant message */}
                          {isLastAssistantMessage && lastCitations.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 ml-1">
                              {lastCitations.slice(0, 3).map((citation, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center gap-1"
                                  title={citation.excerpt}
                                >
                                  <i className="fa fa-quote-left text-[8px]"></i>
                                  {citation.documentName.length > 20
                                    ? citation.documentName.substring(0, 20) + '...'
                                    : citation.documentName}
                                </span>
                              ))}
                              {lastCitations.length > 3 && (
                                <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full">
                                  +{lastCitations.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status indicator */}
            <div className="shrink-0 py-2 text-center space-y-1">
              {isPaused && (
                <span className="text-sm text-yellow-500 font-medium">
                  <i className="fa fa-pause mr-1"></i> Paused
                </span>
              )}
              {!isPaused && isSearchingContext && (
                <span className="text-sm text-blue-500 font-medium animate-pulse">
                  <i className="fa fa-search mr-1"></i> Searching knowledge base...
                </span>
              )}
              {!isPaused && isListening && !isSearchingContext && (
                <span className="text-sm text-rose-500 font-medium animate-pulse">
                  <i className="fa fa-microphone mr-1"></i> Listening...
                </span>
              )}
              {!isPaused && isSpeaking && (
                <span className="text-sm text-green-500 font-medium animate-pulse">
                  <i className="fa fa-volume-up mr-1"></i> Speaking...
                </span>
              )}
              {!isPaused && isThinking && !isSearchingContext && (
                <span className="text-sm text-purple-500 font-medium animate-pulse">
                  <i className="fa fa-brain mr-1"></i> Thinking...
                </span>
              )}
              {!isPaused && !isListening && !isSpeaking && !isThinking && !isSearchingContext && (
                <span className="text-xs text-gray-400">
                  Speak anytime - I'm listening
                </span>
              )}

              {/* Context files indicator when connected */}
              {contextFiles.length > 0 && (
                <div className="text-[10px] text-gray-400 flex items-center justify-center gap-1">
                  <i className="fa fa-database"></i>
                  {contextFiles.length} document{contextFiles.length > 1 ? 's' : ''} indexed for RAG
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hidden RealtimeVoiceAgent - handles actual connection */}
        {openaiApiKey && (
          <div className="hidden">
            <ErrorBoundary 
              componentName="Voice Connection"
              onError={(error) => {
                console.error('[PulseChat] Voice agent error:', error);
                setIsConnected(false);
                setIsConnecting(false);
                toast.error(isMobilePlatform 
                  ? 'Voice features may be limited on mobile devices'
                  : 'Voice connection failed. Please try again.');
              }}
            >
              <Suspense fallback={null}>
                <RealtimeVoiceAgent
                  ref={agentRef}
                  userId={userId}
                  sessionId="pulse-chat"
                  openaiApiKey={openaiApiKey}
                  voiceSettings={voiceSettings}
                  contextFiles={contextFiles}
                  aiMode={aiMode}
                  onTranscript={handleTranscript}
                  onHistoryUpdate={handleHistoryUpdate}
                  onConnectionChange={handleConnectionChange}
                  onAudioLevel={handleAudioLevel}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* RAG Context Drawer - Slide up from bottom */}
      <div
        className={`absolute inset-x-0 bottom-0 z-[70] transition-transform duration-300 ease-out ${
          showContextDrawer ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drawer Handle */}
        <div
          className="flex justify-center py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200 dark:border-rose-500/30 rounded-t-2xl cursor-pointer"
          onClick={() => setShowContextDrawer(false)}
        >
          <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>

        {/* Drawer Content */}
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl px-4 pb-16 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <i className="fa fa-folder-open text-rose-500"></i>
              Conversation Context
            </h3>
            <button
              onClick={() => setShowContextDrawer(false)}
              className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-500"
            >
              <i className="fa fa-chevron-down"></i>
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Add documents, files, or notes to provide context for your conversation.
          </p>

          {/* File Upload */}
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.json,.csv,.pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:border-rose-500 hover:text-rose-500 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa fa-cloud-upload"></i>
              Upload Files
            </button>
          </div>

          {/* Text Input */}
          <div className="mb-4">
            <div className="relative">
              <textarea
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                placeholder="Or paste text, notes, or URLs here..."
                className="w-full px-3 py-2 pr-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 resize-none h-20"
              />
              <div className="absolute right-2 top-2">
                <VoiceTextButton
                  onTranscript={(text) => setContextText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)}
                  size="sm"
                  className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                />
              </div>
            </div>
            <button
              onClick={handleAddTextContext}
              disabled={!contextText.trim()}
              className="mt-2 px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <i className="fa fa-plus mr-1"></i>
              Add Context
            </button>
          </div>

          {/* Context Files List */}
          {contextFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Added Context ({contextFiles.length})
              </h4>
              {contextFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      file.type === 'file' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500' :
                      file.type === 'url' ? 'bg-green-100 dark:bg-green-900/30 text-green-500' :
                      'bg-purple-100 dark:bg-purple-900/30 text-purple-500'
                    }`}>
                      <i className={`fa fa-${file.type === 'file' ? 'file' : file.type === 'url' ? 'link' : 'sticky-note'} text-sm`}></i>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {file.type === 'file' && formatFileSize(file.size)}
                        {file.type === 'text' && `${file.content.length} characters`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeContextFile(file.id)}
                    className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <i className="fa fa-times text-xs"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          {contextFiles.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <i className="fa fa-inbox text-3xl mb-2"></i>
              <p className="text-sm">No context files added yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop for context drawer */}
      {showContextDrawer && (
        <div
          className="absolute inset-0 bg-black/30 z-[65]"
          onClick={() => setShowContextDrawer(false)}
        />
      )}

      {/* Info Footer */}
      <div className="absolute bottom-0 left-0 right-0 h-12 px-4 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200 dark:border-rose-500/20 z-50">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <i className="fa fa-brain text-rose-500"></i>
              Advanced Reasoning
            </span>
            <span className="flex items-center gap-1">
              <i className="fa fa-microphone text-rose-500"></i>
              Real-time Voice
            </span>
            <span className="flex items-center gap-1">
              <i className="fa fa-bolt text-rose-500"></i>
              Powered by OpenAI
            </span>
          </div>
          {/* Context drawer toggle in footer */}
          <button
            onClick={() => setShowContextDrawer(true)}
            className="flex items-center gap-1 text-gray-400 hover:text-rose-500 transition-colors"
          >
            <i className="fa fa-paperclip"></i>
            {contextFiles.length > 0 ? `${contextFiles.length} files` : 'Add context'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Wrap with error boundary for mobile safety
const PulseChat: React.FC<PulseChatProps> = (props) => (
  <ErrorBoundary 
    componentName="Pulse Chat"
    onError={(error) => {
      console.error('[PulseChat] Critical error:', error);
      if (isMobilePlatform) {
        toast.error('Pulse Chat encountered an issue. Some features may be limited on mobile.');
      }
    }}
    fallback={
      <div className="h-full w-full flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 via-white to-rose-50/30 dark:from-[#050507] dark:via-[#0a0a0c] dark:to-[#0f0a0d]">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <i className="fa fa-exclamation-triangle text-red-500 text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Pulse Chat Unavailable
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {isMobilePlatform 
              ? 'Voice chat features may not be fully supported on this device. Please try using the web version.'
              : 'Pulse Chat encountered an error. Please try again.'}
          </p>
          <button
            onClick={props.onClose}
            className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-full font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    }
  >
    <PulseChatInner {...props} />
  </ErrorBoundary>
);

export default PulseChat;
