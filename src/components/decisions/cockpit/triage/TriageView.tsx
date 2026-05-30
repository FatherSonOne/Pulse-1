/**
 * TriageView — the Triage tab body: a queue rail (grouped Needs you / Today /
 * Upcoming) beside a focal detail pane. Owns selection + J/K keyboard nav
 * (handoff §5.3). The focal pane is a placeholder in Phase 3; TaskDetail /
 * DecisionDetail land in Phases 4–5.
 *
 * Selection lives here (not CockpitHub) per the playground model; it'll be
 * lifted only if a later phase (⌘K jump-to-item, Phase 7) needs cross-component
 * access.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Task } from '../../../../services/taskService';
import type { DecisionWithVotes } from '../../../../services/decisionService';
import { RealTimeIndicator, type ConnectionStatus } from '../../RealTimeIndicator';
import { QueueGroup } from './QueueGroup';
import { FocalPane } from '../focal/FocalPane';
import type { TaskActions } from '../focal/TaskDetail';
import type { DecisionActions } from '../focal/DecisionDetail';
import type { RetroActions } from '../focal/RetrospectivePane';
import { CaughtUp } from './CaughtUp';
import { buildQueue, type QueueEntry, type QueueGroupModel, type QueueRetroItem } from './queueModel';

interface TriageViewProps {
  tasks: Task[];
  decisions: DecisionWithVotes[];
  retros: QueueRetroItem[];
  currentUserId?: string;
  loading: boolean;
  connectionStatus: ConnectionStatus;
  onQuickAction: (entry: QueueEntry, action: 'done' | 'snooze') => void;
  taskActions: TaskActions;
  decisionActions: DecisionActions;
  retroActions: RetroActions;
  onNewDecision: () => void;
  onAskAI: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

export function TriageView({
  tasks, decisions, retros, currentUserId, loading, connectionStatus,
  onQuickAction, taskActions, decisionActions, retroActions, onNewDecision, onAskAI,
  hasMore, loadingMore, onLoadMore,
}: TriageViewProps) {
  const groups: QueueGroupModel[] = useMemo(
    () => buildQueue(tasks, decisions, currentUserId, retros).filter((g) => g.items.length > 0),
    [tasks, decisions, currentUserId, retros]
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  // Flattened list of currently-visible (non-collapsed) entries — drives J/K.
  const visibleFlat = useMemo(
    () => groups.flatMap((g) => (collapsed.has(g.key) ? [] : g.items)),
    [groups, collapsed]
  );

  // Keep selection valid as the queue changes (realtime, filters, collapse).
  useEffect(() => {
    if (visibleFlat.length === 0) {
      if (selectedId !== undefined) setSelectedId(undefined);
      return;
    }
    if (!visibleFlat.some((i) => i.id === selectedId)) {
      setSelectedId(visibleFlat[0].id);
    }
  }, [visibleFlat, selectedId]);

  const selected = visibleFlat.find((i) => i.id === selectedId);
  const total = visibleFlat.length;

  // Keyboard: J/K move selection; E = primary act (done/approve); S = snooze.
  // Bails when typing or a modifier is held (so it never clashes with the
  // global KeyboardChordsLayer or text inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (visibleFlat.length === 0) return;
      const key = e.key.toLowerCase();
      if (key === 'j' || key === 'k') {
        e.preventDefault();
        const cur = visibleFlat.findIndex((i) => i.id === selectedId);
        const dir = key === 'j' ? 1 : -1;
        const next = cur < 0 ? 0 : Math.min(Math.max(cur + dir, 0), visibleFlat.length - 1);
        setSelectedId(visibleFlat[next].id);
        return;
      }
      const sel = visibleFlat.find((i) => i.id === selectedId);
      if (!sel) return;
      if (key === 'e') { e.preventDefault(); onQuickAction(sel, 'done'); }
      else if (key === 's') { e.preventDefault(); onQuickAction(sel, 'snooze'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visibleFlat, selectedId, onQuickAction]);

  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (loading && groups.length === 0) {
    return <div className="ck-triage-loading">Loading queue…</div>;
  }

  if (groups.length === 0) {
    return <CaughtUp onNewDecision={onNewDecision} onAskAI={onAskAI} />;
  }

  return (
    <div className="ck-triage">
      {/* Queue rail */}
      <div className="ck-rail">
        <div className="ck-rail-head">
          <span className="ck-rail-count">Queue · {total}</span>
          {connectionStatus !== 'connected' ? (
            <RealTimeIndicator status={connectionStatus} />
          ) : (
            <span className="ck-rail-hint">
              <span className="ck-keycap">J</span>
              <span className="ck-keycap">K</span> move
            </span>
          )}
        </div>

        <div className="ck-rail-list" role="listbox" aria-label="Triage queue">
          {groups.map((g) => (
            <QueueGroup
              key={g.key}
              group={g}
              collapsed={collapsed.has(g.key)}
              onToggleCollapse={() => toggleCollapse(g.key)}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onQuickAction={onQuickAction}
            />
          ))}
          {hasMore && (
            <button type="button" className="ck-rail-loadmore" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>

        <div className="ck-rail-foot">
          <span><span className="ck-keycap">E</span> done</span>
          <span><span className="ck-keycap">S</span> snooze</span>
          <span><span className="ck-keycap">⌘K</span> jump</span>
        </div>
      </div>

      {/* Focal pane — TaskDetail (Phase 4) / DecisionDetail (Phase 5) */}
      <div className="ck-focal">
        <FocalPane entry={selected} taskActions={taskActions} decisionActions={decisionActions} retroActions={retroActions} />
      </div>
    </div>
  );
}
