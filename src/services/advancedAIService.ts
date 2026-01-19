/**
 * Advanced AI Service
 * Comparative Analysis and Knowledge Graph
 */

import { processWithModel } from './geminiService';
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

// ============================================
// COMPARATIVE ANALYSIS
// ============================================

/**
 * Compare multiple documents and generate analysis
 */
export async function compareDocuments(
  documents: KnowledgeDoc[],
  apiKey: string,
  onProgress?: (progress: number, status: string) => void
): Promise<ComparisonResult> {
  const startTime = Date.now();

  if (documents.length < 2) {
    throw new Error('At least 2 documents are required for comparison');
  }

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

  const response = await processWithModel(apiKey, comparisonPrompt, 'gemini-1.5-flash');

  onProgress?.(80, 'Processing results...');

  // Parse the response
  let analysis;
  try {
    // Clean the response - remove markdown code blocks if present
    let cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    analysis = JSON.parse(cleanedResponse);
  } catch (e) {
    console.error('Failed to parse comparison response:', response);
    throw new Error('Failed to parse comparison analysis');
  }

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
 * Extract entities and relationships from documents to build a knowledge graph
 */
export async function buildKnowledgeGraph(
  documents: KnowledgeDoc[],
  apiKey: string,
  onProgress?: (progress: number, status: string) => void
): Promise<KnowledgeGraph> {
  onProgress?.(10, 'Extracting entities...');

  // Extract entities from each document
  const allEntities: ExtractedEntity[] = [];
  const allRelationships: EntityRelationship[] = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const progress = 10 + (i / documents.length) * 50;
    onProgress?.(progress, `Analyzing ${doc.title}...`);

    const { entities, relationships } = await extractEntitiesFromDocument(doc, apiKey);
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
 * Extract entities and relationships from a single document
 */
async function extractEntitiesFromDocument(
  doc: KnowledgeDoc,
  apiKey: string
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
    const response = await processWithModel(apiKey, prompt, 'gemini-1.5-flash');

    let result;
    try {
      const cleanedResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      result = JSON.parse(cleanedResponse);
    } catch {
      return { entities: [], relationships: [] };
    }

    const entities: ExtractedEntity[] = (result.entities || []).map((e: any) => ({
      text: e.text,
      type: e.type as EntityType,
      start_offset: 0,
      end_offset: 0,
      confidence: e.confidence || 0.5,
      context: e.context || '',
      doc_id: doc.id,
    }));

    const relationships: EntityRelationship[] = (result.relationships || []).map((r: any) => ({
      source_entity: r.source_entity,
      target_entity: r.target_entity,
      relationship_type: r.relationship_type,
      confidence: r.confidence || 0.5,
      context: r.context || '',
      doc_id: doc.id,
    }));

    return { entities, relationships };
  } catch (error) {
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
 * Generate key insights from documents
 */
export async function generateInsights(
  documents: KnowledgeDoc[],
  apiKey: string
): Promise<{
  keyFindings: string[];
  trends: string[];
  recommendations: string[];
}> {
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

  const response = await processWithModel(apiKey, prompt, 'gemini-1.5-flash');

  try {
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleanedResponse);
  } catch {
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
 * Calculate similarity between documents
 */
export async function calculateDocumentSimilarity(
  documents: KnowledgeDoc[],
  apiKey: string
): Promise<{ docId1: string; docId2: string; similarity: number; commonTopics: string[] }[]> {
  if (documents.length < 2) return [];

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
        const response = await processWithModel(apiKey, prompt, 'gemini-1.5-flash');
        const cleanedResponse = response
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        const result = JSON.parse(cleanedResponse);

        pairs.push({
          docId1: doc1.id,
          docId2: doc2.id,
          similarity: result.similarity || 0,
          commonTopics: result.commonTopics || [],
        });
      } catch {
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
 * Compare documents with caching
 */
export async function compareDocumentsCached(
  documents: KnowledgeDoc[],
  apiKey: string,
  onProgress?: (progress: number, status: string) => void
): Promise<ComparisonResult> {
  const docIds = documents.map(d => d.id);

  return getCachedComparison(docIds, () =>
    compareDocuments(documents, apiKey, onProgress)
  );
}

/**
 * Build knowledge graph with caching
 */
export async function buildKnowledgeGraphCached(
  documents: KnowledgeDoc[],
  apiKey: string,
  onProgress?: (progress: number, status: string) => void
): Promise<KnowledgeGraph> {
  const docIds = documents.map(d => d.id);

  return getCachedKnowledgeGraph(docIds, () =>
    buildKnowledgeGraph(documents, apiKey, onProgress)
  );
}
