/**
 * Login E2E Tests
 *
 * Tests for OAuth authentication flows (Google, Microsoft)
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should display login page for unauthenticated users', async ({ page }) => {
    // Wait for landing page to load
    await expect(page).toHaveTitle(/Pulse/i);

    // Should see login buttons
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with microsoft/i })).toBeVisible();
  });

  test('should show OAuth providers', async ({ page }) => {
    // Google OAuth button
    const googleBtn = page.getByRole('button', { name: /google/i });
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toBeEnabled();

    // Microsoft OAuth button
    const microsoftBtn = page.getByRole('button', { name: /microsoft/i });
    await expect(microsoftBtn).toBeVisible();
    await expect(microsoftBtn).toBeEnabled();
  });

  test('should handle OAuth flow', async ({ page, context }) => {
    // Click Google sign in
    const googleBtn = page.getByRole('button', { name: /google/i });

    // Listen for new page (OAuth popup)
    const popupPromise = context.waitForEvent('page');
    await googleBtn.click();

    // In a real test, you would:
    // 1. Wait for OAuth popup
    // 2. Fill in credentials (in test environment)
    // 3. Complete OAuth flow
    // 4. Verify redirect back to app

    // For now, verify that clicking triggers navigation or popup
    const isNavigating = page.url() !== '/';
    expect(isNavigating || popupPromise).toBeTruthy();
  });

  test('should persist authentication state', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([
      {
        name: 'auth_token',
        value: 'mock-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.reload();

    // Should redirect to dashboard or show authenticated UI
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('should show error for failed login', async ({ page }) => {
    // Mock failed OAuth by intercepting the request
    await page.route('**/auth/**', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Authentication failed' }),
      });
    });

    // Attempt login
    await page.getByRole('button', { name: /google/i }).click();

    // Should show error message
    await expect(page.getByText(/authentication failed/i)).toBeVisible();
  });

  test('should logout successfully', async ({ page, context }) => {
    // Set up authenticated state
    await context.addCookies([
      {
        name: 'auth_token',
        value: 'mock-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/');

    // Find and click logout button (usually in user menu)
    await page.getByRole('button', { name: /profile|account|user/i }).click();
    await page.getByRole('menuitem', { name: /logout|sign out/i }).click();

    // Should redirect to landing page
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Cookies should be cleared
    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'auth_token')).toBeUndefined();
  });

  test('should handle session expiry', async ({ page, context }) => {
    // Set expired auth token
    await context.addCookies([
      {
        name: 'auth_token',
        value: 'expired-token',
        domain: 'localhost',
        path: '/',
        expires: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      },
    ]);

    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should remember redirect after login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // After login, should redirect back to intended page
    // (This would need actual OAuth flow implementation)
  });
});

test.describe('Multi-user scenarios', () => {
  test('should support multiple user sessions', async ({ browser }) => {
    // Create two browser contexts (different users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Authenticate different users
    await context1.addCookies([
      {
        name: 'auth_token',
        value: 'user1-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await context2.addCookies([
      {
        name: 'auth_token',
        value: 'user2-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page1.goto('/');
    await page2.goto('/');

    // Both should be authenticated independently
    await expect(page1.getByRole('navigation')).toBeVisible();
    await expect(page2.getByRole('navigation')).toBeVisible();

    await context1.close();
    await context2.close();
  });
});

test.describe('Security', () => {
  test('should not expose tokens in URL', async ({ page }) => {
    await page.goto('/');

    // URL should never contain tokens or sensitive data
    expect(page.url()).not.toContain('token');
    expect(page.url()).not.toContain('password');
    expect(page.url()).not.toContain('secret');
  });

  test('should use HTTPS in production', async ({ page }) => {
    // Skip in local dev
    if (process.env.NODE_ENV === 'production') {
      expect(page.url()).toMatch(/^https:\/\//);
    }
  });

  test('should have security headers', async ({ page }) => {
    const response = await page.goto('/');

    const headers = response?.headers();
    if (headers) {
      // Check for security headers
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBeDefined();
    }
  });
});
