/**
 * ArtifactPanel — third column of the Summit grid.
 *
 * Lives to the right of the session canvas. Always-visible during a session,
 * collapsible when idle. Four buckets: decisions, tasks, references, open
 * questions. Each item can be edited inline or deleted; manual add via the
 * footer input on whichever bucket is focused.
 *
 * The panel is presentation-only — state lives in the parent (Summit.tsx).
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  ListTodo,
  BookOpen,
  HelpCircle,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Edit3,
  Check,
  X,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type {
  ArtifactKind,
  SessionArtifact,
  SessionArtifacts,
} from './voiceSessionStore';
import CapturesPanel from '../Capture/CapturesPanel';

interface ArtifactPanelProps {
  artifacts: SessionArtifacts;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAdd: (kind: ArtifactKind, content: string) => void;
  onUpdate: (kind: ArtifactKind, id: string, content: string) => void;
  onDelete: (kind: ArtifactKind, id: string) => void;
  /**
   * Active Summit session id. When set, the embedded CapturesPanel filters
   * pulse_notes to this session so Cmd+J captures show up alongside artifacts.
   */
  sessionId?: string;
}

interface BucketDef {
  kind: ArtifactKind;
  label: string;
  icon: LucideIcon;
  emptyHint: string;
  addPlaceholder: string;
}

const BUCKETS: BucketDef[] = [
  {
    kind: 'decision',
    label: 'Decisions',
    icon: CheckCircle2,
    emptyHint:
      'Decisions land here as you make them. Try saying "let\'s go with…" or ask Pulse to log one.',
    addPlaceholder: 'Add a decision…',
  },
  {
    kind: 'task',
    label: 'Tasks',
    icon: ListTodo,
    emptyHint:
      'Action items show up here. Phrase one as "I need to…" or ask Pulse to create the task.',
    addPlaceholder: 'Add a task…',
  },
  {
    kind: 'reference',
    label: 'References',
    icon: BookOpen,
    emptyHint:
      'Pulse data the AI pulls in lands here. Ask it to look something up — "find my last note about X".',
    addPlaceholder: 'Add a reference…',
  },
  {
    kind: 'question',
    label: 'Open Questions',
    icon: HelpCircle,
    emptyHint:
      "Things you're still working out. Try \"what's still unclear?\" to surface them.",
    addPlaceholder: 'Add an open question…',
  },
];

const totalCount = (a: SessionArtifacts): number =>
  a.decisions.length + a.tasks.length + a.references.length + a.questions.length;

const itemsForKind = (a: SessionArtifacts, kind: ArtifactKind): SessionArtifact[] => {
  switch (kind) {
    case 'decision':
      return a.decisions;
    case 'task':
      return a.tasks;
    case 'reference':
      return a.references;
    case 'question':
      return a.questions;
  }
};

