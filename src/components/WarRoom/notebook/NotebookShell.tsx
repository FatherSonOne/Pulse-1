/**
 * NotebookShell — War Room "Notebook" redesign (Path A · Sources · Chat · Studio)
 *
 * Flag-gated alternative to StudioLayout, selected in LiveDashboard via
 * `useFeature('warRoomNotebook', userId)`. This is a UI/IA re-skin of the
 * existing War Room engine — RAG, voice, and the 4 generators are consumed
 * as-is (handoff: docs/WAR_ROOM_IMPLEMENTATION_HANDOFF_2026-06-01.md).
 *
 * Same 3-pane bones as StudioLayout (`[Sources] | [canvas] | [Artifacts]`),
 * reusing the existing `PulseStudio.css` `.ps-*` classes. What changes vs the
 * legacy layout:
 *   • LEFT  — `SourcesPane` (ActiveContextBar + tag chips + reused IntelDesk).   [Phase 1]
 *   • CENTER— `children` (PulseStudio today; becomes ChatPane in Phase 2).
 *   • RIGHT — `TheBoard` today; becomes StudioPane + GeneratorRail in Phase 5.
 *   • Generators open via the canonical STORE flags (rendered by
 *     WarRoomModalStack), never a local `activeGen` — so the new shell avoids
 *     the dual-dispatch the legacy StudioLayout carries.
 *
 * The engine (store slices, ragService, generators, voice) is untouched.
 */

import React, { useState, useEffect, useCallback } from 'react';
import '../PulseStudio.css';
import { SourcesPane } from './SourcesPane';
import { StudioPane } from './StudioPane';
import { ActionPalette, PaletteAction } from '../ActionPalette';
import { useSwipeGesture } from '../useSwipeGesture';
import { useWarRoomStore } from '../../../store/warRoomStore';
import type { StudioLayoutProps } from '../StudioLayout';

import { FileText, Layers, Pin, X } from 'lucide-react';

export type NotebookShellProps = StudioLayoutProps;

