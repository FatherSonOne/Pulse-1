import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';
import './BrainstormModeRedesigned.css';

// ============================================
// Types & Interfaces
// ============================================

interface Idea {
  id: string;
  text: string;
  votes: number;
  tags: string[];
  clusterId?: string;
  color?: string;
  createdAt: Date;
  createdBy?: string;
  expanded?: string;
  connections?: string[];
  priority?: 'low' | 'medium' | 'high';
  status?: 'new' | 'discussed' | 'selected' | 'rejected';
}

interface IdeaCluster {
  id: string;
  name: string;
  color: string;
  icon?: string;
  ideas: string[];
  aiGenerated?: boolean;
}

interface BrainstormTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  prompts: string[];
}

interface BrainstormModeRedesignedProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
}

// ============================================
// Constants
// ============================================

const CLUSTER_COLORS = [
  { name: 'Rose', value: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.3)' },
  { name: 'Blue', value: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },
  { name: 'Emerald', value: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' },
  { name: 'Violet', value: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)' },
  { name: 'Amber', value: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' },
  { name: 'Cyan', value: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' },
];

const BRAINSTORM_TEMPLATES: BrainstormTemplate[] = [
  {
    id: 'scamper',
    name: 'SCAMPER',
    icon: 'fa-wand-magic-sparkles',
    description: 'Creative ideation using 7 thinking techniques',
    prompts: ['Substitute', 'Combine', 'Adapt', 'Modify', 'Put to other use', 'Eliminate', 'Reverse']
  },
  {
    id: 'impact-effort',
    name: 'Impact/Effort Matrix',
    icon: 'fa-chart-scatter',
    description: 'Prioritize ideas by impact and effort',
    prompts: ['Quick Wins (High Impact, Low Effort)', 'Big Bets (High Impact, High Effort)', 'Fill-Ins (Low Impact, Low Effort)', 'Money Pit (Low Impact, High Effort)']
  },
  {
    id: 'six-hats',
    name: 'Six Thinking Hats',
    icon: 'fa-hat-wizard',
    description: 'Explore from 6 different perspectives',
    prompts: ['Facts (White)', 'Emotions (Red)', 'Caution (Black)', 'Benefits (Yellow)', 'Creativity (Green)', 'Process (Blue)']
  },
  {
    id: 'crazy-8s',
    name: 'Crazy 8s',
    icon: 'fa-stopwatch',
    description: '8 ideas in 8 minutes',
    prompts: ['Generate 8 quick ideas in 8 minutes']
  },
  {
    id: 'swot',
    name: 'SWOT Analysis',
    icon: 'fa-table-cells-large',
    description: 'Strengths, Weaknesses, Opportunities, Threats',
    prompts: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats']
  }
];

const AI_TECHNIQUES = [
  { id: 'wild', name: 'Wild Ideas', icon: 'fa-rocket', prompt: 'Generate 5 wild, unconventional ideas that break all constraints' },
  { id: 'reverse', name: 'Reverse Think', icon: 'fa-rotate-left', prompt: 'How would we make this problem worse? Then reverse those ideas.' },
  { id: 'analogy', name: 'Analogies', icon: 'fa-lightbulb', prompt: 'How would other industries solve this? Give examples from nature, tech, retail.' },
  { id: 'constraints', name: 'What If...', icon: 'fa-question', prompt: 'What if we had unlimited budget? Zero budget? Only 1 hour?' },
  { id: 'combine', name: 'Mashup', icon: 'fa-link', prompt: 'Combine two random existing ideas into something new' },
  { id: 'personas', name: 'Perspectives', icon: 'fa-users', prompt: 'How would a child approach this? An expert? A skeptic? A competitor?' },
  { id: 'gaps', name: 'Find Gaps', icon: 'fa-magnifying-glass-chart', prompt: 'What angles are we missing? What has no one mentioned yet?' },
  { id: 'simplify', name: 'Simplify', icon: 'fa-compress', prompt: 'What is the simplest possible solution? Remove all complexity.' },
];

type ViewMode = 'canvas' | 'list' | 'matrix' | 'chat';
type SessionPhase = 'setup' | 'ideate' | 'organize' | 'vote' | 'refine';

// ============================================
// Component
// ============================================

export const BrainstormModeRedesigned: React.FC<BrainstormModeRedesignedProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Brainstorm Session',
  documents = []
}) => {
  // State
  const [topic, setTopic] = useState('');
  const [isTopicSet, setIsTopicSet] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [clusters, setClusters] = useState<IdeaCluster[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('setup');
  const [input, setInput] = useState('');
  const [newIdeaText, setNewIdeaText] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [selectedIdeas, setSelectedIdeas] = useState<string[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(480); // 8 minutes default
  const [showTemplates, setShowTemplates] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ideaInputRef = useRef<HTMLInputElement>(null);

  // Effects
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(s => s - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerSeconds]);

  // ============================================
  // Handlers
  // ============================================

  const handleSetTopic = () => {
    if (!topic.trim()) return;
    setIsTopicSet(true);
    setSessionPhase('ideate');

    const templateContext = selectedTemplate
      ? `\nUsing framework: ${BRAINSTORM_TEMPLATES.find(t => t.id === selectedTemplate)?.name}`
      : '';

    onSendMessage(`[BRAINSTORM SESSION START]
Topic: "${topic}"${templateContext}

Help me brainstorm by:
1. Rephrasing this as a "How Might We..." question
2. Suggesting 3-5 initial creative ideas to get started
3. Identifying key constraints and opportunities

Remember: All ideas are valid at this stage!`);
  };

  const handleAddIdea = () => {
    if (!newIdeaText.trim()) return;
    const newIdea: Idea = {
      id: `idea-${Date.now()}`,
      text: newIdeaText.trim(),
      votes: 0,
      tags: [],
      createdAt: new Date(),
      status: 'new',
      clusterId: selectedCluster || undefined
    };
    setIdeas(prev => [...prev, newIdea]);
    setNewIdeaText('');
    ideaInputRef.current?.focus();
  };

  const handleVoteIdea = (ideaId: string, delta: number) => {
    setIdeas(prev => prev.map(idea =>
      idea.id === ideaId
        ? { ...idea, votes: Math.max(0, idea.votes + delta) }
        : idea
    ));
  };

  const handleDeleteIdea = (ideaId: string) => {
    setIdeas(prev => prev.filter(idea => idea.id !== ideaId));
    setSelectedIdeas(prev => prev.filter(id => id !== ideaId));
  };

  const handleCreateCluster = (name: string) => {
    const colorIndex = clusters.length % CLUSTER_COLORS.length;
    const newCluster: IdeaCluster = {
      id: `cluster-${Date.now()}`,
      name,
      color: CLUSTER_COLORS[colorIndex].value,
      ideas: []
    };
    setClusters(prev => [...prev, newCluster]);
    return newCluster.id;
  };

  const handleMoveToCluster = (ideaId: string, clusterId: string | null) => {
    setIdeas(prev => prev.map(idea =>
      idea.id === ideaId
        ? { ...idea, clusterId: clusterId || undefined }
        : idea
    ));
  };

  const handleSelectIdea = (ideaId: string) => {
    setSelectedIdeas(prev =>
      prev.includes(ideaId)
        ? prev.filter(id => id !== ideaId)
        : [...prev, ideaId]
    );
  };

  const handleAITechnique = (technique: typeof AI_TECHNIQUES[0]) => {
    const context = ideas.length > 0
      ? `\n\nCurrent ideas:\n${ideas.slice(0, 10).map(i => `- ${i.text}`).join('\n')}${ideas.length > 10 ? `\n... and ${ideas.length - 10} more` : ''}`
      : '';

    onSendMessage(`[BRAINSTORM - ${technique.name}]
Topic: ${topic}

${technique.prompt}${context}`);
  };

  const handleSendMessage = () => {
    const message = input.trim();
    if (!message) return;

    const context = ideas.length > 0
      ? `\n\nContext - Current ideas (${ideas.length}):\n${ideas.slice(0, 8).map(i => `- ${i.text}`).join('\n')}`
      : '';

    onSendMessage(`[BRAINSTORM] ${message}${context}`);
    setInput('');
  };

  // ============================================
  // AI-Ready Functions (Backend Hooks)
  // ============================================

  const handleAutoCluster = async () => {
    setIsAnalyzing(true);
    // TODO: Wire to backend - AI analyzes ideas and suggests clusters
    onSendMessage(`[BRAINSTORM - Auto-Cluster]
Analyze these ${ideas.length} ideas and group them into 3-5 thematic clusters:

${ideas.map(i => `- ${i.text}`).join('\n')}

For each cluster, provide:
1. A concise theme name
2. Which ideas belong to it
3. Common patterns you see`);

    setTimeout(() => setIsAnalyzing(false), 1000);
  };

  const handleFindGaps = async () => {
    setIsAnalyzing(true);
    // TODO: Wire to backend - AI identifies missing perspectives
    onSendMessage(`[BRAINSTORM - Gap Analysis]
Topic: ${topic}

Current ideas (${ideas.length}):
${ideas.map(i => `- ${i.text}`).join('\n')}

What perspectives or angles are we missing? Identify:
1. Underrepresented viewpoints
2. Unexplored directions
3. Potential blind spots
4. Suggest 3 ideas that fill these gaps`);

    setTimeout(() => setIsAnalyzing(false), 1000);
  };

  const handleExpandIdea = async (ideaId: string) => {
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;

    // TODO: Wire to backend - AI expands on a single idea
    onSendMessage(`[BRAINSTORM - Expand Idea]
Expand on this idea in detail:

"${idea.text}"

Provide:
1. How it would work in practice
2. Key benefits
3. Potential challenges
4. First steps to implement`);
  };

  const handleGenerateVariations = async (ideaId: string) => {
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;

    // TODO: Wire to backend - AI generates variations
    onSendMessage(`[BRAINSTORM - Variations]
Generate 5 variations of this idea:

"${idea.text}"

Give me:
1. A simplified version
2. An amplified version
3. A combination with another concept
4. A completely different approach to achieve the same goal
5. A "what if we did the opposite" version`);
  };

  const handleSynthesizeTop = async () => {
    const topIdeas = [...ideas].sort((a, b) => b.votes - a.votes).slice(0, 5);
    if (topIdeas.length < 2) return;

    // TODO: Wire to backend - AI synthesizes top ideas
    onSendMessage(`[BRAINSTORM - Synthesize]
Combine these top-voted ideas into 2-3 cohesive concepts:

${topIdeas.map((i, idx) => `${idx + 1}. ${i.text} (${i.votes} votes)`).join('\n')}

For each synthesis:
1. Name the concept
2. Explain how the ideas combine
3. What makes this combination powerful`);
  };

  // ============================================
  // Render Helpers
  // ============================================

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getClusterColor = (clusterId?: string) => {
    if (!clusterId) return null;
    const cluster = clusters.find(c => c.id === clusterId);
    if (!cluster) return null;
    return CLUSTER_COLORS.find(c => c.value === cluster.color) || CLUSTER_COLORS[0];
  };

  const sortedIdeas = [...ideas].sort((a, b) => b.votes - a.votes);
  const unclusteredIdeas = ideas.filter(i => !i.clusterId);

  // ============================================
  // Setup Screen
  // ============================================

  // Calculate momentum based on activity
  const getMomentum = () => {
    const recentIdeas = ideas.filter(i =>
      Date.now() - new Date(i.createdAt).getTime() < 300000 // Last 5 min
    ).length;
    const voteActivity = ideas.reduce((sum, i) => sum + i.votes, 0);
    const rawMomentum = Math.min(100, (recentIdeas * 15) + (voteActivity * 5));
    return rawMomentum;
  };

  if (!isTopicSet) {
    return (
      <div className="bsr-container bsr-setup">
        {/* Ambient Neural Background */}
        <div className="bsr-ambient">
          <div className="bsr-particles">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bsr-particle" />
            ))}
          </div>
          <div className="bsr-neural-grid" />
          <div className="bsr-orb bsr-orb-1" />
          <div className="bsr-orb bsr-orb-2" />
          <div className="bsr-orb bsr-orb-3" />
          <div className="bsr-noise" />
        </div>

        <div className="bsr-setup-content">
          {/* Header with Neural Hub Icon */}
          <div className="bsr-setup-header">
            <div className="bsr-neural-hub">
              <div className="bsr-hub-core">
                <i className="fa fa-lightbulb"></i>
              </div>
              <div className="bsr-hub-rings">
                <div className="bsr-hub-ring" />
                <div className="bsr-hub-ring" />
                <div className="bsr-hub-ring" />
              </div>
              <div className="bsr-synapses">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bsr-synapse" />
                ))}
              </div>
            </div>
            <h1 className="bsr-setup-title">Brainstorm Mode</h1>
            <p className="bsr-setup-subtitle">
              Generate ideas, explore perspectives, and unlock creative solutions
            </p>
          </div>

          {/* Topic Input */}
          <div className="bsr-setup-form">
            <label className="bsr-label">What would you like to brainstorm?</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetTopic()}
              placeholder="e.g., New feature ideas, Marketing strategies, Process improvements..."
              className="bsr-input bsr-input-lg"
              autoFocus
            />

            {/* Quick Suggestions */}
            <div className="bsr-suggestions">
              <span className="bsr-suggestions-label">Try:</span>
              {['Product features', 'Growth ideas', 'Team processes', 'Customer problems'].map(s => (
                <button key={s} onClick={() => setTopic(s)} className="bsr-suggestion-chip">
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Framework Selection */}
          <div className="bsr-templates-section">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="bsr-templates-toggle"
            >
              <i className={`fa ${showTemplates ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
              <span>Use a Framework</span>
              {selectedTemplate && (
                <span className="bsr-template-badge">
                  {BRAINSTORM_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                </span>
              )}
            </button>

            {showTemplates && (
              <div className="bsr-templates-grid">
                {BRAINSTORM_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(
                      selectedTemplate === template.id ? null : template.id
                    )}
                    className={`bsr-template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                  >
                    <div className="bsr-template-icon">
                      <i className={`fa ${template.icon}`}></i>
                    </div>
                    <div className="bsr-template-info">
                      <span className="bsr-template-name">{template.name}</span>
                      <span className="bsr-template-desc">{template.description}</span>
                    </div>
                    {selectedTemplate === template.id && (
                      <i className="fa fa-check bsr-template-check"></i>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Start Button */}
          <button
            onClick={handleSetTopic}
            disabled={!topic.trim()}
            className="bsr-btn bsr-btn-primary bsr-btn-lg"
          >
            <i className="fa fa-rocket"></i>
            Start Brainstorming
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // Main Session UI
  // ============================================

  const momentum = getMomentum();

  return (
    <div className="bsr-container">
      {/* Ambient Neural Background */}
      <div className="bsr-ambient">
        <div className="bsr-particles">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bsr-particle" />
          ))}
        </div>
        <div className="bsr-neural-grid" />
        <div className="bsr-orb bsr-orb-1" />
        <div className="bsr-orb bsr-orb-2" />
        <div className="bsr-orb bsr-orb-3" />
        <div className="bsr-noise" />
      </div>

      {/* Main Layout */}
      <div className="bsr-layout">
        {/* Left Sidebar - Ideas Panel */}
        <div className="bsr-sidebar">
          {/* Session Header */}
          <div className="bsr-sidebar-header">
            <div className="bsr-topic-badge">
              <i className="fa fa-lightbulb"></i>
              <span className="bsr-topic-text">{topic}</span>
            </div>
            <div className="bsr-session-stats">
              <span><i className="fa fa-sticky-note"></i> {ideas.length} ideas</span>
              <span><i className="fa fa-layer-group"></i> {clusters.length} clusters</span>
            </div>

            {/* Momentum Gauge - NEW */}
            <div className="bsr-momentum">
              <div className="bsr-momentum-header">
                <span className="bsr-momentum-label">Session Momentum</span>
                <span className="bsr-momentum-value">{momentum}%</span>
              </div>
              <div className="bsr-momentum-bar">
                <div
                  className="bsr-momentum-fill"
                  style={{ width: `${momentum}%` }}
                />
              </div>
            </div>
          </div>

        {/* Add Idea */}
        <div className="bsr-add-idea">
          <div className="bsr-add-idea-input">
            <input
              ref={ideaInputRef}
              type="text"
              value={newIdeaText}
              onChange={(e) => setNewIdeaText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddIdea()}
              placeholder="Add an idea..."
              className="bsr-input"
            />
            <button
              onClick={handleAddIdea}
              disabled={!newIdeaText.trim()}
              className="bsr-btn bsr-btn-primary bsr-btn-icon"
            >
              <i className="fa fa-plus"></i>
            </button>
          </div>
        </div>

        {/* Clusters */}
        <div className="bsr-clusters-section">
          <div className="bsr-section-header">
            <span className="bsr-section-title">
              <i className="fa fa-layer-group"></i> Clusters
            </span>
            <button
              onClick={() => {
                const name = prompt('Cluster name:');
                if (name) handleCreateCluster(name);
              }}
              className="bsr-btn bsr-btn-ghost bsr-btn-sm"
            >
              <i className="fa fa-plus"></i>
            </button>
          </div>

          <div className="bsr-clusters-list">
            <button
              onClick={() => setSelectedCluster(null)}
              className={`bsr-cluster-chip ${!selectedCluster ? 'active' : ''}`}
            >
              All ({ideas.length})
            </button>
            {clusters.map(cluster => {
              const count = ideas.filter(i => i.clusterId === cluster.id).length;
              return (
                <button
                  key={cluster.id}
                  onClick={() => setSelectedCluster(
                    selectedCluster === cluster.id ? null : cluster.id
                  )}
                  className={`bsr-cluster-chip ${selectedCluster === cluster.id ? 'active' : ''}`}
                  style={{
                    '--cluster-color': cluster.color,
                    borderColor: selectedCluster === cluster.id ? cluster.color : undefined
                  } as React.CSSProperties}
                >
                  <span className="bsr-cluster-dot" style={{ background: cluster.color }}></span>
                  {cluster.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Ideas List */}
        <div className="bsr-ideas-list">
          {(selectedCluster
            ? ideas.filter(i => i.clusterId === selectedCluster)
            : ideas
          ).map(idea => {
            const clusterColor = getClusterColor(idea.clusterId);
            return (
              <div
                key={idea.id}
                className={`bsr-idea-card ${selectedIdeas.includes(idea.id) ? 'selected' : ''}`}
                style={clusterColor ? {
                  background: clusterColor.bg,
                  borderColor: clusterColor.border
                } : undefined}
              >
                <p className="bsr-idea-text">{idea.text}</p>
                <div className="bsr-idea-actions">
                  <div className="bsr-vote-controls">
                    <button onClick={() => handleVoteIdea(idea.id, 1)} className="bsr-vote-btn">
                      <i className="fa fa-chevron-up"></i>
                    </button>
                    <span className={`bsr-vote-count ${idea.votes > 0 ? 'has-votes' : ''}`}>
                      {idea.votes}
                    </span>
                    <button onClick={() => handleVoteIdea(idea.id, -1)} className="bsr-vote-btn">
                      <i className="fa fa-chevron-down"></i>
                    </button>
                  </div>
                  <div className="bsr-idea-menu">
                    <button
                      onClick={() => handleExpandIdea(idea.id)}
                      className="bsr-action-btn"
                      title="Expand idea"
                    >
                      <i className="fa fa-expand"></i>
                    </button>
                    <button
                      onClick={() => handleGenerateVariations(idea.id)}
                      className="bsr-action-btn"
                      title="Generate variations"
                    >
                      <i className="fa fa-code-branch"></i>
                    </button>
                    {clusters.length > 0 && (
                      <select
                        value={idea.clusterId || ''}
                        onChange={(e) => handleMoveToCluster(idea.id, e.target.value || null)}
                        className="bsr-cluster-select"
                      >
                        <option value="">No cluster</option>
                        {clusters.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => handleDeleteIdea(idea.id)}
                      className="bsr-action-btn bsr-action-delete"
                      title="Delete"
                    >
                      <i className="fa fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {ideas.length === 0 && (
            <div className="bsr-empty-state">
              <i className="fa fa-lightbulb"></i>
              <p>No ideas yet</p>
              <span>Add your own or ask AI for suggestions</span>
            </div>
          )}
        </div>

        {/* Top Ideas Summary */}
        {ideas.length >= 3 && (
          <div className="bsr-top-ideas">
            <div className="bsr-section-header">
              <span className="bsr-section-title">
                <i className="fa fa-trophy"></i> Top Rated
              </span>
            </div>
            <div className="bsr-top-ideas-list">
              {sortedIdeas.slice(0, 3).map((idea, i) => (
                <div key={idea.id} className="bsr-top-idea">
                  <span className={`bsr-rank bsr-rank-${i + 1}`}>{i + 1}</span>
                  <span className="bsr-top-idea-text">{idea.text}</span>
                  <span className="bsr-top-idea-votes">{idea.votes}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sidebar Footer */}
        <div className="bsr-sidebar-footer">
          <button onClick={() => setShowExport(true)} className="bsr-btn bsr-btn-ghost">
            <i className="fa fa-share-nodes"></i> Export
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bsr-main">
        {/* Toolbar */}
        <div className="bsr-toolbar">
          <div className="bsr-toolbar-left">
            {/* View Mode Toggle */}
            <div className="bsr-view-toggle">
              {[
                { id: 'canvas', icon: 'fa-grip', label: 'Canvas' },
                { id: 'list', icon: 'fa-list', label: 'List' },
                { id: 'chat', icon: 'fa-comments', label: 'AI Chat' },
              ].map(view => (
                <button
                  key={view.id}
                  onClick={() => setViewMode(view.id as ViewMode)}
                  className={`bsr-view-btn ${viewMode === view.id ? 'active' : ''}`}
                >
                  <i className={`fa ${view.icon}`}></i>
                  <span>{view.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bsr-toolbar-center">
            {/* Timer */}
            <div className="bsr-timer">
              <button
                onClick={() => setTimerActive(!timerActive)}
                className={`bsr-timer-btn ${timerActive ? 'active' : ''}`}
              >
                <i className={`fa ${timerActive ? 'fa-pause' : 'fa-play'}`}></i>
              </button>
              <span className={`bsr-timer-display ${timerSeconds < 60 ? 'warning' : ''}`}>
                {formatTime(timerSeconds)}
              </span>
              <button
                onClick={() => { setTimerSeconds(480); setTimerActive(false); }}
                className="bsr-timer-btn"
              >
                <i className="fa fa-rotate-right"></i>
              </button>
            </div>
          </div>

          <div className="bsr-toolbar-right">
            {/* AI Actions */}
            <button
              onClick={() => setShowAIPanel(!showAIPanel)}
              className={`bsr-btn ${showAIPanel ? 'bsr-btn-primary' : 'bsr-btn-ghost'}`}
            >
              <i className="fa fa-wand-magic-sparkles"></i>
              AI Tools
            </button>
          </div>
        </div>

        {/* AI Techniques Bar */}
        <div className="bsr-ai-bar">
          <div className="bsr-ai-techniques">
            {AI_TECHNIQUES.slice(0, 6).map(tech => (
              <button
                key={tech.id}
                onClick={() => handleAITechnique(tech)}
                disabled={isLoading}
                className="bsr-technique-btn"
              >
                <i className={`fa ${tech.icon}`}></i>
                <span>{tech.name}</span>
              </button>
            ))}
          </div>
          <div className="bsr-ai-actions">
            <button
              onClick={handleAutoCluster}
              disabled={ideas.length < 3 || isAnalyzing}
              className="bsr-ai-action-btn"
              title="AI auto-cluster ideas"
            >
              <i className={`fa ${isAnalyzing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
              Auto-Cluster
            </button>
            <button
              onClick={handleFindGaps}
              disabled={ideas.length < 3 || isAnalyzing}
              className="bsr-ai-action-btn"
              title="Find missing perspectives"
            >
              <i className="fa fa-magnifying-glass-chart"></i>
              Find Gaps
            </button>
            <button
              onClick={handleSynthesizeTop}
              disabled={ideas.filter(i => i.votes > 0).length < 2}
              className="bsr-ai-action-btn"
              title="Synthesize top ideas"
            >
              <i className="fa fa-code-merge"></i>
              Synthesize
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bsr-content">
          {viewMode === 'chat' ? (
            // Chat View
            <div className="bsr-chat">
              <div className="bsr-messages">
                {messages.length === 0 ? (
                  <div className="bsr-chat-empty">
                    <div className="bsr-chat-empty-icon">
                      <i className="fa fa-wand-magic-sparkles"></i>
                    </div>
                    <h3>AI Brainstorm Partner</h3>
                    <p>Ask for ideas, challenge assumptions, or explore new angles</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`bsr-message ${msg.role === 'user' ? 'bsr-message-user' : 'bsr-message-ai'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="bsr-message-header">
                          <i className="fa fa-lightbulb"></i>
                          <span>Brainstorm AI</span>
                        </div>
                      )}
                      <div className="bsr-message-content">
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}

                {isLoading && (
                  <div className="bsr-message bsr-message-ai">
                    <div className="bsr-message-loading">
                      <div className="bsr-loading-dots">
                        <span></span><span></span><span></span>
                      </div>
                      <span>Generating ideas...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          ) : viewMode === 'canvas' ? (
            // Canvas View
            <div className="bsr-canvas">
              {/* Unclustered Ideas */}
              {unclusteredIdeas.length > 0 && (
                <div className="bsr-canvas-section">
                  <h4 className="bsr-canvas-section-title">
                    <i className="fa fa-sparkles"></i> Unclustered Ideas
                  </h4>
                  <div className="bsr-canvas-grid">
                    {unclusteredIdeas.map(idea => (
                      <div key={idea.id} className="bsr-canvas-card">
                        <p>{idea.text}</p>
                        <div className="bsr-canvas-card-footer">
                          <span className={idea.votes > 0 ? 'has-votes' : ''}>
                            <i className="fa fa-arrow-up"></i> {idea.votes}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clustered Ideas */}
              {clusters.map(cluster => {
                const clusterIdeas = ideas.filter(i => i.clusterId === cluster.id);
                const color = CLUSTER_COLORS.find(c => c.value === cluster.color) || CLUSTER_COLORS[0];

                return (
                  <div
                    key={cluster.id}
                    className="bsr-canvas-cluster"
                    style={{
                      background: color.bg,
                      borderColor: color.border
                    }}
                  >
                    <h4 className="bsr-cluster-title" style={{ color: color.value }}>
                      <i className="fa fa-folder"></i>
                      {cluster.name}
                      <span className="bsr-cluster-count">{clusterIdeas.length}</span>
                    </h4>
                    <div className="bsr-cluster-ideas">
                      {clusterIdeas.map(idea => (
                        <div key={idea.id} className="bsr-cluster-idea">
                          <p>{idea.text}</p>
                          {idea.votes > 0 && (
                            <span className="bsr-idea-votes">
                              <i className="fa fa-arrow-up"></i> {idea.votes}
                            </span>
                          )}
                        </div>
                      ))}
                      {clusterIdeas.length === 0 && (
                        <p className="bsr-cluster-empty">Drag ideas here</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {ideas.length === 0 && clusters.length === 0 && (
                <div className="bsr-canvas-empty">
                  <i className="fa fa-grip"></i>
                  <p>Your ideas will appear here</p>
                  <span>Add ideas from the sidebar or use AI techniques above</span>
                </div>
              )}
            </div>
          ) : (
            // List View
            <div className="bsr-list-view">
              <table className="bsr-ideas-table">
                <thead>
                  <tr>
                    <th>Idea</th>
                    <th>Cluster</th>
                    <th>Votes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedIdeas.map(idea => (
                    <tr key={idea.id}>
                      <td>{idea.text}</td>
                      <td>
                        {idea.clusterId
                          ? clusters.find(c => c.id === idea.clusterId)?.name || '-'
                          : '-'
                        }
                      </td>
                      <td>
                        <span className={idea.votes > 0 ? 'has-votes' : ''}>
                          {idea.votes}
                        </span>
                      </td>
                      <td>
                        <div className="bsr-table-actions">
                          <button onClick={() => handleExpandIdea(idea.id)}>
                            <i className="fa fa-expand"></i>
                          </button>
                          <button onClick={() => handleDeleteIdea(idea.id)}>
                            <i className="fa fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bsr-input-area">
          <div className="bsr-input-container">
            <i className="fa fa-wand-magic-sparkles"></i>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask AI for more ideas, challenges, or perspectives..."
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className={`bsr-send-btn ${input.trim() ? 'active' : ''}`}
            >
              <i className="fa fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>

        {/* Export Modal */}
        {showExport && (
          <SessionExport
            sessionId={sessionId}
            sessionTitle={sessionTitle}
            messages={messages}
            topic={topic}
            mode="Brainstorm Mode"
            documents={documents}
            onClose={() => setShowExport(false)}
          />
        )}
      </div>

      {/* AI Synthesis Orb - Floating Action Button */}
      {ideas.length >= 3 && (
        <div className={`bsr-synthesis-orb ${isAnalyzing ? 'analyzing' : ''}`}>
          <div className="bsr-orb-ripple" />
          <div className="bsr-orb-ripple" />
          <div className="bsr-orb-ripple" />
          <button
            className="bsr-orb-inner"
            onClick={handleSynthesizeTop}
            disabled={ideas.filter(i => i.votes > 0).length < 2}
            title="AI Synthesize Top Ideas"
          >
            <i className={`fa ${isAnalyzing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default BrainstormModeRedesigned;
