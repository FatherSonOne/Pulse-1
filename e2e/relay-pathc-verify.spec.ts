/**
 * Relay Path C verification tour.
 * Drives the authenticated app (reusing e2e/.auth/user.json) to screenshot
 * each Relay source in light + dark so the Voice Studio (Path C) Tier 1–3
 * changes can be eyeballed without a manual logged-in pass. Screenshots land
 * in .relay-verify/ (gitignored). Each step is best-effort/resilient.
 *
 * Requires a fresh saved session — if the tour reports AUTH FAILED, re-capture:
 *   npx playwright test --project=setup --headed   (sign in via Google once)
 * Then:
 *   npx playwright test e2e/relay-pathc-verify.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const OUT = '.relay-verify';

test('relay path-c screenshot tour', async ({ page }) => {
  test.setTimeout(180_000);
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Prove auth: the left app sidebar should render (Relay nav present).
  const relayNav = page.getByRole('button', { name: 'Relay', exact: true }).first();
  const authed = await relayNav.isVisible({ timeout: 20_000 }).catch(() => false);
  await page.screenshot({ path: `${OUT}/00-landing.png`, fullPage: false });
  if (!authed) {
    console.log('[verify] AUTH FAILED — saved session did not authenticate (login screen).');
    return;
  }
  console.log('[verify] AUTH OK — app shell rendered.');

  await relayNav.click();
  await page.waitForTimeout(1500);

  const sources = ['Inbox', 'Direct', 'Channels', 'Broadcast', 'Notes', 'Live'];

  // Helper: toggle theme via the sidebar Dark/Light mode control.
  const setTheme = async (want: 'dark' | 'light') => {
    const btn = page.getByRole('button', { name: want === 'dark' ? 'Dark mode' : 'Light mode' }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  };

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(theme);
    for (const src of sources) {
      const item = page.getByText(src, { exact: true }).first();
      if (await item.isVisible({ timeout: 2000 }).catch(() => false)) {
        await item.click().catch(() => {});
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${OUT}/${theme}-${src.toLowerCase()}.png` });
        console.log(`[verify] captured ${theme}-${src}`);
      } else {
        console.log(`[verify] source not found: ${src}`);
      }
    }
  }
  expect(authed).toBe(true);
});
