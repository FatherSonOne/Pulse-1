import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import './IntelligenceHub.css';

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
  task?: string;
  output?: string;
  color: string;
}

interface ResearchTask {
  id: string;
  query: string;
  status: 'pending' | 'running' | 'complete';
  results?: any[];
}

const AGENT_PRESETS: Omit<Agent, 'id' | 'status' | 'progress'>[] = [
  { name: 'Scout', role: 'researcher', model: 'Perplexity', color: 'cyan', task: 'Find relevant information', output: '' },
  { name: 'Sage', role: 'analyst', model: 'Claude', color: 'violet', task: 'Analyze and synthesize data', output: '' },
  { name: 'Scribe', role: 'writer', model: 'GPT-4o', color: 'emerald', task: 'Draft content and reports', output: '' },
  { name: 'Judge', role: 'critic', model: 'Gemini', color: 'amber', task: 'Review and improve output', output: '' },
];

const IntelligenceHub: React.FC<IntelligenceHubProps> = ({ onBack, apiKey }) => {
  const { missionPrompt, setMissionPrompt } = useWorkspace();
  const [agents, setAgents] = useState<Agent[]>(
    AGENT_PRESETS.map((preset, i) => ({
      ...preset,
      id: `agent-${i}`,
      status: 'idle',
      progress: 0,
    }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [finalOutput, setFinalOutput] = useState('');
  const [showOutput, setShowOutput] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const simulateAgentWork = async (agent: Agent, index: number) => {
    // Start thinking
    setAgents(prev => prev.map(a => 
      a.id === agent.id ? { ...a, status: 'thinking' } : a
    ));
    addLog(`🤔 ${agent.name} is analyzing the mission...`);
    
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    
    // Start working
    setAgents(prev => prev.map(a => 
      a.id === agent.id ? { ...a, status: 'working', progress: 0 } : a
    ));
    addLog(`⚡ ${agent.name} started ${agent.task.toLowerCase()}`);
    
    // Simulate progress
    for (let p = 0; p <= 100; p += 10 + Math.random() * 20) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      setAgents(prev => prev.map(a => 
        a.id === agent.id ? { ...a, progress: Math.min(p, 100) } : a
      ));
    }
    
    // Complete
    const outputs = [
      `Found 15 relevant sources on "${missionPrompt}". Key findings include market trends, competitive analysis, and emerging opportunities.`,
      `Analyzed data from multiple sources. Identified 3 major themes: innovation drivers, market gaps, and strategic recommendations.`,
      `Drafted comprehensive report with executive summary, detailed analysis, and action items for stakeholder review.`,
      `Quality review complete. Verified factual accuracy, improved clarity in 4 sections, and added supporting citations.`,
    ];
    
    setAgents(prev => prev.map(a => 
      a.id === agent.id ? { 
        ...a, 
        status: 'complete', 
        progress: 100,
        output: outputs[index] || 'Task completed successfully.'
      } : a
    ));
    addLog(`✅ ${agent.name} completed their task`);
  };

  const startMission = async () => {
    if (!missionPrompt.trim()) return;
    
    setIsRunning(true);
    setLogs([]);
    setFinalOutput('');
    setShowOutput(false);
    
    addLog(`🚀 Mission initiated: "${missionPrompt}"`);
    addLog('📡 Deploying AI agents...');
    
    // Reset all agents
    setAgents(prev => prev.map(a => ({ ...a, status: 'idle', progress: 0, output: '' })));
    
    // Run agents sequentially for better visualization
    for (let i = 0; i < agents.length; i++) {
      await simulateAgentWork(agents[i], i);
    }
    
    // Compile final output
    addLog('📝 Compiling final report...');
    await new Promise(r => setTimeout(r, 1000));
    
    setFinalOutput(`
# Intelligence Report: ${missionPrompt}

## Executive Summary
Based on comprehensive research and analysis from our AI agent team, here are the key findings and recommendations.

## Research Findings (Scout)
Found 15 relevant sources covering market trends, competitive landscape, and emerging opportunities in the space.

## Analysis (Sage)
Three major themes emerged:
1. **Innovation Drivers** - Technology advancement and market demand
2. **Market Gaps** - Underserved segments and unmet needs  
3. **Strategic Opportunities** - Areas for competitive advantage

## Recommendations (Scribe)
1. Focus on differentiation through superior user experience
2. Build strategic partnerships to accelerate growth
3. Invest in R&D to maintain technological edge

## Quality Verified (Judge)
All findings have been cross-referenced and validated. Report is ready for stakeholder presentation.

---
*Generated by Pulse Intelligence Hub*
    `);
    
    addLog('🎯 Mission complete!');
    setIsRunning(false);
    setShowOutput(true);
  };

  const stopMission = () => {
    setIsRunning(false);
    setAgents(prev => prev.map(a => ({ ...a, status: 'idle', progress: 0 })));
    addLog('⛔ Mission aborted by user');
  };

  return (
    <div className="intelligence-hub">
      {/* Header */}
      <div className="hub-header">
        <div className="hub-header-left">
          <button onClick={onBack} className="hub-back-btn">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="hub-branding">
            <i className="fa-solid fa-brain"></i>
            <span>Intelligence Hub</span>
          </div>
          <span className="hub-subtitle">Autonomous AI Agents</span>
        </div>
        <div className="hub-header-right">
          {isRunning ? (
            <button className="hub-btn hub-btn-danger" onClick={stopMission}>
              <i className="fa-solid fa-stop"></i>
              Stop Mission
            </button>
          ) : (
            <button 
              className="hub-btn hub-btn-primary" 
              onClick={startMission}
              disabled={!missionPrompt.trim()}
            >
              <i className="fa-solid fa-rocket"></i>
              Launch Mission
            </button>
          )}
        </div>
      </div>

      <div className="hub-body">
        {/* Mission Input */}
        <div className="mission-input-section">
          <label>Mission Objective</label>
          <div className="mission-input-wrapper">
            <textarea
              placeholder="What would you like your AI agents to research and analyze?"
              value={missionPrompt}
              onChange={(e) => setMissionPrompt(e.target.value)}
              disabled={isRunning}
            />
            <div className="mission-input-actions">
              <button title="Import from Pulse">
                <i className="fa-solid fa-database"></i>
              </button>
              <button title="Load template">
                <i className="fa-solid fa-bookmark"></i>
              </button>
            </div>
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
                  {agent.role === 'researcher' && <i className="fa-solid fa-magnifying-glass"></i>}
                  {agent.role === 'analyst' && <i className="fa-solid fa-chart-line"></i>}
                  {agent.role === 'writer' && <i className="fa-solid fa-pen-fancy"></i>}
                  {agent.role === 'critic' && <i className="fa-solid fa-gavel"></i>}
                </div>
                <div className="agent-info">
                  <h4>{agent.name}</h4>
                  <span className="agent-model">{agent.model}</span>
                </div>
                <div className={`agent-status-indicator ${agent.status}`}>
                  {agent.status === 'idle' && <i className="fa-solid fa-circle"></i>}
                  {agent.status === 'thinking' && <i className="fa-solid fa-brain fa-pulse"></i>}
                  {agent.status === 'working' && <i className="fa-solid fa-spinner fa-spin"></i>}
                  {agent.status === 'complete' && <i className="fa-solid fa-check-circle"></i>}
                  {agent.status === 'error' && <i className="fa-solid fa-exclamation-circle"></i>}
                </div>
              </div>
              
              <div className="agent-task">{agent.task}</div>
              
              <div className="agent-progress">
                <div 
                  className="agent-progress-bar" 
                  style={{ width: `${agent.progress}%` }}
                />
              </div>
              
              {agent.output && (
                <div className="agent-output">
                  <p>{agent.output}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Activity Log & Output */}
        <div className="hub-bottom">
          <div className="activity-log">
            <h4>
              <i className="fa-solid fa-terminal"></i>
              Activity Log
            </h4>
            <div className="log-content">
              {logs.length === 0 ? (
                <div className="log-empty">Waiting to start mission...</div>
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
                  <i className="fa-solid fa-file-lines"></i>
                  Intelligence Report
                </h4>
                <div className="output-actions">
                  <button title="Copy to clipboard">
                    <i className="fa-solid fa-copy"></i>
                  </button>
                  <button title="Export">
                    <i className="fa-solid fa-download"></i>
                  </button>
                  <button title="Send to AI Studio">
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                </div>
              </div>
              <div className="output-content">
                <pre>{finalOutput}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntelligenceHub;
