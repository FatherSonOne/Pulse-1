/**
 * Rate Limit Service Tests
 *
 * Tests for rate limiting, token bucket algorithm, and quota management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimitService, RATE_LIMITS } from '../rateLimitService';

// Mock IndexedDB
class MockIDBDatabase {
  objectStoreNames = { contains: vi.fn().mockReturnValue(true) };
  transaction = vi.fn().mockReturnValue({
    objectStore: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
      put: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
      delete: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
      getAllKeys: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
      clear: vi.fn().mockReturnValue({ onsuccess: null, onerror: null }),
    }),
  });
}

global.indexedDB = {
  open: vi.fn().mockImplementation(() => {
    const request = {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      result: new MockIDBDatabase(),
    };

    setTimeout(() => {
      if (request.onsuccess) {
        request.onsuccess({ target: { result: request.result } } as any);
      }
    }, 0);

    return request;
  }),
} as any;

describe('RateLimitService', () => {
  let rateLimitService: RateLimitService;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitService = new RateLimitService();
  });

  afterEach(() => {
    rateLimitService.stopCleanup();
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', async () => {
      const result = await rateLimitService.checkLimit('message_send', testUserId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.retryAfter).toBe(0);
    });

    it('should return correct remaining count', async () => {
      const firstCheck = await rateLimitService.checkLimit('auth_login', testUserId);

      expect(firstCheck.allowed).toBe(true);
      expect(firstCheck.remaining).toBe(RATE_LIMITS.auth_login.maxRequests);
    });

    it('should handle unknown rate limit type gracefully', async () => {
      const result = await rateLimitService.checkLimit('unknown_type', testUserId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });
  });

  describe('recordRequest', () => {
    it('should record a request and decrease remaining count', async () => {
      const beforeRecord = await rateLimitService.checkLimit('api_gemini', testUserId);
      await rateLimitService.recordRequest('api_gemini', testUserId);
      const afterRecord = await rateLimitService.checkLimit('api_gemini', testUserId);

      expect(afterRecord.remaining).toBeLessThan(beforeRecord.remaining);
    });

    it('should track multiple requests correctly', async () => {
      // Record 3 requests
      await rateLimitService.recordRequest('file_upload', testUserId);
      await rateLimitService.recordRequest('file_upload', testUserId);
      await rateLimitService.recordRequest('file_upload', testUserId);

      const status = await rateLimitService.getStatus('file_upload', testUserId);

      expect(status.remaining).toBe(RATE_LIMITS.file_upload.maxRequests - 3);
    });
  });

  describe('checkAndRecord', () => {
    it('should check and record in one operation when allowed', async () => {
      const result = await rateLimitService.checkAndRecord('message_send', testUserId);

      expect(result.allowed).toBe(true);

      // Verify it was recorded
      const status = await rateLimitService.getStatus('message_send', testUserId);
      expect(status.remaining).toBe(RATE_LIMITS.message_send.maxRequests - 1);
    });

    it('should not record when limit exceeded', async () => {
      // Fill up the limit (auth_login has max 10 requests)
      for (let i = 0; i < RATE_LIMITS.auth_login.maxRequests; i++) {
        await rateLimitService.recordRequest('auth_login', testUserId);
      }

      const result = await rateLimitService.checkAndRecord('auth_login', testUserId);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('rate limit enforcement', () => {
    it('should enforce API rate limits', async () => {
      const limit = RATE_LIMITS.api_anthropic.maxRequests;

      // Make requests up to the limit
      for (let i = 0; i < limit; i++) {
        const result = await rateLimitService.checkAndRecord('api_anthropic', testUserId);
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const blocked = await rateLimitService.checkLimit('api_anthropic', testUserId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('should enforce stricter limits for auth operations', async () => {
      const authLimit = RATE_LIMITS.auth_password_reset.maxRequests; // 3 requests

      for (let i = 0; i < authLimit; i++) {
        await rateLimitService.recordRequest('auth_password_reset', testUserId);
      }

      const status = await rateLimitService.checkLimit('auth_password_reset', testUserId);
      expect(status.allowed).toBe(false);
    });

    it('should track different users separately', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      await rateLimitService.recordRequest('message_send', user1);
      await rateLimitService.recordRequest('message_send', user1);

      const user1Status = await rateLimitService.getStatus('message_send', user1);
      const user2Status = await rateLimitService.getStatus('message_send', user2);

      expect(user1Status.remaining).toBe(RATE_LIMITS.message_send.maxRequests - 2);
      expect(user2Status.remaining).toBe(RATE_LIMITS.message_send.maxRequests);
    });
  });

  describe('sliding window algorithm', () => {
    it('should use sliding window for rate limiting', async () => {
      vi.useFakeTimers();

      // Record request at time 0
      await rateLimitService.recordRequest('export_csv', testUserId);

      // Advance time by 30 minutes
      vi.advanceTimersByTime(30 * 60 * 1000);

      // Record another request
      await rateLimitService.recordRequest('export_csv', testUserId);

      const status = await rateLimitService.getStatus('export_csv', testUserId);

      // Both requests should still be in the window
      expect(status.remaining).toBe(RATE_LIMITS.export_csv.maxRequests - 2);

      vi.useRealTimers();
    });

    it('should expire old timestamps outside the window', async () => {
      vi.useFakeTimers();

      // Record request
      await rateLimitService.recordRequest('search_query', testUserId);

      // Advance time past the window (1 hour + 1 minute)
      vi.advanceTimersByTime((60 + 1) * 60 * 1000);

      const status = await rateLimitService.getStatus('search_query', testUserId);

      // Old request should have expired
      expect(status.remaining).toBe(RATE_LIMITS.search_query.maxRequests);

      vi.useRealTimers();
    });
  });

  describe('reset operations', () => {
    it('should reset rate limits for specific type and user', async () => {
      // Record some requests
      await rateLimitService.recordRequest('message_edit', testUserId);
      await rateLimitService.recordRequest('message_edit', testUserId);

      // Reset
      await rateLimitService.reset('message_edit', testUserId);

      const status = await rateLimitService.getStatus('message_edit', testUserId);
      expect(status.remaining).toBe(RATE_LIMITS.message_edit.maxRequests);
    });

    it('should reset all rate limits for a user', async () => {
      // Record requests for different operations
      await rateLimitService.recordRequest('file_upload', testUserId);
      await rateLimitService.recordRequest('message_send', testUserId);
      await rateLimitService.recordRequest('api_gemini', testUserId);

      // Reset all
      await rateLimitService.resetAll(testUserId);

      const uploadStatus = await rateLimitService.getStatus('file_upload', testUserId);
      const messageStatus = await rateLimitService.getStatus('message_send', testUserId);
      const apiStatus = await rateLimitService.getStatus('api_gemini', testUserId);

      expect(uploadStatus.remaining).toBe(RATE_LIMITS.file_upload.maxRequests);
      expect(messageStatus.remaining).toBe(RATE_LIMITS.message_send.maxRequests);
      expect(apiStatus.remaining).toBe(RATE_LIMITS.api_gemini.maxRequests);
    });

    it('should clear all rate limit data', async () => {
      await rateLimitService.recordRequest('voice_transcribe', 'user-1');
      await rateLimitService.recordRequest('voice_transcribe', 'user-2');

      await rateLimitService.clearAll();

      const user1Status = await rateLimitService.getStatus('voice_transcribe', 'user-1');
      const user2Status = await rateLimitService.getStatus('voice_transcribe', 'user-2');

      expect(user1Status.remaining).toBe(RATE_LIMITS.voice_transcribe.maxRequests);
      expect(user2Status.remaining).toBe(RATE_LIMITS.voice_transcribe.maxRequests);
    });
  });

  describe('getAllStatuses', () => {
    it('should return statuses for all rate limit types', async () => {
      const statuses = await rateLimitService.getAllStatuses(testUserId);

      expect(statuses).toHaveProperty('api_gemini');
      expect(statuses).toHaveProperty('file_upload');
      expect(statuses).toHaveProperty('message_send');
      expect(statuses).toHaveProperty('auth_login');

      // All should be allowed initially
      expect(statuses.api_gemini.allowed).toBe(true);
      expect(statuses.file_upload.allowed).toBe(true);
    });

    it('should show accurate remaining counts', async () => {
      await rateLimitService.recordRequest('crm_sync', testUserId);
      await rateLimitService.recordRequest('crm_sync', testUserId);

      const statuses = await rateLimitService.getAllStatuses(testUserId);

      expect(statuses.crm_sync.remaining).toBe(RATE_LIMITS.crm_sync.maxRequests - 2);
    });
  });

  describe('retry timing', () => {
    it('should provide accurate retry-after time when blocked', async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      // Fill the limit
      for (let i = 0; i < RATE_LIMITS.auth_signup.maxRequests; i++) {
        await rateLimitService.recordRequest('auth_signup', testUserId);
      }

      const blocked = await rateLimitService.checkLimit('auth_signup', testUserId);

      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeGreaterThan(0);
      expect(blocked.retryAfter).toBeLessThanOrEqual(RATE_LIMITS.auth_signup.windowMs);

      vi.useRealTimers();
    });

    it('should provide reset time for when limit will be available again', async () => {
      vi.useFakeTimers();
      const now = Date.now();

      await rateLimitService.recordRequest('email_send', testUserId);

      const status = await rateLimitService.getStatus('email_send', testUserId);

      expect(status.resetTime).toBeGreaterThanOrEqual(now);
      expect(status.resetTime).toBeLessThanOrEqual(now + RATE_LIMITS.email_send.windowMs);

      vi.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent requests correctly', async () => {
      const promises = [];

      // Make 5 concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(rateLimitService.checkAndRecord('message_delete', testUserId));
      }

      const results = await Promise.all(promises);

      // All should be allowed
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });

      // Remaining should reflect all 5 requests
      const status = await rateLimitService.getStatus('message_delete', testUserId);
      expect(status.remaining).toBeLessThanOrEqual(RATE_LIMITS.message_delete.maxRequests - 5);
    });

    it('should handle different rate limit types independently', async () => {
      await rateLimitService.recordRequest('api_openai', testUserId);
      await rateLimitService.recordRequest('file_download', testUserId);

      const openaiStatus = await rateLimitService.getStatus('api_openai', testUserId);
      const downloadStatus = await rateLimitService.getStatus('file_download', testUserId);

      expect(openaiStatus.remaining).toBe(RATE_LIMITS.api_openai.maxRequests - 1);
      expect(downloadStatus.remaining).toBe(RATE_LIMITS.file_download.maxRequests - 1);
    });

    it('should handle rapid sequential requests', async () => {
      for (let i = 0; i < 10; i++) {
        await rateLimitService.recordRequest('crm_update', testUserId);
      }

      const status = await rateLimitService.getStatus('crm_update', testUserId);
      expect(status.remaining).toBe(RATE_LIMITS.crm_update.maxRequests - 10);
    });
  });

  describe('security considerations', () => {
    it('should prevent abuse through strict auth limits', () => {
      const authLoginLimit = RATE_LIMITS.auth_login.maxRequests;
      const authSignupLimit = RATE_LIMITS.auth_signup.maxRequests;
      const passwordResetLimit = RATE_LIMITS.auth_password_reset.maxRequests;

      // Auth operations should have strict limits
      expect(authLoginLimit).toBeLessThanOrEqual(10);
      expect(authSignupLimit).toBeLessThanOrEqual(5);
      expect(passwordResetLimit).toBeLessThanOrEqual(3);
    });

    it('should use shorter windows for security-sensitive operations', () => {
      const authLoginWindow = RATE_LIMITS.auth_login.windowMs;
      const passwordResetWindow = RATE_LIMITS.auth_password_reset.windowMs;

      // Auth operations should have windows of 1 hour or less
      expect(authLoginWindow).toBeLessThanOrEqual(60 * 60 * 1000);
      expect(passwordResetWindow).toBeLessThanOrEqual(60 * 60 * 1000);
    });
  });
});
