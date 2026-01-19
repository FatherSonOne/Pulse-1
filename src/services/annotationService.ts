/**
 * Annotation Service
 * Handles highlights and annotations for documents
 */

import { supabase } from './supabase';
import {
  Highlight,
  CreateHighlightPayload,
  UpdateHighlightPayload,
  Annotation,
  CreateAnnotationPayload,
  UpdateAnnotationPayload,
  AnnotationReply,
  CreateReplyPayload,
} from '../types/annotations';

// ============================================
// HIGHLIGHTS
// ============================================

/**
 * Get all highlights for a document
 */
export async function getDocumentHighlights(docId: string): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('doc_highlights')
    .select('*')
    .eq('doc_id', docId)
    .order('start_offset', { ascending: true });

  if (error) {
    console.error('Error fetching highlights:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all highlights for a user across all documents
 */
export async function getUserHighlights(userId: string, limit = 50): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('doc_highlights')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching user highlights:', error);
    throw error;
  }

  return data || [];
}

/**
 * Create a new highlight
 */
export async function createHighlight(
  userId: string,
  payload: CreateHighlightPayload
): Promise<Highlight> {
  const { data, error } = await supabase
    .from('doc_highlights')
    .insert({
      user_id: userId,
      doc_id: payload.doc_id,
      start_offset: payload.start_offset,
      end_offset: payload.end_offset,
      highlighted_text: payload.highlighted_text,
      color: payload.color || 'yellow',
      note: payload.note || null,
      tags: payload.tags || [],
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating highlight:', error);
    throw error;
  }

  return data;
}

/**
 * Update a highlight
 */
export async function updateHighlight(
  highlightId: string,
  payload: UpdateHighlightPayload
): Promise<Highlight> {
  const { data, error } = await supabase
    .from('doc_highlights')
    .update(payload)
    .eq('id', highlightId)
    .select()
    .single();

  if (error) {
    console.error('Error updating highlight:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a highlight
 */
export async function deleteHighlight(highlightId: string): Promise<void> {
  const { error } = await supabase
    .from('doc_highlights')
    .delete()
    .eq('id', highlightId);

  if (error) {
    console.error('Error deleting highlight:', error);
    throw error;
  }
}

/**
 * Search highlights by text or tags
 */
export async function searchHighlights(
  userId: string,
  query: string
): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('doc_highlights')
    .select('*')
    .eq('user_id', userId)
    .or(`highlighted_text.ilike.%${query}%,note.ilike.%${query}%`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error searching highlights:', error);
    throw error;
  }

  return data || [];
}

// ============================================
// ANNOTATIONS
// ============================================

/**
 * Get all annotations for a document
 */
export async function getDocumentAnnotations(docId: string): Promise<Annotation[]> {
  const { data, error } = await supabase
    .from('doc_annotations')
    .select(`
      *,
      replies:annotation_replies(*)
    `)
    .eq('doc_id', docId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching annotations:', error);
    throw error;
  }

  return (data || []).map(ann => ({
    ...ann,
    reply_count: ann.replies?.length || 0,
  }));
}

/**
 * Get annotations by type
 */
export async function getAnnotationsByType(
  docId: string,
  type: string
): Promise<Annotation[]> {
  const { data, error } = await supabase
    .from('doc_annotations')
    .select(`
      *,
      replies:annotation_replies(*)
    `)
    .eq('doc_id', docId)
    .eq('type', type)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching annotations by type:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get unresolved annotations (todos, questions)
 */
export async function getUnresolvedAnnotations(docId: string): Promise<Annotation[]> {
  const { data, error } = await supabase
    .from('doc_annotations')
    .select(`
      *,
      replies:annotation_replies(*)
    `)
    .eq('doc_id', docId)
    .eq('resolved', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching unresolved annotations:', error);
    throw error;
  }

  return data || [];
}

/**
 * Create a new annotation
 */
export async function createAnnotation(
  userId: string,
  payload: CreateAnnotationPayload
): Promise<Annotation> {
  const { data, error } = await supabase
    .from('doc_annotations')
    .insert({
      user_id: userId,
      doc_id: payload.doc_id,
      position: payload.position,
      content: payload.content,
      type: payload.type || 'note',
      tags: payload.tags || [],
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating annotation:', error);
    throw error;
  }

  return { ...data, replies: [], reply_count: 0 };
}

/**
 * Update an annotation
 */
export async function updateAnnotation(
  annotationId: string,
  payload: UpdateAnnotationPayload
): Promise<Annotation> {
  const { data, error } = await supabase
    .from('doc_annotations')
    .update(payload)
    .eq('id', annotationId)
    .select(`
      *,
      replies:annotation_replies(*)
    `)
    .single();

  if (error) {
    console.error('Error updating annotation:', error);
    throw error;
  }

  return data;
}

/**
 * Toggle annotation resolved status
 */
export async function toggleAnnotationResolved(annotationId: string): Promise<Annotation> {
  // First get current status
  const { data: current, error: fetchError } = await supabase
    .from('doc_annotations')
    .select('resolved')
    .eq('id', annotationId)
    .single();

  if (fetchError) throw fetchError;

  // Toggle it
  const { data, error } = await supabase
    .from('doc_annotations')
    .update({ resolved: !current.resolved })
    .eq('id', annotationId)
    .select(`
      *,
      replies:annotation_replies(*)
    `)
    .single();

  if (error) {
    console.error('Error toggling annotation:', error);
    throw error;
  }

  return data;
}

/**
 * Delete an annotation
 */
export async function deleteAnnotation(annotationId: string): Promise<void> {
  const { error } = await supabase
    .from('doc_annotations')
    .delete()
    .eq('id', annotationId);

  if (error) {
    console.error('Error deleting annotation:', error);
    throw error;
  }
}

// ============================================
// ANNOTATION REPLIES
// ============================================

/**
 * Get replies for an annotation
 */
export async function getAnnotationReplies(annotationId: string): Promise<AnnotationReply[]> {
  const { data, error } = await supabase
    .from('annotation_replies')
    .select('*')
    .eq('annotation_id', annotationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching replies:', error);
    throw error;
  }

  return data || [];
}

/**
 * Create a reply to an annotation
 */
export async function createReply(
  userId: string,
  payload: CreateReplyPayload
): Promise<AnnotationReply> {
  const { data, error } = await supabase
    .from('annotation_replies')
    .insert({
      user_id: userId,
      annotation_id: payload.annotation_id,
      content: payload.content,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating reply:', error);
    throw error;
  }

  return data;
}

/**
 * Update a reply
 */
export async function updateReply(
  replyId: string,
  content: string
): Promise<AnnotationReply> {
  const { data, error } = await supabase
    .from('annotation_replies')
    .update({ content })
    .eq('id', replyId)
    .select()
    .single();

  if (error) {
    console.error('Error updating reply:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a reply
 */
export async function deleteReply(replyId: string): Promise<void> {
  const { error } = await supabase
    .from('annotation_replies')
    .delete()
    .eq('id', replyId);

  if (error) {
    console.error('Error deleting reply:', error);
    throw error;
  }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Export highlights as markdown
 */
export function exportHighlightsAsMarkdown(
  highlights: Highlight[],
  docTitle: string
): string {
  let md = `# Highlights from "${docTitle}"\n\n`;
  md += `*Exported on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

  for (const h of highlights) {
    const colorEmoji = {
      yellow: '🟡',
      green: '🟢',
      blue: '🔵',
      pink: '🩷',
      purple: '🟣',
    }[h.color] || '⚪';

    md += `${colorEmoji} **Highlight:**\n`;
    md += `> ${h.highlighted_text}\n\n`;

    if (h.note) {
      md += `📝 *Note:* ${h.note}\n\n`;
    }

    if (h.tags && h.tags.length > 0) {
      md += `🏷️ Tags: ${h.tags.map(t => `\`${t}\``).join(', ')}\n\n`;
    }

    md += `---\n\n`;
  }

  return md;
}

/**
 * Export annotations as markdown
 */
export function exportAnnotationsAsMarkdown(
  annotations: Annotation[],
  docTitle: string
): string {
  let md = `# Annotations from "${docTitle}"\n\n`;
  md += `*Exported on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

  const typeEmoji = {
    note: '📝',
    question: '❓',
    important: '❗',
    todo: '✅',
  };

  for (const a of annotations) {
    const emoji = typeEmoji[a.type] || '📌';
    const status = a.resolved ? ' ✓' : '';

    md += `${emoji} **${a.type.charAt(0).toUpperCase() + a.type.slice(1)}${status}:**\n`;
    md += `${a.content}\n\n`;

    if (a.replies && a.replies.length > 0) {
      md += `**Replies:**\n`;
      for (const r of a.replies) {
        md += `- ${r.content}\n`;
      }
      md += `\n`;
    }

    if (a.tags && a.tags.length > 0) {
      md += `🏷️ Tags: ${a.tags.map(t => `\`${t}\``).join(', ')}\n\n`;
    }

    md += `---\n\n`;
  }

  return md;
}
