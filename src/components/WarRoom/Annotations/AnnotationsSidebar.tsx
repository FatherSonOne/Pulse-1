/**
 * Annotations Sidebar Component
 * Shows all highlights and annotations for the current document
 */

import React, { useState, useMemo } from 'react';
import {
  Highlight,
  Annotation,
  HighlightColor,
  AnnotationType,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLORS_DARK,
  ANNOTATION_TYPES,
} from '../../../types/annotations';
import { AnnotationReplyThread } from './AnnotationReplyThread';

interface AnnotationsSidebarProps {
  highlights: Highlight[];
  annotations: Annotation[];
  onHighlightClick: (highlight: Highlight) => void;
  onHighlightDelete: (id: string) => void;
  onHighlightUpdate: (id: string, updates: { color?: HighlightColor; note?: string }) => void;
  onAnnotationClick: (annotation: Annotation) => void;
  onAnnotationDelete: (id: string) => void;
  onAnnotationToggleResolved: (id: string) => void;
  onAnnotationReply: (annotationId: string, content: string) => void;
  onExport: (type: 'highlights' | 'annotations' | 'all') => void;
  onClose: () => void;
}

type TabType = 'all' | 'highlights' | 'annotations';
type AnnotationFilter = 'all' | AnnotationType | 'resolved' | 'unresolved';

