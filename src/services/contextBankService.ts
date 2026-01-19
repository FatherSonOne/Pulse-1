/**
 * Context Bank Service
 * Manages session-scoped context for voice RAG conversations
 *
 * Features:
 * - Document indexing with chunking and embeddings
 * - Fast in-memory vector search for session context
 * - Conversation summarization for token management
 * - Hybrid search (semantic + keyword)
 */

import { generateEmbedding, processWithModel } from './geminiService';
import { ragService } from './ragService';

// ============= TYPES =============

export interface ContextChunk {
  id: string;
  content: string;
  embedding?: number[];
  sourceId: string;
  sourceName: string;
  chunkIndex: number;
}

export interface IndexedDocument {
  id: string;
  name: string;
  type: 'file' | 'text' | 'url';
  content: string;
  summary?: string;
  chunks: ContextChunk[];
  indexedAt: Date;
}

export interface SearchResult {
  source: string;
  sourceId: string;
  excerpt: string;
  similarity: number;
  chunkIndex: number;
}

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ContextBank {
  sessionId: string;
  userId: string;
  documents: IndexedDocument[];
  conversationSummary: string;
  totalTokens: number;
  createdAt: Date;
  lastUpdatedAt: Date;
}

export interface ContextBankConfig {
  chunkSize: number;
  chunkOverlap: number;
  maxChunksPerDocument: number;
  similarityThreshold: number;
  maxSearchResults: number;
  summaryTriggerTokens: number;
  keepLastTurns: number;
}

const DEFAULT_CONFIG: ContextBankConfig = {
  chunkSize: 500,
  chunkOverlap: 50,
  maxChunksPerDocument: 100,
  similarityThreshold: 0.65,
  maxSearchResults: 5,
  summaryTriggerTokens: 15000,
  keepLastTurns: 4,
};

// ============= UTILITY FUNCTIONS =============

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Chunk text into smaller pieces with overlap
 */
export function chunkText(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  let currentChunk = '';
  let lastOverlapText = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > size && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep last portion for overlap
      const words = currentChunk.split(' ');
      const overlapWords = Math.ceil(words.length * (overlap / size));
      lastOverlapText = words.slice(-overlapWords).join(' ');
      currentChunk = lastOverlapText + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Fallback for text without sentence breaks
  if (chunks.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += (size - overlap)) {
      chunks.push(text.slice(i, i + size));
    }
  }

  return chunks;
}

/**
 * Simple keyword search using fuzzy matching
 */
