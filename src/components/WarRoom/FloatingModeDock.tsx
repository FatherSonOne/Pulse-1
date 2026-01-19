import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WarRoomMode, MissionType, RoomType } from './ModeSwitcher';
import './FloatingModeDock.css';

interface FloatingModeDockProps {
  currentMode: WarRoomMode;
  currentMission: MissionType;
  currentRoom: RoomType;
  onModeChange: (mode: WarRoomMode) => void;
  onMissionChange: (mission: MissionType) => void;
  onRoomChange: (room: RoomType) => void;
  onBackToHub: () => void;
}

interface ModeItem {
  id: WarRoomMode;
  name: string;
  shortName: string;
  icon: string;
  gradient: string;
}

interface MissionItem {
  id: MissionType;
  name: string;
  shortName: string;
  icon: string;
  gradient: string;
}

export const FloatingModeDock: React.FC<FloatingModeDockProps> = ({
  currentMode,
  currentMission,
  currentRoom,
  onModeChange,
  onMissionChange,
  onRoomChange,
  onBackToHub,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState<'left' | 'right'>('left');
  const [showMoveSession, setShowMoveSession] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  const modes: ModeItem[] = [
    { id: 'tactical', name: 'Tactical Operations', shortName: 'Tactical', icon: 'fa-shield-alt', gradient: 'from-cyan-500 to-blue-600' },
    { id: 'focus', name: 'Deep Focus', shortName: 'Focus', icon: 'fa-crosshairs', gradient: 'from-violet-500 to-purple-600' },
    { id: 'analyst', name: 'Data Analyst', shortName: 'Analyst', icon: 'fa-chart-line', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'strategist', name: 'Strategist', shortName: 'Strategy', icon: 'fa-chess', gradient: 'from-purple-500 to-indigo-600' },
    { id: 'brainstorm', name: 'Brainstorm', shortName: 'Ideas', icon: 'fa-lightbulb', gradient: 'from-amber-400 to-orange-500' },
    { id: 'debrief', name: 'Debrief', shortName: 'Summary', icon: 'fa-clipboard-list', gradient: 'from-emerald-400 to-teal-500' },
    { id: 'elegant-interface', name: 'Conversation', shortName: 'Chat', icon: 'fa-comments', gradient: 'from-slate-400 to-gray-500' },
  ];

  const missions: MissionItem[] = [
    { id: 'research', name: 'Research Mission', shortName: 'Research', icon: 'fa-magnifying-glass-chart', gradient: 'from-blue-500 to-teal-500' },
    { id: 'decision', name: 'Decision Mission', shortName: 'Decision', icon: 'fa-scale-balanced', gradient: 'from-purple-500 to-indigo-600' },
    { id: 'brainstorm', name: 'Brainstorm Mission', shortName: 'Brainstorm', icon: 'fa-bolt', gradient: 'from-amber-400 to-orange-500' },
    { id: 'plan', name: 'Planning Mission', shortName: 'Plan', icon: 'fa-map', gradient: 'from-emerald-400 to-green-500' },
    { id: 'analyze', name: 'Analysis Mission', shortName: 'Analyze', icon: 'fa-chart-pie', gradient: 'from-rose-400 to-red-500' },
    { id: 'create', name: 'Creation Mission', shortName: 'Create', icon: 'fa-pen-fancy', gradient: 'from-indigo-400 to-purple-500' },
  ];

  const currentItem = currentRoom === 'war-room'
    ? modes.find(m => m.id === currentMode) || modes[0]
    : missions.find(m => m.id === currentMission) || missions[0];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
        setShowMoveSession(false);
      }
    };

    if (isExpanded || showMoveSession) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded, showMoveSession]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
        setShowMoveSession(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleModeSelect = (mode: ModeItem) => {
    onModeChange(mode.id);
    onRoomChange('war-room');
    setIsExpanded(false);
    setShowMoveSession(false);
  };

  const handleMissionSelect = (mission: MissionItem) => {
    onMissionChange(mission.id);
    onRoomChange('missions');
    setIsExpanded(false);
    setShowMoveSession(false);
  };

  const togglePosition = () => {
    setPosition(prev => prev === 'left' ? 'right' : 'left');
  };

  return createPortal(
    <div
      ref={dockRef}
      className={`fmd-container ${position} ${isExpanded ? 'expanded' : ''}`}
    >
      {/* Main Dock Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="fmd-trigger"
      >
        <div className={`fmd-trigger-icon bg-gradient-to-br ${currentItem.gradient}`}>
          <i className={`fa ${currentItem.icon}`}></i>
        </div>
        <span className="fmd-trigger-label">{currentItem.shortName}</span>
        <i className={`fa fa-chevron-down fmd-trigger-arrow ${isExpanded ? 'rotated' : ''}`}></i>
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="fmd-panel">
          {/* Header */}
          <div className="fmd-header">
            <button onClick={onBackToHub} className="fmd-back-btn">
              <i className="fa fa-th-large"></i>
              <span>All Modes</span>
            </button>
          </div>

          {/* Quick Switch Section */}
          <div className="fmd-section">
            <div className="fmd-section-title">
              <i className="fa fa-bolt"></i>
              Quick Switch
            </div>

            {/* Modes */}
            <div className="fmd-items-grid">
              {modes.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => handleModeSelect(mode)}
                  className={`fmd-item ${currentMode === mode.id && currentRoom === 'war-room' ? 'active' : ''}`}
                  title={mode.name}
                >
                  <div className={`fmd-item-icon bg-gradient-to-br ${mode.gradient}`}>
                    <i className={`fa ${mode.icon}`}></i>
                  </div>
                  <span className="fmd-item-label">{mode.shortName}</span>
                  {currentMode === mode.id && currentRoom === 'war-room' && (
                    <div className="fmd-item-active"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Move Session Section */}
          <div className="fmd-section">
            <button
              onClick={() => setShowMoveSession(!showMoveSession)}
              className="fmd-move-trigger"
            >
              <i className="fa fa-arrow-right-arrow-left"></i>
              <span>Move to Mission</span>
              <i className={`fa fa-chevron-down ${showMoveSession ? 'rotated' : ''}`}></i>
            </button>

            {showMoveSession && (
              <div className="fmd-missions-list">
                {missions.map(mission => (
                  <button
                    key={mission.id}
                    onClick={() => handleMissionSelect(mission)}
                    className={`fmd-mission-item ${currentMission === mission.id && currentRoom === 'missions' ? 'active' : ''}`}
                  >
                    <div className={`fmd-mission-icon bg-gradient-to-br ${mission.gradient}`}>
                      <i className={`fa ${mission.icon}`}></i>
                    </div>
                    <div className="fmd-mission-info">
                      <span className="fmd-mission-name">{mission.name}</span>
                    </div>
                    {currentMission === mission.id && currentRoom === 'missions' && (
                      <i className="fa fa-check fmd-mission-check"></i>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Keyboard Hint */}
          <div className="fmd-hint">
            <kbd>Ctrl</kbd> + <kbd>M</kbd> to toggle
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default FloatingModeDock;
