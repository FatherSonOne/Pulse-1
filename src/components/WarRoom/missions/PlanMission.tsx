import React, { useState, useRef, useEffect } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';

interface Milestone {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  owner?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface Risk {
  id: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  mitigation?: string;
}

type PlanPhase = 'define' | 'scope' | 'milestones' | 'risks' | 'finalize';

interface PlanMissionProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
  onNewSession?: () => void;
}

const PHASES: { id: PlanPhase; label: string; icon: string; description: string }[] = [
  { id: 'define', label: 'Define', icon: 'fa-crosshairs', description: 'Set goals & objectives' },
  { id: 'scope', label: 'Scope', icon: 'fa-expand', description: 'Define boundaries' },
  { id: 'milestones', label: 'Milestones', icon: 'fa-flag-checkered', description: 'Break into phases' },
  { id: 'risks', label: 'Risks', icon: 'fa-shield', description: 'Identify risks' },
  { id: 'finalize', label: 'Finalize', icon: 'fa-check-double', description: 'Review & commit' },
];

export const PlanMission: React.FC<PlanMissionProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Plan Mission',
  documents = []
}) => {
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<PlanPhase>('define');
  const [projectName, setProjectName] = useState('');
  const [projectGoal, setProjectGoal] = useState('');
  const [successCriteria, setSuccessCriteria] = useState<string[]>([]);
  const [newCriterion, setNewCriterion] = useState('');
  const [inScope, setInScope] = useState<string[]>([]);
  const [outOfScope, setOutOfScope] = useState<string[]>([]);
  const [newScopeItem, setNewScopeItem] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [risks, setRisks] = useState<Risk[]>([]);
  const [newRiskText, setNewRiskText] = useState('');
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDefineProject = () => {
    if (!projectName.trim() || !projectGoal.trim()) return;
    setCurrentPhase('scope');
    onSendMessage(`[PLAN MISSION - Phase 1: Define]
Project: "${projectName}"
Goal: "${projectGoal}"
Success Criteria: ${successCriteria.join('; ') || 'Not yet defined'}

Help me clarify:
1. Is the goal SMART (Specific, Measurable, Achievable, Relevant, Time-bound)?
2. What should success look like?
3. Who are the key stakeholders?
4. What constraints should we consider?`);
  };

  const handleAddCriterion = () => {
    if (!newCriterion.trim()) return;
    setSuccessCriteria([...successCriteria, newCriterion.trim()]);
    setNewCriterion('');
  };

  const handleAddScopeItem = (inScopeList: boolean) => {
    if (!newScopeItem.trim()) return;
    if (inScopeList) {
      setInScope([...inScope, newScopeItem.trim()]);
    } else {
      setOutOfScope([...outOfScope, newScopeItem.trim()]);
    }
    setNewScopeItem('');
  };

  const handleAddMilestone = () => {
    if (!newMilestoneName.trim()) return;
    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      name: newMilestoneName.trim(),
      description: '',
      status: 'pending',
      tasks: []
    };
    setMilestones([...milestones, newMilestone]);
    setNewMilestoneName('');
  };

  const handleAddTask = (milestoneId: string, taskName: string) => {
    if (!taskName.trim()) return;
    setMilestones(milestones.map(m => {
      if (m.id === milestoneId) {
        return {
          ...m,
          tasks: [...m.tasks, {
            id: `task-${Date.now()}`,
            name: taskName.trim(),
            status: 'pending'
          }]
        };
      }
      return m;
    }));
  };

  const handleAddRisk = () => {
    if (!newRiskText.trim()) return;
    const newRisk: Risk = {
      id: `risk-${Date.now()}`,
      description: newRiskText.trim(),
      impact: 'medium'
    };
    setRisks([...risks, newRisk]);
    setNewRiskText('');
  };

  const handleSetRiskImpact = (id: string, impact: Risk['impact']) => {
    setRisks(risks.map(r => r.id === id ? { ...r, impact } : r));
  };

  const handleAskAI = (prompt: string) => {
    const planContext = `
Project: ${projectName}
Goal: ${projectGoal}
Success Criteria: ${successCriteria.join('; ')}
In Scope: ${inScope.join('; ')}
Out of Scope: ${outOfScope.join('; ')}
Milestones: ${milestones.map(m => `${m.name} (${m.tasks.length} tasks)`).join(', ')}
Risks: ${risks.map(r => `[${r.impact}] ${r.description}`).join('; ')}
`;
    onSendMessage(`[PLAN MISSION - Phase: ${currentPhase}]\n${prompt}\n\nPlan Context:${planContext}`);
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

  const proceedToPhase = (phase: PlanPhase) => {
    setCurrentPhase(phase);

    const phasePrompts: Record<PlanPhase, string> = {
      define: '',
      scope: `SCOPE phase: Help me define what's in and out of scope for "${projectName}".
In scope: ${inScope.join(', ') || 'Nothing defined yet'}
Out of scope: ${outOfScope.join(', ') || 'Nothing defined yet'}
Suggest items for both lists.`,
      milestones: `MILESTONES phase: Help me break "${projectName}" into key milestones and tasks.
Current milestones: ${milestones.map(m => m.name).join(', ') || 'None yet'}
What are the major phases and deliverables?`,
      risks: `RISKS phase: Help me identify potential risks for "${projectName}".
Current risks: ${risks.map(r => r.description).join(', ') || 'None identified yet'}
What could go wrong? What should we plan for?`,
      finalize: `FINALIZE phase: Review the complete plan for "${projectName}".
Generate an executive summary including:
1. Project overview
2. Success criteria
3. Key milestones with timeline
4. Top risks and mitigations
5. Recommended next steps`
    };

    if (phasePrompts[phase]) {
      onSendMessage(`[PLAN MISSION - Phase: ${phase}]\n${phasePrompts[phase]}`);
    }
  };

  const currentPhaseIndex = PHASES.findIndex(p => p.id === currentPhase);
  const totalTasks = milestones.reduce((sum, m) => sum + m.tasks.length, 0);
  const completedTasks = milestones.reduce((sum, m) => sum + m.tasks.filter(t => t.status === 'completed').length, 0);

  return (
    <div className="h-full w-full flex war-room-container overflow-hidden">
      {/* Progress & Control Panel */}
      <div className="w-80 shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        {/* Mission Header */}
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-rose-500/10 to-pink-500/10">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa fa-map text-rose-500"></i>
            <h3 className="text-sm font-semibold text-black dark:text-white">Plan Mission</h3>
          </div>
          {projectName && (
            <p className="text-xs war-room-text-secondary line-clamp-2">{projectName}</p>
          )}
          {totalTasks > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                />
              </div>
              <span className="text-xs war-room-text-secondary">
                {completedTasks}/{totalTasks}
              </span>
            </div>
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
                      ? 'bg-rose-500/20 border border-rose-500/40'
                      : isComplete
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    isComplete
                      ? 'bg-rose-500 text-white'
                      : isActive
                      ? 'bg-rose-500/30 text-rose-400'
                      : 'bg-white/10 text-white/40'
                  }`}>
                    {isComplete ? <i className="fa fa-check"></i> : <i className={`fa ${phase.icon}`}></i>}
                  </div>
                  <div className="text-left">
                    <p className={`text-xs font-medium ${isActive ? 'text-rose-400' : 'text-black dark:text-white'}`}>
                      {phase.label}
                    </p>
                    <p className="text-[10px] war-room-text-secondary">{phase.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Phase Content */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-3">
          {currentPhase === 'define' && !projectName && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-rose-500 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Q1 Product Launch"
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-rose-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-rose-500 mb-2">
                  Primary Goal
                </label>
                <textarea
                  value={projectGoal}
                  onChange={(e) => setProjectGoal(e.target.value)}
                  placeholder="What are you trying to achieve?"
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-rose-500/50 focus:outline-none resize-none h-20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-rose-500 mb-2">
                  Success Criteria
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newCriterion}
                    onChange={(e) => setNewCriterion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCriterion()}
                    placeholder="Add criterion..."
                    className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none"
                  />
                  <button
                    onClick={handleAddCriterion}
                    disabled={!newCriterion.trim()}
                    className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
                  >
                    <i className="fa fa-plus text-xs"></i>
                  </button>
                </div>
                <div className="space-y-1">
                  {successCriteria.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs war-room-text-secondary">
                      <i className="fa fa-check-circle text-rose-500"></i>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleDefineProject}
                disabled={!projectName.trim() || !projectGoal.trim()}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-arrow-right mr-2"></i>
                Define Scope
              </button>
            </div>
          )}

          {currentPhase === 'scope' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newScopeItem}
                  onChange={(e) => setNewScopeItem(e.target.value)}
                  placeholder="Add scope item..."
                  className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddScopeItem(true)}
                  disabled={!newScopeItem.trim()}
                  className="flex-1 war-room-btn py-2 text-xs bg-rose-500/20 text-rose-400"
                >
                  <i className="fa fa-plus mr-1"></i> In Scope
                </button>
                <button
                  onClick={() => handleAddScopeItem(false)}
                  disabled={!newScopeItem.trim()}
                  className="flex-1 war-room-btn py-2 text-xs bg-red-500/20 text-red-400"
                >
                  <i className="fa fa-minus mr-1"></i> Out of Scope
                </button>
              </div>

              <div className="war-room-panel p-3 bg-rose-500/10 border-rose-500/30">
                <h4 className="text-xs font-semibold text-rose-400 mb-2">
                  <i className="fa fa-check-circle mr-1"></i> In Scope
                </h4>
                <div className="space-y-1">
                  {inScope.map((item, i) => (
                    <div key={i} className="text-xs text-black dark:text-white">• {item}</div>
                  ))}
                  {inScope.length === 0 && (
                    <p className="text-xs war-room-text-secondary italic">No items</p>
                  )}
                </div>
              </div>

              <div className="war-room-panel p-3 bg-red-500/10 border-red-500/30">
                <h4 className="text-xs font-semibold text-red-400 mb-2">
                  <i className="fa fa-times-circle mr-1"></i> Out of Scope
                </h4>
                <div className="space-y-1">
                  {outOfScope.map((item, i) => (
                    <div key={i} className="text-xs text-black dark:text-white">• {item}</div>
                  ))}
                  {outOfScope.length === 0 && (
                    <p className="text-xs war-room-text-secondary italic">No items</p>
                  )}
                </div>
              </div>

              {(inScope.length > 0 || outOfScope.length > 0) && (
                <button
                  onClick={() => proceedToPhase('milestones')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Define Milestones
                </button>
              )}
            </div>
          )}

          {currentPhase === 'milestones' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMilestone()}
                  placeholder="Add milestone..."
                  className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none"
                />
                <button
                  onClick={handleAddMilestone}
                  disabled={!newMilestoneName.trim()}
                  className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
                >
                  <i className="fa fa-plus text-xs"></i>
                </button>
              </div>

              <div className="space-y-2">
                {milestones.map((milestone, i) => (
                  <div key={milestone.id} className="war-room-panel p-3">
                    <button
                      onClick={() => setExpandedMilestone(
                        expandedMilestone === milestone.id ? null : milestone.id
                      )}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 text-xs flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-sm text-black dark:text-white">{milestone.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="war-room-badge text-[10px]">{milestone.tasks.length}</span>
                        <i className={`fa fa-chevron-${expandedMilestone === milestone.id ? 'up' : 'down'} text-xs`}></i>
                      </div>
                    </button>

                    {expandedMilestone === milestone.id && (
                      <div className="mt-3 pl-8 space-y-2">
                        {milestone.tasks.map(task => (
                          <div key={task.id} className="flex items-center gap-2 text-xs war-room-text-secondary">
                            <i className="fa fa-circle text-[6px]"></i>
                            <span>{task.name}</span>
                          </div>
                        ))}
                        <input
                          type="text"
                          placeholder="Add task..."
                          className="w-full px-2 py-1 bg-black/30 border border-white/10 rounded text-xs text-white placeholder-white/40 focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddTask(milestone.id, (e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {milestones.length >= 2 && (
                <button
                  onClick={() => proceedToPhase('risks')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Identify Risks
                </button>
              )}
            </div>
          )}

          {currentPhase === 'risks' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRiskText}
                  onChange={(e) => setNewRiskText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRisk()}
                  placeholder="Add risk..."
                  className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none"
                />
                <button
                  onClick={handleAddRisk}
                  disabled={!newRiskText.trim()}
                  className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
                >
                  <i className="fa fa-plus text-xs"></i>
                </button>
              </div>

              <div className="space-y-2">
                {risks.map(risk => (
                  <div key={risk.id} className={`war-room-panel p-3 ${
                    risk.impact === 'high' ? 'bg-red-500/10 border-red-500/30' :
                    risk.impact === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-blue-500/10 border-blue-500/30'
                  }`}>
                    <p className="text-sm text-black dark:text-white mb-2">{risk.description}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-xs war-room-text-secondary mr-2">Impact:</span>
                      {(['low', 'medium', 'high'] as const).map(level => (
                        <button
                          key={level}
                          onClick={() => handleSetRiskImpact(risk.id, level)}
                          className={`px-2 py-0.5 rounded text-xs capitalize ${
                            risk.impact === level
                              ? level === 'high' ? 'bg-red-500 text-white' :
                                level === 'medium' ? 'bg-yellow-500 text-black' :
                                'bg-blue-500 text-white'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {risks.length >= 1 && (
                <button
                  onClick={() => proceedToPhase('finalize')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Finalize Plan
                </button>
              )}
            </div>
          )}

          {currentPhase === 'finalize' && (
            <div className="space-y-4">
              <div className="war-room-panel p-3 bg-rose-500/10 border-rose-500/30">
                <h4 className="text-xs font-semibold text-rose-400 mb-2">Plan Summary</h4>
                <div className="space-y-2 text-xs war-room-text-secondary">
                  <p><strong>Project:</strong> {projectName}</p>
                  <p><strong>Goal:</strong> {projectGoal}</p>
                  <p><strong>Milestones:</strong> {milestones.length}</p>
                  <p><strong>Tasks:</strong> {totalTasks}</p>
                  <p><strong>Risks:</strong> {risks.length}</p>
                </div>
              </div>

              <button
                onClick={() => handleAskAI('Generate a complete project plan document with timeline, resource needs, and implementation details')}
                disabled={isLoading}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-wand-magic-sparkles mr-2"></i>
                Generate Plan Document
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
            Export Plan
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
                  <i className="fa fa-map text-2xl text-rose-500"></i>
                </div>
                <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                  Plan Mission
                </h3>
                <p className="text-sm war-room-text-secondary">
                  A structured framework for project planning.
                  Define your project to begin.
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
                      <i className="fa fa-map text-rose-500 text-xs"></i>
                      <span className="text-xs text-rose-500 font-medium">Planning AI</span>
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
                  <div className="w-5 h-5 rounded-full bg-rose-500/30 flex items-center justify-center">
                    <i className="fa fa-map text-rose-500 text-xs animate-pulse"></i>
                  </div>
                  <span className="text-sm war-room-text-secondary">Planning...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 p-4 war-room-input-area">
          <div className="flex items-center gap-2">
            <div className="flex-1 war-room-panel-inset flex items-center gap-2 px-4 py-3">
              <i className="fa fa-comments text-rose-500 text-sm"></i>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask for help with your plan..."
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
          topic={projectName}
          mode="Plan Mission"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
