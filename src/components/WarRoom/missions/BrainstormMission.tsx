import React, { useState, useRef, useEffect } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';

interface Idea {
  id: string;
  text: string;
  category: string;
  expanded?: string;
  votes: number;
}

type BrainstormPhase = 'setup' | 'diverge' | 'cluster' | 'converge' | 'refine';

interface BrainstormMissionProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
  onNewSession?: () => void;
}

const PHASES: { id: BrainstormPhase; label: string; icon: string; description: string }[] = [
  { id: 'setup', label: 'Setup', icon: 'fa-bullseye', description: 'Define the challenge' },
  { id: 'diverge', label: 'Diverge', icon: 'fa-burst', description: 'Generate wild ideas' },
  { id: 'cluster', label: 'Cluster', icon: 'fa-object-group', description: 'Group by themes' },
  { id: 'converge', label: 'Converge', icon: 'fa-compress', description: 'Select best ideas' },
  { id: 'refine', label: 'Refine', icon: 'fa-gem', description: 'Develop concepts' },
];

const BRAINSTORM_TECHNIQUES = [
  { id: 'wild', name: 'Wild Ideas', icon: 'fa-rocket', prompt: 'Give me 5 wild, unconventional ideas without any constraints' },
  { id: 'reverse', name: 'Reverse', icon: 'fa-rotate-left', prompt: 'What if we did the opposite? How would we make this worse?' },
  { id: 'combine', name: 'Combine', icon: 'fa-link', prompt: 'How can we combine two different ideas into something new?' },
  { id: 'analogy', name: 'Analogies', icon: 'fa-lightbulb', prompt: 'What would a different industry do? Give examples from nature, other fields' },
  { id: 'constraints', name: 'Constraints', icon: 'fa-lock', prompt: 'What if we had unlimited budget? What if we had zero budget?' },
  { id: 'personas', name: 'Personas', icon: 'fa-users', prompt: 'How would a child approach this? An expert? A skeptic?' },
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Quick Wins': { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400' },
  'Big Bets': { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-400' },
  'Experiments': { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400' },
  'Research': { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400' },
  'Uncategorized': { bg: 'bg-white/10', border: 'border-white/20', text: 'text-white/60' },
};

export const BrainstormMission: React.FC<BrainstormMissionProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Brainstorm Mission',
  documents = []
}) => {
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<BrainstormPhase>('setup');
  const [challenge, setChallenge] = useState('');
  const [context, setContext] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [newIdeaText, setNewIdeaText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Uncategorized');
  const [topIdeas, setTopIdeas] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSetupChallenge = () => {
    if (!challenge.trim()) return;
    setCurrentPhase('diverge');
    onSendMessage(`[BRAINSTORM MISSION - Phase 1: Setup]
Challenge: "${challenge}"
${context ? `\nContext: ${context}` : ''}

Let's brainstorm! Start by:
1. Rephrasing the challenge as a "How Might We..." question
2. Identifying key constraints and opportunities
3. Giving me 5 initial ideas to spark creativity

Remember: No idea is too wild. We'll evaluate later!`);
  };

  const handleAddIdea = () => {
    if (!newIdeaText.trim()) return;
    const newIdea: Idea = {
      id: `idea-${Date.now()}`,
      text: newIdeaText.trim(),
      category: selectedCategory,
      votes: 0
    };
    setIdeas([...ideas, newIdea]);
    setNewIdeaText('');
  };

  const handleVoteIdea = (id: string, delta: number) => {
    setIdeas(ideas.map(idea =>
      idea.id === id ? { ...idea, votes: Math.max(0, idea.votes + delta) } : idea
    ));
  };

  const handleCategorizeIdea = (id: string, category: string) => {
    setIdeas(ideas.map(idea =>
      idea.id === id ? { ...idea, category } : idea
    ));
  };

  const handleDeleteIdea = (id: string) => {
    setIdeas(ideas.filter(idea => idea.id !== id));
    setTopIdeas(topIdeas.filter(tid => tid !== id));
  };

  const handleToggleTopIdea = (id: string) => {
    if (topIdeas.includes(id)) {
      setTopIdeas(topIdeas.filter(tid => tid !== id));
    } else if (topIdeas.length < 5) {
      setTopIdeas([...topIdeas, id]);
    }
  };

  const handleTechnique = (technique: typeof BRAINSTORM_TECHNIQUES[0]) => {
    onSendMessage(`[BRAINSTORM MISSION - Technique: ${technique.name}]
Challenge: "${challenge}"
${technique.prompt}

Current ideas so far:
${ideas.length > 0 ? ideas.map(i => `- ${i.text}`).join('\n') : 'None yet'}

Give me fresh perspectives!`);
  };

  const handleAskAI = (prompt: string) => {
    const phaseContext = `
Challenge: ${challenge}
Current ideas (${ideas.length}):
${ideas.slice(0, 10).map(i => `- [${i.category}] ${i.text}`).join('\n')}
${ideas.length > 10 ? `... and ${ideas.length - 10} more` : ''}
`;
    onSendMessage(`[BRAINSTORM MISSION - Phase: ${currentPhase}]\n${prompt}\n\nContext:${phaseContext}`);
  };

  const handleSend = () => {
    const message = input.trim();
    if (!message) return;
    handleAskAI(message);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const proceedToPhase = (phase: BrainstormPhase) => {
    setCurrentPhase(phase);

    const phasePrompts: Record<BrainstormPhase, string> = {
      setup: '',
      diverge: `DIVERGE phase: Generate as many ideas as possible. Quantity over quality! Use the technique buttons to spark creativity.`,
      cluster: `CLUSTER phase: Let's organize our ${ideas.length} ideas. Help me group them into themes like: Quick Wins, Big Bets, Experiments, Research.`,
      converge: `CONVERGE phase: Time to select the best ideas. Based on these categories:\n${
        Object.entries(ideas.reduce((acc, i) => ({ ...acc, [i.category]: (acc[i.category] || 0) + 1 }), {} as Record<string, number>))
          .map(([cat, count]) => `- ${cat}: ${count} ideas`).join('\n')
      }\n\nHelp me identify the top 3-5 most promising ideas.`,
      refine: `REFINE phase: Let's develop our top ideas:\n${
        topIdeas.map(id => ideas.find(i => i.id === id)?.text).filter(Boolean).map((t, i) => `${i + 1}. ${t}`).join('\n')
      }\n\nFor each, provide: Brief concept description, Key benefits, Potential challenges, and Next steps.`
    };

    if (phasePrompts[phase]) {
      onSendMessage(`[BRAINSTORM MISSION - Phase: ${phase}]\n${phasePrompts[phase]}`);
    }
  };

  const currentPhaseIndex = PHASES.findIndex(p => p.id === currentPhase);
  const categories = ['Quick Wins', 'Big Bets', 'Experiments', 'Research', 'Uncategorized'];
  const sortedIdeas = [...ideas].sort((a, b) => b.votes - a.votes);

  return (
    <div className="h-full w-full flex war-room-container overflow-hidden">
      {/* Progress & Ideas Panel */}
      <div className="w-80 shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        {/* Mission Header */}
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa fa-lightbulb text-yellow-400"></i>
            <h3 className="text-sm font-semibold war-room-text-primary">Brainstorm Mission</h3>
          </div>
          {challenge && (
            <p className="text-xs war-room-text-secondary line-clamp-2">{challenge}</p>
          )}
        </div>

        {/* Phase Progress */}
        <div className="p-3 border-b border-white/10">
          <div className="flex gap-1">
            {PHASES.map((phase, i) => {
              const isActive = phase.id === currentPhase;
              const isComplete = i < currentPhaseIndex;
              return (
                <button
                  key={phase.id}
                  onClick={() => i <= currentPhaseIndex && setCurrentPhase(phase.id)}
                  disabled={i > currentPhaseIndex}
                  className={`flex-1 p-2 rounded transition-all ${
                    isActive
                      ? 'bg-yellow-500/20 border border-yellow-500/40'
                      : isComplete
                      ? 'bg-emerald-500/10'
                      : 'opacity-40'
                  }`}
                  title={phase.description}
                >
                  <i className={`fa ${phase.icon} ${isComplete ? 'text-emerald-400' : isActive ? 'text-yellow-400' : 'text-white/40'}`}></i>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-center mt-2 war-room-text-secondary">
            {PHASES.find(p => p.id === currentPhase)?.description}
          </p>
        </div>

        {/* Phase Content */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-3">
          {currentPhase === 'setup' && !challenge && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  What challenge are you brainstorming?
                </label>
                <input
                  type="text"
                  value={challenge}
                  onChange={(e) => setChallenge(e.target.value)}
                  placeholder="e.g., How can we improve user onboarding?"
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-yellow-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  Additional context
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Constraints, goals, target audience..."
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-yellow-500/50 focus:outline-none resize-none h-20"
                />
              </div>
              <button
                onClick={handleSetupChallenge}
                disabled={!challenge.trim()}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-rocket mr-2"></i>
                Start Brainstorming
              </button>
            </div>
          )}

          {currentPhase === 'diverge' && (
            <div className="space-y-3">
              {/* Idea Input */}
              <div className="war-room-panel p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIdeaText}
                    onChange={(e) => setNewIdeaText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddIdea()}
                    placeholder="Add idea..."
                    className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none"
                  />
                  <button
                    onClick={handleAddIdea}
                    disabled={!newIdeaText.trim()}
                    className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
                  >
                    <i className="fa fa-plus text-xs"></i>
                  </button>
                </div>
              </div>

              {/* Techniques */}
              <div>
                <p className="text-xs war-room-text-secondary mb-2">Techniques:</p>
                <div className="grid grid-cols-2 gap-1">
                  {BRAINSTORM_TECHNIQUES.map(tech => (
                    <button
                      key={tech.id}
                      onClick={() => handleTechnique(tech)}
                      className="war-room-btn text-xs p-2 flex items-center gap-1.5"
                    >
                      <i className={`fa ${tech.icon} text-yellow-400`}></i>
                      {tech.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ideas List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs war-room-text-secondary">{ideas.length} ideas</span>
                  {ideas.length >= 10 && (
                    <button
                      onClick={() => proceedToPhase('cluster')}
                      className="text-xs text-yellow-400 hover:underline"
                    >
                      Cluster ideas →
                    </button>
                  )}
                </div>
                {sortedIdeas.slice(0, 8).map(idea => (
                  <div key={idea.id} className="war-room-panel p-2 group">
                    <p className="text-xs war-room-text-primary mb-1">{idea.text}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleVoteIdea(idea.id, 1)} className="opacity-50 hover:opacity-100">
                          <i className="fa fa-arrow-up text-[10px]"></i>
                        </button>
                        <span className="text-[10px] text-yellow-400">{idea.votes}</span>
                        <button onClick={() => handleVoteIdea(idea.id, -1)} className="opacity-50 hover:opacity-100">
                          <i className="fa fa-arrow-down text-[10px]"></i>
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteIdea(idea.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400"
                      >
                        <i className="fa fa-times text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
                {ideas.length > 8 && (
                  <p className="text-xs text-center war-room-text-secondary">
                    +{ideas.length - 8} more ideas
                  </p>
                )}
              </div>
            </div>
          )}

          {currentPhase === 'cluster' && (
            <div className="space-y-3">
              {categories.map(category => {
                const categoryIdeas = ideas.filter(i => i.category === category);
                if (categoryIdeas.length === 0 && category !== selectedCategory) return null;
                const colors = CATEGORY_COLORS[category];
                return (
                  <div key={category}>
                    <button
                      onClick={() => setSelectedCategory(category)}
                      className={`w-full p-2 rounded-lg text-left transition-all ${colors.bg} ${colors.border} border ${
                        selectedCategory === category ? 'ring-1 ring-white/30' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${colors.text}`}>{category}</span>
                        <span className="war-room-badge text-[10px]">{categoryIdeas.length}</span>
                      </div>
                    </button>
                    {selectedCategory === category && (
                      <div className="mt-2 space-y-1 pl-2">
                        {ideas.filter(i => i.category !== category).slice(0, 5).map(idea => (
                          <button
                            key={idea.id}
                            onClick={() => handleCategorizeIdea(idea.id, category)}
                            className="w-full text-left p-2 text-xs war-room-text-secondary hover:bg-white/5 rounded"
                          >
                            + {idea.text.slice(0, 40)}...
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {ideas.filter(i => i.category !== 'Uncategorized').length >= ideas.length * 0.5 && (
                <button
                  onClick={() => proceedToPhase('converge')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Select Top Ideas
                </button>
              )}
            </div>
          )}

          {currentPhase === 'converge' && (
            <div className="space-y-3">
              <p className="text-xs war-room-text-secondary">
                Select your top 3-5 ideas ({topIdeas.length}/5 selected)
              </p>

              {sortedIdeas.map(idea => {
                const colors = CATEGORY_COLORS[idea.category];
                const isSelected = topIdeas.includes(idea.id);
                return (
                  <button
                    key={idea.id}
                    onClick={() => handleToggleTopIdea(idea.id)}
                    disabled={!isSelected && topIdeas.length >= 5}
                    className={`w-full war-room-panel p-3 text-left transition-all ${
                      isSelected ? 'ring-2 ring-yellow-500 bg-yellow-500/10' : ''
                    } ${!isSelected && topIdeas.length >= 5 ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-yellow-500 border-yellow-500' : 'border-white/30'
                      }`}>
                        {isSelected && <i className="fa fa-check text-black text-xs"></i>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm war-room-text-primary">{idea.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                            {idea.category}
                          </span>
                          <span className="text-[10px] text-yellow-400">
                            <i className="fa fa-arrow-up mr-0.5"></i>{idea.votes}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {topIdeas.length >= 3 && (
                <button
                  onClick={() => proceedToPhase('refine')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Refine Ideas
                </button>
              )}
            </div>
          )}

          {currentPhase === 'refine' && (
            <div className="space-y-3">
              <p className="text-xs war-room-text-secondary">
                Your selected ideas to develop:
              </p>

              {topIdeas.map((id, i) => {
                const idea = ideas.find(i => i.id === id);
                if (!idea) return null;
                return (
                  <div key={id} className="war-room-panel p-3 bg-yellow-500/10 border-yellow-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium war-room-text-primary">{idea.text}</span>
                    </div>
                    {idea.expanded && (
                      <p className="text-xs war-room-text-secondary pl-8">{idea.expanded}</p>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => handleAskAI('Create an action plan for implementing the top ideas')}
                disabled={isLoading}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-wand-magic-sparkles mr-2"></i>
                Generate Action Plan
              </button>
            </div>
          )}
        </div>

        {/* Export */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setShowExport(true)}
            className="w-full war-room-btn py-2"
          >
            <i className="fa fa-share-nodes mr-2"></i>
            Export Ideas
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                  <i className="fa fa-lightbulb text-2xl text-yellow-400"></i>
                </div>
                <h3 className="text-lg font-semibold war-room-text-primary mb-2">
                  Brainstorm Mission
                </h3>
                <p className="text-sm war-room-text-secondary">
                  A structured creative ideation process.
                  Define your challenge to begin!
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
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
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                      <i className="fa fa-lightbulb text-yellow-400 text-xs"></i>
                      <span className="text-xs text-yellow-400 font-medium">Creative AI</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="war-room-message-ai">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-yellow-500/30 flex items-center justify-center">
                    <i className="fa fa-lightbulb text-yellow-400 text-xs animate-pulse"></i>
                  </div>
                  <span className="text-sm war-room-text-secondary">Generating ideas...</span>
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
              <i className="fa fa-wand-magic-sparkles text-yellow-400 text-sm"></i>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask for more ideas, challenge assumptions..."
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
                <i className="fa fa-paper-plane text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExport && (
        <SessionExport
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          messages={messages}
          topic={challenge}
          mode="Brainstorm Mission"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
