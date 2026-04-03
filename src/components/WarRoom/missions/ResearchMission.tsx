import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';
import { dataService } from '../../../services/dataService';

import { BarChart3, BookOpen, Check, Copy, Lightbulb, Plus, Rocket, Send, Share2, Wand2, X } from 'lucide-react';

interface ResearchPhase {
  id: string;
  name: string;
  icon: string;
  description: string;
  prompts: string[];
  completed: boolean;
}

interface ResearchMissionProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
  onNewSession?: () => void; // Callback to start a new session
  activeContextCount?: number;
}

const DEFAULT_PHASES: ResearchPhase[] = [
  {
    id: 'define',
    name: 'Define',
    icon: 'fa-crosshairs',
    description: 'Clarify the research question',
    prompts: [
      'What specific question am I trying to answer?',
      'What do I already know about this topic?',
      'What are the key terms I need to understand?'
    ],
    completed: false
  },
  {
    id: 'explore',
    name: 'Explore',
    icon: 'fa-compass',
    description: 'Gather information and perspectives',
    prompts: [
      'What are the main viewpoints on this topic?',
      'What evidence supports each perspective?',
      'Are there any gaps in my understanding?'
    ],
    completed: false
  },
  {
    id: 'analyze',
    name: 'Analyze',
    icon: 'fa-microscope',
    description: 'Evaluate and synthesize findings',
    prompts: [
      'What patterns do I see in the information?',
      'What are the strongest arguments?',
      'What are the limitations of this research?'
    ],
    completed: false
  },
  {
    id: 'conclude',
    name: 'Conclude',
    icon: 'fa-flag-checkered',
    description: 'Draw conclusions and next steps',
    prompts: [
      'What is my answer to the original question?',
      'What are the key takeaways?',
      'What further research might be needed?'
    ],
    completed: false
  }
];

