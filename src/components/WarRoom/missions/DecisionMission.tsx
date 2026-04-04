import React, { useState, useEffect } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { dataService } from '../../../services/dataService';
import { warRoomAudit } from '../../../services/warRoomAuditService';
import { SessionExport } from '../shared';
import { useMissionPhases, MissionPhaseConfig } from './useMissionPhases';
import { MissionShell } from './MissionShell';
import toast from 'react-hot-toast';

import { ArrowRight, BookOpen, Check, CheckCircle, MessagesSquare, Plus, Route, Send, Share2, Wand2, X } from 'lucide-react';

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
  weight: number;
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
  activeContextCount?: number;
}

const PHASES: MissionPhaseConfig[] = [
  { id: 'define', label: 'Define', icon: 'fa-crosshairs', description: 'Clarify the decision' },
  { id: 'options', label: 'Options', icon: 'fa-list', description: 'List alternatives' },
  { id: 'criteria', label: 'Criteria', icon: 'fa-scale-balanced', description: 'Set evaluation factors' },
  { id: 'evaluate', label: 'Evaluate', icon: 'fa-chart-bar', description: 'Score options' },
  { id: 'decide', label: 'Decide', icon: 'fa-check-circle', description: 'Make the call' },
];

const DecisionMissionComponent: React.FC<DecisionMissionProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Decision Mission',
  documents = [],
  activeContextCount = 0
}) => {
  const [decision, setDecision] = useState('');
  const [context, setContext] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [criteria, setCriteria] = useState<DecisionCriteria[]>([]);
  const [newOptionName, setNewOptionName] = useState('');
  const [newCriteriaName, setNewCriteriaName] = useState('');
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [finalChoice, setFinalChoice] = useState<string | null>(null);

  const mission = useMissionPhases({
    phases: PHASES,
    initialPhase: 'define',
    onSendMessage,
    missionLabel: 'DECISION MISSION',
  });

  useEffect(() => {
    mission.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDefineDecision = () => {
    if (!decision.trim()) return;
    mission.setCurrentPhase('options');
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
    onSendMessage(`[DECISION MISSION - Phase: ${mission.currentPhase}]\n${prompt}\n\nContext:${phaseContext}`);
  };

  const proceedToPhase = (phase: DecisionPhase) => {
    mission.setCurrentPhase(phase);

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

  const rankedOptions = [...options]
    .map(o => ({ ...o, score: calculateOptionScore(o.id) }))
    .sort((a, b) => b.score - a.score);

  // Build sidebar content based on current phase
  const sidebarContent = (
    <>
      {mission.currentPhase === 'define' && (
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
            <ArrowRight className="fa mr-2" />
            Start Mission
          </button>
        </div>
      )}

      {mission.currentPhase === 'options' && (
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
              aria-label="Add option"
            >
              <Plus className="fa text-xs" />
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
                    title="Remove option"
                  >
                    <X className="fa text-xs" />
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
              <ArrowRight className="fa mr-2" />
              Define Criteria
            </button>
          )}
        </div>
      )}

      {mission.currentPhase === 'criteria' && (
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
              aria-label="Add criteria"
            >
              <Plus className="fa text-xs" />
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
                    title="Remove criteria"
                  >
                    <X className="fa text-xs" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs war-room-text-secondary mr-2">Weight:</span>
                  {[1, 2, 3, 4, 5].map(w => (
                    <button
                      key={w}
                      onClick={() => handleSetCriteriaWeight(crit.id, w)}
                      className={`w-6 h-6 rounded text-xs ${crit.weight >= w
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
              <ArrowRight className="fa mr-2" />
              Start Evaluation
            </button>
          )}
        </div>
      )}

      {mission.currentPhase === 'evaluate' && (
        <div className="space-y-4">
          <p className="text-xs war-room-text-secondary">
            Rate each option on each criteria (1-5)
          </p>
          {options.map(option => (
            <div key={option.id} className="war-room-panel p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium war-room-text-primary">{option.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${calculateOptionScore(option.id) >= 4 ? 'bg-emerald-500/20 text-emerald-400' :
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
                          className={`w-5 h-5 rounded text-[10px] ${(scores[option.id]?.[crit.id] || 0) >= score
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
            <ArrowRight className="fa mr-2" />
            Make Decision
          </button>
        </div>
      )}

      {mission.currentPhase === 'decide' && (
        <div className="space-y-4">
          <p className="text-xs war-room-text-secondary mb-3">
            Ranked options by score:
          </p>
          {rankedOptions.map((option, i) => (
            <button
              key={option.id}
              onClick={() => setFinalChoice(option.id)}
              className={`w-full war-room-panel p-3 text-left transition-all ${finalChoice === option.id
                  ? 'ring-2 ring-emerald-500 bg-emerald-500/10'
                  : 'hover:bg-white/5'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' :
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
                  <CheckCircle className="fa" />
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
            <Wand2 className="fa mr-2" />
            Generate Recommendation
          </button>
          {finalChoice && (
            <button
              onClick={async () => {
                const selectedOption = options.find(o => o.id === finalChoice);
                const decisionSummary = `Decision: ${decision}\n\nChosen Option: ${selectedOption?.name}\nScore: ${calculateOptionScore(finalChoice)}/5\n\nOptions Considered:\n${rankedOptions.map((o, i) => `${i + 1}. ${o.name} (${o.score}/5)`).join('\n')}\n\nCriteria:\n${criteria.map(c => `- ${c.name} (weight: ${c.weight})`).join('\n')}`;
                try {
                  await dataService.createArchive({
                    type: 'decision_log',
                    title: `Decision: ${decision.substring(0, 80)}${decision.length > 80 ? '...' : ''}`,
                    content: decisionSummary,
                    date: new Date(),
                    tags: ['decision', 'war-room', 'mission'],
                    metadata: {
                      missionType: 'decision',
                      decision,
                      chosenOption: selectedOption?.name,
                      chosenOptionId: finalChoice,
                      options: options.map(o => ({ name: o.name, description: o.description })),
                      criteria: criteria.map(c => ({ name: c.name, weight: c.weight })),
                      scores,
                    },
                  });
                  warRoomAudit.decisionRecorded(decision);
                  toast.success('Decision saved to Archives');
                } catch (error) {
                  console.error('Failed to save decision:', error);
                  toast.error('Failed to save decision');
                }
              }}
              className="w-full war-room-btn bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-3 font-semibold"
            >
              <CheckCircle className="fa mr-2" />
              Complete & Save Decision
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <MissionShell
      missionTitle="Decision Mission"
      missionIcon="fa-route"
      accentColor="cyan"
      phases={PHASES}
      currentPhase={mission.currentPhase}
      currentPhaseIndex={mission.currentPhaseIndex}
      onPhaseClick={(phaseId) => mission.currentPhaseIndex >= PHASES.findIndex(p => p.id === phaseId) && mission.setCurrentPhase(phaseId)}
      messages={messages}
      isLoading={isLoading}
      input={mission.input}
      onInputChange={mission.setInput}
      onSend={mission.handleSend}
      onKeyDown={mission.handleKeyDown}
      messagesEndRef={mission.messagesEndRef}
      showExport={mission.showExport}
      onShowExport={mission.setShowExport}
      sessionId={sessionId}
      sessionTitle={sessionTitle}
      exportTopic={decision}
      exportMode="Decision Mission"
      documents={documents}
      activeContextCount={activeContextCount}
      sidebarContent={sidebarContent}
      sidebarFooter={
        <button
          onClick={() => mission.setShowExport(true)}
          className="w-full war-room-btn py-2"
        >
          <Share2 className="fa mr-2" />
          Export Decision
        </button>
      }
      chatEmptyState={
        <div className="h-full flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Route className="fa text-2xl text-cyan-400" />
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
      }
      messageExtra={(msg) => (
        msg.role === 'assistant' ? (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
            <Route className="fa text-cyan-400 text-xs" />
            <span className="text-xs text-cyan-400 font-medium">Decision Guide</span>
          </div>
        ) : null
      )}
      loadingLabel="Analyzing decision..."
      inputPlaceholder="Ask questions or discuss the decision..."
      inputIcon={<MessagesSquare className="fa text-cyan-400 text-sm" />}
    />
  );
};

export const DecisionMission = React.memo(DecisionMissionComponent, (prevProps, nextProps) => {
  return (
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.thinkingLogs.size === nextProps.thinkingLogs.size &&
    prevProps.sessionId === nextProps.sessionId
  );
});
