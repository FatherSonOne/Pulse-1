import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Plus, Trash2, ExternalLink, Save } from 'lucide-react';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import {
  captureService,
  type CaptureNote,
  type CaptureKind,
} from '../../services/captureService';

const FILTER_KINDS: { value: CaptureKind | 'all'; label: string }[] = [
  { value: 'all',       label: 'ALL' },
  { value: 'task',      label: 'TASKS' },
  { value: 'decision',  label: 'DECISIONS' },
  { value: 'learning',  label: 'LEARNING' },
  { value: 'friction',  label: 'FRICTION' },
];

const KIND_PILL: Record<NonNullable<CaptureKind>, string> = {
  task:      'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  decision:  'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  learning:  'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  friction:  'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  question:  'bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

const SOURCE_LABEL: Record<string, string> = {
  dashboard:        'DASHBOARD',
  global:           'GLOBAL',
  messages:         'MESSAGES',
  email:            'EMAIL',
  relay:            'RELAY',
  calendar:         'CALENDAR',
  contacts:         'CONTACTS',
  decisions_tasks:  'DECISIONS',
  archives:         'ARCHIVES',
  war_room:         'WAR ROOM',
  summit:           'SUMMIT',
  meetings:         'MEETINGS',
  settings:         'SETTINGS',
};

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) {
    return `TODAY · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  const days = Math.floor((today.getTime() - date.getTime()) / 86_400_000);
  if (days === 1) return 'YESTERDAY';
  if (days < 7) return `${days}D AGO`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
};

/**
 * Master-detail "Sticky Notes"-style browser for pulse_notes. Lives inside
 * the Archives section under the Notes tab. Honors `sessionStorage.pulse_focus_note`
 * to auto-select a note when arriving from the dashboard widget or command palette.
 */
const CapturesView: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const [notes, setNotes] = useState<CaptureNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<CaptureKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftDirty, setDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    const rows = await captureService.listRecent(currentWorkspace.id, 500);
    setNotes(rows);
    setLoading(false);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    void load();
    const handleSaved = () => { void load(); };
    window.addEventListener('pulse:capture-saved', handleSaved);
    return () => window.removeEventListener('pulse:capture-saved', handleSaved);
  }, [load]);

  // Hydrate from sessionStorage.pulse_focus_note (set by dashboard widget +
  // command palette navigation). One-shot read; clear after consuming.
  useEffect(() => {
    if (notes.length === 0) return;
    const focusId = sessionStorage.getItem('pulse_focus_note');
    if (focusId) {
      sessionStorage.removeItem('pulse_focus_note');
      const match = notes.find(n => n.id === focusId);
      if (match) {
        setSelectedId(match.id);
        return;
      }
    }
    // Default selection: most recent (already first because order DESC).
    if (!selectedId) setSelectedId(notes[0].id);
  }, [notes, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter(n => {
      if (filterKind !== 'all' && n.kind !== filterKind) return false;
      if (q && !n.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notes, filterKind, query]);

  const selected = useMemo(
    () => notes.find(n => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  // Sync the draft to the selected note. Auto-focus on first selection.
  useEffect(() => {
    setDraftContent(selected?.content ?? '');
    setDraftDirty(false);
  }, [selectedId, selected?.content]);

  const handleSave = useCallback(async () => {
    if (!selected || !draftDirty) return;
    setSaving(true);
    const ok = await captureService.updateContent(selected.id, draftContent.trim());
    setSaving(false);
    if (ok) {
      setDraftDirty(false);
      setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, content: draftContent.trim() } : n));
      toast.success('Saved');
    } else {
      toast.error('Could not save. Try again.');
    }
  }, [selected, draftDirty, draftContent]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    if (!window.confirm('Archive this note? It will be hidden from all views.')) return;
    const ok = await captureService.archive(selected.id);
    if (ok) {
      const remaining = notes.filter(n => n.id !== selected.id);
      setNotes(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      toast.success('Note archived');
    } else {
      toast.error('Could not archive. Try again.');
    }
  }, [selected, notes]);

  // Keyboard: Cmd+S in detail saves.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        const focused = document.activeElement;
        if (focused === textareaRef.current) {
          e.preventDefault();
          void handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSave]);

  if (!currentWorkspace?.id) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No workspace.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">

      {/* Top bar: title, filter chips, + Capture trigger */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h2 className="pulse-label text-zinc-500 dark:text-zinc-400 shrink-0">
            NOTES · {notes.length}
          </h2>
          <div className="flex items-center gap-1 overflow-x-auto">
            {FILTER_KINDS.map(f => (
              <button
                key={f.value ?? 'null'}
                onClick={() => setFilterKind(f.value)}
                className={`pulse-label px-2.5 py-1 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 shrink-0 ${
                  filterKind === f.value
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('pulse:capture-open'))}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 shrink-0"
        >
          <Plus size={14} />
          New
          <kbd className="pulse-label opacity-70">⌘J</kbd>
        </button>
      </div>

      {/* Main: list + detail */}
      <div className="flex-1 flex min-h-0">

        {/* LIST PANE */}
        <aside className="w-80 border-r border-zinc-100 dark:border-white/[0.06] flex flex-col min-h-0 shrink-0">
          <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-white/[0.06] shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter notes…"
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/20 focus:outline-none transition-colors duration-150"
              />
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto py-1" role="listbox">
            {loading && (
              <li className="px-4 py-6 text-center pulse-label text-zinc-400 dark:text-zinc-500">LOADING…</li>
            )}
            {!loading && filtered.length === 0 && (
              <li className="px-4 py-6 text-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">No notes yet.</p>
                <p className="pulse-label text-zinc-400 dark:text-zinc-500">PRESS ⌘J TO CAPTURE</p>
              </li>
            )}
            {!loading && filtered.map(n => {
              const isSelected = n.id === selectedId;
              const preview = n.content.split(/\r?\n/, 1)[0]?.slice(0, 80) || '(empty)';
              const tail = n.content.slice(preview.length, preview.length + 100).replace(/\s+/g, ' ').trim();
              return (
                <li key={n.id}>
                  <button
                    onClick={() => setSelectedId(n.id)}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full text-left flex flex-col gap-1 px-3 py-2.5 border-l-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                      isSelected
                        ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500'
                        : 'border-transparent hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      {n.kind && (
                        <span className={`pulse-label px-1.5 py-0.5 rounded shrink-0 ${KIND_PILL[n.kind]}`}>
                          {n.kind.toUpperCase()}
                        </span>
                      )}
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate min-w-0 flex-1">
                        {preview}
                      </span>
                    </div>
                    {tail && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {tail}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="pulse-label text-zinc-400 dark:text-zinc-500">
                        {formatTimestamp(n.created_at)}
                      </span>
                      {SOURCE_LABEL[n.source_section] && (
                        <span className="pulse-label text-zinc-300 dark:text-zinc-600">·</span>
                      )}
                      <span className="pulse-label text-zinc-400 dark:text-zinc-500 truncate">
                        {SOURCE_LABEL[n.source_section] || n.source_section.toUpperCase()}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* DETAIL PANE */}
        <main className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <>
              {/* Detail header */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06] shrink-0">
                <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                  <span className="pulse-label text-rose-600 dark:text-rose-400">CAPTURE</span>
                  <span className="pulse-label text-zinc-300 dark:text-zinc-600">·</span>
                  <span className="pulse-label text-zinc-500 dark:text-zinc-400">
                    {formatTimestamp(selected.created_at)}
                  </span>
                  <span className="pulse-label text-zinc-300 dark:text-zinc-600">·</span>
                  <span className="pulse-label text-zinc-500 dark:text-zinc-400">
                    FROM · {SOURCE_LABEL[selected.source_section] || selected.source_section.toUpperCase()}
                  </span>
                  {selected.kind && (
                    <>
                      <span className="pulse-label text-zinc-300 dark:text-zinc-600">·</span>
                      <span className={`pulse-label px-1.5 py-0.5 rounded ${KIND_PILL[selected.kind]}`}>
                        {selected.kind.toUpperCase()}
                      </span>
                    </>
                  )}
                  {selected.routed_decision_id && (
                    <span className="pulse-label inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ExternalLink className="w-3 h-3" />
                      ROUTED → DECISION
                    </span>
                  )}
                  {selected.routed_task_id && (
                    <span className="pulse-label inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ExternalLink className="w-3 h-3" />
                      ROUTED → TASK
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {draftDirty && (
                    <button
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-medium transition-colors duration-150 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                    >
                      <Save size={13} />
                      Save
                      <kbd className="pulse-label opacity-70">⌘S</kbd>
                    </button>
                  )}
                  <button
                    onClick={() => void handleDelete()}
                    aria-label="Archive note"
                    title="Archive note"
                    className="w-8 h-8 inline-flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Detail editor */}
              <div className="flex-1 px-6 py-5 overflow-y-auto">
                <textarea
                  ref={textareaRef}
                  value={draftContent}
                  onChange={e => {
                    setDraftContent(e.target.value);
                    setDraftDirty(e.target.value !== selected.content);
                  }}
                  placeholder="Empty note. Start typing."
                  className="w-full h-full min-h-[60vh] bg-transparent border-0 p-0 text-base leading-relaxed resize-none focus:ring-0 focus:outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 font-light"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {notes.length === 0
                  ? "No notes yet. Press ⌘J anywhere in Pulse to capture a thought."
                  : "Pick a note on the left, or start a new one."}
              </p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('pulse:capture-open'))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                <Plus size={14} />
                Capture a thought
                <kbd className="pulse-label opacity-70">⌘J</kbd>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default CapturesView;
