// ============================================
// AI FEATURES E2E TESTS
// End-to-end tests for AI functionality
// ============================================

import { test, expect } from '@playwright/test';

test.describe('AI Smart Compose', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Navigate to messages
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');
  });

  test('should show AI suggestions after typing', async ({ page }) => {
    // Type message
    const input = page.locator('[data-testid="message-input"]');
    await input.fill('Can we schedule a meeting');

    // Wait for AI suggestions to appear
    await expect(page.locator('[data-testid="ai-suggestions"]')).toBeVisible({ timeout: 2000 });

    // Verify suggestions are present
    const suggestionCount = await page.locator('[data-testid="ai-suggestion-item"]').count();
    expect(suggestionCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/ai-suggestions.png' });
  });

  test('should accept AI suggestion', async ({ page }) => {
    const input = page.locator('[data-testid="message-input"]');
    await input.fill('Can we schedule');

    // Wait for suggestions
    await page.waitForSelector('[data-testid="ai-suggestion-item"]', { timeout: 2000 });

    // Click first suggestion
    await page.click('[data-testid="ai-suggestion-item"]:first-child');

    // Verify suggestion is applied to input
    const inputValue = await input.inputValue();
    expect(inputValue.length).toBeGreaterThan('Can we schedule'.length);

    // Verify suggestions disappear
    await expect(page.locator('[data-testid="ai-suggestions"]')).not.toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/ai-suggestion-accepted.png' });
  });

  test('should dismiss suggestions on Escape', async ({ page }) => {
    const input = page.locator('[data-testid="message-input"]');
    await input.fill('Can we schedule');

    // Wait for suggestions
    await page.waitForSelector('[data-testid="ai-suggestions"]', { timeout: 2000 });

    // Press Escape
    await input.press('Escape');

    // Verify suggestions disappear
    await expect(page.locator('[data-testid="ai-suggestions"]')).not.toBeVisible();
  });

  test('should show confidence scores for suggestions', async ({ page }) => {
    const input = page.locator('[data-testid="message-input"]');
    await input.fill('Thank you for');

    await page.waitForSelector('[data-testid="ai-suggestion-item"]', { timeout: 2000 });

    // Verify confidence indicators are visible
    await expect(page.locator('[data-testid="confidence-indicator"]').first()).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/ai-confidence-scores.png' });
  });

  test('should switch AI models', async ({ page }) => {
    // Open AI settings
    await page.click('[data-testid="ai-settings-button"]');

    // Select different model
    await page.click('[data-testid="model-selector"]');
    await page.click('[data-testid="model-option-gpt4"]');

    // Verify model changed
    await expect(page.locator('[data-testid="current-model"]')).toHaveText(/GPT-4/i);

    await page.screenshot({ path: 'e2e/screenshots/ai-model-selector.png' });
  });
});

test.describe('AI Tone Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');
  });

  test('should analyze positive tone', async ({ page }) => {
    const input = page.locator('[data-testid="message-input"]');
    await input.fill('I am so excited about this amazing opportunity!');

    // Wait for tone analysis
    await page.waitForSelector('[data-testid="tone-indicator"]', { timeout: 2000 });

    // Verify positive tone is detected
    await expect(page.locator('[data-testid="tone-indicator"]')).toHaveAttribute('data-tone', 'positive');

    await page.screenshot({ path: 'e2e/screenshots/tone-positive.png' });
  });

  test('should analyze negative tone', async ({ page }) => {
    const input = page.locator('[data-testid="message-input"]');
    await input.fill('This is really frustrating and disappointing.');

    await page.waitForSelector('[data-testid="tone-indicator"]', { timeout: 2000 });

    // Verify negative tone is detected
    await expect(page.locator('[data-testid="tone-indicator"]')).toHaveAttribute('data-tone', 'negative');

    // Verify suggestions to improve tone
    await expect(page.locator('[data-testid="tone-suggestions"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/tone-negative.png' });
  });

  test('should update tone in real-time', async ({ page }) => {
    const input = page.locator('[data-testid="message-input"]');

    // Start with negative
    await input.fill('This is terrible');
    await page.waitForSelector('[data-testid="tone-indicator"]', { timeout: 2000 });
    let tone = await page.locator('[data-testid="tone-indicator"]').getAttribute('data-tone');
    expect(tone).toBe('negative');

    // Change to positive
    await input.fill('This is wonderful and amazing');
    await page.waitForTimeout(1000);
    tone = await page.locator('[data-testid="tone-indicator"]').getAttribute('data-tone');
    expect(tone).toBe('positive');
  });
});