function keywordSearch(query: string, chunks: ContextChunk[]): ContextChunk[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  return chunks.filter(chunk => {
    const contentLower = chunk.content.toLowerCase();
    return queryWords.some(word => contentLower.includes(word));
  });
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============= CONTEXT BANK SERVICE =============

class ContextBankServiceClass {
  private banks: Map<string, ContextBank> = new Map();
  private config: ContextBankConfig = DEFAULT_CONFIG;
  private embeddingCache: Map<string, number[]> = new Map();

  /**
   * Configure the service
   */
  configure(config: Partial<ContextBankConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Create or get a context bank for a session
   */
  getOrCreateBank(sessionId: string, userId: string): ContextBank {
    let bank = this.banks.get(sessionId);

    if (!bank) {
      bank = {
        sessionId,
        userId,
        documents: [],
        conversationSummary: '',
        totalTokens: 0,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      };
      this.banks.set(sessionId, bank);
    }

    return bank;
  }

  /**
   * Get a context bank by session ID
   */
  getBank(sessionId: string): ContextBank | undefined {
    return this.banks.get(sessionId);
  }

  /**
   * Add and index a document
   */
  async addDocument(
    sessionId: string,
    userId: string,
    doc: { id: string; name: string; type: 'file' | 'text' | 'url'; content: string },
    apiKey: string,
    onProgress?: (progress: number) => void
  ): Promise<IndexedDocument> {
    const bank = this.getOrCreateBank(sessionId, userId);

    onProgress?.(0.1);

    // Check if document already exists
    const existingIndex = bank.documents.findIndex(d => d.id === doc.id);
    if (existingIndex >= 0) {
      bank.documents.splice(existingIndex, 1);
    }

    // Chunk the content
    const textChunks = chunkText(doc.content, this.config.chunkSize, this.config.chunkOverlap);
    const limitedChunks = textChunks.slice(0, this.config.maxChunksPerDocument);

    onProgress?.(0.2);

    // Generate summary
    let summary = '';
    try {
      summary = await processWithModel(
        apiKey,
        `Summarize this document in 1-2 sentences:\n\n${doc.content.slice(0, 2000)}`
      ) || '';
    } catch (e) {
      console.warn('Failed to generate summary:', e);
    }

    onProgress?.(0.3);

    // Create chunks with embeddings
    const chunks: ContextChunk[] = [];
    const totalChunks = limitedChunks.length;

    for (let i = 0; i < totalChunks; i++) {
      const chunkContent = limitedChunks[i];
      const chunkId = `${doc.id}-chunk-${i}`;

      // Check cache first
      let embedding = this.embeddingCache.get(chunkId);

      if (!embedding) {
        try {
          // Rate limiting - small delay between embedding calls
          if (i > 0) await new Promise(r => setTimeout(r, 100));

          embedding = await generateEmbedding(apiKey, chunkContent);
          if (embedding) {
            this.embeddingCache.set(chunkId, embedding);
          }
        } catch (e) {
          console.warn(`Failed to generate embedding for chunk ${i}:`, e);
        }
      }

      chunks.push({
        id: chunkId,
        content: chunkContent,
        embedding: embedding || undefined,
        sourceId: doc.id,
        sourceName: doc.name,
        chunkIndex: i,
      });

      // Progress from 30% to 90%
      const progress = 0.3 + (i / totalChunks) * 0.6;
      onProgress?.(progress);
    }

    const indexedDoc: IndexedDocument = {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      content: doc.content,
      summary,
      chunks,
      indexedAt: new Date(),
    };

    bank.documents.push(indexedDoc);
    bank.lastUpdatedAt = new Date();

    onProgress?.(1.0);

    console.log(`📚 Indexed document "${doc.name}" with ${chunks.length} chunks`);
    return indexedDoc;
  }

  /**
   * Remove a document from the context bank
   */
  removeDocument(sessionId: string, documentId: string): boolean {
    const bank = this.banks.get(sessionId);
    if (!bank) return false;

    const initialLength = bank.documents.length;
    bank.documents = bank.documents.filter(d => d.id !== documentId);

    // Clear cached embeddings for this document
    for (const [key] of this.embeddingCache) {
      if (key.startsWith(documentId)) {
        this.embeddingCache.delete(key);
      }
    }

    return bank.documents.length < initialLength;
  }

  /**
   * Search across all session documents using hybrid search
   */
  async search(
    sessionId: string,
    query: string,
    apiKey: string,
    options: { includeSupabase?: boolean; userId?: string; projectId?: string } = {}
  ): Promise<SearchResult[]> {
    const bank = this.banks.get(sessionId);
    const results: SearchResult[] = [];

    console.log(`🔍 Searching context bank for: "${query}"`);

    // 1. Generate query embedding
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await generateEmbedding(apiKey, query);
    } catch (e) {
      console.warn('Failed to generate query embedding:', e);
    }

    // 2. Search session documents (in-memory)
    if (bank && bank.documents.length > 0) {
      const allChunks = bank.documents.flatMap(d => d.chunks);

      // Semantic search if we have embeddings
      if (queryEmbedding) {
        for (const chunk of allChunks) {
          if (chunk.embedding) {
            const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
            if (similarity >= this.config.similarityThreshold) {
              results.push({
                source: chunk.sourceName,
                sourceId: chunk.sourceId,
                excerpt: chunk.content,
                similarity,
                chunkIndex: chunk.chunkIndex,
              });
            }
          }
        }
      }

      // Keyword search as fallback/supplement
      const keywordMatches = keywordSearch(query, allChunks);
      for (const chunk of keywordMatches) {
        // Avoid duplicates
        if (!results.some(r => r.sourceId === chunk.sourceId && r.chunkIndex === chunk.chunkIndex)) {
          results.push({
            source: chunk.sourceName,
            sourceId: chunk.sourceId,
            excerpt: chunk.content,
            similarity: 0.5, // Give keyword matches a baseline score
            chunkIndex: chunk.chunkIndex,
          });
        }
      }
    }

    // 3. Optionally search Supabase vector store
    if (options.includeSupabase && options.userId) {
      try {
        const supabaseResults = await ragService.searchSimilar(
          apiKey,
          query,
          options.userId,
          options.projectId
        );

        for (const result of supabaseResults) {
          results.push({
            source: result.title || 'Knowledge Base',
            sourceId: result.doc_id || result.id,
            excerpt: result.content || '',
            similarity: result.similarity || 0.7,
            chunkIndex: result.chunk_index || 0,
          });
        }
      } catch (e) {
        console.warn('Supabase search failed:', e);
      }
    }

    // Sort by similarity and limit results
    results.sort((a, b) => b.similarity - a.similarity);
    const limitedResults = results.slice(0, this.config.maxSearchResults);

    console.log(`📊 Found ${limitedResults.length} relevant results`);
    return limitedResults;
  }

  /**
   * Get relevant context formatted for injection into conversation
   */
  async getRelevantContext(
    sessionId: string,
    query: string,
    apiKey: string,
    maxTokens: number = 2000
  ): Promise<string> {
    const results = await this.search(sessionId, query, apiKey);

    if (results.length === 0) {
      return '';
    }

    let context = '';
    let tokenCount = 0;

    for (const result of results) {
      const excerpt = `[From ${result.source}]:\n${result.excerpt}\n\n`;
      const excerptTokens = estimateTokens(excerpt);

      if (tokenCount + excerptTokens > maxTokens) {
        break;
      }

      context += excerpt;
      tokenCount += excerptTokens;
    }

    return context.trim();
  }

  /**
   * Summarize old conversation turns to compress context
   */
  async summarizeConversation(
    sessionId: string,
    turns: ConversationTurn[],
    apiKey: string,
    keepLastN: number = this.config.keepLastTurns
  ): Promise<{ summary: string; turnsToRemove: string[] }> {
    const bank = this.banks.get(sessionId);

    if (turns.length <= keepLastN) {
      return { summary: '', turnsToRemove: [] };
    }

    const turnsToSummarize = turns.slice(0, -keepLastN);
    const turnsToRemove = turnsToSummarize.map(t => t.id);

    // Build conversation text
    const conversationText = turnsToSummarize
      .map(t => `${t.role.toUpperCase()}: ${t.content}`)
      .join('\n\n');

    // Generate summary
    let summary = '';
    try {
      summary = await processWithModel(
        apiKey,
        `Summarize this conversation concisely, preserving key facts, decisions, and context:\n\n${conversationText}`
      ) || '';
    } catch (e) {
      console.error('Failed to summarize conversation:', e);
      return { summary: '', turnsToRemove: [] };
    }

    // Update bank
    if (bank) {
      bank.conversationSummary = summary;
      bank.lastUpdatedAt = new Date();
    }

    console.log(`📝 Summarized ${turnsToSummarize.length} turns into ${estimateTokens(summary)} tokens`);
    return { summary, turnsToRemove };
  }

  /**
   * Check if summarization is needed based on token count
   */
  needsSummarization(tokenCount: number): boolean {
    return tokenCount >= this.config.summaryTriggerTokens;
  }

  /**
   * Get all document summaries for the session
   */
  getDocumentSummaries(sessionId: string): { name: string; summary: string }[] {
    const bank = this.banks.get(sessionId);
    if (!bank) return [];

    return bank.documents
      .filter(d => d.summary)
      .map(d => ({ name: d.name, summary: d.summary! }));
  }

  /**
   * Get context overview for initial system prompt
   */
  getContextOverview(sessionId: string): string {
    const bank = this.banks.get(sessionId);
    if (!bank || bank.documents.length === 0) {
      return '';
    }

    const docList = bank.documents.map(d => {
      const summary = d.summary ? ` - ${d.summary}` : '';
      return `• ${d.name}${summary}`;
    }).join('\n');

    return `\n\n# Available Context Documents\nThe user has provided the following documents. Use the rag_search tool to find specific information from these:\n\n${docList}`;
  }

  /**
   * Clear a session's context bank
   */
  clearBank(sessionId: string): void {
    const bank = this.banks.get(sessionId);
    if (bank) {
      // Clear embedding cache for this session
      for (const doc of bank.documents) {
        for (const chunk of doc.chunks) {
          this.embeddingCache.delete(chunk.id);
        }
      }
    }
    this.banks.delete(sessionId);
    console.log(`🗑️ Cleared context bank for session ${sessionId}`);
  }

  /**
   * Get statistics for a context bank
   */
  getStats(sessionId: string): {
    documentCount: number;
    totalChunks: number;
    totalTokens: number;
    hasSummary: boolean;
  } | null {
    const bank = this.banks.get(sessionId);
    if (!bank) return null;

    const totalChunks = bank.documents.reduce((sum, d) => sum + d.chunks.length, 0);
    const totalContent = bank.documents.reduce((sum, d) => sum + d.content.length, 0);

    return {
      documentCount: bank.documents.length,
      totalChunks,
      totalTokens: estimateTokens(totalContent.toString()) + bank.totalTokens,
      hasSummary: !!bank.conversationSummary,
    };
  }
}

// Export singleton instance
export const contextBankService = new ContextBankServiceClass();
