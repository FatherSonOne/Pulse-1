import React from 'react';
import { AIMessage } from '../../../services/ragService';
import { SessionExport } from '../shared';
import { MissionPhaseConfig } from './useMissionPhases';
import { BookOpen, Check, Send } from 'lucide-react';

interface MissionShellProps {
  // Identity
  missionTitle: string;
  missionIcon: string;
  accentColor: string;

  // Phase state
  phases: MissionPhaseConfig[];
  currentPhase: string;
  currentPhaseIndex: number;
  onPhaseClick: (phaseId: string) => void;

  // Chat state
  messages: AIMessage[];
  isLoading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;

  // Export
  showExport: boolean;
  onShowExport: (show: boolean) => void;
  sessionId?: string;
  sessionTitle?: string;
  exportTopic?: string;
  exportMode?: string;
  documents?: { title: string; summary?: string }[];

  // Sidebar extras
  sidebarContent?: React.ReactNode;
  sidebarFooter?: React.ReactNode;

  // Chat extras
  chatHeader?: React.ReactNode;
  chatEmptyState?: React.ReactNode;
  messageExtra?: (msg: AIMessage, idx: number) => React.ReactNode;
  loadingLabel?: string;
  inputPlaceholder?: string;
  inputIcon?: React.ReactNode;

  // Active context
  activeContextCount?: number;

  // Children: rendered above chat messages
  children?: React.ReactNode;
}

// Color utility: maps accent name to Tailwind classes
function accentClasses(color: string) {
  const map: Record<string, { bg: string; bgLight: string; border: string; text: string; activeBg: string }> = {
    blue:   { bg: 'bg-blue-500',   bgLight: 'bg-blue-500/20',   border: 'border-blue-500/40',   text: 'text-blue-400',   activeBg: 'bg-blue-500/30' },
    cyan:   { bg: 'bg-cyan-500',   bgLight: 'bg-cyan-500/20',   border: 'border-cyan-500/40',   text: 'text-cyan-400',   activeBg: 'bg-cyan-500/30' },
    yellow: { bg: 'bg-yellow-500', bgLight: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400', activeBg: 'bg-yellow-500/30' },
    rose:   { bg: 'bg-rose-500',   bgLight: 'bg-rose-500/20',   border: 'border-rose-500/40',   text: 'text-rose-400',   activeBg: 'bg-rose-500/30' },
    pink:   { bg: 'bg-pink-500',   bgLight: 'bg-pink-500/20',   border: 'border-pink-500/40',   text: 'text-pink-400',   activeBg: 'bg-pink-500/30' },
  };
  return map[color] || map.blue;
}

export const MissionShell: React.FC<MissionShellProps> = ({
  missionTitle,
  missionIcon,
  accentColor,
  phases,
  currentPhase,
  currentPhaseIndex,
  onPhaseClick,
  messages,
  isLoading,
  input,
  onInputChange,
  onSend,
  onKeyDown,
  messagesEndRef,
  showExport,
  onShowExport,
  sessionId = '',
  sessionTitle = '',
  exportTopic,
  exportMode,
  documents = [],
  sidebarContent,
  sidebarFooter,
  chatHeader,
  chatEmptyState,
  messageExtra,
  loadingLabel = 'Thinking...',
  inputPlaceholder = 'Type a message...',
  inputIcon,
  activeContextCount = 0,
  children,
}) => {
  const accent = accentClasses(accentColor);

  return (
    <div className="h-full w-full flex war-room-container overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-80 shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        {/* Mission Header */}
        <div className="p-4 border-b border-white/10 wr-mission-accent-bg">
          <div className="flex items-center gap-2 mb-2">
            <i className={`fa ${missionIcon} ${accent.text}`}></i>
            <h3 className="text-sm font-semibold war-room-text-primary">{missionTitle}</h3>
          </div>
          {activeContextCount > 0 && (
            <div className="war-room-badge text-xs mt-2" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <BookOpen className="fa" />
              {activeContextCount} source{activeContextCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Phase Progress */}
        <div className="p-3 border-b border-white/10">
          <div className="space-y-1">
            {phases.map((phase, i) => {
              const isActive = phase.id === currentPhase;
              const isComplete = i < currentPhaseIndex;
              return (
                <button
                  key={phase.id}
                  onClick={() => i <= currentPhaseIndex && onPhaseClick(phase.id)}
                  disabled={i > currentPhaseIndex}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                    isActive
                      ? `${accent.bgLight} border ${accent.border}`
                      : isComplete
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    isComplete
                      ? 'bg-emerald-500 text-white'
                      : isActive
                      ? `${accent.activeBg} ${accent.text}`
                      : 'bg-white/10 text-white/40'
                  }`}>
                    {isComplete ? <Check className="fa" /> : <i className={`fa ${phase.icon}`}></i>}
                  </div>
                  <div className="text-left">
                    <p className={`text-xs font-medium ${isActive ? accent.text : 'war-room-text-primary'}`}>
                      {phase.label}
                    </p>
                    <p className="text-[10px] war-room-text-secondary">{phase.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Phase-specific sidebar content */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-3">
          {sidebarContent}
        </div>

        {/* Sidebar footer (save/export buttons) */}
        {sidebarFooter && (
          <div className="p-3 border-t border-white/10 space-y-2">
            {sidebarFooter}
          </div>
        )}
      </div>

      {/* Right: Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Optional header above chat */}
        {chatHeader}

        {/* Additional children above messages */}
        {children}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-4 space-y-4">
          {messages.length === 0 && chatEmptyState ? (
            chatEmptyState
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] ${
                    msg.role === 'user'
                      ? 'war-room-message-user'
                      : 'war-room-message-ai'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {messageExtra?.(msg, idx)}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="war-room-message-ai">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full ${accent.activeBg} flex items-center justify-center`}>
                    <i className={`fa ${missionIcon} ${accent.text} text-xs animate-pulse`}></i>
                  </div>
                  <span className="text-sm war-room-text-secondary">{loadingLabel}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 war-room-input-area">
          <div className="flex items-center gap-2">
            <div className="flex-1 war-room-panel-inset flex items-center gap-2 px-4 py-3">
              {inputIcon}
              <input
                type="text"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={inputPlaceholder}
                className="flex-1 bg-transparent border-none outline-none text-sm"
                disabled={isLoading}
              />
              <button
                onClick={onSend}
                disabled={!input.trim() || isLoading}
                className={`war-room-btn war-room-btn-icon-sm ${
                  input.trim() ? 'war-room-btn-primary' : ''
                }`}
                aria-label="Send message"
              >
                <Send className="fa text-xs" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExport && (
        <SessionExport
          sessionId={sessionId}
          sessionTitle={sessionTitle || missionTitle}
          messages={messages}
          topic={exportTopic}
          mode={exportMode || missionTitle}
          documents={documents}
          onClose={() => onShowExport(false)}
        />
      )}
    </div>
  );
};
