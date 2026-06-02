/**
 * NotebookShell — War Room "Notebook" (Path A) frame, built to the mockup.
 *
 * A clean always-on 3-column layout (Sources · Chat · Studio) defined in
 * notebook.css — NOT the legacy StudioLayout `.ps-panel` collapsible bones.
 * Reuses only the engine: it forwards the existing store handlers to the freshly
 * built SourcesPane / StudioPane and renders the chat (`children` = ChatPane).
 * Side columns are always visible on desktop and become swipe/backdrop overlays
 * on small screens. ⌘K ActionPalette retained (generators dispatch via store
 * flags → WarRoomModalStack; single path).
 */

import React, { useState, useEffect } from 'react';
import './notebook.css';
import { SourcesPane } from './SourcesPane';
import { StudioPane } from './StudioPane';
import { ProjectNav } from './ProjectSwitcher';
import { ActionPalette, PaletteAction } from '../ActionPalette';
import { useSwipeGesture } from '../useSwipeGesture';
import { useWarRoomStore } from '../../../store/warRoomStore';
import type { StudioLayoutProps } from '../StudioLayout';

import { FolderOpen, Sparkles } from 'lucide-react';

export interface NotebookShellProps extends StudioLayoutProps {
  /** Project/session nav, folded into the Sources pane (Notebook path only). */
  nav?: ProjectNav;
  /** Open the share dialog for a document (Notebook path only). */
  onShareDoc?: (id: string) => void;
}

