/**
 * Advanced AI Service
 * Comparative Analysis and Knowledge Graph
 *
 * Migrated from direct Gemini SDK calls (`processWithModel`) to the central
 * ai-router edge function. All LLM calls route through `invokeAIJson` which
 * enforces workspace membership, hard-cap metering, task-to-model routing,
 * and automatic provider fallback.
 */

import {
  ComparisonResult,
  ComparisonPoint,
  UniquePoint,
  Theme,
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  EntityType,
  ExtractedEntity,
  EntityRelationship,
  ENTITY_COLORS,
} from '../types/advancedAI';
import { KnowledgeDoc } from './ragService';
import {
  getCachedComparison,
  getCachedKnowledgeGraph,
} from '../utils/aiCache';
import { invokeAIJson } from './ai/aiService';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';
import {
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from './ai/errors';

// ─── Internal helpers ──────────────────────────────────────────────────

function resolveWorkspaceId(override?: string): string {
  const wsId = override ?? getCurrentWorkspaceId();
  if (!wsId) throw new Error('No active workspace — AI unavailable');
  return wsId;
}

function rethrowRouterErrors(err: unknown): void {
  if (
    err instanceof AICapExceededError ||
    err instanceof AITrialExpiredError ||
    err instanceof AIProviderUnavailableError
  ) {
    throw err;
  }
}

// ─── Router response shape types ──────────────────────────────────────

interface ComparisonAnalysisResponse {
  summary?: string;
  agreements?: ComparisonPoint[];
  contradictions?: ComparisonPoint[];
  unique_points?: UniquePoint[];
  themes?: Theme[];
  synthesis?: string;
}

interface EntityExtractionResponse {
  entities?: Array<{
    text: string;
    type: EntityType;
    confidence?: number;
    context?: string;
  }>;
  relationships?: Array<{
    source_entity: string;
    target_entity: string;
    relationship_type: string;
    confidence?: number;
    context?: string;
  }>;
}

interface InsightsResponse {
  keyFindings?: string[];
  trends?: string[];
  recommendations?: string[];
}

interface SimilarityResponse {
  similarity?: number;
  commonTopics?: string[];
}

// ============================================
// COMPARATIVE ANALYSIS
// ============================================

/**
 * Compare multiple documents and generate analysis.
 *
 * Routed to `document_compare` (Claude Sonnet) — reasoning-heavy task.
 *
 * @param documents Documents to compare (minimum 2).
 * @param apiKey DEPRECATED — unused. The ai-router manages provider keys
 *   server-side. Retained for backward compatibility during migration.
 * @param onProgress Progress callback.
 * @param workspaceId Optional workspace override; falls back to active workspace.
 */
export async function compareDocuments(
  documents: KnowledgeDoc[],
  /** @deprecated Router manages keys server-side. Pass `undefined`. */
  apiKey?: string,
  onProgress?: (progress: number, status: string) => void,
  workspaceId?: string,
): Promise<ComparisonResult> {
  void apiKey;
  const startTime = Date.now();

  if (documents.length < 2) {
    throw new Error('At least 2 documents are required for comparison');
  }

  const wsId = resolveWorkspaceId(workspaceId);

  onProgress?.(10, 'Preparing documents...');

  // Prepare document summaries for comparison
  const docSummaries = documents.map(doc => ({
    id: doc.id,
    title: doc.title,
    content: doc.text_content?.slice(0, 15000) || doc.ai_summary || '',
    keywords: doc.ai_keywords || [],
  }));

  const totalTokens = docSummaries.reduce((sum, d) => sum + d.content.length, 0);

  onProgress?.(30, 'Analyzing documents...');

  // Generate comparison analysis
  const comparisonPrompt = `You are an expert document analyst. Compare the following ${documents.length} documents and provide a detailed comparative analysis.

DOCUMENTS:
${docSummaries.map((doc, i) => `
--- DOCUMENT ${i + 1}: "${doc.title}" ---
${doc.content}
--- END DOCUMENT ${i + 1} ---
`).join('\n')}

Analyze these documents and return a JSON object with the following structure:
{
  "summary": "A 2-3 sentence high-level summary of what these documents cover and how they relate",
  "agreements": [
    {
      "topic": "Topic name",
      "description": "What all documents agree on",
      "doc_sources": ["doc_id1", "doc_id2"],
      "confidence": 0.9,
      "quotes": [{"docId": "id", "text": "relevant quote"}]
    }
  ],
  "contradictions": [
    {
      "topic": "Topic name",
      "description": "Where documents disagree or contradict",
      "doc_sources": ["doc_id1", "doc_id2"],
      "confidence": 0.85,
      "quotes": [{"docId": "id", "text": "relevant quote"}]
    }
  ],
  "unique_points": [
    {
      "doc_id": "document id",
      "doc_title": "document title",
      "points": ["Point 1", "Point 2"],
      "significance": "high"
    }
  ],
  "themes": [
    {
      "name": "Theme name",
      "description": "Theme description",
      "doc_coverage": [{"docId": "id", "coverage": "full"}],
      "key_concepts": ["concept1", "concept2"]
    }
  ],
  "synthesis": "A comprehensive synthesis bringing together insights from all documents, highlighting the overall narrative and key takeaways"
}

Document IDs for reference:
${docSummaries.map(d => `- "${d.title}": ${d.id}`).join('\n')}

Return ONLY valid JSON, no markdown or explanation.`;

  onProgress?.(50, 'Generating comparative analysis...');

  let analysis: ComparisonAnalysisResponse;
  try {
    analysis = await invokeAIJson<ComparisonAnalysisResponse>(
      'document_compare',
      comparisonPrompt,
      { workspaceId: wsId, temperature: 0.3 },
    );
  } catch (error) {
    rethrowRouterErrors(error);
    console.error('Failed to parse comparison response:', error);
    throw new Error('Failed to parse comparison analysis');
  }

  onProgress?.(80, 'Processing results...');
  onProgress?.(100, 'Complete!');

  return {
    id: crypto.randomUUID(),
    doc_ids: documents.map(d => d.id),
    doc_titles: documents.map(d => d.title),
    created_at: new Date().toISOString(),
    summary: analysis.summary || '',
    agreements: analysis.agreements || [],
    contradictions: analysis.contradictions || [],
    unique_points: analysis.unique_points || [],
    themes: analysis.themes || [],
    synthesis: analysis.synthesis || '',
    total_tokens_analyzed: totalTokens,
    analysis_duration_ms: Date.now() - startTime,
  };
}

// ============================================
// KNOWLEDGE GRAPH
// ============================================

/**
 * Extract entities and relationships from documents to build a knowledge graph.
 *
 * @param documents Documents to analyze.
 * @param apiKey DEPRECATED — unused. Retained for backward compatibility.
 * @param onProgress Progress callback.
 * @param workspaceId Optional workspace override; falls back to active workspace.
 */
export async function buildKnowledgeGraph(
  documents: KnowledgeDoc[],
  /** @deprecated Router manages keys server-side. Pass `undefined`. */
  apiKey?: string,
  onProgress?: (progress: number, status: string) => void,
  workspaceId?: string,
): Promise<KnowledgeGraph> {
  void apiKey;
  const wsId = resolveWorkspaceId(workspaceId);

  onProgress?.(10, 'Extracting entities...');

  // Extract entities from each document
  const allEntities: ExtractedEntity[] = [];
  const allRelationships: EntityRelationship[] = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const progress = 10 + (i / documents.length) * 50;
    onProgress?.(progress, `Analyzing ${doc.title}...`);

    const { entities, relationships } = await extractEntitiesFromDocument(doc, wsId);
    allEntities.push(...entities);
    allRelationships.push(...relationships);
  }

  onProgress?.(70, 'Building graph structure...');

  // Deduplicate and merge entities
  const nodeMap = new Map<string, GraphNode>();

  for (const entity of allEntities) {
    const key = `${entity.type}:${entity.text.toLowerCase()}`;

    if (nodeMap.has(key)) {
      const existing = nodeMap.get(key)!;
      existing.mention_count++;
      if (!existing.doc_sources.includes(entity.doc_id)) {
        existing.doc_sources.push(entity.doc_id);
      }
    } else {
      nodeMap.set(key, {
        id: crypto.randomUUID(),
        label: entity.text,
        type: entity.type,
        properties: {},
        doc_sources: [entity.doc_id],
        mention_count: 1,
        importance: entity.confidence,
        color: ENTITY_COLORS[entity.type],
      });
    }
  }

  // Build edges from relationships
  const edges: GraphEdge[] = [];
  const edgeMap = new Map<string, GraphEdge>();

  for (const rel of allRelationships) {
    const sourceKey = findNodeKey(nodeMap, rel.source_entity);
    const targetKey = findNodeKey(nodeMap, rel.target_entity);

    if (sourceKey && targetKey) {
      const sourceNode = nodeMap.get(sourceKey)!;
      const targetNode = nodeMap.get(targetKey)!;
      const edgeKey = `${sourceNode.id}-${rel.relationship_type}-${targetNode.id}`;

      if (edgeMap.has(edgeKey)) {
        const existing = edgeMap.get(edgeKey)!;
        existing.weight = Math.min(1, existing.weight + 0.1);
        if (!existing.doc_sources.includes(rel.doc_id)) {
          existing.doc_sources.push(rel.doc_id);
        }
      } else {
        const edge: GraphEdge = {
          id: crypto.randomUUID(),
          source: sourceNode.id,
          target: targetNode.id,
          relationship: rel.relationship_type,
          weight: rel.confidence,
          doc_sources: [rel.doc_id],
        };
        edgeMap.set(edgeKey, edge);
        edges.push(edge);
      }
    }
  }

  onProgress?.(90, 'Calculating importance scores...');

  // Calculate importance based on connections
  const nodes = Array.from(nodeMap.values());
  const connectionCounts = new Map<string, number>();

  for (const edge of edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
  }

  const maxConnections = Math.max(...Array.from(connectionCounts.values()), 1);

  for (const node of nodes) {
    const connections = connectionCounts.get(node.id) || 0;
    node.importance = Math.max(
      node.importance,
      (connections / maxConnections) * 0.5 + (node.mention_count / allEntities.length) * 0.5
    );
    node.size = 10 + node.importance * 30;
  }

  onProgress?.(100, 'Complete!');

  return {
    id: crypto.randomUUID(),
    doc_ids: documents.map(d => d.id),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nodes,
    edges,
    total_entities: nodes.length,
    total_relationships: edges.length,
  };
}

