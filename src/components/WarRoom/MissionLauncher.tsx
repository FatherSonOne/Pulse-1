/**
 * Mission Launcher Modal
 * Premium full-screen modal for selecting Mission modes
 * Matches War Room Hub tactical aesthetic
 */

import React, { useEffect } from 'react';
import { MissionType } from './ModeSwitcher';
import './MissionLauncher.css';

import { ArrowRight, X } from 'lucide-react';

interface MissionLauncherProps {
  onMissionSelect: (mission: MissionType) => void;
  onClose: () => void;
}

interface MissionCard {
  id: MissionType;
  name: string;
  icon: string;
  description: string;
}

const MISSIONS: MissionCard[] = [
  {
    id: 'research',
    name: 'Research Mission',
    icon: 'fa-magnifying-glass-chart',
    description: 'Deep research with systematic information gathering and analysis',
  },
  {
    id: 'decision',
    name: 'Decision Mission',
    icon: 'fa-scale-balanced',
    description: 'Structured decision-making with pros/cons analysis and frameworks',
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm Mission',
    icon: 'fa-bolt',
    description: 'Creative ideation with divergent thinking and idea expansion',
  },
  {
    id: 'plan',
    name: 'Planning Mission',
    icon: 'fa-map',
    description: 'Strategic planning with roadmaps, milestones, and execution paths',
  },
  {
    id: 'analyze',
    name: 'Analysis Mission',
    icon: 'fa-chart-pie',
    description: 'Data analysis with visualization, insights, and pattern recognition',
  },
  {
    id: 'create',
    name: 'Creation Mission',
    icon: 'fa-pen-fancy',
    description: 'Content creation with drafting, refinement, and polish',
  },
];

export const MissionLauncher: React.FC<MissionLauncherProps> = ({
  onMissionSelect,
  onClose,
}) => {
  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleMissionClick = (mission: MissionCard) => {
    onMissionSelect(mission.id);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="ml-backdrop" onClick={handleBackdropClick}>
      <div className="ml-container">
        {/* Background Pattern */}
        <div className="ml-bg-pattern" />

        {/* Header */}
        <header className="ml-header">
          <div className="ml-title">
            <span className="ml-title-prefix">SELECT</span>
            <h2 className="ml-title-main">MISSION</h2>
            <p className="ml-subtitle">
              Choose a specialized mission mode for focused, goal-driven work
            </p>
          </div>

          <button
            className="ml-close-btn"
            onClick={onClose}
            aria-label="Close mission launcher"
          >
            <X className="fa" />
          </button>
        </header>

        {/* Missions Grid */}
        <div className="ml-missions-grid">
          {MISSIONS.map((mission) => (
            <button
              key={mission.id}
              className="ml-mission-card"
              data-mission={mission.id}
              onClick={() => handleMissionClick(mission)}
            >
              {/* Card glow effect */}
              <div className="ml-card-glow" />

              {/* Icon */}
              <div className="ml-card-icon-frame">
                <div className="ml-card-icon">
                  <i className={`fa ${mission.icon}`} />
                </div>
                <div className="ml-glyph" />
              </div>

              {/* Content */}
              <div className="ml-card-content">
                <h3 className="ml-card-title">{mission.name}</h3>
                <p className="ml-card-description">{mission.description}</p>

                <div className="ml-card-action">
                  <span>Launch Mission</span>
                  <ArrowRight className="fa" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer Hint */}
        <footer className="ml-footer">
          <div className="ml-hint">
            <kbd>ESC</kbd> to close
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MissionLauncher;
