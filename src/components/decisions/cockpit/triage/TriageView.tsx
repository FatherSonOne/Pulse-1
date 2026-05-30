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
import { buildQueue, type QueueEntry, type QueueGroupModel } from './queueModel';

interface TriageViewProps {
  tasks: Task[];
  decisions: DecisionWithVotes[];
  currentUserId?: string;
  loading: boolean;
  connectionStatus: ConnectionStatus;
  onQuickAction: (entry: QueueEntry, action: 'done' | 'snooze') => void;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

export function TriageView({
  tasks, decisions, currentUserId, loading, connectionStatus, onQuickAction,
}: TriageViewProps) {
  const groups: QueueGroupModel[] = useMemo(
    () => buildQueue(tasks, decisions, currentUserId).filter((g) => g.items.length > 0),
    [tasks, decisions, currentUserId]
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
  const idx = visibleFlat.findIndex((i) => i.id === selectedId);

  // J/K move selection within the visible list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'j' && e.key !== 'J' && e.key !== 'k' && e.key !== 'K') return;
      if (visibleFlat.length === 0) return;
      e.preventDefault();
      const cur = visibleFlat.findIndex((i) => i.id === selectedId);
      const dir = e.key === 'j' || e.key === 'J' ? 1 : -1;
      const next = cur < 0 ? 0 : Math.min(Math.max(cur + dir, 0), visibleFlat.length - 1);
      setSelectedId(visibleFlat[next].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visibleFlat, selectedId]);

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
    // Minimal caught-up placeholder; the full CaughtUp focal lands in Phase 8.
    return (
      <div className="ck-triage-empty">
        <span className="ck-triage-empty-title">You're caught up.</span>
        <span className="ck-triage-empty-sub">Nothing needs you right now.</span>
      </div>
    );
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
        </div>

        <div className="ck-rail-foot">
          <span><span className="ck-keycap">E</span> done</span>
          <span><span className="ck-keycap">S</span> snooze</span>
          <span><span className="ck-keycap">⌘K</span> jump</span>
        </div>
      </div>

      {/* Focal pane — placeholder until TaskDetail/DecisionDetail (Phase 4/5) */}
      <div className="ck-focal">
        {selected ? (
          <div className="ck-focal-placeholder">
            <span className="ck-focal-kicker">
              {selected.kind === 'task' ? 'Task' : 'Decision'} · {idx + 1} / {total}
            </span>
            <h2 className="ck-focal-title">
              {selected.kind === 'task' ? selected.task.title : selected.decision.title}
            </h2>
            <span className="ck-focal-note">
              {selected.kind === 'task'
                ? 'TaskDetail — property table · AI intel · checklist · actions (Phase 4)'
                : 'DecisionDetail — tally · vote · AI risk/consensus (Phase 5)'}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
