/**
 * War Room Hub - Mode Selection Interface
 * Premium, full-width mode selection with refined aesthetics
 *
 * Redesigned to work with the global app sidebar -
 * no internal sidebar, clean full-width layout
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WarRoomMode, MissionType, RoomType } from './ModeSwitcher';
import './WarRoomHub.css';

// ============================================
// Types
// ============================================

interface ModeCard {
  id: WarRoomMode;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  features: string[];
  accentHue: number;
  category: 'strategic' | 'creative' | 'analytical';
}

interface WarRoomHubProps {
  onModeSelect: (mode: WarRoomMode) => void;
  onMissionSelect?: (mission: MissionType) => void;
  onRoomChange: (room: RoomType) => void;
  currentMode: WarRoomMode;
  currentMission?: MissionType;
  currentRoom: RoomType;
  recentSessions?: Array<{ id: string; title: string; mode: string; timestamp: Date }>;
  onSessionSelect?: (sessionId: string) => void;
  onNewSession?: () => void;
}

// ============================================
// Mode Data
// ============================================

const WAR_ROOM_MODES: ModeCard[] = [
  {
    id: 'tactical',
    name: 'Tactical Operations',
    shortName: 'TACTICAL',
    icon: 'fa-shield-halved',
    description: 'Mission control with real-time intel feeds and strategic command interface',
    features: ['Mission Briefing', 'Intel Panel', 'Real-time Ops'],
    accentHue: 190,
    category: 'strategic',
  },
  {
    id: 'focus',
    name: 'Deep Focus',
    shortName: 'FOCUS',
    icon: 'fa-crosshairs',
    description: 'Distraction-free environment with Pomodoro timer for deep work',
    features: ['Pomodoro Timer', 'Topic Lock', 'Zen Mode'],
    accentHue: 270,
    category: 'creative',
  },
  {
    id: 'analyst',
    name: 'Data Analyst',
    shortName: 'ANALYST',
    icon: 'fa-chart-line',
    description: 'Data-driven analysis with citations and evidence trails',
    features: ['Citations', 'Evidence Trail', 'Data Viz'],
    accentHue: 210,
    category: 'analytical',
  },
  {
    id: 'strategist',
    name: 'Strategist',
    shortName: 'STRATEGY',
    icon: 'fa-chess',
    description: 'Decision trees, risk matrices, and strategic planning',
    features: ['Decision Trees', 'Risk Matrix', 'SWOT'],
    accentHue: 280,
    category: 'strategic',
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    shortName: 'IDEATE',
    icon: 'fa-lightbulb',
    description: 'Creative ideation with mind maps and clustering',
    features: ['Mind Maps', 'Idea Clusters', 'Prompts'],
    accentHue: 35,
    category: 'creative',
  },
  {
    id: 'debrief',
    name: 'Debrief',
    shortName: 'DEBRIEF',
    icon: 'fa-clipboard-check',
    description: 'Session summary and action item extraction',
    features: ['Summary', 'Action Items', 'Export'],
    accentHue: 160,
    category: 'analytical',
  },
  {
    id: 'elegant-interface',
    name: 'Conversation',
    shortName: 'CHAT',
    icon: 'fa-comments',
    description: 'Classic voice and chat with elegant design',
    features: ['Voice Chat', 'Rich Text', 'Quick Actions'],
    accentHue: 0,
    category: 'creative',
  },
];

// ============================================
// Subcomponents
// ============================================

const DotMatrix: React.FC<{ density?: number }> = ({ density = 20 }) => (
  <div className="wrh-dot-matrix" style={{ '--dot-density': density } as React.CSSProperties} />
);

const GlyphAccent: React.FC<{ variant?: 'corner' | 'line' | 'dot' }> = ({ variant = 'corner' }) => (
  <div className={`wrh-glyph wrh-glyph-${variant}`} />
);

const ModeCardComponent: React.FC<{
  mode: ModeCard;
  isActive: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
}> = ({ mode, isActive, isHovered, onHover, onClick }) => (
  <button
    className={`wrh-mode-card ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
    style={{ '--mode-hue': mode.accentHue } as React.CSSProperties}
    onMouseEnter={() => onHover(mode.id)}
    onMouseLeave={() => onHover(null)}
    onClick={onClick}
  >
    <div className="wrh-card-glow" />

    {isActive && (
      <div className="wrh-active-indicator">
        <span className="wrh-active-dot" />
        <span>ACTIVE</span>
      </div>
    )}

    <div className="wrh-card-icon-frame">
      <div className="wrh-card-icon">
        <i className={`fa ${mode.icon}`} />
      </div>
      <GlyphAccent variant="corner" />
    </div>

    <div className="wrh-card-content">
      <h3 className="wrh-card-title">{mode.name}</h3>
      <p className="wrh-card-description">{mode.description}</p>

      <div className="wrh-card-features">
        {mode.features.map((feature, idx) => (
          <span key={idx} className="wrh-feature-tag">
            {feature}
          </span>
        ))}
      </div>
    </div>

    <div className="wrh-card-action">
      <span>{isActive ? 'Continue' : 'Launch'}</span>
      <i className="fa fa-arrow-right" />
    </div>
  </button>
);

// ============================================
// Main Component
// ============================================

export const WarRoomHub: React.FC<WarRoomHubProps> = ({
  onModeSelect,
  onRoomChange,
  currentMode,
  currentRoom,
}) => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= WAR_ROOM_MODES.length) {
          handleModeClick(WAR_ROOM_MODES[num - 1]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredModes = useMemo(() => {
    let modes = WAR_ROOM_MODES;

    if (selectedCategory) {
      modes = modes.filter(m => m.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      modes = modes.filter(
        m =>
          m.name.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query) ||
          m.features.some(f => f.toLowerCase().includes(query))
      );
    }

    return modes;
  }, [searchQuery, selectedCategory]);

  const handleModeClick = (mode: ModeCard) => {
    onModeSelect(mode.id);
    onRoomChange('war-room');
  };

  const categories = [
    { id: 'strategic', label: 'Strategic', icon: 'fa-chess-knight' },
    { id: 'creative', label: 'Creative', icon: 'fa-palette' },
    { id: 'analytical', label: 'Analytical', icon: 'fa-microscope' },
  ];

  return (
    <div className="wrh-container wrh-no-sidebar">
      {/* Background layers */}
      <div className="wrh-bg-layer">
        <DotMatrix density={24} />
        <div className="wrh-bg-gradient" />
        <div className="wrh-bg-noise" />
      </div>

      {/* Full-width Main Content */}
      <main className="wrh-main wrh-full">
        <header className="wrh-header">
          <div className="wrh-header-left">
            <h1 className="wrh-title">
              <span className="wrh-title-prefix">SELECT</span>
              <span className="wrh-title-main">MODE</span>
            </h1>
          </div>

          <div className="wrh-header-right">
            <div className="wrh-search">
              <i className="fa fa-search" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search modes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <kbd>⌘K</kbd>
            </div>
          </div>
        </header>

        {/* Category Filter */}
        <div className="wrh-categories">
          <button
            type="button"
            className={`wrh-category-btn ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            <i className="fa fa-grip" />
            <span>All</span>
          </button>
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              className={`wrh-category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            >
              <i className={`fa ${cat.icon}`} />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Mode Cards Grid */}
        <div className="wrh-modes-grid">
          {filteredModes.map((mode) => (
            <ModeCardComponent
              key={mode.id}
              mode={mode}
              isActive={currentMode === mode.id && currentRoom === 'war-room'}
              isHovered={hoveredCard === mode.id}
              onHover={setHoveredCard}
              onClick={() => handleModeClick(mode)}
            />
          ))}

          {filteredModes.length === 0 && (
            <div className="wrh-empty-state">
              <i className="fa fa-search-minus" />
              <p>No modes match "{searchQuery}"</p>
              <button type="button" onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}>
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="wrh-footer">
          <div className="wrh-hints">
            <span><kbd>1</kbd>-<kbd>7</kbd> Select mode</span>
            <span><kbd>⌘K</kbd> Search</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default WarRoomHub;
