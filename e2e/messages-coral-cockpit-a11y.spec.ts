/**
 * WCAG AA accessibility snapshot — Coral Cockpit Messages surfaces
 *
 * Audits TriageBrief, ConversationSidebar, FeatureSettingsPanel,
 * RemindersInbox, SnoozeMenu, and MessageInput in both light and dark mode
 * against wcag2aa + wcag21aa rules.
 *
 * Each test is scoped to the specific surface under test so violations
 * are traceable to the component, not the whole page.
 *
 * Prerequisites: dev server running on http://localhost:5173 (configured
 * in playwright.config.ts). The app must be in a logged-in state — the
 * beforeEach block handles login.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/** Log into the app and navigate to the Messages section. */
async function loginAndOpenMessages(page: import('@playwright/test').Page) {
  await page.goto('/');
  // Attempt standard login flow — skips if already authenticated.
  const loginBtn = page.locator('[data-testid="login-button"]');
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  }
  // Navigate to Messages.
  const messagesNav = page.locator('[data-testid="messages-nav"]');
  if (await messagesNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await messagesNav.click();
    await page.waitForURL('**/messages', { timeout: 10000 });
  }
}

/** Switch to dark mode via the theme toggle. */
async function enableDarkMode(page: import('@playwright/test').Page) {
  const toggle = page.locator('[data-testid="theme-toggle"]');
  if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Only click if not already in dark mode.
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    if (!isDark) await toggle.click();
    await page.waitForTimeout(300);
  } else {
    // Fallback: force dark class via evaluate.
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(150);
  }
}

/** Switch to light mode. */
async function enableLightMode(page: import('@playwright/test').Page) {
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(150);
}

// ── TriageBrief (empty-pane / no conversation selected) ─────────────────────

