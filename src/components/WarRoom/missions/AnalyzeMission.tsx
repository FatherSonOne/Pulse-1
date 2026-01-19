import React, { useState, useRef, useEffect } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';

interface DataPoint {
  id: string;
  label: string;
  value: string;
  category: string;
  source?: string;
}

interface Insight {
  id: string;
  text: string;
  type: 'trend' | 'anomaly' | 'correlation' | 'recommendation';
  confidence: 'high' | 'medium' | 'low';
}

type AnalyzePhase = 'setup' | 'collect' | 'analyze' | 'insights' | 'report';

interface AnalyzeMissionProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
}

const PHASES: { id: AnalyzePhase; label: string; icon: string; description: string }[] = [
  { id: 'setup', label: 'Setup', icon: 'fa-crosshairs', description: 'Define analysis goal' },
  { id: 'collect', label: 'Collect', icon: 'fa-database', description: 'Gather data points' },
  { id: 'analyze', label: 'Analyze', icon: 'fa-magnifying-glass-chart', description: 'Deep dive analysis' },
  { id: 'insights', label: 'Insights', icon: 'fa-lightbulb', description: 'Extract findings' },
  { id: 'report', label: 'Report', icon: 'fa-file-lines', description: 'Generate report' },
];

const ANALYSIS_TYPES = [
  { id: 'trend', name: 'Trend Analysis', icon: 'fa-chart-line', prompt: 'What trends do you see in this data?' },
  { id: 'comparison', name: 'Comparison', icon: 'fa-code-compare', prompt: 'Compare and contrast the key metrics' },
  { id: 'root-cause', name: 'Root Cause', icon: 'fa-sitemap', prompt: 'What is the root cause of the observed patterns?' },
  { id: 'forecast', name: 'Forecast', icon: 'fa-chart-area', prompt: 'Based on the data, what can we predict?' },
  { id: 'segment', name: 'Segmentation', icon: 'fa-chart-pie', prompt: 'How can we segment or categorize this data?' },
  { id: 'correlation', name: 'Correlation', icon: 'fa-link', prompt: 'What correlations exist between these variables?' },
];

