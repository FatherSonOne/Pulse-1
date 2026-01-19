/**
 * Types for Document Highlights and Annotations System
 * Phase 4 of NotebookLM Implementation
 */

// Highlight colors available
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

// Annotation types
export type AnnotationType = 'note' | 'question' | 'important' | 'todo';

// Highlight interface
export interface Highlight {
  id: string;
  doc_id: string;
  user_id: string;
  start_offset: number;
  end_offset: number;
  highlighted_text: string;
  color: HighlightColor;
  note?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// Create highlight payload
export interface CreateHighlightPayload {
  doc_id: string;
  start_offset: number;
  end_offset: number;
  highlighted_text: string;
  color?: HighlightColor;
  note?: string;
  tags?: string[];
}

// Update highlight payload
export interface UpdateHighlightPayload {
  color?: HighlightColor;
  note?: string;
  tags?: string[];
}

// Annotation position
export interface AnnotationPosition {
  page?: number;
  offset: number;
  x?: number;
  y?: number;
}

// Annotation interface
export interface Annotation {
  id: string;
  doc_id: string;
  user_id: string;
  position: AnnotationPosition;
  content: string;
  type: AnnotationType;
  resolved: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  // Populated from join
  replies?: AnnotationReply[];
  reply_count?: number;
}

// Create annotation payload
export interface CreateAnnotationPayload {
  doc_id: string;
  position: AnnotationPosition;
  content: string;
  type?: AnnotationType;
  tags?: string[];
}

// Update annotation payload
export interface UpdateAnnotationPayload {
  content?: string;
  type?: AnnotationType;
  resolved?: boolean;
  tags?: string[];
}

// Annotation reply interface
export interface AnnotationReply {
  id: string;
  annotation_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// Create reply payload
export interface CreateReplyPayload {
  annotation_id: string;
  content: string;
}

// Highlight color configuration
export const HIGHLIGHT_COLORS: Record<HighlightColor, { bg: string; border: string; text: string; name: string }> = {
  yellow: { bg: 'bg-yellow-200/60', border: 'border-yellow-400', text: 'text-yellow-700', name: 'Yellow' },
  green: { bg: 'bg-green-200/60', border: 'border-green-400', text: 'text-green-700', name: 'Green' },
  blue: { bg: 'bg-blue-200/60', border: 'border-blue-400', text: 'text-blue-700', name: 'Blue' },
  pink: { bg: 'bg-pink-200/60', border: 'border-pink-400', text: 'text-pink-700', name: 'Pink' },
  purple: { bg: 'bg-purple-200/60', border: 'border-purple-400', text: 'text-purple-700', name: 'Purple' },
};

// Dark mode highlight colors
export const HIGHLIGHT_COLORS_DARK: Record<HighlightColor, { bg: string; border: string; text: string }> = {
  yellow: { bg: 'bg-yellow-500/30', border: 'border-yellow-500/50', text: 'text-yellow-300' },
  green: { bg: 'bg-green-500/30', border: 'border-green-500/50', text: 'text-green-300' },
  blue: { bg: 'bg-blue-500/30', border: 'border-blue-500/50', text: 'text-blue-300' },
  pink: { bg: 'bg-pink-500/30', border: 'border-pink-500/50', text: 'text-pink-300' },
  purple: { bg: 'bg-purple-500/30', border: 'border-purple-500/50', text: 'text-purple-300' },
};

// Annotation type configuration
export const ANNOTATION_TYPES: Record<AnnotationType, { icon: string; color: string; label: string }> = {
  note: { icon: 'fa-sticky-note', color: 'text-blue-500', label: 'Note' },
  question: { icon: 'fa-question-circle', color: 'text-orange-500', label: 'Question' },
  important: { icon: 'fa-exclamation-circle', color: 'text-red-500', label: 'Important' },
  todo: { icon: 'fa-check-square', color: 'text-green-500', label: 'To-Do' },
};