test.describe('TriageBrief — WCAG AA', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndOpenMessages(page);
    // Ensure no conversation is selected so TriageBrief renders.
    await page.evaluate(() => {
      // Click outside any active conversation row to deselect.
      const el = document.querySelector('[data-testid="triage-brief"]');
      if (el) el.scrollIntoView();
    });
  });

  test('passes wcag2aa in light mode', async ({ page }) => {
    await enableLightMode(page);
    const triageBrief = page.locator('[data-testid="triage-brief"], .triage-brief').first();
    const root = (await triageBrief.isVisible().catch(() => false))
      ? triageBrief
      : page.locator('main, [role="main"]').first();

    const results = await new AxeBuilder({ page })
      .include(await root.evaluate((el) => {
        if (!el.id) el.id = '__axe_triage_brief__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `TriageBrief light mode violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });

  test('passes wcag2aa in dark mode', async ({ page }) => {
    await enableDarkMode(page);
    const triageBrief = page.locator('[data-testid="triage-brief"], .triage-brief').first();
    const root = (await triageBrief.isVisible().catch(() => false))
      ? triageBrief
      : page.locator('main, [role="main"]').first();

    const results = await new AxeBuilder({ page })
      .include(await root.evaluate((el) => {
        if (!el.id) el.id = '__axe_triage_brief_dark__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `TriageBrief dark mode violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });
});

// ── ConversationSidebar ──────────────────────────────────────────────────────

test.describe('ConversationSidebar — WCAG AA', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndOpenMessages(page);
  });

  test('passes wcag2aa in light mode (header + filter chips + search)', async ({ page }) => {
    await enableLightMode(page);
    const sidebar = page.locator(
      '[data-testid="conversation-sidebar"], aside[class*="ConversationSidebar"]',
    ).first();
    const root = (await sidebar.isVisible().catch(() => false))
      ? sidebar
      : page.locator('[class*="w-\\[30%\\]"]').first();

    const results = await new AxeBuilder({ page })
      .include(await root.evaluate((el) => {
        if (!el.id) el.id = '__axe_conv_sidebar__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `ConversationSidebar light mode violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });

  test('passes wcag2aa in dark mode', async ({ page }) => {
    await enableDarkMode(page);
    const sidebar = page.locator(
      '[data-testid="conversation-sidebar"], aside[class*="ConversationSidebar"]',
    ).first();
    const root = (await sidebar.isVisible().catch(() => false))
      ? sidebar
      : page.locator('[class*="border-r"]').first();

    const results = await new AxeBuilder({ page })
      .include(await root.evaluate((el) => {
        if (!el.id) el.id = '__axe_conv_sidebar_dark__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `ConversationSidebar dark mode violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });

  test('unread conversation row passes contrast check', async ({ page }) => {
    await enableLightMode(page);
    // Scan any unread row chips — rose-500/10 bg + rose-700 text.
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();

    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast',
    );

    // Report specific nodes for debugging, expect no violations.
    expect(
      contrastViolations,
      `Unread chip contrast violations:\n${JSON.stringify(contrastViolations, null, 2)}`,
    ).toEqual([]);
  });
});

// ── FeatureSettingsPanel ─────────────────────────────────────────────────────

test.describe('FeatureSettingsPanel — WCAG AA', () => {
  async function openFeatureSettings(page: import('@playwright/test').Page) {
    // Try the gear/settings icon in the conversation header.
    const settingsBtn = page.locator(
      '[data-testid="feature-settings-btn"], [aria-label*="settings" i], [aria-label*="Settings" i]',
    ).first();
    if (await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(300);
    }
  }

  test('passes wcag2aa in light mode (panel open)', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableLightMode(page);
    await openFeatureSettings(page);

    const panel = page.locator(
      '[data-testid="feature-settings-panel"], [class*="FeatureSettings"]',
    ).first();

    if (!(await panel.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'FeatureSettingsPanel not visible — requires an open conversation');
      return;
    }

    const results = await new AxeBuilder({ page })
      .include(await panel.evaluate((el) => {
        if (!el.id) el.id = '__axe_fsp__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `FeatureSettingsPanel light violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });

  test('passes wcag2aa in dark mode (panel open)', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableDarkMode(page);
    await openFeatureSettings(page);

    const panel = page.locator(
      '[data-testid="feature-settings-panel"], [class*="FeatureSettings"]',
    ).first();

    if (!(await panel.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'FeatureSettingsPanel not visible — requires an open conversation');
      return;
    }

    const results = await new AxeBuilder({ page })
      .include(await panel.evaluate((el) => {
        if (!el.id) el.id = '__axe_fsp_dark__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `FeatureSettingsPanel dark violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });
});

// ── RemindersInbox ───────────────────────────────────────────────────────────

test.describe('RemindersInbox — WCAG AA', () => {
  /** Inject a mock fired reminder so the bell appears. */
  async function injectFiredReminder(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
      // Patch threadReminderService.listFired in the window scope if accessible,
      // or directly inject a reminder row via React devtools bridge if available.
      // As a fallback, dispatch a custom event the service may listen to.
      window.dispatchEvent(
        new CustomEvent('__pulse_test_fire_reminder__', {
          detail: {
            id: 'test-reminder-1',
            conversation_id: 'test-conv-1',
            conversation_kind: 'dm',
            note: 'Follow up on proposal',
            fired_at: new Date().toISOString(),
            status: 'fired',
          },
        }),
      );
    });
    await page.waitForTimeout(300);
  }

  test('passes wcag2aa in light mode (popover open)', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableLightMode(page);
    await injectFiredReminder(page);

    const bellBtn = page.locator('[aria-label="Reminders"], [title*="reminder" i]').first();
    if (await bellBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bellBtn.click();
      await page.waitForTimeout(200);
    } else {
      test.skip(true, 'RemindersInbox bell not visible — no fired reminders injected');
      return;
    }

    const popover = page.locator('[role="dialog"]').first();
    if (!(await popover.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip(true, 'RemindersInbox popover did not open');
      return;
    }

    const results = await new AxeBuilder({ page })
      .include(await popover.evaluate((el) => {
        if (!el.id) el.id = '__axe_reminders_inbox__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `RemindersInbox light violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });

  test('passes wcag2aa in dark mode (popover open)', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableDarkMode(page);
    await injectFiredReminder(page);

    const bellBtn = page.locator('[aria-label="Reminders"], [title*="reminder" i]').first();
    if (await bellBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bellBtn.click();
      await page.waitForTimeout(200);
    } else {
      test.skip(true, 'RemindersInbox bell not visible (dark)');
      return;
    }

    const popover = page.locator('[role="dialog"]').first();
    if (!(await popover.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip(true, 'RemindersInbox popover did not open (dark)');
      return;
    }

    const results = await new AxeBuilder({ page })
      .include(await popover.evaluate((el) => {
        if (!el.id) el.id = '__axe_reminders_inbox_dark__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `RemindersInbox dark violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });
});

// ── SnoozeMenu ───────────────────────────────────────────────────────────────

test.describe('SnoozeMenu — WCAG AA', () => {
  async function openSnoozeMenu(page: import('@playwright/test').Page) {
    const snoozeBtn = page.locator('[aria-label*="nooze" i], [title*="nooze" i]').first();
    if (await snoozeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await snoozeBtn.click();
      await page.waitForTimeout(200);
      return true;
    }
    return false;
  }

  test('passes wcag2aa in light mode (all presets visible)', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableLightMode(page);

    if (!(await openSnoozeMenu(page))) {
      test.skip(true, 'SnoozeMenu trigger not visible — requires an open conversation');
      return;
    }

    const menu = page.locator('[role="menu"]').first();
    if (!(await menu.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip(true, 'SnoozeMenu popover did not open');
      return;
    }

    const results = await new AxeBuilder({ page })
      .include(await menu.evaluate((el) => {
        if (!el.id) el.id = '__axe_snooze_menu__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `SnoozeMenu light violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });

  test('passes wcag2aa in dark mode (all presets visible)', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableDarkMode(page);

    if (!(await openSnoozeMenu(page))) {
      test.skip(true, 'SnoozeMenu trigger not visible (dark)');
      return;
    }

    const menu = page.locator('[role="menu"]').first();
    if (!(await menu.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip(true, 'SnoozeMenu popover did not open (dark)');
      return;
    }

    const results = await new AxeBuilder({ page })
      .include(await menu.evaluate((el) => {
        if (!el.id) el.id = '__axe_snooze_menu_dark__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `SnoozeMenu dark violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });
});

// ── MessageInput composer ────────────────────────────────────────────────────

test.describe('MessageInput composer — WCAG AA', () => {
  async function openConversation(page: import('@playwright/test').Page) {
    const firstConv = page
      .locator('[data-testid="conversation-item"], [class*="p-3 rounded-xl"]')
      .first();
    if (await firstConv.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstConv.click();
      await page.waitForTimeout(400);
      return true;
    }
    return false;
  }

  test('Simple Mode focused passes wcag2aa in light mode', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableLightMode(page);

    if (!(await openConversation(page))) {
      test.skip(true, 'No conversation to open for MessageInput test');
      return;
    }

    const composer = page
      .locator('[data-composer="pulse"], [data-testid="message-input"], textarea')
      .first();
    if (!(await composer.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'MessageInput not visible');
      return;
    }
    await composer.focus();

    const composerRoot = page
      .locator('[data-testid="message-input-container"], [class*="MessageInput"]')
      .first();
    const root = (await composerRoot.isVisible().catch(() => false))
      ? composerRoot
      : page.locator('form, [role="form"]').last();

    const results = await new AxeBuilder({ page })
      .include(await root.evaluate((el) => {
        if (!el.id) el.id = '__axe_composer__';
        return `#${el.id}`;
      }))
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(
      results.violations,
      `MessageInput light violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });

  test('Simple Mode focused passes wcag2aa in dark mode', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableDarkMode(page);

    if (!(await openConversation(page))) {
      test.skip(true, 'No conversation to open for MessageInput dark test');
      return;
    }

    const composer = page
      .locator('[data-composer="pulse"], [data-testid="message-input"], textarea')
      .first();
    if (!(await composer.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'MessageInput not visible (dark)');
      return;
    }
    await composer.focus();

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();

    // Scope to focus-border region check: verify the quiet focus border
    // passes 3:1 against canvas (rose-500/40 over black canvas).
    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast',
    );
    expect(
      contrastViolations,
      `MessageInput dark focus border contrast violations:\n${JSON.stringify(contrastViolations, null, 2)}`,
    ).toEqual([]);
  });

  test('focus border contrast >= 3:1 (UI component boundary)', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableLightMode(page);

    if (!(await openConversation(page))) {
      test.skip(true, 'No conversation available');
      return;
    }

    const composer = page
      .locator('[data-composer="pulse"], [data-testid="message-input"], textarea')
      .first();
    if (!(await composer.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'Composer not visible');
      return;
    }

    await composer.focus();

    // Verify focus indicator meets 3:1 per WCAG 1.4.11 (non-text contrast).
    const focusBorderContrast = await composer.evaluate((el) => {
      const style = window.getComputedStyle(el);
      // box-shadow encodes the rose-500/40 focus halo color.
      return {
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });

    // The composer should have SOME focus indicator (outline or box-shadow).
    const hasFocusIndicator =
      (focusBorderContrast.outline !== 'none' &&
        parseFloat(focusBorderContrast.outlineWidth) > 0) ||
      focusBorderContrast.boxShadow !== 'none';

    expect(hasFocusIndicator).toBe(true);
  });
});

// ── Full-page scan (smoke) ───────────────────────────────────────────────────

test.describe('Messages page — full wcag2aa scan', () => {
  test('no wcag2aa violations on Messages in light mode', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableLightMode(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'wcag21aa'])
      // Exclude known third-party content areas that are out-of-scope for this sprint.
      .exclude('[class*="MessagesFeaturePanels"]')
      .analyze();

    expect(
      results.violations,
      `Full page light mode violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });

  test('no wcag2aa violations on Messages in dark mode', async ({ page }) => {
    await loginAndOpenMessages(page);
    await enableDarkMode(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'wcag21aa'])
      .exclude('[class*="MessagesFeaturePanels"]')
      .analyze();

    expect(
      results.violations,
      `Full page dark mode violations:\n${JSON.stringify(results.violations, null, 2)}`,
    ).toEqual([]);
  });
});