test.describe('AI Brainstorming', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Navigate to brainstorm feature
    await page.click('[data-testid="tools-nav"]');
    await page.click('[data-testid="brainstorm-tool"]');
  });

  test('should create brainstorm session', async ({ page }) => {
    // Enter topic
    await page.fill('[data-testid="topic-input"]', 'Product Features');

    // Start session
    await page.click('[data-testid="start-brainstorm-button"]');

    // Verify session created
    await expect(page.locator('[data-testid="brainstorm-canvas"]')).toBeVisible();
    await expect(page.locator('text=Product Features')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/brainstorm-session.png' });
  });

  test('should add ideas to brainstorm', async ({ page }) => {
    await page.fill('[data-testid="topic-input"]', 'Product Features');
    await page.click('[data-testid="start-brainstorm-button"]');

    // Add first idea
    await page.fill('[data-testid="idea-input"]', 'Real-time collaboration');
    await page.click('[data-testid="add-idea-button"]');

    // Add second idea
    await page.fill('[data-testid="idea-input"]', 'AI-powered search');
    await page.click('[data-testid="add-idea-button"]');

    // Verify ideas appear
    await expect(page.locator('text=Real-time collaboration')).toBeVisible();
    await expect(page.locator('text=AI-powered search')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/brainstorm-ideas.png' });
  });

  test('should auto-cluster ideas', async ({ page }) => {
    await page.fill('[data-testid="topic-input"]', 'Product Features');
    await page.click('[data-testid="start-brainstorm-button"]');

    // Add multiple ideas
    const ideas = [
      'Real-time collaboration',
      'WebSocket support',
      'Better UI design',
      'Responsive layout',
    ];

    for (const idea of ideas) {
      await page.fill('[data-testid="idea-input"]', idea);
      await page.click('[data-testid="add-idea-button"]');
    }

    // Click auto-cluster
    await page.click('[data-testid="auto-cluster-button"]');

    // Wait for clustering
    await page.waitForSelector('[data-testid="cluster-group"]', { timeout: 5000 });

    // Verify clusters created
    const clusterCount = await page.locator('[data-testid="cluster-group"]').count();
    expect(clusterCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/brainstorm-clusters.png' });
  });

  test('should expand idea with AI', async ({ page }) => {
    await page.fill('[data-testid="topic-input"]', 'Product Features');
    await page.click('[data-testid="start-brainstorm-button"]');

    // Add idea
    await page.fill('[data-testid="idea-input"]', 'Real-time notifications');
    await page.click('[data-testid="add-idea-button"]');

    // Click on idea to select
    await page.click('text=Real-time notifications');

    // Click expand button
    await page.click('[data-testid="expand-idea-button"]');

    // Wait for expansion
    await page.waitForSelector('[data-testid="idea-expansion"]', { timeout: 5000 });

    // Verify expansion content
    await expect(page.locator('[data-testid="expansion-description"]')).toBeVisible();
    await expect(page.locator('[data-testid="expansion-benefits"]')).toBeVisible();
    await expect(page.locator('[data-testid="expansion-challenges"]')).toBeVisible();
    await expect(page.locator('[data-testid="expansion-next-steps"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/brainstorm-expansion.png' });
  });

  test('should generate idea variations', async ({ page }) => {
    await page.fill('[data-testid="topic-input"]', 'Product Features');
    await page.click('[data-testid="start-brainstorm-button"]');

    await page.fill('[data-testid="idea-input"]', 'Collaborative editing');
    await page.click('[data-testid="add-idea-button"]');

    // Select idea
    await page.click('text=Collaborative editing');

    // Generate variations
    await page.click('[data-testid="generate-variations-button"]');

    // Wait for variations
    await page.waitForSelector('[data-testid="variation-item"]', { timeout: 5000 });

    // Verify 5 variations
    const variationCount = await page.locator('[data-testid="variation-item"]').count();
    expect(variationCount).toBe(5);

    await page.screenshot({ path: 'e2e/screenshots/brainstorm-variations.png' });
  });

  test('should export brainstorm session', async ({ page }) => {
    await page.fill('[data-testid="topic-input"]', 'Product Features');
    await page.click('[data-testid="start-brainstorm-button"]');

    await page.fill('[data-testid="idea-input"]', 'Test idea');
    await page.click('[data-testid="add-idea-button"]');

    // Click export
    await page.click('[data-testid="export-button"]');

    // Select format
    await page.click('[data-testid="export-mindmap"]');

    // Wait for download
    const download = await page.waitForEvent('download');
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.xml|\.mmd$/);
  });
});

test.describe('Conversation Intelligence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="messages-nav"]');
    await page.click('[data-testid="channel-item"]:first-child');
  });

  test('should open insights panel', async ({ page }) => {
    await page.click('[data-testid="insights-button"]');

    await expect(page.locator('[data-testid="insights-panel"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/insights-panel.png' });
  });

  test('should show conversation sentiment', async ({ page }) => {
    await page.click('[data-testid="insights-button"]');

    await expect(page.locator('[data-testid="sentiment-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="sentiment-score"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/conversation-sentiment.png' });
  });

  test('should display conversation topics', async ({ page }) => {
    await page.click('[data-testid="insights-button"]');

    await expect(page.locator('[data-testid="topics-list"]')).toBeVisible();

    const topicCount = await page.locator('[data-testid="topic-item"]').count();
    expect(topicCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/conversation-topics.png' });
  });

  test('should suggest follow-up actions', async ({ page }) => {
    await page.click('[data-testid="insights-button"]');

    await expect(page.locator('[data-testid="follow-up-suggestions"]')).toBeVisible();

    const suggestionCount = await page.locator('[data-testid="follow-up-item"]').count();
    expect(suggestionCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/follow-up-suggestions.png' });
  });
});
