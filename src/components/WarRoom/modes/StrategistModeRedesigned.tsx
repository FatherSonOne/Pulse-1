import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';
import './StrategistModeRedesigned.css';

// ============= TYPES =============

interface ProConItem {
  id: string;
  text: string;
  weight: 'high' | 'medium' | 'low';
}

interface RiskItem {
  id: string;
  description: string;
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation?: string;
}

interface Scenario {
  id: string;
  type: 'best' | 'likely' | 'worst';
  description: string;
  probability: number;
  impact: string;
}

interface Stakeholder {
  id: string;
  name: string;
  quadrant: 'high-power-high-interest' | 'high-power-low-interest' | 'low-power-high-interest' | 'low-power-low-interest';
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  date: string;
  status: 'completed' | 'current' | 'future';
}

interface MatrixOption {
  id: string;
  name: string;
}

interface MatrixCriterion {
  id: string;
  name: string;
  weight: number;
}

interface MatrixScore {
  optionId: string;
  criterionId: string;
  score: number;
}

interface StrategistModeRedesignedProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
}

type TabType = 'discussion' | 'proscons' | 'risks' | 'matrix' | 'scenarios' | 'stakeholders' | 'timeline';

// ============= CONSTANTS =============

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'discussion', label: 'Discussion', icon: 'fa-comments' },
  { id: 'proscons', label: 'Pros & Cons', icon: 'fa-scale-balanced' },
  { id: 'risks', label: 'Risks', icon: 'fa-triangle-exclamation' },
  { id: 'matrix', label: 'Decision Matrix', icon: 'fa-table-cells' },
  { id: 'scenarios', label: 'Scenarios', icon: 'fa-code-branch' },
  { id: 'stakeholders', label: 'Stakeholders', icon: 'fa-users' },
  { id: 'timeline', label: 'Timeline', icon: 'fa-timeline' },
];

const DECISION_TEMPLATES = [
  { icon: 'fa-building', text: 'Business expansion decision' },
  { icon: 'fa-users-gear', text: 'Team restructuring' },
  { icon: 'fa-chart-line', text: 'Investment decision' },
  { icon: 'fa-rocket', text: 'Product launch strategy' },
];

const QUICK_PROMPTS = [
  'What are the key factors?',
  'Analyze trade-offs',
  'Identify blind spots',
  'Compare alternatives',
  'Recommend next steps',
];

const QUADRANT_CONFIG = {
  'high-power-high-interest': { title: 'Manage Closely', action: 'Key Players' },
  'high-power-low-interest': { title: 'Keep Satisfied', action: 'Keep Informed' },
  'low-power-high-interest': { title: 'Keep Informed', action: 'Show Consideration' },
  'low-power-low-interest': { title: 'Monitor', action: 'Minimal Effort' },
};

// ============= COMPONENT =============

