/**
 * Advanced AI Feature Types
 * Comparative Analysis and Knowledge Graph
 */

// ============================================
// COMPARATIVE ANALYSIS
// ============================================

export interface ComparisonResult {
  id: string;
  doc_ids: string[];
  doc_titles: string[];
  created_at: string;

  // Analysis results
  summary: string;
  agreements: ComparisonPoint[];
  contradictions: ComparisonPoint[];
  unique_points: UniquePoint[];
  themes: Theme[];
  synthesis: string;

  // Metadata
  total_tokens_analyzed: number;
  analysis_duration_ms: number;
}

export interface ComparisonPoint {
  topic: string;
  description: string;
  doc_sources: string[]; // doc_ids
  confidence: number; // 0-1
  quotes?: { docId: string; text: string }[];
}

export interface UniquePoint {
  doc_id: string;
  doc_title: string;
  points: string[];
  significance: 'low' | 'medium' | 'high';
}

export interface Theme {
  name: string;
  description: string;
  doc_coverage: { docId: string; coverage: 'none' | 'partial' | 'full' }[];
  key_concepts: string[];
}

// ============================================
// KNOWLEDGE GRAPH
// ============================================

export interface KnowledgeGraph {
  id: string;
  project_id?: string;
  doc_ids: string[];
  created_at: string;
  updated_at: string;

  nodes: GraphNode[];
  edges: GraphEdge[];

  // Stats
  total_entities: number;
  total_relationships: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
  properties: Record<string, any>;
  doc_sources: string[]; // doc_ids where this entity appears
  mention_count: number;
  importance: number; // 0-1, based on centrality

  // Visual properties
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}

export type EntityType =
  | 'person'
  | 'organization'
  | 'location'
  | 'event'
  | 'concept'
  | 'date'
  | 'product'
  | 'technology'
  | 'document'
  | 'topic'
  | 'other';

export const ENTITY_COLORS: Record<EntityType, string> = {
  person: '#f43f5e',      // Rose
  organization: '#3b82f6', // Blue
  location: '#10b981',    // Emerald
  event: '#8b5cf6',       // Violet
  concept: '#f59e0b',     // Amber
  date: '#6366f1',        // Indigo
  product: '#ec4899',     // Pink
  technology: '#14b8a6',  // Teal
  document: '#64748b',    // Slate
  topic: '#a855f7',       // Purple
  other: '#78716c',       // Stone
};

export const ENTITY_ICONS: Record<EntityType, string> = {
  person: 'fa-user',
  organization: 'fa-building',
  location: 'fa-map-marker-alt',
  event: 'fa-calendar-alt',
  concept: 'fa-lightbulb',
  date: 'fa-clock',
  product: 'fa-box',
  technology: 'fa-microchip',
  document: 'fa-file-alt',
  topic: 'fa-tags',
  other: 'fa-circle',
};

export interface GraphEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  relationship: string;
  weight: number; // 0-1, relationship strength
  doc_sources: string[];

  // Visual properties
  color?: string;
  width?: number;
  label?: string;
}

export interface GraphFilter {
  entityTypes?: EntityType[];
  minImportance?: number;
  docIds?: string[];
  searchQuery?: string;
}

export interface GraphLayout {
  type: 'force' | 'radial' | 'hierarchical' | 'circular';
  centerNode?: string;
}

// ============================================
// ENTITY EXTRACTION
// ============================================

export interface ExtractedEntity {
  text: string;
  type: EntityType;
  start_offset: number;
  end_offset: number;
  confidence: number;
  context: string;
  doc_id: string;
}

export interface EntityRelationship {
  source_entity: string;
  target_entity: string;
  relationship_type: string;
  confidence: number;
  context: string;
  doc_id: string;
}

// ============================================
// INSIGHTS
// ============================================

export interface DocumentInsight {
  id: string;
  doc_id: string;
  type: InsightType;
  title: string;
  description: string;
  evidence: string[];
  confidence: number;
  created_at: string;
}

export type InsightType =
  | 'key_finding'
  | 'trend'
  | 'anomaly'
  | 'connection'
  | 'gap'
  | 'recommendation';

export const INSIGHT_CONFIG: Record<InsightType, { label: string; icon: string; color: string }> = {
  key_finding: { label: 'Key Finding', icon: 'fa-star', color: 'text-amber-500' },
  trend: { label: 'Trend', icon: 'fa-chart-line', color: 'text-blue-500' },
  anomaly: { label: 'Anomaly', icon: 'fa-exclamation-triangle', color: 'text-red-500' },
  connection: { label: 'Connection', icon: 'fa-link', color: 'text-purple-500' },
  gap: { label: 'Gap', icon: 'fa-circle-dot', color: 'text-orange-500' },
  recommendation: { label: 'Recommendation', icon: 'fa-lightbulb', color: 'text-green-500' },
};
