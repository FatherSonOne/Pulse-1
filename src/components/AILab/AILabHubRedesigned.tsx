import React, { useState, useCallback, useMemo } from 'react';
import { useWorkspace, WorkspaceProvider } from './shared/WorkspaceContext';
import AICanvas from './workspaces/AICanvas';
import MissionControl from './workspaces/MissionControl';
import AIStudio from './workspaces/AIStudio';
import IntelligenceHub from './workspaces/IntelligenceHub';
import QuickActions from './workspaces/QuickActions';
import ProposalBuilder from './workspaces/ProposalBuilder';
import './AILabHubRedesigned.css';

// ============= TYPES =============

interface AILabHubRedesignedProps {
  apiKey: string;
  isDarkMode?: boolean;
}

interface WorkspaceConfig {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  features: { icon: string; text: string }[];
  instructions: string;
  comingSoon?: boolean;
}

// ============= ENHANCED WORKSPACE DATA =============

const ENHANCED_WORKSPACES: WorkspaceConfig[] = [
  {
    id: 'canvas',
    name: 'AI Canvas',
    tagline: 'Visual Workflow Builder',
    description: 'Create powerful AI workflows by connecting intelligent nodes. Drag, drop, and design automated pipelines that transform your data through multiple AI processing stages.',
    icon: 'fa-diagram-project',
    features: [
      { icon: 'fa-code-branch', text: 'Node-based visual workflows' },
      { icon: 'fa-link', text: 'Chain multiple AI operations' },
      { icon: 'fa-save', text: 'Save & reuse custom recipes' },
      { icon: 'fa-eye', text: 'Real-time preview results' }
    ],
    instructions: 'Drag AI tools from the sidebar onto the canvas. Connect output ports to input ports to create processing chains. Click any node to configure its parameters.'
  },
  {
    id: 'mission',
    name: 'Mission Control',
    tagline: 'Multi-Panel Command Center',
    description: 'Orchestrate complex AI operations across multiple panels simultaneously. Monitor live data streams, manage parallel processes, and maintain complete operational awareness.',
    icon: 'fa-satellite-dish',
    features: [
      { icon: 'fa-table-columns', text: 'Customizable grid layout' },
      { icon: 'fa-bolt', text: 'Live streaming data panels' },
      { icon: 'fa-arrows-turn-to-dots', text: 'Cross-panel communication' },
      { icon: 'fa-file-export', text: 'Export unified briefings' }
    ],
    instructions: 'Add panels using the + button. Resize by dragging edges. Panels can share data - outputs from one panel auto-populate as options in others.'
  },
  {
    id: 'studio',
    name: 'AI Studio',
    tagline: 'Presentation Powerhouse',
    description: 'Transform raw data into stunning presentations and interactive dashboards. Let AI compose narratives, design layouts, and generate professional-grade visual content.',
    icon: 'fa-wand-magic-sparkles',
    features: [
      { icon: 'fa-database', text: 'Import from any Pulse source' },
      { icon: 'fa-pen-to-square', text: 'AI-composed narratives' },
      { icon: 'fa-code', text: 'Interactive HTML export' },
      { icon: 'fa-file-pdf', text: 'Multiple export formats' }
    ],
    instructions: 'Start by selecting a data source or pasting content. Choose a template style, then let AI generate your presentation. Edit any section manually or regenerate with different parameters.'
  },
  {
    id: 'hub',
    name: 'Intelligence Hub',
    tagline: 'Autonomous Agent Swarm',
    description: 'Deploy teams of specialized AI agents that research, analyze, and synthesize information in parallel. Watch as your digital workforce tackles complex problems autonomously.',
    icon: 'fa-brain-circuit',
    features: [
      { icon: 'fa-robot', text: 'Autonomous research agents' },
      { icon: 'fa-layer-group', text: 'Parallel processing power' },
      { icon: 'fa-chart-line', text: 'Live progress tracking' },
      { icon: 'fa-object-group', text: 'Auto-compiled results' }
    ],
    instructions: 'Define your research objective and spawn agents. Each agent specializes in different aspects. Results are automatically synthesized into a unified report when all agents complete.'
  },
  {
    id: 'actions',
    name: 'Quick Actions',
    tagline: 'Context-Aware AI Assistant',
    description: 'Experience AI that anticipates your needs. Smart suggestions appear exactly when you need them, offering one-click actions based on your current context and workflow.',
    icon: 'fa-bolt-lightning',
    features: [
      { icon: 'fa-lightbulb', text: 'Intelligent suggestions' },
      { icon: 'fa-hand-pointer', text: 'One-click AI actions' },
      { icon: 'fa-globe', text: 'Works across Pulse' },
      { icon: 'fa-keyboard', text: 'Keyboard shortcuts' }
    ],
    instructions: 'Enable Quick Actions in settings to see contextual AI suggestions throughout Pulse. Use ⌘K (Mac) or Ctrl+K (Windows) to invoke actions anywhere.'
  },
  {
    id: 'proposal',
    name: 'Proposal Builder',
    tagline: 'Professional Document Wizard',
    description: 'Create compelling proposals, quotes, and business documents through a guided wizard. AI drafts each section while you maintain creative control over the final output.',
    icon: 'fa-file-signature',
    features: [
      { icon: 'fa-list-check', text: 'Step-by-step wizard' },
      { icon: 'fa-clone', text: 'Professional templates' },
      { icon: 'fa-address-book', text: 'Import contact data' },
      { icon: 'fa-magic', text: 'AI-powered drafts' }
    ],
    instructions: 'Select a template to begin. The wizard guides you through each section. Pull in client data from contacts, customize AI suggestions, and export as PDF or share via link.'
  }
];

