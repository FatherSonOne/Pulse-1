/**
 * Retry Service with Exponential Backoff
 *
 * CRITICAL RESILIENCE - P1 Priority
 *
 * Implements retry logic with exponential backoff and jitter for
 * handling transient failures in API calls, database operations,
 * and other critical operations.
 *
 * Features:
 * - Exponential backoff algorithm
 * - Configurable retry attempts
 * - Jitter to prevent thundering herd
 * - Circuit breaker pattern
 * - Per-operation circuit breaker tracking
 * - Automatic retry for specific error types
 */

// ==================== Types ====================

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitterFactor?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: any, delay: number) => void;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, reject all requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerStatus {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
}

// ==================== Default Configurations ====================

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENETUNREACH',
    'EAI_AGAIN',
    'ENOTFOUND',
  ],
  onRetry: () => {},
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  halfOpenMaxAttempts: 2,
};

// ==================== Utility Functions ====================

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  multiplier: number,
  maxDelay: number,
  jitterFactor: number
): number {
  // Calculate base delay with exponential backoff
  const baseDelay = Math.min(initialDelay * Math.pow(multiplier, attempt - 1), maxDelay);

  // Add jitter (random factor to prevent thundering herd)
  const jitter = baseDelay * jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, baseDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  if (!error) return false;

  const errorCode = error.code || error.name || '';
  const errorMessage = error.message || String(error);

  // Check error code
  if (retryableErrors.includes(errorCode)) {
    return true;
  }

  // Check for network errors
  if (error.name === 'NetworkError' || errorMessage.includes('network')) {
    return true;
  }

  // Check for timeout errors
  if (error.name === 'TimeoutError' || errorMessage.includes('timeout')) {
    return true;
  }

  // Check for rate limit errors (retry after backoff)
  if (error.status === 429 || errorMessage.includes('rate limit')) {
    return true;
  }

  // Check for server errors (5xx)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  return false;
}

// ==================== Circuit Breaker ====================

class CircuitBreaker {
  private circuits: Map<string, CircuitBreakerStatus> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {
    this.config = config;
  }

  /**
   * Get or create circuit breaker status for an operation
   */
  private getCircuit(operationKey: string): CircuitBreakerStatus {
    if (!this.circuits.has(operationKey)) {
      this.circuits.set(operationKey, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        nextRetryTime: 0,
      });
    }
    return this.circuits.get(operationKey)!;
  }

  /**
   * Check if circuit allows execution
   */
  canExecute(operationKey: string): { allowed: boolean; reason?: string } {
    const circuit = this.getCircuit(operationKey);
    const now = Date.now();

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return { allowed: true };

      case CircuitState.OPEN:
        // Check if enough time has passed to try again
        if (now >= circuit.nextRetryTime) {
          circuit.state = CircuitState.HALF_OPEN;
          circuit.failureCount = 0;
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: `Circuit breaker is OPEN. Retry in ${Math.ceil((circuit.nextRetryTime - now) / 1000)}s`,
        };

      case CircuitState.HALF_OPEN:
        // Allow limited attempts in half-open state
        if (circuit.failureCount < this.config.halfOpenMaxAttempts) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: 'Circuit breaker is HALF_OPEN with max attempts reached',
        };
    }
  }

  /**
   * Record successful execution
   */
  recordSuccess(operationKey: string): void {
    const circuit = this.getCircuit(operationKey);

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Successful execution in half-open state, close the circuit
      circuit.state = CircuitState.CLOSED;
      circuit.failureCount = 0;
    }

    // Reset failure count on success
    circuit.failureCount = 0;
  }

  /**
   * Record failed execution
   */
  recordFailure(operationKey: string): void {
    const circuit = this.getCircuit(operationKey);
    const now = Date.now();

    circuit.failureCount++;
    circuit.lastFailureTime = now;

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Failed in half-open state, reopen the circuit
      circuit.state = CircuitState.OPEN;
      circuit.nextRetryTime = now + this.config.resetTimeoutMs;
    } else if (circuit.failureCount >= this.config.failureThreshold) {
      // Threshold reached, open the circuit
      circuit.state = CircuitState.OPEN;
      circuit.nextRetryTime = now + this.config.resetTimeoutMs;
    }
  }

  /**
   * Get circuit status
   */
  getStatus(operationKey: string): CircuitBreakerStatus {
    return { ...this.getCircuit(operationKey) };
  }

  /**
   * Reset circuit manually
   */
  reset(operationKey: string): void {
    this.circuits.delete(operationKey);
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    this.circuits.clear();
  }
}

