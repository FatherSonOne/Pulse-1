/**
 * Security Utilities
 *
 * CRITICAL SECURITY - P1 Priority
 *
 * Collection of security utility functions for:
 * - CSRF token generation and validation
 * - Content Security Policy helpers
 * - Request signature validation
 * - Secure random generation
 * - Security headers
 */

// ==================== Types ====================

export interface CSRFToken {
  token: string;
  expiresAt: number;
}

export interface SecurityHeaders {
  'Content-Security-Policy': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Strict-Transport-Security': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
}

export interface RequestSignature {
  signature: string;
  timestamp: number;
  nonce: string;
}

// ==================== CSRF Protection ====================

class CSRFProtection {
  private readonly TOKEN_KEY = 'pulse_csrf_token';
  private readonly TOKEN_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Generate a new CSRF token
   */
  generateToken(): CSRFToken {
    const token = this.generateSecureRandom(32);
    const expiresAt = Date.now() + this.TOKEN_LIFETIME;

    const csrfToken: CSRFToken = { token, expiresAt };

    // Store in sessionStorage
    sessionStorage.setItem(this.TOKEN_KEY, JSON.stringify(csrfToken));

    return csrfToken;
  }

  /**
   * Get current CSRF token (generate if not exists or expired)
   */
  getToken(): string {
    const stored = sessionStorage.getItem(this.TOKEN_KEY);

    if (stored) {
      try {
        const csrfToken: CSRFToken = JSON.parse(stored);

        // Check if expired
        if (Date.now() < csrfToken.expiresAt) {
          return csrfToken.token;
        }
      } catch (error) {
        console.error('Failed to parse CSRF token:', error);
      }
    }

    // Generate new token if none exists or expired
    const newToken = this.generateToken();
    return newToken.token;
  }

  /**
   * Validate CSRF token
   */
  validateToken(token: string): boolean {
    const stored = sessionStorage.getItem(this.TOKEN_KEY);

    if (!stored) {
      return false;
    }

    try {
      const csrfToken: CSRFToken = JSON.parse(stored);

      // Check expiration
      if (Date.now() >= csrfToken.expiresAt) {
        return false;
      }

      // Check token match
      return csrfToken.token === token;
    } catch (error) {
      console.error('CSRF token validation error:', error);
      return false;
    }
  }

  /**
   * Clear CSRF token
   */
  clearToken(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
  }

  /**
   * Generate secure random string
   */
  private generateSecureRandom(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}

// ==================== Content Security Policy ====================

class ContentSecurityPolicy {
  /**
   * Generate CSP header value
   */
  generateCSPHeader(options: {
    allowInlineStyles?: boolean;
    allowInlineScripts?: boolean;
    allowEval?: boolean;
    allowedDomains?: string[];
  } = {}): string {
    const directives: string[] = [];

    // Default-src: fallback for other directives
    directives.push("default-src 'self'");

    // Script-src: where scripts can be loaded from
    const scriptSrc = ["'self'"];
    if (options.allowInlineScripts) {
      scriptSrc.push("'unsafe-inline'");
    }
    if (options.allowEval) {
      scriptSrc.push("'unsafe-eval'");
    }
    if (options.allowedDomains) {
      scriptSrc.push(...options.allowedDomains);
    }
    directives.push(`script-src ${scriptSrc.join(' ')}`);

    // Style-src: where styles can be loaded from
    const styleSrc = ["'self'"];
    if (options.allowInlineStyles) {
      styleSrc.push("'unsafe-inline'");
    }
    directives.push(`style-src ${styleSrc.join(' ')}`);

    // Img-src: where images can be loaded from
    directives.push("img-src 'self' data: https:");

    // Font-src: where fonts can be loaded from
    directives.push("font-src 'self' data:");

    // Connect-src: where fetch/XHR can connect to
    directives.push("connect-src 'self' https:");

    // Frame-ancestors: prevent clickjacking
    directives.push("frame-ancestors 'none'");

    // Base-uri: restrict base tag
    directives.push("base-uri 'self'");

    // Form-action: restrict form submissions
    directives.push("form-action 'self'");

    return directives.join('; ');
  }

  /**
   * Get recommended CSP for the application
   */
  getRecommendedCSP(): string {
    return this.generateCSPHeader({
      allowInlineStyles: true, // Required for some CSS-in-JS
      allowInlineScripts: false,
      allowEval: false,
      allowedDomains: [
        'https://generativelanguage.googleapis.com', // Gemini API
        'https://api.openai.com', // OpenAI API
        'https://api.anthropic.com', // Anthropic API
      ],
    });
  }

  /**
   * Apply CSP meta tag to document
   */
  applyCSPMetaTag(csp?: string): void {
    const cspContent = csp || this.getRecommendedCSP();

    // Remove existing CSP meta tag
    const existingMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existingMeta) {
      existingMeta.remove();
    }

