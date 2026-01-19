import React, { useState } from 'react';
import { WORKSPACES, WorkspaceType, WorkspaceConfig } from './shared/types';
import { useWorkspace, WorkspaceProvider } from './shared/WorkspaceContext';
import AICanvas from './workspaces/AICanvas';
import MissionControl from './workspaces/MissionControl';
import AIStudio from './workspaces/AIStudio';
import IntelligenceHub from './workspaces/IntelligenceHub';
import QuickActions from './workspaces/QuickActions';
import ProposalBuilder from './workspaces/ProposalBuilder';
import './AILabHub.css';

interface AILabHubProps {
  apiKey: string;
}

const WorkspaceCard: React.FC<{ 
  config: WorkspaceConfig; 
  onClick: () => void;
  delay: number;
}> = ({ config, onClick, delay }) => (
  <button
    onClick={onClick}
    className="workspace-card group"
    style={{ animationDelay: `${delay}ms` }}
  >
    {/* Gradient background */}
    <div className={`workspace-card-bg bg-gradient-to-br ${config.gradient}`} />
    
    {/* Content */}
    <div className="workspace-card-content">
      {/* Icon */}
      <div className={`workspace-icon bg-gradient-to-br ${config.gradient}`}>
        <i className={`fa-solid ${config.icon}`}></i>
      </div>
      
      {/* Title & Description */}
      <h3 className="workspace-title">{config.name}</h3>
      <p className="workspace-description">{config.description}</p>
      
      {/* Features */}
      <div className="workspace-features">
        {config.features.slice(0, 3).map((feature, i) => (
          <span key={i} className="workspace-feature">
            <i className="fa-solid fa-check"></i>
            {feature}
          </span>
        ))}
      </div>
      
      {/* Launch button */}
      <div className="workspace-launch">
        <span>Launch Workspace</span>
        <i className="fa-solid fa-arrow-right"></i>
      </div>
      
      {config.comingSoon && (
        <div className="workspace-badge">Coming Soon</div>
      )}
    </div>
  </button>
);

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

    return (
      <div className="workspace-container">
        <WorkspaceComponent onBack={() => setActiveWorkspace(null)} apiKey={apiKey} />
      </div>
    );
  }

  // Render hub landing page
  return (
    <div className="ailab-hub">
      {/* Hero Section */}
      <div className="hub-hero">
        <div className="hub-hero-content">
          <div className="hub-badge">
            <i className="fa-solid fa-sparkles"></i>
            <span>AI-Powered Workspaces</span>
          </div>
          <h1 className="hub-title">
            <span className="hub-title-gradient">AI Lab</span>
            <span className="hub-title-sub">Choose Your Workspace</span>
          </h1>
          <p className="hub-subtitle">
            Transform your data into insights, presentations, and action with 
            intelligent workspaces powered by multiple AI models.
          </p>
        </div>
        
        {/* Animated background elements */}
        <div className="hub-hero-bg">
          <div className="hub-orb hub-orb-1"></div>
          <div className="hub-orb hub-orb-2"></div>
          <div className="hub-orb hub-orb-3"></div>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="hub-grid">
        {WORKSPACES.map((ws, i) => (
          <WorkspaceCard
            key={ws.id}
            config={ws}
            onClick={() => !ws.comingSoon && setActiveWorkspace(ws.id)}
            delay={i * 100}
          />
        ))}
      </div>

      {/* Quick Stats */}
      <div className="hub-stats">
        <div className="hub-stat">
          <span className="hub-stat-value">7+</span>
          <span className="hub-stat-label">AI Models</span>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-value">13</span>
          <span className="hub-stat-label">Tools</span>
        </div>
        <div className="hub-stat">
          <span className="hub-stat-value">∞</span>
          <span className="hub-stat-label">Possibilities</span>
        </div>
      </div>

      {/* Footer hint */}
      <div className="hub-footer">
        <i className="fa-solid fa-lightbulb"></i>
        <span>Pro tip: Use <kbd>Ctrl</kbd> + <kbd>K</kbd> to quickly switch between workspaces</span>
      </div>
    </div>
  );
};

const AILabHub: React.FC<AILabHubProps> = ({ apiKey }) => {
  return (
    <WorkspaceProvider>
      <HubContent apiKey={apiKey} />
    </WorkspaceProvider>
  );
};

export default AILabHub;