// ============= COMPONENTS =============

// SVG Synaptic Background
const SynapticBackground: React.FC = () => (
  <svg className="nexus-synapses" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="synapse-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--nexus-cyan)" />
        <stop offset="100%" stopColor="var(--nexus-violet)" />
      </linearGradient>
    </defs>
    {/* Neural Connection Lines */}
    <path className="nexus-synapse-line" d="M0,100 Q250,50 500,150 T1000,100" style={{ animationDelay: '0s' }} />
    <path className="nexus-synapse-line" d="M0,300 Q200,250 400,350 T800,280 T1000,320" style={{ animationDelay: '-1s' }} />
    <path className="nexus-synapse-line" d="M0,500 Q300,450 600,550 T1000,480" style={{ animationDelay: '-2s' }} />
    <path className="nexus-synapse-line" d="M100,0 Q150,200 200,400 T250,600" style={{ animationDelay: '-0.5s' }} />
    <path className="nexus-synapse-line" d="M500,0 Q550,150 500,300 T550,450 T500,600" style={{ animationDelay: '-1.5s' }} />
    <path className="nexus-synapse-line" d="M900,0 Q850,200 900,400 T850,600" style={{ animationDelay: '-2.5s' }} />
  </svg>
);

// Central Nucleus Animation
const NucleusIcon: React.FC = () => (
  <div className="nexus-nucleus">
    <div className="nexus-nucleus-ring nexus-nucleus-ring-1" />
    <div className="nexus-nucleus-ring nexus-nucleus-ring-2" />
    <div className="nexus-nucleus-ring nexus-nucleus-ring-3" />
    <div className="nexus-nucleus-core">
      <i className="fa-solid fa-atom" />
    </div>
    <div className="nexus-orbit-particle nexus-orbit-particle-1" />
    <div className="nexus-orbit-particle nexus-orbit-particle-2" />
    <div className="nexus-orbit-particle nexus-orbit-particle-3" />
  </div>
);

// Workspace Card Component
const WorkspaceCard: React.FC<{
  config: WorkspaceConfig;
  onClick: () => void;
  delay: number;
}> = ({ config, onClick, delay }) => {
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <button
      onClick={onClick}
      className="nexus-card nexus-shimmer"
      data-workspace={config.id}
      style={{ animationDelay: `${delay}ms` }}
      disabled={config.comingSoon}
      onMouseEnter={() => setShowInstructions(true)}
      onMouseLeave={() => setShowInstructions(false)}
    >
      {/* Glow Effect */}
      <div className="nexus-card-glow" />

      {/* Card Content */}
      <div className="nexus-card-content">
        {/* Tool Icon */}
        <div className="nexus-tool-icon">
          <div className="nexus-tool-icon-bg" />
          <div className="nexus-tool-icon-inner">
            <i className={`fa-solid ${config.icon}`} />
          </div>
          <div className="nexus-tool-icon-pulse" />
        </div>

        {/* Title & Description */}
        <h3 className="nexus-card-title">{config.name}</h3>
        <p className="nexus-card-description">
          {showInstructions ? config.instructions : config.description}
        </p>

        {/* Features */}
        <div className="nexus-card-features">
          {config.features.map((feature, i) => (
            <div key={i} className="nexus-feature">
              <div className="nexus-feature-icon">
                <i className={`fa-solid ${feature.icon}`} />
              </div>
              <span>{feature.text}</span>
            </div>
          ))}
        </div>

        {/* Launch Button */}
        <div className="nexus-launch-btn">
          <span>{config.comingSoon ? 'Coming Soon' : 'Launch Workspace'}</span>
          <div className="nexus-launch-arrow">
            <i className="fa-solid fa-arrow-right" />
          </div>
        </div>

        {/* Coming Soon Badge */}
        {config.comingSoon && (
          <div className="nexus-coming-soon">In Development</div>
        )}
      </div>
    </button>
  );
};