export const ResearchMission: React.FC<ResearchMissionProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Research Mission',
  documents = [],
  onNewSession,
  activeContextCount = 0
}) => {
  const [researchTopic, setResearchTopic] = useState('');
  const [isTopicSet, setIsTopicSet] = useState(false);
  const [phases, setPhases] = useState<ResearchPhase[]>(DEFAULT_PHASES);
  const [activePhaseId, setActivePhaseId] = useState('define');
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [findings, setFindings] = useState<string[]>([]);
  const [showFindings, setShowFindings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activePhase = useMemo(
    () => phases.find(p => p.id === activePhaseId) || phases[0],
    [phases, activePhaseId]
  );

  const completedCount = useMemo(
    () => phases.filter(p => p.completed).length,
    [phases]
  );

  const progress = useMemo(
    () => (completedCount / phases.length) * 100,
    [completedCount, phases.length]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSetTopic = () => {
    if (!researchTopic.trim()) return;
    setIsTopicSet(true);

    // Send initial research prompt to AI
    onSendMessage(`I'm starting a research mission on the topic: "${researchTopic}". Please help me explore this systematically. Let's start with the Define phase - help me clarify my research question and identify key terms I need to understand.`);
  };

  const handleSend = () => {
    const message = input.trim();
    if (!message) return;
    onSendMessage(message);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt: string) => {
    const contextualPrompt = `[Research Phase: ${activePhase.name}] ${prompt}`;
    onSendMessage(contextualPrompt);
  };

  const handlePhaseClick = (phaseId: string) => {
    setActivePhaseId(phaseId);
    const phase = phases.find(p => p.id === phaseId);
    if (phase) {
      onSendMessage(`Let's move to the ${phase.name} phase of our research on "${researchTopic}". ${phase.description}. What should I focus on?`);
    }
  };

  const markPhaseComplete = () => {
    setPhases(prev => prev.map(p =>
      p.id === activePhaseId ? { ...p, completed: true } : p
    ));

    // Auto-advance to next incomplete phase
    const currentIndex = phases.findIndex(p => p.id === activePhaseId);
    const nextPhase = phases.find((p, i) => i > currentIndex && !p.completed);
    if (nextPhase) {
      setActivePhaseId(nextPhase.id);
    }
  };

  const addToFindings = async (text: string) => {
    // Add to local state
    setFindings(prev => [...prev, text]);
    
    // Save to archives with 'research' type
    try {
      await dataService.createArchive({
        type: 'research',
        title: `Research Finding: ${researchTopic.substring(0, 50)}${researchTopic.length > 50 ? '...' : ''}`,
        content: text,
        date: new Date(),
        tags: ['research', 'war-room', researchTopic.toLowerCase().replace(/\s+/g, '-')],
      });
      
      // Show success feedback
      console.log('✅ Finding saved to archives');
    } catch (error) {
      console.error('Failed to save finding to archives:', error);
    }
  };

  // Extract key insights from last AI message
  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  if (!isTopicSet) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center war-room-container p-8">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full wr-mission-accent-bg flex items-center justify-center">
            <BarChart3 className="fa text-3xl text-blue-400" />
          </div>

          <h2 className="text-2xl font-bold war-room-text-primary mb-2">
            Research Mission
          </h2>
          <p className="war-room-text-secondary mb-8">
            Define your research topic and let AI guide you through a structured investigation
          </p>

          <div className="war-room-panel p-6">
            <label className="block text-sm war-room-text-secondary mb-2 text-left">
              What would you like to research?
            </label>
            <input
              type="text"
              value={researchTopic}
              onChange={(e) => setResearchTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetTopic()}
              placeholder="e.g., Best practices for non-profit fundraising"
              className="war-room-input w-full mb-4"
              autoFocus
            />

            <button
              onClick={handleSetTopic}
              disabled={!researchTopic.trim()}
              className="war-room-btn war-room-btn-primary w-full py-3"
            >
              <Rocket className="fa mr-2" />
              Start Research Mission
            </button>
          </div>

          {/* Mission Overview */}
          <div className="mt-8 grid grid-cols-4 gap-2">
            {DEFAULT_PHASES.map((phase, i) => (
              <div key={phase.id} className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white/5 flex items-center justify-center">
                  <i className={`fa ${phase.icon} text-sm war-room-text-secondary`}></i>
                </div>
                <div className="text-xs war-room-text-secondary">{phase.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex war-room-container overflow-hidden">
      {/* Left Sidebar - Research Phases */}
      <div className="w-64 shrink-0 border-r border-white/10 flex flex-col">
        {/* Mission Header */}
        <div className="p-4 border-b border-white/10">
          <div className="text-xs war-room-text-secondary uppercase tracking-wider mb-1">
            Research Topic
          </div>
          <h3 className="font-medium war-room-text-primary truncate" title={researchTopic}>
            {researchTopic}
          </h3>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="war-room-text-secondary">Progress</span>
              <span className="war-room-text-primary">{completedCount}/{phases.length}</span>
            </div>
            <div className="war-room-progress">
              <div
                className="war-room-progress-bar bg-gradient-to-r from-blue-500 to-cyan-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {activeContextCount > 0 && (
            <div className="war-room-badge text-xs mt-2" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <BookOpen className="fa" />
              {activeContextCount} source{activeContextCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Phases List */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-2">
          {phases.map((phase, index) => (
            <button
              key={phase.id}
              onClick={() => handlePhaseClick(phase.id)}
              className={`w-full p-3 rounded-lg text-left mb-2 transition-all ${
                activePhaseId === phase.id
                  ? 'bg-blue-500/20 border border-blue-500/30'
                  : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  phase.completed
                    ? 'bg-green-500/20 text-green-400'
                    : activePhaseId === phase.id
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-white/5 war-room-text-secondary'
                }`}>
                  {phase.completed ? (
                    <Check className="fa text-sm" />
                  ) : (
                    <i className={`fa ${phase.icon} text-sm`}></i>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${
                    activePhaseId === phase.id ? 'text-blue-300' : 'war-room-text-primary'
                  }`}>
                    {phase.name}
                  </div>
                  <div className="text-xs war-room-text-secondary truncate">
                    {phase.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Findings Button */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setShowFindings(!showFindings)}
            className="war-room-btn w-full justify-between"
          >
            <span>
              <Lightbulb className="fa mr-2" />
              Key Findings
            </span>
            <span className="war-room-badge text-xs">{findings.length}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Phase Header */}
        <div className="shrink-0 p-4 border-b border-white/10 bg-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                activePhase.completed
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}>
                <i className={`fa ${activePhase.icon}`}></i>
              </div>
              <div>
                <h2 className="text-lg font-semibold war-room-text-primary">
                  {activePhase.name} Phase
                </h2>
                <p className="text-sm war-room-text-secondary">{activePhase.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onNewSession && messages.length > 0 && (
                <button
                  onClick={onNewSession}
                  className="war-room-btn text-sm px-3 py-2"
                  title="Start a new research session"
                >
                  <Plus className="fa mr-2" />
                  New Session
                </button>
              )}
              {!activePhase.completed && (
                <button
                  onClick={markPhaseComplete}
                  className="war-room-btn war-room-btn-primary text-sm px-4 py-2"
                >
                  <Check className="fa mr-2" />
                  Complete Phase
                </button>
              )}
              <button
                onClick={() => setShowExport(true)}
                className="war-room-btn war-room-btn-icon"
                title="Export research"
              >
                <Share2 className="fa" />
              </button>
            </div>
          </div>
        </div>

        {/* Suggested Prompts */}
        <div className="shrink-0 p-3 border-b border-white/10 wr-mission-accent-bg">
          <div className="text-xs war-room-text-secondary mb-2">
            <Wand2 className="fa mr-1" />
            Guided prompts for this phase:
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 war-room-scrollbar">
            {activePhase.prompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handlePromptClick(prompt)}
                className="war-room-btn text-xs px-3 py-1.5 whitespace-nowrap shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] ${
                  msg.role === 'user'
                    ? 'war-room-message-user'
                    : 'war-room-message-ai'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {/* Citations */}
                {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1">
                    {msg.citations.map((c, i) => (
                      <span key={i} className="war-room-badge text-xs">
                        <BookOpen className="fa mr-1" />
                        {c.title}
                      </span>
                    ))}
                  </div>
                )}

                {/* Add to Findings Button */}
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => addToFindings(msg.content.slice(0, 200) + '...')}
                    className="mt-2 text-xs war-room-text-secondary hover:text-blue-400 transition-colors"
                  >
                    <Plus className="fa mr-1" />
                    Save to findings
                  </button>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="war-room-message-ai">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 war-room-input-area">
          <div className="flex items-center gap-2">
            <div className="flex-1 war-room-panel-inset flex items-center gap-2 px-4 py-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask about ${researchTopic}...`}
                className="flex-1 bg-transparent border-none outline-none text-sm"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`war-room-btn war-room-btn-icon-sm ${
                  input.trim() ? 'war-room-btn-primary' : ''
                }`}
              >
                <Send className="fa text-xs" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Findings Sidebar */}
      {showFindings && (
        <div className="w-72 shrink-0 border-l border-white/10 flex flex-col bg-black/20">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-medium war-room-text-primary">
              <Lightbulb className="fa mr-2 text-yellow-400" />
              Key Findings
            </h3>
            <button
              onClick={() => setShowFindings(false)}
              className="war-room-btn war-room-btn-icon-sm"
            >
              <X className="fa text-xs" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto war-room-scrollbar p-3 space-y-2">
            {findings.length === 0 ? (
              <p className="text-xs war-room-text-secondary text-center p-4">
                Click "Save to findings" on AI responses to collect key insights here.
              </p>
            ) : (
              findings.map((finding, i) => (
                <div
                  key={i}
                  className="p-3 war-room-panel text-xs war-room-text-secondary"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1">{finding}</p>
                    <button
                      onClick={() => setFindings(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-300 shrink-0"
                    >
                      <X className="fa" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {findings.length > 0 && (
            <div className="p-3 border-t border-white/10">
              <button
                onClick={() => {
                  const text = findings.map((f, i) => `${i + 1}. ${f}`).join('\n\n');
                  navigator.clipboard.writeText(text);
                }}
                className="war-room-btn w-full text-xs"
              >
                <Copy className="fa mr-2" />
                Copy All Findings
              </button>
            </div>
          )}
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <SessionExport
          sessionId={sessionId}
          sessionTitle={`Research: ${researchTopic}`}
          messages={messages}
          topic={researchTopic}
          mode="Research Mission"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
