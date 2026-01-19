// ============================================
// TOOLS PANEL E2E TESTS
// Tests for productivity tools panel
// ============================================

import { test, expect } from '@playwright/test';

test.describe('Tools Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Navigate to tools
    await page.click('[data-testid="tools-nav"]');
  });

  test('should display all tool categories', async ({ page }) => {
    // Verify main categories are visible
    await expect(page.locator('[data-testid="category-ai"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-analytics"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-productivity"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-integrations"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/tools-panel.png' });
  });

  test('should expand and collapse categories', async ({ page }) => {
    // Collapse AI category
    await page.click('[data-testid="category-ai-header"]');

    // Verify tools are hidden
    await expect(page.locator('[data-testid="category-ai-content"]')).not.toBeVisible();

    // Expand again
    await page.click('[data-testid="category-ai-header"]');

    // Verify tools are visible
    await expect(page.locator('[data-testid="category-ai-content"]')).toBeVisible();
  });

  test('should navigate to brainstorm tool', async ({ page }) => {
    await page.click('[data-testid="tool-brainstorm"]');

    // Verify navigation
    await expect(page).toHaveURL(/.*brainstorm/);
    await expect(page.locator('[data-testid="brainstorm-view"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/brainstorm-tool.png' });
  });

  test('should navigate to analytics dashboard', async ({ page }) => {
    await page.click('[data-testid="tool-analytics"]');

    await expect(page).toHaveURL(/.*analytics/);
    await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/analytics-dashboard.png' });
  });

  test('should search for tools', async ({ page }) => {
    // Open search
    await page.fill('[data-testid="tools-search-input"]', 'brainstorm');

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Verify brainstorm tool is visible
    await expect(page.locator('[data-testid="tool-brainstorm"]')).toBeVisible();

    // Verify other tools are hidden
    const visibleTools = await page.locator('[data-testid^="tool-"]').count();
    expect(visibleTools).toBeLessThan(10); // Fewer than all tools
  });

  test('should show tool descriptions on hover', async ({ page }) => {
    await page.hover('[data-testid="tool-brainstorm"]');

    // Verify tooltip appears
    await expect(page.locator('[data-testid="tool-tooltip"]')).toBeVisible({ timeout: 1000 });

    await page.screenshot({ path: 'e2e/screenshots/tool-tooltip.png' });
  });

  test('should mark favorite tools', async ({ page }) => {
    // Click favorite button
    await page.click('[data-testid="tool-brainstorm"] [data-testid="favorite-button"]');

    // Verify favorite indicator
    await expect(page.locator('[data-testid="tool-brainstorm"] [data-testid="favorite-indicator"]')).toBeVisible();

    // Verify appears in favorites section
    await page.click('[data-testid="favorites-tab"]');
    await expect(page.locator('[data-testid="tool-brainstorm"]')).toBeVisible();
  });

  test('should display recent tools', async ({ page }) => {
    // Navigate to a tool
    await page.click('[data-testid="tool-brainstorm"]');
    await page.goBack();

    // Navigate to another tool
    await page.click('[data-testid="tool-analytics"]');
    await page.goBack();

    // Check recent section
    await page.click('[data-testid="recent-tab"]');

    // Verify both tools appear in recent
    await expect(page.locator('[data-testid="tool-brainstorm"]')).toBeVisible();
    await expect(page.locator('[data-testid="tool-analytics"]')).toBeVisible();
  });
});

test.describe('Mobile Tools Panel', () => {
  test.use({
    viewport: { width: 375, height: 667 }
  });

  test('should open tools panel as bottom sheet on mobile', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');

    // Click tools
    await page.click('[data-testid="tools-nav"]');

    // Verify bottom sheet appears
    await expect(page.locator('[data-testid="tools-bottom-sheet"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/mobile-tools-panel.png' });
  });

  test('should swipe to dismiss tools panel on mobile', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    await page.click('[data-testid="mobile-menu-button"]');
    await page.click('[data-testid="tools-nav"]');

    // Swipe down to dismiss
    const sheet = page.locator('[data-testid="tools-bottom-sheet"]');
    const box = await sheet.boundingBox();

    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height);
      await page.mouse.up();
    }

    // Verify dismissed
    await expect(sheet).not.toBeVisible({ timeout: 2000 });
  });
});
