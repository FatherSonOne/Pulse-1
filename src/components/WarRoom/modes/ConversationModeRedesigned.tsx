import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { VoiceControl } from '../VoiceControl';
import './ConversationModeRedesigned.css';

interface ConversationModeRedesignedProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  isSpeaking: boolean;
  voiceEnabled: boolean;
  voiceMode: 'push-to-talk' | 'always-on' | 'wake-word';
  onToggleVoiceEnabled: (enabled: boolean) => void;
  onChangeVoiceMode: (mode: 'push-to-talk' | 'always-on' | 'wake-word') => void;
  onListeningChange?: (isListening: boolean) => void;
}

interface ConversationNote {
  id: string;
  content: string;
  timestamp: Date;
  type: 'key-point' | 'question' | 'action' | 'insight';
  isNew?: boolean;
}

type VizState = 'idle' | 'listening' | 'thinking' | 'speaking';

const NOTE_TYPES = [
  { id: 'key-point', label: 'Key Point', icon: 'fa-star' },
  { id: 'question', label: 'Question', icon: 'fa-question' },
  { id: 'action', label: 'Action', icon: 'fa-check' },
  { id: 'insight', label: 'Insight', icon: 'fa-lightbulb' },
] as const;

export const ConversationModeRedesigned: React.FC<ConversationModeRedesignedProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  isSpeaking,
  voiceEnabled,
  voiceMode,
  onToggleVoiceEnabled,
  onChangeVoiceMode,
  onListeningChange
}) => {
  const [input, setInput] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState<ConversationNote['type']>('key-point');
  const [notePanelVisible, setNotePanelVisible] = useState(true);
  const [isScribeWriting, setIsScribeWriting] = useState(false);
  const [writingNoteId, setWritingNoteId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notesEndRef = useRef<HTMLDivElement>(null);

  // Get last user and assistant messages
  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  const lastUser = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i];
    }
    return null;
  }, [messages]);

  // Determine visualizer state
  const vizState: VizState = useMemo(() => {
    if (isSpeaking) return 'speaking';
    if (isLoading) return 'thinking';
    if (voiceEnabled && isListening) return 'listening';
    return 'idle';
  }, [isSpeaking, isLoading, voiceEnabled, isListening]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-scroll notes
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes]);

  // Simulate scribe writing when AI responds
  useEffect(() => {
    if (isLoading) {
      setIsScribeWriting(true);
    } else if (lastAssistant && !isLoading) {
      // Auto-capture key point from AI response
      const shouldCapture = Math.random() > 0.6; // 40% chance to auto-capture
      if (shouldCapture && lastAssistant.content.length > 50) {
        const noteId = `note-${Date.now()}`;
        setWritingNoteId(noteId);

        // Extract a snippet as the note
        const snippet = lastAssistant.content.substring(0, 150).split('.')[0] + '...';

        setTimeout(() => {
          setNotes(prev => [...prev, {
            id: noteId,
            content: snippet,
            timestamp: new Date(),
            type: 'insight',
            isNew: true
          }]);
          setWritingNoteId(null);
          setIsScribeWriting(false);

          // Remove "new" status after animation
          setTimeout(() => {
            setNotes(prev => prev.map(n =>
              n.id === noteId ? { ...n, isNew: false } : n
            ));
          }, 2000);
        }, 1500);
      } else {
        setIsScribeWriting(false);
      }
    }
  }, [isLoading, lastAssistant]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
    setCurrentTranscript('');
  }, [input, onSendMessage]);

  const handleAddNote = useCallback(() => {
    if (!newNoteText.trim()) return;

    const noteId = `note-${Date.now()}`;
    setNotes(prev => [...prev, {
      id: noteId,
      content: newNoteText.trim(),
      timestamp: new Date(),
      type: newNoteType,
      isNew: true
    }]);
    setNewNoteText('');

    // Remove "new" status after animation
    setTimeout(() => {
      setNotes(prev => prev.map(n =>
        n.id === noteId ? { ...n, isNew: false } : n
      ));
    }, 2000);
  }, [newNoteText, newNoteType]);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStateText = () => {
    switch (vizState) {
      case 'listening': return 'Listening...';
      case 'thinking': return 'Processing...';
      case 'speaking': return 'Speaking...';
      default: return 'Ready';
    }
  };

  const getOrbIcon = () => {
    switch (vizState) {
      case 'listening': return 'fa-microphone';
      case 'thinking': return 'fa-brain';
      case 'speaking': return 'fa-volume-high';
      default: return 'fa-comments';
    }
  };

  return (
    <div className="cvr-container">
      {/* Ambient Background */}
      <div className="cvr-ambient">
        <div className="cvr-gradient-orbs" />
        <div className="cvr-texture" />
        <div className="cvr-wave-lines" />
        <div className="cvr-listeners">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="cvr-listener-dot" />
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="cvr-layout">
        {/* Left - Conversation Space */}
        <div className="cvr-conversation-space">
          {/* Header */}
          <header className="cvr-header">
            <div className="cvr-header-left">
              <h2 className="cvr-header-title">
                <i className="fa fa-comments" />
                Conversation
              </h2>
              {(isListening || isSpeaking || isLoading) && (
                <div className="cvr-live-badge">
                  <span className="cvr-live-dot" />
                  Live
                </div>
              )}
            </div>
            <div className="cvr-header-actions">
              <button
                onClick={() => setNotePanelVisible(!notePanelVisible)}
                className="cvr-header-btn"
                title="Toggle notes"
              >
                <i className={`fa ${notePanelVisible ? 'fa-sidebar-flip' : 'fa-pen-to-square'}`} />
              </button>
            </div>
          </header>

          {/* Central Visualizer Area */}
          <div className="cvr-visualizer-area">
            {/* Orb Container */}
            <div className={`cvr-orb-container ${vizState !== 'idle' ? 'active' : ''}`}>
              {/* Audio Bars */}
              <div className="cvr-audio-bars">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="cvr-audio-bar" />
                ))}
              </div>

              {/* Orb Rings */}
              <div className="cvr-orb-rings">
                <div className="cvr-orb-ring" />
                <div className="cvr-orb-ring" />
                <div className="cvr-orb-ring" />
              </div>

              {/* Main Orb */}
              <div className={`cvr-orb ${vizState}`}>
                <i className={`fa ${getOrbIcon()} cvr-orb-icon`} />
              </div>

              {/* State Indicator */}
              <div className="cvr-state-indicator">
                <span className={`cvr-state-text ${vizState}`}>
                  {getStateText()}
                </span>
              </div>
            </div>

            {/* Last Exchange Cards */}
            <div className="cvr-exchange-cards">
              {lastUser && (
                <div className="cvr-exchange-card">
                  <p className="cvr-exchange-label">You said</p>
                  <p className="cvr-exchange-text">{lastUser.content}</p>
                </div>
              )}
              {lastAssistant && vizState !== 'thinking' && (
                <div className="cvr-exchange-card">
                  <p className="cvr-exchange-label">Pulse responded</p>
                  <p className="cvr-exchange-text">{lastAssistant.content}</p>
                </div>
              )}
            </div>
          </div>

          {/* Conversation History */}
          {messages.length > 0 && (
            <div className="cvr-history">
              <div className="cvr-history-messages">
                {messages.slice(-6).map((msg, idx) => (
                  <div
                    key={idx}
                    className={`cvr-message ${msg.role === 'user' ? 'cvr-message-user' : 'cvr-message-ai'}`}
                  >
                    {msg.content}
                  </div>
                ))}

                {/* Interim transcript */}
                {currentTranscript && (
                  <div className="cvr-message cvr-message-user cvr-interim">
                    {currentTranscript}...
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="cvr-input-area">
            <div className="cvr-input-wrapper">
              {/* Voice Controls */}
              <div className="cvr-voice-controls">
                <VoiceControl
                  enabled={voiceEnabled}
                  mode={voiceMode}
                  wakeWord="hey pulse"
                  onTranscript={(text, isFinal) => {
                    if (isFinal) {
                      setInput(text);
                      setCurrentTranscript('');
                      setTimeout(() => {
                        onSendMessage(text);
                        setInput('');
                      }, 100);
                    } else {
                      setCurrentTranscript(text);
                    }
                  }}
                  onCommand={() => {}}
                  onListeningChange={(listening) => {
                    setIsListening(listening);
                    onListeningChange?.(listening);
                  }}
                  onAudioLevel={setMicLevel}
                  variant="compact"
                  onToggleEnabled={onToggleVoiceEnabled}
                  onChangeMode={onChangeVoiceMode}
                />
              </div>

              {/* Text Input */}
              <div className="cvr-input-container">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type your message..."
                  className="cvr-input"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={`cvr-send-btn ${input.trim() ? 'active' : ''}`}
                >
                  <i className="fa fa-paper-plane" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Notes Panel */}
        <aside className={`cvr-notes-panel ${notePanelVisible ? 'visible' : ''}`}>
          {/* Notes Header */}
          <div className="cvr-notes-header">
            <div className="cvr-notes-title">
              <i className="fa fa-pen-fancy" />
              Session Notes
              {notes.length > 0 && (
                <span className="cvr-notes-count">{notes.length}</span>
              )}
            </div>
            <div className="cvr-notes-actions">
              <button className="cvr-notes-btn" title="Export notes">
                <i className="fa fa-download" />
              </button>
              <button
                className="cvr-notes-btn"
                onClick={() => setNotePanelVisible(false)}
                title="Close panel"
              >
                <i className="fa fa-times" />
              </button>
            </div>
          </div>

          {/* Scribe Status */}
          <div className="cvr-scribe-status">
            <div className={`cvr-scribe-avatar ${isScribeWriting ? 'writing' : ''}`}>
              <i className="fa fa-feather-pointed" />
            </div>
            <div className="cvr-scribe-info">
              <div className="cvr-scribe-name">Session Scribe</div>
              <div className={`cvr-scribe-state ${isScribeWriting ? 'writing' : ''}`}>
                {isScribeWriting ? (
                  <>
                    <span>Taking notes</span>
                    <div className="cvr-writing-indicator">
                      <span className="cvr-writing-dot" />
                      <span className="cvr-writing-dot" />
                      <span className="cvr-writing-dot" />
                    </div>
                  </>
                ) : (
                  <span>Listening attentively</span>
                )}
              </div>
            </div>
          </div>

          {/* Notes List */}
          <div className="cvr-notes-list">
            {notes.length === 0 && !writingNoteId ? (
              <div className="cvr-notes-empty">
                <i className="fa fa-pen-to-square" />
                <p>No notes yet</p>
                <span>The scribe will capture key moments</span>
              </div>
            ) : (
              <>
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`cvr-note-card ${note.isNew ? 'new' : ''}`}
                  >
                    <div className="cvr-note-header">
                      <span className="cvr-note-time">{formatTime(note.timestamp)}</span>
                      <div className="cvr-note-actions">
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="cvr-note-action-btn"
                          title="Delete note"
                        >
                          <i className="fa fa-times" />
                        </button>
                      </div>
                    </div>
                    <div className={`cvr-note-content ${note.isNew ? 'cvr-note-writing' : ''}`}>
                      {note.content}
                    </div>
                    <span className={`cvr-note-type ${note.type}`}>
                      <i className={`fa ${NOTE_TYPES.find(t => t.id === note.type)?.icon}`} />
                      {NOTE_TYPES.find(t => t.id === note.type)?.label}
                    </span>
                  </div>
                ))}

                {/* Writing placeholder */}
                {writingNoteId && (
                  <div className="cvr-note-card new">
                    <div className="cvr-note-header">
                      <span className="cvr-note-time">Now</span>
                    </div>
                    <div className="cvr-note-content cvr-note-writing">
                      Capturing insight
                    </div>
                  </div>
                )}

                <div ref={notesEndRef} />
              </>
            )}
          </div>

          {/* Add Note Section */}
          <div className="cvr-add-note">
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              placeholder="Add a manual note..."
              className="cvr-add-note-input"
            />
            <div className="cvr-add-note-footer">
              <div className="cvr-note-type-selector">
                {NOTE_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setNewNoteType(type.id as ConversationNote['type'])}
                    className={`cvr-type-btn ${newNoteType === type.id ? 'active' : ''}`}
                    title={type.label}
                  >
                    <i className={`fa ${type.icon}`} />
                  </button>
                ))}
              </div>
              <button
                onClick={handleAddNote}
                disabled={!newNoteText.trim()}
                className="cvr-add-note-btn"
              >
                <i className="fa fa-plus" style={{ marginRight: '0.375rem' }} />
                Add Note
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ConversationModeRedesigned;
