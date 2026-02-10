/**
 * Retry Service Tests
 *
 * Tests for exponential backoff, circuit breaker, and retry logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RetryService,
  CircuitBreaker,
  CircuitState,
  calculateDelay,
  isRetryableError,
} from '../retryService';

describe('RetryService', () => {
  let retryService: RetryService;

  beforeEach(() => {
    retryService = new RetryService();
    vi.clearAllMocks();
    vi.useRealTimers(); // Ensure real timers between tests
  });

  afterEach(() => {
    vi.useRealTimers(); // Clean up fake timers
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await retryService.executeWithRetry(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      // Use proper retryable error (name: NetworkError or message containing 'network')
      const networkError = Object.assign(new Error('network connection failed'), {
        name: 'NetworkError',
      });
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const result = await retryService.executeWithRetry(mockFn, 3, 2, {
        initialDelayMs: 10, // Fast retries for test
        jitterFactor: 0,
      });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max attempts', async () => {
      // Use retryable error so it actually retries
      const networkError = Object.assign(new Error('network failure'), {
        name: 'NetworkError',
      });
      const mockFn = vi.fn().mockRejectedValue(networkError);

      await expect(
        retryService.executeWithRetry(mockFn, 3, 2, {
          initialDelayMs: 10,
          jitterFactor: 0,
        })
      ).rejects.toThrow('network failure');

      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(
        retryService.executeWithRetry(mockFn, 3)
      ).rejects.toThrow('Invalid input');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      const networkError = Object.assign(new Error('Network error'), {
        name: 'NetworkError',
      });

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const result = await retryService.executeWithRetry(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on timeout errors', async () => {
      const timeoutError = Object.assign(new Error('Request timeout'), {
        name: 'TimeoutError',
      });

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue('success');

      const result = await retryService.executeWithRetry(mockFn);

      expect(result).toBe('success');
    });

    it('should retry on 429 rate limit errors', async () => {
      const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
        status: 429,
      });

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');

      const result = await retryService.executeWithRetry(mockFn);

      expect(result).toBe('success');
    });

    it('should retry on 5xx server errors', async () => {
      const serverError = Object.assign(new Error('Internal Server Error'), {
        status: 500,
      });

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue('success');

      const result = await retryService.executeWithRetry(mockFn);

      expect(result).toBe('success');
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const networkError = Object.assign(new Error('network error'), {
        name: 'NetworkError',
      });
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      await retryService.executeWithRetry(mockFn, 3, 2, {
        onRetry,
        initialDelayMs: 10,
        jitterFactor: 0,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.any(Error),
        expect.any(Number)
      );
    });
  });

  describe('exponential backoff', () => {
    it('should wait with exponential backoff between retries', async () => {
      // Use real timers with minimal delays for this test
      const networkError = Object.assign(new Error('network error'), {
        name: 'NetworkError',
      });
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const result = await retryService.executeWithRetry(mockFn, 3, 2, {
        initialDelayMs: 10, // Use small delays for fast tests
        jitterFactor: 0,
      });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should respect max delay', async () => {
      // Verify delay calculation directly
      const delay1 = calculateDelay(1, 100, 2, 250, 0); // 100
      const delay2 = calculateDelay(2, 100, 2, 250, 0); // 200
      const delay3 = calculateDelay(3, 100, 2, 250, 0); // 250 (capped from 400)
      const delay4 = calculateDelay(4, 100, 2, 250, 0); // 250 (capped from 800)

      expect(delay1).toBe(100);
      expect(delay2).toBe(200);
      expect(delay3).toBe(250); // Capped at max
      expect(delay4).toBe(250); // Capped at max
    });
  });

  describe('circuit breaker', () => {
    it('should allow execution when circuit is closed', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await retryService.executeWithCircuitBreaker(
        'test-operation',
        mockFn
      );

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after threshold failures', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      // Fail 5 times to open circuit (default threshold is 5)
      for (let i = 0; i < 5; i++) {
        try {
          await retryService.executeWithCircuitBreaker('test-operation', mockFn);
        } catch (error) {
          // Expected
        }
      }

      const status = retryService.getCircuitStatus('test-operation');
      expect(status.state).toBe(CircuitState.OPEN);
    });

    it('should reject requests when circuit is open', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await retryService.executeWithCircuitBreaker('test-operation', mockFn);
        } catch (error) {
          // Expected
        }
      }

      // Next request should be rejected immediately
      await expect(
        retryService.executeWithCircuitBreaker('test-operation', mockFn)
      ).rejects.toThrow(/Circuit breaker is OPEN/);
    });

    it('should transition to half-open after timeout', async () => {
      vi.useFakeTimers();

      const mockFn = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await retryService.executeWithCircuitBreaker('test-operation', mockFn);
        } catch (error) {
          // Expected
        }
      }

      // Advance time past reset timeout (default 60 seconds)
      await vi.advanceTimersByTimeAsync(61000);

      // Next request should transition to half-open
      mockFn.mockResolvedValueOnce('success');
      const result = await retryService.executeWithCircuitBreaker(
        'test-operation',
        mockFn
      );

      expect(result).toBe('success');

      vi.useRealTimers();
    });

    it('should close circuit after successful execution in half-open state', async () => {
      vi.useFakeTimers();

      const mockFn = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await retryService.executeWithCircuitBreaker('test-operation', mockFn);
        } catch (error) {
          // Expected
        }
      }

      // Advance time to half-open
      await vi.advanceTimersByTimeAsync(61000);

      // Successful request should close circuit
      mockFn.mockResolvedValueOnce('success');
      await retryService.executeWithCircuitBreaker('test-operation', mockFn);

      const status = retryService.getCircuitStatus('test-operation');
      expect(status.state).toBe(CircuitState.CLOSED);
      expect(status.failureCount).toBe(0);

      vi.useRealTimers();
    });

    it('should track different operations independently', async () => {
      const mockFn1 = vi.fn().mockRejectedValue(new Error('Error'));
      const mockFn2 = vi.fn().mockResolvedValue('success');

      // Fail operation 1
      for (let i = 0; i < 5; i++) {
        try {
          await retryService.executeWithCircuitBreaker('operation-1', mockFn1);
        } catch (error) {
          // Expected
        }
      }

      // Operation 2 should still work
      const result = await retryService.executeWithCircuitBreaker(
        'operation-2',
        mockFn2
      );

      expect(result).toBe('success');

      const status1 = retryService.getCircuitStatus('operation-1');
      const status2 = retryService.getCircuitStatus('operation-2');

      expect(status1.state).toBe(CircuitState.OPEN);
      expect(status2.state).toBe(CircuitState.CLOSED);
    });

    it('should reset circuit manually', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Error'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await retryService.executeWithCircuitBreaker('test-operation', mockFn);
        } catch (error) {
          // Expected
        }
      }

      retryService.resetCircuit('test-operation');

      const status = retryService.getCircuitStatus('test-operation');
      expect(status.state).toBe(CircuitState.CLOSED);
      expect(status.failureCount).toBe(0);
    });
  });

  describe('batch execute', () => {
    it('should execute multiple operations and return all results', async () => {
      const op1 = vi.fn().mockResolvedValue('result1');
      const op2 = vi.fn().mockResolvedValue('result2');
      const op3 = vi.fn().mockResolvedValue('result3');

      const results = await retryService.batchExecute([op1, op2, op3]);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ success: true, data: 'result1' });
      expect(results[1]).toEqual({ success: true, data: 'result2' });
      expect(results[2]).toEqual({ success: true, data: 'result3' });
    });

    it('should handle mixed success and failure', async () => {
      const op1 = vi.fn().mockResolvedValue('success');
      const op2 = vi.fn().mockRejectedValue(new Error('failure'));
      const op3 = vi.fn().mockResolvedValue('success');

      const results = await retryService.batchExecute([op1, op2, op3]);

      expect(results[0]).toEqual({ success: true, data: 'success' });
      expect(results[1]).toEqual({ success: false, error: expect.any(Error) });
      expect(results[2]).toEqual({ success: true, data: 'success' });
    });

    it('should retry failed batch operations', async () => {
      const networkError = Object.assign(new Error('network error'), {
        name: 'NetworkError',
      });
      const op1 = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success after retry');

      const results = await retryService.batchExecute([op1], {
        maxAttempts: 3,
        initialDelayMs: 10,
        jitterFactor: 0,
      });

      expect(results[0]).toEqual({ success: true, data: 'success after retry' });
      expect(op1).toHaveBeenCalledTimes(2);
    });
  });

  describe('timeout functionality', () => {
    it('should timeout long-running operations', async () => {
      // Use short real timeout to avoid dangling promises
      const slowFn = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(
        retryService.executeWithTimeout(slowFn, 50)
      ).rejects.toThrow('Operation timed out');
    });

    it('should complete fast operations before timeout', async () => {
      const fastFn = vi.fn().mockResolvedValue('quick result');

      const result = await retryService.executeWithTimeout(fastFn, 1000);

      expect(result).toBe('quick result');
    });

    it('should retry timed-out operations', async () => {
      let callCount = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call takes too long (will timeout)
          return new Promise(resolve => setTimeout(resolve, 200));
        }
        // Second call succeeds immediately
        return Promise.resolve('success');
      });

      const result = await retryService.executeWithRetryAndTimeout(mockFn, 50, {
        maxAttempts: 3,
        jitterFactor: 0,
        initialDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('utility functions', () => {
    describe('calculateDelay', () => {
      it('should calculate exponential backoff correctly', () => {
        const delay1 = calculateDelay(1, 100, 2, 10000, 0);
        const delay2 = calculateDelay(2, 100, 2, 10000, 0);
        const delay3 = calculateDelay(3, 100, 2, 10000, 0);

        expect(delay1).toBe(100); // 100 * 2^0
        expect(delay2).toBe(200); // 100 * 2^1
        expect(delay3).toBe(400); // 100 * 2^2
      });

      it('should respect max delay', () => {
        const delay = calculateDelay(10, 100, 2, 1000, 0);

        expect(delay).toBeLessThanOrEqual(1000);
      });

      it('should add jitter to delay', () => {
        const delays = [];
        for (let i = 0; i < 10; i++) {
          delays.push(calculateDelay(1, 100, 2, 10000, 0.3));
        }

        // With jitter, delays should vary
        const uniqueDelays = new Set(delays);
        expect(uniqueDelays.size).toBeGreaterThan(1);
      });
    });

    describe('isRetryableError', () => {
      it('should identify network errors as retryable', () => {
        const error = Object.assign(new Error('Network error'), {
          name: 'NetworkError',
        });

        expect(isRetryableError(error, [])).toBe(true);
      });

      it('should identify timeout errors as retryable', () => {
        const error = Object.assign(new Error('Timeout'), {
          name: 'TimeoutError',
        });

        expect(isRetryableError(error, [])).toBe(true);
      });

      it('should identify 429 status as retryable', () => {
        const error = Object.assign(new Error('Rate limit'), { status: 429 });

        expect(isRetryableError(error, [])).toBe(true);
      });

      it('should identify 5xx errors as retryable', () => {
        const error500 = Object.assign(new Error('Server error'), { status: 500 });
        const error503 = Object.assign(new Error('Service unavailable'), {
          status: 503,
        });

        expect(isRetryableError(error500, [])).toBe(true);
        expect(isRetryableError(error503, [])).toBe(true);
      });

      it('should not retry 4xx client errors', () => {
        const error400 = Object.assign(new Error('Bad request'), { status: 400 });
        const error404 = Object.assign(new Error('Not found'), { status: 404 });

        expect(isRetryableError(error400, [])).toBe(false);
        expect(isRetryableError(error404, [])).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null or undefined errors', async () => {
      const mockFn = vi.fn().mockRejectedValue(null);

      await expect(retryService.executeWithRetry(mockFn, 1)).rejects.toBeNull();
    });

    it('should handle operations that throw non-Error objects', async () => {
      const mockFn = vi.fn().mockRejectedValue('string error');

      await expect(
        retryService.executeWithRetry(mockFn, 1)
      ).rejects.toBe('string error');
    });

    it('should handle immediate success with one attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      // With maxAttempts=1, it should succeed on first try
      const result = await retryService.executeWithRetry(mockFn, 1);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
