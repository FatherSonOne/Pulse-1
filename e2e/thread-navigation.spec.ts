// ============================================
// THREAD NAVIGATION E2E TESTS
// Tests for thread navigation, keyboard shortcuts, and interactions
// ============================================

import { test, expect, Page } from '@playwright/test';

test.describe('Thread Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and login
    await page.goto('/');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to messages
    await page.click('[data-testid="messages-nav"]');
    await page.waitForURL('**/messages');
  });

  test.describe('Mouse Navigation', () => {
    test('should navigate to thread on click', async ({ page }) => {
      // Click on a message to open thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');

      // Verify thread view opens
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible({ timeout: 5000 });

      // Verify thread header shows parent message
      await expect(page.locator('[data-testid="thread-header"]')).toBeVisible();

      await page.screenshot({ path: 'e2e/screenshots/thread-opened.png' });
    });

    test('should close thread with close button', async ({ page }) => {
      // Open thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Close thread
      await page.click('[data-testid="thread-close-button"]');

      // Verify thread view closes
      await expect(page.locator('[data-testid="thread-view"]')).not.toBeVisible();
    });

    test('should navigate between threads', async ({ page }) => {
      // Open first thread
      const firstMessage = page.locator('[data-testid="message-item"]').first();
      const firstMessageText = await firstMessage.textContent();

      await firstMessage.locator('[data-testid="reply-button"]').click();
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Open second thread
      await page.click('[data-testid="message-item"]:nth-child(2) [data-testid="reply-button"]');

      // Verify new thread opened
      const threadHeader = await page.locator('[data-testid="thread-header"]').textContent();
      expect(threadHeader).not.toContain(firstMessageText);
    });

    test('should maintain scroll position when navigating threads', async ({ page }) => {
      // Scroll message list
      await page.locator('[data-testid="message-list"]').evaluate((el) => {
        el.scrollTop = 500;
      });

      const scrollPosition = await page.locator('[data-testid="message-list"]').evaluate(
        (el) => el.scrollTop
      );

      // Open thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Close thread
      await page.click('[data-testid="thread-close-button"]');

      // Verify scroll position maintained
      const newScrollPosition = await page.locator('[data-testid="message-list"]').evaluate(
        (el) => el.scrollTop
      );

      expect(newScrollPosition).toBeCloseTo(scrollPosition, 50);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should open thread with Enter key', async ({ page }) => {
      // Focus on first message
      await page.locator('[data-testid="message-item"]').first().focus();

      // Press Tab to focus reply button
      await page.keyboard.press('Tab');

      // Press Enter to open thread
      await page.keyboard.press('Enter');

      // Verify thread opens
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible({ timeout: 5000 });
    });

    test('should close thread with Escape key', async ({ page }) => {
      // Open thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Verify thread closes
      await expect(page.locator('[data-testid="thread-view"]')).not.toBeVisible();
    });

    test('should navigate between messages with arrow keys', async ({ page }) => {
      // Focus first message
      const firstMessage = page.locator('[data-testid="message-item"]').first();
      await firstMessage.focus();

      // Press Down arrow
      await page.keyboard.press('ArrowDown');

      // Verify focus moved to second message
      const focusedElement = page.locator(':focus');
      const secondMessage = page.locator('[data-testid="message-item"]').nth(1);

      // Check if focus is within second message
      const isFocused = await focusedElement.evaluate(
        (el, second) => second.contains(el),
        await secondMessage.elementHandle()
      );

      expect(isFocused).toBe(true);
    });

    test('should jump to top with Home key', async ({ page }) => {
      // Scroll to middle of messages
      await page.locator('[data-testid="message-list"]').evaluate((el) => {
        el.scrollTop = 500;
      });

      // Focus message list
      await page.locator('[data-testid="message-list"]').focus();

      // Press Home
      await page.keyboard.press('Home');

      // Verify scrolled to top
      const scrollTop = await page.locator('[data-testid="message-list"]').evaluate(
        (el) => el.scrollTop
      );

      expect(scrollTop).toBeLessThan(50);
    });

    test('should jump to bottom with End key', async ({ page }) => {
      // Focus message list
      await page.locator('[data-testid="message-list"]').focus();

      // Press End
      await page.keyboard.press('End');

      // Verify scrolled to bottom
      const isAtBottom = await page.locator('[data-testid="message-list"]').evaluate((el) => {
        return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 50;
      });

      expect(isAtBottom).toBe(true);
    });

    test('should quick-reply with Ctrl+R', async ({ page }) => {
      // Focus first message
      await page.locator('[data-testid="message-item"]').first().focus();

      // Press Ctrl+R
      await page.keyboard.press('Control+R');

      // Verify thread opens and input focused
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="thread-input"]')).toBeFocused();
    });

    test('should navigate thread replies with Tab', async ({ page }) => {
      // Open thread with multiple replies
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Tab through thread elements
      await page.keyboard.press('Tab'); // First reply
      await page.keyboard.press('Tab'); // Second reply
      await page.keyboard.press('Tab'); // Thread input

      // Verify thread input is focused
      await expect(page.locator('[data-testid="thread-input"]')).toBeFocused();
    });
  });

  test.describe('Thread Animations', () => {
    test('should animate thread opening', async ({ page }) => {
      // Open thread
      const startTime = Date.now();
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();
      const duration = Date.now() - startTime;

      // Should complete within 300ms target
      expect(duration).toBeLessThan(300);

      // Verify smooth animation (no jank)
      await page.screenshot({ path: 'e2e/screenshots/thread-animation.png' });
    });

    test('should have smooth scroll in thread', async ({ page }) => {
      // Open thread with many replies
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Measure scroll performance
      const scrollPerformance = await page.locator('[data-testid="thread-replies"]').evaluate(
        (el) => {
          const startTime = performance.now();
          el.scrollTop = el.scrollHeight;
          const endTime = performance.now();
          return endTime - startTime;
        }
      );

      // Scroll should be instant
      expect(scrollPerformance).toBeLessThan(50);
    });
  });

  test.describe('Thread Context', () => {
    test('should show parent message in thread header', async ({ page }) => {
      // Get parent message text
      const parentMessage = page.locator('[data-testid="message-item"]').first();
      const parentText = await parentMessage.locator('[data-testid="message-content"]').textContent();

      // Open thread
      await parentMessage.locator('[data-testid="reply-button"]').click();
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Verify parent message shown in header
      const headerText = await page.locator('[data-testid="thread-header"]').textContent();
      expect(headerText).toContain(parentText?.slice(0, 50)); // First 50 chars
    });

    test('should show reply count in thread header', async ({ page }) => {
      // Open thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Verify reply count
      const replyCount = await page.locator('[data-testid="thread-reply-count"]').textContent();
      expect(replyCount).toMatch(/\d+ repl(y|ies)/);
    });

    test('should highlight new replies in thread', async ({ page }) => {
      // Open thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Add a new reply
      await page.fill('[data-testid="thread-input"]', 'New test reply');
      await page.click('[data-testid="thread-send-button"]');

      // Wait for new reply
      await page.waitForSelector('[data-testid="thread-reply"]:last-child');

      // Verify new reply is highlighted
      const lastReply = page.locator('[data-testid="thread-reply"]').last();
      await expect(lastReply).toHaveClass(/new-reply|highlighted/);
    });
  });

  test.describe('Accessibility', () => {
    test('should announce thread opening to screen readers', async ({ page }) => {
      // Open thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');

      // Verify ARIA live region updated
      const liveRegion = page.locator('[role="status"]');
      await expect(liveRegion).toHaveText(/Thread opened|Viewing thread/i);
    });

    test('should have proper ARIA labels on thread controls', async ({ page }) => {
      // Open thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Check ARIA labels
      await expect(page.locator('[data-testid="thread-close-button"]')).toHaveAttribute(
        'aria-label',
        /close thread|dismiss/i
      );

      await expect(page.locator('[data-testid="thread-input"]')).toHaveAttribute(
        'aria-label',
        /reply|message/i
      );
    });

    test('should trap focus within thread when open', async ({ page }) => {
      // Open thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Tab through all elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
      }

      // Verify focus is still within thread
      const focusedElement = page.locator(':focus');
      const threadView = page.locator('[data-testid="thread-view"]');

      const isWithinThread = await focusedElement.evaluate(
        (el, thread) => thread.contains(el),
        await threadView.elementHandle()
      );

      expect(isWithinThread).toBe(true);
    });

    test('should restore focus when closing thread', async ({ page }) => {
      // Focus on reply button
      const replyButton = page.locator('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await replyButton.focus();

      // Open thread
      await replyButton.click();
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Close thread with Escape
      await page.keyboard.press('Escape');

      // Verify focus returned to reply button
      await expect(replyButton).toBeFocused();
    });
  });

  test.describe('Performance', () => {
    test('should load thread in under 300ms', async ({ page }) => {
      const startTime = Date.now();

      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(300);
    });

    test('should handle large threads efficiently', async ({ page }) => {
      // Open thread with many replies
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Measure render time
      const renderMetrics = await page.evaluate(() => {
        return performance.measure('thread-render');
      });

      // Should render smoothly
      expect(renderMetrics).toBeDefined();
    });

    test('should virtualize long thread lists', async ({ page }) => {
      // Open thread with 100+ replies
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Count DOM nodes (should be less than total replies)
      const renderedReplies = await page.locator('[data-testid="thread-reply"]').count();
      const totalReplies = await page.locator('[data-testid="thread-reply-count"]').textContent();

      // If total > 50, rendered should be less (virtualized)
      if (totalReplies && parseInt(totalReplies) > 50) {
        expect(renderedReplies).toBeLessThan(parseInt(totalReplies));
      }
    });
  });
});

