import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import { processWithModel, generateSearchResponse } from '../../../services/geminiService';
import { generateClaudeResponse } from '../../../services/anthropicService';
import ShareToChannelModal from '../shared/ShareToChannelModal';
import AILabOutput from '../shared/AILabOutput';
import AILabEmptyState from '../shared/AILabEmptyState';
import { useToast } from '../shared/AILabToast';
import './IntelligenceHub.css';

import { Activity, AlertCircle, ArrowLeft, ArrowRight, Brain, CheckCircle, Circle, Clock, FileText, Gavel, Loader2, PenTool, Rocket, Search, Square, Terminal, TrendingUp } from 'lucide-react';

interface IntelligenceHubProps {
  onBack: () => void;
  apiKey: string;
}

interface Agent {
  id: string;
  name: string;
  role: 'researcher' | 'analyst' | 'writer' | 'critic';
  model: string;
  status: 'idle' | 'thinking' | 'working' | 'complete' | 'error';
  progress: number;
  task: string;
  output: string;
  color: string;
}

const AGENT_PRESETS: Omit<Agent, 'id' | 'status' | 'progress' | 'output'>[] = [
  { name: 'Scout', role: 'researcher', model: 'Gemini Search', color: 'cyan', task: 'Find relevant information' },
  { name: 'Sage', role: 'analyst', model: 'Claude', color: 'violet', task: 'Analyze and synthesize data' },
  { name: 'Scribe', role: 'writer', model: 'Gemini', color: 'emerald', task: 'Draft content and reports' },
  { name: 'Judge', role: 'critic', model: 'Gemini', color: 'amber', task: 'Review and improve output' },
];

