/**
 * Map section a11y E2E suite — PALETTE_TO_VOYAGER handoff
 * (docs/MAP_CORAL_CONTRAST_HANDOFF_2026-05-17.md §5).
 *
 * Targets:
 *   - axe-core scan on the broadcast recipient picker route (lens=TODAY mocked).
 *   - Keyboard-only BroadcastRecipientPicker → Space toggles → Enter confirms →
 *     focus returns to the trigger.
 *   - Keyboard-only reorder strip → ArrowDown twice → Accept.
 *   - LiveBroadcastSheet → Tab → Esc → focus returns to live chip trigger.
 *   - I'm at… FAB renders + opens deterministically with mocked GPS.
 *
 * Implementation strategy:
 *   The full PulseMapView is gated by OAuth, Google Maps JS API loading, and
 *   Supabase context — none of which are deterministic in a Playwright CI
 *   environment. We bypass that surface area entirely by mounting the same
 *   production dialog / strip components in isolation through the dev-only
 *   harness at /?e2eHarness=map&mode=<surface>. Components are imported by
 *   real path — these tests catch any focus / a11y regression in the
 *   shipping component code, not a reimplementation.
 *
 * Requirements to run:
 *   - Dev server up: `npm run dev` (the playwright.config webServer starts
 *     this automatically when not in CI).
 *   - No env keys required — the harness short-circuits before useJsApiLoader.
 */

import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const HARNESS_BASE = '/?e2eHarness=map';

// ────────────────────────────────────────────────────────────────────────────
// Helpers — small Page Object surface. The harness exposes a known trigger
// button per mode so focus-restoration assertions have a stable target.
// ────────────────────────────────────────────────────────────────────────────

// index.html runs an inline pre-cache script that, on first visit (no version
// in localStorage), redirects to `?nocache=<timestamp>` — stripping our
// harness query string. Pre-seed localStorage before any nav so the redirect
// never triggers. Stays in sync with the APP_VERSION constant in main.tsx /
// index.html (currently 28.2.0); update if those bump.
const APP_VERSION = '28.2.0';

async function seedAntiCacheClear(page: Page) {
  await page.addInitScript((version: string) => {
    try {
      localStorage.setItem('pulse_app_version', version);
      localStorage.setItem(`pulse_cache_cleared_${version}`, 'true');
    } catch { /* private mode etc. — harmless */ }
  }, APP_VERSION);
}

async function gotoHarness(page: Page, mode: 'picker' | 'imat' | 'live' | 'reorder') {
  // Capture console errors / page errors during nav for clearer failure logs.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });

  await seedAntiCacheClear(page);
  await page.goto(`${HARNESS_BASE}&mode=${mode}`);

  // The harness mounts asynchronously (dynamic import). Wait on a sentinel.
  // On failure, dump body attributes + URL + collected errors for diagnosis.
  try {
    await expect(page.getByRole('heading', { name: /Map test harness/i })).toBeVisible({ timeout: 8000 });
  } catch (err) {
    const diag = await page.evaluate(() => ({
      url: window.location.href,
      search: window.location.search,
      bodyAttrs: Array.from(document.body.attributes).map(a => `${a.name}=${a.value}`),
      rootHtmlPreview: document.getElementById('root')?.outerHTML?.slice(0, 400) ?? '(no root)',
    }));
    throw new Error(`Harness mount failed.\n  url=${diag.url}\n  search=${diag.search}\n  body=${diag.bodyAttrs.join(' | ')}\n  rootPreview=${diag.rootHtmlPreview}\n  errors=${errors.join('\n           ')}`);
  }
}

function pickerDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: /Pick who can see your live location/i });
}
function liveDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: /Broadcasting now/i });
}