/**
 * Extract entities and relationships from a single document.
 *
 * Routed to `knowledge_graph_extract`. Note: this is an internal helper —
 * the outer `buildKnowledgeGraph` resolves the workspace ID and passes it in.
 */
async function extractEntitiesFromDocument(
  doc: KnowledgeDoc,
  workspaceId: string,
): Promise<{ entities: ExtractedEntity[]; relationships: EntityRelationship[] }> {
  const content = doc.text_content?.slice(0, 10000) || doc.ai_summary || '';

  if (!content) {
    return { entities: [], relationships: [] };
  }

  const prompt = `Extract entities and relationships from the following text.

TEXT:
${content}

Return a JSON object with:
{
  "entities": [
    {
      "text": "Entity name",
      "type": "person|organization|location|event|concept|date|product|technology|topic|other",
      "confidence": 0.9,
      "context": "Brief context where it appears"
    }
  ],
  "relationships": [
    {
      "source_entity": "Entity 1 name",
      "target_entity": "Entity 2 name",
      "relationship_type": "works_for|located_in|part_of|related_to|causes|etc",
      "confidence": 0.85,
      "context": "Brief context of the relationship"
    }
  ]
}

Focus on the most important entities (up to 30) and relationships (up to 40).
Return ONLY valid JSON.`;

  try {
    const result = await invokeAIJson<EntityExtractionResponse>(
      'knowledge_graph_extract',
      prompt,
      { workspaceId, temperature: 0.2 },
    );

    const entities: ExtractedEntity[] = (result.entities || []).map((e) => ({
      text: e.text,
      type: e.type as EntityType,
      start_offset: 0,
      end_offset: 0,
      confidence: e.confidence || 0.5,
      context: e.context || '',
      doc_id: doc.id,
    }));

    const relationships: EntityRelationship[] = (result.relationships || []).map((r) => ({
      source_entity: r.source_entity,
      target_entity: r.target_entity,
      relationship_type: r.relationship_type,
      confidence: r.confidence || 0.5,
      context: r.context || '',
      doc_id: doc.id,
    }));

    return { entities, relationships };
  } catch (error) {
    rethrowRouterErrors(error);
    console.error('Entity extraction failed:', error);
    return { entities: [], relationships: [] };
  }
}

