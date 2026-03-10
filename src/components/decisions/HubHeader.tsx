import React from 'react';
import { Zap, Columns, Archive, RefreshCw } from 'lucide-react';
import './HubHeader.css';

export type HubMode = 'active' | 'board' | 'archive';

interface HubHeaderProps {
  mode: HubMode;
  onModeChange: (mode: HubMode) => void;
  onRefresh?: () => void;
  actions?: React.ReactNode;
}

const HubHeaderBase: React.FC<HubHeaderProps> = ({
  mode,
  onModeChange,
  onRefresh,
  actions,
}) => {
  return (
    <header className="hub-header">
      <div className="hub-header-left">
        <h1 className="hub-title">Decisions & Tasks</h1>
      </div>

      <div className="hub-header-center">
        <div className="hub-mode-switcher" role="tablist" aria-label="View mode">
          <button
            className={`hub-mode-btn ${mode === 'active' ? 'active' : ''}`}
            onClick={() => onModeChange('active')}
            role="tab"
            aria-selected={mode === 'active'}
            aria-label="Active view"
          >
            <Zap className="hub-mode-icon" size={16} />
            <span className="hub-mode-label">Active</span>
          </button>
          <button
            className={`hub-mode-btn ${mode === 'board' ? 'active' : ''}`}
            onClick={() => onModeChange('board')}
            role="tab"
            aria-selected={mode === 'board'}
            aria-label="Board view"
          >
            <Columns className="hub-mode-icon" size={16} />
            <span className="hub-mode-label">Board</span>
          </button>
          <button
            className={`hub-mode-btn ${mode === 'archive' ? 'active' : ''}`}
            onClick={() => onModeChange('archive')}
            role="tab"
            aria-selected={mode === 'archive'}
            aria-label="Archive view"
          >
            <Archive className="hub-mode-icon" size={16} />
            <span className="hub-mode-label">Archive</span>
          </button>
        </div>
      </div>

      <div className="hub-header-right">
        {onRefresh && (
          <button
            className="hub-refresh-btn"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        )}
        {actions && <div className="hub-actions">{actions}</div>}
      </div>
    </header>
  );
};

export const HubHeader = React.memo(HubHeaderBase);
HubHeader.displayName = 'HubHeader';
