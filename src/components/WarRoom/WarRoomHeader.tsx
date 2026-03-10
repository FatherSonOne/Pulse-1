import React from 'react';
import { Activity, BookOpen, Brain, Database, EllipsisVertical, Headphones, LayoutGrid, Mic, Share2, Volume2 } from 'lucide-react';
import { AIProject, AISession, AIMessage } from '../../services/ragService';
import { settingsService } from '../../services/settingsService';
import { AgentType, AgentSelector } from './AgentSelector';

interface WarRoomHeaderProps {
  showWarRoomHub: boolean;
  setShowWarRoomHub: (v: boolean) => void;
  selectedProject: AIProject | null;
  selectedSessionId: string | null;
  sessions: AISession[];
  isMobile: boolean;
  contextPanelOpen: boolean;
  setContextPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeContextDocs: Set<string>;
  showVoiceAgentPanel: boolean;
  setShowVoiceAgentPanel: (v: boolean) => void;
  messages: AIMessage[];
  setShowExportModal: (v: boolean) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  enableExtendedThinking: boolean;
  setEnableExtendedThinking: (v: boolean) => void;
  showMobileMenu: boolean;
  setShowMobileMenu: (v: boolean) => void;
  voiceSynthesisEnabled: boolean;
  setVoiceSynthesisEnabled: (v: boolean) => void;
  activeAgent: AgentType;
  setActiveAgent: (v: AgentType) => void;
  isGeneratingAudio: boolean;
  handleGenerateAudioOverview: () => void;
}

export const WarRoomHeader: React.FC<WarRoomHeaderProps> = ({
  showWarRoomHub, setShowWarRoomHub,
  selectedProject, selectedSessionId, sessions,
  isMobile, contextPanelOpen, setContextPanelOpen, activeContextDocs,
  showVoiceAgentPanel, setShowVoiceAgentPanel,
  messages, setShowExportModal,
  voiceEnabled, setVoiceEnabled,
  enableExtendedThinking, setEnableExtendedThinking,
  showMobileMenu, setShowMobileMenu,
  voiceSynthesisEnabled, setVoiceSynthesisEnabled,
  activeAgent, setActiveAgent,
  isGeneratingAudio, handleGenerateAudioOverview,
}) => {
  return (
    <>
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
              <LayoutGrid className="fa" />
              <span className="hidden sm:inline">Hub</span>
            </button>
          )}

          {/* War Room title when on hub */}
          {showWarRoomHub && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--wr-accent-primary)' }}>
                <BookOpen className="fa text-white text-sm" />
              </div>
              <span className="text-sm font-bold" style={{ color: 'var(--wr-accent-primary)' }}>
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

        {/* CENTER: Context Button — toggles IntelDesk source panel */}
        <button
          onClick={() => setContextPanelOpen((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all font-medium text-sm ${
            contextPanelOpen
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
              : activeContextDocs.size > 0
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
          }`}
        >
          <Database className="fa" />
          <span className="hidden sm:inline">Sources</span>
          {activeContextDocs.size > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${contextPanelOpen ? 'bg-cyan-500/20' : 'bg-emerald-500/30'}`}>
              {activeContextDocs.size}
            </span>
          )}
          <i className={`fa fa-chevron-${contextPanelOpen ? 'left' : 'right'} text-xs transition-transform`}></i>
        </button>

        {/* Desktop Controls */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Voice Agent Button */}
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

          {/* Export Button */}
          {messages.length > 0 && (
            <button
              onClick={() => setShowExportModal(true)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 transition-all flex items-center gap-2 font-medium"
            >
              <Share2 className="fa" />
              <span className="hidden xl:inline">Export</span>
            </button>
          )}
        </div>

        {/* Mobile/Tablet Controls */}
        <div className="flex lg:hidden items-center gap-1">
          <button
            onClick={() => setShowVoiceAgentPanel(true)}
            className={`p-2 rounded-full text-sm transition-all ${
              showVoiceAgentPanel
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg'
                : 'text-rose-400 hover:bg-rose-500/20'
            }`}
            title="Voice Agent"
          >
            <Activity className="fa" />
          </button>

          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-full text-sm transition-all ${
              voiceEnabled
                ? 'bg-rose-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Mic className="fa" />
          </button>

          <button
            onClick={() => setEnableExtendedThinking(!enableExtendedThinking)}
            className={`p-2 rounded-full text-sm transition-all ${
              enableExtendedThinking
                ? 'bg-rose-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Brain className="fa" />
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMobileMenu(!showMobileMenu);
            }}
            className="mobile-menu-container p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <EllipsisVertical className="fa" />
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && isMobile && (
        <div
          className="mobile-menu-container fixed top-16 right-2 z-[9990] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-rose-500/30 p-3 min-w-[220px] max-h-[calc(100vh-5rem)] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            {/* Voice Controls */}
            <button
              onClick={() => { setVoiceSynthesisEnabled(!voiceSynthesisEnabled); setShowMobileMenu(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 ${
                voiceSynthesisEnabled ? 'bg-rose-100 dark:bg-rose-600/20 text-rose-700 dark:text-rose-200' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Volume2 className="fa w-5" />
              Voice Output {voiceSynthesisEnabled ? 'On' : 'Off'}
            </button>

            {/* Agent Selector */}
            <div className="px-3 py-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Agent</span>
              <AgentSelector
                activeAgent={activeAgent}
                onAgentChange={(agent) => { setActiveAgent(agent); settingsService.set('liveBoardSelectedAgent', agent); setShowMobileMenu(false); }}
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
                  <Headphones className="fa w-5" />
                  {isGeneratingAudio ? 'Generating...' : 'Generate Audio'}
                </button>

                <button
                  onClick={() => { setShowExportModal(true); setShowMobileMenu(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  <Share2 className="fa w-5" />
                  Export Session
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
