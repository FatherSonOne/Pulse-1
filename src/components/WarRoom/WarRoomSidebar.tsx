/**
 * War Room Sidebar - Redesigned
 * Collapsible sidebar with War Room and Session management
 *
 * Features:
 * - Collapsed by default (minimal rail)
 * - Expand/collapse toggle always visible
 * - War Room creation with sessions branching
 * - Export to comprehensive markdown
 * - Light/dark mode optimized
 */

import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import './WarRoomSidebar.css';

// ============================================
// Types
// ============================================

export interface WarRoomProject {
  id: string;
  name: string;
  icon: string;
  color: string;
  created_at?: string;
}

export interface WarRoomSession {
  id: string;
  title: string;
  project_id?: string;
  created_at?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface WarRoomSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  projects: WarRoomProject[];
  sessions: WarRoomSession[];
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  onSelectProject: (id: string | null) => void;
  onSelectSession: (id: string) => void;
  onCreateProject: (name: string) => void;
  onCreateSession: (title: string, projectId?: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onExportWarRoom: (projectId: string) => void;
  onExportSession: (sessionId: string) => void;
  getSessionMessages: (sessionId: string) => AIMessage[];
}

// ============================================
// Icon Picker Data
// ============================================

const WAR_ROOM_ICONS = [
  'fa-rocket', 'fa-bolt', 'fa-star', 'fa-fire', 'fa-gem',
  'fa-crown', 'fa-shield', 'fa-flag', 'fa-bullseye', 'fa-cube'
];

const WAR_ROOM_COLORS = [
  '#f43f5e', '#ec4899', '#a855f7', '#8b5cf6', '#6366f1',
  '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b'
];

// ============================================
// Main Component
// ============================================

export const WarRoomSidebar: React.FC<WarRoomSidebarProps> = memo(({
  isOpen,
  onToggle,
  projects,
  sessions,
  selectedProjectId,
  selectedSessionId,
  onSelectProject,
  onSelectSession,
  onCreateProject,
  onCreateSession,
  onDeleteProject,
  onDeleteSession,
  onExportWarRoom,
  onExportSession,
}) => {
  // Local state
  const [isCreatingWarRoom, setIsCreatingWarRoom] = useState(false);
  const [newWarRoomName, setNewWarRoomName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(WAR_ROOM_ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(WAR_ROOM_COLORS[0]);
  const [expandedWarRooms, setExpandedWarRooms] = useState<Set<string>>(new Set());
  const [creatingSessionFor, setCreatingSessionFor] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [showExportMenu, setShowExportMenu] = useState<string | null>(null);
  
  // Prevent rapid toggling - debounce toggle handler
  const toggleRef = useRef<number | null>(null);
  const isTogglingRef = useRef(false);
  
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent multiple rapid clicks
    if (isTogglingRef.current) {
      return;
    }
    
    isTogglingRef.current = true;
    
    // Clear any pending toggle
    if (toggleRef.current !== null) {
      clearTimeout(toggleRef.current);
    }
    
    // Use requestAnimationFrame to ensure state is stable
    toggleRef.current = window.setTimeout(() => {
      onToggle();
      toggleRef.current = null;
      // Reset toggle lock after a short delay
      setTimeout(() => {
        isTogglingRef.current = false;
      }, 100);
    }, 0);
  }, [onToggle]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toggleRef.current !== null) {
        clearTimeout(toggleRef.current);
      }
    };
  }, []);

  // Toggle war room expansion
  const toggleWarRoom = useCallback((id: string) => {
    setExpandedWarRooms(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Handle war room creation
  const handleCreateWarRoom = useCallback(() => {
    if (newWarRoomName.trim()) {
      onCreateProject(newWarRoomName.trim());
      setNewWarRoomName('');
      setIsCreatingWarRoom(false);
      setSelectedIcon(WAR_ROOM_ICONS[0]);
      setSelectedColor(WAR_ROOM_COLORS[0]);
    }
  }, [newWarRoomName, onCreateProject]);

  // Handle session creation
  const handleCreateSession = useCallback((projectId: string) => {
    if (newSessionName.trim()) {
      onCreateSession(newSessionName.trim(), projectId);
      setNewSessionName('');
      setCreatingSessionFor(null);
      // Auto-expand the war room
      setExpandedWarRooms(prev => new Set(prev).add(projectId));
    }
  }, [newSessionName, onCreateSession]);

  // Get sessions for a war room
  const getProjectSessions = useCallback((projectId: string) => {
    return sessions.filter(s => s.project_id === projectId);
  }, [sessions]);

  // Get orphan sessions (no project)
  const orphanSessions = sessions.filter(s => !s.project_id);

  return (
    <div className="wrs-wrapper">
      <aside className={`wrs-container ${isOpen ? 'wrs-expanded' : 'wrs-collapsed'}`}>
      {/* Collapsed Rail */}
      {!isOpen && (
        <div className="wrs-rail">
          <div className="wrs-rail-logo">
            <i className="fa fa-book-open" />
          </div>

          <button
            type="button"
            className="wrs-rail-action wrs-rail-add"
            onClick={() => { onToggle(); setIsCreatingWarRoom(true); }}
            title="New War Room"
          >
            <i className="fa fa-plus" />
          </button>

          <div className="wrs-rail-divider" />

          <div className="wrs-rail-projects">
            {projects.slice(0, 5).map(project => (
              <button
                key={project.id}
                type="button"
                className={`wrs-rail-project ${selectedProjectId === project.id ? 'active' : ''}`}
                onClick={() => { onSelectProject(project.id); onToggle(); }}
                title={project.name}
                style={{ '--project-color': project.color } as React.CSSProperties}
              >
                <i className={`fa ${project.icon}`} />
              </button>
            ))}
          </div>

          {projects.length > 5 && (
            <button
              type="button"
              className="wrs-rail-more"
              onClick={onToggle}
              title={`${projects.length - 5} more`}
            >
              <span>+{projects.length - 5}</span>
            </button>
          )}
        </div>
      )}

      {/* Expanded Content */}
      {isOpen && (
        <div className="wrs-content">
          {/* Header */}
          <div className="wrs-header">
            <div className="wrs-brand">
              <span className="wrs-brand-text">WAR ROOM</span>
              <span className="wrs-brand-sub">Command Center</span>
            </div>
          </div>

          {/* New War Room Button */}
          <button
            type="button"
            className="wrs-new-warroom-btn"
            onClick={() => setIsCreatingWarRoom(true)}
          >
            <i className="fa fa-plus" />
            <span>New War Room</span>
          </button>

          {/* War Room Creation Form */}
          {isCreatingWarRoom && (
            <div className="wrs-create-form">
              <input
                type="text"
                value={newWarRoomName}
                onChange={(e) => setNewWarRoomName(e.target.value)}
                placeholder="War Room name..."
                className="wrs-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateWarRoom();
                  if (e.key === 'Escape') setIsCreatingWarRoom(false);
                }}
              />

              <div className="wrs-icon-picker">
                <span className="wrs-picker-label">Icon</span>
                <div className="wrs-icon-grid">
                  {WAR_ROOM_ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      className={`wrs-icon-option ${selectedIcon === icon ? 'selected' : ''}`}
                      onClick={() => setSelectedIcon(icon)}
                      title={`Select ${icon.replace('fa-', '')} icon`}
                    >
                      <i className={`fa ${icon}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="wrs-color-picker">
                <span className="wrs-picker-label">Color</span>
                <div className="wrs-color-grid">
                  {WAR_ROOM_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`wrs-color-option ${selectedColor === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                      title={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="wrs-form-actions">
                <button
                  type="button"
                  className="wrs-btn wrs-btn-secondary"
                  onClick={() => setIsCreatingWarRoom(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="wrs-btn wrs-btn-primary"
                  onClick={handleCreateWarRoom}
                  disabled={!newWarRoomName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {/* War Rooms List */}
          <div className="wrs-list">
            {/* All Sessions (orphans) */}
            {orphanSessions.length > 0 && (
              <div className="wrs-section">
                <div className="wrs-section-header">
                  <i className="fa fa-inbox" />
                  <span>Unsorted Sessions</span>
                  <span className="wrs-count">{orphanSessions.length}</span>
                </div>
                <div className="wrs-sessions">
                  {orphanSessions.map(session => (
                    <div
                      key={session.id}
                      className={`wrs-session ${selectedSessionId === session.id ? 'active' : ''}`}
                      onClick={() => onSelectSession(session.id)}
                    >
                      <i className="fa fa-message" />
                      <span className="wrs-session-name">{session.title}</span>
                      <button
                        type="button"
                        className="wrs-session-delete"
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                        title="Delete session"
                      >
                        <i className="fa fa-times" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* War Rooms */}
            {projects.map(project => {
              const projectSessions = getProjectSessions(project.id);
              const isExpanded = expandedWarRooms.has(project.id);

              return (
                <div key={project.id} className="wrs-warroom">
                  {/* War Room Header */}
                  <div
                    className={`wrs-warroom-header ${selectedProjectId === project.id ? 'active' : ''}`}
                    onClick={() => {
                      toggleWarRoom(project.id);
                      onSelectProject(project.id);
                    }}
                  >
                    <i className={`fa fa-chevron-${isExpanded ? 'down' : 'right'} wrs-chevron`} />
                    <div
                      className="wrs-warroom-icon"
                      style={{ backgroundColor: `${project.color}20`, color: project.color }}
                    >
                      <i className={`fa ${project.icon}`} />
                    </div>
                    <span className="wrs-warroom-name">{project.name}</span>
                    <span className="wrs-count">{projectSessions.length}</span>

                    {/* War Room Actions */}
                    <div className="wrs-warroom-actions">
                      <button
                        type="button"
                        className="wrs-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowExportMenu(showExportMenu === project.id ? null : project.id);
                        }}
                        title="Export"
                      >
                        <i className="fa fa-download" />
                      </button>
                      <button
                        type="button"
                        className="wrs-action-btn wrs-action-delete"
                        onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                        title="Delete War Room"
                      >
                        <i className="fa fa-trash" />
                      </button>
                    </div>

                    {/* Export Menu */}
                    {showExportMenu === project.id && (
                      <div className="wrs-export-menu" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => { onExportWarRoom(project.id); setShowExportMenu(null); }}
                        >
                          <i className="fa fa-file-export" />
                          <span>Export All Sessions</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sessions */}
                  {isExpanded && (
                    <div className="wrs-sessions">
                      {/* New Session Button */}
                      {creatingSessionFor !== project.id ? (
                        <button
                          type="button"
                          className="wrs-new-session-btn"
                          onClick={() => setCreatingSessionFor(project.id)}
                        >
                          <i className="fa fa-plus" />
                          <span>New Session</span>
                        </button>
                      ) : (
                        <div className="wrs-session-create">
                          <input
                            type="text"
                            value={newSessionName}
                            onChange={(e) => setNewSessionName(e.target.value)}
                            placeholder="Session name..."
                            className="wrs-input wrs-input-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateSession(project.id);
                              if (e.key === 'Escape') setCreatingSessionFor(null);
                            }}
                          />
                          <button
                            type="button"
                            className="wrs-btn-icon"
                            onClick={() => handleCreateSession(project.id)}
                            disabled={!newSessionName.trim()}
                            title="Create session"
                          >
                            <i className="fa fa-check" />
                          </button>
                          <button
                            type="button"
                            className="wrs-btn-icon"
                            onClick={() => setCreatingSessionFor(null)}
                            title="Cancel"
                          >
                            <i className="fa fa-times" />
                          </button>
                        </div>
                      )}

                      {/* Session List */}
                      {projectSessions.length === 0 && creatingSessionFor !== project.id && (
                        <div className="wrs-empty">No sessions yet</div>
                      )}

                      {projectSessions.map(session => (
                        <div
                          key={session.id}
                          className={`wrs-session ${selectedSessionId === session.id ? 'active' : ''}`}
                          onClick={() => onSelectSession(session.id)}
                        >
                          <i className="fa fa-message" />
                          <span className="wrs-session-name">{session.title}</span>
                          <div className="wrs-session-actions">
                            <button
                              type="button"
                              className="wrs-action-btn"
                              onClick={(e) => { e.stopPropagation(); onExportSession(session.id); }}
                              title="Export session"
                            >
                              <i className="fa fa-download" />
                            </button>
                            <button
                              type="button"
                              className="wrs-action-btn wrs-action-delete"
                              onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                              title="Delete session"
                            >
                              <i className="fa fa-times" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty State */}
            {projects.length === 0 && orphanSessions.length === 0 && !isCreatingWarRoom && (
              <div className="wrs-empty-state">
                <i className="fa fa-folder-open" />
                <p>No War Rooms yet</p>
                <span>Create your first War Room to organize your AI sessions</span>
              </div>
            )}
          </div>
        </div>
      )}
      </aside>
      {/* Toggle Button - Outside transitioning container to prevent flicker */}
      <button
        type="button"
        className={`wrs-toggle ${isOpen ? 'wrs-expanded' : 'wrs-collapsed'}`}
        onClick={handleToggle}
        onMouseDown={(e) => e.preventDefault()} // Prevent focus issues
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <i className={`fa fa-chevron-${isOpen ? 'left' : 'right'}`} />
      </button>
    </div>
  );
});

export default WarRoomSidebar;
