/**
 * StudioLayout — Unified 3-panel layout for War Room
 *
 * Replaces WarRoomLayout + ModeToolbar + 7 mode components with a single
 * clean layout: [Sources Panel] | [Conversation Canvas] | [Artifacts Panel]
 *
 * Reuses IntelDesk (Sources) and TheBoard (Artifacts) components with
 * rebranded panel headers.
 */

import React, { useState, useEffect } from 'react';
import './PulseStudio.css';
import { IntelDesk } from './IntelDesk';
import { TheBoard } from './TheBoard';
import { ActionPalette, PaletteAction } from './ActionPalette';
import { VoiceOverlay } from './VoiceOverlay';
import { useSwipeGesture } from './useSwipeGesture';
import { useWarRoomStore } from '../../store/warRoomStore';
import { KnowledgeDoc } from '../../services/ragService';
import { BoardNote, NoteType, BoardNoteMeta } from './useBoardNotes';

import { FileText, Layers, Pin, X } from 'lucide-react';

export interface StudioLayoutProps {
  children: React.ReactNode;
  className?: string;

  // ── Action Palette ──────────────────────────────────────────────
  apiKey?: string;

  // ── Voice ───────────────────────────────────────────────────────
  onVoiceSend?: (text: string) => void;

  // ── Sources Panel (Intel Desk) ──────────────────────────────────
  documents?: KnowledgeDoc[];
  activeContextDocs?: Set<string>;
  uploadingFiles?: Set<string>;
  uploadProgress?: Map<string, number>;
  onToggleDoc?: (id: string) => void;
  onDeleteDoc?: (id: string) => void;
  onViewDoc?: (id: string) => void;
  onUploadDocs?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddAllDocs?: () => void;
  onClearAllDocs?: () => void;

  // ── Artifacts Panel (The Board) ─────────────────────────────────
  notes?: BoardNote[];
  onAddNote?: (content: string, type: NoteType, meta?: BoardNoteMeta) => void;
  onDeleteNote?: (id: string) => void;
  onClearNotes?: () => void;

  // ── Controlled panels ───────────────────────────────────────────
  sourceOpen?: boolean;
  onSourceChange?: (v: boolean) => void;
  artifactsOpen?: boolean;
  onArtifactsChange?: (v: boolean) => void;
  onKnowledgeBank?: () => void;
}

export const StudioLayout: React.FC<StudioLayoutProps> = ({
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
  // ── Panel state ──────────────────────────────────────────────────────────
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
    else setInternalArtifactsOpen(v => !v);
  };

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  // Generators dispatch through the canonical store flags (rendered by
  // WarRoomModalStack) — the single dispatch path. The former local `activeGen`
  // state + inline generator modals were removed here to end the dual dispatch
  // (handoff Phase 5).
  const setShowStudyGuide = useWarRoomStore((s) => s.setShowStudyGuide);
  const setShowFAQ = useWarRoomStore((s) => s.setShowFAQ);
  const setShowTimeline = useWarRoomStore((s) => s.setShowTimeline);
  const setShowPodcast = useWarRoomStore((s) => s.setShowPodcast);

  const hasDocProps = documents !== undefined && onToggleDoc !== undefined;
  const hasBoardProps = notes !== undefined && onAddNote !== undefined;

  // ── Mobile swipe gestures ───────────────────────────────────────────────
  const swipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeRight: () => {
      // Swipe right from left edge → open Sources
      if (!sourceOpen && isSourceControlled) onSourceChange!(true);
    },
    onSwipeLeft: () => {
      // Swipe left from right edge → open Artifacts
      if (!artifactsOpen) toggleArtifacts();
    },
    edgeOnly: 30,
    threshold: 50,
  });

  // ── Mobile: auto-close panels ────────────────────────────────────────────
  useEffect(() => {
    if (window.innerWidth < 640) {
      if (isSourceControlled) onSourceChange!(false);
      setInternalArtifactsOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cmd+K shortcut ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Palette actions ──────────────────────────────────────────────────────
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
    ...(onKnowledgeBank ? [{
      id: 'knowledge-bank',
      label: 'Open Knowledge Bank',
      description: 'Browse your full document library',
      icon: 'fa-book-bookmark',
      category: 'board' as const,
      accent: '#a855f7',
      execute: onKnowledgeBank,
    }] : []),
    ...(onAddAllDocs ? [{
      id: 'add-all-sources',
      label: 'Add All Sources to Context',
      description: 'Activate all documents for AI context',
      icon: 'fa-layer-group',
      category: 'board' as const,
      accent: '#f43f5e',
      execute: onAddAllDocs,
    }] : []),
    ...(onClearAllDocs ? [{
      id: 'clear-sources',
      label: 'Clear Source Context',
      description: 'Remove all documents from context',
      icon: 'fa-eraser',
      category: 'board' as const,
      accent: '#ef4444',
      execute: onClearAllDocs,
    }] : []),
  ];

  return (
    <div className={`pulse-studio ${className}`}>
      {/* ── Body (3 columns) — swipe-enabled on mobile ─────────────── */}
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
                  <button
                    className="ps-icon-btn"
                    onClick={onKnowledgeBank}
                    title="Knowledge Bank"
                  >
                    <Layers size={14} />
                  </button>
                )}
                <button
                  className="ps-icon-btn"
                  onClick={toggleSource}
                  title="Close sources"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {hasDocProps ? (
              <IntelDesk
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
        <main className="ps-canvas">
          {children}
        </main>

        {/* Artifacts Panel */}
        {artifactsOpen && (
          <aside className="ps-panel ps-panel-right" aria-label="Artifacts">
            <div className="ps-panel-header">
              <h3>
                <Pin size={14} />
                Artifacts
              </h3>
              <button
                className="ps-icon-btn"
                onClick={toggleArtifacts}
                title="Close artifacts"
              >
                <X size={14} />
              </button>
            </div>
            {hasBoardProps ? (
              <TheBoard
                notes={notes!}
                onAddNote={onAddNote!}
                onDeleteNote={onDeleteNote ?? (() => {})}
                onClearNotes={onClearNotes ?? (() => {})}
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

      {/* ── Voice Overlay ───────────────────────────────────────────── */}
      {voiceOpen && onVoiceSend && (
        <VoiceOverlay
          onSendMessage={onVoiceSend}
          onClose={() => setVoiceOpen(false)}
        />
      )}

      {/* ── Action Palette (Cmd+K) ─────────────────────────────────── */}
      <ActionPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />

      {/*
        Generator modals are rendered by WarRoomModalStack (store flags) —
        the single dispatch path. The former local activeGen modal block was
        removed here in Phase 5 to end the dual dispatch.
      */}
    </div>
  );
};

export default StudioLayout;