export const StrategistModeRedesigned: React.FC<StrategistModeRedesignedProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Strategy Session',
  documents = []
}) => {
  // Core state
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [decisionQuestion, setDecisionQuestion] = useState('');
  const [isDecisionSet, setIsDecisionSet] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('discussion');

  // Pros & Cons
  const [pros, setPros] = useState<ProConItem[]>([]);
  const [cons, setCons] = useState<ProConItem[]>([]);

  // Risks
  const [risks, setRisks] = useState<RiskItem[]>([]);

  // Decision Matrix
  const [matrixOptions, setMatrixOptions] = useState<MatrixOption[]>([
    { id: 'opt-1', name: 'Option A' },
    { id: 'opt-2', name: 'Option B' },
  ]);
  const [matrixCriteria, setMatrixCriteria] = useState<MatrixCriterion[]>([
    { id: 'crit-1', name: 'Cost', weight: 3 },
    { id: 'crit-2', name: 'Time', weight: 2 },
    { id: 'crit-3', name: 'Quality', weight: 3 },
  ]);
  const [matrixScores, setMatrixScores] = useState<MatrixScore[]>([]);

  // Scenarios
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: 'scen-1', type: 'best', description: '', probability: 20, impact: '' },
    { id: 'scen-2', type: 'likely', description: '', probability: 60, impact: '' },
    { id: 'scen-3', type: 'worst', description: '', probability: 20, impact: '' },
  ]);

  // Stakeholders
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [newStakeholderName, setNewStakeholderName] = useState('');
  const [activeQuadrant, setActiveQuadrant] = useState<Stakeholder['quadrant'] | null>(null);

  // Timeline
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: 'ms-1', title: 'Decision Point', description: 'Finalize strategic direction', date: '', status: 'current' },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============= HANDLERS =============

  const handleSetDecision = useCallback(() => {
    if (!decisionQuestion.trim()) return;
    setIsDecisionSet(true);
    onSendMessage(`I need to make a strategic decision about: "${decisionQuestion}".

Please help me analyze this decision by:
1. Identifying key factors and considerations
2. Suggesting potential pros and cons to evaluate
3. Highlighting risks I should assess
4. Recommending a structured approach to this decision`);
  }, [decisionQuestion, onSendMessage]);

  const handleSend = useCallback(() => {
    const message = input.trim();
    if (!message) return;
    onSendMessage(message);
    setInput('');
  }, [input, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleQuickPrompt = useCallback((prompt: string) => {
    onSendMessage(`[Strategic Analysis] ${prompt} for the decision: "${decisionQuestion}"`);
  }, [decisionQuestion, onSendMessage]);

  // Pro/Con handlers
  const addPro = useCallback(() => {
    setPros(prev => [...prev, { id: `pro-${Date.now()}`, text: '', weight: 'medium' }]);
  }, []);

  const addCon = useCallback(() => {
    setCons(prev => [...prev, { id: `con-${Date.now()}`, text: '', weight: 'medium' }]);
  }, []);

  const updatePro = useCallback((id: string, updates: Partial<ProConItem>) => {
    setPros(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const updateCon = useCallback((id: string, updates: Partial<ProConItem>) => {
    setCons(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const removePro = useCallback((id: string) => setPros(prev => prev.filter(p => p.id !== id)), []);
  const removeCon = useCallback((id: string) => setCons(prev => prev.filter(c => c.id !== id)), []);

  // Risk handlers
  const addRisk = useCallback(() => {
    setRisks(prev => [...prev, {
      id: `risk-${Date.now()}`,
      description: '',
      likelihood: 'medium',
      impact: 'medium'
    }]);
  }, []);

  const updateRisk = useCallback((id: string, updates: Partial<RiskItem>) => {
    setRisks(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const removeRisk = useCallback((id: string) => setRisks(prev => prev.filter(r => r.id !== id)), []);

  const getRiskLevel = useCallback((likelihood: string, impact: string): string => {
    if (likelihood === 'high' && impact === 'high') return 'critical';
    if (likelihood === 'high' || impact === 'high') return 'high';
    if (likelihood === 'medium' && impact === 'medium') return 'medium';
    return 'low';
  }, []);

  // Matrix handlers
  const getMatrixScore = useCallback((optionId: string, criterionId: string): number => {
    const score = matrixScores.find(s => s.optionId === optionId && s.criterionId === criterionId);
    return score?.score ?? 0;
  }, [matrixScores]);

  const setMatrixScore = useCallback((optionId: string, criterionId: string, score: number) => {
    setMatrixScores(prev => {
      const existing = prev.findIndex(s => s.optionId === optionId && s.criterionId === criterionId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { optionId, criterionId, score };
        return updated;
      }
      return [...prev, { optionId, criterionId, score }];
    });
  }, []);

  const calculateOptionTotal = useCallback((optionId: string): number => {
    return matrixCriteria.reduce((total, criterion) => {
      const score = getMatrixScore(optionId, criterion.id);
      return total + (score * criterion.weight);
    }, 0);
  }, [matrixCriteria, getMatrixScore]);

  const addMatrixOption = useCallback(() => {
    setMatrixOptions(prev => [...prev, { id: `opt-${Date.now()}`, name: `Option ${prev.length + 1}` }]);
  }, []);

  const addMatrixCriterion = useCallback(() => {
    setMatrixCriteria(prev => [...prev, { id: `crit-${Date.now()}`, name: 'New Criterion', weight: 2 }]);
  }, []);

  // Scenario handlers
  const updateScenario = useCallback((id: string, updates: Partial<Scenario>) => {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  // Stakeholder handlers
  const addStakeholder = useCallback((quadrant: Stakeholder['quadrant']) => {
    if (!newStakeholderName.trim()) return;
    setStakeholders(prev => [...prev, {
      id: `sh-${Date.now()}`,
      name: newStakeholderName.trim(),
      quadrant
    }]);
    setNewStakeholderName('');
    setActiveQuadrant(null);
  }, [newStakeholderName]);

  const removeStakeholder = useCallback((id: string) => {
    setStakeholders(prev => prev.filter(s => s.id !== id));
  }, []);

  // Milestone handlers
  const addMilestone = useCallback(() => {
    setMilestones(prev => [...prev, {
      id: `ms-${Date.now()}`,
      title: '',
      description: '',
      date: '',
      status: 'future'
    }]);
  }, []);

  const updateMilestone = useCallback((id: string, updates: Partial<Milestone>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  const removeMilestone = useCallback((id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  }, []);

  // Analyze all data
  const analyzeDecision = useCallback(() => {
    const prosText = pros.filter(p => p.text).map(p => `- [${p.weight.toUpperCase()}] ${p.text}`).join('\n');
    const consText = cons.filter(c => c.text).map(c => `- [${c.weight.toUpperCase()}] ${c.text}`).join('\n');
    const risksText = risks.filter(r => r.description).map(r =>
      `- ${r.description} (Likelihood: ${r.likelihood}, Impact: ${r.impact})${r.mitigation ? ` | Mitigation: ${r.mitigation}` : ''}`
    ).join('\n');

    const scenariosText = scenarios.filter(s => s.description).map(s =>
      `${s.type.toUpperCase()} CASE (${s.probability}%): ${s.description}${s.impact ? ` | Impact: ${s.impact}` : ''}`
    ).join('\n');

    const stakeholdersText = Object.entries(
      stakeholders.reduce((acc, s) => {
        acc[s.quadrant] = acc[s.quadrant] || [];
        acc[s.quadrant].push(s.name);
        return acc;
      }, {} as Record<string, string[]>)
    ).map(([q, names]) => `${QUADRANT_CONFIG[q as keyof typeof QUADRANT_CONFIG].title}: ${names.join(', ')}`).join('\n');

    const matrixText = matrixOptions.map(opt =>
      `${opt.name}: Total Score = ${calculateOptionTotal(opt.id)}`
    ).join('\n');

    const prompt = `Based on my comprehensive strategic analysis for "${decisionQuestion}":

📊 PROS:
${prosText || 'None listed'}

📉 CONS:
${consText || 'None listed'}

⚠️ RISKS:
${risksText || 'None identified'}

🔮 SCENARIOS:
${scenariosText || 'None defined'}

👥 KEY STAKEHOLDERS:
${stakeholdersText || 'None mapped'}

📈 DECISION MATRIX RESULTS:
${matrixText || 'Not completed'}

Please provide:
1. An executive summary of the analysis
2. A clear strategic recommendation
3. Key success factors to monitor
4. Immediate next steps
5. Potential pivot points if conditions change`;

    onSendMessage(prompt);
    setActiveTab('discussion');
  }, [pros, cons, risks, scenarios, stakeholders, matrixOptions, calculateOptionTotal, decisionQuestion, onSendMessage]);

  // Reset everything
  const handleNewDecision = useCallback(() => {
    setIsDecisionSet(false);
    setDecisionQuestion('');
    setPros([]);
    setCons([]);
    setRisks([]);
    setScenarios([
      { id: 'scen-1', type: 'best', description: '', probability: 20, impact: '' },
      { id: 'scen-2', type: 'likely', description: '', probability: 60, impact: '' },
      { id: 'scen-3', type: 'worst', description: '', probability: 20, impact: '' },
    ]);
    setStakeholders([]);
    setMilestones([
      { id: 'ms-1', title: 'Decision Point', description: 'Finalize strategic direction', date: '', status: 'current' },
    ]);
    setMatrixScores([]);
  }, []);

  // Count items for tab badges
  const tabCounts = useMemo(() => ({
    proscons: pros.length + cons.length,
    risks: risks.length,
    stakeholders: stakeholders.length,
    timeline: milestones.length,
  }), [pros, cons, risks, stakeholders, milestones]);

  const hasAnalysisData = pros.length > 0 || cons.length > 0 || risks.length > 0 ||
    scenarios.some(s => s.description) || stakeholders.length > 0;

  // ============= SETUP SCREEN =============

  if (!isDecisionSet) {
    return (
      <div className="str-container">
        {/* Ambient Background */}
        <div className="str-ambient">
          <div className="str-wood-grain" />
          <div className="str-brass-corner top-left" />
          <div className="str-brass-corner top-right" />
          <div className="str-brass-corner bottom-left" />
          <div className="str-brass-corner bottom-right" />
          <div className="str-vignette" />
          <div className="str-light-beam" />
        </div>

        <div className="str-setup">
          <div className="str-setup-content">
            {/* Icon */}
            <div className="str-setup-icon">
              <div className="str-icon-table">
                <div className="str-icon-surface">
                  <i className="fa fa-chess" />
                </div>
              </div>
              <div className="str-icon-orbit">
                <div className="str-orbit-dot" />
                <div className="str-orbit-dot" />
                <div className="str-orbit-dot" />
                <div className="str-orbit-dot" />
              </div>
            </div>

            <h1 className="str-setup-title">
              <span>Strategic</span> Command
            </h1>
            <p className="str-setup-subtitle">
              Comprehensive decision analysis with scenario planning, stakeholder mapping, and risk assessment
            </p>

            {/* Setup Card */}
            <div className="str-setup-card">
              <label className="str-form-label">What strategic decision are you facing?</label>
              <textarea
                value={decisionQuestion}
                onChange={(e) => setDecisionQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSetDecision()}
                placeholder="e.g., Should we expand into the European market this quarter?"
                className="str-textarea"
                autoFocus
              />

              <button
                onClick={handleSetDecision}
                disabled={!decisionQuestion.trim()}
                className="str-btn str-btn-primary str-btn-lg"
              >
                <i className="fa fa-chess-board" />
                Begin Strategic Analysis
              </button>

              {/* Templates */}
              <div className="str-templates">
                <p className="str-templates-label">Quick Start Templates</p>
                <div className="str-template-grid">
                  {DECISION_TEMPLATES.map((template, i) => (
                    <button
                      key={i}
                      onClick={() => setDecisionQuestion(template.text)}
                      className="str-template-btn"
                    >
                      <i className={`fa ${template.icon}`} />
                      {template.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============= MAIN INTERFACE =============

  return (
    <div className="str-container">
      {/* Ambient Background */}
      <div className="str-ambient">
        <div className="str-wood-grain" />
        <div className="str-brass-corner top-left" />
        <div className="str-brass-corner top-right" />
        <div className="str-brass-corner bottom-left" />
        <div className="str-brass-corner bottom-right" />
        <div className="str-vignette" />
        <div className="str-light-beam" />
      </div>

      <div className="str-layout">
        {/* Header */}
        <header className="str-header">
          <div className="str-header-left">
            <div className="str-decision-badge">
              <i className="fa fa-chess" />
            </div>
            <div className="str-decision-info">
              <h2>{decisionQuestion}</h2>
              <p>
                <i className="fa fa-bullseye" />
                Strategic Decision Analysis
              </p>
            </div>
          </div>
          <div className="str-header-actions">
            <button
              onClick={() => setShowExport(true)}
              className="str-header-btn"
              title="Export analysis"
            >
              <i className="fa fa-share-nodes" />
            </button>
            <button
              onClick={handleNewDecision}
              className="str-btn str-new-decision-btn"
            >
              <i className="fa fa-rotate-left" style={{ marginRight: '0.375rem' }} />
              New Decision
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="str-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`str-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              <i className={`fa ${tab.icon}`} />
              {tab.label}
              {tabCounts[tab.id as keyof typeof tabCounts] > 0 && (
                <span className="str-tab-count">{tabCounts[tab.id as keyof typeof tabCounts]}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <div className="str-content">
          {/* Discussion Tab */}
          {activeTab === 'discussion' && (
            <div className="str-discussion">
              {/* Messages */}
              <div className="str-messages">
                {messages.length === 0 ? (
                  <div className="str-empty-chat">
                    <div className="str-empty-icon">
                      <i className="fa fa-chess-knight" />
                    </div>
                    <h3>Strategic Analysis Ready</h3>
                    <p>Ask questions, request analysis, or explore different aspects of your decision</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`str-message ${msg.role === 'user' ? 'str-message-user' : 'str-message-ai'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="str-message-header">
                          <div className="str-ai-badge">
                            <i className="fa fa-chess" />
                            <span>Strategic Advisor</span>
                          </div>
                        </div>
                      )}
                      <div className="str-message-content">
                        <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}

                {isLoading && (
                  <div className="str-message str-message-ai">
                    <div className="str-loading">
                      <div className="str-loading-icon">
                        <i className="fa fa-chess" />
                      </div>
                      <span className="str-loading-text">Analyzing strategic options...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts */}
              <div className="str-quick-prompts">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickPrompt(prompt)}
                    disabled={isLoading}
                    className="str-quick-btn"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="str-input-area">
                <div className="str-input-container">
                  <i className="fa fa-chess-knight str-input-icon" />
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about this decision..."
                    className="str-input"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className={`str-send-btn ${input.trim() ? 'active' : ''}`}
                  >
                    <i className="fa fa-paper-plane" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pros & Cons Tab */}
          {activeTab === 'proscons' && (
            <div className="str-proscons">
              {/* Pros Column */}
              <div className="str-column pros">
                <div className="str-column-header pros">
                  <div className="str-column-title pros">
                    <i className="fa fa-thumbs-up" />
                    Pros
                    <span className="str-column-count pros">{pros.length}</span>
                  </div>
                  <button onClick={addPro} className="str-add-btn">
                    <i className="fa fa-plus" />
                  </button>
                </div>
                <div className="str-column-items">
                  {pros.length === 0 ? (
                    <div className="str-column-empty pros">
                      <i className="fa fa-thumbs-up" />
                      <p>Click + to add pros</p>
                    </div>
                  ) : (
                    pros.map(pro => (
                      <div key={pro.id} className="str-item-card pro">
                        <div className="str-item-row">
                          <select
                            value={pro.weight}
                            onChange={(e) => updatePro(pro.id, { weight: e.target.value as any })}
                            className={`str-weight-select ${pro.weight}`}
                          >
                            <option value="high">High</option>
                            <option value="medium">Med</option>
                            <option value="low">Low</option>
                          </select>
                          <input
                            type="text"
                            value={pro.text}
                            onChange={(e) => updatePro(pro.id, { text: e.target.value })}
                            placeholder="Enter a pro..."
                            className="str-item-input"
                          />
                          <button onClick={() => removePro(pro.id)} className="str-item-delete">
                            <i className="fa fa-times" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Cons Column */}
              <div className="str-column cons">
                <div className="str-column-header cons">
                  <div className="str-column-title cons">
                    <i className="fa fa-thumbs-down" />
                    Cons
                    <span className="str-column-count cons">{cons.length}</span>
                  </div>
                  <button onClick={addCon} className="str-add-btn">
                    <i className="fa fa-plus" />
                  </button>
                </div>
                <div className="str-column-items">
                  {cons.length === 0 ? (
                    <div className="str-column-empty cons">
                      <i className="fa fa-thumbs-down" />
                      <p>Click + to add cons</p>
                    </div>
                  ) : (
                    cons.map(con => (
                      <div key={con.id} className="str-item-card con">
                        <div className="str-item-row">
                          <select
                            value={con.weight}
                            onChange={(e) => updateCon(con.id, { weight: e.target.value as any })}
                            className={`str-weight-select ${con.weight}`}
                          >
                            <option value="high">High</option>
                            <option value="medium">Med</option>
                            <option value="low">Low</option>
                          </select>
                          <input
                            type="text"
                            value={con.text}
                            onChange={(e) => updateCon(con.id, { text: e.target.value })}
                            placeholder="Enter a con..."
                            className="str-item-input"
                          />
                          <button onClick={() => removeCon(con.id)} className="str-item-delete">
                            <i className="fa fa-times" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Risks Tab */}
          {activeTab === 'risks' && (
            <div className="str-risks">
              <div className="str-risks-header">
                <div className="str-risks-title">
                  <i className="fa fa-triangle-exclamation" />
                  Risk Assessment
                </div>
                <button onClick={addRisk} className="str-btn">
                  <i className="fa fa-plus" style={{ marginRight: '0.375rem' }} />
                  Add Risk
                </button>
              </div>
              <div className="str-risks-list">
                {risks.length === 0 ? (
                  <div className="str-risks-empty">
                    <i className="fa fa-shield-halved" />
                    <p>No risks identified yet</p>
                    <span>Click "Add Risk" to identify potential risks</span>
                  </div>
                ) : (
                  risks.map(risk => (
                    <div key={risk.id} className="str-risk-card">
                      <div className="str-risk-header">
                        <input
                          type="text"
                          value={risk.description}
                          onChange={(e) => updateRisk(risk.id, { description: e.target.value })}
                          placeholder="Describe the risk..."
                          className="str-risk-input"
                        />
                        <button onClick={() => removeRisk(risk.id)} className="str-risk-delete">
                          <i className="fa fa-times" />
                        </button>
                      </div>
                      <div className="str-risk-controls">
                        <div className="str-risk-control">
                          <span className="str-risk-label">Likelihood:</span>
                          <select
                            value={risk.likelihood}
                            onChange={(e) => updateRisk(risk.id, { likelihood: e.target.value as any })}
                            className={`str-weight-select ${risk.likelihood}`}
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <div className="str-risk-control">
                          <span className="str-risk-label">Impact:</span>
                          <select
                            value={risk.impact}
                            onChange={(e) => updateRisk(risk.id, { impact: e.target.value as any })}
                            className={`str-weight-select ${risk.impact}`}
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={risk.mitigation || ''}
                        onChange={(e) => updateRisk(risk.id, { mitigation: e.target.value })}
                        placeholder="Mitigation strategy..."
                        className="str-mitigation-input"
                      />
                      <span className={`str-risk-matrix ${getRiskLevel(risk.likelihood, risk.impact)}`}>
                        <i className="fa fa-gauge-high" />
                        {getRiskLevel(risk.likelihood, risk.impact).toUpperCase()} RISK
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Decision Matrix Tab */}
          {activeTab === 'matrix' && (
            <div className="str-matrix">
              <div className="str-matrix-header">
                <div className="str-matrix-title">
                  <i className="fa fa-table-cells" />
                  Decision Matrix
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={addMatrixCriterion} className="str-btn">
                    <i className="fa fa-plus" style={{ marginRight: '0.375rem' }} />
                    Criterion
                  </button>
                  <button onClick={addMatrixOption} className="str-btn">
                    <i className="fa fa-plus" style={{ marginRight: '0.375rem' }} />
                    Option
                  </button>
                </div>
              </div>
              <div className="str-matrix-content">
                <div
                  className="str-matrix-grid"
                  style={{
                    gridTemplateColumns: `200px repeat(${matrixOptions.length}, 1fr) 100px`,
                  }}
                >
                  {/* Header Row */}
                  <div className="str-matrix-cell header">Criteria / Weight</div>
                  {matrixOptions.map(opt => (
                    <div key={opt.id} className="str-matrix-cell header">
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) => setMatrixOptions(prev =>
                          prev.map(o => o.id === opt.id ? { ...o, name: e.target.value } : o)
                        )}
                        style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'center', color: 'inherit', fontWeight: 600 }}
                      />
                    </div>
                  ))}
                  <div className="str-matrix-cell header">Total</div>

                  {/* Criteria Rows */}
                  {matrixCriteria.map(crit => (
                    <React.Fragment key={crit.id}>
                      <div className="str-matrix-cell criteria">
                        <input
                          type="text"
                          value={crit.name}
                          onChange={(e) => setMatrixCriteria(prev =>
                            prev.map(c => c.id === crit.id ? { ...c, name: e.target.value } : c)
                          )}
                          style={{ background: 'transparent', border: 'none', width: '70%', color: 'inherit' }}
                        />
                        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>×{crit.weight}</span>
                      </div>
                      {matrixOptions.map(opt => (
                        <div key={`${crit.id}-${opt.id}`} className="str-matrix-cell">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={getMatrixScore(opt.id, crit.id) || ''}
                            onChange={(e) => setMatrixScore(opt.id, crit.id, parseInt(e.target.value) || 0)}
                            className="str-matrix-score"
                            placeholder="0-10"
                          />
                        </div>
                      ))}
                      <div className="str-matrix-cell" style={{ opacity: 0.5 }}>—</div>
                    </React.Fragment>
                  ))}

                  {/* Total Row */}
                  <div className="str-matrix-cell header">TOTAL SCORE</div>
                  {matrixOptions.map(opt => (
                    <div key={`total-${opt.id}`} className="str-matrix-cell str-matrix-total">
                      {calculateOptionTotal(opt.id)}
                    </div>
                  ))}
                  <div className="str-matrix-cell" />
                </div>
              </div>
            </div>
          )}

          {/* Scenarios Tab */}
          {activeTab === 'scenarios' && (
            <div className="str-scenarios">
              <div className="str-scenarios-header">
                <div className="str-scenarios-title">
                  <i className="fa fa-code-branch" />
                  Scenario Planning
                </div>
              </div>
              <div className="str-scenarios-grid">
                {scenarios.map(scenario => (
                  <div key={scenario.id} className={`str-scenario-card ${scenario.type}`}>
                    <div className="str-scenario-header">
                      <span className={`str-scenario-type ${scenario.type}`}>
                        <i className={`fa ${
                          scenario.type === 'best' ? 'fa-sun' :
                          scenario.type === 'worst' ? 'fa-cloud-bolt' : 'fa-cloud-sun'
                        }`} />
                        {scenario.type.charAt(0).toUpperCase() + scenario.type.slice(1)} Case
                      </span>
                      <span className="str-scenario-prob">{scenario.probability}%</span>
                    </div>
                    <textarea
                      value={scenario.description}
                      onChange={(e) => updateScenario(scenario.id, { description: e.target.value })}
                      placeholder={`Describe the ${scenario.type} case scenario...`}
                      className="str-scenario-textarea"
                    />
                    <div className="str-scenario-impact">
                      <span>Impact:</span>
                      <input
                        type="text"
                        value={scenario.impact}
                        onChange={(e) => updateScenario(scenario.id, { impact: e.target.value })}
                        placeholder="Financial/operational impact..."
                        className="str-impact-input"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stakeholders Tab */}
          {activeTab === 'stakeholders' && (
            <div className="str-stakeholders">
              <div className="str-stakeholders-header">
                <div className="str-stakeholders-title">
                  <i className="fa fa-users" />
                  Stakeholder Map
                </div>
              </div>
              <div className="str-stakeholders-grid">
                {(Object.keys(QUADRANT_CONFIG) as Array<keyof typeof QUADRANT_CONFIG>).map(quadrant => (
                  <div key={quadrant} className={`str-quadrant ${quadrant}`}>
                    <div className="str-quadrant-header">
                      <span className="str-quadrant-title">
                        {QUADRANT_CONFIG[quadrant].title}
                      </span>
                      <span style={{ fontSize: '0.625rem', color: 'var(--str-text-muted)' }}>
                        {QUADRANT_CONFIG[quadrant].action}
                      </span>
                    </div>
                    <div className="str-quadrant-items">
                      {stakeholders
                        .filter(s => s.quadrant === quadrant)
                        .map(s => (
                          <span key={s.id} className="str-stakeholder-tag">
                            {s.name}
                            <button
                              onClick={() => removeStakeholder(s.id)}
                              className="str-tag-delete"
                            >
                              <i className="fa fa-times" />
                            </button>
                          </span>
                        ))
                      }
                      {activeQuadrant === quadrant ? (
                        <input
                          type="text"
                          value={newStakeholderName}
                          onChange={(e) => setNewStakeholderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') addStakeholder(quadrant);
                            if (e.key === 'Escape') setActiveQuadrant(null);
                          }}
                          onBlur={() => {
                            if (newStakeholderName) addStakeholder(quadrant);
                            setActiveQuadrant(null);
                          }}
                          placeholder="Name..."
                          autoFocus
                          style={{
                            padding: '0.375rem 0.625rem',
                            background: 'var(--str-bg-primary)',
                            border: '1px solid var(--str-emerald-500)',
                            borderRadius: 'var(--str-radius-full)',
                            fontSize: '0.75rem',
                            color: 'var(--str-text-primary)',
                            width: '100px',
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setActiveQuadrant(quadrant)}
                          className="str-add-stakeholder"
                        >
                          <i className="fa fa-plus" /> Add
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="str-timeline">
              <div className="str-timeline-header">
                <div className="str-timeline-title">
                  <i className="fa fa-timeline" />
                  Decision Timeline
                </div>
                <button onClick={addMilestone} className="str-btn">
                  <i className="fa fa-plus" style={{ marginRight: '0.375rem' }} />
                  Add Milestone
                </button>
              </div>
              <div className="str-timeline-content">
                <div className="str-timeline-track">
                  {milestones.map((milestone) => (
                    <div key={milestone.id} className={`str-milestone ${milestone.status}`}>
                      <div className="str-milestone-header">
                        <input
                          type="date"
                          value={milestone.date}
                          onChange={(e) => updateMilestone(milestone.id, { date: e.target.value })}
                          className="str-milestone-date"
                          style={{ background: 'transparent', border: 'none', color: 'inherit' }}
                        />
                        <select
                          value={milestone.status}
                          onChange={(e) => updateMilestone(milestone.id, { status: e.target.value as any })}
                          className={`str-milestone-status ${milestone.status}`}
                          style={{ cursor: 'pointer' }}
                        >
                          <option value="completed">Completed</option>
                          <option value="current">Current</option>
                          <option value="future">Future</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={milestone.title}
                        onChange={(e) => updateMilestone(milestone.id, { title: e.target.value })}
                        placeholder="Milestone title..."
                        className="str-milestone-title"
                        style={{ background: 'transparent', border: 'none', width: '100%', color: 'inherit' }}
                      />
                      <input
                        type="text"
                        value={milestone.description}
                        onChange={(e) => updateMilestone(milestone.id, { description: e.target.value })}
                        placeholder="Description..."
                        className="str-milestone-desc"
                        style={{ background: 'transparent', border: 'none', width: '100%', color: 'inherit' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Analyze Button */}
        {hasAnalysisData && (
          <div className="str-footer">
            <button
              onClick={analyzeDecision}
              disabled={isLoading}
              className="str-analyze-btn"
            >
              <i className="fa fa-wand-magic-sparkles" />
              Generate Strategic Recommendation
            </button>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExport && (
        <SessionExport
          sessionId={sessionId}
          sessionTitle={`Decision: ${decisionQuestion}`}
          messages={messages}
          topic={decisionQuestion}
          mode="Strategist Mode"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};

export default StrategistModeRedesigned;
