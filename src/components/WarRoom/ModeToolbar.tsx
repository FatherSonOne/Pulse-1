import React, { useState } from 'react';
import { WarRoomMode } from './ModeSwitcher';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModeConfig {
  id: WarRoomMode;
  label: string;
  icon: string;
  description: string;
  accent: string;
  modeClass: string;
}

interface ModeToolbarProps {
  currentMode: WarRoomMode;
  onModeChange: (mode: WarRoomMode) => void;
  onMissionLaunch?: () => void;
  onToggleSource?: () => void;
  onToggleNotes?: () => void;
  onOpenPalette?: () => void;
  onToggleVoice?: () => void;
  voiceOpen?: boolean;
  sourceOpen?: boolean;
  notesOpen?: boolean;
  className?: string;
}

// ─── Canonical mode definitions ───────────────────────────────────────────────

const MODES: ModeConfig[] = [
  {
    id: 'command-center',
    label: 'Command',
    icon: 'fa-shield-halved',
    description: 'Mission overview & quick actions',
    accent: '#f43f5e',
    modeClass: 'wr-mode-command',
  },
  {
    id: 'intel',
    label: 'Intel',
    icon: 'fa-satellite-dish',
    description: 'Source-grounded Q&A with citations',
    accent: '#06b6d4',
    modeClass: 'wr-mode-intel',
  },
  {
    id: 'analyst',
    label: 'Analyst',
    icon: 'fa-chart-line',
    description: 'Data analysis with evidence trails',
    accent: '#3b82f6',
    modeClass: 'wr-mode-analyst',
  },
  {
    id: 'strategist',
    label: 'Strategist',
    icon: 'fa-chess',
    description: 'Decision frameworks & risk matrices',
    accent: '#8b5cf6',
    modeClass: 'wr-mode-strategist',
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    icon: 'fa-lightbulb',
    description: 'Idea clustering & mind maps',
    accent: '#f59e0b',
    modeClass: 'wr-mode-brainstorm',
  },
  {
    id: 'focus',
    label: 'Focus',
    icon: 'fa-crosshairs',
    description: 'Deep work with Pomodoro timer',
    accent: '#6366f1',
    modeClass: 'wr-mode-focus',
  },
  {
    id: 'debrief',
    label: 'Debrief',
    icon: 'fa-clipboard-list',
    description: 'Session summary & action items',
    accent: '#10b981',
    modeClass: 'wr-mode-debrief',
  },
];

