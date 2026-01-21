import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for PULSE
 *
 * This file configures how Playwright runs your browser tests.
 * Learn more: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Directory where your test files live
  testDir: './e2e',

  // Run tests in parallel for faster execution
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests (2 retries on CI, 0 locally)
  retries: process.env.CI ? 2 : 0,

  // Number of parallel workers (use fewer on CI to avoid flakiness)
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use - shows nice HTML report after tests
  reporter: [
    ['list'],  // Shows test progress in terminal
    ['html', { open: 'never' }]  // Creates HTML report
  ],

  // Shared settings for all tests
  use: {
    // Base URL for your app (Vite runs on port 5173)
    baseURL: 'http://localhost:5173',

    // Collect trace on first retry of a failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'on-first-retry',
  },

  // Configure different browsers to test
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Test on mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Start your dev server before running tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,  // 2 minutes to start
  },
});
