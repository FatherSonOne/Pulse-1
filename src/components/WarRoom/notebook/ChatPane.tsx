/**
 * ChatPane — center column of the Notebook, built to the mockup.
 *
 * Masthead (session title + Analyst/agent selector + deep-think toggle) over
 * the transcript (MessageList) / teaching EmptyState, the docked realtime voice
 * (DockedVoice), and the Composer. Takes the same props as PulseStudio so
 * LiveDashboard swaps <PulseStudio> → <ChatPane> with no rewiring; session title
 * + voice state are read from the store.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AGENTS } from '../AgentSelector';
import { settingsService } from '../../../services/settingsService';
import type { PulseStudioProps } from '../PulseStudio';
import { KnowledgeDoc } from '../../../services/ragService';
import { useWarRoomStore } from '../../../store/warRoomStore';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { DockedVoice } from './DockedVoice';
import { EmptyState } from './EmptyState';

import { Brain, Check, ChevronDown, MessageSquare, Share2 } from 'lucide-react';

export interface ChatPaneProps extends PulseStudioProps {
  /** Threaded from LiveDashboard for the docked realtime voice agent. */
  voiceUserId?: string;
  openaiApiKey?: string;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  selectedSessionId,
  messages,
  isLoading,
  thinkingLogs,
  input,
  setInput,
  onSendMessage,
  onSendDirect,
  activeAgent,
  setActiveAgent,
  documents,
  activeContextDocs,
  voiceEnabled,
  setVoiceEnabled,
  voiceMode,
  enableExtendedThinking,
  setEnableExtendedThinking,
  expandedThinking,
  toggleThinking,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  handleUseSuggestion,
  onToggleSources,
  onToggleArtifacts,
  sourcesOpen,
  artifactsOpen,
  onUploadClick,
  onPinArtifact,
  voiceUserId,
  openaiApiKey = '',
}) => {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const selectedAgent = AGENTS.find((a) => a.id === activeAgent) || AGENTS[0];
  const hasMessages = safeMessages.length > 0;
  const activeDocCount = activeContextDocs.size;

  // ── Session title for the masthead ───────────────────────────────────────
  const sessions = useWarRoomStore((s) => s.sessions);
  const session = sessions.find((s) => s.id === selectedSessionId);

  // ── Citation open → DocumentViewer w/ passage highlight ──────────────────
  const setViewingDoc = useWarRoomStore((s) => s.setViewingDoc);
  const setViewerHighlightText = useWarRoomStore((s) => s.setViewerHighlightText);
  const openCitation = useCallback(
    (doc: KnowledgeDoc, passage?: string) => {
      setViewingDoc(doc);
      setViewerHighlightText(passage);
    },
    [setViewingDoc, setViewerHighlightText],
  );

  // ── Docked realtime voice agent ──────────────────────────────────────────
  const showVoiceAgentPanel = useWarRoomStore((s) => s.showVoiceAgentPanel);
  const voiceAgentExpanded = useWarRoomStore((s) => s.voiceAgentExpanded);
  const setShowVoiceAgentPanel = useWarRoomStore((s) => s.setShowVoiceAgentPanel);
  const setVoiceAgentExpanded = useWarRoomStore((s) => s.setVoiceAgentExpanded);
  const selectedProjectId = useWarRoomStore((s) => s.selectedProjectId);
  const setShowExportModal = useWarRoomStore((s) => s.setShowExportModal);

  // ── Agent menu ───────────────────────────────────────────────────────────
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const agentMenuRef = useRef<HTMLDivElement>(null);
  const agentBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!agentMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        agentMenuRef.current && !agentMenuRef.current.contains(e.target as Node) &&
        agentBtnRef.current && !agentBtnRef.current.contains(e.target as Node)
      ) {
        setAgentMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [agentMenuOpen]);

  return (
    <>
      {/* ── Masthead ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--pulse-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <MessageSquare size={16} style={{ color: 'var(--pulse-rose)', flexShrink: 0 }} />
          <div style={{ minWidth: 0, lineHeight: 1.25 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--pulse-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session?.title || 'War Room'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--pulse-ink-3)' }}>
              {selectedSessionId ? 'session' : 'Pick or start a session'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Agent (Analyst) selector */}
          <div style={{ position: 'relative' }}>
            <button
              ref={agentBtnRef}
              onClick={() => setAgentMenuOpen((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--pulse-ink-2)',
                border: '1px solid var(--pulse-border)',
                background: agentMenuOpen ? 'var(--pulse-surface-raised)' : 'transparent',
                cursor: 'pointer',
              }}
              title={`Agent: ${selectedAgent.name}`}
            >
              <i className={`fa ${selectedAgent.icon}`} style={{ color: 'var(--pulse-coral-fg)', fontSize: 12 }} />
              <span>{selectedAgent.name}</span>
              <ChevronDown size={12} style={{ opacity: 0.5 }} />
            </button>
            {agentMenuOpen && (
              <div
                ref={agentMenuRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  width: 220,
                  zIndex: 50,
                  padding: 4,
                  borderRadius: 10,
                  background: 'var(--pulse-surface)',
                  border: '1px solid var(--pulse-border-strong)',
                  boxShadow: 'var(--pulse-shadow-modal, 0 8px 24px rgba(0,0,0,0.25))',
                }}
              >
                {AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setActiveAgent(agent.id);
                      settingsService.set('liveBoardSelectedAgent', agent.id);
                      setAgentMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: 7,
                      background: activeAgent === agent.id ? 'var(--pulse-surface-raised)' : 'transparent',
                      color: activeAgent === agent.id ? 'var(--pulse-ink)' : 'var(--pulse-ink-2)',
                      cursor: 'pointer',
                      fontSize: 13,
                      textAlign: 'left',
                    }}
                  >
                    <i className={`fa ${agent.icon}`} style={{ width: 16, textAlign: 'center', color: 'var(--pulse-ink-3)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{agent.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--pulse-ink-3)', marginTop: 1 }}>{agent.description}</div>
                    </div>
                    {activeAgent === agent.id && <Check size={14} style={{ color: 'var(--pulse-coral-fg)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Deep-think toggle */}
          <button
            onClick={() => setEnableExtendedThinking(!enableExtendedThinking)}
            title={enableExtendedThinking ? 'Deep thinking on' : 'Enable deep thinking'}
            style={{
              width: 30,
              height: 30,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: '1px solid var(--pulse-border)',
              background: enableExtendedThinking ? 'var(--pulse-coral-bg-12)' : 'transparent',
              color: enableExtendedThinking ? 'var(--pulse-coral-fg)' : 'var(--pulse-ink-3)',
              cursor: 'pointer',
            }}
          >
            <Brain size={15} />
          </button>

          {/* Export session */}
          {hasMessages && (
            <button
              onClick={() => setShowExportModal(true)}
              title="Export session"
              style={{
                width: 30,
                height: 30,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: '1px solid var(--pulse-border)',
                background: 'transparent',
                color: 'var(--pulse-ink-3)',
                cursor: 'pointer',
              }}
            >
              <Share2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Transcript or teaching cold-start ─────────────────────────────── */}
      {!hasMessages && !isLoading ? (
        <EmptyState
          documents={documents}
          activeDocCount={activeDocCount}
          onUploadClick={onUploadClick}
          onSendDirect={onSendDirect}
          suggestions={suggestions}
          handleUseSuggestion={handleUseSuggestion}
        />
      ) : (
        <MessageList
          messages={safeMessages}
          isLoading={isLoading}
          thinkingLogs={thinkingLogs}
          expandedThinking={expandedThinking}
          toggleThinking={toggleThinking}
          agentName={selectedAgent.name}
          onPinArtifact={onPinArtifact}
          documents={documents}
          onOpenCitation={openCitation}
        />
      )}

      {/* ── Docked realtime voice agent ───────────────────────────────────── */}
      {showVoiceAgentPanel && (
        <DockedVoice
          userId={voiceUserId || ''}
          projectId={selectedProjectId || undefined}
          sessionId={selectedSessionId || undefined}
          openaiApiKey={openaiApiKey}
          documents={documents}
          activeContextIds={activeContextDocs}
          expanded={voiceAgentExpanded}
          onToggleExpand={() => setVoiceAgentExpanded(!voiceAgentExpanded)}
          onClose={() => setShowVoiceAgentPanel(false)}
        />
      )}

      {/* ── Composer — always visible; first send lazily creates a session ──── */}
      {
        <Composer
          input={input}
          setInput={setInput}
          isLoading={isLoading}
          onSendMessage={onSendMessage}
          onSendDirect={onSendDirect}
          activeAgent={activeAgent}
          setActiveAgent={setActiveAgent}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          handleUseSuggestion={handleUseSuggestion}
          onUploadClick={onUploadClick}
          activeDocCount={activeDocCount}
          hasDocuments={documents.length > 0}
          voiceDockOpen={showVoiceAgentPanel}
          onToggleVoiceDock={() => setShowVoiceAgentPanel(!showVoiceAgentPanel)}
        />
      }
    </>
  );
};

export default ChatPane;
