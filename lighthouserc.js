// ============================================
// LIGHTHOUSE CI CONFIGURATION
// Performance testing and budgets
// ============================================

module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/messages',
        'http://localhost:3000/dashboard',
      ],
      numberOfRuns: 3,
      settings: {
        // Collect performance data
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        // Use mobile emulation
        emulatedFormFactor: 'mobile',
        // Throttling settings
        throttling: {
          rttMs: 40,
          throughputKbps: 10 * 1024,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      // Performance budgets (WCAG 2.1 AA compliance)
      assertions: {
        // Performance Metrics
        'categories:performance': ['error', { minScore: 0.9 }], // 90+ required
        'categories:accessibility': ['error', { minScore: 0.9 }], // 90+ required
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }], // < 1.5s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // < 2.5s
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // < 0.1
        'total-blocking-time': ['warn', { maxNumericValue: 300 }], // < 300ms
        'speed-index': ['warn', { maxNumericValue: 3000 }], // < 3s
        'interactive': ['error', { maxNumericValue: 3000 }], // < 3s TTI

        // Accessibility checks
        'color-contrast': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',
        'aria-valid-attr': 'error',
        'aria-required-attr': 'error',
        'button-name': 'error',
        'image-alt': 'error',
        'label': 'error',

        // Best Practices
        'uses-https': 'warn',
        'uses-http2': 'warn',
        'no-vulnerable-libraries': 'error',
        'errors-in-console': 'warn',

        // Resource budgets
        'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }], // 500KB JS
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100000 }], // 100KB CSS
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }], // 500KB images
        'resource-summary:font:size': ['warn', { maxNumericValue: 200000 }], // 200KB fonts
        'resource-summary:total:size': ['warn', { maxNumericValue: 2000000 }], // 2MB total

        // Network requests
        'network-requests': ['warn', { maxNumericValue: 50 }], // < 50 requests
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    server: {
      // Optional: Start server for CI
      // command: 'npm run dev',
      // port: 3000,
      // useAutomatedBrowsers: true,
    },
  },
};
