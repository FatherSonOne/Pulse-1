import React, { useMemo, useState } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { VoiceControl } from '../VoiceControl';
import { VoiceAgentVisualizerEnhanced } from '../VoiceAgentVisualizerEnhanced';

interface ElegantInterfaceProps {
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

type VizState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const ElegantInterface: React.FC<ElegantInterfaceProps> = ({
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

  const vizState: VizState = useMemo(() => {
    if (isSpeaking) return 'speaking';
    if (isLoading) return 'thinking';
    if (voiceEnabled && isListening) return 'listening';
    return 'idle';
  }, [isSpeaking, isLoading, voiceEnabled, isListening]);

  // Determine thinking text
  const thinkingText = isLoading ? 'Processing your request...' : '';

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
    setCurrentTranscript('');
  };

  return (
    <div className="h-full w-full flex flex-col war-room-container overflow-hidden">
      {/* Visualizer Area - enhanced with audio-responsive pulsating rings */}
      <div className="flex-1 relative overflow-hidden">
        <VoiceAgentVisualizerEnhanced
          isListening={isListening}
          isSpeaking={isSpeaking}
          isThinking={isLoading}
          audioLevel={micLevel}
          thinkingText={thinkingText}
          transcriptText={currentTranscript}
        />

        {/* Last exchange overlay - centered */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className="text-center space-y-3 px-4 mt-32">
            {lastUser && (
              <div className="war-room-panel max-w-md px-6 py-3">
                <p className="text-xs war-room-text-secondary mb-1">You asked:</p>
                <p className="text-sm line-clamp-2">
                  {lastUser.content}
                </p>
              </div>
            )}
            {lastAssistant && vizState !== 'thinking' && (
              <div className="war-room-panel max-w-md px-6 py-3">
                <p className="text-xs war-room-text-secondary mb-1">Pulse said:</p>
                <p className="text-sm line-clamp-3">
                  {lastAssistant.content}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversation History (Bottom) - matches Pulse Chat */}
      {messages.length > 0 && (
        <div className="shrink-0 max-h-48 overflow-y-auto war-room-input-area p-4 war-room-scrollbar">
          <div className="space-y-2">
            {messages.slice(-5).map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 ${
                    msg.role === 'user'
                      ? 'war-room-message-user'
                      : 'war-room-message-ai'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Current interim transcript */}
            {currentTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[80%] px-4 py-2 war-room-message-user opacity-60">
                  <p className="text-sm italic">{currentTranscript}...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Input Bar with mic/audio controls */}
      <div className="shrink-0 p-4 war-room-input-area">
        <div className="w-full max-w-3xl mx-auto flex items-center gap-3">
          {/* Voice Control (Compact) */}
          <VoiceControl
            enabled={voiceEnabled}
            mode={voiceMode}
            wakeWord="hey pulse"
            onTranscript={(text, isFinal) => {
              if (isFinal) {
                setInput(text);
                setCurrentTranscript('');
                // Auto-send on final transcript
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

          {/* Input with Nothing style */}
          <div className="flex-1 war-room-panel-inset flex items-center gap-2 px-4 py-2">
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
              className="flex-1 bg-transparent border-none outline-none text-sm"
            />

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`war-room-btn war-room-btn-icon-sm ${input.trim() ? 'war-room-btn-primary' : ''}`}
            >
              <i className="fa fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
