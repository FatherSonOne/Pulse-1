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
    // Setup project — one-time interactive auth capture.
    // Run via: `npx playwright test --project=setup --headed`
    // Writes e2e/.auth/user.json which the projects below consume via
    // `storageState`. See e2e/auth.setup.ts for the flow.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Test on mobile viewports
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
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