export const NotebookShell: React.FC<NotebookShellProps> = ({
  children,
  className = '',
  apiKey,
  onVoiceSend,
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
}) => {
  // ── Generator dispatch goes through the canonical store flags ────────────────
  const setShowStudyGuide = useWarRoomStore((s) => s.setShowStudyGuide);
  const setShowFAQ = useWarRoomStore((s) => s.setShowFAQ);
  const setShowTimeline = useWarRoomStore((s) => s.setShowTimeline);
  const setShowPodcast = useWarRoomStore((s) => s.setShowPodcast);

  // ── Panel state (controlled by LiveDashboard, mirrors StudioLayout) ──────────
  const isSourceControlled = propSourceOpen !== undefined && onSourceChange !== undefined;
  const sourceOpen = isSourceControlled ? propSourceOpen! : true;
  const toggleSource = () => {
    if (isSourceControlled) onSourceChange!(!propSourceOpen!);
  };

  const isArtifactsControlled = propArtifactsOpen !== undefined && onArtifactsChange !== undefined;
  const [internalArtifactsOpen, setInternalArtifactsOpen] = useState(false);
  const artifactsOpen = isArtifactsControlled ? propArtifactsOpen! : internalArtifactsOpen;
  const toggleArtifacts = () => {
    if (isArtifactsControlled) onArtifactsChange!(!propArtifactsOpen!);
    else setInternalArtifactsOpen((v) => !v);
  };

  const [paletteOpen, setPaletteOpen] = useState(false);

  const hasDocProps = documents !== undefined && onToggleDoc !== undefined;
  const hasBoardProps = notes !== undefined && onAddNote !== undefined;

  // ── Source counts for the Studio rail hint ───────────────────────────────────
  const completedDocs = (documents ?? []).filter((d) => d.processing_status === 'completed');
  const activeSourceCount = completedDocs.filter((d) => (activeContextDocs ?? new Set()).has(d.id)).length;

  // ── Mobile swipe gestures ────────────────────────────────────────────────────
  const swipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeRight: () => {
      if (!sourceOpen && isSourceControlled) onSourceChange!(true);
    },
    onSwipeLeft: () => {
      if (!artifactsOpen) toggleArtifacts();
    },
    edgeOnly: 30,
    threshold: 50,
  });

  // ── Mobile: auto-close panels on first mount ─────────────────────────────────
  useEffect(() => {
    if (window.innerWidth < 640) {
      if (isSourceControlled) onSourceChange!(false);
      setInternalArtifactsOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cmd+K shortcut ───────────────────────────────────────────────────────────
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

  // ── Palette actions — generators dispatch via store flags ────────────────────
  const paletteActions: PaletteAction[] = [
    {
      id: 'gen-study-guide',
      label: 'Generate Study Guide',
      description: 'Structured notes & flashcards from sources',
      icon: 'fa-book-open',
      category: 'generate',
      accent: '#f59e0b',
      execute: () => setShowStudyGuide(true),
    },
    {
      id: 'gen-faq',
      label: 'Generate FAQ',
      description: 'Questions derived from your sources',
      icon: 'fa-circle-question',
      category: 'generate',
      accent: '#f59e0b',
      execute: () => setShowFAQ(true),
    },
    {
      id: 'gen-timeline',
      label: 'Generate Timeline',
      description: 'Chronological events from sources',
      icon: 'fa-timeline',
      category: 'generate',
      accent: '#f59e0b',
      execute: () => setShowTimeline(true),
    },
    {
      id: 'gen-podcast',
      label: 'Generate Podcast Script',
      description: 'Two-host dialogue from sources',
      icon: 'fa-microphone',
      category: 'generate',
      accent: '#f59e0b',
      execute: () => setShowPodcast(true),
    },
    {
      id: 'source-toggle',
      label: sourceOpen ? 'Hide Sources' : 'Show Sources',
      description: 'Toggle the source library panel',
      icon: 'fa-database',
      category: 'board',
      accent: '#f43f5e',
      execute: toggleSource,
    },
    {
      id: 'artifacts-toggle',
      label: artifactsOpen ? 'Hide Artifacts' : 'Show Artifacts',
      description: 'Toggle the artifacts panel',
      icon: 'fa-thumbtack',
      category: 'board',
      accent: '#8b5cf6',
      execute: toggleArtifacts,
    },
    ...(onKnowledgeBank
      ? [{
          id: 'knowledge-bank',
          label: 'Open Knowledge Bank',
          description: 'Browse your full document library',
          icon: 'fa-book-bookmark',
          category: 'board' as const,
          accent: '#a855f7',
          execute: onKnowledgeBank,
        }]
      : []),
    ...(onAddAllDocs
      ? [{
          id: 'add-all-sources',
          label: 'Add All Sources to Context',
          description: 'Activate all documents for AI context',
          icon: 'fa-layer-group',
          category: 'board' as const,
          accent: '#f43f5e',
          execute: onAddAllDocs,
        }]
      : []),
    ...(onClearAllDocs
      ? [{
          id: 'clear-sources',
          label: 'Clear Source Context',
          description: 'Remove all documents from context',
          icon: 'fa-eraser',
          category: 'board' as const,
          accent: '#ef4444',
          execute: onClearAllDocs,
        }]
      : []),
  ];

  return (
    <div className={`pulse-studio ${className}`}>
      <div className="ps-body" ref={swipeRef}>
        {/* Mobile backdrop — dismiss panels on tap */}
        {(sourceOpen || artifactsOpen) && (
          <div
            className="ps-panel-backdrop"
            onClick={() => {
              if (sourceOpen && isSourceControlled) onSourceChange!(false);
              if (artifactsOpen) toggleArtifacts();
            }}
          />
        )}

        {/* Sources Panel */}
        {sourceOpen && (
          <aside className="ps-panel ps-panel-left" aria-label="Sources">
            <div className="ps-panel-header">
              <h3>
                <FileText size={14} />
                Sources
              </h3>
              <div style={{ display: 'flex', gap: 2 }}>
                {onKnowledgeBank && (
                  <button className="ps-icon-btn" onClick={onKnowledgeBank} title="Knowledge Bank">
                    <Layers size={14} />
                  </button>
                )}
                <button className="ps-icon-btn" onClick={toggleSource} title="Close sources">
                  <X size={14} />
                </button>
              </div>
            </div>
            {hasDocProps ? (
              <SourcesPane
                documents={documents!}
                activeContextDocs={activeContextDocs ?? new Set()}
                uploadingFiles={uploadingFiles ?? new Set()}
                uploadProgress={uploadProgress ?? new Map()}
                onToggleDoc={onToggleDoc!}
                onDeleteDoc={onDeleteDoc ?? (() => {})}
                onViewDoc={onViewDoc ?? (() => {})}
                onUpload={onUploadDocs ?? (() => {})}
                onAddAllDocs={onAddAllDocs ?? (() => {})}
                onClearAllDocs={onClearAllDocs ?? (() => {})}
              />
            ) : (
              <div className="ps-empty-state">
                <div className="ps-empty-icon">
                  <FileText size={22} />
                </div>
                <div className="ps-empty-title">No sources yet</div>
                <div className="ps-empty-desc">
                  Upload documents to give the AI context for better answers
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Main Canvas */}
        <main className="ps-canvas">{children}</main>

        {/* Artifacts Panel */}
        {artifactsOpen && (
          <aside className="ps-panel ps-panel-right" aria-label="Studio">
            <div className="ps-panel-header">
              <h3>
                <Layers size={14} />
                Studio
              </h3>
              <button className="ps-icon-btn" onClick={toggleArtifacts} title="Close studio">
                <X size={14} />
              </button>
            </div>
            {hasBoardProps ? (
              <StudioPane
                notes={notes!}
                onAddNote={onAddNote!}
                onDeleteNote={onDeleteNote ?? (() => {})}
                onClearNotes={onClearNotes ?? (() => {})}
                activeSourceCount={activeSourceCount}
                totalSourceCount={completedDocs.length}
              />
            ) : (
              <div className="ps-empty-state">
                <div className="ps-empty-icon">
                  <Pin size={22} />
                </div>
                <div className="ps-empty-title">No artifacts yet</div>
                <div className="ps-empty-desc">
                  Pin findings, decisions, and insights as you work
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/*
        Realtime voice is docked inline inside ChatPane (DockedVoice), re-homing
        the canonical VoiceAgentPanel — no floating shell, one voice surface
        (Phase 6). The legacy floating VoiceOverlay was removed here.
      */}

      {/* ── Action Palette (Cmd+K) ───────────────────────────────────────────── */}
      <ActionPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />

      {/*
        Generator modals are NOT rendered here — they open via the canonical
        store flags (setShowStudyGuide / …) and render in WarRoomModalStack,
        which LiveDashboard already mounts. This keeps a single dispatch path.
      */}
    </div>
  );
};

export default NotebookShell;
