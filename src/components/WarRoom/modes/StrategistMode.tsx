import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';

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

interface StrategistModeProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
}

export const StrategistMode: React.FC<StrategistModeProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Strategy Session',
  documents = []
}) => {
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [decisionQuestion, setDecisionQuestion] = useState('');
  const [isDecisionSet, setIsDecisionSet] = useState(false);
  const [pros, setPros] = useState<ProConItem[]>([]);
  const [cons, setCons] = useState<ProConItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'proscons' | 'risks'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSetDecision = () => {
    if (!decisionQuestion.trim()) return;
    setIsDecisionSet(true);
    onSendMessage(`I need to make a strategic decision about: "${decisionQuestion}". Please help me analyze this decision by identifying key factors, potential pros and cons, and risks to consider.`);
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

  const addPro = () => {
    setPros([...pros, { id: Date.now().toString(), text: '', weight: 'medium' }]);
  };

  const addCon = () => {
    setCons([...cons, { id: Date.now().toString(), text: '', weight: 'medium' }]);
  };

  const addRisk = () => {
    setRisks([...risks, {
      id: Date.now().toString(),
      description: '',
      likelihood: 'medium',
      impact: 'medium'
    }]);
  };

  const updatePro = (id: string, updates: Partial<ProConItem>) => {
    setPros(pros.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updateCon = (id: string, updates: Partial<ProConItem>) => {
    setCons(cons.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const updateRisk = (id: string, updates: Partial<RiskItem>) => {
    setRisks(risks.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removePro = (id: string) => setPros(pros.filter(p => p.id !== id));
  const removeCon = (id: string) => setCons(cons.filter(c => c.id !== id));
  const removeRisk = (id: string) => setRisks(risks.filter(r => r.id !== id));

  const analyzeDecision = () => {
    const prosText = pros.map(p => `- [${p.weight.toUpperCase()}] ${p.text}`).join('\n');
    const consText = cons.map(c => `- [${c.weight.toUpperCase()}] ${c.text}`).join('\n');
    const risksText = risks.map(r => `- ${r.description} (Likelihood: ${r.likelihood}, Impact: ${r.impact})`).join('\n');

    const analysisPrompt = `Based on my pros/cons analysis for "${decisionQuestion}":

PROS:
${prosText || 'None listed'}

CONS:
${consText || 'None listed'}

RISKS:
${risksText || 'None identified'}

Please provide a strategic recommendation considering all factors. Weight the high-priority items more heavily in your analysis.`;

    onSendMessage(analysisPrompt);
    setActiveTab('chat');
  };

  const weightColors = {
    high: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  };

  if (!isDecisionSet) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center war-room-container p-8">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
            <i className="fa fa-chess text-3xl text-purple-400"></i>
          </div>

          <h2 className="text-2xl font-bold war-room-text-primary mb-2">
            Strategist Mode
          </h2>
          <p className="war-room-text-secondary mb-8">
            Make better decisions with structured analysis, pros/cons evaluation, and risk assessment
          </p>

          <div className="war-room-panel p-6">
            <label className="block text-sm war-room-text-secondary mb-2 text-left">
              What decision are you facing?
            </label>
            <textarea
              value={decisionQuestion}
              onChange={(e) => setDecisionQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSetDecision()}
              placeholder="e.g., Should we expand into the European market?"
              className="war-room-input w-full mb-4 h-24 resize-none"
              autoFocus
            />

            <button
              onClick={handleSetDecision}
              disabled={!decisionQuestion.trim()}
              className="war-room-btn war-room-btn-primary w-full py-3"
            >
              <i className="fa fa-play mr-2"></i>
              Begin Strategic Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col war-room-container overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/10 bg-gradient-to-r from-purple-500/5 to-indigo-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <i className="fa fa-chess text-purple-400"></i>
            </div>
            <div>
              <h3 className="font-semibold war-room-text-primary">{decisionQuestion}</h3>
              <p className="text-xs war-room-text-secondary">Strategic Decision Analysis</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExport(true)}
              className="war-room-btn war-room-btn-icon-sm"
              title="Export"
            >
              <i className="fa fa-share-nodes text-xs"></i>
            </button>
            <button
              onClick={() => {
                setIsDecisionSet(false);
                setDecisionQuestion('');
                setPros([]);
                setCons([]);
                setRisks([]);
              }}
              className="war-room-btn text-xs px-3 py-1"
            >
              <i className="fa fa-rotate-left mr-1"></i>
              New Decision
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'chat', icon: 'fa-comments', label: 'Discussion' },
            { id: 'proscons', icon: 'fa-scale-balanced', label: 'Pros & Cons' },
            { id: 'risks', icon: 'fa-triangle-exclamation', label: 'Risks' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-purple-500 text-white'
                  : 'war-room-btn'
              }`}
            >
              <i className={`fa ${tab.icon}`}></i>
              {tab.label}
              {tab.id === 'proscons' && (pros.length + cons.length > 0) && (
                <span className="text-xs opacity-70">({pros.length + cons.length})</span>
              )}
              {tab.id === 'risks' && risks.length > 0 && (
                <span className="text-xs opacity-70">({risks.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col">
            {/* Messages */}
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
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="war-room-message-ai">
                    <div className="flex items-center gap-2">
                      <i className="fa fa-chess text-purple-400 animate-pulse"></i>
                      <span className="text-sm war-room-text-secondary">Strategizing...</span>
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
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about this decision..."
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
        )}

        {activeTab === 'proscons' && (
          <div className="h-full flex">
            {/* Pros */}
            <div className="flex-1 border-r border-white/10 flex flex-col">
              <div className="p-3 border-b border-white/10 bg-emerald-500/5 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <i className="fa fa-thumbs-up"></i>
                  Pros ({pros.length})
                </h4>
                <button onClick={addPro} className="war-room-btn war-room-btn-icon-sm">
                  <i className="fa fa-plus text-xs"></i>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto war-room-scrollbar p-3 space-y-2">
                {pros.map(pro => (
                  <div key={pro.id} className="war-room-panel p-3 group">
                    <div className="flex items-start gap-2">
                      <select
                        value={pro.weight}
                        onChange={(e) => updatePro(pro.id, { weight: e.target.value as any })}
                        className={`text-xs px-2 py-1 rounded border ${weightColors[pro.weight]} bg-transparent`}
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
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                      <button
                        onClick={() => removePro(pro.id)}
                        className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <i className="fa fa-times text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))}
                {pros.length === 0 && (
                  <p className="text-xs war-room-text-secondary text-center py-4">
                    Click + to add pros
                  </p>
                )}
              </div>
            </div>

            {/* Cons */}
            <div className="flex-1 flex flex-col">
              <div className="p-3 border-b border-white/10 bg-rose-500/5 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                  <i className="fa fa-thumbs-down"></i>
                  Cons ({cons.length})
                </h4>
                <button onClick={addCon} className="war-room-btn war-room-btn-icon-sm">
                  <i className="fa fa-plus text-xs"></i>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto war-room-scrollbar p-3 space-y-2">
                {cons.map(con => (
                  <div key={con.id} className="war-room-panel p-3 group">
                    <div className="flex items-start gap-2">
                      <select
                        value={con.weight}
                        onChange={(e) => updateCon(con.id, { weight: e.target.value as any })}
                        className={`text-xs px-2 py-1 rounded border ${weightColors[con.weight]} bg-transparent`}
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
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                      <button
                        onClick={() => removeCon(con.id)}
                        className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <i className="fa fa-times text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))}
                {cons.length === 0 && (
                  <p className="text-xs war-room-text-secondary text-center py-4">
                    Click + to add cons
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'risks' && (
          <div className="h-full flex flex-col">
            <div className="p-3 border-b border-white/10 bg-amber-500/5 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                <i className="fa fa-triangle-exclamation"></i>
                Risk Assessment
              </h4>
              <button onClick={addRisk} className="war-room-btn war-room-btn-icon-sm">
                <i className="fa fa-plus text-xs"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto war-room-scrollbar p-4 space-y-3">
              {risks.map(risk => (
                <div key={risk.id} className="war-room-panel p-4 group">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        value={risk.description}
                        onChange={(e) => updateRisk(risk.id, { description: e.target.value })}
                        placeholder="Describe the risk..."
                        className="w-full bg-transparent text-sm outline-none"
                      />
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs war-room-text-secondary">Likelihood:</span>
                          <select
                            value={risk.likelihood}
                            onChange={(e) => updateRisk(risk.id, { likelihood: e.target.value as any })}
                            className={`text-xs px-2 py-1 rounded border ${weightColors[risk.likelihood]} bg-transparent`}
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs war-room-text-secondary">Impact:</span>
                          <select
                            value={risk.impact}
                            onChange={(e) => updateRisk(risk.id, { impact: e.target.value as any })}
                            className={`text-xs px-2 py-1 rounded border ${weightColors[risk.impact]} bg-transparent`}
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
                        placeholder="Mitigation strategy (optional)..."
                        className="w-full bg-transparent text-xs outline-none war-room-text-secondary"
                      />
                    </div>
                    <button
                      onClick={() => removeRisk(risk.id)}
                      className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <i className="fa fa-times"></i>
                    </button>
                  </div>
                </div>
              ))}
              {risks.length === 0 && (
                <p className="text-sm war-room-text-secondary text-center py-8">
                  Click + to identify potential risks
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Analyze Button */}
      {(pros.length > 0 || cons.length > 0 || risks.length > 0) && (
        <div className="shrink-0 p-4 border-t border-white/10 bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
          <button
            onClick={analyzeDecision}
            className="war-room-btn war-room-btn-primary w-full py-3"
          >
            <i className="fa fa-wand-magic-sparkles mr-2"></i>
            Get AI Strategic Recommendation
          </button>
        </div>
      )}

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