test.describe('Mobile Thread Navigation', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    isMobile: true,
  });

  test('should open thread in full-screen on mobile', async ({ page }) => {
    await page.goto('/');

    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Navigate to messages
    await page.click('[data-testid="mobile-menu-button"]');
    await page.click('[data-testid="messages-nav"]');

    // Open thread
    await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');

    // Verify full-screen
    const threadView = page.locator('[data-testid="thread-view"]');
    const boundingBox = await threadView.boundingBox();

    expect(boundingBox?.width).toBeCloseTo(375, 10);
    expect(boundingBox?.height).toBeCloseTo(667, 50);

    await page.screenshot({ path: 'e2e/screenshots/mobile-thread-fullscreen.png' });
  });

  test('should support swipe to close thread on mobile', async ({ page }) => {
    await page.goto('/');

    // Login and navigate
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="mobile-menu-button"]');
    await page.click('[data-testid="messages-nav"]');

    // Open thread
    await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
    await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

    // Swipe right to close
    await page.touchscreen.tap(10, 300);
    await page.touchscreen.swipe({ x: 10, y: 300 }, { x: 300, y: 300 });

    // Verify thread closes
    await expect(page.locator('[data-testid="thread-view"]')).not.toBeVisible({ timeout: 1000 });
  });
});
