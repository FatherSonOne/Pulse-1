/**
 * ChatPane — center pane of the Notebook shell (handoff Phase 2).
 *
 * Composes the chat surface from the ported MessageList + Composer, preserving
 * full PulseStudio parity (message render, slash/@ commands, suggestion chips,
 * agent selector, focus timer, pin-to-board, voice input, real-time send with
 * subscription dedup). Takes the same props as PulseStudio so LiveDashboard
 * swaps `<PulseStudio>` → `<ChatPane>` on the flag-ON path with no rewiring.
 *
 * The welcome screen is ported as-is here; Phase 7 supersedes it with the
 * teaching EmptyState. Voice currently uses the inline VoiceControl + the
 * floating VoiceAgentPanel; Phase 6 docks the realtime agent into this pane.
 */

import React, { useCallback } from 'react';
import '../PulseStudio.css';
import { AGENTS } from '../AgentSelector';
import type { PulseStudioProps } from '../PulseStudio';
import { KnowledgeDoc } from '../../../services/ragService';
import { useWarRoomStore } from '../../../store/warRoomStore';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { DockedVoice } from './DockedVoice';

import { ArrowRight, BookOpen } from 'lucide-react';

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
  const hasDocuments = documents.length > 0;
  const activeDocCount = activeContextDocs.size;

  // ── Citation open → DocumentViewer w/ passage highlight ───────────────────
  // Reuses the canonical store flow (already wired end-to-end via
  // WarRoomModalStack: viewingDoc → DocumentViewer, viewerHighlightText → scroll).
  const setViewingDoc = useWarRoomStore((s) => s.setViewingDoc);
  const setViewerHighlightText = useWarRoomStore((s) => s.setViewerHighlightText);
  const openCitation = useCallback(
    (doc: KnowledgeDoc, passage?: string) => {
      setViewingDoc(doc);
      setViewerHighlightText(passage);
    },
    [setViewingDoc, setViewerHighlightText],
  );

  // ── Docked realtime voice agent (re-homed from the floating panel) ───────────
  const showVoiceAgentPanel = useWarRoomStore((s) => s.showVoiceAgentPanel);
  const voiceAgentExpanded = useWarRoomStore((s) => s.voiceAgentExpanded);
  const setShowVoiceAgentPanel = useWarRoomStore((s) => s.setShowVoiceAgentPanel);
  const setVoiceAgentExpanded = useWarRoomStore((s) => s.setVoiceAgentExpanded);
  const selectedProjectId = useWarRoomStore((s) => s.selectedProjectId);

  // ── Welcome Screen (Phase 7 → EmptyState) ───────────────────────────────
  const renderWelcome = () => {
    const previewNames = documents.slice(0, 3).map((d) => d.title);
    const overflow = documents.length - previewNames.length;

    return (
      <div className="ps-welcome">
        <div className="ps-welcome-logo">
          <BookOpen size={20} />
        </div>

        <h2>War Room</h2>

        {hasDocuments ? (
          <>
            <div className="ps-welcome-label">
              {documents.length} source{documents.length !== 1 ? 's' : ''} ready
              {activeDocCount > 0 && ` · ${activeDocCount} active`}
            </div>
            <div className="ps-welcome-list">
              {previewNames.join(' · ')}
              {overflow > 0 && ` · +${overflow} more`}
            </div>
            <button
              className="ps-welcome-cta"
              onClick={() => onSendDirect('/summarize Summarize the key points from my sources')}
            >
              {documents.length === 1 ? 'Summarize this source' : 'Summarize all sources'}
              <ArrowRight size={14} />
            </button>
            <div className="ps-welcome-hint">
              <span>/summarize</span>
              <span aria-hidden>·</span>
              <span>/analyze</span>
              <span aria-hidden>·</span>
              <span>/brainstorm</span>
              <span aria-hidden>·</span>
              <kbd>⌘K</kbd>
              <span>for more</span>
            </div>
          </>
        ) : (
          <>
            <div className="ps-welcome-label">No sources yet</div>
            <div className="ps-welcome-list">Add a document, or start a conversation on any topic.</div>
            {onUploadClick && (
              <button className="ps-welcome-cta" onClick={onUploadClick}>
                Add a source
                <ArrowRight size={14} />
              </button>
            )}
            <div className="ps-welcome-hint">
              <span>type</span>
              <kbd>/</kbd>
              <span>for commands</span>
              <span aria-hidden>·</span>
              <kbd>⌘K</kbd>
              <span>for the palette</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Transcript or welcome */}
      {!hasMessages && !isLoading ? (
        renderWelcome()
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

      {/* Docked realtime voice agent — inline, grounded on the same context */}
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

      {/* Composer */}
      {selectedSessionId && (
        <Composer
          input={input}
          setInput={setInput}
          isLoading={isLoading}
          onSendMessage={onSendMessage}
          onSendDirect={onSendDirect}
          activeAgent={activeAgent}
          setActiveAgent={setActiveAgent}
          voiceEnabled={voiceEnabled}
          setVoiceEnabled={setVoiceEnabled}
          voiceMode={voiceMode}
          enableExtendedThinking={enableExtendedThinking}
          setEnableExtendedThinking={setEnableExtendedThinking}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          handleUseSuggestion={handleUseSuggestion}
          onToggleSources={onToggleSources}
          onToggleArtifacts={onToggleArtifacts}
          sourcesOpen={sourcesOpen}
          artifactsOpen={artifactsOpen}
          onUploadClick={onUploadClick}
          activeDocCount={activeDocCount}
          hasDocuments={hasDocuments}
        />
      )}
    </>
  );
};

export default ChatPane;
