// ============================================
// HEALTH CHECK ENDPOINT
// System health monitoring for deployments
// ============================================

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    api: HealthCheck;
    cache: HealthCheck;
    storage: HealthCheck;
  };
  metrics: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    responseTime: number;
  };
}

export interface HealthCheck {
  status: 'ok' | 'warning' | 'error';
  message?: string;
  latency?: number;
  lastChecked?: string;
}

// Health check implementation
export async function performHealthCheck(): Promise<HealthCheckResponse> {
  const startTime = performance.now();

  // Check database connectivity
  const databaseCheck = await checkDatabase();

  // Check API endpoints
  const apiCheck = await checkAPI();

  // Check cache system
  const cacheCheck = await checkCache();

  // Check storage
  const storageCheck = await checkStorage();

  // Calculate response time
  const responseTime = performance.now() - startTime;

  // Determine overall status
  const overallStatus = determineOverallStatus([
    databaseCheck,
    apiCheck,
    cacheCheck,
    storageCheck
  ]);

  // Get memory usage
  const memoryUsage = getMemoryUsage();

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: import.meta.env.VITE_APP_MODE || 'development',
    checks: {
      database: databaseCheck,
      api: apiCheck,
      cache: cacheCheck,
      storage: storageCheck
    },
    metrics: {
      uptime: getUptime(),
      memory: memoryUsage,
      responseTime
    }
  };
}

// Check database connectivity
async function checkDatabase(): Promise<HealthCheck> {
  try {
    const startTime = performance.now();

    // Attempt to connect to Supabase
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'error',
        message: 'Database credentials not configured',
        lastChecked: new Date().toISOString()
      };
    }

    // Simple connectivity check
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseKey
      }
    });

    const latency = performance.now() - startTime;

    if (response.ok) {
      return {
        status: 'ok',
        latency,
        lastChecked: new Date().toISOString()
      };
    } else {
      return {
        status: 'warning',
        message: `Database responded with status ${response.status}`,
        latency,
        lastChecked: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database connection failed',
      lastChecked: new Date().toISOString()
    };
  }
}

// Check API endpoints
async function checkAPI(): Promise<HealthCheck> {
  try {
    const startTime = performance.now();

    // Check if API is responsive
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

    const response = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    const latency = performance.now() - startTime;

    if (response.ok) {
      return {
        status: 'ok',
        latency,
        lastChecked: new Date().toISOString()
      };
    } else {
      return {
        status: 'warning',
        message: `API responded with status ${response.status}`,
        latency,
        lastChecked: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'API check failed',
      lastChecked: new Date().toISOString()
    };
  }
}

// Check cache system
async function checkCache(): Promise<HealthCheck> {
  try {
    const startTime = performance.now();

    // Test localStorage availability
    const testKey = '__health_check__';
    const testValue = Date.now().toString();

    localStorage.setItem(testKey, testValue);
    const retrieved = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);

    const latency = performance.now() - startTime;

    if (retrieved === testValue) {
      return {
        status: 'ok',
        latency,
        lastChecked: new Date().toISOString()
      };
    } else {
      return {
        status: 'warning',
        message: 'Cache read/write inconsistency',
        latency,
        lastChecked: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Cache unavailable',
      lastChecked: new Date().toISOString()
    };
  }
}

// Check storage
async function checkStorage(): Promise<HealthCheck> {
  try {
    const startTime = performance.now();

    // Check storage quota
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const percentUsed = ((estimate.usage || 0) / (estimate.quota || 1)) * 100;

      const latency = performance.now() - startTime;

      if (percentUsed < 80) {
        return {
          status: 'ok',
          message: `Storage ${percentUsed.toFixed(1)}% used`,
          latency,
          lastChecked: new Date().toISOString()
        };
      } else if (percentUsed < 95) {
        return {
          status: 'warning',
          message: `Storage ${percentUsed.toFixed(1)}% used (high)`,
          latency,
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'error',
          message: `Storage ${percentUsed.toFixed(1)}% used (critical)`,
          latency,
          lastChecked: new Date().toISOString()
        };
      }
    } else {
      return {
        status: 'warning',
        message: 'Storage API not available',
        lastChecked: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Storage check failed',
      lastChecked: new Date().toISOString()
    };
  }
}

// Determine overall status from individual checks
function determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
  const hasError = checks.some(check => check.status === 'error');
  const hasWarning = checks.some(check => check.status === 'warning');

  if (hasError) {
    return 'unhealthy';
  } else if (hasWarning) {
    return 'degraded';
  } else {
    return 'healthy';
  }
}

// Get application uptime
function getUptime(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return Math.floor(performance.now() / 1000); // seconds
  }
  return 0;
}

// Get memory usage
function getMemoryUsage(): { used: number; total: number; percentage: number } {
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory;
    const used = memory.usedJSHeapSize;
    const total = memory.jsHeapSizeLimit;
    const percentage = (used / total) * 100;

    return {
      used,
      total,
      percentage
    };
  }

  return {
    used: 0,
    total: 0,
    percentage: 0
  };
}

// Export simple health check for API endpoint
export async function getHealthStatus(): Promise<{
  status: string;
  timestamp: string;
}> {
  const health = await performHealthCheck();

  return {
    status: health.status,
    timestamp: health.timestamp
  };
}

// Continuous health monitoring
export class HealthMonitor {
  private intervalId: number | null = null;
  private lastCheck: HealthCheckResponse | null = null;
  private listeners: Array<(health: HealthCheckResponse) => void> = [];

  start(intervalMs: number = 60000): void {
    if (this.intervalId !== null) {
      console.warn('Health monitor already running');
      return;
    }

    // Initial check
    this.performCheck();

    // Periodic checks
    this.intervalId = window.setInterval(() => {
      this.performCheck();
    }, intervalMs);

    console.log('Health monitor started');
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Health monitor stopped');
    }
  }

  private async performCheck(): Promise<void> {
    try {
      this.lastCheck = await performHealthCheck();

      // Notify listeners
      this.listeners.forEach(listener => {
        try {
          listener(this.lastCheck!);
        } catch (error) {
          console.error('Error in health monitor listener:', error);
        }
      });

      // Log if unhealthy
      if (this.lastCheck.status === 'unhealthy') {
        console.error('Health check failed:', this.lastCheck);
      } else if (this.lastCheck.status === 'degraded') {
        console.warn('Health check degraded:', this.lastCheck);
      }
    } catch (error) {
      console.error('Health check error:', error);
    }
  }

  getLastCheck(): HealthCheckResponse | null {
    return this.lastCheck;
  }

  subscribe(listener: (health: HealthCheckResponse) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();
