import React, { useState } from 'react';
import { Bell, Clock, X } from 'lucide-react';
import { Nudge } from '../../services/proactiveSuggestionsService';
import './AlertsPanel.css';

interface AlertsPanelProps {
  nudges: Nudge[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onAction: (nudge: Nudge) => void;
  onClose: () => void;
  onSnooze: (id: string, minutes: number) => void;
}

function formatTimeSince(createdAt?: string): string {
  if (!createdAt) return '';
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  nudges,
  onDismiss,
  onDismissAll,
  onAction,
  onClose,
  onSnooze,
}) => {
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);

  const urgentNudges = nudges.filter(n => n.priority === 'urgent');
  const importantNudges = nudges.filter(n => n.priority === 'important');
  const suggestionNudges = nudges.filter(n => n.priority === 'suggestion');

  const sortedNudges = [...urgentNudges, ...importantNudges, ...suggestionNudges];
  const visibleNudges = sortedNudges.slice(0, 3);

  return (
    <div className="alerts-panel-dropdown">
      <div className="alerts-panel-header">
        <div className="alerts-panel-title">
          <Bell size={16} aria-hidden="true" />
          <span>Alerts &amp; Nudges</span>
          <span className="alerts-count-badge">{nudges.length}</span>
        </div>
        <button
          type="button"
          className="alerts-close-button"
          onClick={onClose}
          aria-label="Close alerts panel"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="alerts-panel-content">
        {visibleNudges.map(nudge => {
          const priority =
            nudge.priority === 'urgent'
              ? 'urgent'
              : nudge.priority === 'important'
              ? 'important'
              : 'suggestion';
          const icon =
            priority === 'urgent' ? '🔴' : priority === 'important' ? '🟡' : '🟢';

          return (
            <div key={nudge.id} className={`alert-item ${priority}`}>
              <div className="alert-priority-indicator">{icon}</div>
              <div className="alert-content">
                <div className="alert-message">{nudge.message}</div>
                {nudge.createdAt && (
                  <span className="alert-time">{formatTimeSince(nudge.createdAt)}</span>
                )}
                {nudge.action && (
                  <button
                    type="button"
                    className="alert-action-button"
                    onClick={() => onAction(nudge)}
                    aria-label={`${nudge.action} for ${nudge.relatedTitle || 'this item'}`}
                  >
                    {nudge.action}
                  </button>
                )}
              </div>
              <div className="alert-actions">
                <div className="snooze-wrapper">
                  <button
                    type="button"
                    className="alert-snooze-button"
                    onClick={() => setSnoozeOpenId(snoozeOpenId === nudge.id ? null : nudge.id)}
                    aria-label="Snooze this alert"
                    title="Snooze"
                  >
                    <Clock size={14} aria-hidden="true" />
                  </button>
                  {snoozeOpenId === nudge.id && (
                    <div className="snooze-dropdown">
                      {[
                        { label: '30 min', minutes: 30 },
                        { label: '1 hour', minutes: 60 },
                        { label: '3 hours', minutes: 180 },
                      ].map(opt => (
                        <button
                          key={opt.minutes}
                          type="button"
                          className="snooze-option"
                          onClick={() => { onSnooze(nudge.id, opt.minutes); setSnoozeOpenId(null); }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="alert-dismiss-button"
                  onClick={() => onDismiss(nudge.id)}
                  aria-label={`Dismiss alert: ${nudge.message}`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}

        {nudges.length > 3 && (
          <div className="alerts-see-all">
            <button
              type="button"
              className="see-all-button"
              aria-label={`See all ${nudges.length} alerts`}
            >
              See all {nudges.length} alerts
            </button>
            <button
              type="button"
              className="dismiss-all-button"
              onClick={onDismissAll}
              aria-label="Dismiss all alerts"
            >
              Dismiss all
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
