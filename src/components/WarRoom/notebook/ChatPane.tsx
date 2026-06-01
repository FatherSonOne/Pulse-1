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
import { EmptyState } from './EmptyState';

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

  return (
    <>
      {/* Transcript or teaching cold-start */}
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
