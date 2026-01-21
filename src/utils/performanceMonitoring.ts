/**
 * Performance Monitoring Infrastructure
 * Web Vitals tracking and custom performance metrics
 */

import { onCLS, onFID, onFCP, onLCP, onTTFB, Metric } from 'web-vitals';

interface PerformanceConfig {
  enabled: boolean;
  debug?: boolean;
  reportUrl?: string;
  sampleRate?: number;
}

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id?: string;
  navigationType?: string;
}

interface CustomTiming {
  name: string;
  startTime: number;
  duration?: number;
}

class PerformanceMonitoring {
  private config: PerformanceConfig;
  private customTimings: Map<string, CustomTiming> = new Map();
  private metrics: PerformanceMetric[] = [];

  constructor() {
    this.config = {
      enabled: false,
      debug: false,
      sampleRate: 1.0,
    };
  }

  /**
   * Initialize performance monitoring
   */
  initialize(config: PerformanceConfig): void {
    this.config = { ...this.config, ...config };

    if (!this.config.enabled) {
      console.log('Performance monitoring disabled');
      return;
    }

    // Check sampling rate
    if (Math.random() > (this.config.sampleRate || 1.0)) {
      console.log('Performance monitoring skipped due to sampling');
      return;
    }

    this.initializeWebVitals();
    this.initializeNavigationTiming();
    this.initializeResourceTiming();

    if (this.config.debug) {
      console.log('Performance monitoring initialized');
    }
  }

  /**
   * Initialize Web Vitals tracking
   */
  private initializeWebVitals(): void {
    // Cumulative Layout Shift (CLS)
    onCLS(this.handleMetric.bind(this));

    // First Input Delay (FID)
    onFID(this.handleMetric.bind(this));

    // First Contentful Paint (FCP)
    onFCP(this.handleMetric.bind(this));

    // Largest Contentful Paint (LCP)
    onLCP(this.handleMetric.bind(this));

    // Time to First Byte (TTFB)
    onTTFB(this.handleMetric.bind(this));
  }

  /**
   * Handle Web Vitals metric
   */
  private handleMetric(metric: Metric): void {
    const performanceMetric: PerformanceMetric = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
    };

    this.metrics.push(performanceMetric);
    this.reportMetric(performanceMetric);

