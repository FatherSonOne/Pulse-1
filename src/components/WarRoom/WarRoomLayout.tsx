/**
 * WarRoomLayout — Phase 2 (source panel live) + Phase 5 (Action Palette)
 *
 * 3-panel layout:
 *   [Intel Desk — source library] | [Mode content] | [The Board — Phase 3]
 *
 * Phase 5 additions:
 *   • ⌘K / Ctrl+K opens ActionPalette
 *   • ActionPalette builds Generate / Navigate / Board action groups
 *   • Generate actions open content-generator modals (Study Guide, FAQ, Timeline, Podcast)
 */

import React, { useState, useEffect, useCallback } from 'react';
import './war-room-tokens.css';
import { ModeToolbar } from './ModeToolbar';
import { WarRoomMode } from './ModeSwitcher';
import { IntelDesk } from './IntelDesk';
import { TheBoard } from './TheBoard';
import { ActionPalette, PaletteAction, buildModeActions } from './ActionPalette';
import { StudyGuideGenerator, FAQGenerator, TimelineGenerator, PodcastGenerator } from './ContentGenerators';
import { VoiceOverlay } from './VoiceOverlay';
import { KnowledgeDoc } from '../../services/ragService';
import { BoardNote, NoteType, BoardNoteMeta } from './useBoardNotes';

// ─── Types ────────────────────────────────────────────────────────────────────

type GeneratorType = 'study-guide' | 'faq' | 'timeline' | 'podcast' | null;

export interface WarRoomLayoutProps {
  currentMode: WarRoomMode;
  onModeChange: (mode: WarRoomMode) => void;
  onMissionLaunch?: () => void;
  children: React.ReactNode;
  className?: string;
  defaultSourceOpen?: boolean;
  defaultNotesOpen?: boolean;

  // ── Phase 5: Action Palette ──────────────────────────────────────
  apiKey?: string;

  // ── Phase 6: Voice Overlay ───────────────────────────────────────
  onVoiceSend?: (text: string) => void;

  // ── Intel Desk (Phase 2) ──────────────────────────────────────
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

  // ── The Board (Phase 3) ───────────────────────────────────────
  notes?: BoardNote[];
  onAddNote?: (content: string, type: NoteType, meta?: BoardNoteMeta) => void;
  onDeleteNote?: (id: string) => void;
  onClearNotes?: () => void;

  // ── Phase 9: Controlled source panel ──────────────────────────
  sourceOpen?: boolean;
  onSourceChange?: (v: boolean) => void;
  onKnowledgeBank?: () => void;
}

// ─── Mode → CSS class mapping ─────────────────────────────────────────────────

const MODE_CLASS: Partial<Record<WarRoomMode, string>> = {
  'command-center':    'wr-mode-command',
  'tactical':          'wr-mode-command',
  'intel':             'wr-mode-intel',
  'analyst':           'wr-mode-analyst',
  'strategist':        'wr-mode-strategist',
  'brainstorm':        'wr-mode-brainstorm',
  'focus':             'wr-mode-focus',
  'debrief':           'wr-mode-debrief',
  'elegant-interface': 'wr-mode-command',
};

const CANONICAL_MODES: WarRoomMode[] = [
  'command-center', 'intel', 'analyst', 'strategist', 'brainstorm', 'focus', 'debrief',
];

// ─── Shared sub-components ────────────────────────────────────────────────────

