/**
 * Rate Limiting Service
 *
 * CRITICAL SECURITY - P1 Priority
 *
 * Implements comprehensive client-side rate limiting to prevent abuse
 * and manage API quota usage. Uses IndexedDB for persistent tracking
 * across sessions and browser refreshes.
 *
 * Security Features:
 * - Per-user rate limiting
 * - Per-API-type rate limiting
 * - Sliding window algorithm
 * - Persistent storage via IndexedDB
 * - Automatic cleanup of expired records
 * - Configurable limits per operation type
 */

// ==================== Types ====================

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

export interface RateLimitRecord {
  key: string;
  userId: string;
  timestamps: number[];
  windowStart: number;
}

// ==================== Configuration ====================

/**
 * Rate limit configurations for different API types
 * Limits are per hour unless specified otherwise
 */
export const RATE_LIMITS = {
  // AI API Calls
  api_gemini: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'AI API rate limit exceeded. Please wait before making more requests.',
  },
  api_openai: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000,
    message: 'AI API rate limit exceeded. Please wait before making more requests.',
  },
  api_anthropic: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000,
    message: 'AI API rate limit exceeded. Please wait before making more requests.',
  },

  // File Operations
  file_upload: {
    maxRequests: 50,
    windowMs: 60 * 60 * 1000,
    message: 'File upload limit exceeded. Please wait before uploading more files.',
  },
  file_download: {
    maxRequests: 200,
    windowMs: 60 * 60 * 1000,
    message: 'File download limit exceeded. Please wait before downloading more files.',
  },

  // Message Operations
  message_send: {
    maxRequests: 500,
    windowMs: 60 * 60 * 1000,
    message: 'Message send limit exceeded. Please slow down.',
  },
  message_edit: {
    maxRequests: 200,
    windowMs: 60 * 60 * 1000,
    message: 'Message edit limit exceeded. Please wait before editing more messages.',
  },
  message_delete: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Message delete limit exceeded. Please wait before deleting more messages.',
  },

  // Export Operations
  export_csv: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000,
    message: 'Export limit exceeded. Please wait before exporting more data.',
  },
  export_pdf: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000,
    message: 'Export limit exceeded. Please wait before exporting more data.',
  },

  // Search Operations
  search_query: {
    maxRequests: 300,
    windowMs: 60 * 60 * 1000,
    message: 'Search limit exceeded. Please wait before searching again.',
  },

  // Authentication
  auth_login: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many login attempts. Please try again later.',
  },
  auth_signup: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
    message: 'Too many signup attempts. Please try again later.',
  },
  auth_password_reset: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
    message: 'Too many password reset attempts. Please try again later.',
  },

  // CRM Operations
  crm_sync: {
    maxRequests: 50,
    windowMs: 60 * 60 * 1000,
    message: 'CRM sync limit exceeded. Please wait before syncing again.',
  },
  crm_update: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000,
    message: 'CRM update limit exceeded. Please wait before updating more records.',
  },

  // Email Operations
  email_send: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Email send limit exceeded. Please wait before sending more emails.',
  },

  // Voice/Audio Operations
  voice_transcribe: {
    maxRequests: 30,
    windowMs: 60 * 60 * 1000,
    message: 'Voice transcription limit exceeded. Please wait before transcribing more audio.',
  },
} as const;

// ==================== IndexedDB Setup ====================

const DB_NAME = 'PulseRateLimitDB';
const DB_VERSION = 1;
const STORE_NAME = 'rateLimits';

class RateLimitDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;

        // Create store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('userId', 'userId', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  async get(key: string): Promise<RateLimitRecord | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async set(record: RateLimitRecord): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllKeys(): Promise<string[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// ==================== Rate Limit Service ====================

class RateLimitService {
  private db: RateLimitDB;
  private cleanupInterval: number | null = null;

  constructor() {
    this.db = new RateLimitDB();
    this.startCleanup();
  }

