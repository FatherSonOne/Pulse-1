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
import {
  AlertTriangle,
  BookOpen,
  Clipboard,
  Code,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  Mail,
  MessageSquare,
  MicOff,
  Plus,
  Share2,
  Sparkles,
  Tags,
  Trash2,
  X,
} from 'lucide-react';

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
      <Loader2 className="fa text-2xl text-rose-500 mb-2 animate-spin" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  </div>
);

export interface WarRoomModalStackProps {
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

  return (
    <>
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-2xl war-room-modal rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">
                <Share2 className="fa mr-2" />
                Export Session
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-800/50 rounded-full transition-colors text-gray-600 dark:text-gray-400"
              >
                <X className="fa text-xl" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Markdown Export */}
              <button
                onClick={() => {
                  handleExport('markdown');
                  setShowExportModal(false);
                }}
                className="w-full p-4 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-600/20 dark:to-cyan-600/20 border border-blue-200 dark:border-blue-500/30 rounded-2xl hover:border-blue-400 text-left group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition text-blue-600 dark:text-white">
                    <FileText className="fa" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-lg text-gray-900 dark:text-white">Export as Markdown</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Download full conversation as .md file</div>
                  </div>
                  <Download className="fa text-blue-400" />
                </div>
              </button>

              {/* JSON Export */}
              <button
                onClick={() => {
                  handleExport('json');
                  setShowExportModal(false);
                }}
                className="w-full p-4 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-600/20 dark:to-pink-600/20 border border-purple-200 dark:border-purple-500/30 rounded-2xl hover:border-purple-400 text-left group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition text-purple-600 dark:text-white">
                    <Code className="fa" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-lg text-gray-900 dark:text-white">Export as JSON</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Structured data for integrations</div>
                  </div>
                  <Download className="fa text-purple-400" />
                </div>
              </button>

              {/* AI Summary */}
              <button
                onClick={() => {
                  handleExport('summary');
                  setShowExportModal(false);
                }}
                className="w-full p-4 bg-gradient-to-br from-rose-50/50 to-pink-50/50 dark:from-rose-600/20 dark:to-pink-600/20 border border-rose-200 dark:border-rose-500/30 rounded-2xl hover:border-rose-400 text-left group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-rose-100 dark:bg-rose-600 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition text-rose-600 dark:text-white">
                    <Sparkles className="fa" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-lg text-gray-900 dark:text-white">Generate AI Summary</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Key points & action items (copies to clipboard)</div>
                  </div>
                  <Clipboard className="fa text-rose-400" />
                </div>
              </button>

              {/* Share Options */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">Share to:</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const content = exportToMarkdown();
                      navigator.clipboard.writeText(content);
                      toast.success('Copied to clipboard! Paste in Messages app');
                      setShowExportModal(false);
                    }}
                    className="px-4 py-3 bg-green-50 dark:bg-green-600/20 border border-green-200 dark:border-green-500/30 rounded-xl hover:bg-green-100 dark:hover:bg-green-600/30 text-sm flex items-center justify-center text-gray-700 dark:text-white transition-colors"
                  >
                    <MessageSquare className="fa mr-2 text-green-600 dark:text-green-400" />
                    Messages
                  </button>

                  <button
                    onClick={() => {
                      const content = exportToMarkdown();
                      const mailtoLink = `mailto:?subject=Studio Session&body=${encodeURIComponent(content)}`;
                      window.location.href = mailtoLink;
                      setShowExportModal(false);
                    }}
                    className="px-4 py-3 bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-600/30 text-sm flex items-center justify-center text-gray-700 dark:text-white transition-colors"
                  >
                    <Mail className="fa mr-2 text-blue-600 dark:text-blue-400" />
                    Email
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OpenAI Realtime Voice Agent Panel */}
      {showVoiceAgentPanel && (
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
                <MicOff className="fa text-3xl text-red-500 mb-3" />
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
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-700 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <BookOpen className="fa text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Knowledge Bank</h2>
                  <p className="text-xs text-zinc-400">
                    {documents.length} documents &bull; {activeContextDocs.size} active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg cursor-pointer transition-colors">
                  <Plus className="fa" />
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
                  className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="fa text-lg" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-zinc-800 shrink-0">
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
                <div className="text-center py-16 text-zinc-500">
                  <FolderOpen className="fa text-5xl mb-4 block" />
                  <h3 className="text-lg font-medium text-white mb-2">No Documents Yet</h3>
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
                        className={`rounded-xl border p-4 transition-all hover:shadow-lg ${
                          isInContext
                            ? 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10'
                            : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                doc.file_type === 'pdf'
                                  ? 'bg-red-500/20 text-red-400'
                                  : doc.file_type === 'docx'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : doc.file_type === 'xlsx'
                                  ? 'bg-green-500/20 text-green-400'
                                  : doc.file_type?.startsWith('image')
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-zinc-700 text-zinc-400'
                              }`}
                            >
                              <i
                                className={`fa ${
                                  doc.file_type === 'pdf'
                                    ? 'fa-file-pdf'
                                    : doc.file_type === 'docx'
                                    ? 'fa-file-word'
                                    : doc.file_type === 'xlsx'
                                    ? 'fa-file-excel'
                                    : doc.file_type?.startsWith('image')
                                    ? 'fa-file-image'
                                    : 'fa-file-alt'
                                } text-sm`}
                              ></i>
                            </div>
                            <div>
                              <h4 className="font-medium text-white text-sm truncate max-w-[150px]">
                                {doc.title}
                              </h4>
                              <p className="text-[10px] text-zinc-500 uppercase">
                                {doc.file_type || 'Document'}
                              </p>
                            </div>
                          </div>
                          {doc.processing_status === 'processing' ? (
                            <Loader2 className="fa text-yellow-400 animate-spin" />
                          ) : doc.processing_status === 'failed' ? (
                            <AlertTriangle className="fa text-red-400" />
                          ) : (
                            <button
                              onClick={() => toggleDocInContext(doc.id)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                isInContext
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-zinc-700 text-zinc-400 hover:bg-rose-500 hover:text-white'
                              }`}
                            >
                              <i className={`fa ${isInContext ? 'fa-check' : 'fa-plus'}`}></i>
                            </button>
                          )}
                        </div>

                        {doc.ai_summary && (
                          <p className="text-xs text-zinc-400 line-clamp-2 mb-3">{doc.ai_summary}</p>
                        )}

                        {doc.ai_keywords && doc.ai_keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {doc.ai_keywords.slice(0, 4).map((keyword, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 bg-zinc-700/50 text-zinc-400 rounded-full"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2 border-t border-zinc-700/50">
                          <button
                            onClick={() => {
                              setViewingDoc(doc);
                              setViewerHighlightText(undefined);
                              setViewerScrollOffset(undefined);
                            }}
                            className="flex-1 text-xs py-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                          >
                            <Eye className="fa mr-1" /> View
                          </button>
                          <button
                            onClick={() => {
                              setOrganizingDocId(doc.id);
                              setShowOrganize(true);
                            }}
                            className="flex-1 text-xs py-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                          >
                            <Tags className="fa mr-1" /> Organize
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="text-xs py-1.5 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <Trash2 className="fa" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-700 flex items-center justify-between shrink-0">
              <div className="text-sm text-zinc-400">
                <Info className="fa mr-1" />
                Click <Plus className="fa mx-1" /> to add documents to context
              </div>
              <button
                onClick={() => setShowKnowledgeBank(false)}
                className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-rose-500/30 transition-all"
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
