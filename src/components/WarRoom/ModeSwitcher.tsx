import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// War Room Modes - Strategy and deep work modes
export type WarRoomMode =
  | 'tactical'        // New tactical operations center UI
  | 'focus'           // Deep work, distraction-free
  | 'analyst'         // Data-driven analysis (future)
  | 'strategist'      // Decision trees, pro/con (future)
  | 'brainstorm'      // Idea clustering (future)
  | 'debrief'         // Session summary (future)
  | 'elegant-interface'; // Legacy conversation mode

// Mission Types - Guided workflows
export type MissionType =
  | 'research'        // Structured research
  | 'decision'        // Decision making (future)
  | 'brainstorm'      // Creative ideation (future)
  | 'plan'            // Project planning (future)
  | 'analyze'         // Data analysis (future)
  | 'create';         // Content creation (future)

// Combined type for the switcher
export type RoomType = 'war-room' | 'missions';

interface ModeSwitcherProps {
  currentMode: WarRoomMode;
  currentMission?: MissionType;
  currentRoom: RoomType;
  onChange: (mode: WarRoomMode) => void;
  onMissionChange?: (mission: MissionType) => void;
  onRoomChange?: (room: RoomType) => void;
}

interface ModeOption {
  id: WarRoomMode;
  name: string;
  icon: string;
  description: string;
  color: string;
  available: boolean;
}

interface MissionOption {
  id: MissionType;
  name: string;
  icon: string;
  description: string;
  color: string;
  available: boolean;
}

