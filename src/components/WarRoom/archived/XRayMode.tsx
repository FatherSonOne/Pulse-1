import React, { useState, useRef, useEffect } from 'react';
import { AIMessage, ThinkingStep } from '../../services/ragService';
import { TokenStream } from '../TokenStream';

interface Token {
  text: string;
  confidence: number;
  alternatives?: string[];
  timestamp: number;
}

interface XRayModeProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  currentTokens?: Token[];
  isStreaming?: boolean;
}

export const XRayMode: React.FC<XRayModeProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  currentTokens = [],
  isStreaming = false
}) => {
  const [input, setInput] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [neuralActivity, setNeuralActivity] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activityEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [neuralActivity]);

  useEffect(() => {
    if (isLoading) {
      const activities = [
        '🔍 Tokenizing input query...',
        '🧮 Generating query embedding...',
        '📚 Searching knowledge base...',
        '🎯 Matching document chunks...',
        '🔗 Building context window...',
        '🤖 Generating response...',
        '✓ Response complete'
      ];

      let index = 0;
      const interval = setInterval(() => {
        if (index < activities.length) {
          setNeuralActivity(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${activities[index]}`]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 300);

      return () => clearInterval(interval);
    }
  }, [isLoading]);

  const handleSubmit = () => {
    if (input.trim()) {
      setNeuralActivity([]);
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const lastMessage = messages[messages.length - 1];
  const lastThinking = lastMessage ? thinkingLogs.get(lastMessage.id) : undefined;

  return (
    <div className="h-full min-h-0 bg-white dark:bg-black flex flex-col md:flex-row overflow-hidden">
      {/* Left Panel - Conversation (full width on mobile) */}
      <div className="flex-1 md:w-2/3 flex flex-col border-b md:border-b-0 md:border-r border-gray-200 dark:border-rose-500/30 min-h-0">
        {/* Header */}
        <div className="px-3 md:px-4 py-2 md:py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-rose-500/30 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-rose-600 dark:text-rose-400 font-mono text-xs md:text-sm font-bold">CONVERSATION</h3>
              <p className="text-xs text-gray-500 mt-0.5 hidden md:block">Public-facing interaction</p>
            </div>
            <div className="text-xs text-rose-600 dark:text-rose-400 font-bold">{messages.length} msgs</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4 min-h-0 font-mono text-sm">
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              onClick={() => setSelectedMessage(msg.id)}
              className={`cursor-pointer transition-all ${
                selectedMessage === msg.id ? 'ring-2 ring-rose-500 rounded-lg' : ''
              }`}
            >
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] md:max-w-[85%] px-3 md:px-4 py-2 md:py-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-cyan-50 dark:bg-blue-700/20 border border-cyan-200 dark:border-blue-500/30 text-cyan-800 dark:text-blue-200'
                    : 'bg-rose-50 dark:bg-rose-600/25 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-100'
                }`}>
                  <div className="text-xs opacity-70 mb-1 font-bold">
                    {msg.role === 'user' ? 'USER' : 'AI'}
                  </div>
                  <div className="text-sm">{msg.content}</div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="text-xs mt-2 opacity-60">
                      Sources: {msg.citations.map((c: any) => c.title).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-rose-50 dark:bg-rose-600/20 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-bold">PROCESSING...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-2 md:p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-rose-500/30 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter query..."
              className="flex-1 px-3 md:px-4 py-2 bg-white dark:bg-black border border-gray-300 dark:border-rose-500/30 rounded text-gray-900 dark:text-rose-100 font-mono text-sm focus:border-rose-500 focus:outline-none min-w-0"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="px-3 md:px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 dark:bg-rose-600/30 dark:hover:bg-rose-600/50 border border-rose-500/30 rounded text-rose-600 dark:text-rose-400 font-mono text-sm disabled:opacity-30 font-bold transition-all"
            >
              <span className="hidden md:inline">SEND</span>
              <i className="md:hidden fa fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Neural Activity - Hidden on mobile */}
      <div className="hidden md:flex md:w-1/3 flex-col bg-gray-50 dark:bg-gray-950 border-l border-gray-200 dark:border-rose-500/30">
        {/* Header */}
        <div className="px-4 py-3 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-rose-500/30 shrink-0">
          <h3 className="text-rose-600 dark:text-rose-400 font-mono text-sm font-bold">NEURAL ACTIVITY</h3>
          <p className="text-xs text-gray-500 mt-0.5">Internal processing stream</p>
        </div>

        {/* Activity Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 font-mono text-xs">
          {/* Real-time Activity */}
          {neuralActivity.length > 0 && (
            <div className="border border-yellow-500/30 rounded p-3 bg-yellow-50 dark:bg-yellow-500/5">
              <div className="text-yellow-600 dark:text-yellow-400 font-bold mb-2">⚡ LIVE PROCESSING</div>
              <div className="space-y-1">
                {neuralActivity.map((activity, idx) => (
                  <div key={idx} className="text-yellow-700 dark:text-yellow-300/70">{activity}</div>
                ))}
              </div>
            </div>
          )}

          {/* Token Stream */}
          {isStreaming && currentTokens.length > 0 && (
            <div className="border border-blue-500/30 rounded p-3 bg-blue-50 dark:bg-blue-500/5">
              <div className="text-blue-600 dark:text-blue-400 font-bold mb-2">🔤 TOKEN STREAM</div>
              <TokenStream
                tokens={currentTokens}
                isStreaming={isStreaming}
                showConfidence={true}
                showAlternatives={true}
              />
            </div>
          )}

          {/* Selected Message Analysis */}
          {selectedMessage && lastThinking && selectedMessage === lastMessage?.id && (
            <div className="border border-purple-500/30 rounded p-3 bg-purple-50 dark:bg-purple-500/5">
              <div className="text-purple-600 dark:text-purple-400 font-bold mb-2">🧠 THINKING STEPS</div>
              <div className="space-y-2">
                {lastThinking.map((step, idx) => (
                  <div key={idx} className="border-l-2 border-purple-500/50 pl-2">
                    <div className="text-purple-700 dark:text-purple-300 font-bold">Step {step.step}</div>
                    <div className="text-purple-600 dark:text-purple-200/70 text-xs">{step.thought}</div>
                    <div className="text-purple-500/70 dark:text-purple-400/50 text-xs mt-1">⏱ {step.duration_ms}ms</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RAG Context Preview */}
          {lastMessage && lastMessage.citations && lastMessage.citations.length > 0 && (
            <div className="border border-rose-500/30 rounded p-3 bg-rose-50 dark:bg-rose-500/5">
              <div className="text-rose-600 dark:text-rose-400 font-bold mb-2">📚 RAG CONTEXT</div>
              <div className="space-y-2">
                {lastMessage.citations.map((cit: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-rose-500/50 pl-2">
                    <div className="text-rose-700 dark:text-rose-300 text-xs font-bold">{cit.title}</div>
                    <div className="text-rose-600/70 dark:text-rose-200/50 text-xs mt-1">
                      Chunk #{idx + 1} • Used in response
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Stats */}
          <div className="border border-gray-300 dark:border-gray-500/30 rounded p-3 bg-white dark:bg-gray-500/5">
            <div className="text-gray-700 dark:text-gray-300 font-bold mb-2">📊 SYSTEM METRICS</div>
            <div className="space-y-1 text-gray-500 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Messages:</span>
                <span className="text-rose-600 dark:text-rose-300 font-bold">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Response:</span>
                <span className="text-rose-600 dark:text-rose-300 font-bold">~1.2s</span>
              </div>
              <div className="flex justify-between">
                <span>Tokens/msg:</span>
                <span className="text-rose-600 dark:text-rose-300 font-bold">~350</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`font-bold ${isLoading ? 'text-yellow-500' : 'text-green-600 dark:text-green-400'}`}>
                  {isLoading ? 'BUSY' : 'IDLE'}
                </span>
              </div>
            </div>
          </div>

          {/* API Calls Log */}
          {isLoading && (
            <div className="border border-red-500/30 rounded p-3 bg-red-50 dark:bg-red-500/5">
              <div className="text-red-600 dark:text-red-400 font-bold mb-2">🔌 API CALLS</div>
              <div className="space-y-1 text-red-700 dark:text-red-300/70 text-xs">
                <div>→ POST /embeddings [pending]</div>
                <div>→ POST /search [pending]</div>
                <div>→ POST /generate [pending]</div>
              </div>
            </div>
          )}

          <div ref={activityEndRef} />
        </div>
      </div>
    </div>
  );
};
