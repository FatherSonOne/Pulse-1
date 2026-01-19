/**
 * Voice Agent Panel Component
 * Full-featured panel for OpenAI realtime voice agents in the War Room
 * 
 * Integrates:
 * - RealtimeVoiceAgent (main voice interface)
 * - VoiceSessionHistory (conversation history)
 * - Agent switching and configuration
 * - Visual effects and audio visualization
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { RealtimeVoiceAgent, ContextFile } from './RealtimeVoiceAgent';
import { VoiceSessionHistory } from './VoiceSessionHistory';
import { RealtimeHistoryItem, WAR_ROOM_AGENTS } from '../../services/realtimeAgentService';
import toast from 'react-hot-toast';

interface ContextDocument {
  id: string;
  title: string;
  content?: string;
  summary?: string;
}

interface VoiceAgentPanelProps {
  userId: string;
  projectId?: string;
  sessionId?: string;
  openaiApiKey?: string;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  /** Documents to provide as context to the voice agent */
  documents?: ContextDocument[];
  /** Active document IDs from the War Room context */
  activeContextIds?: Set<string>;
}

export const VoiceAgentPanel: React.FC<VoiceAgentPanelProps> = ({
  userId,
  projectId,
  sessionId,
  openaiApiKey,
  onClose,
  isExpanded = false,
  onToggleExpand,
  className = '',
  documents = [],
  activeContextIds,
}) => {
  const [history, setHistory] = useState<RealtimeHistoryItem[]>([]);
  const [currentAgent, setCurrentAgent] = useState('general');
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings state
  const [voiceSettings, setVoiceSettings] = useState({
    voice: 'alloy' as const,
    turnDetection: 'semantic_vad' as const,
    noiseReduction: 'near_field' as const,
    language: 'en' as const,
  });

  // Panel animation state
  const [isMinimized, setIsMinimized] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Convert documents to context files for voice agent
  const contextFiles = useMemo<ContextFile[]>(() => {
    // Filter to only active context documents if activeContextIds is provided
    const activeDocuments = activeContextIds
      ? documents.filter(doc => activeContextIds.has(doc.id))
      : documents;

    return activeDocuments.map(doc => ({
      id: doc.id,
      name: doc.title,
      type: 'text' as const,
      content: doc.content || doc.summary || '',
      size: (doc.content || doc.summary || '').length,
    }));
  }, [documents, activeContextIds]);

  // Handle history updates from voice agent
  const handleHistoryUpdate = useCallback((newHistory: RealtimeHistoryItem[]) => {
    setHistory(newHistory);
  }, []);

  // Handle agent switches
  const handleAgentSwitch = useCallback((fromAgent: string, toAgent: string) => {
    setCurrentAgent(toAgent);
  }, []);

  // Handle transcript events
  const handleTranscript = useCallback((text: string, role: 'user' | 'assistant', isFinal: boolean) => {
    // Could be used for additional processing
    console.log(`[${role}] ${isFinal ? '✓' : '...'} ${text}`);
  }, []);

  // Clear history
  const handleClearHistory = useCallback(() => {
    setHistory([]);
    toast.success('History cleared');
  }, []);

  // Export history
  const handleExportHistory = useCallback((format: 'json' | 'text' | 'markdown') => {
    let content = '';
    let filename = `voice-session-${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      content = JSON.stringify(history, null, 2);
      filename += '.json';
    } else if (format === 'text') {
      content = history.map(item => {
        if (item.type === 'message') {
          return `[${item.role}]: ${item.content || item.transcript}`;
        }
        return `[${item.type}]: ${item.name || ''} ${item.output || item.arguments || ''}`;
      }).join('\n\n');
      filename += '.txt';
    } else {
      content = `# Voice Session Transcript\n\n${history.map(item => {
        if (item.type === 'message') {
          return `**${item.role}**:\n> ${item.content || item.transcript}\n`;
        }
        return `\`\`\`\n${item.type}: ${item.name || ''}\n${item.output || item.arguments || ''}\n\`\`\`\n`;
      }).join('\n')}`;
      filename += '.md';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported as ${format.toUpperCase()}`);
  }, [history]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to minimize
      if (e.key === 'Escape' && !isMinimized) {
        setIsMinimized(true);
      }
      // Ctrl+H to toggle history
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        setShowHistory(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMinimized]);

  // Minimized view
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        title="Open Voice Agent"
      >
        <i className="fa fa-microphone text-xl" />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`voice-agent-panel bg-gray-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden flex flex-col ${
        isExpanded ? 'fixed inset-4 z-50' : 'w-full max-w-md'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-cyan-500/30">
        <div className="flex items-center gap-3">
          {/* Voice Icon with Animation */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <i className="fa fa-microphone text-white" />
            </div>
            <div className="absolute inset-0 rounded-full bg-cyan-500/30 animate-ping" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">Voice Agent</h2>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                {WAR_ROOM_AGENTS[currentAgent]?.name || currentAgent}
              </span>
              {contextFiles.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                  <i className="fa fa-book-open text-[10px]" />
                  {contextFiles.length} doc{contextFiles.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          {/* History Toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg transition-colors ${
              showHistory ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
            title="Toggle History (Ctrl+H)"
          >
            <i className="fa fa-history" />
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
            title="Settings"
          >
            <i className="fa fa-cog" />
          </button>

          {/* Expand/Collapse */}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <i className={`fa fa-${isExpanded ? 'compress' : 'expand'}`} />
            </button>
          )}

          {/* Minimize */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
            title="Minimize"
          >
            <i className="fa fa-minus" />
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
              title="Close"
            >
              <i className="fa fa-times" />
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-800/50 border-b border-gray-700 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Voice Settings</h3>
          
          {/* Voice Selection */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Voice</label>
            <select
              value={voiceSettings.voice}
              onChange={(e) => setVoiceSettings(prev => ({ ...prev, voice: e.target.value as any }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
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
              <option value="onyx">Onyx (Male)</option>
              <option value="shimmer">Shimmer (Female)</option>
              <option value="sage">Sage (Neutral)</option>
              <option value="coral">Coral (Female)</option>
              <option value="verse">Verse (Neutral)</option>
            </select>
          </div>

          {/* Turn Detection */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Turn Detection</label>
            <select
              value={voiceSettings.turnDetection}
              onChange={(e) => setVoiceSettings(prev => ({ ...prev, turnDetection: e.target.value as any }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="semantic_vad">Semantic VAD (Smart)</option>
              <option value="server_vad">Server VAD (Fast)</option>
            </select>
          </div>

          {/* Noise Reduction */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Noise Reduction</label>
            <select
              value={voiceSettings.noiseReduction}
              onChange={(e) => setVoiceSettings(prev => ({ ...prev, noiseReduction: e.target.value as any }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="near_field">Near Field (Close Mic)</option>
              <option value="far_field">Far Field (Room Mic)</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex ${showHistory && isExpanded ? 'flex-row' : 'flex-col'} overflow-hidden`}>
        {/* Voice Agent */}
        <div className={`${showHistory && isExpanded ? 'flex-1' : 'flex-1'} flex flex-col`}>
          <RealtimeVoiceAgent
            userId={userId}
            projectId={projectId}
            sessionId={sessionId}
            openaiApiKey={openaiApiKey}
            contextFiles={contextFiles}
            voiceSettings={voiceSettings}
            onTranscript={handleTranscript}
            onHistoryUpdate={handleHistoryUpdate}
            onAgentSwitch={handleAgentSwitch}
            className="flex-1"
          />
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className={`${isExpanded ? 'w-80 border-l' : 'h-64 border-t'} border-gray-700 bg-gray-900/50`}>
            <VoiceSessionHistory
              history={history}
              currentAgent={currentAgent}
              onClearHistory={handleClearHistory}
              onExport={handleExportHistory}
              className="h-full"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 bg-gray-900 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>
            <i className="fa fa-comments mr-1" />
            {history.filter(h => h.type === 'message').length} messages
          </span>
          <span>
            <i className="fa fa-cog mr-1" />
            {history.filter(h => h.type === 'function_call').length} tool calls
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-500">OpenAI Realtime</span>
          <span>•</span>
          <span>gpt-realtime</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceAgentPanel;