    // Add new CSP meta tag
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = cspContent;
    document.head.appendChild(meta);
  }
}

// ==================== Security Headers ====================

class SecurityHeadersManager {
  /**
   * Get recommended security headers
   */
  getRecommendedHeaders(): SecurityHeaders {
    return {
      'Content-Security-Policy': new ContentSecurityPolicy().getRecommendedCSP(),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
  }

  /**
   * Validate that response has security headers
   */
  validateResponseHeaders(headers: Headers): {
    secure: boolean;
    missingHeaders: string[];
    warnings: string[];
  } {
    const recommended = this.getRecommendedHeaders();
    const missingHeaders: string[] = [];
    const warnings: string[] = [];

    for (const [header, value] of Object.entries(recommended)) {
      if (!headers.has(header)) {
        missingHeaders.push(header);
      }
    }

    // Check for insecure configurations
    const csp = headers.get('Content-Security-Policy');
    if (csp && csp.includes('unsafe-eval')) {
      warnings.push('CSP allows unsafe-eval');
    }

    return {
      secure: missingHeaders.length === 0,
      missingHeaders,
      warnings,
    };
  }
}

// ==================== Request Signing ====================

class RequestSigner {
  /**
   * Generate request signature
   */
  async signRequest(
    method: string,
    url: string,
    body: any,
    secretKey: string
  ): Promise<RequestSignature> {
    const timestamp = Date.now();
    const nonce = this.generateNonce();

    // Create signature payload
    const payload = JSON.stringify({
      method,
      url,
      body,
      timestamp,
      nonce,
    });

    // Generate signature using HMAC-SHA256
    const signature = await this.hmacSHA256(payload, secretKey);

    return {
      signature,
      timestamp,
      nonce,
    };
  }

  /**
   * Verify request signature
   */
  async verifySignature(
    signature: RequestSignature,
    method: string,
    url: string,
    body: any,
    secretKey: string,
    maxAge: number = 5 * 60 * 1000 // 5 minutes
  ): Promise<boolean> {
    // Check timestamp age
    const age = Date.now() - signature.timestamp;
    if (age > maxAge) {
      console.warn('Request signature expired');
      return false;
    }

    // Recreate payload
    const payload = JSON.stringify({
      method,
      url,
      body,
      timestamp: signature.timestamp,
      nonce: signature.nonce,
    });

    // Verify signature
    const expectedSignature = await this.hmacSHA256(payload, secretKey);
    return expectedSignature === signature.signature;
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private async hmacSHA256(message: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);

    // Convert to hex string
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate cryptographic nonce
   */
  private generateNonce(length: number = 16): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}

// ==================== Secure Random Generation ====================

class SecureRandom {
  /**
   * Generate secure random string
   */
  generateString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate secure random number
   */
  generateNumber(min: number, max: number): number {
    const range = max - min;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return min + (array[0] % range);
  }

  /**
   * Generate UUID v4
   */
  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate secure API key
   */
  generateApiKey(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    return Array.from(array, (byte) => chars[byte % chars.length]).join('');
  }
}

// ==================== Input Validation Helpers ====================

export const securityValidators = {
  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  },

  /**
   * Validate URL format
   */
  isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },

  /**
   * Validate UUID format
   */
  isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  /**
   * Check if string contains only alphanumeric characters
   */
  isAlphanumeric(str: string): boolean {
    return /^[a-zA-Z0-9]+$/.test(str);
  },

  /**
   * Validate password strength
   */
  isStrongPassword(password: string): {
    valid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score++;
    else feedback.push('Password should be at least 8 characters long');

    if (password.length >= 12) score++;

    if (/[a-z]/.test(password)) score++;
    else feedback.push('Password should contain lowercase letters');

    if (/[A-Z]/.test(password)) score++;
    else feedback.push('Password should contain uppercase letters');

    if (/\d/.test(password)) score++;
    else feedback.push('Password should contain numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score++;
    else feedback.push('Password should contain special characters');

    return {
      valid: score >= 4,
      score,
      feedback,
    };
  },
};

// ==================== Export Instances ====================

export const csrfProtection = new CSRFProtection();
export const cspManager = new ContentSecurityPolicy();
export const securityHeaders = new SecurityHeadersManager();
export const requestSigner = new RequestSigner();
export const secureRandom = new SecureRandom();

// ==================== Utility Functions ====================

/**
 * Add security headers to fetch request
 */
export function addSecurityHeaders(headers: Record<string, string>): Record<string, string> {
  return {
    ...headers,
    'X-CSRF-Token': csrfProtection.getToken(),
    'X-Requested-With': 'XMLHttpRequest',
  };
}

/**
 * Create secure fetch wrapper
 */
export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Add CSRF token to headers
  const headers = new Headers(options.headers);
  headers.set('X-CSRF-Token', csrfProtection.getToken());
  headers.set('X-Requested-With', 'XMLHttpRequest');

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Constant-time string comparison (prevent timing attacks)
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
