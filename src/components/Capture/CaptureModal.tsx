import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import {
  captureService,
  appViewToSourceSection,
  type CaptureKind,
  type CaptureSourceSection,
} from '../../services/captureService';
import { AppView } from '../../types';

const DRAFT_KEY = 'pulse_capture_draft';

interface CaptureModalProps {
  /** Current AppView from App-level state so the modal can tag captures with provenance. */
  currentView: AppView;
}

const SOURCE_LABEL: Record<CaptureSourceSection, string> = {
  dashboard: 'DASHBOARD',
  global: 'GLOBAL',
  messages: 'MESSAGES',
  email: 'EMAIL',
  relay: 'RELAY',
  calendar: 'CALENDAR',
  contacts: 'CONTACTS',
  decisions_tasks: 'DECISIONS',
  archives: 'ARCHIVES',
  war_room: 'WAR ROOM',
  summit: 'SUMMIT',
  meetings: 'MEETINGS',
  settings: 'SETTINGS',
};

const KIND_CHIPS: { kind: CaptureKind; label: string }[] = [
  { kind: 'task',      label: 'Task' },
  { kind: 'decision',  label: 'Decision' },
  { kind: 'learning',  label: 'Learning' },
  { kind: 'friction',  label: 'Friction' },
];

/**
 * Global capture surface. Opens via the `pulse:capture-open` window event
 * (Cmd+J / Ctrl+J anywhere in Pulse). Auto-saves draft to localStorage on
 * close so a half-typed thought survives an accidental Esc.
 */
const CaptureModal: React.FC<CaptureModalProps> = ({ currentView }) => {
  const { currentWorkspace } = useWorkspaceData();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<CaptureKind>(null);
  const [saving, setSaving] = useState(false);
  // Per-open context override. Sections that aren't first-class AppViews
  // (War Room sessions, specific Summit sessions, etc.) dispatch
  // `pulse:capture-open` with `detail: { sourceSection, sourceId }` so the
  // capture tags correctly. Reset to null on close.
  const [overrideSection, setOverrideSection] = useState<CaptureSourceSection | null>(null);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const sourceSection = useMemo(
    () => overrideSection ?? appViewToSourceSection(currentView),
    [overrideSection, currentView],
  );

  // Open via window event. Restore draft on open. Apply context override if present.
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ sourceSection?: CaptureSourceSection; sourceId?: string }>).detail;
      if (detail?.sourceSection) setOverrideSection(detail.sourceSection);
      if (detail?.sourceId) setOverrideId(detail.sourceId);
      try {
        const draft = localStorage.getItem(DRAFT_KEY) || '';
        if (draft) setContent(draft);
      } catch { /* ignore */ }
      setOpen(true);
    };
    window.addEventListener('pulse:capture-open', handleOpen);
    return () => window.removeEventListener('pulse:capture-open', handleOpen);
  }, []);

  // Auto-focus on open.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open]);

  const close = useCallback((preserveDraft = true) => {
    if (preserveDraft && content.trim()) {
      try { localStorage.setItem(DRAFT_KEY, content); } catch { /* ignore */ }
    } else {
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
    setOpen(false);
    setKind(null);
    setOverrideSection(null);
    setOverrideId(null);
    if (!preserveDraft) setContent('');
  }, [content]);

  const save = useCallback(async () => {
    if (!currentWorkspace?.id) {
      toast.error('No workspace.');
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      close(false);
      return;
    }

    setSaving(true);
    const result = await captureService.createAndRoute({
      workspaceId: currentWorkspace.id,
      content: trimmed,
      sourceSection,
      sourceId: overrideId,
      kind,
    });
    setSaving(false);

    if (!result.note) {
      toast.error('Could not save capture. Try again.');
      return;
    }

    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }

    // Toast reflects routing outcome. If routing was requested but failed
    // (downstream create errored), the capture itself still landed — let the
    // user know it's saved but warn about the missing artifact.
    if (kind === 'decision' && result.routedTo === 'decision') {
      toast.success('Captured → Decisions');
    } else if (kind === 'task' && result.routedTo === 'task') {
      toast.success('Captured → Tasks');
    } else if ((kind === 'decision' || kind === 'task') && !result.routedTo) {
      toast.error(`Captured, but couldn't route to ${kind === 'decision' ? 'Decisions' : 'Tasks'}.`);
    } else {
      toast.success('Captured');
    }

    setContent('');
    setKind(null);
    setOverrideSection(null);
    setOverrideId(null);
    setOpen(false);
    window.dispatchEvent(new CustomEvent('pulse:capture-saved', {
      detail: { noteId: result.note.id, routedTo: result.routedTo, routedId: result.routedId },
    }));
  }, [content, currentWorkspace?.id, sourceSection, overrideId, kind, close]);

  // Keyboard: Esc closes, Cmd+Enter saves.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, close, save]);

  if (!open) return null;

  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).toUpperCase();

  const primaryCta = (() => {
    if (kind === 'decision') return 'Save → Decisions';
    if (kind === 'task')     return 'Save → Tasks';
    if (kind === 'friction') return 'Save → Archive (Friction)';
    if (kind === 'learning') return 'Save → Archive (Learning)';
    if (kind === 'question') return 'Save → Archive (Question)';
    return 'Save';
  })();

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="capture-modal-heading"
      className="fixed inset-0 z-[10000] flex items-start justify-center pt-[18vh] px-4"
    >
      {/* Scrim — backdrop blur is a DESIGN.md-permitted glass surface for modals only */}
      <div
        onClick={() => close(true)}
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-md animate-capture-scrim-enter"
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] shadow-2xl shadow-rose-500/10 overflow-hidden animate-capture-enter">

        {/* Header strip */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06]">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 id="capture-modal-heading" className="pulse-label text-rose-600 dark:text-rose-400">
              CAPTURE
            </h2>
            <span className="pulse-label text-zinc-400 dark:text-zinc-500">·</span>
            <span className="pulse-label text-zinc-500 dark:text-zinc-400">{timestamp}</span>
            <span className="pulse-label text-zinc-300 dark:text-zinc-600 hidden sm:inline">·</span>
            <span className="pulse-label text-zinc-400 dark:text-zinc-500 hidden sm:inline truncate">
              FROM · {SOURCE_LABEL[sourceSection]}
            </span>
          </div>
          <button
            onClick={() => close(true)}
            aria-label="Close (Esc)"
            className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Editor */}
        <div className="px-5 pt-4 pb-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Capture a thought. Cmd+Enter to save, Esc to close."
            rows={6}
            className="w-full bg-transparent border-0 p-0 text-base resize-none focus:ring-0 focus:outline-none placeholder-zinc-400 dark:placeholder-zinc-500 text-zinc-900 dark:text-zinc-50 leading-relaxed font-light min-h-[140px]"
          />
        </div>

        {/* Kind chips */}
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {KIND_CHIPS.map(c => {
            const selected = kind === c.kind;
            return (
              <button
                key={c.label}
                onClick={() => setKind(selected ? null : c.kind)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                  selected
                    ? 'bg-rose-500 border-rose-500 text-white'
                    : 'bg-zinc-50 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.02]">
          <span className="pulse-label text-zinc-400 dark:text-zinc-500">
            {content.trim().split(/\s+/).filter(Boolean).length} WORDS · {content.length} CHARS
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => close(true)}
              className="pulse-label px-3 py-1.5 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            >
              ESC
            </button>
            <button
              onClick={() => void save()}
              disabled={saving || !content.trim()}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-medium transition-colors duration-150 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            >
              {primaryCta}
              <span className="pulse-label opacity-70">⌘↵</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CaptureModal;
