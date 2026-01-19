/**
 * Organization Service
 * Handles tags, collections, favorites, and recent views
 */

import { supabase } from './supabase';
import {
  DocumentTag,
  CreateTagPayload,
  UpdateTagPayload,
  DocumentCollection,
  CreateCollectionPayload,
  UpdateCollectionPayload,
  DocFavorite,
  DocRecentView,
  SmartCollectionRules,
} from '../types/organization';

// ============================================
// TAGS
// ============================================

/**
 * Get all tags for a user
 */
export async function getUserTags(userId: string): Promise<DocumentTag[]> {
  const { data, error } = await supabase
    .from('document_tags')
    .select(`
      *,
      doc_tags(count)
    `)
    .eq('user_id', userId)
    .order('name');

  if (error) {
    console.error('Error fetching tags:', error);
    throw error;
  }

  return (data || []).map(tag => ({
    ...tag,
    doc_count: tag.doc_tags?.[0]?.count || 0,
  }));
}

/**
 * Create a new tag
 */
export async function createTag(
  userId: string,
  payload: CreateTagPayload
): Promise<DocumentTag> {
  const { data, error } = await supabase
    .from('document_tags')
    .insert({
      user_id: userId,
      name: payload.name,
      color: payload.color || '#f43f5e',
      icon: payload.icon || 'fa-tag',
      description: payload.description,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating tag:', error);
    throw error;
  }

  return { ...data, doc_count: 0 };
}

/**
 * Update a tag
 */
export async function updateTag(
  tagId: string,
  payload: UpdateTagPayload
): Promise<DocumentTag> {
  const { data, error } = await supabase
    .from('document_tags')
    .update(payload)
    .eq('id', tagId)
    .select()
    .single();

  if (error) {
    console.error('Error updating tag:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a tag
 */
export async function deleteTag(tagId: string): Promise<void> {
  const { error } = await supabase
    .from('document_tags')
    .delete()
    .eq('id', tagId);

  if (error) {
    console.error('Error deleting tag:', error);
    throw error;
  }
}

/**
 * Get tags for a document
 */
export async function getDocumentTags(docId: string): Promise<DocumentTag[]> {
  const { data, error } = await supabase
    .from('doc_tags')
    .select(`
      tag_id,
      document_tags(*)
    `)
    .eq('doc_id', docId);

  if (error) {
    console.error('Error fetching document tags:', error);
    throw error;
  }

  return (data || []).map(item => item.document_tags).filter(Boolean) as DocumentTag[];
}

/**
 * Add tag to document
 */
export async function addTagToDocument(docId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('doc_tags')
    .insert({ doc_id: docId, tag_id: tagId });

  if (error && error.code !== '23505') { // Ignore duplicate key error
    console.error('Error adding tag to document:', error);
    throw error;
  }
}

/**
 * Remove tag from document
 */
export async function removeTagFromDocument(docId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('doc_tags')
    .delete()
    .eq('doc_id', docId)
    .eq('tag_id', tagId);

  if (error) {
    console.error('Error removing tag from document:', error);
    throw error;
  }
}

/**
 * Get documents by tag
 */
export async function getDocumentsByTag(tagId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('doc_tags')
    .select('doc_id')
    .eq('tag_id', tagId);

  if (error) {
    console.error('Error fetching documents by tag:', error);
    throw error;
  }

  return (data || []).map(item => item.doc_id);
}

// ============================================
// COLLECTIONS
// ============================================

/**
 * Get all collections for a user
 */
export async function getUserCollections(userId: string): Promise<DocumentCollection[]> {
  const { data, error } = await supabase
    .from('document_collections')
    .select(`
      *,
      collection_docs(count)
    `)
    .eq('user_id', userId)
    .order('name');

  if (error) {
    console.error('Error fetching collections:', error);
    throw error;
  }

  return (data || []).map(col => ({
    ...col,
    doc_count: col.collection_docs?.[0]?.count || 0,
  }));
}

/**
 * Create a new collection
 */
export async function createCollection(
  userId: string,
  payload: CreateCollectionPayload
): Promise<DocumentCollection> {
  const { data, error } = await supabase
    .from('document_collections')
    .insert({
      user_id: userId,
      name: payload.name,
      description: payload.description,
      type: payload.type || 'manual',
      icon: payload.icon || 'fa-folder',
      color: payload.color || '#3b82f6',
      rules: payload.rules,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating collection:', error);
    throw error;
  }

  return { ...data, doc_count: 0 };
}

/**
 * Update a collection
 */
export async function updateCollection(
  collectionId: string,
  payload: UpdateCollectionPayload
): Promise<DocumentCollection> {
  const { data, error } = await supabase
    .from('document_collections')
    .update(payload)
    .eq('id', collectionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating collection:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a collection
 */
export async function deleteCollection(collectionId: string): Promise<void> {
  const { error } = await supabase
    .from('document_collections')
    .delete()
    .eq('id', collectionId);

  if (error) {
    console.error('Error deleting collection:', error);
    throw error;
  }
}

/**
 * Get documents in a collection (manual)
 */
export async function getCollectionDocuments(collectionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('collection_docs')
    .select('doc_id')
    .eq('collection_id', collectionId)
    .order('sort_order');

  if (error) {
    console.error('Error fetching collection documents:', error);
    throw error;
  }

  return (data || []).map(item => item.doc_id);
}

/**
 * Get documents for a smart collection
 */
export async function getSmartCollectionDocuments(collectionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .rpc('get_smart_collection_docs', { collection_id: collectionId });

  if (error) {
    console.error('Error fetching smart collection documents:', error);
    throw error;
  }

  return (data || []).map((item: { doc_id: string }) => item.doc_id);
}

/**
 * Add document to collection
 */
export async function addDocumentToCollection(
  collectionId: string,
  docId: string,
  sortOrder?: number
): Promise<void> {
  const { error } = await supabase
    .from('collection_docs')
    .insert({
      collection_id: collectionId,
      doc_id: docId,
      sort_order: sortOrder || 0,
    });

  if (error && error.code !== '23505') {
    console.error('Error adding document to collection:', error);
    throw error;
  }
}

/**
 * Remove document from collection
 */
export async function removeDocumentFromCollection(
  collectionId: string,
  docId: string
): Promise<void> {
  const { error } = await supabase
    .from('collection_docs')
    .delete()
    .eq('collection_id', collectionId)
    .eq('doc_id', docId);

  if (error) {
    console.error('Error removing document from collection:', error);
    throw error;
  }
}

/**
 * Reorder documents in collection
 */
export async function reorderCollectionDocuments(
  collectionId: string,
  docIds: string[]
): Promise<void> {
  const updates = docIds.map((docId, index) => ({
    collection_id: collectionId,
    doc_id: docId,
    sort_order: index,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('collection_docs')
      .update({ sort_order: update.sort_order })
      .eq('collection_id', update.collection_id)
      .eq('doc_id', update.doc_id);

    if (error) {
      console.error('Error reordering collection:', error);
    }
  }
}

// ============================================
// FAVORITES
// ============================================

/**
 * Get user's favorite documents
 */
export async function getUserFavorites(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('doc_favorites')
    .select('doc_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching favorites:', error);
    throw error;
  }

  return (data || []).map(item => item.doc_id);
}

/**
 * Check if document is favorited
 */
export async function isDocumentFavorited(userId: string, docId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('doc_favorites')
    .select('doc_id')
    .eq('user_id', userId)
    .eq('doc_id', docId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking favorite:', error);
  }

  return !!data;
}

/**
 * Add document to favorites
 */
export async function addToFavorites(userId: string, docId: string): Promise<void> {
  const { error } = await supabase
    .from('doc_favorites')
    .insert({ user_id: userId, doc_id: docId });

  if (error && error.code !== '23505') {
    console.error('Error adding to favorites:', error);
    throw error;
  }
}

/**
 * Remove document from favorites
 */
export async function removeFromFavorites(userId: string, docId: string): Promise<void> {
  const { error } = await supabase
    .from('doc_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('doc_id', docId);

  if (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(userId: string, docId: string): Promise<boolean> {
  const isFav = await isDocumentFavorited(userId, docId);
  if (isFav) {
    await removeFromFavorites(userId, docId);
    return false;
  } else {
    await addToFavorites(userId, docId);
    return true;
  }
}

// ============================================
// RECENT VIEWS
// ============================================

/**
 * Get recently viewed documents
 */
export async function getRecentViews(userId: string, limit = 20): Promise<DocRecentView[]> {
  const { data, error } = await supabase
    .from('doc_recent_views')
    .select('*')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent views:', error);
    throw error;
  }

  return data || [];
}

/**
 * Record a document view
 */
export async function recordDocumentView(userId: string, docId: string): Promise<void> {
  // Try to update existing record
  const { data: existing } = await supabase
    .from('doc_recent_views')
    .select('view_count')
    .eq('user_id', userId)
    .eq('doc_id', docId)
    .single();

  if (existing) {
    // Update existing view
    const { error } = await supabase
      .from('doc_recent_views')
      .update({
        viewed_at: new Date().toISOString(),
        view_count: existing.view_count + 1,
      })
      .eq('user_id', userId)
      .eq('doc_id', docId);

    if (error) {
      console.error('Error updating recent view:', error);
    }
  } else {
    // Insert new view
    const { error } = await supabase
      .from('doc_recent_views')
      .insert({
        user_id: userId,
        doc_id: docId,
        view_count: 1,
      });

    if (error) {
      console.error('Error recording view:', error);
    }
  }
}

/**
 * Clear recent views
 */
export async function clearRecentViews(userId: string): Promise<void> {
  const { error } = await supabase
    .from('doc_recent_views')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error clearing recent views:', error);
    throw error;
  }
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Add tags to multiple documents
 */
export async function bulkAddTags(docIds: string[], tagIds: string[]): Promise<void> {
  const inserts = [];
  for (const docId of docIds) {
    for (const tagId of tagIds) {
      inserts.push({ doc_id: docId, tag_id: tagId });
    }
  }

  const { error } = await supabase
    .from('doc_tags')
    .upsert(inserts, { onConflict: 'doc_id,tag_id' });

  if (error) {
    console.error('Error bulk adding tags:', error);
    throw error;
  }
}

/**
 * Add documents to collection
 */
export async function bulkAddToCollection(collectionId: string, docIds: string[]): Promise<void> {
  const inserts = docIds.map((docId, index) => ({
    collection_id: collectionId,
    doc_id: docId,
    sort_order: index,
  }));

  const { error } = await supabase
    .from('collection_docs')
    .upsert(inserts, { onConflict: 'collection_id,doc_id' });

  if (error) {
    console.error('Error bulk adding to collection:', error);
    throw error;
  }
}

/**
 * Remove tags from multiple documents
 */
export async function bulkRemoveTags(docIds: string[], tagIds: string[]): Promise<void> {
  for (const docId of docIds) {
    const { error } = await supabase
      .from('doc_tags')
      .delete()
      .eq('doc_id', docId)
      .in('tag_id', tagIds);

    if (error) {
      console.error('Error bulk removing tags:', error);
    }
  }
}
