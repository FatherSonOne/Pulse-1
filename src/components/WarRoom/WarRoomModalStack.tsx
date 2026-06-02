import React, { Suspense, lazy } from 'react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { KnowledgeDoc } from '../../services/ragService';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { DocumentViewer } from './DocumentViewer';
import { DocumentSearch } from './Search';
import { StudyGuideGenerator, FAQGenerator, TimelineGenerator, PodcastGenerator } from './ContentGenerators';
import { OrganizationSidebar } from './Organization';
import { ShareModal } from './Collaboration';
import { AdvancedAIPanel } from './AdvancedAI';
import { recordDocumentView } from '../../services/organizationService';
import { useWarRoomStore } from '../../store/warRoomStore';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Clipboard,
  Code,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  Mail,
  MessageSquare,
  MicOff,
  Plus,
  ScrollText,
  Share2,
  Sparkles,
  Tags,
  Trash2,
  X,
} from 'lucide-react';

/**
 * Strip markdown syntax for compact card previews. Headings, bold/italic
 * markers, code spans, and link wrappers collapse to plain text so a
 * line-clamp doesn't show literal `**` and `#` characters.
 */
/** File-type glyph as a Lucide icon (replaces the broken fa-file-* glyphs). */
function FileTypeIcon({ fileType, size = 16 }: { fileType?: string; size?: number }) {
  if (fileType?.startsWith('image')) return <FileImage size={size} />;
  if (fileType === 'xlsx') return <FileSpreadsheet size={size} />;
  return <FileText size={size} />;
}

