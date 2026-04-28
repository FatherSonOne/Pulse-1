// Per-item activity drawer. Slides in from the right when the operator opens
// a task or decision card's activity history. Phase 3 added the comment
// thread so the drawer is the canonical "item detail" surface (history +
// discussion in one place).

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { decisionActivityService, type ActivityEvent, type ActivitySource } from '../../../services/decisionActivityService';
import type { User } from '../../../types';
import { ActivityEventRow } from './ActivityEventRow';
import { CommentThread } from '../comments/CommentThread';
import { DependencySection } from '../dependencies/DependencySection';
import './ActivityDrawer.css';

interface ActivityDrawerProps {
  source: ActivitySource;
  itemId: string;
  itemTitle: string;
  workspaceId: string;
  currentUserId: string;
  workspaceMembers: User[];
  onClose: () => void;
}

export const ActivityDrawer: React.FC<ActivityDrawerProps> = ({
  source,
  itemId,
  itemTitle,
  workspaceId,
  currentUserId,
  workspaceMembers,
  onClose,
}) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetcher =
      source === 'decision'
        ? decisionActivityService.getDecisionActivity(itemId)
        : decisionActivityService.getTaskActivity(itemId);
    fetcher.then((data) => {
      if (!cancelled) {
        setEvents(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source, itemId]);

  // Esc closes.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className="da-overlay" onClick={onClose} aria-hidden="true" />
      <aside
        className="da-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="da-drawer-title"
      >
        <header className="da-drawer-header">
          <div className="da-drawer-header-left">
            <span className="dt-label da-drawer-eyebrow">Activity</span>
            <h3 id="da-drawer-title" className="da-drawer-title">{itemTitle}</h3>
          </div>
          <button
            type="button"
            className="da-drawer-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="da-drawer-body">
          {loading ? (
            <div className="da-drawer-loading">
              <Loader2 size={16} className="da-spinner" aria-hidden="true" />
              <span>Loading</span>
            </div>
          ) : events.length === 0 ? (
            <div className="da-drawer-empty">
              <p>Nothing logged yet. Activity will show up here as the {source} moves through statuses, changes assignees, or gets comments.</p>
            </div>
          ) : (
            <ul className="da-list" aria-label={`${itemTitle} activity`}>
              {events.map((e) => (
                <ActivityEventRow key={e.id} event={e} members={workspaceMembers} />
              ))}
            </ul>
          )}

          {source === 'task' && (
            <>
              <div className="da-section-divider">
                <span className="dt-label">Dependencies</span>
              </div>
              <DependencySection taskId={itemId} />
            </>
          )}

          <div className="da-section-divider">
            <span className="dt-label">Discussion</span>
          </div>

          <CommentThread
            source={source}
            itemId={itemId}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            workspaceMembers={workspaceMembers}
          />
        </div>
      </aside>
    </>,
    document.body
  );
};
