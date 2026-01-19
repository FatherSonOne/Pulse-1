/**
 * Types for Document Organization System
 * Phase 5 of NotebookLM Implementation
 */

// ============================================
// TAGS
// ============================================

export interface DocumentTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
  created_at: string;
  // Computed
  doc_count?: number;
}

export interface CreateTagPayload {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
}

export interface UpdateTagPayload {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
}

// ============================================
// COLLECTIONS
// ============================================

export type CollectionType = 'manual' | 'smart';

export interface SmartCollectionRules {
  keywords?: string[];
  tags?: string[];
  dateRange?: [string, string]; // ISO date strings
  fileTypes?: string[];
}

export interface DocumentCollection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  type: CollectionType;
  icon: string;
  color: string;
  rules?: SmartCollectionRules;
  created_at: string;
  updated_at: string;
  // Computed
  doc_count?: number;
}

export interface CreateCollectionPayload {
  name: string;
  description?: string;
  type?: CollectionType;
  icon?: string;
  color?: string;
  rules?: SmartCollectionRules;
}

export interface UpdateCollectionPayload {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  rules?: SmartCollectionRules;
}

// ============================================
// FAVORITES & RECENT VIEWS
// ============================================

export interface DocFavorite {
  user_id: string;
  doc_id: string;
  created_at: string;
}

export interface DocRecentView {
  user_id: string;
  doc_id: string;
  viewed_at: string;
  view_count: number;
}

// ============================================
// PRESET COLORS AND ICONS
// ============================================

export const TAG_COLORS = [
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Pink', value: '#ec4899' },
];

export const TAG_ICONS = [
  { name: 'Tag', value: 'fa-tag' },
  { name: 'Bookmark', value: 'fa-bookmark' },
  { name: 'Star', value: 'fa-star' },
  { name: 'Heart', value: 'fa-heart' },
  { name: 'Flag', value: 'fa-flag' },
  { name: 'Circle', value: 'fa-circle' },
  { name: 'Square', value: 'fa-square' },
  { name: 'Hashtag', value: 'fa-hashtag' },
  { name: 'At', value: 'fa-at' },
  { name: 'Code', value: 'fa-code' },
  { name: 'File', value: 'fa-file' },
  { name: 'Folder', value: 'fa-folder' },
  { name: 'Book', value: 'fa-book' },
  { name: 'Lightbulb', value: 'fa-lightbulb' },
  { name: 'Check', value: 'fa-check' },
  { name: 'Exclamation', value: 'fa-exclamation' },
];

export const COLLECTION_ICONS = [
  { name: 'Folder', value: 'fa-folder' },
  { name: 'Folder Open', value: 'fa-folder-open' },
  { name: 'Archive', value: 'fa-box-archive' },
  { name: 'Inbox', value: 'fa-inbox' },
  { name: 'Layer Group', value: 'fa-layer-group' },
  { name: 'Book', value: 'fa-book' },
  { name: 'Books', value: 'fa-books' },
  { name: 'Briefcase', value: 'fa-briefcase' },
  { name: 'Building', value: 'fa-building' },
  { name: 'Graduation Cap', value: 'fa-graduation-cap' },
  { name: 'Flask', value: 'fa-flask' },
  { name: 'Lightbulb', value: 'fa-lightbulb' },
  { name: 'Star', value: 'fa-star' },
  { name: 'Heart', value: 'fa-heart' },
  { name: 'Fire', value: 'fa-fire' },
  { name: 'Bolt', value: 'fa-bolt' },
];

// ============================================
// FILTER OPTIONS
// ============================================

export interface DocFilterOptions {
  tags?: string[];
  collections?: string[];
  fileTypes?: string[];
  dateRange?: [Date, Date];
  favorites?: boolean;
  hasHighlights?: boolean;
  hasAnnotations?: boolean;
  searchQuery?: string;
}

export type SortOption = 'recent' | 'title' | 'date-asc' | 'date-desc' | 'size';