const INSIGHT_TYPES = {
  trend: { icon: 'fa-chart-line', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  anomaly: { icon: 'fa-triangle-exclamation', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  correlation: { icon: 'fa-link', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  recommendation: { icon: 'fa-lightbulb', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
};

export const AnalyzeMission: React.FC<AnalyzeMissionProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Analyze Mission',
  documents = []
}) => {
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<AnalyzePhase>('setup');
  const [analysisGoal, setAnalysisGoal] = useState('');
  const [analysisContext, setAnalysisContext] = useState('');
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [newDataLabel, setNewDataLabel] = useState('');
  const [newDataValue, setNewDataValue] = useState('');
  const [newDataCategory, setNewDataCategory] = useState('General');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [newInsightText, setNewInsightText] = useState('');
  const [newInsightType, setNewInsightType] = useState<Insight['type']>('trend');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSetupAnalysis = () => {
    if (!analysisGoal.trim()) return;
    setCurrentPhase('collect');
    onSendMessage(`[ANALYZE MISSION - Phase 1: Setup]
Analysis Goal: "${analysisGoal}"
${analysisContext ? `\nContext: ${analysisContext}` : ''}

Help me prepare for this analysis:
1. What data do I need to collect?
2. What metrics should I focus on?
3. What questions should I answer?
4. What tools or methods should I use?`);
  };

  const handleAddDataPoint = () => {
    if (!newDataLabel.trim() || !newDataValue.trim()) return;
    const newPoint: DataPoint = {
      id: `data-${Date.now()}`,
      label: newDataLabel.trim(),
      value: newDataValue.trim(),
      category: newDataCategory
    };
    setDataPoints([...dataPoints, newPoint]);
    setNewDataLabel('');
    setNewDataValue('');
  };

  const handleDeleteDataPoint = (id: string) => {
    setDataPoints(dataPoints.filter(d => d.id !== id));
  };

  const handleAddInsight = () => {
    if (!newInsightText.trim()) return;
    const newInsight: Insight = {
      id: `insight-${Date.now()}`,
      text: newInsightText.trim(),
      type: newInsightType,
      confidence: 'medium'
    };
    setInsights([...insights, newInsight]);
    setNewInsightText('');
  };

  const handleDeleteInsight = (id: string) => {
    setInsights(insights.filter(i => i.id !== id));
  };

  const handleAnalysisType = (type: typeof ANALYSIS_TYPES[0]) => {
    const dataContext = dataPoints.length > 0
      ? `\n\nCurrent data points:\n${dataPoints.map(d => `- ${d.label}: ${d.value} [${d.category}]`).join('\n')}`
      : '';
    onSendMessage(`[ANALYZE MISSION - Analysis: ${type.name}]
Goal: "${analysisGoal}"
${type.prompt}${dataContext}`);
  };

  const handleAskAI = (prompt: string) => {
    const analysisContext = `
Goal: ${analysisGoal}
Data points (${dataPoints.length}):
${dataPoints.slice(0, 15).map(d => `- ${d.label}: ${d.value} [${d.category}]`).join('\n')}
${dataPoints.length > 15 ? `... and ${dataPoints.length - 15} more` : ''}
Current insights: ${insights.map(i => `[${i.type}] ${i.text}`).join('; ')}
`;
    onSendMessage(`[ANALYZE MISSION - Phase: ${currentPhase}]\n${prompt}\n\nAnalysis Context:${analysisContext}`);
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

  const proceedToPhase = (phase: AnalyzePhase) => {
    setCurrentPhase(phase);

    const phasePrompts: Record<AnalyzePhase, string> = {
      setup: '',
      collect: `COLLECT phase: Help me gather data for "${analysisGoal}".
Current data points: ${dataPoints.length}
What additional data should I collect?`,
      analyze: `ANALYZE phase: Let's analyze the data for "${analysisGoal}".
I have ${dataPoints.length} data points across these categories: ${
  [...new Set(dataPoints.map(d => d.category))].join(', ')
}
Perform a comprehensive analysis.`,
      insights: `INSIGHTS phase: Extract key insights from our analysis.
Current insights: ${insights.length}
What patterns, anomalies, or recommendations should I note?`,
      report: `REPORT phase: Generate a comprehensive analysis report for "${analysisGoal}".
Include:
1. Executive summary
2. Methodology
3. Key findings (with data)
4. Insights and implications
5. Recommendations
6. Next steps`
    };

    if (phasePrompts[phase]) {
      onSendMessage(`[ANALYZE MISSION - Phase: ${phase}]\n${phasePrompts[phase]}`);
    }
  };

  const currentPhaseIndex = PHASES.findIndex(p => p.id === currentPhase);
  const categories = [...new Set(dataPoints.map(d => d.category))];

  return (
    <div className="h-full w-full flex war-room-container overflow-hidden">
      {/* Progress & Data Panel */}
      <div className="w-80 shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        {/* Mission Header */}
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa fa-magnifying-glass-chart text-blue-400"></i>
            <h3 className="text-sm font-semibold war-room-text-primary">Analyze Mission</h3>
          </div>
          {analysisGoal && (
            <p className="text-xs war-room-text-secondary line-clamp-2">{analysisGoal}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs war-room-text-secondary">
            <span><i className="fa fa-database mr-1"></i>{dataPoints.length} data</span>
            <span><i className="fa fa-lightbulb mr-1"></i>{insights.length} insights</span>
          </div>
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
                      ? 'bg-blue-500/20 border border-blue-500/40'
                      : isComplete
                      ? 'bg-emerald-500/10'
                      : 'opacity-40'
                  }`}
                  title={phase.description}
                >
                  <i className={`fa ${phase.icon} ${isComplete ? 'text-emerald-400' : isActive ? 'text-blue-400' : 'text-white/40'}`}></i>
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
          {currentPhase === 'setup' && !analysisGoal && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  What do you want to analyze?
                </label>
                <input
                  type="text"
                  value={analysisGoal}
                  onChange={(e) => setAnalysisGoal(e.target.value)}
                  placeholder="e.g., Customer churn patterns"
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium war-room-text-primary mb-2">
                  Context & constraints
                </label>
                <textarea
                  value={analysisContext}
                  onChange={(e) => setAnalysisContext(e.target.value)}
                  placeholder="Time period, data sources, specific questions..."
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-blue-500/50 focus:outline-none resize-none h-20"
                />
              </div>
              <button
                onClick={handleSetupAnalysis}
                disabled={!analysisGoal.trim()}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-arrow-right mr-2"></i>
                Start Analysis
              </button>
            </div>
          )}

          {currentPhase === 'collect' && (
            <div className="space-y-3">
              <div className="war-room-panel p-3">
                <input
                  type="text"
                  value={newDataLabel}
                  onChange={(e) => setNewDataLabel(e.target.value)}
                  placeholder="Metric/Label"
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none mb-2"
                />
                <input
                  type="text"
                  value={newDataValue}
                  onChange={(e) => setNewDataValue(e.target.value)}
                  placeholder="Value"
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none mb-2"
                />
                <div className="flex gap-2">
                  <select
                    value={newDataCategory}
                    onChange={(e) => setNewDataCategory(e.target.value)}
                    className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white focus:outline-none"
                  >
                    <option>General</option>
                    <option>Revenue</option>
                    <option>Users</option>
                    <option>Performance</option>
                    <option>Custom</option>
                  </select>
                  <button
                    onClick={handleAddDataPoint}
                    disabled={!newDataLabel.trim() || !newDataValue.trim()}
                    className="war-room-btn war-room-btn-primary px-4"
                  >
                    <i className="fa fa-plus"></i>
                  </button>
                </div>
              </div>

              {/* Data by Category */}
              {categories.map(category => {
                const categoryData = dataPoints.filter(d => d.category === category);
                return (
                  <div key={category} className="war-room-panel p-3">
                    <h4 className="text-xs font-semibold text-blue-400 mb-2">{category}</h4>
                    <div className="space-y-1">
                      {categoryData.map(point => (
                        <div key={point.id} className="flex items-center justify-between text-xs group">
                          <span className="war-room-text-secondary">{point.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="war-room-text-primary font-medium">{point.value}</span>
                            <button
                              onClick={() => handleDeleteDataPoint(point.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-400"
                            >
                              <i className="fa fa-times text-[10px]"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {dataPoints.length >= 3 && (
                <button
                  onClick={() => proceedToPhase('analyze')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Start Analysis
                </button>
              )}
            </div>
          )}

          {currentPhase === 'analyze' && (
            <div className="space-y-3">
              <p className="text-xs war-room-text-secondary">Analysis techniques:</p>
              <div className="grid grid-cols-2 gap-1">
                {ANALYSIS_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => handleAnalysisType(type)}
                    className="war-room-btn text-xs p-2 flex flex-col items-center gap-1"
                  >
                    <i className={`fa ${type.icon} text-blue-400`}></i>
                    <span>{type.name}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => proceedToPhase('insights')}
                className="w-full war-room-btn war-room-btn-primary py-2 mt-4"
              >
                <i className="fa fa-arrow-right mr-2"></i>
                Extract Insights
              </button>
            </div>
          )}

          {currentPhase === 'insights' && (
            <div className="space-y-3">
              <div className="war-room-panel p-3">
                <div className="flex gap-1 mb-2">
                  {(Object.keys(INSIGHT_TYPES) as Insight['type'][]).map(type => {
                    const style = INSIGHT_TYPES[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setNewInsightType(type)}
                        className={`flex-1 p-1.5 rounded text-xs capitalize ${
                          newInsightType === type
                            ? `${style.bg} ${style.color}`
                            : 'war-room-btn'
                        }`}
                      >
                        <i className={`fa ${style.icon}`}></i>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newInsightText}
                    onChange={(e) => setNewInsightText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddInsight()}
                    placeholder="Add insight..."
                    className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none"
                  />
                  <button
                    onClick={handleAddInsight}
                    disabled={!newInsightText.trim()}
                    className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
                  >
                    <i className="fa fa-plus text-xs"></i>
                  </button>
                </div>
              </div>

              {/* Insights List */}
              {(Object.keys(INSIGHT_TYPES) as Insight['type'][]).map(type => {
                const typeInsights = insights.filter(i => i.type === type);
                if (typeInsights.length === 0) return null;
                const style = INSIGHT_TYPES[type];
                return (
                  <div key={type}>
                    <h4 className={`text-xs font-semibold ${style.color} mb-2 capitalize`}>
                      <i className={`fa ${style.icon} mr-1`}></i>
                      {type}s ({typeInsights.length})
                    </h4>
                    <div className="space-y-2">
                      {typeInsights.map(insight => (
                        <div key={insight.id} className={`p-2 rounded-lg ${style.bg} group`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs war-room-text-primary">{insight.text}</p>
                            <button
                              onClick={() => handleDeleteInsight(insight.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 shrink-0"
                            >
                              <i className="fa fa-times text-[10px]"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {insights.length >= 2 && (
                <button
                  onClick={() => proceedToPhase('report')}
                  className="w-full war-room-btn war-room-btn-primary py-2"
                >
                  <i className="fa fa-arrow-right mr-2"></i>
                  Generate Report
                </button>
              )}
            </div>
          )}

          {currentPhase === 'report' && (
            <div className="space-y-4">
              <div className="war-room-panel p-3 bg-blue-500/10 border-blue-500/30">
                <h4 className="text-xs font-semibold text-blue-400 mb-2">Analysis Summary</h4>
                <div className="space-y-2 text-xs war-room-text-secondary">
                  <p><strong>Goal:</strong> {analysisGoal}</p>
                  <p><strong>Data points:</strong> {dataPoints.length}</p>
                  <p><strong>Categories:</strong> {categories.join(', ')}</p>
                  <p><strong>Insights:</strong> {insights.length}</p>
                </div>
              </div>

              <button
                onClick={() => handleAskAI('Generate a comprehensive analysis report')}
                disabled={isLoading}
                className="w-full war-room-btn war-room-btn-primary py-2"
              >
                <i className="fa fa-file-lines mr-2"></i>
                Generate Full Report
              </button>

              <button
                onClick={() => handleAskAI('Create an executive summary with key takeaways')}
                disabled={isLoading}
                className="w-full war-room-btn py-2"
              >
                <i className="fa fa-compress mr-2"></i>
                Executive Summary Only
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
            Export Analysis
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
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                  <i className="fa fa-magnifying-glass-chart text-2xl text-blue-400"></i>
                </div>
                <h3 className="text-lg font-semibold war-room-text-primary mb-2">
                  Analyze Mission
                </h3>
                <p className="text-sm war-room-text-secondary">
                  A structured data analysis workflow.
                  Define what you want to analyze to begin.
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
                      <i className="fa fa-magnifying-glass-chart text-blue-400 text-xs"></i>
                      <span className="text-xs text-blue-400 font-medium">Analysis AI</span>
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
                  <div className="w-5 h-5 rounded-full bg-blue-500/30 flex items-center justify-center">
                    <i className="fa fa-magnifying-glass-chart text-blue-400 text-xs animate-pulse"></i>
                  </div>
                  <span className="text-sm war-room-text-secondary">Analyzing...</span>
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
              <i className="fa fa-comments text-blue-400 text-sm"></i>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your data or analysis..."
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
          topic={analysisGoal}
          mode="Analyze Mission"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
