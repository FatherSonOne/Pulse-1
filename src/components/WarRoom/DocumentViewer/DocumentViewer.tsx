import React, { useState, useEffect, useRef, useCallback } from 'react';
import { KnowledgeDoc } from '../../../services/ragService';
import toast from 'react-hot-toast';
import './DocumentViewer.css';
import {
  Highlight,
  Annotation,
  CreateHighlightPayload,
  CreateAnnotationPayload,
  HighlightColor,
  HIGHLIGHT_COLORS,
} from '../../../types/annotations';
import * as annotationService from '../../../services/annotationService';
import { HighlightPopup, AnnotationPopup, AnnotationsSidebar } from '../Annotations';

interface DocumentViewerProps {
  doc: KnowledgeDoc;
  onClose: () => void;
  highlightText?: string;
  scrollToOffset?: number;
  userId?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  doc,
  onClose,
  highlightText,
  scrollToOffset,
  userId
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Annotations state
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showAnnotationsSidebar, setShowAnnotationsSidebar] = useState(false);
  const [highlightPopup, setHighlightPopup] = useState<{
    selectedText: string;
    position: { x: number; y: number };
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const [annotationPopup, setAnnotationPopup] = useState<{
    position: { offset: number };
    screenPosition: { x: number; y: number };
  } | null>(null);

  // Get document content
  const content = doc.text_content || doc.ai_summary || 'No content available';

  // Load highlights and annotations
  useEffect(() => {
    if (userId && doc.id) {
      loadAnnotations();
    }
  }, [userId, doc.id]);

  const loadAnnotations = async () => {
    try {
      const [highlightsData, annotationsData] = await Promise.all([
        annotationService.getDocumentHighlights(doc.id),
        annotationService.getDocumentAnnotations(doc.id),
      ]);
      setHighlights(highlightsData);
      setAnnotations(annotationsData);
    } catch (error) {
      console.error('Error loading annotations:', error);
    }
  };

  // Handle text selection for highlighting
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !userId) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length < 3) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate offset within the document content
    const contentEl = contentRef.current;
    if (!contentEl) return;

    // Simple offset calculation based on text position
    const fullText = contentEl.textContent || '';
    const startOffset = fullText.indexOf(selectedText);
    const endOffset = startOffset + selectedText.length;

    setHighlightPopup({
      selectedText,
      position: { x: rect.left, y: rect.bottom },
      startOffset,
      endOffset,
    });
  }, [userId]);

  // Handle creating a highlight
  const handleCreateHighlight = async (payload: Omit<CreateHighlightPayload, 'doc_id'>) => {
    if (!userId || !highlightPopup) return;

    try {
      const newHighlight = await annotationService.createHighlight(userId, {
        doc_id: doc.id,
        start_offset: highlightPopup.startOffset,
        end_offset: highlightPopup.endOffset,
        highlighted_text: highlightPopup.selectedText,
        color: payload.color,
        note: payload.note,
        tags: payload.tags,
      });
      setHighlights([...highlights, newHighlight]);
      setHighlightPopup(null);
      window.getSelection()?.removeAllRanges();
      toast.success('Highlight created');
    } catch (error) {
      toast.error('Failed to create highlight');
    }
  };

  // Handle creating an annotation
  const handleCreateAnnotation = async (payload: Omit<CreateAnnotationPayload, 'doc_id'>) => {
    if (!userId || !annotationPopup) return;

    try {
      const newAnnotation = await annotationService.createAnnotation(userId, {
        doc_id: doc.id,
        position: annotationPopup.position,
        content: payload.content,
        type: payload.type,
        tags: payload.tags,
      });
      setAnnotations([...annotations, newAnnotation]);
      setAnnotationPopup(null);
      toast.success('Annotation added');
    } catch (error) {
      toast.error('Failed to add annotation');
    }
  };

  // Handle highlight actions
  const handleHighlightDelete = async (id: string) => {
    try {
      await annotationService.deleteHighlight(id);
      setHighlights(highlights.filter((h) => h.id !== id));
      toast.success('Highlight deleted');
    } catch (error) {
      toast.error('Failed to delete highlight');
    }
  };

  const handleHighlightUpdate = async (id: string, updates: { color?: HighlightColor; note?: string }) => {
    try {
      const updated = await annotationService.updateHighlight(id, updates);
      setHighlights(highlights.map((h) => (h.id === id ? updated : h)));
    } catch (error) {
      toast.error('Failed to update highlight');
    }
  };

  // Handle annotation actions
  const handleAnnotationDelete = async (id: string) => {
    try {
      await annotationService.deleteAnnotation(id);
      setAnnotations(annotations.filter((a) => a.id !== id));
      toast.success('Annotation deleted');
    } catch (error) {
      toast.error('Failed to delete annotation');
    }
  };

  const handleAnnotationToggleResolved = async (id: string) => {
    try {
      const updated = await annotationService.toggleAnnotationResolved(id);
      setAnnotations(annotations.map((a) => (a.id === id ? updated : a)));
    } catch (error) {
      toast.error('Failed to update annotation');
    }
  };

  const handleAnnotationReply = async (annotationId: string, content: string) => {
    if (!userId) return;
    try {
      const reply = await annotationService.createReply(userId, { annotation_id: annotationId, content });
      setAnnotations(annotations.map((a) => {
        if (a.id === annotationId) {
          return {
            ...a,
            replies: [...(a.replies || []), reply],
            reply_count: (a.reply_count || 0) + 1,
          };
        }
        return a;
      }));
    } catch (error) {
      toast.error('Failed to add reply');
    }
  };

  // Handle export
  const handleExportAnnotations = (type: 'highlights' | 'annotations' | 'all') => {
    let content = '';
    if (type === 'highlights' || type === 'all') {
      content += annotationService.exportHighlightsAsMarkdown(highlights, doc.title);
    }
    if (type === 'annotations' || type === 'all') {
      content += annotationService.exportAnnotationsAsMarkdown(annotations, doc.title);
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}-annotations.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Annotations exported');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
        } else {
          onClose();
        }
      }
      // Ctrl/Cmd + F to search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      // Ctrl/Cmd + P to print
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
      // Navigate search results with Enter
      if (e.key === 'Enter' && showSearch && searchMatches.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          navigateMatch(-1);
        } else {
          navigateMatch(1);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showSearch, searchMatches.length]);

  // Scroll to offset when provided
  useEffect(() => {
    if (scrollToOffset !== undefined && contentRef.current) {
      // Find approximate position based on character offset
      const textContent = contentRef.current.textContent || '';
      const ratio = scrollToOffset / textContent.length;
      const scrollTop = contentRef.current.scrollHeight * ratio;
      contentRef.current.scrollTo({ top: Math.max(0, scrollTop - 100), behavior: 'smooth' });
    }
  }, [scrollToOffset]);

  // Search within document
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const regex = new RegExp(escapeRegex(searchQuery), 'gi');
      const matches: number[] = [];
      let match;
      while ((match = regex.exec(content)) !== null) {
        matches.push(match.index);
      }
      setSearchMatches(matches);
      setCurrentMatchIndex(0);
    } else {
      setSearchMatches([]);
    }
  }, [searchQuery, content]);

  // Scroll to current match
  useEffect(() => {
    if (searchMatches.length > 0 && contentRef.current) {
      const marks = contentRef.current.querySelectorAll('mark.current-match');
      if (marks.length > 0) {
        marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIndex, searchMatches]);

  const navigateMatch = (direction: number) => {
    if (searchMatches.length === 0) return;
    let newIndex = currentMatchIndex + direction;
    if (newIndex < 0) newIndex = searchMatches.length - 1;
    if (newIndex >= searchMatches.length) newIndex = 0;
    setCurrentMatchIndex(newIndex);
  };

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Content copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy content');
    }
  }, [content]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${doc.title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; line-height: 1.6; }
            h1 { font-size: 24px; margin-bottom: 20px; }
            .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
            .content { white-space: pre-wrap; font-size: 14px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>${doc.title}</h1>
          <div class="meta">
            Type: ${doc.file_type || 'text'} |
            Uploaded: ${new Date(doc.created_at).toLocaleDateString()}
          </div>
          <div class="content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [doc, content]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Document downloaded');
  }, [content, doc.title]);

  // Highlight text in content with user highlights
  const renderContent = () => {
    let displayContent = content;

    // If we have a highlight text from search result click
    const textToHighlight = highlightText || (searchQuery.length >= 2 ? searchQuery : null);

    if (textToHighlight) {
      const regex = new RegExp(`(${escapeRegex(textToHighlight)})`, 'gi');
      const parts = displayContent.split(regex);
      let matchCount = 0;

      return parts.map((part, i) => {
        if (regex.test(part)) {
          const isCurrentMatch = matchCount === currentMatchIndex;
          matchCount++;
          return (
            <mark
              key={i}
              className={`doc-viewer-highlight ${isCurrentMatch ? 'current-match' : ''}`}
            >
              {part}
            </mark>
          );
        }
        return part;
      });
    }

    // Apply user highlights
    if (highlights.length > 0) {
      // Sort highlights by start offset (descending) to apply from end to start
      const sortedHighlights = [...highlights].sort((a, b) => b.start_offset - a.start_offset);

      // Build content with highlights
      let result: React.ReactNode[] = [];
      let lastIndex = 0;
      let contentArray: { text: string; highlight?: Highlight }[] = [];

      // Sort by start offset (ascending) for building the content array
      const ascHighlights = [...highlights].sort((a, b) => a.start_offset - b.start_offset);

      for (const h of ascHighlights) {
        // Add text before this highlight
        if (h.start_offset > lastIndex) {
          contentArray.push({ text: displayContent.slice(lastIndex, h.start_offset) });
        }
        // Add highlighted text
        contentArray.push({
          text: displayContent.slice(h.start_offset, h.end_offset),
          highlight: h,
        });
        lastIndex = h.end_offset;
      }

      // Add remaining text
      if (lastIndex < displayContent.length) {
        contentArray.push({ text: displayContent.slice(lastIndex) });
      }

      return contentArray.map((item, i) => {
        if (item.highlight) {
          const colors = HIGHLIGHT_COLORS[item.highlight.color];
          return (
            <mark
              key={i}
              className={`user-highlight ${colors.bg} border-b-2 ${colors.border} cursor-pointer transition-all hover:opacity-80`}
              title={item.highlight.note || `Highlight: ${item.highlight.color}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowAnnotationsSidebar(true);
              }}
            >
              {item.text}
            </mark>
          );
        }
        return <span key={i}>{item.text}</span>;
      });
    }

    return displayContent;
  };

  // Get file type icon
  const getFileIcon = () => {
    const type = doc.file_type?.toLowerCase() || 'text';
    switch (type) {
      case 'pdf': return 'fa-file-pdf';
      case 'docx':
      case 'doc': return 'fa-file-word';
      case 'xlsx':
      case 'xls': return 'fa-file-excel';
      case 'md':
      case 'markdown': return 'fa-file-code';
      case 'json': return 'fa-file-code';
      case 'image':
      case 'png':
      case 'jpg':
      case 'jpeg': return 'fa-file-image';
      default: return 'fa-file-alt';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="war-room-modal w-full max-w-4xl mx-4 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="doc-viewer-header p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-rose-500/20 rounded-lg flex items-center justify-center shrink-0">
              <i className={`fa ${getFileIcon()} text-rose-400`}></i>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold truncate" title={doc.title}>
                {doc.title}
              </h3>
              <p className="text-xs war-room-text-secondary">
                {doc.file_type || 'text'} | {new Date(doc.created_at).toLocaleDateString()}
                {doc.ai_keywords && doc.ai_keywords.length > 0 && (
                  <span className="ml-2">| {doc.ai_keywords.slice(0, 3).join(', ')}</span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`war-room-btn war-room-btn-icon-sm ${showSearch ? 'war-room-btn-primary' : ''}`}
              title="Search (Ctrl+F)"
            >
              <i className="fa fa-search"></i>
            </button>

            {/* Annotations toggle */}
            {userId && (
              <button
                onClick={() => setShowAnnotationsSidebar(!showAnnotationsSidebar)}
                className={`war-room-btn war-room-btn-icon-sm relative ${showAnnotationsSidebar ? 'war-room-btn-primary' : ''}`}
                title="Annotations & Highlights"
              >
                <i className="fa fa-highlighter"></i>
                {(highlights.length > 0 || annotations.length > 0) && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[10px] text-white flex items-center justify-center">
                    {highlights.length + annotations.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={handleCopy}
              className="war-room-btn war-room-btn-icon-sm"
              title="Copy content"
            >
              <i className="fa fa-copy"></i>
            </button>
            <button
              onClick={handleDownload}
              className="war-room-btn war-room-btn-icon-sm"
              title="Download"
            >
              <i className="fa fa-download"></i>
            </button>
            <button
              onClick={handlePrint}
              className="war-room-btn war-room-btn-icon-sm"
              title="Print (Ctrl+P)"
            >
              <i className="fa fa-print"></i>
            </button>
            <button
              onClick={onClose}
              className="war-room-btn war-room-btn-icon-sm"
              title="Close (Esc)"
            >
              <i className="fa fa-times"></i>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="p-3 border-b border-white/10 flex items-center gap-3 bg-white/5 shrink-0">
            <div className="relative flex-1">
              <i className="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 war-room-text-secondary text-sm"></i>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in document..."
                className="war-room-input pl-10 pr-20 text-sm"
                autoFocus
              />
              {searchMatches.length > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs war-room-text-secondary">
                  {currentMatchIndex + 1} / {searchMatches.length}
                </span>
              )}
            </div>
            <button
              onClick={() => navigateMatch(-1)}
              disabled={searchMatches.length === 0}
              className="war-room-btn war-room-btn-icon-sm"
              title="Previous (Shift+Enter)"
            >
              <i className="fa fa-chevron-up"></i>
            </button>
            <button
              onClick={() => navigateMatch(1)}
              disabled={searchMatches.length === 0}
              className="war-room-btn war-room-btn-icon-sm"
              title="Next (Enter)"
            >
              <i className="fa fa-chevron-down"></i>
            </button>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="war-room-btn war-room-btn-icon-sm"
            >
              <i className="fa fa-times"></i>
            </button>
          </div>
        )}

        {/* AI Summary (if available) */}
        {doc.ai_summary && doc.text_content && (
          <div className="p-3 border-b border-white/10 bg-rose-500/5 shrink-0">
            <div className="flex items-start gap-2">
              <i className="fa fa-sparkles text-rose-400 mt-0.5 text-sm"></i>
              <div>
                <div className="text-xs font-semibold text-rose-400 mb-1">AI Summary</div>
                <p className="text-sm war-room-text-secondary line-clamp-3">{doc.ai_summary}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main content area with optional sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Content */}
          <div
            ref={contentRef}
            className={`flex-1 overflow-y-auto p-6 war-room-scrollbar doc-viewer-content ${
              showAnnotationsSidebar ? 'border-r border-white/10' : ''
            }`}
            onMouseUp={userId ? handleTextSelection : undefined}
          >
            {/* Tip for highlighting */}
            {userId && highlights.length === 0 && annotations.length === 0 && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm">
                <i className="fa fa-lightbulb text-rose-400 mr-2"></i>
                <span className="text-rose-300">
                  Tip: Select text to create highlights, or click the highlighter icon to view annotations.
                </span>
              </div>
            )}

            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {renderContent()}
            </pre>
          </div>

          {/* Annotations Sidebar */}
          {showAnnotationsSidebar && userId && (
            <div className="w-80 shrink-0">
              <AnnotationsSidebar
                highlights={highlights}
                annotations={annotations}
                onHighlightClick={(h) => {
                  // Scroll to highlight position
                  if (contentRef.current) {
                    const ratio = h.start_offset / content.length;
                    const scrollTop = contentRef.current.scrollHeight * ratio;
                    contentRef.current.scrollTo({ top: Math.max(0, scrollTop - 100), behavior: 'smooth' });
                  }
                }}
                onHighlightDelete={handleHighlightDelete}
                onHighlightUpdate={handleHighlightUpdate}
                onAnnotationClick={(a) => {
                  // Scroll to annotation position
                  if (contentRef.current && a.position.offset) {
                    const ratio = a.position.offset / content.length;
                    const scrollTop = contentRef.current.scrollHeight * ratio;
                    contentRef.current.scrollTo({ top: Math.max(0, scrollTop - 100), behavior: 'smooth' });
                  }
                }}
                onAnnotationDelete={handleAnnotationDelete}
                onAnnotationToggleResolved={handleAnnotationToggleResolved}
                onAnnotationReply={handleAnnotationReply}
                onExport={handleExportAnnotations}
                onClose={() => setShowAnnotationsSidebar(false)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs war-room-text-secondary shrink-0">
          <div className="flex items-center gap-4">
            <span>
              <i className="fa fa-file-lines mr-1"></i>
              {content.length.toLocaleString()} characters
            </span>
            <span>
              <i className="fa fa-align-left mr-1"></i>
              {content.split(/\s+/).filter(Boolean).length.toLocaleString()} words
            </span>
            {(highlights.length > 0 || annotations.length > 0) && (
              <span>
                <i className="fa fa-highlighter mr-1 text-rose-400"></i>
                {highlights.length} highlights, {annotations.length} notes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">Esc to close</span>
            <span className="text-xs">| Ctrl+F search</span>
            {userId && <span className="text-xs">| Select text to highlight</span>}
          </div>
        </div>
      </div>

      {/* Highlight Popup */}
      {highlightPopup && (
        <HighlightPopup
          selectedText={highlightPopup.selectedText}
          position={highlightPopup.position}
          onCreateHighlight={handleCreateHighlight}
          onClose={() => {
            setHighlightPopup(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}

      {/* Annotation Popup */}
      {annotationPopup && (
        <AnnotationPopup
          position={annotationPopup.position}
          screenPosition={annotationPopup.screenPosition}
          onCreateAnnotation={handleCreateAnnotation}
          onClose={() => setAnnotationPopup(null)}
        />
      )}
    </div>
  );
};

// Utility function to escape regex special characters
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default DocumentViewer;