export const NotebookShell: React.FC<NotebookShellProps> = ({
  children,
  className = '',
  documents,
  activeContextDocs,
  uploadingFiles,
  uploadProgress,
  onToggleDoc,
  onDeleteDoc,
  onViewDoc,
  onUploadDocs,
  onAddAllDocs,
  onClearAllDocs,
  notes,
  onAddNote,
  onDeleteNote,
  onClearNotes,
  sourceOpen: propSourceOpen,
  onSourceChange,
  artifactsOpen: propArtifactsOpen,
  onArtifactsChange,
  onKnowledgeBank,
  nav,
  onShareDoc,
}) => {
  const setShowStudyGuide = useWarRoomStore((s) => s.setShowStudyGuide);
  const setShowFAQ = useWarRoomStore((s) => s.setShowFAQ);
  const setShowTimeline = useWarRoomStore((s) => s.setShowTimeline);
  const setShowPodcast = useWarRoomStore((s) => s.setShowPodcast);

  const isSourceControlled = propSourceOpen !== undefined && onSourceChange !== undefined;
  const sourceOpen = isSourceControlled ? propSourceOpen! : true;
  const setSourceOpen = (v: boolean) => { if (isSourceControlled) onSourceChange!(v); };

  const isArtifactsControlled = propArtifactsOpen !== undefined && onArtifactsChange !== undefined;
  const [internalStudioOpen, setInternalStudioOpen] = useState(true);
  const studioOpen = isArtifactsControlled ? propArtifactsOpen! : internalStudioOpen;
  const setStudioOpen = (v: boolean) => { if (isArtifactsControlled) onArtifactsChange!(v); else setInternalStudioOpen(v); };

  const [paletteOpen, setPaletteOpen] = useState(false);

  const hasDocProps = documents !== undefined && onToggleDoc !== undefined;
  const hasBoardProps = notes !== undefined && onAddNote !== undefined;

  const completedDocs = (documents ?? []).filter((d) => d.processing_status === 'completed');
  const activeSourceCount = completedDocs.filter((d) => (activeContextDocs ?? new Set()).has(d.id)).length;

  // ── Mobile: default panels closed; swipe to open ────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSourceOpen(false);
      setInternalStudioOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeRight: () => setSourceOpen(true),
    onSwipeLeft: () => setStudioOpen(true),
    edgeOnly: 30,
    threshold: 50,
  });

  // ── Cmd+K ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const paletteActions: PaletteAction[] = [
    { id: 'gen-study-guide', label: 'Generate Study Guide', description: 'Structured notes & flashcards from sources', icon: 'fa-book-open', category: 'generate', accent: '#f59e0b', execute: () => setShowStudyGuide(true) },
    { id: 'gen-faq', label: 'Generate FAQ', description: 'Questions derived from your sources', icon: 'fa-circle-question', category: 'generate', accent: '#f59e0b', execute: () => setShowFAQ(true) },
    { id: 'gen-timeline', label: 'Generate Timeline', description: 'Chronological events from sources', icon: 'fa-timeline', category: 'generate', accent: '#f59e0b', execute: () => setShowTimeline(true) },
    { id: 'gen-podcast', label: 'Generate Podcast Script', description: 'Two-host dialogue from sources', icon: 'fa-microphone', category: 'generate', accent: '#f59e0b', execute: () => setShowPodcast(true) },
    { id: 'source-toggle', label: sourceOpen ? 'Hide Sources' : 'Show Sources', description: 'Toggle the Sources panel', icon: 'fa-database', category: 'board', accent: '#f43f5e', execute: () => setSourceOpen(!sourceOpen) },
    { id: 'studio-toggle', label: studioOpen ? 'Hide Studio' : 'Show Studio', description: 'Toggle the Studio panel', icon: 'fa-wand-magic-sparkles', category: 'board', accent: '#8b5cf6', execute: () => setStudioOpen(!studioOpen) },
    ...(onKnowledgeBank ? [{ id: 'knowledge-bank', label: 'Open Knowledge Bank', description: 'Browse your full document library', icon: 'fa-book-bookmark', category: 'board' as const, accent: '#a855f7', execute: onKnowledgeBank }] : []),
    ...(onAddAllDocs ? [{ id: 'add-all-sources', label: 'Add All Sources to Context', description: 'Activate all documents for AI context', icon: 'fa-layer-group', category: 'board' as const, accent: '#f43f5e', execute: onAddAllDocs }] : []),
    ...(onClearAllDocs ? [{ id: 'clear-sources', label: 'Clear Source Context', description: 'Remove all documents from context', icon: 'fa-eraser', category: 'board' as const, accent: '#ef4444', execute: onClearAllDocs }] : []),
  ];

  const anyPanelOpen = sourceOpen || studioOpen;

  return (
    <div className={`wr-nb ${className}`} ref={swipeRef}>
      {/* Mobile-only toggle bar */}
      <div className="wr-nb-mobilebar">
        <button className="wr-nb-mobilebtn" onClick={() => setSourceOpen(!sourceOpen)}>
          <FolderOpen size={14} /> Sources
        </button>
        <button className="wr-nb-mobilebtn" onClick={() => setStudioOpen(!studioOpen)}>
          <Sparkles size={14} /> Studio
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Mobile backdrop */}
        {anyPanelOpen && (
          <div
            className="wr-nb-backdrop"
            onClick={() => { setSourceOpen(false); setStudioOpen(false); }}
          />
        )}

        {/* LEFT — Sources */}
        {sourceOpen && hasDocProps && (
          <aside className="wr-nb-sources" aria-label="Sources">
            <SourcesPane
              nav={nav}
              documents={documents!}
              activeContextDocs={activeContextDocs ?? new Set()}
              uploadingFiles={uploadingFiles ?? new Set()}
              uploadProgress={uploadProgress ?? new Map()}
              onToggleDoc={onToggleDoc!}
              onDeleteDoc={onDeleteDoc ?? (() => {})}
              onViewDoc={onViewDoc ?? (() => {})}
              onShareDoc={onShareDoc}
              onUpload={onUploadDocs ?? (() => {})}
              onAddAllDocs={onAddAllDocs ?? (() => {})}
              onClearAllDocs={onClearAllDocs ?? (() => {})}
            />
          </aside>
        )}

        {/* CENTER — Chat */}
        <main className="wr-nb-chat">{children}</main>

        {/* RIGHT — Studio */}
        {studioOpen && hasBoardProps && (
          <aside className="wr-nb-studio" data-force-open={studioOpen} aria-label="Studio">
            <StudioPane
              notes={notes!}
              onAddNote={onAddNote!}
              onDeleteNote={onDeleteNote ?? (() => {})}
              onClearNotes={onClearNotes ?? (() => {})}
              activeSourceCount={activeSourceCount}
              totalSourceCount={completedDocs.length}
            />
          </aside>
        )}
      </div>

      {/* ⌘K Action Palette (secondary launch path) */}
      <ActionPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} actions={paletteActions} />
    </div>
  );
};

export default NotebookShell;