// Resolve legacy mode IDs to canonical equivalents for active-state display
function resolveCanonical(mode: WarRoomMode): WarRoomMode {
  if (mode === 'tactical') return 'command-center';
  if (mode === 'elegant-interface') return 'command-center';
  return mode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ModeToolbar: React.FC<ModeToolbarProps> = ({
  currentMode,
  onModeChange,
  onMissionLaunch,
  onToggleSource,
  onToggleNotes,
  onOpenPalette,
  onToggleVoice,
  voiceOpen = false,
  sourceOpen = true,
  notesOpen = false,
  className = '',
}) => {
  const [tooltip, setTooltip] = useState<string | null>(null);
  const canonical = resolveCanonical(currentMode);

  const btnBase: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '7px 10px',
    borderRadius: 'var(--wr-radius-sm)',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background var(--wr-transition-fast)',
    position: 'relative',
    minWidth: 52,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--wr-font-mono)',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--wr-text-muted)',
  };

  return (
    <div
      className={`wr-mode-toolbar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 8px',
        borderBottom: '1px solid var(--wr-border)',
        backgroundColor: 'var(--wr-bg-secondary)',
        zIndex: 'var(--wr-z-toolbar)' as React.CSSProperties['zIndex'],
        flexShrink: 0,
      }}
    >
      {/* Panel toggles */}
      <button
        onClick={onToggleSource}
        title={sourceOpen ? 'Hide Intel Desk' : 'Show Intel Desk'}
        style={{
          ...btnBase,
          color: sourceOpen ? 'var(--wr-accent-secondary)' : 'var(--wr-text-muted)',
          borderRight: '1px solid var(--wr-border)',
          borderRadius: 0,
          paddingRight: 12,
          marginRight: 4,
        }}
      >
        <i className="fa fa-database" style={{ fontSize: 13 }} />
        <span style={{ ...labelStyle, color: sourceOpen ? 'var(--wr-accent-secondary)' : undefined }}>
          Intel
        </span>
      </button>

      {/* Mode buttons — horizontally scrollable on narrow screens */}
      <div className="wr-toolbar-scroll" style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        {MODES.map((mode) => {
          const isActive = canonical === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              onMouseEnter={() => setTooltip(mode.id)}
              onMouseLeave={() => setTooltip(null)}
              title={mode.description}
              style={{
                ...btnBase,
                backgroundColor: isActive ? `${mode.accent}18` : 'transparent',
                borderBottom: isActive ? `2px solid ${mode.accent}` : '2px solid transparent',
                color: isActive ? mode.accent : 'var(--wr-text-secondary)',
              }}
            >
              <i
                className={`fa ${mode.icon}`}
                style={{
                  fontSize: 14,
                  color: isActive ? mode.accent : 'var(--wr-text-secondary)',
                  filter: isActive ? `drop-shadow(0 0 4px ${mode.accent}80)` : undefined,
                }}
              />
              <span
                style={{
                  ...labelStyle,
                  color: isActive ? mode.accent : undefined,
                  fontWeight: isActive ? 700 : 600,
                }}
              >
                {mode.label}
              </span>

              {/* Tooltip */}
              {tooltip === mode.id && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--wr-bg-elevated)',
                    border: '1px solid var(--wr-border-active)',
                    borderRadius: 'var(--wr-radius-sm)',
                    padding: '5px 10px',
                    whiteSpace: 'nowrap',
                    fontSize: 11,
                    color: 'var(--wr-text-primary)',
                    fontFamily: 'var(--wr-font-sans)',
                    pointerEvents: 'none',
                    zIndex: 9999,
                  }}
                >
                  {mode.description}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Right side: Notes toggle + Missions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid var(--wr-border)', paddingLeft: 8, marginLeft: 4 }}>
        <button
          onClick={onToggleNotes}
          title={notesOpen ? 'Hide The Board' : 'Show The Board'}
          style={{
            ...btnBase,
            color: notesOpen ? 'var(--wr-accent-warning)' : 'var(--wr-text-muted)',
          }}
        >
          <i className="fa fa-thumbtack" style={{ fontSize: 13 }} />
          <span style={{ ...labelStyle, color: notesOpen ? 'var(--wr-accent-warning)' : undefined }}>
            Board
          </span>
        </button>

        {onToggleVoice && (
          <button
            onClick={onToggleVoice}
            title={voiceOpen ? 'Close voice input' : 'Open voice input'}
            style={{
              ...btnBase,
              color: voiceOpen ? '#f43f5e' : 'var(--wr-text-muted)',
              backgroundColor: voiceOpen ? '#f43f5e18' : 'transparent',
              borderBottom: voiceOpen ? '2px solid #f43f5e' : '2px solid transparent',
            }}
          >
            <i className="fa fa-microphone" style={{ fontSize: 13, filter: voiceOpen ? 'drop-shadow(0 0 4px #f43f5e80)' : undefined }} />
            <span style={{ ...labelStyle, color: voiceOpen ? '#f43f5e' : undefined }}>
              Voice
            </span>
          </button>
        )}

        {onOpenPalette && (
          <button
            onClick={onOpenPalette}
            title="Open Action Palette (⌘K)"
            style={{
              ...btnBase,
              color: 'var(--wr-text-secondary)',
              backgroundColor: 'var(--wr-bg-elevated)',
              border: '1px solid var(--wr-border)',
              flexDirection: 'row',
              gap: 6,
              padding: '6px 12px',
            }}
          >
            <i className="fa fa-wand-magic-sparkles" style={{ fontSize: 12 }} />
            <span style={{ ...labelStyle, fontSize: 10, letterSpacing: '0.06em' }}>Actions</span>
            <kbd
              style={{
                fontFamily: 'var(--wr-font-mono)',
                fontSize: 8,
                color: 'var(--wr-text-muted)',
                border: '1px solid var(--wr-border)',
                borderRadius: 3,
                padding: '1px 4px',
                marginLeft: 2,
              }}
            >
              ⌘K
            </kbd>
          </button>
        )}

        {onMissionLaunch && (
          <button
            onClick={onMissionLaunch}
            title="Launch a guided Mission"
            style={{
              ...btnBase,
              color: 'var(--wr-text-secondary)',
              backgroundColor: 'var(--wr-bg-elevated)',
              border: '1px solid var(--wr-border)',
              flexDirection: 'row',
              gap: 6,
              padding: '6px 12px',
            }}
          >
            <i className="fa fa-compass" style={{ fontSize: 12, color: 'var(--wr-accent-warning)' }} />
            <span style={{ ...labelStyle, fontSize: 10, letterSpacing: '0.06em' }}>Mission</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ModeToolbar;