export const AnnotationsSidebar: React.FC<AnnotationsSidebarProps> = ({
  highlights,
  annotations,
  onHighlightClick,
  onHighlightDelete,
  onHighlightUpdate,
  onAnnotationClick,
  onAnnotationDelete,
  onAnnotationToggleResolved,
  onAnnotationReply,
  onExport,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [annotationFilter, setAnnotationFilter] = useState<AnnotationFilter>('all');
  const [expandedAnnotation, setExpandedAnnotation] = useState<string | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<string | null>(null);

  // Filter annotations based on selected filter
  const filteredAnnotations = useMemo(() => {
    return annotations.filter((a) => {
      switch (annotationFilter) {
        case 'resolved':
          return a.resolved;
        case 'unresolved':
          return !a.resolved;
        case 'all':
          return true;
        default:
          return a.type === annotationFilter;
      }
    });
  }, [annotations, annotationFilter]);

  // Combined list for "All" tab
  const combinedItems = useMemo(() => {
    const items: Array<{ type: 'highlight' | 'annotation'; item: Highlight | Annotation; date: Date }> = [];

    highlights.forEach((h) => {
      items.push({ type: 'highlight', item: h, date: new Date(h.created_at) });
    });

    filteredAnnotations.forEach((a) => {
      items.push({ type: 'annotation', item: a, date: new Date(a.created_at) });
    });

    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [highlights, filteredAnnotations]);

  const renderHighlight = (highlight: Highlight, isEditing: boolean) => {
    const colors = HIGHLIGHT_COLORS[highlight.color];
    const darkColors = HIGHLIGHT_COLORS_DARK[highlight.color];

    return (
      <div
        key={highlight.id}
        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${colors.bg} dark:${darkColors.bg} ${colors.border} dark:${darkColors.border}`}
        onClick={() => !isEditing && onHighlightClick(highlight)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${colors.text} dark:${darkColors.text} line-clamp-3`}>
              "{highlight.highlighted_text}"
            </p>

            {highlight.note && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 italic">
                <i className="fa fa-sticky-note mr-1"></i>
                {highlight.note}
              </p>
            )}

            {highlight.tags && highlight.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {highlight.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 bg-white/50 dark:bg-black/20 rounded text-[10px] text-gray-600 dark:text-gray-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingHighlight(isEditing ? null : highlight.id);
              }}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Edit highlight"
            >
              <i className="fa fa-pen text-xs"></i>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHighlightDelete(highlight.id);
              }}
              className="p-1 text-red-500 hover:text-red-700"
              title="Delete highlight"
            >
              <i className="fa fa-trash text-xs"></i>
            </button>
          </div>
        </div>

        {/* Color editor */}
        {isEditing && (
          <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Color:</span>
              {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    onHighlightUpdate(highlight.id, { color });
                    setEditingHighlight(null);
                  }}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                    HIGHLIGHT_COLORS[color].bg
                  } border ${
                    highlight.color === color ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className="mt-2 text-[10px] text-gray-400">
          {new Date(highlight.created_at).toLocaleDateString()}
        </p>
      </div>
    );
  };

  const renderAnnotation = (annotation: Annotation) => {
    const config = ANNOTATION_TYPES[annotation.type];
    const isExpanded = expandedAnnotation === annotation.id;

    return (
      <div
        key={annotation.id}
        className={`p-3 rounded-lg border transition-all ${
          annotation.resolved
            ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-70'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md'
        }`}
      >
        <div className="flex items-start gap-2">
          {/* Type icon */}
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              annotation.resolved ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            <i className={`fa ${config.icon} ${annotation.resolved ? 'text-gray-400' : config.color}`}></i>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${annotation.resolved ? 'text-gray-400' : config.color}`}>
                {config.label}
              </span>
              {annotation.resolved && (
                <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-[10px]">
                  Resolved
                </span>
              )}
            </div>

            <p
              className={`mt-1 text-sm cursor-pointer ${
                annotation.resolved
                  ? 'text-gray-400 line-through'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
              onClick={() => onAnnotationClick(annotation)}
            >
              {annotation.content}
            </p>

            {/* Tags */}
            {annotation.tags && annotation.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {annotation.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded text-[10px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Replies preview */}
            {annotation.reply_count && annotation.reply_count > 0 && !isExpanded && (
              <button
                onClick={() => setExpandedAnnotation(annotation.id)}
                className="mt-2 text-xs text-rose-500 hover:text-rose-600"
              >
                <i className="fa fa-comment mr-1"></i>
                {annotation.reply_count} {annotation.reply_count === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAnnotationToggleResolved(annotation.id)}
              className={`p-1 ${
                annotation.resolved
                  ? 'text-green-500 hover:text-green-700'
                  : 'text-gray-500 hover:text-green-500'
              }`}
              title={annotation.resolved ? 'Mark unresolved' : 'Mark resolved'}
            >
              <i className={`fa ${annotation.resolved ? 'fa-check-circle' : 'fa-circle'} text-xs`}></i>
            </button>
            <button
              onClick={() => setExpandedAnnotation(isExpanded ? null : annotation.id)}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="View replies"
            >
              <i className="fa fa-comment text-xs"></i>
            </button>
            <button
              onClick={() => onAnnotationDelete(annotation.id)}
              className="p-1 text-red-500 hover:text-red-700"
              title="Delete annotation"
            >
              <i className="fa fa-trash text-xs"></i>
            </button>
          </div>
        </div>

        {/* Expanded replies section */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <AnnotationReplyThread
              annotation={annotation}
              onReply={(content) => onAnnotationReply(annotation.id, content)}
            />
          </div>
        )}

        {/* Timestamp */}
        <p className="mt-2 text-[10px] text-gray-400">
          {new Date(annotation.created_at).toLocaleDateString()}
        </p>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <i className="fa fa-highlighter text-rose-500"></i>
            Annotations
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExport('all')}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title="Export"
            >
              <i className="fa fa-download text-sm"></i>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <i className="fa fa-times"></i>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          {(['all', 'highlights', 'annotations'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'highlights' ? `Highlights (${highlights.length})` : `Notes (${annotations.length})`}
            </button>
          ))}
        </div>

        {/* Annotation filter */}
        {(activeTab === 'all' || activeTab === 'annotations') && annotations.length > 0 && (
          <div className="mt-3">
            <select
              value={annotationFilter}
              onChange={(e) => setAnnotationFilter(e.target.value as AnnotationFilter)}
              className="w-full text-xs px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300"
            >
              <option value="all">All annotations</option>
              <option value="note">Notes only</option>
              <option value="question">Questions only</option>
              <option value="important">Important only</option>
              <option value="todo">To-Dos only</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'all' && (
          <div className="space-y-3">
            {combinedItems.length === 0 ? (
              <EmptyState />
            ) : (
              combinedItems.map(({ type, item }) =>
                type === 'highlight'
                  ? renderHighlight(item as Highlight, editingHighlight === item.id)
                  : renderAnnotation(item as Annotation)
              )
            )}
          </div>
        )}

        {activeTab === 'highlights' && (
          <div className="space-y-3">
            {highlights.length === 0 ? (
              <EmptyState type="highlights" />
            ) : (
              highlights.map((h) => renderHighlight(h, editingHighlight === h.id))
            )}
          </div>
        )}

        {activeTab === 'annotations' && (
          <div className="space-y-3">
            {filteredAnnotations.length === 0 ? (
              <EmptyState type="annotations" />
            ) : (
              filteredAnnotations.map((a) => renderAnnotation(a))
            )}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            <i className="fa fa-highlighter mr-1"></i>
            {highlights.length} highlights
          </span>
          <span>
            <i className="fa fa-sticky-note mr-1"></i>
            {annotations.filter((a) => !a.resolved).length} open annotations
          </span>
        </div>
      </div>
    </div>
  );
};

// Empty state component
const EmptyState: React.FC<{ type?: 'highlights' | 'annotations' }> = ({ type }) => (
  <div className="text-center py-8">
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <i className={`fa ${type === 'highlights' ? 'fa-highlighter' : type === 'annotations' ? 'fa-sticky-note' : 'fa-layer-group'} text-2xl text-gray-400`}></i>
    </div>
    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1">
      {type === 'highlights'
        ? 'No highlights yet'
        : type === 'annotations'
        ? 'No annotations yet'
        : 'No annotations or highlights'}
    </h4>
    <p className="text-sm text-gray-500 dark:text-gray-400">
      {type === 'highlights'
        ? 'Select text in the document to create highlights'
        : type === 'annotations'
        ? 'Click anywhere in the document to add annotations'
        : 'Start by highlighting text or adding annotations'}
    </p>
  </div>
);

export default AnnotationsSidebar;
