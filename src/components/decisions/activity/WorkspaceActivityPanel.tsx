// Workspace-wide activity panel. Slide-out drawer accessible from the
// header. Groups events by date (Today / Yesterday / This week / Earlier)
// and refreshes live via Supabase channels.

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { decisionActivityService, type ActivityEvent } from '../../../services/decisionActivityService';
import type { User } from '../../../types';
import { ActivityEventRow } from './ActivityEventRow';
import { dateBucket } from './describeEvent';
import './ActivityDrawer.css';

interface WorkspaceActivityPanelProps {
  workspaceId: string;
  workspaceMembers: User[];
  /** When set, clicking an event row opens the per-item drawer with this handler. */
  onOpenItem?: (source: 'task' | 'decision', itemId: string, itemTitle: string) => void;
  onClose: () => void;
}

const BUCKET_LABELS: Record<ReturnType<typeof dateBucket>, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  earlier: 'Earlier',
};

export const WorkspaceActivityPanel: React.FC<WorkspaceActivityPanelProps> = ({
  workspaceId,
  workspaceMembers,
  onOpenItem,
  onClose,
}) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch + live subscription.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    decisionActivityService.getWorkspaceActivity(workspaceId, 200).then((rows) => {
      if (!cancelled) {
        setEvents(rows);
        setLoading(false);
      }
    });

    const unsubscribe = decisionActivityService.subscribeToWorkspace(workspaceId, (event) => {
      if (cancelled) return;
      setEvents((prev) => {
        if (prev.some((e) => e.id === event.id)) return prev;
        return [event, ...prev];
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [workspaceId]);

  // Esc closes.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Group events by date bucket.
  const grouped = useMemo(() => {
    const buckets: Record<ReturnType<typeof dateBucket>, ActivityEvent[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    };
    for (const e of events) {
      buckets[dateBucket(e.createdAt)].push(e);
    }
    return buckets;
  }, [events]);

  const orderedBuckets: Array<ReturnType<typeof dateBucket>> = ['today', 'yesterday', 'this_week', 'earlier'];

  return createPortal(
    <>
      <div className="da-overlay" onClick={onClose} aria-hidden="true" />
      <aside
        className="da-drawer da-drawer-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="da-workspace-title"
      >
        <header className="da-drawer-header">
          <div className="da-drawer-header-left">
            <span className="dt-label da-drawer-eyebrow">Activity</span>
            <h3 id="da-workspace-title" className="da-drawer-title">Across the workspace</h3>
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
              <p>No activity yet. As decisions and tasks move through statuses, the events show up here in chronological order.</p>
            </div>
          ) : (
            orderedBuckets.map((bucketKey) => {
              const bucketEvents = grouped[bucketKey];
              if (bucketEvents.length === 0) return null;
              return (
                <section key={bucketKey} className="da-bucket">
                  <h4 className="da-bucket-title dt-label">{BUCKET_LABELS[bucketKey]}</h4>
                  <ul className="da-list">
                    {bucketEvents.map((e) => (
                      <ActivityEventRow
                        key={`${e.source}-${e.id}`}
                        event={e}
                        members={workspaceMembers}
                        onClick={
                          onOpenItem
                            ? () => {
                                const title =
                                  (typeof e.newValue === 'string' && e.action === 'created' && e.newValue) ||
                                  (typeof e.metadata?.title === 'string' && (e.metadata.title as string)) ||
                                  `${e.source === 'decision' ? 'Decision' : 'Task'}`;
                                onOpenItem(e.source, e.itemId, title);
                                onClose();
                              }
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </aside>
    </>,
    document.body
  );
};