function stripMarkdownForPreview(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lazy-loaded heavy components
const VoiceAgentPanel = lazy(() =>
  import('./VoiceAgentPanel').then(m => ({ default: m.VoiceAgentPanel }))
);

// Check if we're on a mobile/native platform — mirrors the constant in LiveDashboard
const isMobilePlatform =
  Capacitor.isNativePlatform() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Inline loading fallback (mirrors LiveDashboard's LoadingFallback but avoids a shared dep cycle)
const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="h-full w-full flex items-center justify-center bg-gray-900/50">
    <div className="text-center">
      <Loader2 size={32} className="text-rose-500 mb-2 animate-spin" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  </div>
);

export interface WarRoomModalStackProps {
  /**
   * When true (Notebook flag ON), the realtime voice agent is docked inline in
   * ChatPane (DockedVoice), so this stack must NOT also render its floating
   * VoiceAgentPanel — doing so would mount two panels / two WebRTC sessions.
   */
  dockVoiceInline?: boolean;

  // ── Visibility flags ──────────────────────────────────────────────────────
  showExportModal: boolean;
  showVoiceAgentPanel: boolean;
  voiceAgentExpanded: boolean;
  viewingDoc: KnowledgeDoc | null;
  viewerHighlightText: string | undefined;
  viewerScrollOffset: number | undefined;
  showStudyGuide: boolean;
  showFAQ: boolean;
  showTimeline: boolean;
  showPodcast: boolean;
  showAdvancedAI: boolean;
  showOrganize: boolean;
  organizingDocId: string | undefined;
  showKnowledgeBank: boolean;
  showShareModal: boolean;
  sharingDoc: KnowledgeDoc | null;

  // ── Data ──────────────────────────────────────────────────────────────────
  documents: KnowledgeDoc[];
  activeContextDocs: Set<string>;
  apiKey: string;
  openaiApiKey: string;
  /** Workspace id forwarded to the realtime voice token mint (hosted tier-gating). */
  workspaceId?: string;
  userId: string;
  selectedProjectId: string | null;
  selectedSessionId: string | null;

  // ── Close / toggle handlers ───────────────────────────────────────────────
  setShowExportModal: (v: boolean) => void;
  setShowVoiceAgentPanel: (v: boolean) => void;
  setVoiceAgentExpanded: (v: boolean) => void;
  setViewingDoc: (doc: KnowledgeDoc | null) => void;
  setViewerHighlightText: (text: string | undefined) => void;
  setViewerScrollOffset: (offset: number | undefined) => void;
  setShowStudyGuide: (v: boolean) => void;
  setShowFAQ: (v: boolean) => void;
  setShowTimeline: (v: boolean) => void;
  setShowPodcast: (v: boolean) => void;
  setShowAdvancedAI: (v: boolean) => void;
  setShowOrganize: (v: boolean) => void;
  setOrganizingDocId: (id: string | undefined) => void;
  setShowKnowledgeBank: (v: boolean) => void;
  setShowShareModal: (v: boolean) => void;
  setSharingDoc: (doc: KnowledgeDoc | null) => void;

  // ── Action handlers ───────────────────────────────────────────────────────
  handleExport: (format: 'markdown' | 'json' | 'summary') => void;
  exportToMarkdown: () => string;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteDoc: (id: string) => void;
  toggleDocInContext: (docId: string) => void;
}

export const WarRoomModalStack = React.memo<WarRoomModalStackProps>((props) => {
  const {
    dockVoiceInline,
    showExportModal,
    showVoiceAgentPanel,
    voiceAgentExpanded,
    viewingDoc,
    viewerHighlightText,
    viewerScrollOffset,
    showStudyGuide,
    showFAQ,
    showTimeline,
    showPodcast,
    showAdvancedAI,
    showOrganize,
    organizingDocId,
    showKnowledgeBank,
    showShareModal,
    sharingDoc,
    documents,
    activeContextDocs,
    apiKey,
    openaiApiKey,
    workspaceId,
    userId,
    selectedProjectId,
    selectedSessionId,
    setShowExportModal,
    setShowVoiceAgentPanel,
    setVoiceAgentExpanded,
    setViewingDoc,
    setViewerHighlightText,
    setViewerScrollOffset,
    setShowStudyGuide,
    setShowFAQ,
    setShowTimeline,
    setShowPodcast,
    setShowAdvancedAI,
    setShowOrganize,
    setOrganizingDocId,
    setShowKnowledgeBank,
    setShowShareModal,
    setSharingDoc,
    handleExport,
    exportToMarkdown,
    handleFileUpload,
    handleDeleteDoc,
    toggleDocInContext,
  } = props;

  // Single store read in an otherwise prop-driven component: which AdvancedAI
  // tab to open on (set by the GeneratorRail card). WI-10.
  const advancedAIView = useWarRoomStore((s) => s.advancedAIView);

  return (
    <>
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-2xl rounded-2xl p-6" style={{ background: 'var(--pulse-surface-modal)', border: '1px solid var(--pulse-border)' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold inline-flex items-center" style={{ color: 'var(--pulse-ink)' }}>
                <Share2 size={16} className="mr-2" style={{ color: 'var(--pulse-ink-3)' }} />
                Export Session
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--pulse-ink-3)' }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Markdown Export — neutral (a format, not AI output) */}
              <button
                onClick={() => {
                  handleExport('markdown');
                  setShowExportModal(false);
                }}
                className="w-full p-4 rounded-xl text-left transition-all"
                style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--pulse-surface)', color: 'var(--pulse-ink-2)' }}>
                    <FileText size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-base" style={{ color: 'var(--pulse-ink)' }}>Export as Markdown</div>
                    <div className="text-sm" style={{ color: 'var(--pulse-ink-3)' }}>Download full conversation as .md file</div>
                  </div>
                  <Download size={16} style={{ color: 'var(--pulse-ink-3)' }} />
                </div>
              </button>

              {/* JSON Export — neutral */}
              <button
                onClick={() => {
                  handleExport('json');
                  setShowExportModal(false);
                }}
                className="w-full p-4 rounded-xl text-left transition-all"
                style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--pulse-surface)', color: 'var(--pulse-ink-2)' }}>
                    <Code size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-base" style={{ color: 'var(--pulse-ink)' }}>Export as JSON</div>
                    <div className="text-sm" style={{ color: 'var(--pulse-ink-3)' }}>Structured data for integrations</div>
                  </div>
                  <Download size={16} style={{ color: 'var(--pulse-ink-3)' }} />
                </div>
              </button>

              {/* AI Summary — the one genuinely AI-output export earns the coral tile */}
              <button
                onClick={() => {
                  handleExport('summary');
                  setShowExportModal(false);
                }}
                className="w-full p-4 rounded-xl text-left transition-all"
                style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}>
                    <ScrollText size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-base" style={{ color: 'var(--pulse-ink)' }}>Generate AI Summary</div>
                    <div className="text-sm" style={{ color: 'var(--pulse-ink-3)' }}>Key points &amp; action items (copies to clipboard)</div>
                  </div>
                  <Clipboard size={16} style={{ color: 'var(--pulse-ink-3)' }} />
                </div>
              </button>

              {/* Share Options */}
              <div className="pt-4" style={{ borderTop: '1px solid var(--pulse-border)' }}>
                <div className="mb-3" style={{ fontFamily: 'var(--pulse-font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pulse-ink-3)' }}>Share to</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const content = exportToMarkdown();
                      navigator.clipboard.writeText(content);
                      toast.success('Copied to clipboard! Paste in Messages app');
                      setShowExportModal(false);
                    }}
                    className="px-4 py-3 rounded-xl text-sm flex items-center justify-center transition-colors"
                    style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)', color: 'var(--pulse-ink)' }}
                  >
                    <MessageSquare size={14} className="mr-2" style={{ color: 'var(--pulse-ink-3)' }} />
                    Messages
                  </button>

                  <button
                    onClick={() => {
                      const content = exportToMarkdown();
                      const mailtoLink = `mailto:?subject=War Room Session&body=${encodeURIComponent(content)}`;
                      window.location.href = mailtoLink;
                      setShowExportModal(false);
                    }}
                    className="px-4 py-3 rounded-xl text-sm flex items-center justify-center transition-colors"
                    style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)', color: 'var(--pulse-ink)' }}
                  >
                    <Mail size={14} className="mr-2" style={{ color: 'var(--pulse-ink-3)' }} />
                    Email
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OpenAI Realtime Voice Agent Panel — floating (legacy path only).
          When dockVoiceInline is set, DockedVoice renders this inline in ChatPane. */}
      {showVoiceAgentPanel && !dockVoiceInline && (
        <div
          className={`fixed z-50 ${
            voiceAgentExpanded
              ? 'inset-2 md:inset-4'
              : 'bottom-2 right-2 left-2 md:left-auto md:bottom-4 md:right-4 md:w-full md:max-w-md'
          }`}
        >
          <ErrorBoundary
            componentName="Voice Agent"
            fallback={
              <div className="bg-gray-900/95 backdrop-blur-xl border border-red-500/30 rounded-xl p-6 text-center">
                <MicOff size={36} className="text-red-500 mb-3 mx-auto" />
                <p className="text-white font-medium mb-2">Voice Agent Unavailable</p>
                <p className="text-gray-400 text-sm mb-4">
                  {isMobilePlatform
                    ? 'Voice features may not be fully supported on this device.'
                    : 'The voice agent encountered an error.'}
                </p>
                <button
                  onClick={() => setShowVoiceAgentPanel(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                >
                  Close
                </button>
              </div>
            }
          >
            <Suspense fallback={<LoadingFallback message="Loading Voice Agent..." />}>
              <VoiceAgentPanel
                userId={userId}
                projectId={selectedProjectId || undefined}
                sessionId={selectedSessionId || undefined}
                openaiApiKey={openaiApiKey}
                workspaceId={workspaceId}
                onClose={() => setShowVoiceAgentPanel(false)}
                isExpanded={voiceAgentExpanded}
                onToggleExpand={() => setVoiceAgentExpanded(!voiceAgentExpanded)}
                documents={documents}
                activeContextIds={activeContextDocs}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <DocumentViewer
          doc={viewingDoc}
          userId={userId}
          onClose={() => {
            setViewingDoc(null);
            setViewerHighlightText(undefined);
            setViewerScrollOffset(undefined);
          }}
          highlightText={viewerHighlightText}
          scrollToOffset={viewerScrollOffset}
        />
      )}

      {/* Content Generator Modals */}
      {showStudyGuide && (
        <StudyGuideGenerator
          documents={documents}
          activeContextIds={activeContextDocs}
          apiKey={apiKey}
          onClose={() => setShowStudyGuide(false)}
        />
      )}

      {showFAQ && (
        <FAQGenerator
          documents={documents}
          activeContextIds={activeContextDocs}
          apiKey={apiKey}
          onClose={() => setShowFAQ(false)}
        />
      )}

      {showTimeline && (
        <TimelineGenerator
          documents={documents}
          activeContextIds={activeContextDocs}
          apiKey={apiKey}
          onClose={() => setShowTimeline(false)}
        />
      )}

      {showPodcast && (
        <PodcastGenerator
          documents={documents}
          activeContextIds={activeContextDocs}
          apiKey={apiKey}
          onClose={() => setShowPodcast(false)}
        />
      )}

      {/* Advanced AI Panel */}
      {showAdvancedAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-6xl h-[85vh]">
            <AdvancedAIPanel
              documents={documents.filter(
                d => activeContextDocs.has(d.id) || activeContextDocs.size === 0
              )}
              apiKey={apiKey}
              initialView={advancedAIView}
              onClose={() => setShowAdvancedAI(false)}
            />
          </div>
        </div>
      )}

      {/* Organization Sidebar (Floating) */}
      {showOrganize && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/50"
            onClick={() => {
              setShowOrganize(false);
              setOrganizingDocId(undefined);
            }}
          />
          {/* Sidebar */}
          <OrganizationSidebar
            userId={userId}
            documents={documents.map(d => ({ id: d.id, title: d.title, file_type: d.file_type }))}
            selectedDocId={organizingDocId}
            onDocumentClick={(docId) => {
              const doc = documents.find(d => d.id === docId);
              if (doc && doc.text_content) {
                setViewingDoc(doc);
                setShowOrganize(false);
                setOrganizingDocId(undefined);
                recordDocumentView(userId, docId).catch(console.error);
              }
            }}
            onClose={() => {
              setShowOrganize(false);
              setOrganizingDocId(undefined);
            }}
          />
        </div>
      )}

      {/* Knowledge Bank Modal - Full Document Browser */}
      {showKnowledgeBank && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in" style={{ background: 'var(--pulse-surface-modal)', border: '1px solid var(--pulse-border)' }}>
            {/* Header */}
            <div className="p-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}
                >
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>Knowledge Bank</h2>
                  <p className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                    {documents.length} documents &bull; {activeContextDocs.size} active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="war-room-btn-primary flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer">
                  <Plus size={16} />
                  <span>Upload</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".txt,.md,.json,.pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.bmp,.webp"
                  />
                </label>
                <button
                  onClick={() => setShowKnowledgeBank(false)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--pulse-ink-3)' }}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 shrink-0" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
              <DocumentSearch
                documents={documents}
                activeContextIds={activeContextDocs}
                onResultClick={(doc, highlightText, offset) => {
                  setViewingDoc(doc);
                  setViewerHighlightText(highlightText);
                  setViewerScrollOffset(offset);
                }}
              />
            </div>

            {/* Document Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {documents.length === 0 ? (
                <div className="text-center py-16" style={{ color: 'var(--pulse-ink-3)' }}>
                  <FolderOpen size={48} className="mb-4 mx-auto" />
                  <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--pulse-ink)' }}>No documents yet</h3>
                  <p className="text-sm">
                    Upload PDFs, Word docs, images, or text files to build your knowledge base.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => {
                    const isInContext = activeContextDocs.has(doc.id);
                    return (
                      <div
                        key={doc.id}
                        className="rounded-xl p-4 transition-all"
                        style={isInContext
                          ? { background: 'var(--pulse-coral-bg-08)', border: '1px solid var(--pulse-rose-soft)' }
                          : { background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: 'var(--pulse-surface)', color: 'var(--pulse-ink-2)' }}
                            >
                              <FileTypeIcon fileType={doc.file_type} size={15} />
                            </div>
                            <div>
                              <h4 className="font-medium text-sm truncate max-w-[150px]" style={{ color: 'var(--pulse-ink)' }}>
                                {doc.title}
                              </h4>
                              <p className="text-[10px] uppercase" style={{ fontFamily: 'var(--pulse-font-mono)', letterSpacing: '0.08em', color: 'var(--pulse-ink-3)' }}>
                                {doc.file_type || 'Document'}
                              </p>
                            </div>
                          </div>
                          {doc.processing_status === 'processing' ? (
                            <Loader2 size={16} className="text-yellow-400 animate-spin" />
                          ) : doc.processing_status === 'failed' ? (
                            <AlertTriangle size={16} className="text-red-400" />
                          ) : (
                            <button
                              onClick={() => toggleDocInContext(doc.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                              style={isInContext
                                ? { background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }
                                : { background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-3)' }}
                              aria-label={isInContext ? 'Remove from AI context' : 'Add to AI context'}
                            >
                              {isInContext ? <Check size={14} /> : <Plus size={14} />}
                            </button>
                          )}
                        </div>

                        {doc.ai_summary && (
                          <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--pulse-ink-3)' }}>
                            {stripMarkdownForPreview(doc.ai_summary)}
                          </p>
                        )}

                        {doc.ai_keywords && doc.ai_keywords.length > 0 && (() => {
                          // Strip markdown, filter out malformed entries (the AI sometimes
                          // emits whole sentences instead of keywords).
                          const cleaned = doc.ai_keywords
                            .map((k) => stripMarkdownForPreview(k))
                            .filter((k) => k.length > 0 && k.length <= 40 && !/\s{2,}|[.!?]/.test(k))
                            .slice(0, 4);
                          if (cleaned.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {cleaned.map((keyword, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-2 py-0.5 rounded-full"
                                  style={{ background: 'var(--pulse-surface)', color: 'var(--pulse-ink-3)' }}
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          );
                        })()}

                        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--pulse-border)' }}>
                          <button
                            onClick={() => {
                              setViewingDoc(doc);
                              setViewerHighlightText(undefined);
                              setViewerScrollOffset(undefined);
                            }}
                            className="flex-1 text-xs py-1.5 rounded transition-colors inline-flex items-center justify-center"
                            style={{ color: 'var(--pulse-ink-3)' }}
                          >
                            <Eye size={12} className="mr-1" /> View
                          </button>
                          <button
                            onClick={() => {
                              setOrganizingDocId(doc.id);
                              setShowOrganize(true);
                            }}
                            className="flex-1 text-xs py-1.5 rounded transition-colors inline-flex items-center justify-center"
                            style={{ color: 'var(--pulse-ink-3)' }}
                          >
                            <Tags size={12} className="mr-1" /> Organize
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="text-xs py-1.5 px-2 rounded transition-colors"
                            style={{ color: '#ef4444' }}
                            aria-label="Delete document"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid var(--pulse-border)' }}>
              <div className="text-sm inline-flex items-center gap-1.5" style={{ color: 'var(--pulse-ink-3)' }}>
                <Info size={14} />
                <span>Click</span>
                <Plus size={14} className="inline-block" />
                <span>to add documents to context</span>
              </div>
              <button
                onClick={() => setShowKnowledgeBank(false)}
                className="war-room-btn-primary px-6 py-2 rounded-lg font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && sharingDoc && (
        <ShareModal
          type="document"
          resourceId={sharingDoc.id}
          resourceTitle={sharingDoc.title}
          userId={userId}
          onClose={() => {
            setShowShareModal(false);
            setSharingDoc(null);
          }}
        />
      )}
    </>
  );
});

WarRoomModalStack.displayName = 'WarRoomModalStack';
