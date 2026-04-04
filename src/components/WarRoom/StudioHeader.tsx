/**
 * StudioHeader — Clean, on-brand header for Pulse Studio.
 * Replaces the tactical WarRoomHeader with a minimal, approachable design.
 */

import React from 'react';
import {
  Activity, BookOpen, Brain, Database, Download,
  Headphones, Mic, Share2, Volume2,
} from 'lucide-react';
import { AIProject, AISession, AIMessage } from '../../services/ragService';
import { AgentType } from './AgentSelector';
import { PresenceAvatars } from './Collaboration/PresenceAvatars';

interface StudioHeaderProps {
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
  voiceSynthesisEnabled: boolean;
  setVoiceSynthesisEnabled: (v: boolean) => void;
  activeAgent: AgentType;
  setActiveAgent: (v: AgentType) => void;
  isGeneratingAudio: boolean;
  handleGenerateAudioOverview: () => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  selectedProject,
  selectedSessionId,
  sessions,
  isMobile,
  contextPanelOpen,
  setContextPanelOpen,
  activeContextDocs,
  showVoiceAgentPanel,
  setShowVoiceAgentPanel,
  messages,
  setShowExportModal,
  voiceEnabled,
  setVoiceEnabled,
  enableExtendedThinking,
  setEnableExtendedThinking,
  voiceSynthesisEnabled,
  setVoiceSynthesisEnabled,
  activeAgent,
  setActiveAgent,
  isGeneratingAudio,
  handleGenerateAudioOverview,
}) => {
  return (
    <div className="ps-header">
      {/* Left: Logo + Title */}
      <div className="ps-header-title">
        <div className="ps-logo">
          <BookOpen size={15} />
        </div>
        <span>Studio</span>

        {/* Project badge */}
        {selectedProject && !isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 'var(--ps-radius-full)',
            background: 'var(--ps-bg-elevated)',
            border: '1px solid var(--ps-border)',
            fontSize: 12,
            color: 'var(--ps-text-secondary)',
          }}>
            <i className={`fa ${selectedProject.icon || 'fa-folder'}`} style={{ color: selectedProject.color || 'var(--ps-accent)' }} />
            {selectedProject.name}
          </div>
        )}

        {/* Session name */}
        {selectedSessionId && !isMobile && (
          <span style={{ fontSize: 12, color: 'var(--ps-text-muted)' }}>
            {sessions.find(s => s.id === selectedSessionId)?.title}
          </span>
        )}
      </div>

      {/* Center: Presence */}
      <PresenceAvatars />

      {/* Right: Actions */}
      <div className="ps-header-actions">
        {/* Sources toggle */}
        <button
          className={`ps-icon-btn ${contextPanelOpen ? 'ps-icon-btn--active' : ''}`}
          onClick={() => setContextPanelOpen(v => !v)}
          title="Toggle sources panel"
          style={{ position: 'relative' }}
        >
          <Database size={15} />
          {activeContextDocs.size > 0 && (
            <span style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'var(--ps-accent)',
              color: 'white',
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {activeContextDocs.size}
            </span>
          )}
        </button>

        {/* Voice Agent */}
        <button
          className={`ps-icon-btn ${showVoiceAgentPanel ? 'ps-icon-btn--active' : ''}`}
          onClick={() => setShowVoiceAgentPanel(true)}
          title="Voice Agent"
        >
          <Activity size={15} />
        </button>

        {/* Export */}
        {messages.length > 0 && (
          <button
            className="ps-icon-btn"
            onClick={() => setShowExportModal(true)}
            title="Export session"
          >
            <Share2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
};

export default StudioHeader;