// ==================== Retry Service ====================

class RetryService {
  private circuitBreaker: CircuitBreaker;

  constructor(circuitBreakerConfig?: CircuitBreakerConfig) {
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig);
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxAttempts?: number,
    backoffMultiplier?: number,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const config: Required<RetryOptions> = {
      ...DEFAULT_RETRY_OPTIONS,
      ...options,
      maxAttempts: maxAttempts ?? options?.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts,
      backoffMultiplier:
        backoffMultiplier ?? options?.backoffMultiplier ?? DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    };

    let lastError: any;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error: any) {
        lastError = error;

        // Check if we should retry
        const shouldRetry =
          attempt < config.maxAttempts && isRetryableError(error, config.retryableErrors);

        if (!shouldRetry) {
          throw error;
        }

        // Calculate delay
        const delay = calculateDelay(
          attempt,
          config.initialDelayMs,
          config.backoffMultiplier,
          config.maxDelayMs,
          config.jitterFactor
        );

        // Call retry callback
        config.onRetry(attempt, error, delay);

        // Wait before retrying
        await sleep(delay);
      }
    }

    // All attempts failed
    throw lastError;
  }

  /**
   * Execute with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    operationKey: string,
    fn: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    // Check circuit breaker
    const circuitCheck = this.circuitBreaker.canExecute(operationKey);
    if (!circuitCheck.allowed) {
      throw new Error(circuitCheck.reason || 'Circuit breaker is open');
    }

    try {
      const result = await this.executeWithRetry(fn, undefined, undefined, options);
      this.circuitBreaker.recordSuccess(operationKey);
      return result;
    } catch (error) {
      this.circuitBreaker.recordFailure(operationKey);
      throw error;
    }
  }

  /**
   * Execute with both retry and circuit breaker
   */
  async executeWithRetryAndCircuitBreaker<T>(
    operationKey: string,
    fn: () => Promise<T>,
    retryOptions?: Partial<RetryOptions>
  ): Promise<T> {
    return this.executeWithCircuitBreaker(operationKey, fn, retryOptions);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus(operationKey: string): CircuitBreakerStatus {
    return this.circuitBreaker.getStatus(operationKey);
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(operationKey: string): void {
    this.circuitBreaker.reset(operationKey);
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuits(): void {
    this.circuitBreaker.resetAll();
  }

  /**
   * Batch retry operations (execute multiple operations with retry)
   */
  async batchExecute<T>(
    operations: Array<() => Promise<T>>,
    options?: Partial<RetryOptions>
  ): Promise<Array<{ success: boolean; data?: T; error?: any }>> {
    const results = await Promise.allSettled(
      operations.map((op) => this.executeWithRetry(op, undefined, undefined, options))
    );

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return { success: true, data: result.value };
      } else {
        return { success: false, error: result.reason };
      }
    });
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      ),
    ]);
  }

  /**
   * Execute with retry and timeout
   */
  async executeWithRetryAndTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    retryOptions?: Partial<RetryOptions>
  ): Promise<T> {
    return this.executeWithRetry(
      () => this.executeWithTimeout(fn, timeoutMs),
      undefined,
      undefined,
      retryOptions
    );
  }
}

// ==================== Export ====================

export const retryService = new RetryService();

// Export for custom configurations
export { CircuitBreaker, RetryService };
export { calculateDelay, isRetryableError };
