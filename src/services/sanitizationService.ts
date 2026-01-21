/**
 * Sanitization Service
 *
 * CRITICAL SECURITY - P0 Priority
 *
 * Comprehensive input sanitization to prevent XSS, injection attacks,
 * and malicious content. Uses DOMPurify for HTML sanitization and
 * custom validators for other content types.
 *
 * Security Features:
 * - XSS prevention via DOMPurify
 * - SQL injection prevention
 * - Script tag removal
 * - URL validation and sanitization
 * - JSON sanitization
 * - Path traversal prevention
 */

import DOMPurify from 'isomorphic-dompurify';

// ==================== Types ====================

export type SanitizationLevel = 'strict' | 'normal' | 'relaxed';

export interface SanitizationOptions {
  level?: SanitizationLevel;
  allowedTags?: string[];
  allowedAttributes?: string[];
  maxLength?: number;
  stripHtml?: boolean;
}

export interface SanitizationResult {
  sanitized: string;
  changed: boolean;
  removedElements: string[];
  warnings: string[];
}

// ==================== Configuration ====================

/**
 * Sanitization level configurations
 */
const SANITIZATION_CONFIGS = {
  strict: {
    allowedTags: ['p', 'br', 'b', 'i', 'em', 'strong', 'a'],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  },
  normal: {
    allowedTags: [
      'p',
      'br',
      'b',
      'i',
      'em',
      'strong',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'img',
      'span',
      'div',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['class'],
      div: ['class'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
  },
  relaxed: {
    allowedTags: DOMPurify.Config.ALLOWED_TAGS,
    allowedAttributes: DOMPurify.Config.ALLOWED_ATTR,
    allowedSchemes: ['http', 'https', 'mailto', 'ftp', 'data'],
  },
} as const;

/**
 * Dangerous patterns to detect and remove
 */
const DANGEROUS_PATTERNS = [
  /javascript:/gi,
  /on\w+\s*=/gi, // Event handlers
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /vbscript:/gi,
  /import\s+\(/gi,
];

/**
 * SQL injection patterns
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
  /(--|\|\||;)/g,
  /('\s*(OR|AND)\s*'?\d+|'\s*=\s*')/gi,
  /(UNION\s+SELECT)/gi,
];

/**
 * Path traversal patterns
 */
const PATH_TRAVERSAL_PATTERNS = [/\.\.[\/\\]/g, /\%2e\%2e[\/\\]/gi, /\.\.%2f/gi, /\.\.%5c/gi];

// ==================== Sanitization Service ====================

class SanitizationService {
  /**
   * Decode HTML entities safely without using innerHTML
   */
  private decodeHtmlEntities(text: string): string {
    // Create a temporary DOM element for safe HTML entity decoding
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.documentElement.textContent || text;
  }

  /**
   * Sanitize HTML content with DOMPurify
   */
  sanitizeHtml(html: string, options: SanitizationOptions = {}): SanitizationResult {
    const level = options.level || 'normal';
    const config = SANITIZATION_CONFIGS[level];

    const originalLength = html.length;
    const warnings: string[] = [];
    const removedElements: string[] = [];

    // Check for dangerous patterns before sanitization
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(html)) {
        warnings.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }

    // Configure DOMPurify
    const purifyConfig: any = {
      ALLOWED_TAGS: options.allowedTags || config.allowedTags,
      ALLOWED_ATTR: options.allowedAttributes || config.allowedAttributes,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_TRUSTED_TYPE: false,
    };

    // Add hooks to track removed elements
    DOMPurify.addHook('uponSanitizeElement', (node: any, data: any) => {
      if (data.allowedTags && !data.allowedTags[data.tagName]) {
        removedElements.push(data.tagName);
      }
    });

    // Sanitize
    const sanitized = DOMPurify.sanitize(html, purifyConfig);

    // Remove hooks
    DOMPurify.removeAllHooks();

    // Check length limit
    if (options.maxLength && sanitized.length > options.maxLength) {
      warnings.push(`Content truncated from ${sanitized.length} to ${options.maxLength} characters`);
      return {
        sanitized: sanitized.substring(0, options.maxLength),
        changed: true,
        removedElements: Array.from(new Set(removedElements)),
        warnings,
      };
    }

    return {
      sanitized,
      changed: sanitized !== html || sanitized.length !== originalLength,
      removedElements: Array.from(new Set(removedElements)),
      warnings,
    };
  }

  /**
   * Sanitize plain text (remove all HTML)
   */
  sanitizeText(text: string, options: { maxLength?: number } = {}): string {
    if (!text) return '';

    // Remove all HTML tags
    let sanitized = text.replace(/<[^>]*>/g, '');

    // Decode HTML entities safely
    sanitized = this.decodeHtmlEntities(sanitized);

    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Apply length limit
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Sanitize URL
   */
  sanitizeUrl(url: string): string | null {
    if (!url || typeof url !== 'string') return null;

    const trimmed = url.trim();

    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    for (const protocol of dangerousProtocols) {
      if (trimmed.toLowerCase().startsWith(protocol)) {
        console.warn('Blocked dangerous URL protocol:', protocol);
        return null;
      }
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(trimmed);

      // Only allow http, https, and mailto
      if (!['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)) {
        console.warn('Blocked non-standard protocol:', parsedUrl.protocol);
        return null;
      }

      return parsedUrl.toString();
    } catch (error) {
      // If not a valid URL, check if it's a relative path
      if (trimmed.startsWith('/') && !trimmed.includes('..')) {
        return trimmed;
      }

      console.warn('Invalid URL format:', trimmed);
      return null;
    }
  }

  /**
   * Sanitize file path (prevent path traversal)
   */
  sanitizeFilePath(path: string): string | null {
    if (!path || typeof path !== 'string') return null;

    const trimmed = path.trim();

    // Check for path traversal attempts
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(trimmed)) {
        console.warn('Path traversal attempt detected:', trimmed);
        return null;
      }
    }

    // Remove any null bytes
    const sanitized = trimmed.replace(/\0/g, '');

    // Normalize path separators
    const normalized = sanitized.replace(/\\/g, '/');

    // Remove leading slashes for relative paths
    return normalized.replace(/^\/+/, '');
  }

  /**
   * Sanitize JSON object (deep sanitization)
   */
  sanitizeObject(obj: any, options: SanitizationOptions = {}): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle primitive types
    if (typeof obj === 'string') {
      return this.sanitizeText(obj, { maxLength: options.maxLength });
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, options));
    }

    // Handle objects
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key
        const sanitizedKey = this.sanitizeText(key);

        // Sanitize value recursively
        sanitized[sanitizedKey] = this.sanitizeObject(value, options);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Check for SQL injection attempts
   */
  detectSqlInjection(input: string): boolean {
    if (!input || typeof input !== 'string') return false;

    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        console.warn('Potential SQL injection detected:', input);
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitize SQL input (for queries)
   */
  sanitizeSqlInput(input: string): string {
    if (!input || typeof input !== 'string') return '';

    // Escape single quotes
    let sanitized = input.replace(/'/g, "''");

    // Remove SQL keywords and dangerous characters
    sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi, '');
    sanitized = sanitized.replace(/(--|;|\|\|)/g, '');

    return sanitized;
  }

  /**
   * Sanitize email address
   */
  sanitizeEmail(email: string): string | null {
    if (!email || typeof email !== 'string') return null;

    const trimmed = email.trim().toLowerCase();

    // Basic email validation
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      console.warn('Invalid email format:', email);
      return null;
    }

    // Check for dangerous characters
    if (/[<>;"'\\]/.test(trimmed)) {
      console.warn('Email contains dangerous characters:', email);
      return null;
    }

    return trimmed;
  }

  /**
   * Sanitize phone number
   */
  sanitizePhoneNumber(phone: string): string {
    if (!phone || typeof phone !== 'string') return '';

    // Remove all non-digit characters except + at the start
    let sanitized = phone.replace(/[^\d+]/g, '');

    // Ensure + is only at the start
    if (sanitized.includes('+')) {
      const hasLeadingPlus = sanitized.startsWith('+');
      sanitized = sanitized.replace(/\+/g, '');
      if (hasLeadingPlus) {
        sanitized = '+' + sanitized;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize filename
   */
  sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') return '';

    // Remove path separators
    let sanitized = filename.replace(/[\/\\]/g, '');

    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '');

    // Limit length
    if (sanitized.length > 255) {
      const ext = sanitized.split('.').pop();
      const name = sanitized.substring(0, 250 - (ext?.length || 0));
      sanitized = ext ? `${name}.${ext}` : name;
    }

    return sanitized || 'unnamed';
  }

  /**
   * Sanitize message content (for chat/messages)
   */
  sanitizeMessageContent(content: string, allowHtml: boolean = false): string {
    if (!content || typeof content !== 'string') return '';

    if (allowHtml) {
      const result = this.sanitizeHtml(content, {
        level: 'normal',
        maxLength: 10000, // 10k chars max for messages
      });
      return result.sanitized;
    }

    return this.sanitizeText(content, { maxLength: 10000 });
  }

  /**
   * Sanitize user profile data
   */
  sanitizeUserProfile(profile: {
    name?: string;
    email?: string;
    bio?: string;
    phone?: string;
    avatar?: string;
    [key: string]: any;
  }): any {
    const sanitized: any = {};

    if (profile.name) {
      sanitized.name = this.sanitizeText(profile.name, { maxLength: 100 });
    }

    if (profile.email) {
      sanitized.email = this.sanitizeEmail(profile.email);
    }

    if (profile.bio) {
      sanitized.bio = this.sanitizeText(profile.bio, { maxLength: 500 });
    }

    if (profile.phone) {
      sanitized.phone = this.sanitizePhoneNumber(profile.phone);
    }

    if (profile.avatar) {
      sanitized.avatar = this.sanitizeUrl(profile.avatar);
    }

    // Sanitize any other string fields
    for (const [key, value] of Object.entries(profile)) {
      if (!sanitized[key] && typeof value === 'string') {
        sanitized[key] = this.sanitizeText(value, { maxLength: 1000 });
      }
    }

    return sanitized;
  }

  /**
   * Validate and sanitize JSON input
   */
  sanitizeJsonInput(jsonString: string): any | null {
    if (!jsonString || typeof jsonString !== 'string') return null;

    try {
      const parsed = JSON.parse(jsonString);
      return this.sanitizeObject(parsed);
    } catch (error) {
      console.warn('Invalid JSON input:', error);
      return null;
    }
  }

  /**
   * Create a safe preview of potentially unsafe content
   */
  createSafePreview(content: string, maxLength: number = 100): string {
    const sanitized = this.sanitizeText(content);
    if (sanitized.length <= maxLength) {
      return sanitized;
    }
    return sanitized.substring(0, maxLength) + '...';
  }
}

// ==================== Export ====================

export const sanitizationService = new SanitizationService();

// Export types
export type { SanitizationOptions, SanitizationResult };
