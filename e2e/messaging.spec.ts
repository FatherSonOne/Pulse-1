// ============================================
// MESSAGING E2E TESTS
// End-to-end tests for message functionality
// ============================================

import { test, expect } from '@playwright/test';

test.describe('Messaging Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and login
    await page.goto('/');

    // Login flow (update selectors based on actual implementation)
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('should navigate to messages and load channel', async ({ page }) => {
    // Click messages navigation
    await page.click('[data-testid="messages-nav"]');

    // Wait for messages view
    await page.waitForURL('**/messages');

    // Click on first channel
    await page.click('[data-testid="channel-item"]:first-child');

    // Verify message list loads
    await expect(page.locator('[data-testid="message-list"]')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/messages-channel-loaded.png' });
  });

  test('should send a simple message', async ({ page }) => {
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');

    // Type message
    const input = page.locator('[data-testid="message-input"]');
    await input.fill('Hello from E2E test');

    // Send message
    await page.click('[data-testid="send-button"]');

    // Verify message appears in chat
    await expect(page.locator('text=Hello from E2E test')).toBeVisible({ timeout: 5000 });

    // Verify input is cleared
    await expect(input).toHaveValue('');

    await page.screenshot({ path: 'e2e/screenshots/message-sent.png' });
  });

  test('should send message with Enter key', async ({ page }) => {
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');

    const input = page.locator('[data-testid="message-input"]');
    await input.fill('Message sent with Enter');
    await input.press('Enter');

    // Verify message appears
    await expect(page.locator('text=Message sent with Enter')).toBeVisible({ timeout: 5000 });
  });

  test('should not send empty messages', async ({ page }) => {
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');

    // Count messages before
    const messagesBefore = await page.locator('[data-testid="message-item"]').count();

    // Try to send empty message
    await page.click('[data-testid="send-button"]');

    // Wait a bit
    await page.waitForTimeout(1000);

    // Count messages after
    const messagesAfter = await page.locator('[data-testid="message-item"]').count();

    // Verify no new message
    expect(messagesAfter).toBe(messagesBefore);
  });

  test('should send message with attachment', async ({ page }) => {
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');

    // Click attach button
    await page.click('[data-testid="attach-button"]');

    // Upload file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test file content'),
    });

    // Verify preview appears
    await expect(page.locator('[data-testid="attachment-preview"]')).toBeVisible();

    // Add message text
    await page.fill('[data-testid="message-input"]', 'Check out this file');

    // Send
    await page.click('[data-testid="send-button"]');

    // Verify message with attachment appears
    await expect(page.locator('text=Check out this file')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=test.txt')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/message-with-attachment.png' });
  });

  test('should reply to message in thread', async ({ page }) => {
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');

    // Click reply button on first message
    await page.hover('[data-testid="message-item"]:first-child');
    await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');

    // Verify thread view opens
    await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

    // Type reply
    await page.fill('[data-testid="thread-input"]', 'This is a reply');
    await page.click('[data-testid="thread-send-button"]');

    // Verify reply appears
    await expect(page.locator('[data-testid="thread-view"] text=This is a reply')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/thread-reply.png' });
  });

  test('should add reaction to message', async ({ page }) => {
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');

    // Hover over message and click reaction button
    await page.hover('[data-testid="message-item"]:first-child');
    await page.click('[data-testid="message-item"]:first-child [data-testid="reaction-button"]');

    // Select emoji
    await page.click('[data-testid="emoji-picker"] [data-emoji="👍"]');

    // Verify reaction appears
    await expect(page.locator('[data-testid="message-item"]:first-child [data-testid="reaction-👍"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/message-reaction.png' });
  });

  test('should search messages', async ({ page }) => {
    await page.click('[data-testid="messages-nav"]');

    // Open search
    await page.click('[data-testid="search-button"]');

    // Type search query
    await page.fill('[data-testid="search-input"]', 'meeting');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]');

    // Verify results appear
    const resultCount = await page.locator('[data-testid="search-result-item"]').count();
    expect(resultCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/message-search.png' });
  });

  test('should load more messages on scroll', async ({ page }) => {
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');

    // Get initial message count
    const initialCount = await page.locator('[data-testid="message-item"]').count();

    // Scroll to top
    await page.locator('[data-testid="message-list"]').evaluate((el) => {
      el.scrollTop = 0;
    });

    // Wait for more messages to load
    await page.waitForTimeout(2000);

    // Get new message count
    const newCount = await page.locator('[data-testid="message-item"]').count();

    // Verify more messages loaded
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('should show typing indicator', async ({ page, context }) => {
    // Open two pages to simulate two users
    const page2 = await context.newPage();

    // Both navigate to same channel
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');

    await page2.goto('/');
    await page2.click('[data-testid="messages-nav"]');
    await page2.click('[data-testid="channel-item"]:first-child');

    // User 2 starts typing
    await page2.type('[data-testid="message-input"]', 'Test', { delay: 100 });

    // User 1 should see typing indicator
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/typing-indicator.png' });

    await page2.close();
  });
});

test.describe('Mobile Messaging', () => {
  test.use({
    viewport: { width: 375, height: 667 }
  });

  test('should navigate and send message on mobile', async ({ page }) => {
    await page.goto('/');

    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');

    // Navigate to messages
    await page.click('[data-testid="messages-nav"]');

    // Select channel
    await page.click('[data-testid="channel-item"]:first-child');

    // Send message
    await page.fill('[data-testid="message-input"]', 'Mobile test message');
    await page.click('[data-testid="send-button"]');

    // Verify
    await expect(page.locator('text=Mobile test message')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/mobile-message.png' });
  });
});
