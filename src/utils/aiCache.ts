/**
 * AI Result Caching Utilities
 * Provides caching for expensive AI operations
 */

import { ComparisonResult, KnowledgeGraph } from '../types/advancedAI';

// Cache configuration
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 50;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

class AIResultCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = MAX_CACHE_SIZE, ttl = CACHE_TTL) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generate a cache key from document IDs
   */
  generateKey(docIds: string[], prefix: string = ''): string {
    const sortedIds = [...docIds].sort().join('-');
    return `${prefix}:${sortedIds}`;
  }

  /**
   * Get cached result
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached result
   */
  set(key: string, data: T): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.getOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      key,
    });
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries containing a specific document ID
   */
  invalidateByDocId(docId: string): void {
    for (const [key] of this.cache) {
      if (key.includes(docId)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }

  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}

// Singleton instances for different cache types
export const comparisonCache = new AIResultCache<ComparisonResult>();
export const knowledgeGraphCache = new AIResultCache<KnowledgeGraph>();

// Helper functions

/**
 * Get or compute comparison result with caching
 */
export async function getCachedComparison(
  docIds: string[],
  computeFn: () => Promise<ComparisonResult>
): Promise<ComparisonResult> {
  const key = comparisonCache.generateKey(docIds, 'comparison');

  const cached = comparisonCache.get(key);
  if (cached) {
    console.log('[AICache] Comparison cache hit:', key);
    return cached;
  }

  console.log('[AICache] Comparison cache miss, computing:', key);
  const result = await computeFn();
  comparisonCache.set(key, result);
  return result;
}

/**
 * Get or compute knowledge graph with caching
 */
export async function getCachedKnowledgeGraph(
  docIds: string[],
  computeFn: () => Promise<KnowledgeGraph>
): Promise<KnowledgeGraph> {
  const key = knowledgeGraphCache.generateKey(docIds, 'graph');

  const cached = knowledgeGraphCache.get(key);
  if (cached) {
    console.log('[AICache] Knowledge graph cache hit:', key);
    return cached;
  }

  console.log('[AICache] Knowledge graph cache miss, computing:', key);
  const result = await computeFn();
  knowledgeGraphCache.set(key, result);
  return result;
}

/**
 * Invalidate all caches for a document
 */
export function invalidateDocumentCaches(docId: string): void {
  comparisonCache.invalidateByDocId(docId);
  knowledgeGraphCache.invalidateByDocId(docId);
}

/**
 * Clear all AI caches
 */
export function clearAllAICaches(): void {
  comparisonCache.clear();
  knowledgeGraphCache.clear();
}

// LocalStorage persistence for offline support
const STORAGE_KEY = 'pulse_ai_cache';

/**
 * Save caches to localStorage
 */
export function persistCaches(): void {
  try {
    // Only persist recent items to avoid storage limits
    const data = {
      comparison: Array.from((comparisonCache as any).cache.entries()).slice(-10),
      graph: Array.from((knowledgeGraphCache as any).cache.entries()).slice(-10),
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[AICache] Failed to persist caches:', e);
  }
}

/**
 * Restore caches from localStorage
 */
export function restoreCaches(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const data = JSON.parse(stored);

    // Only restore if data is less than 1 hour old
    if (Date.now() - data.timestamp > 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    for (const [key, entry] of data.comparison || []) {
      (comparisonCache as any).cache.set(key, entry);
    }

    for (const [key, entry] of data.graph || []) {
      (knowledgeGraphCache as any).cache.set(key, entry);
    }

    console.log('[AICache] Restored caches from localStorage');
  } catch (e) {
    console.warn('[AICache] Failed to restore caches:', e);
  }
}

// Auto-persist on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', persistCaches);
}