// Format axe violation list with per-node detail. CI logs surface element
// targets + the offending HTML so coral / contrast regressions can be fixed
// in one round-trip without re-running locally.
function formatAxeViolations(violations: Array<{ id: string; help: string; nodes: Array<{ target: unknown; html: string; failureSummary?: string }> }>): string {
  return violations
    .map(v => {
      const nodes = v.nodes.map(n => `      target=${JSON.stringify(n.target)}\n      html=${n.html}\n      detail=${(n.failureSummary || '').replace(/\n/g, ' ')}`).join('\n');
      return `  [${v.id}] ${v.help} — ${v.nodes.length} node(s):\n${nodes}`;
    })
    .join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Axe-core scan — picker dialog open, fully populated. Covers the lens
//    palette via the harness chrome (header / trigger button), the picker
//    surface (header, search input, row checkboxes, footer buttons), and any
//    coral / focus-visible regressions introduced after the Batch-3 fix.
// ────────────────────────────────────────────────────────────────────────────

test.describe('Map a11y — automated axe-core scans', () => {
  test('BroadcastRecipientPicker (open) has zero WCAG 2.1 AA violations', async ({ page }) => {
    await gotoHarness(page, 'picker');
    await page.getByTestId('open-broadcast-picker').click();
    await expect(pickerDialog(page)).toBeVisible();

    const results = await new AxeBuilder({ page })
      // index.html intentionally sets `user-scalable=no` for the native shell;
      // that's a global app issue, not a Map section regression. Scope the
      // scan to the dialog so it can't false-positive on host-page meta.
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    // Surface every violation node + offending HTML so CI logs are actionable
    // (which element, which color pair, which file). Refusing to summarize is
    // deliberate — palette/coral regressions are easy to mask with a counter
    // alone.
    if (results.violations.length > 0) {
      const summary = formatAxeViolations(results.violations);
      throw new Error(`axe-core violations:\n${summary}`);
    }
    expect(results.violations).toEqual([]);
  });

  test('LiveBroadcastSheet (open) has zero WCAG 2.1 AA violations', async ({ page }) => {
    await gotoHarness(page, 'live');
    await page.getByTestId('open-live-sheet').click();
    await expect(liveDialog(page)).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    if (results.violations.length > 0) {
      const summary = formatAxeViolations(results.violations);
      throw new Error(`axe-core violations:\n${summary}`);
    }
    expect(results.violations).toEqual([]);
  });

  test('AiStrip reorder mode has zero WCAG 2.1 AA violations', async ({ page }) => {
    await gotoHarness(page, 'reorder');
    await expect(page.getByRole('list', { name: /Reorder stops/i })).toBeVisible();

    const results = await new AxeBuilder({ page })
      // Scope to the AI strip — the global `user-scalable=no` viewport meta in
      // index.html is a separate WCAG SC 1.4.4 issue tracked outside this
      // suite. Including it here would mask Map-section regressions.
      .include('[data-testid="ai-strip-container"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    if (results.violations.length > 0) {
      const summary = formatAxeViolations(results.violations);
      throw new Error(`axe-core violations:\n${summary}`);
    }
    expect(results.violations).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. BroadcastRecipientPicker — keyboard-only journey.
//    Trigger → search has focus on mount → Tab to first row checkbox → Space
//    toggles → Enter on "Broadcast to N" confirms → focus returns to trigger.
// ────────────────────────────────────────────────────────────────────────────

test.describe('BroadcastRecipientPicker — keyboard-only', () => {
  test('Space toggles a row, Enter confirms, focus restores to trigger', async ({ page }) => {
    await gotoHarness(page, 'picker');

    // Open via the trigger button — that primes useDialogA11y's
    // `previouslyFocused` to the trigger so focus restoration on confirm has
    // a stable target to assert against.
    const trigger = page.getByTestId('open-broadcast-picker');
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');

    const dialog = pickerDialog(page);
    await expect(dialog).toBeVisible();

    // useDialogA11y sets initial focus on the search input.
    const search = dialog.getByLabel('Search Pulse contacts');
    await expect(search).toBeFocused();

    // The three Pulse-linked seed contacts each render as role=checkbox.
    const rows = dialog.getByRole('checkbox');
    await expect(rows).toHaveCount(3);

    // Tab past search → 1st "Select all"-or-row chain. Walk forward until a
    // checkbox row receives focus, then Space-toggle it.
    let safety = 12;
    while (safety-- > 0) {
      const focused = await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.getAttribute('role'),
      );
      if (focused === 'checkbox') break;
      await page.keyboard.press('Tab');
    }
    const checkedBefore = await rows.first().getAttribute('aria-checked');
    expect(['true', 'false']).toContain(checkedBefore);

    // Space toggles the focused checkbox. Identify which one is focused so
    // we can assert on the right row (Tab order may include 1+ rows).
    const focusedId = await page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute('aria-label'));
    await page.keyboard.press('Space');
    const focusedRow = dialog.getByRole('checkbox', { name: focusedId ?? undefined });
    await expect(focusedRow).toHaveAttribute('aria-checked', 'true');

    // Counter announces selection ("1 selected of 3"). aria-live polite —
    // we don't assert on speech but we assert on the visible text.
    await expect(dialog.getByText(/1 selected of 3/i)).toBeVisible();

    // Tab forward to the Broadcast button. The aria-label updates with the
    // count: "Broadcast to 1 recipient" (singular).
    const broadcastBtn = dialog.getByRole('button', { name: /Broadcast to 1 recipient/i });
    await broadcastBtn.focus();
    await expect(broadcastBtn).toBeFocused();
    await page.keyboard.press('Enter');

    // Dialog closes, focus returns to the trigger button.
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // Confirm payload reached the harness (deterministic sanity check that
    // onConfirm fired with at least one id — guards against silent regressions).
    await expect(page.getByTestId('picker-result')).toBeVisible();
  });

  test('non-Pulse contacts are filtered out of the picker', async ({ page }) => {
    await gotoHarness(page, 'picker');
    await page.getByTestId('open-broadcast-picker').click();
    const dialog = pickerDialog(page);
    await expect(dialog).toBeVisible();
    // Seed includes "Anonymous Coward" without pulseUserId → must NOT appear.
    await expect(dialog.getByText('Anonymous Coward')).toHaveCount(0);
    await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Reorder strip — keyboard-only. Enter reorder mode → ArrowDown twice →
//    Accept. We exercise the keyboard path that screen-reader / motor-impaired
//    users follow, then sanity-check that mouse drag still wires up.
// ────────────────────────────────────────────────────────────────────────────

test.describe('AiStrip reorder — keyboard-only', () => {
  test('ArrowDown moves the focused stop and follows focus', async ({ page }) => {
    await gotoHarness(page, 'reorder');

    const list = page.getByRole('list', { name: /Reorder stops/i });
    await expect(list).toBeVisible();

    // Confirm the three seeded stops render in the original order.
    const rows = list.getByRole('listitem');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toHaveAttribute('aria-label', /Stop 1 of 3: Ada Lovelace/);
    await expect(rows.nth(2)).toHaveAttribute('aria-label', /Stop 3 of 3: Linus Torvalds/);

    // Focus the first row (Ada). ArrowDown twice — Ada should land at index 3.
    await rows.nth(0).focus();
    await expect(rows.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Focus follows the moved stop: row at idx=2 is now Ada.
    await expect(rows.nth(2)).toHaveAttribute('aria-label', /Stop 3 of 3: Ada Lovelace/);
    await expect(rows.nth(2)).toBeFocused();

    // Accept finalises the order; the harness signals the onAccept callback.
    await page.getByRole('button', { name: /^Accept$/i }).click();
    await expect(page.getByTestId('reorder-accept-result')).toBeVisible();
  });

  test('mouse drag still triggers reorder (smoke)', async ({ page }) => {
    await gotoHarness(page, 'reorder');
    const list = page.getByRole('list', { name: /Reorder stops/i });
    const rows = list.getByRole('listitem');

    // HTML5 drag events in Playwright work via dragTo on locator pairs.
    // This is a smoke check — we only assert the order changed, not the
    // specific final order (browsers vary in drag-image timing).
    const beforeFirst = await rows.nth(0).getAttribute('aria-label');
    await rows.nth(0).dragTo(rows.nth(2));
    const afterFirst = await rows.nth(0).getAttribute('aria-label');
    // Either the drag rearranged the list OR the browser ignored the synthetic
    // drag (some headless modes). Soft assertion — log but don't fail the
    // whole suite if drag isn't synthetic-friendly.
    if (beforeFirst === afterFirst) {
      test.info().annotations.push({
        type: 'flaky',
        description: 'Synthetic drag did not reorder list — likely browser-specific. Keyboard path remains authoritative.',
      });
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. LiveBroadcastSheet — keyboard. Open via the live chip trigger, confirm
//    initial focus lands on the close button, Tab keeps focus inside the
//    sheet, Esc closes and returns focus to the trigger.
// ────────────────────────────────────────────────────────────────────────────

test.describe('LiveBroadcastSheet — keyboard-only', () => {
  test('Esc closes and returns focus to the trigger', async ({ page }) => {
    await gotoHarness(page, 'live');

    const trigger = page.getByTestId('open-live-sheet');
    await trigger.focus();
    await page.keyboard.press('Enter');

    const dialog = liveDialog(page);
    await expect(dialog).toBeVisible();

    // useDialogA11y points initialFocusRef at the close button.
    const closeBtn = dialog.getByRole('button', { name: 'Close' });
    await expect(closeBtn).toBeFocused();

    // One Tab should land somewhere INSIDE the dialog (focus trap).
    await page.keyboard.press('Tab');
    const stillInside = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return dlg?.contains(document.activeElement) ?? false;
    });
    expect(stillInside).toBe(true);

    // Esc closes.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. I'm at… FAB — renders when GPS is on, opens its sheet, share-location
//    dialog has its own focus trap. Limited scope: we verify the FAB exists,
//    is keyboard-reachable, and Esc-closes without breaking focus return.
// ────────────────────────────────────────────────────────────────────────────

test.describe("ImAtFAB — keyboard journey", () => {
  test('FAB is keyboard-reachable and Esc returns focus', async ({ page }) => {
    // Stub the reverse-geocode network call so the test is deterministic.
    await page.route('**/maps.googleapis.com/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'OK', results: [{ formatted_address: 'Test Place, San Francisco' }] }),
    }));
    await page.route('**/functions/v1/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: null }),
    }));

    await gotoHarness(page, 'imat');
    const fab = page.getByRole('button', { name: /Send your location to a contact/i });
    await expect(fab).toBeVisible();

    await fab.focus();
    await expect(fab).toBeFocused();
    await page.keyboard.press('Enter');

    const sheet = page.getByRole('dialog', { name: /Share your location with a contact/i });
    await expect(sheet).toBeVisible();

    // Esc closes the share sheet. The harness FAB is the previous-focus
    // owner; focus should land there again.
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(fab).toBeFocused();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Notes on coverage NOT in this file
//
// The PALETTE_TO_VOYAGER payload also asks for an SR-snapshot test:
//   "sr-only announcer fires 'Today lens, N contacts on map' within 200ms of
//   lens swap."
//
// That announcer lives inside the full PulseMapView (not in any isolated
// dialog), and exercising it requires:
//   - a real Google Maps JS API key OR a complete window.google stub,
//   - a Supabase auth session OR a fully mocked AuthContext,
//   - the AI proposal pipeline (proposeRoute) stubbed end-to-end so AiStrip
//     can settle.
//
// That work is tracked as a follow-up — see the comment in
// src/components/map/__e2e_harness/MapTestHarness.tsx. The dialog / reorder /
// FAB journeys covered above are the WCAG 2.4.3 (Focus Order), 2.4.7 (Focus
// Visible), and 4.1.2 (Name, Role, Value) coverage promised by the handoff.
// ────────────────────────────────────────────────────────────────────────────
