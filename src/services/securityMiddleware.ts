/**
 * Security Middleware Service
 * Provides input validation, sanitization, rate limiting, and security utilities
 */

import DOMPurify from 'isomorphic-dompurify';

// ==================== Types ====================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ==================== Constants ====================

const MAX_MESSAGE_LENGTH = 10000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
];

// Rate limiting store (in-memory, use Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// ==================== Input Sanitization ====================

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMPurify to remove malicious scripts and tags
 */
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize plain text by removing potentially dangerous patterns
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Sanitize URL to prevent protocol injection
 */
export function sanitizeURL(url: string): string {
  try {
    const parsed = new URL(url);

    // Only allow http, https, and mailto protocols
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Remove SQL injection patterns (defense in depth, Supabase handles this)
 */
export function sanitizeSQL(input: string): string {
  return input
    .replace(/(['";]|--|\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi, '')
    .trim();
}

// ==================== Input Validation ====================

/**
 * Validate message content
 */
export function validateMessage(content: string): ValidationResult {
  const errors: string[] = [];

  if (!content || typeof content !== 'string') {
    errors.push('Message content is required');
  } else if (content.trim().length === 0) {
    errors.push('Message cannot be empty');
  } else if (content.length > MAX_MESSAGE_LENGTH) {
    errors.push(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`);
  }

  // Check for suspicious patterns
  if (/<script/i.test(content)) {
    errors.push('Message contains potentially malicious content');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate file upload
 */
export function validateFile(file: File): ValidationResult {
  const errors: string[] = [];

  if (!file) {
    errors.push('No file provided');
    return { valid: false, errors };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }

  // Check filename for suspicious patterns
  if (/[<>:"|?*\\]/.test(file.name)) {
    errors.push('File name contains invalid characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate URL
 */
export function validateURL(url: string): ValidationResult {
  const errors: string[] = [];

  if (!url || typeof url !== 'string') {
    errors.push('URL is required');
    return { valid: false, errors };
  }

  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push('Only HTTP and HTTPS protocols are allowed');
    }

    // Block localhost and internal IPs (SSRF protection)
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.')
    ) {
      errors.push('Internal network addresses are not allowed');
    }
  } catch {
    errors.push('Invalid URL format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate channel name
 */
export function validateChannelName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || typeof name !== 'string') {
    errors.push('Channel name is required');
  } else if (name.trim().length < 2) {
    errors.push('Channel name must be at least 2 characters');
  } else if (name.length > 100) {
    errors.push('Channel name must be less than 100 characters');
  } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    errors.push('Channel name can only contain letters, numbers, spaces, hyphens, and underscores');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ==================== Rate Limiting ====================

/**
 * Check if user is within rate limit
 */
export function checkRateLimit(
  userId: string,
  config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 }
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `ratelimit:${userId}`;
  const now = Date.now();

  // Get or create entry
  let entry = rateLimitStore.get(key);

  // Reset if window expired
  if (entry && now > entry.resetAt) {
    rateLimitStore.delete(key);
    entry = undefined;
  }

  if (!entry) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
  }

  // Check limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Reset rate limit for a user (use sparingly)
 */
export function resetRateLimit(userId: string): void {
  rateLimitStore.delete(`ratelimit:${userId}`);
}

/**
 * Clean up expired rate limit entries
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

// ==================== Request Throttling ====================

const throttleStore = new Map<string, number>();

/**
 * Throttle function calls (debounce)
 * Prevents rapid repeated calls to expensive operations
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  key: string
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const last = throttleStore.get(key) || 0;

    if (now - last >= delay) {
      throttleStore.set(key, now);
      fn(...args);
    }
  };
}

/**
 * Debounce function calls
 * Delays execution until after wait time has elapsed since last call
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// ==================== CSRF Protection ====================

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, expected: string): boolean {
  if (!token || !expected) return false;
  if (token.length !== expected.length) return false;

  // Timing-safe comparison
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

// ==================== Content Security ====================

/**
 * Detect potentially malicious content patterns
 */
export function detectMaliciousContent(content: string): { safe: boolean; reason?: string } {
  const patterns = [
    { regex: /<script[^>]*>.*?<\/script>/gi, reason: 'Contains script tags' },
    { regex: /javascript:/gi, reason: 'Contains JavaScript protocol' },
    { regex: /on\w+\s*=/gi, reason: 'Contains event handlers' },
    { regex: /<iframe/gi, reason: 'Contains iframe tags' },
    { regex: /<embed/gi, reason: 'Contains embed tags' },
    { regex: /<object/gi, reason: 'Contains object tags' },
    { regex: /data:text\/html/gi, reason: 'Contains data URI' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(content)) {
      return { safe: false, reason: pattern.reason };
    }
  }

  return { safe: true };
}

/**
 * Check if content contains sensitive information
 */
export function detectSensitiveData(content: string): { found: boolean; types: string[] } {
  const types: string[] = [];

  // Credit card number (basic pattern)
  if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(content)) {
    types.push('credit_card');
  }

  // SSN pattern
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(content)) {
    types.push('ssn');
  }

  // API keys (common patterns)
  if (/[a-zA-Z0-9]{32,}/.test(content) && /key|token|secret|api/i.test(content)) {
    types.push('api_key');
  }

  // Email addresses in large quantities (potential data leak)
  const emailMatches = content.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g);
  if (emailMatches && emailMatches.length > 5) {
    types.push('email_list');
  }

  return {
    found: types.length > 0,
    types,
  };
}

// ==================== Exponential Backoff ====================

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }

      if (attempt < maxAttempts - 1) {
        const delay = calculateBackoff(attempt, baseDelay);
        console.log(`Retry attempt ${attempt + 1}/${maxAttempts} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

// ==================== Export All ====================

export const securityMiddleware = {
  // Sanitization
  sanitizeHTML,
  sanitizeText,
  sanitizeURL,
  sanitizeSQL,

  // Validation
  validateMessage,
  validateEmail,
  validateFile,
  validateURL,
  validateChannelName,

  // Rate limiting
  checkRateLimit,
  resetRateLimit,
  cleanupRateLimits,

  // Throttling
  throttle,
  debounce,

  // CSRF
  generateCSRFToken,
  validateCSRFToken,

  // Content security
  detectMaliciousContent,
  detectSensitiveData,

  // Retry logic
  calculateBackoff,
  retryWithBackoff,
};

export default securityMiddleware;
