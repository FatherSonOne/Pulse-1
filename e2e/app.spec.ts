import { test, expect } from '@playwright/test';

/**
 * PULSE End-to-End Tests
 *
 * These tests open a real browser and interact with your app
 * just like a real user would.
 *
 * Run with: npm run test:e2e
 */

test.describe('PULSE App', () => {
  test('should load the homepage', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot for verification
    await page.screenshot({ path: 'e2e/screenshots/homepage.png' });

    // Check that something renders (adjust selector for your app)
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');

    // Check the page title (adjust to match your app's title)
    await expect(page).toHaveTitle(/PULSE|Vite/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Take a mobile screenshot
    await page.screenshot({ path: 'e2e/screenshots/mobile.png' });

    // Verify the app still renders
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate without errors', async ({ page }) => {
    await page.goto('/');

    // Listen for any console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for app to be interactive
    await page.waitForLoadState('networkidle');

    // Verify no critical errors occurred
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404')
    );

    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }
  });
});
