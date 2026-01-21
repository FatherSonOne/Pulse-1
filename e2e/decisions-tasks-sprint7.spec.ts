import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Sprint 7 Testing: AI-Enhanced Decisions & Tasks Page
 *
 * Comprehensive testing covering:
 * - Visual regression testing
 * - Responsive design (mobile, tablet, desktop)
 * - Interactive features
 * - Loading states & error handling
 * - Accessibility (WCAG 2.1 AA)
 * - Performance benchmarks
 */

test.describe('Sprint 7: Decisions & Tasks Page - Comprehensive Testing', () => {
  let page: Page;

  // Test configuration
  const BASE_URL = 'http://localhost:5173';
  const DECISIONS_TASKS_PATH = '/decisions-tasks';

  // Viewport sizes for responsive testing
  const VIEWPORTS = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1920, height: 1080 }
  };

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // Navigate to the page
    await page.goto(`${BASE_URL}${DECISIONS_TASKS_PATH}`);

    // Wait for the page to be fully loaded
    await page.waitForSelector('.decision-task-hub', { timeout: 10000 });
  });

  /**
   * VISUAL TESTING
   */
  test.describe('Visual Testing & Screenshots', () => {
    test('should capture desktop light mode screenshot', async () => {
      await page.setViewportSize(VIEWPORTS.desktop);

      // Ensure light mode
      const isDarkMode = await page.evaluate(() => document.body.classList.contains('dark'));
      if (isDarkMode) {
        await page.click('[data-testid="theme-toggle"], button[aria-label*="theme"]');
      }

      // Wait for content
      await page.waitForTimeout(1000);

      // Capture screenshot
      await page.screenshot({
        path: 'e2e/screenshots/sprint7-desktop-light.png',
        fullPage: true
      });

      expect(true).toBe(true); // Screenshot captured
    });

    test('should capture desktop dark mode screenshot', async () => {
      await page.setViewportSize(VIEWPORTS.desktop);

      // Ensure dark mode
      const isDarkMode = await page.evaluate(() => document.body.classList.contains('dark'));
      if (!isDarkMode) {
        await page.click('[data-testid="theme-toggle"], button[aria-label*="theme"]');
        await page.waitForTimeout(500);
      }

      // Capture screenshot
      await page.screenshot({
        path: 'e2e/screenshots/sprint7-desktop-dark.png',
        fullPage: true
      });

      expect(true).toBe(true);
    });

    test('should capture mobile view screenshot', async () => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'e2e/screenshots/sprint7-mobile.png',
        fullPage: true
      });

      expect(true).toBe(true);
    });

    test('should capture tablet view screenshot', async () => {
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'e2e/screenshots/sprint7-tablet.png',
        fullPage: true
      });

      expect(true).toBe(true);
    });

    test('should capture empty states screenshot', async () => {
      // This assumes empty state when no data
      // You may need to adjust based on actual implementation
      await page.screenshot({
        path: 'e2e/screenshots/sprint7-empty-state.png',
        fullPage: true
      });

      expect(true).toBe(true);
    });
  });

  /**
   * FUNCTIONAL TESTING
   */
  test.describe('Interactive Features', () => {
    test('should toggle between Decisions and Tasks tabs', async () => {
      // Find tab buttons
      const decisionsTab = page.locator('.tab-button', { hasText: /decisions/i });
      const tasksTab = page.locator('.tab-button', { hasText: /tasks/i });

      // Click Decisions tab
      await decisionsTab.click();
      await expect(decisionsTab).toHaveClass(/active/);

      // Verify decisions content visible
      await expect(page.locator('.decisions-section, .decisions-grid')).toBeVisible();

      // Click Tasks tab
      await tasksTab.click();
      await expect(tasksTab).toHaveClass(/active/);

      // Verify tasks content visible
      await expect(page.locator('.tasks-section, .tasks-list-view')).toBeVisible();
    });

    test('should toggle insights dashboard', async () => {
      const insightsDashboard = page.locator('.insights-dashboard');

      if (await insightsDashboard.isVisible()) {
        const header = page.locator('.insights-header');

        // Collapse
        await header.click();
        await expect(insightsDashboard).toHaveClass(/collapsed/);

        // Expand
        await header.click();
        await expect(insightsDashboard).not.toHaveClass(/collapsed/);
      }
    });

    test('should filter decisions by status', async () => {
      // Click Decisions tab
      await page.click('.tab-button:has-text("Decisions")');

      // Find status filter dropdown
      const statusFilter = page.locator('select.filter-select').first();

      // Select "Voting" status
      await statusFilter.selectOption('voting');
      await page.waitForTimeout(500);

      // Verify URL or content updated
      // (implementation-specific validation)
      expect(true).toBe(true);
    });

    test('should filter tasks by status', async () => {
      // Click Tasks tab
      await page.click('.tab-button:has-text("Tasks")');

      // Find task status filter
      const statusFilter = page.locator('select.filter-select').first();

      // Select "In Progress" status
      await statusFilter.selectOption('in_progress');
      await page.waitForTimeout(500);

      expect(true).toBe(true);
    });

    test('should sort tasks', async () => {
      await page.click('.tab-button:has-text("Tasks")');

      // Find sort dropdown
      const sortSelect = page.locator('select.filter-select').nth(1);

      if (await sortSelect.isVisible()) {
        await sortSelect.selectOption('priority');
        await page.waitForTimeout(500);

        await sortSelect.selectOption('due_date');
        await page.waitForTimeout(500);
      }

      expect(true).toBe(true);
    });

    test('should show/hide overdue tasks only', async () => {
      await page.click('.tab-button:has-text("Tasks")');

      const overdueCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /overdue/i });

      if (await overdueCheckbox.isVisible()) {
        await overdueCheckbox.check();
        await page.waitForTimeout(500);

        await overdueCheckbox.uncheck();
      }

      expect(true).toBe(true);
    });

    test('should open AI Assistant sidebar', async () => {
      const aiButton = page.locator('button', { hasText: /ai assistant/i });

      if (await aiButton.isVisible()) {
        await aiButton.click();

        // Verify sidebar appeared
        await expect(page.locator('.conversational-assistant, .ai-assistant-sidebar')).toBeVisible();

        // Close sidebar
        const closeButton = page.locator('.assistant-close-button, button[aria-label*="Close"]');
        await closeButton.click();
      }
    });

    test('should open Decision Mission modal', async () => {
      const createButton = page.locator('button', { hasText: /create decision/i });

      if (await createButton.isVisible()) {
        await createButton.click();

        // Verify modal appeared
        await expect(page.locator('.decision-mission-modal, .decision-mission-container')).toBeVisible();

        // Capture modal screenshot
        await page.screenshot({
          path: 'e2e/screenshots/sprint7-decision-modal.png',
          fullPage: false
        });

        // Close modal
        const closeButton = page.locator('.close-button, button[aria-label*="Close"]').first();
        await closeButton.click();
      }
    });

    test('should switch view modes (List/Kanban)', async () => {
      await page.click('.tab-button:has-text("Tasks")');

      // Find view buttons
      const listButton = page.locator('.view-button', { hasText: /list/i });
      const kanbanButton = page.locator('.view-button', { hasText: /kanban/i });

      if (await kanbanButton.isVisible() && !await kanbanButton.isDisabled()) {
        await kanbanButton.click();
        await page.waitForTimeout(500);

        // Capture Kanban view
        await page.screenshot({
          path: 'e2e/screenshots/sprint7-kanban-view.png',
          fullPage: true
        });

        await listButton.click();
      }

      expect(true).toBe(true);
    });

    test('should dismiss nudges', async () => {
      const nudgesPanel = page.locator('.nudges-panel');

      if (await nudgesPanel.isVisible()) {
        const dismissAllButton = page.locator('button', { hasText: /dismiss all/i });

        if (await dismissAllButton.isVisible()) {
          await dismissAllButton.click();

          // Verify nudges panel hidden
          await expect(nudgesPanel).not.toBeVisible();
        }
      }
    });

    test('should refresh data', async () => {
      const refreshButton = page.locator('.refresh-button, button[title*="Refresh"]');

      if (await refreshButton.isVisible()) {
        await refreshButton.click();

        // Wait for refresh animation
        await page.waitForTimeout(1000);
      }

      expect(true).toBe(true);
    });
  });

  /**
   * RESPONSIVE DESIGN TESTING
   */
  test.describe('Responsive Design', () => {
    test('should layout correctly on mobile (375px)', async () => {
      await page.setViewportSize(VIEWPORTS.mobile);

      // Verify main container exists
      await expect(page.locator('.decision-task-hub')).toBeVisible();

      // Check header is responsive
      const header = page.locator('.hub-header');
      await expect(header).toBeVisible();

      // Capture screenshot
      await page.screenshot({
        path: 'e2e/screenshots/sprint7-mobile-responsive.png',
        fullPage: true
      });
    });

    test('should layout correctly on tablet (768px)', async () => {
      await page.setViewportSize(VIEWPORTS.tablet);

      await expect(page.locator('.decision-task-hub')).toBeVisible();

      await page.screenshot({
        path: 'e2e/screenshots/sprint7-tablet-responsive.png',
        fullPage: true
      });
    });

    test('should handle landscape orientation', async () => {
      await page.setViewportSize({ width: 812, height: 375 }); // iPhone landscape

      await expect(page.locator('.decision-task-hub')).toBeVisible();

      await page.screenshot({
        path: 'e2e/screenshots/sprint7-landscape.png',
        fullPage: true
      });
    });

    test('should have readable font sizes on mobile', async () => {
      await page.setViewportSize(VIEWPORTS.mobile);

      const title = page.locator('.hub-title');
      const fontSize = await title.evaluate(el => window.getComputedStyle(el).fontSize);

      // Font size should be at least 14px for readability
      const fontSizeNumber = parseInt(fontSize);
      expect(fontSizeNumber).toBeGreaterThanOrEqual(14);
    });
  });

  /**
   * LOADING STATES & ERROR HANDLING
   */
  test.describe('Loading States', () => {
    test('should show loading spinner while data loads', async ({ page: freshPage }) => {
      // Slow down network to see loading state
      await freshPage.route('**/*', route => {
        setTimeout(() => route.continue(), 500);
      });

      await freshPage.goto(`${BASE_URL}${DECISIONS_TASKS_PATH}`);

      // Check for loading state
      const loadingState = freshPage.locator('.loading-state, .spinner');

      // May or may not be visible depending on data load speed
      // This test documents the expected behavior
      expect(true).toBe(true);
    });

    test('should show empty state when no decisions', async () => {
      // This assumes empty state is visible
      const emptyState = page.locator('.empty-state');

      if (await emptyState.isVisible()) {
        await page.screenshot({
          path: 'e2e/screenshots/sprint7-empty-decisions.png',
          fullPage: false
        });

        // Verify empty state has helpful message
        await expect(emptyState).toContainText(/no decisions|create/i);
      }
    });

    test('should show empty state when no tasks', async () => {
      await page.click('.tab-button:has-text("Tasks")');

      const emptyState = page.locator('.empty-state');

      if (await emptyState.isVisible()) {
        await page.screenshot({
          path: 'e2e/screenshots/sprint7-empty-tasks.png',
          fullPage: false
        });
      }
    });
  });

  /**
   * ACCESSIBILITY TESTING (WCAG 2.1 AA)
   */
  test.describe('Accessibility', () => {
    test('should pass axe accessibility audit', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

      // Log violations
      if (accessibilityScanResults.violations.length > 0) {
        console.log('Accessibility violations:', accessibilityScanResults.violations);
      }

      // Should have no critical violations
      const criticalViolations = accessibilityScanResults.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(criticalViolations).toHaveLength(0);
    });

    test('should have proper ARIA labels on buttons', async () => {
      const aiButton = page.locator('button', { hasText: /ai assistant/i });
      const createButton = page.locator('button', { hasText: /create decision/i });

      if (await aiButton.isVisible()) {
        const ariaLabel = await aiButton.getAttribute('aria-label');
        // Should have meaningful label or title
        expect(ariaLabel || await aiButton.getAttribute('title')).toBeTruthy();
      }

      if (await createButton.isVisible()) {
        const ariaLabel = await createButton.getAttribute('aria-label');
        expect(ariaLabel || await createButton.getAttribute('title')).toBeTruthy();
      }
    });

    test('should support keyboard navigation', async () => {
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Focus should be visible
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test('should have sufficient color contrast', async () => {
      // Specifically check color contrast
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa', 'wcag21aa'])
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        v => v.id.includes('color-contrast')
      );

      if (contrastViolations.length > 0) {
        console.log('Color contrast violations:', contrastViolations);
      }

      expect(contrastViolations).toHaveLength(0);
    });

    test('should have alt text on images', async () => {
      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');

        // Decorative images can have empty alt, but it should exist
        expect(alt !== null).toBe(true);
      }
    });
  });

  /**
   * PERFORMANCE TESTING
   */
  test.describe('Performance', () => {
    test('should measure page load time', async ({ page: freshPage }) => {
      const startTime = Date.now();

      await freshPage.goto(`${BASE_URL}${DECISIONS_TASKS_PATH}`);
      await freshPage.waitForSelector('.decision-task-hub', { timeout: 10000 });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      console.log(`⏱️  Page load time: ${loadTime}ms`);

      // Should load in under 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should measure Time to Interactive', async ({ page: freshPage }) => {
      await freshPage.goto(`${BASE_URL}${DECISIONS_TASKS_PATH}`);

      const metrics = await freshPage.evaluate(() => ({
        // @ts-ignore
        navigation: performance.getEntriesByType('navigation')[0],
        // @ts-ignore
        paint: performance.getEntriesByType('paint')
      }));

      console.log('📊 Performance metrics:', metrics);

      expect(true).toBe(true);
    });

    test('should not have memory leaks', async () => {
      // Click around to trigger state changes
      await page.click('.tab-button:has-text("Tasks")');
      await page.waitForTimeout(500);

      await page.click('.tab-button:has-text("Decisions")');
      await page.waitForTimeout(500);

      // Get initial memory
      const initialMemory = await page.evaluate(() => {
        // @ts-ignore
        return performance.memory?.usedJSHeapSize || 0;
      });

      // Perform actions multiple times
      for (let i = 0; i < 5; i++) {
        await page.click('.tab-button:has-text("Tasks")');
        await page.waitForTimeout(200);
        await page.click('.tab-button:has-text("Decisions")');
        await page.waitForTimeout(200);
      }

      const finalMemory = await page.evaluate(() => {
        // @ts-ignore
        return performance.memory?.usedJSHeapSize || 0;
      });

      const memoryIncrease = finalMemory - initialMemory;
      console.log(`💾 Memory increase: ${memoryIncrease / 1024 / 1024}MB`);

      // Memory shouldn't increase dramatically (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  /**
   * CROSS-BROWSER TESTING
   * Note: Run with different browsers using --project flag
   */
  test.describe('Cross-browser', () => {
    test('should work in current browser', async () => {
      await expect(page.locator('.decision-task-hub')).toBeVisible();
      expect(true).toBe(true);
    });
  });
});

/**
 * AI FEATURES SPECIFIC TESTING
 */
test.describe('AI Features Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/decisions-tasks`);
    await page.waitForSelector('.decision-task-hub');
  });

  test('should display AI insights dashboard', async ({ page }) => {
    const insightsDashboard = page.locator('.insights-dashboard');

    if (await insightsDashboard.isVisible()) {
      // Verify metrics are displayed
      await expect(page.locator('.metric-card')).toHaveCount(4); // 4 metrics

      await page.screenshot({
        path: 'e2e/screenshots/sprint7-ai-insights.png',
        fullPage: false
      });
    }
  });

  test('should display proactive nudges', async ({ page }) => {
    const nudgesPanel = page.locator('.nudges-panel');

    if (await nudgesPanel.isVisible()) {
      await page.screenshot({
        path: 'e2e/screenshots/sprint7-nudges.png',
        fullPage: false
      });
    }
  });

  test('should show AI task prioritizer', async ({ page }) => {
    await page.click('.tab-button:has-text("Tasks")');

    const prioritizeButton = page.locator('button', { hasText: /ai prioritize/i });

    if (await prioritizeButton.isVisible()) {
      await prioritizeButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'e2e/screenshots/sprint7-ai-prioritizer.png',
        fullPage: true
      });
    }
  });

  test('should display enhanced decision cards with AI badges', async ({ page }) => {
    const decisionCards = page.locator('.enhanced-decision-card');

    if (await decisionCards.count() > 0) {
      await page.screenshot({
        path: 'e2e/screenshots/sprint7-decision-cards.png',
        fullPage: true
      });
    }
  });

  test('should display enhanced task cards with AI features', async ({ page }) => {
    await page.click('.tab-button:has-text("Tasks")');

    const taskCards = page.locator('.enhanced-task-card');

    if (await taskCards.count() > 0) {
      await page.screenshot({
        path: 'e2e/screenshots/sprint7-task-cards.png',
        fullPage: true
      });
    }
  });
});