/**
 * Find a node key by entity name (case-insensitive)
 */
function findNodeKey(nodeMap: Map<string, GraphNode>, entityName: string): string | undefined {
  const lowerName = entityName.toLowerCase();
  for (const [key, node] of nodeMap.entries()) {
    if (node.label.toLowerCase() === lowerName) {
      return key;
    }
  }
  return undefined;
}

// ============================================
// INSIGHTS GENERATION
// ============================================

/**
 * Generate key insights from documents.
 *
 * Routed to `document_compare` — multi-document theme analysis.
 *
 * @param documents Documents to analyze.
 * @param apiKey DEPRECATED — unused. Retained for backward compatibility.
 * @param workspaceId Optional workspace override; falls back to active workspace.
 */
export async function generateInsights(
  documents: KnowledgeDoc[],
  /** @deprecated Router manages keys server-side. Pass `undefined`. */
  apiKey?: string,
  workspaceId?: string,
): Promise<{
  keyFindings: string[];
  trends: string[];
  recommendations: string[];
}> {
  void apiKey;
  const wsId = resolveWorkspaceId(workspaceId);

  const content = documents
    .map(d => `[${d.title}]: ${d.ai_summary || d.text_content?.slice(0, 3000) || ''}`)
    .join('\n\n');

  const prompt = `Analyze these documents and extract insights:

${content}

Return JSON with:
{
  "keyFindings": ["Finding 1", "Finding 2", ...],
  "trends": ["Trend 1", "Trend 2", ...],
  "recommendations": ["Recommendation 1", "Recommendation 2", ...]
}

Provide 3-5 items for each category. Be specific and actionable.
Return ONLY valid JSON.`;

  try {
    const result = await invokeAIJson<InsightsResponse>(
      'document_compare',
      prompt,
      { workspaceId: wsId, temperature: 0.4 },
    );
    return {
      keyFindings: result.keyFindings || [],
      trends: result.trends || [],
      recommendations: result.recommendations || [],
    };
  } catch (error) {
    rethrowRouterErrors(error);
    return {
      keyFindings: [],
      trends: [],
      recommendations: [],
    };
  }
}

