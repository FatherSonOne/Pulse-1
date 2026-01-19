import React, { useState, useEffect, useRef } from 'react';
import { AIMessage, ThinkingStep } from '../../services/ragService';
import { MatrixRain } from '../effects/MatrixRain';

interface NeuralTerminalProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
}

export const NeuralTerminal: React.FC<NeuralTerminalProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage
}) => {
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        const cmd = input.trim();
        setCommandHistory([...commandHistory, cmd]);
        onSendMessage(cmd);
        setInput('');
        setHistoryIndex(-1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      }
    }
  };

  const formatTimestamp = () => {
    const now = new Date();
    return `[${now.toLocaleTimeString()}]`;
  };

  return (
    <div className="relative h-full min-h-0 bg-[#f7fbf3] dark:bg-black font-mono text-sm flex flex-col overflow-hidden">
      {/* Matrix background (behind everything) - hidden on mobile for performance */}
      <div className="hidden md:block">
        <MatrixRain
          color="#39ff14"
          fontSize={18}
          speed={28}
          density={0.92}
          opacity={0.15}
          fadeColor="rgba(255,255,255,0.06)"
          className="mix-blend-screen"
          zIndex={0}
        />
      </div>

      <div className="relative z-10 flex flex-col h-full min-h-0">
      {/* Terminal Header */}
      <div className="px-2 md:px-4 py-2 bg-white/80 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-cyan-500/30 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-red-500"></div>
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-yellow-500"></div>
            <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-gray-800 dark:text-cyan-400 font-bold text-xs md:text-sm truncate">
            <span className="hidden sm:inline">user@pulse-war-room:~$</span>
            <span className="sm:hidden">pulse:~$</span>
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 text-xs text-gray-700 dark:text-cyan-400">
          <span className="hidden sm:inline">⚡ Neural Terminal v2.0</span>
          <span className="text-green-700 dark:text-green-400 font-bold">● ONLINE</span>
        </div>
      </div>

      {/* Terminal Output */}
      <div ref={terminalRef} className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 min-h-0 bg-transparent text-gray-900 dark:text-white">
        {/* Boot Message - simplified on mobile */}
        <div className="text-green-700 dark:text-green-400 font-bold drop-shadow-sm text-xs md:text-sm">
          <div className="hidden md:block">╔═══════════════════════════════════════════╗</div>
          <div className="hidden md:block">║  PULSE WAR ROOM NEURAL INTERFACE v2.0   ║</div>
          <div className="hidden md:block">║  Connected: Gemini-2.0-flash-exp        ║</div>
          <div className="hidden md:block">║  Status: Active                          ║</div>
          <div className="hidden md:block">╚═══════════════════════════════════════════╝</div>
          <div className="md:hidden">▸ Neural Interface v2.0 - Active</div>
        </div>

        {/* Messages */}
        {messages.map((msg, idx) => (
          <div key={msg.id || idx}>
            {msg.role === 'user' ? (
              <div>
                <span className="text-blue-600 dark:text-cyan-400 font-bold">{formatTimestamp()} user@pulse:</span>
                <span className="text-gray-900 dark:text-white ml-2">$ {msg.content}</span>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Thinking Process */}
                {thinkingLogs.has(msg.id) && (
              <div className="text-yellow-700 dark:text-yellow-400/70 text-xs">
                    {thinkingLogs.get(msg.id)?.map((step, i) => (
                      <div key={i} className="ml-4">
                        {i === 0 && <div>┌─ [PROCESSING]</div>}
                        <div>
                          ├─ {step.thought}
                      <span className="text-green-700 dark:text-green-400 ml-2">[✓] {step.duration_ms}ms</span>
                        </div>
                        {i === thinkingLogs.get(msg.id)!.length - 1 && <div>└─ [COMPLETE]</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Response */}
                <div>
                  <span className="text-purple-700 dark:text-magenta-400 font-bold">
                    {formatTimestamp()} <span className="text-purple-700 dark:text-purple-400">assistant</span>:
                  </span>
                  <div className="ml-4 mt-1 text-green-800 dark:text-green-300">
                    {msg.content.split('\n').map((line, i) => (
                      <div key={i} className="leading-relaxed">
                        {line.startsWith('- ') || line.startsWith('• ') ? (
                          <div className="flex gap-2">
                            <span className="text-blue-700 dark:text-cyan-400">▸</span>
                            <span>{line.substring(2)}</span>
                          </div>
                        ) : line.startsWith('## ') ? (
                          <div className="text-blue-700 dark:text-cyan-400 font-bold mt-2">{line.substring(3)}</div>
                        ) : (
                          <div>{line || <br />}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="ml-4 mt-2 text-xs text-gray-600">
                      <span className="text-yellow-700 dark:text-yellow-400 font-bold">📚 SOURCES:</span>
                      {msg.citations.map((cit: any, i: number) => (
                        <div key={i} className="ml-4">
                          └─ {cit.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="text-yellow-700 dark:text-yellow-400 animate-pulse font-bold">
            <div>┌─ [PROCESSING]</div>
            <div>├─ Analyzing query... <span className="animate-spin inline-block">⚙</span></div>
            <div>├─ Searching knowledge base...</div>
            <div>└─ Generating response...</div>
          </div>
        )}
      </div>

      {/* Input Line */}
      <div className="px-2 md:px-4 py-2 md:py-3 bg-white/80 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-cyan-500/30 shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-blue-700 dark:text-cyan-400 font-bold text-xs md:text-sm whitespace-nowrap">
            <span className="hidden sm:inline">user@pulse:~$</span>
            <span className="sm:hidden">$</span>
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command..."
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white caret-blue-700 dark:caret-cyan-400 font-bold text-sm md:text-base min-w-0"
          />
          <button
            onClick={() => { if (input.trim()) { onSendMessage(input.trim()); setInput(''); } }}
            className="md:hidden px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-bold"
          >
            <i className="fa fa-paper-plane"></i>
          </button>
          <span className="hidden md:inline text-green-700 dark:text-green-400 text-xs font-bold">
            {input.length > 0 && `[${input.length} chars]`}
          </span>
        </div>
      </div>

      {/* Status Bar - hidden on mobile */}
      <div className="hidden md:flex px-4 py-1 bg-white/90 dark:bg-black border-t border-gray-200 dark:border-cyan-500/30 items-center justify-between text-xs text-gray-600 dark:text-gray-500 shrink-0">
        <div>
          <span className="text-blue-700 dark:text-cyan-400 font-bold">SESSION:</span> {messages.length} messages
        </div>
        <div className="flex gap-4">
          <span><span className="text-blue-700 dark:text-cyan-400 font-bold">TOKENS:</span> ~{messages.reduce((sum, m) => sum + m.content.length, 0)}</span>
          <span><span className="text-green-700 dark:text-green-400 font-bold">CPU:</span> 23%</span>
          <span><span className="text-green-700 dark:text-green-400 font-bold">RAM:</span> 1.2GB</span>
        </div>
      </div>
      </div>
    </div>
  );
};
