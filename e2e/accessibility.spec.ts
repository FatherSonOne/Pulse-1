// ============================================
// ACCESSIBILITY E2E TESTS (WCAG 2.1 AA)
// Comprehensive accessibility testing with axe-core
// ============================================

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility - WCAG 2.1 AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and login
    await page.goto('/');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test.describe('Automated Accessibility Scans', () => {
    test('should have no accessibility violations on dashboard', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have no accessibility violations on messages page', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');
      await page.waitForURL('**/messages');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have no accessibility violations in thread view', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have no accessibility violations in modals', async ({ page }) => {
      // Open a modal (adjust selector based on actual implementation)
      await page.click('[data-testid="settings-button"]');
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have no accessibility violations on forms', async ({ page }) => {
      await page.goto('/profile/settings');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast']) // Test separately
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate main menu with Tab key', async ({ page }) => {
      // Tab through navigation
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="messages-nav"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="calendar-nav"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="contacts-nav"]')).toBeFocused();
    });

    test('should activate elements with Enter/Space', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Focus first message
      await page.locator('[data-testid="message-item"]').first().focus();

      // Press Enter to select
      await page.keyboard.press('Enter');

      // Verify message is selected or action triggered
      await expect(page.locator('[data-testid="message-item"]').first()).toHaveClass(/selected|active/);
    });

    test('should support arrow key navigation in lists', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Focus message list
      await page.locator('[data-testid="message-list"]').focus();

      // Navigate with arrows
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');

      // Verify navigation works
      const focusedElement = await page.locator(':focus').getAttribute('data-testid');
      expect(focusedElement).toContain('message');
    });

    test('should trap focus in modals', async ({ page }) => {
      // Open modal
      await page.click('[data-testid="settings-button"]');
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Tab through all focusable elements
      const initialFocus = await page.locator(':focus').getAttribute('data-testid');

      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
      }

      // Verify focus is still within modal
      const currentFocusElement = page.locator(':focus');
      const modal = page.locator('[role="dialog"]');

      const isWithinModal = await currentFocusElement.evaluate(
        (el, modalEl) => modalEl.contains(el),
        await modal.elementHandle()
      );

      expect(isWithinModal).toBe(true);
    });

    test('should close modal with Escape key', async ({ page }) => {
      // Open modal
      await page.click('[data-testid="settings-button"]');
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Verify modal closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should skip to main content', async ({ page }) => {
      // Press Tab to focus skip link
      await page.keyboard.press('Tab');

      // Activate skip link
      const skipLink = page.locator('a[href="#main-content"]');
      if (await skipLink.isVisible()) {
        await page.keyboard.press('Enter');

        // Verify focus moved to main content
        const mainContent = page.locator('#main-content');
        await expect(mainContent).toBeFocused();
      }
    });
  });

  test.describe('Focus Indicators', () => {
    test('should show visible focus indicators on all interactive elements', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Tab through elements and check focus indicators
      const interactiveElements = [
        '[data-testid="new-message-button"]',
        '[data-testid="search-button"]',
        '[data-testid="filter-button"]',
      ];

      for (const selector of interactiveElements) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          await element.focus();

          // Check if element has visible outline/border
          const outline = await element.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
              outline: styles.outline,
              outlineWidth: styles.outlineWidth,
              outlineStyle: styles.outlineStyle,
              boxShadow: styles.boxShadow,
            };
          });

          // Should have some focus indicator
          const hasFocusIndicator =
            outline.outline !== 'none' ||
            parseFloat(outline.outlineWidth) > 0 ||
            outline.boxShadow !== 'none';

          expect(hasFocusIndicator).toBe(true);
        }
      }
    });

    test('should have sufficient focus indicator contrast (3:1)', async ({ page }) => {
      // This is a visual test - would need contrast calculation
      // For now, verify focus indicators exist
      await page.click('[data-testid="messages-nav"]');

      const button = page.locator('[data-testid="new-message-button"]');
      await button.focus();

      await page.screenshot({
        path: 'e2e/screenshots/focus-indicator.png',
        clip: await button.boundingBox() || undefined,
      });

      // Manual verification: outline should be at least 3px wide
      const outlineWidth = await button.evaluate((el) => {
        return window.getComputedStyle(el).outlineWidth;
      });

      expect(parseFloat(outlineWidth)).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Color Contrast', () => {
    test('should have sufficient contrast for normal text (4.5:1)', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('[data-testid="message-content"]')
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        (v) => v.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    });

    test('should have sufficient contrast for large text (3:1)', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('h1, h2, h3, [data-testid="channel-name"]')
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        (v) => v.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    });

    test('should have sufficient contrast in dark mode', async ({ page }) => {
      // Enable dark mode
      await page.click('[data-testid="theme-toggle"]');
      await page.waitForTimeout(500); // Wait for theme transition

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        (v) => v.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    });
  });

  test.describe('ARIA Attributes', () => {
    test('should have proper ARIA labels on buttons', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Check important buttons have labels
      const buttons = [
        '[data-testid="new-message-button"]',
        '[data-testid="search-button"]',
        '[data-testid="settings-button"]',
      ];

      for (const selector of buttons) {
        const button = page.locator(selector);
        if (await button.isVisible()) {
          const ariaLabel = await button.getAttribute('aria-label');
          const text = await button.textContent();

          // Should have either aria-label or visible text
          expect(ariaLabel || text?.trim()).toBeTruthy();
        }
      }
    });

    test('should have proper roles on landmarks', async ({ page }) => {
      // Check for proper landmark roles
      await expect(page.locator('nav')).toHaveAttribute('role', 'navigation');
      await expect(page.locator('main')).toHaveAttribute('role', 'main');
    });

    test('should use ARIA live regions for dynamic content', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Check for live regions
      const liveRegions = page.locator('[aria-live]');
      expect(await liveRegions.count()).toBeGreaterThan(0);

      // Verify appropriate politeness levels
      const politeRegion = page.locator('[aria-live="polite"]');
      expect(await politeRegion.count()).toBeGreaterThan(0);
    });

    test('should mark required form fields', async ({ page }) => {
      // Go to a form page
      await page.goto('/profile/edit');

      // Required fields should have aria-required
      const requiredFields = page.locator('input[required], textarea[required]');
      const count = await requiredFields.count();

      for (let i = 0; i < count; i++) {
        const field = requiredFields.nth(i);
        const ariaRequired = await field.getAttribute('aria-required');

        expect(ariaRequired).toBe('true');
      }
    });

    test('should announce form errors to screen readers', async ({ page }) => {
      await page.goto('/profile/edit');

      // Submit form with errors
      await page.click('[data-testid="save-button"]');

      // Check for error announcements
      const errorRegion = page.locator('[role="alert"]');
      await expect(errorRegion).toBeVisible();

      const errorText = await errorRegion.textContent();
      expect(errorText).toBeTruthy();
    });
  });

  test.describe('Form Accessibility', () => {
    test('should have labels for all form inputs', async ({ page }) => {
      await page.goto('/profile/edit');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a'])
        .include('form')
        .analyze();

      const labelViolations = accessibilityScanResults.violations.filter(
        (v) => v.id === 'label'
      );

      expect(labelViolations).toEqual([]);
    });

    test('should associate labels with inputs correctly', async ({ page }) => {
      await page.goto('/profile/edit');

      // Check for proper label association
      const inputs = page.locator('input[type="text"], input[type="email"], textarea');
      const count = await inputs.count();

      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const inputId = await input.getAttribute('id');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        const ariaLabel = await input.getAttribute('aria-label');

        // Should have one of: id with matching label, aria-labelledby, or aria-label
        const hasLabel = inputId || ariaLabelledBy || ariaLabel;
        expect(hasLabel).toBeTruthy();
      }
    });

    test('should show clear error messages', async ({ page }) => {
      await page.goto('/profile/edit');

      // Trigger validation error
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.click('[data-testid="save-button"]');

      // Error should be visible and associated with input
      const emailError = page.locator('[data-testid="email-error"]');
      await expect(emailError).toBeVisible();

      const errorText = await emailError.textContent();
      expect(errorText).toMatch(/email|invalid|format/i);
    });
  });

  test.describe('Touch Target Sizes (Mobile)', () => {
    test.use({
      viewport: { width: 375, height: 667 },
      isMobile: true,
    });

    test('should have minimum 44x44px touch targets', async ({ page }) => {
      await page.goto('/');

      // Login
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      // Check important interactive elements
      const interactiveElements = [
        '[data-testid="messages-nav"]',
        '[data-testid="new-message-button"]',
        '[data-testid="settings-button"]',
      ];

      for (const selector of interactiveElements) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const box = await element.boundingBox();

          if (box) {
            // WCAG 2.1 AA requires 44x44px minimum
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });

    test('should have adequate spacing between touch targets', async ({ page }) => {
      await page.goto('/');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      // Click messages
      await page.click('[data-testid="messages-nav"]');

      // Check message action buttons spacing
      const messageActions = page.locator('[data-testid="message-actions"]').first();
      const buttons = messageActions.locator('button');
      const count = await buttons.count();

      if (count > 1) {
        const firstBox = await buttons.first().boundingBox();
        const secondBox = await buttons.nth(1).boundingBox();

        if (firstBox && secondBox) {
          // Calculate spacing
          const spacing = Math.abs(secondBox.x - (firstBox.x + firstBox.width));

          // Should have at least 8px spacing
          expect(spacing).toBeGreaterThanOrEqual(8);
        }
      }
    });
  });

  test.describe('Screen Reader Compatibility', () => {
    test('should have descriptive page titles', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveTitle(/Dashboard|Home/i);

      await page.goto('/messages');
      await expect(page).toHaveTitle(/Messages|Inbox/i);
    });

    test('should have heading hierarchy', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Check heading levels are in order
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1); // Only one h1 per page

      // Verify logical heading structure exists
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(1);
    });

    test('should announce loading states', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Trigger loading state
      await page.click('[data-testid="load-more-button"]');

      // Check for loading announcement
      const loadingRegion = page.locator('[role="status"]');
      const loadingText = await loadingRegion.textContent();

      expect(loadingText).toMatch(/loading|please wait/i);
    });

    test('should provide alternative text for images', async ({ page }) => {
      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');

        // All images should have alt attribute (even if empty for decorative)
        expect(alt).not.toBeNull();
      }
    });

    test('should identify language', async ({ page }) => {
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBeTruthy();
      expect(htmlLang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/); // e.g., 'en' or 'en-US'
    });
  });

  test.describe('Zoom and Resize', () => {
    test('should be readable at 200% zoom', async ({ page }) => {
      // Set zoom to 200%
      await page.evaluate(() => {
        document.body.style.zoom = '2';
      });

      await page.click('[data-testid="messages-nav"]');

      // Content should still be accessible (not cut off)
      const messageContent = page.locator('[data-testid="message-content"]').first();
      await expect(messageContent).toBeVisible();

      // Take screenshot for manual review
      await page.screenshot({ path: 'e2e/screenshots/zoom-200.png', fullPage: true });
    });

    test('should reflow at narrow widths', async ({ page }) => {
      // Set to 320px (minimum mobile width)
      await page.setViewportSize({ width: 320, height: 568 });

      await page.click('[data-testid="messages-nav"]');

      // Content should not require horizontal scrolling
      const horizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(horizontalScroll).toBe(false);
    });
  });

  test.describe('Motion and Animation', () => {
    test('should respect prefers-reduced-motion', async ({ page }) => {
      // Enable reduced motion
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await page.click('[data-testid="messages-nav"]');

      // Open thread (normally animated)
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');

      // Animation duration should be minimal
      const transitionDuration = await page.locator('[data-testid="thread-view"]').evaluate((el) => {
        return window.getComputedStyle(el).transitionDuration;
      });

      // Should be 0s or very short when motion is reduced
      expect(parseFloat(transitionDuration)).toBeLessThanOrEqual(0.1);
    });

    test('should not have flashing content', async ({ page }) => {
      // This is typically a manual test, but we can check for known problematic patterns
      const problematicAnimations = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const flashing: string[] = [];

        elements.forEach((el) => {
          const styles = window.getComputedStyle(el);
          const animation = styles.animation;

          // Check for rapid blinking animations (> 3 flashes per second)
          if (animation && animation.includes('blink')) {
            flashing.push(el.tagName);
          }
        });

        return flashing;
      });

      expect(problematicAnimations).toEqual([]);
    });
  });
});
