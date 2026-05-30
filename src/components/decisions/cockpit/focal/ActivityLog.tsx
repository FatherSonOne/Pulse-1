/**
 * ActivityLog — inline per-item activity feed for the focal pane (replaces the
 * ActivityDrawer's activity tab). Reuses ActivityEventRow (which flags AI
 * events via its action icon/color) + the drawer's row styles.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  decisionActivityService,
  type ActivityEvent,
  type ActivitySource,
} from '../../../../services/decisionActivityService';
import type { User } from '../../../../types';
import { ActivityEventRow } from '../../activity/ActivityEventRow';
import '../../activity/ActivityDrawer.css';

interface ActivityLogProps {
  source: ActivitySource;
  itemId: string;
  members: User[];
}

export function ActivityLog({ source, itemId, members }: ActivityLogProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetcher =
      source === 'decision'
        ? decisionActivityService.getDecisionActivity(itemId)
        : decisionActivityService.getTaskActivity(itemId);
    fetcher
      .then((data) => { if (!cancelled) { setEvents(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [source, itemId]);

  return (
    <>
      <div className="ck-focal-section-label">Activity</div>
      {loading ? (
        <div className="ck-activity-state"><Loader2 size={14} className="ck-spin" aria-hidden /> Loading</div>
      ) : events.length === 0 ? (
        <p className="ck-activity-state">Nothing logged yet.</p>
      ) : (
        <ul className="da-list" aria-label="Activity">
          {events.map((e) => (
            <ActivityEventRow key={e.id} event={e} members={members} />
          ))}
        </ul>
      )}
    </>
  );
}