// Neural Activity Indicator
const NeuralActivity: React.FC = () => (
  <div className="nexus-activity">
    <div className="nexus-activity-pulse">
      <div className="nexus-activity-bar" />
      <div className="nexus-activity-bar" />
      <div className="nexus-activity-bar" />
      <div className="nexus-activity-bar" />
      <div className="nexus-activity-bar" />
    </div>
    <span className="nexus-activity-text">Neural Systems Active</span>
  </div>
);

// Main Hub Content
const HubContent: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();

  // Render active workspace
  if (activeWorkspace) {
    const WorkspaceComponent = {
      canvas: AICanvas,
      mission: MissionControl,
      studio: AIStudio,
      hub: IntelligenceHub,
      actions: QuickActions,
      proposal: ProposalBuilder,
    }[activeWorkspace];

    if (!WorkspaceComponent) return null;

    return (
      <div className="nexus-workspace-container">
        <WorkspaceComponent onBack={() => setActiveWorkspace(null)} apiKey={apiKey} />
      </div>
    );
  }

  // Render hub landing page
  return (
    <div className="nexus-container">
      {/* Neural Background */}
      <div className="nexus-neural-bg">
        <div className="nexus-grid-overlay" />
        <div className="nexus-orb nexus-orb-1" />
        <div className="nexus-orb nexus-orb-2" />
        <div className="nexus-orb nexus-orb-3" />
        <SynapticBackground />
      </div>

      {/* Hero Section */}
      <div className="nexus-hero">
        <div className="nexus-hero-content">
          {/* Living Badge */}
          <div className="nexus-badge">
            <div className="nexus-badge-dot" />
            <span>AI-Powered Workspaces Online</span>
          </div>

          {/* Title */}
          <h1 className="nexus-title">AI LAB</h1>
          <p className="nexus-subtitle">Neural Nexus • Prototype Environment</p>

          {/* Nucleus Animation */}
          <NucleusIcon />

          {/* Description */}
          <p className="nexus-description">
            Enter the neural nexus - a living AI laboratory where intelligent workspaces
            pulse with creative potential. Choose your workspace to begin transforming
            ideas into reality.
          </p>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="nexus-grid">
        {ENHANCED_WORKSPACES.map((ws, i) => (
          <WorkspaceCard
            key={ws.id}
            config={ws}
            onClick={() => !ws.comingSoon && setActiveWorkspace(ws.id as any)}
            delay={i * 100}
          />
        ))}
      </div>

      {/* Stats Section */}
      <div className="nexus-stats">
        <div className="nexus-stat">
          <span className="nexus-stat-value">7+</span>
          <span className="nexus-stat-label">AI Models</span>
        </div>
        <div className="nexus-stat">
          <span className="nexus-stat-value">6</span>
          <span className="nexus-stat-label">Workspaces</span>
        </div>
        <div className="nexus-stat">
          <span className="nexus-stat-value">∞</span>
          <span className="nexus-stat-label">Possibilities</span>
        </div>
      </div>

      {/* Footer */}
      <div className="nexus-footer">
        <i className="fa-solid fa-lightbulb nexus-footer-icon" />
        <span>
          Pro tip: Use <kbd>Ctrl</kbd> + <kbd>K</kbd> to quickly switch between workspaces
        </span>
      </div>

      {/* Neural Activity Indicator */}
      <NeuralActivity />
    </div>
  );
};

// ============= MAIN COMPONENT =============

const AILabHubRedesigned: React.FC<AILabHubRedesignedProps> = ({ apiKey }) => {
  return (
    <WorkspaceProvider>
      <HubContent apiKey={apiKey} />
    </WorkspaceProvider>
  );
};

export default AILabHubRedesigned;