// ============================================
// DOCUMENT SIMILARITY
// ============================================

/**
 * Calculate similarity between documents.
 *
 * Routed to `document_compare` — pairwise semantic comparison.
 *
 * @param documents Documents to compare pairwise.
 * @param apiKey DEPRECATED — unused. Retained for backward compatibility.
 * @param workspaceId Optional workspace override; falls back to active workspace.
 */
export async function calculateDocumentSimilarity(
  documents: KnowledgeDoc[],
  /** @deprecated Router manages keys server-side. Pass `undefined`. */
  apiKey?: string,
  workspaceId?: string,
): Promise<{ docId1: string; docId2: string; similarity: number; commonTopics: string[] }[]> {
  void apiKey;
  if (documents.length < 2) return [];

  const wsId = resolveWorkspaceId(workspaceId);

  const pairs: { docId1: string; docId2: string; similarity: number; commonTopics: string[] }[] = [];

  // Compare each pair
  for (let i = 0; i < documents.length; i++) {
    for (let j = i + 1; j < documents.length; j++) {
      const doc1 = documents[i];
      const doc2 = documents[j];

      const prompt = `Compare these two documents for similarity:

Document 1 "${doc1.title}":
${doc1.ai_summary || doc1.text_content?.slice(0, 2000) || ''}

Document 2 "${doc2.title}":
${doc2.ai_summary || doc2.text_content?.slice(0, 2000) || ''}

Return JSON:
{
  "similarity": 0.75,
  "commonTopics": ["topic1", "topic2"]
}

Similarity is 0-1 (0 = completely different, 1 = identical topics).
Return ONLY valid JSON.`;

      try {
        const result = await invokeAIJson<SimilarityResponse>(
          'document_compare',
          prompt,
          { workspaceId: wsId, temperature: 0.2 },
        );

        pairs.push({
          docId1: doc1.id,
          docId2: doc2.id,
          similarity: result.similarity || 0,
          commonTopics: result.commonTopics || [],
        });
      } catch (error) {
        rethrowRouterErrors(error);
        pairs.push({
          docId1: doc1.id,
          docId2: doc2.id,
          similarity: 0,
          commonTopics: [],
        });
      }
    }
  }

  return pairs;
}

// ============================================
// CACHED WRAPPERS
// ============================================

/**
 * Compare documents with caching.
 *
 * @param documents Documents to compare.
 * @param apiKey DEPRECATED — unused. Retained for backward compatibility.
 * @param onProgress Progress callback.
 * @param workspaceId Optional workspace override; falls back to active workspace.
 */
export async function compareDocumentsCached(
  documents: KnowledgeDoc[],
  /** @deprecated Router manages keys server-side. Pass `undefined`. */
  apiKey?: string,
  onProgress?: (progress: number, status: string) => void,
  workspaceId?: string,
): Promise<ComparisonResult> {
  void apiKey;
  const docIds = documents.map(d => d.id);

  return getCachedComparison(docIds, () =>
    compareDocuments(documents, undefined, onProgress, workspaceId)
  );
}

/**
 * Build knowledge graph with caching.
 *
 * @param documents Documents to analyze.
 * @param apiKey DEPRECATED — unused. Retained for backward compatibility.
 * @param onProgress Progress callback.
 * @param workspaceId Optional workspace override; falls back to active workspace.
 */
export async function buildKnowledgeGraphCached(
  documents: KnowledgeDoc[],
  /** @deprecated Router manages keys server-side. Pass `undefined`. */
  apiKey?: string,
  onProgress?: (progress: number, status: string) => void,
  workspaceId?: string,
): Promise<KnowledgeGraph> {
  void apiKey;
  const docIds = documents.map(d => d.id);

  return getCachedKnowledgeGraph(docIds, () =>
    buildKnowledgeGraph(documents, undefined, onProgress, workspaceId)
  );
}