const IntelligenceHub: React.FC<IntelligenceHubProps> = ({ onBack, apiKey }) => {
  const { missionPrompt, setMissionPrompt, setActiveWorkspace, setGeneratedOutput, apiKeys } = useWorkspace();
  const { showToast, ToastComponent } = useToast();
  const [agents, setAgents] = useState<Agent[]>(
    AGENT_PRESETS.map((preset, i) => ({
      ...preset,
      id: `agent-${i}`,
      status: 'idle',
      progress: 0,
      output: '',
    }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [finalOutput, setFinalOutput] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const missionStartTime = useRef<number | null>(null);

  // Mission timer
  useEffect(() => {
    if (!isRunning) return;
    missionStartTime.current = Date.now();
    setElapsed(0);
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (missionStartTime.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [isRunning]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const startMission = async () => {
    if (!missionPrompt.trim() || !apiKey) return;

    setIsRunning(true);
    setLogs([]);
    setFinalOutput('');
    setShowOutput(false);

    // Reset all agents
    setAgents(prev => prev.map(a => ({ ...a, status: 'idle', progress: 0, output: '' })));

    addLog(`🚀 Mission initiated: "${missionPrompt}"`);
    addLog('📡 Deploying AI agents...');

    let research = '';
    let analysis = '';
    let draft = '';
    let finalReport = '';

    // ─── Agent 1: Scout (Gemini web search grounding) ───
    updateAgent('agent-0', { status: 'thinking', progress: 0 });
    addLog('🤔 Scout is analyzing the mission...');
    await delay(600);

    updateAgent('agent-0', { status: 'working', progress: 10 });
    addLog('⚡ Scout started searching the web...');

    try {
      const res = await generateSearchResponse(apiKey, missionPrompt);
      research = res.text || '';
      const citations = (res.groundingChunks || [])
        .map((c: any) => c?.web?.uri)
        .filter((uri: any): uri is string => Boolean(uri));
      if (citations.length) {
        research += `\n\nSources:\n${citations.slice(0, 5).map(c => `- ${c}`).join('\n')}`;
      }
      updateAgent('agent-0', { status: 'complete', progress: 100, output: research.slice(0, 200) + '...' });
      addLog('✅ Scout completed research');
    } catch (err) {
      updateAgent('agent-0', { status: 'error', progress: 0, output: 'Research failed.' });
      addLog('⚠️ Scout encountered an error — continuing with limited data');
      research = `Topic: ${missionPrompt}`;
    }

    // ─── Agent 2: Sage (Claude analysis) ───
    updateAgent('agent-1', { status: 'thinking', progress: 0 });
    addLog('🤔 Sage is processing research data...');
    await delay(400);

    updateAgent('agent-1', { status: 'working', progress: 15 });
    addLog('⚡ Sage started analysis...');

    try {
      const analyzePrompt = `Analyze the following research on "${missionPrompt}". Identify:
1. The 3 most important themes or findings
2. Key risks or challenges
3. Strategic opportunities or recommendations
4. Gaps or areas needing more investigation

Research data:
${research.slice(0, 4000)}`;

      const claudeKey = apiKeys.claude;
      if (claudeKey) {
        analysis = await generateClaudeResponse(claudeKey, analyzePrompt);
      } else {
        analysis = await processWithModel(apiKey, analyzePrompt) || '';
      }

      updateAgent('agent-1', { status: 'complete', progress: 100, output: analysis.slice(0, 200) + '...' });
      addLog('✅ Sage completed analysis');
    } catch (err) {
      updateAgent('agent-1', { status: 'error', progress: 0, output: 'Analysis failed.' });
      addLog('⚠️ Sage encountered an error — using raw research');
      analysis = research;
    }

    // ─── Agent 3: Scribe (Gemini report writing) ───
    updateAgent('agent-2', { status: 'thinking', progress: 0 });
    addLog('🤔 Scribe is drafting the report...');
    await delay(400);

    updateAgent('agent-2', { status: 'working', progress: 20 });
    addLog('⚡ Scribe started writing...');

    try {
      draft = await processWithModel(apiKey, `Write a comprehensive intelligence report on: "${missionPrompt}"

Use this analysis as your foundation:
${analysis.slice(0, 4000)}

Structure the report as:
# Intelligence Report: ${missionPrompt}

## Executive Summary
(2-3 sentences)

## Key Findings
(bullet points with the most important discoveries)

## Detailed Analysis
(organized subsections)

## Strategic Recommendations
(actionable items numbered 1-5)

## Conclusion
(closing paragraph)

---
*Generated by Pulse Intelligence Hub*`) || '';

      updateAgent('agent-2', { status: 'complete', progress: 100, output: draft.slice(0, 200) + '...' });
      addLog('✅ Scribe completed the draft');
    } catch (err) {
      updateAgent('agent-2', { status: 'error', progress: 0, output: 'Writing failed.' });
      addLog('⚠️ Scribe encountered an error');
      draft = analysis;
    }

    // ─── Agent 4: Judge (Gemini quality review) ───
    updateAgent('agent-3', { status: 'thinking', progress: 0 });
    addLog('🤔 Judge is reviewing the report...');
    await delay(400);

    updateAgent('agent-3', { status: 'working', progress: 25 });
    addLog('⚡ Judge started quality review...');

    try {
      finalReport = await processWithModel(apiKey, `Review and improve this intelligence report for quality, accuracy, and actionability.

Fix any logical gaps, improve clarity, strengthen the recommendations, and ensure the tone is professional and concise. Return the complete improved report:

${draft.slice(0, 5000)}`) || draft;

      updateAgent('agent-3', { status: 'complete', progress: 100, output: 'Review complete. Report improved.' });
      addLog('✅ Judge completed quality review');
    } catch (err) {
      updateAgent('agent-3', { status: 'error', progress: 0, output: 'Review failed.' });
      addLog('⚠️ Judge encountered an error — using unreviewed draft');
      finalReport = draft;
    }

    addLog('📝 Compiling final intelligence report...');
    await delay(500);

    setFinalOutput(finalReport);
    setGeneratedOutput(finalReport);
    addLog('🎯 Mission complete!');
    setIsRunning(false);
    setShowOutput(true);
  };

  const stopMission = () => {
    setIsRunning(false);
    setAgents(prev => prev.map(a => a.status !== 'complete' ? { ...a, status: 'idle', progress: 0 } : a));
    addLog('⛔ Mission aborted by user');
  };

  const sendToStudio = () => {
    if (!finalOutput) return;
    setActiveWorkspace('studio');
  };

  return (
    <div className="intelligence-hub">
      {/* Header */}
      <div className="hub-header">
        <div className="hub-header-left">
          <button type="button" onClick={onBack} className="hub-back-btn" aria-label="Go back">
            <ArrowLeft />
          </button>
          <div className="hub-branding">
            <Brain />
            <span>Intelligence Hub</span>
          </div>
          <span className="hub-subtitle">Autonomous AI Agents</span>
        </div>
        <div className="hub-header-right">
          {(isRunning || elapsed > 0) && (
            <div className="mission-timer">
              <Clock />
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            </div>
          )}
          {isRunning ? (
            <button type="button" className="hub-btn hub-btn-danger" onClick={stopMission}>
              <Square />
              Stop Mission
            </button>
          ) : (
            <button
              type="button"
              className="hub-btn hub-btn-primary"
              onClick={startMission}
              disabled={!missionPrompt.trim() || !apiKey}
            >
              <Rocket />
              Launch Mission
            </button>
          )}
        </div>
      </div>

      <div className="hub-body">
        {/* Mission Input */}
        <div className="mission-input-section">
          <label htmlFor="mission-prompt">Mission Objective</label>
          <div className="mission-input-wrapper">
            <textarea
              id="mission-prompt"
              placeholder="What would you like your AI agents to research and analyze?"
              value={missionPrompt}
              onChange={(e) => setMissionPrompt(e.target.value)}
              disabled={isRunning}
            />
          </div>
        </div>

        {/* Agent Grid */}
        <div className="agent-grid">
          {agents.map(agent => (
            <div
              key={agent.id}
              className={`agent-card agent-${agent.color} agent-${agent.status}`}
            >
              <div className="agent-header">
                <div className="agent-avatar">
                  {agent.role === 'researcher' && <Search />}
                  {agent.role === 'analyst' && <TrendingUp />}
                  {agent.role === 'writer' && <PenTool />}
                  {agent.role === 'critic' && <Gavel />}
                </div>
                <div className="agent-info">
                  <h4>{agent.name}</h4>
                  <span className="agent-model">{agent.model}</span>
                </div>
                <div className={`agent-status-indicator ${agent.status}`}>
                  {agent.status === 'idle' && <Circle />}
                  {agent.status === 'thinking' && <Activity />}
                  {agent.status === 'working' && <Loader2 className="animate-spin" />}
                  {agent.status === 'complete' && <CheckCircle />}
                  {agent.status === 'error' && <AlertCircle />}
                </div>
              </div>

              <div className="agent-task">{agent.task}</div>

              <div className="agent-progress">
                <div
                  className="agent-progress-bar"
                  style={{'--progress': `${agent.progress}%`} as React.CSSProperties}
                />
              </div>

              {agent.output && (
                <div className="agent-output">
                  <p>{agent.output}</p>
                  {agent.status === 'complete' && agent.output.length > 50 && (
                    <button
                      type="button"
                      className="agent-expand-btn"
                      onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                    >
                      <i className={`fa-solid fa-chevron-${expandedAgent === agent.id ? 'up' : 'down'}`}></i>
                      {expandedAgent === agent.id ? 'Collapse' : 'View Output'}
                    </button>
                  )}
                </div>
              )}
              <div className={`agent-expand-panel ${expandedAgent === agent.id ? 'open' : ''}`}>
                <AILabOutput
                  content={agent.output}
                  accentColor="#2dd4bf"
                  accentRgb="45, 212, 191"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Activity Log & Output */}
        <div className="hub-bottom">
          <div className="activity-log">
            <h4>
              <Terminal />
              Activity Log
            </h4>
            <div className="log-content">
              {logs.length === 0 ? (
                <AILabEmptyState
                  icon="fa-terminal"
                  title="Awaiting mission"
                  description="Configure your objective and click Launch"
                  accentColor="#2dd4bf"
                  accentRgb="45, 212, 191"
                  size="sm"
                />
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="log-entry">{log}</div>
                ))
              )}
            </div>
          </div>

          {showOutput && (
            <div className="final-output">
              <div className="output-header">
                <h4>
                  <FileText />
                  Intelligence Report
                </h4>
                <div className="output-actions">
                  <button
                    type="button"
                    title="Send to AI Studio"
                    onClick={sendToStudio}
                  >
                    <ArrowRight />
                    Send to Studio
                  </button>
                </div>
              </div>
              <div className="output-content">
                <AILabOutput
                  content={finalOutput}
                  accentColor="#2dd4bf"
                  accentRgb="45, 212, 191"
                  label="Intelligence Report"
                  onShare={() => setShowShare(true)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {showShare && finalOutput && (
        <ShareToChannelModal
          title={`Intelligence Report: ${missionPrompt}`}
          content={finalOutput}
          onClose={() => setShowShare(false)}
        />
      )}
      {ToastComponent}
    </div>
  );
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export default IntelligenceHub;