  /**
   * Start automatic cleanup of expired records
   */
  private startCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupExpiredRecords();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove expired records from database
   */
  private async cleanupExpiredRecords(): Promise<void> {
    try {
      const keys = await this.db.getAllKeys();
      const now = Date.now();

      for (const key of keys) {
        const record = await this.db.get(key);
        if (!record) continue;

        // Get the config for this key type
        const keyType = key.split(':')[0];
        const config = RATE_LIMITS[keyType as keyof typeof RATE_LIMITS];

        if (!config) {
          // Unknown key type, delete it
          await this.db.delete(key);
          continue;
        }

        // If all timestamps are outside the window, delete the record
        const cutoff = now - config.windowMs;
        const validTimestamps = record.timestamps.filter((ts) => ts > cutoff);

        if (validTimestamps.length === 0) {
          await this.db.delete(key);
        }
      }
    } catch (error) {
      console.error('Rate limit cleanup error:', error);
    }
  }

  /**
   * Generate a unique key for rate limiting
   */
  private getKey(rateLimitType: string, userId: string): string {
    return `${rateLimitType}:${userId}`;
  }

  /**
   * Check if a request is allowed under rate limits
   */
  async checkLimit(rateLimitType: string, userId: string): Promise<RateLimitCheck> {
    const config = RATE_LIMITS[rateLimitType as keyof typeof RATE_LIMITS];

    if (!config) {
      console.warn('Unknown rate limit type:', rateLimitType);
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: 0,
        retryAfter: 0,
      };
    }

    const key = this.getKey(rateLimitType, userId);
    const now = Date.now();
    const cutoff = now - config.windowMs;

    // Get existing record
    let record = await this.db.get(key);

    if (!record) {
      record = {
        key,
        userId,
        timestamps: [],
        windowStart: now,
      };
    }

    // Filter out timestamps outside the window (sliding window)
    record.timestamps = record.timestamps.filter((ts) => ts > cutoff);

    // Check if limit exceeded
    const allowed = record.timestamps.length < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - record.timestamps.length);

    // Calculate reset time (when oldest timestamp expires)
    const oldestTimestamp = record.timestamps[0] || now;
    const resetTime = oldestTimestamp + config.windowMs;
    const retryAfter = allowed ? 0 : Math.max(0, resetTime - now);

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter,
    };
  }

  /**
   * Record a request (call this after a successful request)
   */
  async recordRequest(rateLimitType: string, userId: string): Promise<void> {
    const key = this.getKey(rateLimitType, userId);
    const now = Date.now();

    let record = await this.db.get(key);

    if (!record) {
      record = {
        key,
        userId,
        timestamps: [],
        windowStart: now,
      };
    }

    // Add current timestamp
    record.timestamps.push(now);

    // Save updated record
    await this.db.set(record);
  }

  /**
   * Get current rate limit status
   */
  async getStatus(rateLimitType: string, userId: string): Promise<RateLimitCheck> {
    return this.checkLimit(rateLimitType, userId);
  }

  /**
   * Reset rate limits for a specific type and user
   */
  async reset(rateLimitType: string, userId: string): Promise<void> {
    const key = this.getKey(rateLimitType, userId);
    await this.db.delete(key);
  }

  /**
   * Reset all rate limits for a user
   */
  async resetAll(userId: string): Promise<void> {
    const keys = await this.db.getAllKeys();
    for (const key of keys) {
      if (key.endsWith(`:${userId}`)) {
        await this.db.delete(key);
      }
    }
  }

  /**
   * Clear all rate limit data
   */
  async clearAll(): Promise<void> {
    await this.db.clear();
  }

  /**
   * Get all rate limit statuses for a user
   */
  async getAllStatuses(userId: string): Promise<Record<string, RateLimitCheck>> {
    const statuses: Record<string, RateLimitCheck> = {};

    for (const rateLimitType of Object.keys(RATE_LIMITS)) {
      statuses[rateLimitType] = await this.getStatus(rateLimitType, userId);
    }

    return statuses;
  }

  /**
   * Check and record in one operation (convenience method)
   */
  async checkAndRecord(rateLimitType: string, userId: string): Promise<RateLimitCheck> {
    const check = await this.checkLimit(rateLimitType, userId);

    if (check.allowed) {
      await this.recordRequest(rateLimitType, userId);
    }

    return check;
  }
}

// ==================== Export ====================

export const rateLimitService = new RateLimitService();

// Export for testing
export { RateLimitDB };
