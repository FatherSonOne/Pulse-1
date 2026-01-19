import React, { useState, useRef, useEffect } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';

interface Option {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  score?: number;
}

interface DecisionCriteria {
  id: string;
  name: string;
  weight: number; // 1-5
  description?: string;
}

type DecisionPhase = 'define' | 'options' | 'criteria' | 'evaluate' | 'decide';

interface DecisionMissionProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
  onNewSession?: () => void;
}

const PHASES: { id: DecisionPhase; label: string; icon: string; description: string }[] = [
  { id: 'define', label: 'Define', icon: 'fa-crosshairs', description: 'Clarify the decision' },
  { id: 'options', label: 'Options', icon: 'fa-list', description: 'List alternatives' },
  { id: 'criteria', label: 'Criteria', icon: 'fa-scale-balanced', description: 'Set evaluation factors' },
  { id: 'evaluate', label: 'Evaluate', icon: 'fa-chart-bar', description: 'Score options' },
  { id: 'decide', label: 'Decide', icon: 'fa-check-circle', description: 'Make the call' },
];

export const DecisionMission: React.FC<DecisionMissionProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Decision Mission',
  documents = []
}) => {
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<DecisionPhase>('define');
  const [decision, setDecision] = useState('');
  const [context, setContext] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [criteria, setCriteria] = useState<DecisionCriteria[]>([]);
  const [newOptionName, setNewOptionName] = useState('');
  const [newCriteriaName, setNewCriteriaName] = useState('');
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [finalChoice, setFinalChoice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDefineDecision = () => {
    if (!decision.trim()) return;
    setCurrentPhase('options');
    onSendMessage(`[DECISION MISSION - Phase 1: Define]
I need to make a decision about: "${decision}"
${context ? `\nContext: ${context}` : ''}

Help me clarify this decision by:
1. Restating it clearly
2. Identifying the key stakeholders
3. Understanding the timeline and constraints
4. Suggesting 3-5 potential options to consider`);
  };

  const handleAddOption = () => {
    if (!newOptionName.trim()) return;
    const newOption: Option = {
      id: `option-${Date.now()}`,
      name: newOptionName.trim(),
      description: '',
      pros: [],
      cons: []
    };
    setOptions([...options, newOption]);
    setNewOptionName('');
  };

  const handleRemoveOption = (id: string) => {
    setOptions(options.filter(o => o.id !== id));
    const newScores = { ...scores };
    delete newScores[id];
    setScores(newScores);
  };

  const handleAddCriteria = () => {
    if (!newCriteriaName.trim()) return;
    const newCrit: DecisionCriteria = {
      id: `criteria-${Date.now()}`,
      name: newCriteriaName.trim(),
      weight: 3
    };
    setCriteria([...criteria, newCrit]);
    setNewCriteriaName('');
  };

  const handleRemoveCriteria = (id: string) => {
    setCriteria(criteria.filter(c => c.id !== id));
  };

  const handleSetCriteriaWeight = (id: string, weight: number) => {
    setCriteria(criteria.map(c => c.id === id ? { ...c, weight } : c));
  };

  const handleSetScore = (optionId: string, criteriaId: string, score: number) => {
    setScores({
      ...scores,
      [optionId]: {
        ...(scores[optionId] || {}),
        [criteriaId]: score
      }
    });
  };

  const calculateOptionScore = (optionId: string): number => {
    const optionScores = scores[optionId] || {};
    let totalWeightedScore = 0;
    let totalWeight = 0;

    criteria.forEach(c => {
      const score = optionScores[c.id];
      if (score !== undefined) {
        totalWeightedScore += score * c.weight;
        totalWeight += c.weight;
      }
    });

    return totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 10) / 10 : 0;
  };

  const handleAskAI = (prompt: string) => {
    const phaseContext = `
Decision: ${decision}
Options: ${options.map(o => o.name).join(', ')}
Criteria: ${criteria.map(c => `${c.name} (weight: ${c.weight})`).join(', ')}
`;
    onSendMessage(`[DECISION MISSION - Phase: ${currentPhase}]\n${prompt}\n\nContext:${phaseContext}`);
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

  const proceedToPhase = (phase: DecisionPhase) => {
    setCurrentPhase(phase);

    const phasePrompts: Record<DecisionPhase, string> = {
      define: '',
      options: `Now in OPTIONS phase. Current options: ${options.map(o => o.name).join(', ') || 'None yet'}. Help me brainstorm more alternatives or evaluate these options.`,
      criteria: `Now in CRITERIA phase. Current criteria: ${criteria.map(c => c.name).join(', ') || 'None yet'}. Help me identify the key factors to consider when making this decision.`,
      evaluate: `Now in EVALUATE phase. Help me systematically evaluate each option against the criteria. Options: ${options.map(o => o.name).join(', ')}. Criteria: ${criteria.map(c => c.name).join(', ')}.`,
      decide: `Now in DECIDE phase. Based on our evaluation, help me make the final decision and create an action plan.`
    };

    if (phasePrompts[phase]) {
      onSendMessage(`[DECISION MISSION - Phase: ${phase}]\n${phasePrompts[phase]}`);
    }
  };

  const generateRecommendation = () => {
    const sortedOptions = [...options]
      .map(o => ({ ...o, score: calculateOptionScore(o.id) }))
      .sort((a, b) => b.score - a.score);

    handleAskAI(`Generate a decision recommendation based on the evaluation:

Options ranked by score:
${sortedOptions.map((o, i) => `${i + 1}. ${o.name}: ${o.score}/5`).join('\n')}

Criteria weights:
${criteria.map(c => `- ${c.name}: ${c.weight}/5`).join('\n')}

Provide:
1. Clear recommendation
2. Reasoning based on criteria
3. Potential risks and mitigations
4. Suggested next steps`);
  };

  const currentPhaseIndex = PHASES.findIndex(p => p.id === currentPhase);
  const rankedOptions = [...options]
    .map(o => ({ ...o, score: calculateOptionScore(o.id) }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="h-full w-full flex war-room-container overflow-hidden">
      {/* Progress & Control Panel */}
      <div className="w-80 shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        {/* Mission Header */}
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa fa-route text-cyan-400"></i>
            <h3 className="text-sm font-semibold war-room-text-primary">Decision Mission</h3>
          </div>
          {decision && (
            <p className="text-xs war-room-text-secondary line-clamp-2">{decision}</p>
          )}
        </div>

        {/* Phase Progress */}
        <div className="p-3 border-b border-white/10">
          <div className="space-y-1">
            {PHASES.map((phase, i) => {
              const isActive = phase.id === currentPhase;
              const isComplete = i < currentPhaseIndex;
              return (
                <button
                  key={phase.id}
                  onClick={() => i <= currentPhaseIndex && setCurrentPhase(phase.id)}
                  disabled={i > currentPhaseIndex}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 border border-cyan-500/40'
                      : isComplete
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    isComplete
                      ? 'bg-emerald-500 text-white'
                      : isActive
                      ? 'bg-cyan-500/30 text-cyan-400'
                      : 'bg-white/10 text-white/40'
                  }`}>
                    {isComplete ? <i className="fa fa-check"></i> : <i className={`fa ${phase.icon}`}></i>}
                  </div>
                  <div className="text-left">
                    <p className={`text-xs font-medium ${isActive ? 'text-cyan-400' : 'war-room-text-primary'}`}>
                      {phase.label}
                    </p>
                    <p className="text-[10px] war-room-text-secondary">{phase.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Phase-specific controls */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-3">
          {currentPhase === 'define' && !decision && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  What decision do you need to make?
                </label>
                <input
                  type="text"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  placeholder="e.g., Which vendor should we choose?"
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  Additional context (optional)
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Timeline, constraints, stakeholders..."
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none resize-none h-20"
                />
              </div>
              <button
                onClick={handleDefineDecision}
                disabled={!decision.trim()}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-arrow-right mr-2"></i>
                Start Mission
              </button>
            </div>
          )}

          {currentPhase === 'options' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                  placeholder="Add option..."
                  className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none"
                />
                <button
                  onClick={handleAddOption}
                  disabled={!newOptionName.trim()}
                  className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
                >
                  <i className="fa fa-plus text-xs"></i>
                </button>
              </div>

              <div className="space-y-2">
                {options.map((option, i) => (
                  <div key={option.id} className="war-room-panel p-3 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="text-sm war-room-text-primary">{option.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveOption(option.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400"
                      >
                        <i className="fa fa-times text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {options.length >= 2 && (
                <button
                  onClick={() => proceedToPhase('criteria')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Define Criteria
                </button>
              )}
            </div>
          )}

          {currentPhase === 'criteria' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCriteriaName}
                  onChange={(e) => setNewCriteriaName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCriteria()}
                  placeholder="Add criteria..."
                  className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none"
                />
                <button
                  onClick={handleAddCriteria}
                  disabled={!newCriteriaName.trim()}
                  className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
                >
                  <i className="fa fa-plus text-xs"></i>
                </button>
              </div>

              <div className="space-y-2">
                {criteria.map(crit => (
                  <div key={crit.id} className="war-room-panel p-3 group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm war-room-text-primary">{crit.name}</span>
                      <button
                        onClick={() => handleRemoveCriteria(crit.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400"
                      >
                        <i className="fa fa-times text-xs"></i>
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs war-room-text-secondary mr-2">Weight:</span>
                      {[1, 2, 3, 4, 5].map(w => (
                        <button
                          key={w}
                          onClick={() => handleSetCriteriaWeight(crit.id, w)}
                          className={`w-6 h-6 rounded text-xs ${
                            crit.weight >= w
                              ? 'bg-cyan-500 text-white'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {criteria.length >= 2 && (
                <button
                  onClick={() => proceedToPhase('evaluate')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Start Evaluation
                </button>
              )}
            </div>
          )}

          {currentPhase === 'evaluate' && (
            <div className="space-y-4">
              <p className="text-xs war-room-text-secondary">
                Rate each option on each criteria (1-5)
              </p>

              {options.map(option => (
                <div key={option.id} className="war-room-panel p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium war-room-text-primary">{option.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      calculateOptionScore(option.id) >= 4 ? 'bg-emerald-500/20 text-emerald-400' :
                      calculateOptionScore(option.id) >= 3 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-white/10 war-room-text-secondary'
                    }`}>
                      {calculateOptionScore(option.id)}/5
                    </span>
                  </div>

                  <div className="space-y-2">
                    {criteria.map(crit => (
                      <div key={crit.id} className="flex items-center justify-between">
                        <span className="text-xs war-room-text-secondary flex-1">{crit.name}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(score => (
                            <button
                              key={score}
                              onClick={() => handleSetScore(option.id, crit.id, score)}
                              className={`w-5 h-5 rounded text-[10px] ${
                                (scores[option.id]?.[crit.id] || 0) >= score
                                  ? 'bg-cyan-500 text-white'
                                  : 'bg-white/10 text-white/40'
                              }`}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={() => proceedToPhase('decide')}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-arrow-right mr-2"></i>
                Make Decision
              </button>
            </div>
          )}

          {currentPhase === 'decide' && (
            <div className="space-y-4">
              <p className="text-xs war-room-text-secondary mb-3">
                Ranked options by score:
              </p>

              {rankedOptions.map((option, i) => (
                <button
                  key={option.id}
                  onClick={() => setFinalChoice(option.id)}
                  className={`w-full war-room-panel p-3 text-left transition-all ${
                    finalChoice === option.id
                      ? 'ring-2 ring-emerald-500 bg-emerald-500/10'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-500 text-black' :
                        i === 1 ? 'bg-gray-400 text-black' :
                        i === 2 ? 'bg-orange-700 text-white' :
                        'bg-white/10 text-white/40'
                      }`}>{i + 1}</span>
                      <span className="text-sm war-room-text-primary">{option.name}</span>
                    </div>
                    <span className="text-sm font-medium text-cyan-400">{option.score}/5</span>
                  </div>
                  {finalChoice === option.id && (
                    <div className="mt-2 flex items-center gap-1 text-emerald-400">
                      <i className="fa fa-check-circle"></i>
                      <span className="text-xs">Selected</span>
                    </div>
                  )}
                </button>
              ))}

              <button
                onClick={generateRecommendation}
                disabled={isLoading}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-wand-magic-sparkles mr-2"></i>
                Generate Recommendation
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
            Export Decision
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
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                  <i className="fa fa-route text-2xl text-cyan-400"></i>
                </div>
                <h3 className="text-lg font-semibold war-room-text-primary mb-2">
                  Decision Mission
                </h3>
                <p className="text-sm war-room-text-secondary">
                  A structured framework for making important decisions.
                  Define your decision to begin.
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
                      <i className="fa fa-route text-cyan-400 text-xs"></i>
                      <span className="text-xs text-cyan-400 font-medium">Decision Guide</span>
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
                  <div className="w-5 h-5 rounded-full bg-cyan-500/30 flex items-center justify-center">
                    <i className="fa fa-route text-cyan-400 text-xs animate-pulse"></i>
                  </div>
                  <span className="text-sm war-room-text-secondary">Analyzing decision...</span>
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
              <i className="fa fa-comments text-cyan-400 text-sm"></i>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask questions or discuss the decision..."
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
          topic={decision}
          mode="Decision Mission"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