const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifacts,
  collapsed,
  onToggleCollapsed,
  onAdd,
  onUpdate,
  onDelete,
  sessionId,
}) => {
  const [activeBucket, setActiveBucket] = useState<ArtifactKind>('decision');
  const [draftText, setDraftText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleAdd = () => {
    const text = draftText.trim();
    if (!text) return;
    onAdd(activeBucket, text);
    setDraftText('');
  };

  const handleStartEdit = (item: SessionArtifact) => {
    setEditingId(item.id);
    setEditingText(item.content);
  };

  const handleSaveEdit = (kind: ArtifactKind) => {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) {
      setEditingId(null);
      return;
    }
    onUpdate(kind, editingId, text);
    setEditingId(null);
    setEditingText('');
  };

  const total = totalCount(artifacts);
  const placeholderBucket = BUCKETS.find((b) => b.kind === activeBucket) ?? BUCKETS[0];

  if (collapsed) {
    return (
      <aside className="pvc-artifacts pvc-artifacts--collapsed" aria-label="Session artifacts">
        <button
          type="button"
          className="pvc-artifacts-handle"
          onClick={onToggleCollapsed}
          aria-label="Expand artifact panel"
          title="Expand artifacts"
        >
          <ChevronRight size={14} />
          <span className="pvc-artifacts-handle-label">
            <Sparkles size={11} aria-hidden="true" />
            {total > 0 ? `${total}` : '·'}
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="pvc-artifacts" aria-label="Session artifacts">
      <header className="pvc-artifacts-head">
        <div className="pvc-artifacts-title">
          <Sparkles size={13} aria-hidden="true" />
          <span>Session Artifacts</span>
          {total > 0 && <span className="pvc-artifacts-total">{total}</span>}
        </div>
        <button
          type="button"
          className="pvc-icon-btn"
          onClick={onToggleCollapsed}
          aria-label="Collapse artifact panel"
          title="Collapse"
        >
          <ChevronDown size={14} />
        </button>
      </header>

      <nav className="pvc-artifacts-tabs" aria-label="Artifact buckets">
        {BUCKETS.map((b) => {
          const count = itemsForKind(artifacts, b.kind).length;
          const isActive = activeBucket === b.kind;
          const Icon = b.icon;
          return (
            <button
              key={b.kind}
              type="button"
              className={`pvc-artifacts-tab ${isActive ? 'pvc-artifacts-tab--active' : ''}`}
              onClick={() => setActiveBucket(b.kind)}
              aria-pressed={isActive}
            >
              <Icon size={12} />
              <span className="pvc-artifacts-tab-label">{b.label}</span>
              {count > 0 && <span className="pvc-artifacts-tab-count">{count}</span>}
            </button>
          );
        })}
      </nav>

      <div className="pvc-artifacts-body">
        {BUCKETS.map((b) => {
          if (b.kind !== activeBucket) return null;
          const items = itemsForKind(artifacts, b.kind);
          const Icon = b.icon;
          if (items.length === 0) {
            return (
              <div key={b.kind} className="pvc-artifacts-empty">
                <Icon size={22} />
                <p>{b.emptyHint}</p>
              </div>
            );
          }
          return (
            <ul key={b.kind} className="pvc-artifacts-list">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`pvc-artifact pvc-artifact--${item.source}`}
                >
                  <div className="pvc-artifact-head">
                    <span className={`pvc-artifact-tag pvc-artifact-tag--${item.source}`}>
                      {item.source === 'auto'
                        ? 'AUTO'
                        : item.source === 'tool'
                        ? 'TOOL'
                        : 'YOU'}
                    </span>
                    {item.source === 'tool' && item.meta?.toolName && (
                      <span className="pvc-artifact-tool-name" title={`Created by ${item.meta.toolName}`}>
                        {item.meta.toolName.replace(/_/g, ' ')}
                      </span>
                    )}
                    {item.meta?.priority && (
                      <span className={`pvc-artifact-priority pvc-artifact-priority--${item.meta.priority}`}>
                        {item.meta.priority}
                      </span>
                    )}
                    {item.meta?.dueDate && (
                      <span className="pvc-artifact-due">
                        {new Date(item.meta.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {editingId === item.id ? (
                    <div className="pvc-artifact-edit">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        aria-label="Edit artifact"
                        autoFocus
                      />
                      <div className="pvc-artifact-edit-actions">
                        <button type="button" onClick={() => handleSaveEdit(b.kind)} title="Save">
                          <Check size={12} /> Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} title="Cancel">
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="pvc-artifact-content">{item.content}</p>
                      <div className="pvc-artifact-actions">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          aria-label="Edit"
                          title="Edit"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(b.kind, item.id)}
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          );
        })}
      </div>

      <div className="pvc-artifacts-add">
        <input
          type="text"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={placeholderBucket.addPlaceholder}
          aria-label={placeholderBucket.addPlaceholder}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draftText.trim()}
          aria-label="Add artifact"
          title="Add"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Cross-surface captures scoped to this Summit session. Cmd+J anywhere
          while a session is live writes here. Read-only feed; the trigger
          lives in the modal itself. */}
      {sessionId && !collapsed && (
        <div className="pvc-artifacts-captures">
          <CapturesPanel sourceSection="summit" sourceId={sessionId} title="NOTES" />
        </div>
      )}
    </aside>
  );
};

export default ArtifactPanel;
