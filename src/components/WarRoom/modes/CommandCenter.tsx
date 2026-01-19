import React, { useState, useRef, useEffect } from 'react';
import { AIMessage, ThinkingStep, KnowledgeDoc } from '../../services/ragService';

interface CommandCenterProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  documents: KnowledgeDoc[];
  onSendMessage: (message: string) => void;
  onGenerateAudio?: () => void;
  onExport?: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  documents,
  onSendMessage,
  onGenerateAudio,
  onExport
}) => {
  const [input, setInput] = useState('');
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate metrics
    const interval = setInterval(() => {
      setCpuHistory(prev => [...prev.slice(-29), Math.random() * 40 + 10]);
      setLatencyHistory(prev => [...prev.slice(-29), Math.random() * 500 + 200]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = () => {
    if (input.trim()) {
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

  const avgLatency = latencyHistory.length > 0
    ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length)
    : 0;

  const totalTokens = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  const avgCpu = cpuHistory.length > 0
    ? Math.round(cpuHistory.reduce((a, b) => a + b, 0) / cpuHistory.length)
    : 0;

  return (
    <div className="h-full min-h-0 bg-gray-50 dark:bg-gray-950 flex flex-col md:grid md:grid-cols-12 md:grid-rows-12 gap-2 p-2 overflow-hidden">
      {/* Top Left - System Metrics - Hidden on mobile */}
      <div className="hidden md:block col-span-3 row-span-4 bg-rose-50 dark:bg-gradient-to-br dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-200 dark:border-rose-500/30 rounded-lg p-3 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <i className="fa fa-chart-line text-rose-600 dark:text-rose-400"></i>
          <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">SYSTEM METRICS</h3>
        </div>

        <div className="space-y-3 text-xs">
          {/* CPU Usage */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600 dark:text-gray-400">CPU Usage</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">{avgCpu}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all"
                style={{ width: `${avgCpu}%` }}
              ></div>
            </div>
          </div>

          {/* Memory */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600 dark:text-gray-400">Memory</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">1.2 GB</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 w-[42%]"></div>
            </div>
          </div>

          {/* API Latency */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600 dark:text-gray-400">API Latency</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">{avgLatency}ms</span>
            </div>
            <div className="h-8 flex items-end gap-0.5">
              {latencyHistory.slice(-20).map((val, i) => (
                <div
                  key={i}
                  className="flex-1 bg-rose-400/70 dark:bg-rose-500/70 rounded-t"
                  style={{ height: `${(val / 1000) * 100}%` }}
                ></div>
              ))}
            </div>
          </div>

          {/* Status Indicators */}
          <div className="pt-2 border-t border-rose-200 dark:border-rose-500/30 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">AI Model</span>
              <span className="text-green-600 dark:text-green-400 font-bold">● ONLINE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Database</span>
              <span className="text-green-600 dark:text-green-400 font-bold">● ONLINE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Vector DB</span>
              <span className="text-green-600 dark:text-green-400 font-bold">● ONLINE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Middle - Main Console - Full width on mobile */}
      <div className="flex-1 md:flex-none md:col-span-6 md:row-span-8 bg-white dark:bg-black border border-rose-200 dark:border-rose-500/30 rounded-lg flex flex-col overflow-hidden min-h-0">
        <div className="px-3 md:px-4 py-2 bg-gray-100 dark:bg-gray-900 border-b border-rose-200 dark:border-rose-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <i className="fa fa-terminal text-rose-600 dark:text-rose-400"></i>
            <h3 className="text-xs md:text-sm font-bold text-rose-600 dark:text-rose-400">MAIN CONSOLE</h3>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{messages.length} msgs</div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 min-h-0 text-sm">
          {messages.map((msg) => (
            <div key={msg.id}>
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] md:max-w-[80%] px-3 md:px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-rose-50 dark:bg-rose-600/20 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200'
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-rose-500/20 text-gray-800 dark:text-gray-200'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 mb-1 font-bold">PULSE AI</div>
                  )}
                  <div className="text-sm">{msg.content}</div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      📚 {msg.citations.length} source(s)
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-50 dark:bg-gray-800 border border-rose-200 dark:border-rose-500/20 px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Processing...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-2 md:p-3 bg-gray-100 dark:bg-gray-900 border-t border-rose-200 dark:border-rose-500/30 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Command input..."
              className="flex-1 px-3 py-2 bg-white dark:bg-black border border-gray-300 dark:border-rose-500/30 rounded text-sm text-gray-900 dark:text-white focus:border-rose-500 focus:outline-none min-w-0"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="px-3 md:px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded text-sm font-medium disabled:opacity-30 text-white"
            >
              <span className="hidden md:inline">SEND</span>
              <i className="md:hidden fa fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Top Right - Knowledge Base - Hidden on mobile */}
      <div className="hidden md:block col-span-3 row-span-6 bg-rose-50 dark:bg-gradient-to-br dark:from-rose-900/25 dark:to-pink-900/30 border border-rose-200 dark:border-rose-500/30 rounded-lg p-3 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <i className="fa fa-database text-rose-600 dark:text-rose-400"></i>
          <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">KNOWLEDGE BASE</h3>
        </div>

        <div className="space-y-2">
          {documents.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">No documents loaded</div>
          ) : (
            documents.slice(0, 10).map((doc) => (
              <div
                key={doc.id}
                className={`p-2 rounded text-xs border ${
                  doc.processing_status === 'completed'
                    ? 'bg-emerald-50 dark:bg-green-900/20 border-emerald-200 dark:border-green-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-yellow-900/20 border-amber-200 dark:border-yellow-500/30 text-amber-700 dark:text-amber-300'
                }`}
              >
                <div className="font-bold truncate">{doc.title}</div>
                <div className="text-xs opacity-60 mt-0.5">
                  {doc.file_type} • {doc.processing_status}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-500/30 text-xs">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Total Documents:</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">{documents.length}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400 mt-1">
            <span>Processed:</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">
              {documents.filter(d => d.processing_status === 'completed').length}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Left - Session Stats - Hidden on mobile */}
      <div className="hidden md:block col-span-3 row-span-4 bg-purple-50 dark:bg-gradient-to-br dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-500/30 rounded-lg p-3 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <i className="fa fa-chart-bar text-purple-600 dark:text-purple-400"></i>
          <h3 className="text-sm font-bold text-purple-600 dark:text-purple-400">SESSION STATS</h3>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Messages:</span>
            <span className="text-purple-600 dark:text-purple-400 font-bold">{messages.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total Tokens:</span>
            <span className="text-purple-600 dark:text-purple-400 font-bold">~{totalTokens}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Thinking Steps:</span>
            <span className="text-purple-600 dark:text-purple-400 font-bold">
              {Array.from(thinkingLogs.values()).reduce((sum, steps) => sum + steps.length, 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Avg Response:</span>
            <span className="text-purple-600 dark:text-purple-400 font-bold">{avgLatency}ms</span>
          </div>
        </div>
      </div>

      {/* Bottom Middle - Quick Actions - Hidden on mobile */}
      <div className="hidden md:block col-span-3 row-span-4 bg-rose-50 dark:bg-gradient-to-br dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-200 dark:border-rose-500/30 rounded-lg p-3 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <i className="fa fa-bolt text-rose-600 dark:text-rose-400"></i>
          <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">QUICK ACTIONS</h3>
        </div>

        <div className="space-y-2">
          <button
            onClick={onGenerateAudio}
            className="w-full px-3 py-2 bg-rose-100 dark:bg-rose-600/25 hover:bg-rose-200 dark:hover:bg-rose-600/35 border border-rose-200 dark:border-rose-500/30 rounded text-xs text-rose-700 dark:text-rose-100 flex items-center gap-2 transition-colors"
          >
            <i className="fa fa-volume-up"></i>
            Generate Audio Summary
          </button>
          <button
            onClick={onExport}
            className="w-full px-3 py-2 bg-rose-100 dark:bg-rose-600/25 hover:bg-rose-200 dark:hover:bg-rose-600/35 border border-rose-200 dark:border-rose-500/30 rounded text-xs text-rose-700 dark:text-rose-100 flex items-center gap-2 transition-colors"
          >
            <i className="fa fa-download"></i>
            Export Conversation
          </button>
          <button
            onClick={() => onSendMessage('Summarize this conversation')}
            className="w-full px-3 py-2 bg-rose-100 dark:bg-rose-600/25 hover:bg-rose-200 dark:hover:bg-rose-600/35 border border-rose-200 dark:border-rose-500/30 rounded text-xs text-rose-700 dark:text-rose-100 flex items-center gap-2 transition-colors"
          >
            <i className="fa fa-compress"></i>
            Summarize Session
          </button>
          <button
            onClick={() => onSendMessage('What are the key insights?')}
            className="w-full px-3 py-2 bg-rose-100 dark:bg-rose-600/25 hover:bg-rose-200 dark:hover:bg-rose-600/35 border border-rose-200 dark:border-rose-500/30 rounded text-xs text-rose-700 dark:text-rose-100 flex items-center gap-2 transition-colors"
          >
            <i className="fa fa-lightbulb"></i>
            Extract Insights
          </button>
        </div>
      </div>

      {/* Bottom Right - System Log - Hidden on mobile */}
      <div className="hidden md:block col-span-6 row-span-6 bg-gray-50 dark:bg-black border border-gray-300 dark:border-gray-500/30 rounded-lg p-3 overflow-y-auto font-mono text-xs">
        <div className="flex items-center gap-2 mb-3">
          <i className="fa fa-list text-gray-600 dark:text-gray-400"></i>
          <h3 className="text-sm font-bold text-gray-600 dark:text-gray-400">SYSTEM LOG</h3>
        </div>

        <div className="space-y-1 text-gray-600 dark:text-gray-500">
          <div>[{new Date().toLocaleTimeString()}] System initialized</div>
          <div>[{new Date().toLocaleTimeString()}] Connected to Gemini AI</div>
          <div>[{new Date().toLocaleTimeString()}] Knowledge base loaded: {documents.length} docs</div>
          {messages.slice(-5).map((msg, idx) => (
            <div key={idx}>
              [{new Date(msg.created_at).toLocaleTimeString()}] {msg.role === 'user' ? 'User query' : 'AI response'} • {msg.content.length} chars
            </div>
          ))}
          {isLoading && (
            <div className="text-yellow-600 dark:text-yellow-400">[{new Date().toLocaleTimeString()}] Processing query...</div>
          )}
        </div>
      </div>
    </div>
  );
};