const PanelHeader: React.FC<{ icon: string; iconColor: string; label: string }> = ({
  icon, iconColor, label,
}) => (
  <div
    style={{
      padding: '10px 14px',
      borderBottom: '1px solid var(--wr-border)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    }}
  >
    <i className={`fa ${icon}`} style={{ fontSize: 12, color: iconColor }} />
    <span
      style={{
        fontFamily: 'var(--wr-font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--wr-text-secondary)',
      }}
    >
      {label}
    </span>
  </div>
);

const PanelPlaceholder: React.FC<{ icon: string; title: string; phase: string }> = ({
  icon, title, phase,
}) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: 24,
      color: 'var(--wr-text-muted)',
      textAlign: 'center',
    }}
  >
    <i className={`fa ${icon}`} style={{ fontSize: 28, opacity: 0.25 }} />
    <div>
      <div
        style={{
          fontFamily: 'var(--wr-font-mono)',
          fontSize: 11,
          color: 'var(--wr-text-secondary)',
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ fontFamily: 'var(--wr-font-mono)', fontSize: 10, opacity: 0.5 }}>
        Activating in {phase}
      </div>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const WarRoomLayout: React.FC<WarRoomLayoutProps> = ({
  currentMode,
  onModeChange,
  onMissionLaunch,
  children,
  className = '',
  defaultSourceOpen = true,
  defaultNotesOpen = false,
  apiKey,
  onVoiceSend,
  // Intel Desk props
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
  // Board props
  notes,
  onAddNote,
  onDeleteNote,
  onClearNotes,
  // Phase 9: Controlled source panel
  sourceOpen: propSourceOpen,
  onSourceChange,
  onKnowledgeBank,
}) => {
  const [internalSourceOpen, setInternalSourceOpen] = useState(defaultSourceOpen);
  const isSourceControlled = propSourceOpen !== undefined && onSourceChange !== undefined;
  const sourceOpen = isSourceControlled ? propSourceOpen! : internalSourceOpen;
  const toggleSource = () => {
    if (isSourceControlled) {
      onSourceChange!(!propSourceOpen!);
    } else {
      setInternalSourceOpen((v) => !v);
    }
  };
  const [notesOpen,   setNotesOpen]   = useState(defaultNotesOpen);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeGen,   setActiveGen]   = useState<GeneratorType>(null);
  const [voiceOpen,   setVoiceOpen]   = useState(false);

  const modeClass     = MODE_CLASS[currentMode] ?? 'wr-mode-command';
  const hasDocProps   = documents !== undefined && onToggleDoc !== undefined;
  const hasBoardProps = notes !== undefined && onAddNote !== undefined;

  // ── Mobile: close side panels on mount if screen is narrow ──────────────
  useEffect(() => {
    if (window.innerWidth < 640) {
      setInternalSourceOpen(false);
      setNotesOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — user-toggled state overrides after that

  // ── Cmd+K / Ctrl+K global shortcut ───────────────────────────────────────
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

  // ── Build palette actions ─────────────────────────────────────────────────
  const paletteActions: PaletteAction[] = [
    // Generate
    {
      id: 'gen-study-guide',
      label: 'Generate Study Guide',
      description: 'Structured notes, questions & flashcards from sources',
      icon: 'fa-book-open',
      category: 'generate',
      accent: '#f59e0b',
      execute: () => setActiveGen('study-guide'),
    },
    {
      id: 'gen-faq',
      label: 'Generate FAQ',
      description: 'Frequently asked questions derived from your sources',
      icon: 'fa-circle-question',
      category: 'generate',
      accent: '#f59e0b',
      execute: () => setActiveGen('faq'),
    },
    {
      id: 'gen-timeline',
      label: 'Generate Timeline',
      description: 'Chronological event sequence extracted from sources',
      icon: 'fa-timeline',
      category: 'generate',
      accent: '#f59e0b',
      execute: () => setActiveGen('timeline'),
    },
    {
      id: 'gen-podcast',
      label: 'Generate Podcast Script',
      description: 'Two-host dialogue covering key topics in sources',
      icon: 'fa-microphone',
      category: 'generate',
      accent: '#f59e0b',
      execute: () => setActiveGen('podcast'),
    },
    // Navigate (all canonical modes except current)
    ...buildModeActions(CANONICAL_MODES, currentMode, onModeChange),
    // Board
    {
      id: 'board-toggle',
      label: notesOpen ? 'Hide The Board' : 'Show The Board',
      description: 'Toggle the intelligence board panel',
      icon: 'fa-thumbtack',
      category: 'board',
      accent: '#8b5cf6',
      execute: () => setNotesOpen((v) => !v),
    },
    {
      id: 'source-toggle',
      label: sourceOpen ? 'Hide Intel Desk' : 'Show Intel Desk',
      description: 'Toggle the source library panel',
      icon: 'fa-database',
      category: 'board',
      accent: '#06b6d4',
      execute: toggleSource,
    },
    ...(onKnowledgeBank ? [{
      id: 'board-knowledge-bank',
      label: 'Open Knowledge Bank',
      description: 'Browse and manage your full document library',
      icon: 'fa-book-bookmark',
      category: 'board' as const,
      accent: '#a855f7',
      execute: onKnowledgeBank,
    }] : []),
    ...(onAddAllDocs ? [{
      id: 'board-add-all-sources',
      label: 'Add All Sources to Context',
      description: 'Activate all ingested documents for AI context',
      icon: 'fa-layer-group',
      category: 'board' as const,
      accent: '#06b6d4',
      execute: onAddAllDocs,
    }] : []),
    ...(onClearAllDocs ? [{
      id: 'board-clear-sources',
      label: 'Clear Source Context',
      description: 'Remove all documents from active AI context',
      icon: 'fa-eraser',
      category: 'board' as const,
      accent: '#f43f5e',
      execute: onClearAllDocs,
    }] : []),
  ];

  // If no API key, disable generate actions with a hint
  const effectiveActions = apiKey
    ? paletteActions
    : paletteActions.map((a) =>
        a.category === 'generate'
          ? { ...a, description: 'API key required to generate', execute: () => {} }
          : a,
      );

  const closeGen = useCallback(() => setActiveGen(null), []);
  const genDocs    = documents ?? [];
  const genCtxIds  = activeContextDocs ?? new Set<string>();

  return (
    <div
      className={`wr-layout ${modeClass} ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        backgroundColor: 'var(--wr-bg-primary)',
        color: 'var(--wr-text-primary)',
        fontFamily: 'var(--wr-font-sans)',
        overflow: 'hidden',
      }}
    >
      {/* ── Mode Toolbar ────────────────────────────────────────── */}
      <ModeToolbar
        currentMode={currentMode}
        onModeChange={onModeChange}
        onMissionLaunch={onMissionLaunch}
        onToggleSource={toggleSource}
        onToggleNotes={() => setNotesOpen((v) => !v)}
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleVoice={onVoiceSend ? () => setVoiceOpen((v) => !v) : undefined}
        voiceOpen={voiceOpen}
        sourceOpen={sourceOpen}
        notesOpen={notesOpen}
      />

      {/* ── Body (3 columns) ────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Intel Desk — source library */}
        {sourceOpen && (
          <aside
            style={{
              width: 260,
              minWidth: 200,
              maxWidth: 320,
              borderRight: '1px solid var(--wr-border)',
              backgroundColor: 'var(--wr-bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <PanelHeader
              icon="fa-database"
              iconColor="var(--wr-accent-secondary)"
              label="Intel Desk"
            />
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
                currentMode={currentMode}
              />
            ) : (
              <PanelPlaceholder
                icon="fa-database"
                title="Source Library"
                phase="Phase 2"
              />
            )}
          </aside>
        )}

        {/* Main content area */}
        <main
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {children}
        </main>

        {/* The Board — notes panel */}
        {notesOpen && (
          <aside
            style={{
              width: 280,
              minWidth: 220,
              maxWidth: 360,
              borderLeft: '1px solid var(--wr-border)',
              backgroundColor: 'var(--wr-bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <PanelHeader
              icon="fa-thumbtack"
              iconColor="var(--wr-accent-warning)"
              label="The Board"
            />
            {hasBoardProps ? (
              <TheBoard
                notes={notes!}
                currentMode={currentMode}
                onAddNote={onAddNote!}
                onDeleteNote={onDeleteNote ?? (() => {})}
                onClearNotes={onClearNotes ?? (() => {})}
              />
            ) : (
              <PanelPlaceholder
                icon="fa-note-sticky"
                title="Intelligence Board"
                phase="Phase 3"
              />
            )}
          </aside>
        )}
      </div>

      {/* ── Voice Overlay ───────────────────────────────────────── */}
      {voiceOpen && onVoiceSend && (
        <VoiceOverlay
          onSendMessage={onVoiceSend}
          onClose={() => setVoiceOpen(false)}
        />
      )}

      {/* ── Action Palette (⌘K) ─────────────────────────────────── */}
      <ActionPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={effectiveActions}
      />

      {/* ── Content Generator Modals ────────────────────────────── */}
      {activeGen === 'study-guide' && apiKey && (
        <StudyGuideGenerator
          documents={genDocs}
          activeContextIds={genCtxIds}
          apiKey={apiKey}
          onClose={closeGen}
        />
      )}
      {activeGen === 'faq' && apiKey && (
        <FAQGenerator
          documents={genDocs}
          activeContextIds={genCtxIds}
          apiKey={apiKey}
          onClose={closeGen}
        />
      )}
      {activeGen === 'timeline' && apiKey && (
        <TimelineGenerator
          documents={genDocs}
          activeContextIds={genCtxIds}
          apiKey={apiKey}
          onClose={closeGen}
        />
      )}
      {activeGen === 'podcast' && apiKey && (
        <PodcastGenerator
          documents={genDocs}
          activeContextIds={genCtxIds}
          apiKey={apiKey}
          onClose={closeGen}
        />
      )}
    </div>
  );
};

export default WarRoomLayout;
