import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { PomodoroTimer, TopicLock, SessionExport } from '../shared';
import { VoiceAgentVisualizerEnhanced } from '../VoiceAgentVisualizerEnhanced';
import { VoiceControl } from '../VoiceControl';
import { MarkdownRenderer } from '../../shared/MarkdownRenderer';

interface FocusModeProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
  isSpeaking?: boolean;
  voiceEnabled?: boolean;
  voiceMode?: 'push-to-talk' | 'always-on' | 'wake-word';
  onToggleVoiceEnabled?: (enabled: boolean) => void;
  onChangeVoiceMode?: (mode: 'push-to-talk' | 'always-on' | 'wake-word') => void;
  onListeningChange?: (isListening: boolean) => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Focus Session',
  documents = [],
  isSpeaking = false,
  voiceEnabled = false,
  voiceMode = 'push-to-talk',
  onToggleVoiceEnabled,
  onChangeVoiceMode,
  onListeningChange
}) => {
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState('');
  const [isTopicLocked, setIsTopicLocked] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  const handleSend = () => {
    const message = input.trim();
    if (!message) return;

    // Check topic lock compliance
    const checker = (window as any).__checkTopicLock;
    if (checker && !checker(message)) {
      // Topic lock will show warning
      return;
    }

    onSendMessage(message);
    setInput('');
    setCurrentTranscript('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSessionComplete = (type: 'work' | 'break') => {
    if (type === 'work') {
      setSessionsCompleted(s => s + 1);
    }
  };

  const handleOffTopicAttempt = (message: string, lockedTopic: string) => {
    // Could send this to AI to gently redirect
    console.log('Off-topic attempt:', message, 'Topic:', lockedTopic);
  };

  // Generate focus-specific system prompt enhancement
  const getFocusPrompt = (): string => {
    let prompt = '';
    if (topic && isTopicLocked) {
      prompt = `[FOCUS MODE ACTIVE - Topic: "${topic}"]
The user is in a focused deep work session about "${topic}".
- Keep responses concise and directly relevant to the topic
- If the user goes off-topic, gently redirect them back to "${topic}"
- Prioritize actionable, practical information
- Minimize tangents and unnecessary details`;
    }
    return prompt;
  };

  return (
    <div className={`h-full w-full flex flex-col war-room-container overflow-hidden transition-all duration-500 ${
      isZenMode ? 'bg-black' : ''
    }`}>
      {/* Top Control Bar - Hidden in Zen Mode */}
      {!isZenMode && (
        <div className="shrink-0 p-3 flex items-center justify-between border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-4">
            {/* Timer */}
            <PomodoroTimer
              compact
              onSessionComplete={handleSessionComplete}
            />

            {/* Topic Lock */}
            <TopicLock
              compact
              topic={topic}
              isLocked={isTopicLocked}
              onTopicChange={setTopic}
              onLockChange={setIsTopicLocked}
              onOffTopicAttempt={handleOffTopicAttempt}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Session Stats */}
            {sessionsCompleted > 0 && (
              <span className="war-room-badge text-xs mr-2">
                <i className="fa fa-fire mr-1 text-orange-400"></i>
                {sessionsCompleted}
              </span>
            )}

            {/* Zen Mode Toggle */}
            <button
              onClick={() => setIsZenMode(!isZenMode)}
              className={`war-room-btn war-room-btn-icon-sm ${isZenMode ? 'bg-rose-500/20 text-rose-400' : ''}`}
              title="Toggle Zen Mode"
            >
              <i className={`fa ${isZenMode ? 'fa-sun' : 'fa-moon'} text-xs`}></i>
            </button>

            {/* Export */}
            <button
              onClick={() => setShowExport(true)}
              className="war-room-btn war-room-btn-icon-sm"
              title="Export session"
            >
              <i className="fa fa-share-nodes text-xs"></i>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Visual Focus Area */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          {/* Background Visualizer (enhanced with audio-responsive rings) */}
          <div className={`absolute inset-0 transition-opacity duration-500 ${isZenMode ? 'opacity-40' : 'opacity-70'}`}>
            <VoiceAgentVisualizerEnhanced
              isListening={isListening}
              isSpeaking={isSpeaking}
              isThinking={isLoading}
              audioLevel={micLevel}
              thinkingText={isLoading ? 'Thinking...' : ''}
              transcriptText={currentTranscript}
            />
          </div>

          {/* Focus Content Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {/* Locked Topic Display */}
            {topic && isTopicLocked && !isZenMode && (
              <div className="mb-8 war-room-panel px-6 py-3 bg-rose-500/10 border-rose-500/30">
                <div className="flex items-center gap-2 text-rose-300">
                  <i className="fa fa-crosshairs"></i>
                  <span className="font-medium">{topic}</span>
                  <i className="fa fa-lock text-xs opacity-50"></i>
                </div>
              </div>
            )}

            {/* Last Response - Clean and centered with markdown */}
            {lastAssistant && !isLoading && (
              <div className={`max-w-2xl mx-auto transition-all duration-500 ${
                isZenMode ? 'text-white/80' : ''
              }`}>
                <div className={`war-room-panel p-6 text-left ${isZenMode ? 'bg-white/5 border-white/10' : ''}`}>
                  <MarkdownRenderer
                    content={lastAssistant.content}
                    className={isZenMode ? 'zen-mode-text' : 'dark:text-white'}
                  />

                  {/* Citations */}
                  {lastAssistant.citations && lastAssistant.citations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {lastAssistant.citations.map((c: any, i: number) => (
                          <span key={i} className="war-room-badge text-xs">
                            <i className="fa fa-book-open mr-1"></i>
                            {c.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center animate-pulse">
                  <i className="fa fa-brain text-2xl text-rose-400"></i>
                </div>
                <p className="war-room-text-secondary">Thinking deeply...</p>
              </div>
            )}

            {/* Empty State */}
            {messages.length === 0 && !isLoading && (
              <div className={`text-center ${isZenMode ? 'text-white/60' : 'war-room-text-secondary'}`}>
                <i className="fa fa-leaf text-4xl mb-4 opacity-30"></i>
                <p className="text-lg mb-2">Focus Mode</p>
                <p className="text-sm opacity-70">
                  Set a topic, start the timer, and begin your deep work session
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Conversation History - Minimal, collapsible */}
        {messages.length > 0 && !isZenMode && (
          <div className="shrink-0 max-h-48 overflow-y-auto war-room-scrollbar border-t border-white/10 bg-black/20 p-3">
            <div className="space-y-3">
              {messages.slice(-6).map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-rose-500/20 text-rose-100'
                        : 'bg-white/5'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content} className="text-sm" />
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area - Clean and minimal */}
      <div className={`shrink-0 p-4 transition-all duration-500 ${
        isZenMode ? 'bg-transparent' : 'war-room-input-area'
      }`}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {/* Voice Control */}
          {voiceEnabled !== undefined && (
            <VoiceControl
              enabled={voiceEnabled}
              mode={voiceMode}
              wakeWord="hey pulse"
              variant="compact"
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
              onToggleEnabled={onToggleVoiceEnabled}
              onChangeMode={onChangeVoiceMode}
            />
          )}

          {/* Text Input */}
          <div className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${
            isZenMode
              ? 'bg-white/5 border border-white/10 focus-within:border-white/30'
              : 'war-room-panel-inset'
          }`}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={topic && isTopicLocked ? `Ask about ${topic}...` : 'What are you working on?'}
              className={`flex-1 bg-transparent border-none outline-none text-sm ${
                isZenMode ? 'text-white placeholder-white/40' : ''
              }`}
              disabled={isLoading}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`war-room-btn war-room-btn-icon-sm ${
                input.trim() ? 'war-room-btn-primary' : ''
              }`}
            >
              <i className="fa fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>

        {/* Zen Mode Controls */}
        {isZenMode && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <PomodoroTimer compact onSessionComplete={handleSessionComplete} />
            <button
              onClick={() => setIsZenMode(false)}
              className="war-room-btn text-xs px-3 py-1 opacity-50 hover:opacity-100"
            >
              <i className="fa fa-sun mr-1"></i>
              Exit Zen
            </button>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExport && (
        <SessionExport
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          messages={messages}
          topic={isTopicLocked ? topic : undefined}
          mode="Focus Mode"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