export const ModeSwitcher: React.FC<ModeSwitcherProps> = ({
  currentMode,
  currentMission = 'research',
  currentRoom = 'war-room',
  onChange,
  onMissionChange,
  onRoomChange
}) => {
  const warRoomModes: ModeOption[] = useMemo(
    () => [
      {
        id: 'tactical',
        name: 'Tactical',
        icon: 'fa-shield-alt',
        description: 'Mission control operations center',
        color: 'from-cyan-500 to-blue-500',
        available: true
      },
      {
        id: 'focus',
        name: 'Focus',
        icon: 'fa-crosshairs',
        description: 'Deep work with topic locking & pomodoro',
        color: 'from-rose-500 to-pink-500',
        available: true
      },
      {
        id: 'analyst',
        name: 'Analyst',
        icon: 'fa-chart-line',
        description: 'Data-driven analysis with citations',
        color: 'from-blue-500 to-cyan-500',
        available: true
      },
      {
        id: 'strategist',
        name: 'Strategist',
        icon: 'fa-chess',
        description: 'Decision trees & risk assessment',
        color: 'from-purple-500 to-indigo-500',
        available: true
      },
      {
        id: 'brainstorm',
        name: 'Brainstorm',
        icon: 'fa-lightbulb',
        description: 'Idea clustering & mind maps',
        color: 'from-amber-500 to-orange-500',
        available: true
      },
      {
        id: 'debrief',
        name: 'Debrief',
        icon: 'fa-clipboard-list',
        description: 'Session summary & action items',
        color: 'from-emerald-500 to-teal-500',
        available: true
      },
      {
        id: 'elegant-interface',
        name: 'Conversation',
        icon: 'fa-comments',
        description: 'Classic voice & chat interface',
        color: 'from-gray-400 to-gray-500',
        available: true
      }
    ],
    []
  );

  const missionTypes: MissionOption[] = useMemo(
    () => [
      {
        id: 'research',
        name: 'Research',
        icon: 'fa-magnifying-glass-chart',
        description: 'Structured investigation with phases',
        color: 'from-blue-500 to-cyan-500',
        available: true
      },
      {
        id: 'decision',
        name: 'Decision',
        icon: 'fa-scale-balanced',
        description: 'Guided decision-making framework',
        color: 'from-purple-500 to-violet-500',
        available: true
      },
      {
        id: 'brainstorm',
        name: 'Brainstorm',
        icon: 'fa-bolt',
        description: 'Creative ideation session',
        color: 'from-amber-500 to-yellow-500',
        available: true
      },
      {
        id: 'plan',
        name: 'Plan',
        icon: 'fa-map',
        description: 'Project & strategy planning',
        color: 'from-emerald-500 to-green-500',
        available: true
      },
      {
        id: 'analyze',
        name: 'Analyze',
        icon: 'fa-chart-pie',
        description: 'Data analysis workflow',
        color: 'from-rose-500 to-pink-500',
        available: true
      },
      {
        id: 'create',
        name: 'Create',
        icon: 'fa-pen-fancy',
        description: 'Content creation assistant',
        color: 'from-indigo-500 to-blue-500',
        available: true
      }
    ],
    []
  );

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [activeTab, setActiveTab] = useState<RoomType>(currentRoom);

  const selectedMode = warRoomModes.find((m) => m.id === currentMode) ?? warRoomModes[0];
  const selectedMission = missionTypes.find((m) => m.id === currentMission) ?? missionTypes[0];

  const displayItem = currentRoom === 'war-room' ? selectedMode : selectedMission;

  useLayoutEffect(() => {
    if (!isExpanded) return;
    const btn = buttonRef.current;
    if (!btn) return;

    const update = () => {
      const r = btn.getBoundingClientRect();
      const isMobileView = window.innerWidth < 768;

      // On mobile, use full-width centered modal
      if (isMobileView) {
        const modalWidth = Math.min(window.innerWidth - 32, 400);
        const left = (window.innerWidth - modalWidth) / 2;
        const top = Math.max(60, r.bottom + 10);
        setMenuRect({ top, left, width: modalWidth });
        return;
      }

      const width = Math.max(380, r.width);
      // Estimate dropdown height (6 modes * ~64px each + tabs + footer = ~500px)
      const estimatedHeight = 520;
      const spaceBelow = window.innerHeight - r.bottom - 20;
      const spaceAbove = r.top - 20;

      let top: number;
      // If not enough space below but more space above, position above the button
      if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
        top = Math.max(12, r.top - estimatedHeight - 10);
      } else {
        top = r.bottom + 10;
      }

      const left = Math.min(Math.max(12, r.right - width), window.innerWidth - width - 12);
      setMenuRect({ top, left, width });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isExpanded]);

  useEffect(() => {
    if (isExpanded) {
      setIsRendered(true);
      setActiveTab(currentRoom);
      const id = window.setTimeout(() => {}, 0);
      return () => window.clearTimeout(id);
    }
    const t = window.setTimeout(() => setIsRendered(false), 170);
    return () => window.clearTimeout(t);
  }, [isExpanded, currentRoom]);

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isExpanded]);

  const handleModeSelect = (mode: ModeOption) => {
    if (!mode.available) return;
    onChange(mode.id);
    onRoomChange?.('war-room');
    setIsExpanded(false);
  };

  const handleMissionSelect = (mission: MissionOption) => {
    if (!mission.available) return;
    onMissionChange?.(mission.id);
    onRoomChange?.('missions');
    setIsExpanded(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsExpanded((v) => !v)}
        className="war-room-btn px-4 py-2 flex items-center gap-2 relative z-50"
        aria-haspopup="menu"
        aria-expanded={isExpanded}
      >
        <span className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${displayItem.color}`} />
          <i className={`fa ${displayItem.icon} war-room-text-primary`}></i>
        </span>
        <span className="text-sm font-semibold">
          {displayItem.name}
        </span>
        <i
          className={`fa fa-chevron-down text-xs war-room-text-secondary transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Portal-based dropdown */}
      {isRendered &&
        createPortal(
          <>
            {/* Backdrop - darker on mobile for modal effect */}
            {isExpanded && (
              <div
                className="fixed inset-0 z-[9998] bg-black/0 md:bg-transparent"
                onClick={() => setIsExpanded(false)}
                style={{ background: window.innerWidth < 768 ? 'rgba(0,0,0,0.5)' : 'transparent' }}
              />
            )}

            {/* Menu */}
            {menuRect && (
              <div
                className={`war-room-panel fixed z-[9999] overflow-hidden transition-all duration-150 ${
                  isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                }`}
                style={{
                  top: `${menuRect.top}px`,
                  left: `${menuRect.left}px`,
                  width: `${menuRect.width}px`
                }}
              >
                {/* Tabs */}
                <div className="flex border-b border-white/10">
                  <button
                    onClick={() => setActiveTab('war-room')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'war-room'
                        ? 'bg-rose-500/20 text-rose-300 border-b-2 border-rose-500'
                        : 'war-room-text-secondary hover:bg-white/5'
                    }`}
                  >
                    <i className="fa fa-shield-halved mr-2"></i>
                    War Room
                  </button>
                  <button
                    onClick={() => setActiveTab('missions')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'missions'
                        ? 'bg-blue-500/20 text-blue-300 border-b-2 border-blue-500'
                        : 'war-room-text-secondary hover:bg-white/5'
                    }`}
                  >
                    <i className="fa fa-rocket mr-2"></i>
                    Missions
                  </button>
                </div>

                {/* Content */}
                <div className="p-2">
                  {activeTab === 'war-room' ? (
                    <>
                      <div className="text-xs war-room-text-secondary px-3 py-2 font-semibold uppercase tracking-wider">
                        Strategy Modes
                      </div>
                      {warRoomModes.map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => handleModeSelect(mode)}
                          disabled={!mode.available}
                          className={`war-room-list-item w-full p-3 text-left ${
                            currentMode === mode.id && currentRoom === 'war-room' ? 'active' : ''
                          } ${!mode.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${mode.color} bg-opacity-20 flex items-center justify-center`}>
                              <i
                                className={`fa ${mode.icon} text-sm ${
                                  currentMode === mode.id ? 'text-white' : ''
                                }`}
                              ></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium text-sm flex items-center gap-2 ${
                                currentMode === mode.id && currentRoom === 'war-room' ? 'text-white' : 'text-gray-900 dark:text-white'
                              }`}>
                                {mode.name}
                                {!mode.available && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                                    Coming Soon
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-xs ${
                                  currentMode === mode.id && currentRoom === 'war-room' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {mode.description}
                              </div>
                            </div>
                            {currentMode === mode.id && currentRoom === 'war-room' && (
                              <i className="fa fa-check text-sm"></i>
                            )}
                          </div>
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="text-xs war-room-text-secondary px-3 py-2 font-semibold uppercase tracking-wider">
                        Guided Missions
                      </div>
                      {missionTypes.map((mission) => (
                        <button
                          key={mission.id}
                          onClick={() => handleMissionSelect(mission)}
                          disabled={!mission.available}
                          className={`war-room-list-item w-full p-3 text-left ${
                            currentMission === mission.id && currentRoom === 'missions' ? 'active' : ''
                          } ${!mission.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${mission.color} bg-opacity-20 flex items-center justify-center`}>
                              <i
                                className={`fa ${mission.icon} text-sm ${
                                  currentMission === mission.id ? 'text-white' : ''
                                }`}
                              ></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium text-sm flex items-center gap-2 ${
                                currentMission === mission.id && currentRoom === 'missions' ? 'text-white' : 'text-gray-900 dark:text-white'
                              }`}>
                                {mission.name}
                                {!mission.available && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                                    Coming Soon
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-xs ${
                                  currentMission === mission.id && currentRoom === 'missions' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {mission.description}
                              </div>
                            </div>
                            {currentMission === mission.id && currentRoom === 'missions' && (
                              <i className="fa fa-check text-sm"></i>
                            )}
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>

                {/* Footer Info */}
                <div className="p-3 border-t border-white/10 bg-white/5">
                  <div className="text-xs war-room-text-secondary text-center">
                    {activeTab === 'war-room' ? (
                      <>
                        <i className="fa fa-info-circle mr-1"></i>
                        War Room modes for focused strategy work
                      </>
                    ) : (
                      <>
                        <i className="fa fa-info-circle mr-1"></i>
                        Guided workflows with structured phases
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body
        )}
    </div>
  );
};

// Legacy export for backward compatibility
export default ModeSwitcher;
