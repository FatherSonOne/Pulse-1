import React, { Suspense, lazy } from 'react';
import { Brain, Check, ChevronDown, ChevronUp, FileText, Info, Layers, MicOff, Paperclip, Plus, Send, Wand2, X } from 'lucide-react';
import { KnowledgeDoc, PromptSuggestion } from '../../services/ragService';
import { settingsService } from '../../services/settingsService';
import { WarRoomMode } from './ModeSwitcher';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { AgentType } from './AgentSelector';

const VoiceControl = lazy(() => import('./VoiceControl').then(m => ({ default: m.VoiceControl })));

const MODES_WITH_OWN_INPUT: WarRoomMode[] = ['tactical', 'focus', 'elegant-interface', 'analyst', 'strategist', 'brainstorm', 'debrief'];

interface InputAreaProps {
  selectedSessionId: string | null;
  warRoomMode: WarRoomMode;
  showActiveContext: boolean;
  setShowActiveContext: (v: boolean) => void;
  activeContextDocs: Set<string>;
  documents: KnowledgeDoc[];
  activeContextDocuments: KnowledgeDoc[];
  estimateContextTokens: () => number;
  clearActiveContext: () => void;
  addAllDocsToContext: () => void;
  toggleDocInContext: (id: string) => void;
  isMobile: boolean;
  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  voiceMode: 'push-to-talk' | 'always-on' | 'wake-word';
  setInput: (v: string) => void;
  handleSendMessage: () => void;
  setShowThinkingLogs: (v: boolean) => void;
  setWarRoomMode: (v: WarRoomMode) => void;
  setVisualizerType: (v: string) => void;
  input: string;
  isLoading: boolean;
  suggestions: PromptSuggestion[];
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  handleUseSuggestion: (s: PromptSuggestion) => void;
  activeAgent: AgentType;
  setActiveAgent: (v: AgentType) => void;
  enableExtendedThinking: boolean;
  setEnableExtendedThinking: (v: boolean) => void;
}

export const InputArea: React.FC<InputAreaProps> = ({
  selectedSessionId, warRoomMode,
  showActiveContext, setShowActiveContext,
  activeContextDocs, documents, activeContextDocuments,
  estimateContextTokens, clearActiveContext, addAllDocsToContext, toggleDocInContext,
  isMobile, voiceEnabled, setVoiceEnabled, voiceMode,
  setInput, handleSendMessage, setShowThinkingLogs, setWarRoomMode, setVisualizerType,
  input, isLoading,
  suggestions, showSuggestions, setShowSuggestions, handleUseSuggestion,
  activeAgent, setActiveAgent,
  enableExtendedThinking, setEnableExtendedThinking,
}) => {
  if (!selectedSessionId || MODES_WITH_OWN_INPUT.includes(warRoomMode)) return null;

  return (
    <div
      className="p-2 md:p-4 border-t border-rose-200 bg-white/90 dark:border-rose-500/40 dark:bg-[#1c1b23]/95 backdrop-blur-xl shrink-0 md:rounded-2xl shadow-[0_12px_48px_-28px_rgba(255,82,134,0.55)] transition-all duration-300 hover:shadow-[0_16px_60px_-28px_rgba(255,82,134,0.65)]"
    >
      {/* Active Context Panel */}
      {showActiveContext && (
        <div className="mb-2 p-2 md:p-3 bg-gradient-to-r from-rose-900/20 to-pink-900/20 border border-rose-500/20 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Layers className="fa text-rose-400 text-sm" />
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
                      <X className="fa mr-1" />
                      {!isMobile && 'Clear'}
                    </button>
                  )}
                  {activeContextDocs.size < documents.filter(d => d.processing_status === 'completed').length && (
                    <button
                      onClick={addAllDocsToContext}
                      className="text-[10px] md:text-xs px-2 py-0.5 hover:bg-rose-900/20 rounded text-rose-300 transition-colors"
                      title="Add all documents"
                    >
                      <Plus className="fa mr-1" />
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
                <ChevronUp className="fa text-xs" />
              </button>
            </div>
          </div>

          {activeContextDocs.size === 0 ? (
            <div className="text-center py-2">
              <p className="text-xs text-rose-300/70 mb-1">
                <Info className="fa mr-1" />
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
                  <FileText className="fa text-rose-400 text-[10px]" />
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
                    <X className="fa text-red-400 text-[10px]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Context panel toggle when hidden */}
      {!showActiveContext && (
        <div
          className="mb-2 px-3 py-1 bg-rose-900/10 border border-rose-500/20 rounded-lg flex items-center justify-between cursor-pointer hover:bg-rose-900/20 transition-colors"
          onClick={() => setShowActiveContext(true)}
        >
          <span className="text-xs text-rose-300">
            <Layers className="fa mr-1" />
            {activeContextDocs.size} document{activeContextDocs.size !== 1 ? 's' : ''} in context
          </span>
          <button className="text-xs px-2 py-0.5 hover:bg-rose-900/20 rounded text-rose-300">
            <ChevronDown className="fa mr-1" />
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
                <MicOff className="fa mr-2" />
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

      {/* Enhanced Input Area */}
      <div className="flex flex-col gap-2">
        {/* Quick Actions Row */}
        <div className="flex items-center justify-between px-1">
          {/* Left side: Agent selector + actions */}
          <div className="flex items-center gap-2">
            {/* Agent/Persona Selector */}
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
                <ChevronDown className="fa text-[10px] opacity-60" />
              </button>
              <div
                id="agent-dropdown"
                className="hidden absolute bottom-full left-0 mb-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl z-50 py-1"
              >
                {['pulse', 'analyst', 'creative', 'coder', 'researcher'].map((agent) => (
                  <button
                    key={agent}
                    onClick={() => {
                      setActiveAgent(agent as AgentType);
                      settingsService.set('liveBoardSelectedAgent', agent);
                      document.getElementById('agent-dropdown')?.classList.add('hidden');
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${activeAgent === agent ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    <i className={`fa ${agent === 'pulse' ? 'fa-robot' : agent === 'analyst' ? 'fa-chart-line' : agent === 'creative' ? 'fa-palette' : agent === 'coder' ? 'fa-code' : 'fa-brain'} w-4`}></i>
                    <span className="capitalize">{agent}</span>
                    {activeAgent === agent && <Check className="fa ml-auto text-xs" />}
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
                <Paperclip className="fa text-sm" />
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
                <Brain className="fa text-sm" />
              </button>
            </div>
          </div>

          {/* Right side: Context info */}
          <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md" title="Estimated context usage">
              <Layers className="fa text-rose-400" />
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

            <div className="sm:hidden flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
              <FileText className="fa text-rose-400" />
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
            <Send className="fa" />
          </button>
        </div>

        {/* Suggested Prompts */}
        {suggestions.length > 0 && showSuggestions && (
          <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
              <Wand2 className="fa mr-1" />
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
              <X className="fa text-[10px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