    if (this.config.debug) {
      console.log('Web Vital:', performanceMetric);
    }
  }

  /**
   * Initialize Navigation Timing API
   */
  private initializeNavigationTiming(): void {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      if (navigation) {
        const metrics = {
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          tcp: navigation.connectEnd - navigation.connectStart,
          ttfb: navigation.responseStart - navigation.requestStart,
          download: navigation.responseEnd - navigation.responseStart,
          domInteractive: navigation.domInteractive - navigation.fetchStart,
          domComplete: navigation.domComplete - navigation.fetchStart,
          loadComplete: navigation.loadEventEnd - navigation.fetchStart,
        };

        Object.entries(metrics).forEach(([name, value]) => {
          this.reportMetric({
            name: `navigation_${name}`,
            value,
            rating: this.getRating(name, value),
          });
        });

        if (this.config.debug) {
          console.log('Navigation Timing:', metrics);
        }
      }
    });
  }

  /**
   * Initialize Resource Timing API
   */
  private initializeResourceTiming(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;

              // Track slow resources
              if (resourceEntry.duration > 1000) {
                this.reportMetric({
                  name: 'slow_resource',
                  value: resourceEntry.duration,
                  rating: 'poor',
                });

                if (this.config.debug) {
                  console.warn('Slow resource:', resourceEntry.name, resourceEntry.duration);
                }
              }
            }
          });
        });

        observer.observe({ entryTypes: ['resource'] });
      } catch (error) {
        console.error('Failed to observe resources:', error);
      }
    }
  }

  /**
   * Start custom timing
   */
  startTiming(name: string): void {
    this.customTimings.set(name, {
      name,
      startTime: performance.now(),
    });

    if (this.config.debug) {
      console.log('Timing started:', name);
    }
  }

  /**
   * End custom timing
   */
  endTiming(name: string): number | null {
    const timing = this.customTimings.get(name);

    if (!timing) {
      console.warn('Timing not found:', name);
      return null;
    }

    const duration = performance.now() - timing.startTime;
    timing.duration = duration;

    this.reportMetric({
      name: `custom_${name}`,
      value: duration,
      rating: this.getRating('custom', duration),
    });

    this.customTimings.delete(name);

    if (this.config.debug) {
      console.log('Timing ended:', name, duration);
    }

    return duration;
  }

  /**
   * Measure function execution time
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.startTiming(name);
    try {
      const result = await fn();
      return result;
    } finally {
      this.endTiming(name);
    }
  }

  /**
   * Track API call performance
   */
  trackApiCall(url: string, duration: number, status: number): void {
    this.reportMetric({
      name: 'api_call',
      value: duration,
      rating: this.getRating('api', duration),
    });

    if (this.config.debug) {
      console.log('API call:', url, duration, status);
    }
  }

  /**
   * Track component render time
   */
  trackComponentRender(componentName: string, duration: number): void {
    this.reportMetric({
      name: `component_render_${componentName}`,
      value: duration,
      rating: this.getRating('render', duration),
    });

    if (this.config.debug) {
      console.log('Component render:', componentName, duration);
    }
  }

  /**
   * Get performance rating
   */
  private getRating(type: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds: Record<string, [number, number]> = {
      dns: [100, 300],
      tcp: [100, 300],
      ttfb: [200, 600],
      download: [300, 1000],
      domInteractive: [1500, 3500],
      domComplete: [2000, 4000],
      loadComplete: [2500, 4500],
      api: [200, 1000],
      render: [16, 50],
      custom: [100, 1000],
    };

    const [good, poor] = thresholds[type] || [100, 1000];

    if (value <= good) return 'good';
    if (value <= poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Report metric to analytics
   */
  private reportMetric(metric: PerformanceMetric): void {
    // Send to analytics
    if ((window as any).gtag) {
      (window as any).gtag('event', 'performance_metric', {
        metric_name: metric.name,
        metric_value: Math.round(metric.value),
        metric_rating: metric.rating,
      });
    }

    // Send to custom endpoint if configured
    if (this.config.reportUrl) {
      this.sendToEndpoint(metric);
    }
  }

  /**
   * Send metric to reporting endpoint
   */
  private async sendToEndpoint(metric: PerformanceMetric): Promise<void> {
    if (!this.config.reportUrl) return;

    try {
      await fetch(this.config.reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metric,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
        keepalive: true,
      });
    } catch (error) {
      console.error('Failed to report metric:', error);
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    this.metrics.forEach((metric) => {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          total: 0,
          average: 0,
          min: Infinity,
          max: -Infinity,
        };
      }

      const stats = summary[metric.name];
      stats.count++;
      stats.total += metric.value;
      stats.average = stats.total / stats.count;
      stats.min = Math.min(stats.min, metric.value);
      stats.max = Math.max(stats.max, metric.value);
    });

    return summary;
  }

  /**
   * Log performance summary
   */
  logSummary(): void {
    console.table(this.getMetricsSummary());
  }
}

// Create singleton instance
const performanceMonitoring = new PerformanceMonitoring();

/**
 * Initialize performance monitoring from environment variables
 */
export function initializePerformanceMonitoring(): void {
  const config: PerformanceConfig = {
    enabled: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
    debug: import.meta.env.VITE_ENV === 'development',
    reportUrl: import.meta.env.VITE_PERFORMANCE_REPORT_URL,
    sampleRate: parseFloat(import.meta.env.VITE_PERFORMANCE_SAMPLE_RATE || '1.0'),
  };

  performanceMonitoring.initialize(config);
}

export default performanceMonitoring;
