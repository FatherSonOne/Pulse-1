import React, { useState } from 'react';
import { useWorkspace } from '../shared/WorkspaceContext';
import './MissionControl.css';

interface MissionControlProps {
  onBack: () => void;
  apiKey: string;
}

interface Panel {
  id: string;
  type: string;
  title: string;
  icon: string;
  color: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  content?: any;
  loading?: boolean;
}

const AVAILABLE_PANELS = [
  { type: 'deep_search', title: 'Deep Search', icon: 'fa-magnifying-glass-chart', color: 'sky' },
  { type: 'ai_assistant', title: 'AI Assistant', icon: 'fa-robot', color: 'rose' },
  { type: 'meeting_intel', title: 'Meeting Intel', icon: 'fa-users-rectangle', color: 'violet' },
  { type: 'voice_studio', title: 'Voice Studio', icon: 'fa-podcast', color: 'amber' },
  { type: 'route_planner', title: 'Route Planner', icon: 'fa-route', color: 'teal' },
  { type: 'action_items', title: 'Action Items', icon: 'fa-list-check', color: 'emerald' },
  { type: 'notes', title: 'Notes', icon: 'fa-sticky-note', color: 'yellow' },
  { type: 'data_view', title: 'Data View', icon: 'fa-table', color: 'blue' },
];

const MissionControl: React.FC<MissionControlProps> = ({ onBack, apiKey }) => {
  const { missionName, setMissionName } = useWorkspace();
  const [panels, setPanels] = useState<Panel[]>([
    { id: '1', type: 'deep_search', title: 'Research', icon: 'fa-magnifying-glass-chart', color: 'sky', col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    { id: '2', type: 'ai_assistant', title: 'AI Assistant', icon: 'fa-robot', color: 'rose', col: 2, row: 1, colSpan: 2, rowSpan: 1 },
    { id: '3', type: 'action_items', title: 'Action Items', icon: 'fa-list-check', color: 'emerald', col: 1, row: 2, colSpan: 1, rowSpan: 1 },
    { id: '4', type: 'notes', title: 'Notes', icon: 'fa-sticky-note', color: 'yellow', col: 2, row: 2, colSpan: 1, rowSpan: 1 },
  ]);
  const [showPanelPicker, setShowPanelPicker] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const addPanel = (config: typeof AVAILABLE_PANELS[0]) => {
    const newPanel: Panel = {
      id: `panel-${Date.now()}`,
      type: config.type,
      title: config.title,
      icon: config.icon,
      color: config.color,
      col: 3,
      row: 2,
      colSpan: 1,
      rowSpan: 1,
    };
    setPanels([...panels, newPanel]);
    setShowPanelPicker(false);
  };

  const removePanel = (id: string) => {
    setPanels(panels.filter(p => p.id !== id));
  };

  const generateBriefing = () => {
    console.log('Generating briefing from panels:', panels);
  };

  return (
    <div className="mission-control">
      {/* Header */}
      <div className="mission-header">
        <div className="mission-header-left">
          <button onClick={onBack} className="mission-back-btn">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="mission-branding">
            <i className="fa-solid fa-grid-2-plus"></i>
            <span>Mission Control</span>
          </div>
          {isEditingName ? (
            <input
              type="text"
              className="mission-name-input"
              value={missionName}
              onChange={(e) => setMissionName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
              autoFocus
            />
          ) : (
            <button 
              className="mission-name"
              onClick={() => setIsEditingName(true)}
            >
              🎯 {missionName}
              <i className="fa-solid fa-pen"></i>
            </button>
          )}
        </div>
        <div className="mission-header-right">
          <button 
            className="mission-btn mission-btn-secondary"
            onClick={() => setShowPanelPicker(true)}
          >
            <i className="fa-solid fa-plus"></i>
            Add Panel
          </button>
          <button className="mission-btn mission-btn-secondary">
            <i className="fa-solid fa-arrows-rotate"></i>
            Reset Layout
          </button>
          <button 
            className="mission-btn mission-btn-primary"
            onClick={generateBriefing}
          >
            <i className="fa-solid fa-file-export"></i>
            Generate Briefing
          </button>
        </div>
      </div>

      {/* Panel Grid */}
      <div className="mission-grid">
        {panels.map(panel => (
          <div
            key={panel.id}
            className={`mission-panel mission-panel-${panel.color}`}
            style={{
              gridColumn: `${panel.col} / span ${panel.colSpan}`,
              gridRow: `${panel.row} / span ${panel.rowSpan}`,
            }}
          >
            <div className="panel-header">
              <div className="panel-title">
                <i className={`fa-solid ${panel.icon}`}></i>
                <span>{panel.title}</span>
              </div>
              <div className="panel-actions">
                <button className="panel-action" title="Expand">
                  <i className="fa-solid fa-expand"></i>
                </button>
                <button className="panel-action" title="Settings">
                  <i className="fa-solid fa-gear"></i>
                </button>
                <button 
                  className="panel-action panel-action-close" 
                  onClick={() => removePanel(panel.id)}
                  title="Close"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
            <div className="panel-content">
              {panel.type === 'deep_search' && (
                <div className="panel-search">
                  <input type="text" placeholder="Research any topic..." />
                  <button><i className="fa-solid fa-search"></i></button>
                </div>
              )}
              {panel.type === 'ai_assistant' && (
                <div className="panel-chat">
                  <div className="chat-messages">
                    <div className="chat-message chat-message-ai">
                      Ready to assist with your mission. What would you like to accomplish?
                    </div>
                  </div>
                  <div className="chat-input">
                    <input type="text" placeholder="Ask anything..." />
                    <button><i className="fa-solid fa-paper-plane"></i></button>
                  </div>
                </div>
              )}
              {panel.type === 'action_items' && (
                <div className="panel-tasks">
                  <div className="task-item">
                    <input type="checkbox" />
                    <span>Review research findings</span>
                  </div>
                  <div className="task-item">
                    <input type="checkbox" />
                    <span>Draft initial proposal</span>
                  </div>
                  <div className="task-item task-item-add">
                    <i className="fa-solid fa-plus"></i>
                    <span>Add task...</span>
                  </div>
                </div>
              )}
              {panel.type === 'notes' && (
                <div className="panel-notes">
                  <textarea placeholder="Take notes here..."></textarea>
                </div>
              )}
              {!['deep_search', 'ai_assistant', 'action_items', 'notes'].includes(panel.type) && (
                <div className="panel-placeholder">
                  <i className={`fa-solid ${panel.icon}`}></i>
                  <span>Configure {panel.title}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Panel Picker Modal */}
      {showPanelPicker && (
        <div className="panel-picker-overlay" onClick={() => setShowPanelPicker(false)}>
          <div className="panel-picker" onClick={e => e.stopPropagation()}>
            <h3>Add Panel</h3>
            <div className="panel-picker-grid">
              {AVAILABLE_PANELS.map(p => (
                <button
                  key={p.type}
                  className={`panel-picker-item panel-picker-${p.color}`}
                  onClick={() => addPanel(p)}
                >
                  <i className={`fa-solid ${p.icon}`}></i>
                  <span>{p.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionControl;
