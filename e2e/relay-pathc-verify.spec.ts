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

  // Wide viewport so the app nav + SourcesRail + a mode's md/lg side columns
  // (Channel channels-list + members rail) all have room to render.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Prove auth: WAIT for the left app sidebar to render past the
  // "Authenticating…" splash. isVisible() returns immediately, so we must
  // waitFor() — the session restore + initial data load can take a while.
  const relayNav = page.getByRole('button', { name: 'Relay', exact: true }).first();
  let authed = false;
  try {
    await relayNav.waitFor({ state: 'visible', timeout: 90_000 });
    authed = true;
  } catch { /* fall through */ }
  await page.screenshot({ path: `${OUT}/00-landing.png`, fullPage: false });
  if (!authed) {
    console.log('[verify] AUTH FAILED — shell did not render within 90s (still authenticating or login).');
    return;
  }
  console.log('[verify] AUTH OK — app shell rendered.');

  await relayNav.click();
  await page.waitForTimeout(2000);

  const sources = ['Inbox', 'Direct', 'Channels', 'Broadcast', 'Notes', 'Live'];

  const seen = async (loc: import('@playwright/test').Locator, ms = 4000) =>
    loc.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);

  // Helper: toggle theme via the sidebar Dark/Light mode control.
  const setTheme = async (want: 'dark' | 'light') => {
    const btn = page.getByRole('button', { name: want === 'dark' ? 'Dark mode' : 'Light mode' }).first();
    if (await seen(btn, 2000)) {
      await btn.click();
      await page.waitForTimeout(700);
    }
  };

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(theme);
    for (const src of sources) {
      const item = page.getByText(src, { exact: true }).first();
      if (await seen(item, 4000)) {
        await item.click().catch(() => {});
        await page.waitForTimeout(1400);
        await page.screenshot({ path: `${OUT}/${theme}-${src.toLowerCase()}.png` });
        console.log(`[verify] captured ${theme}-${src}`);
      } else {
        console.log(`[verify] source not found: ${src}`);
      }
    }
  }
  // Focused: open the Direct conversation to verify Tier 3 day-grouping
  // (the source-tour only lands on the contact list / empty pane).
  await setTheme('light');
  const directNav = page.getByText('Direct', { exact: true }).first();
  if (await seen(directNav)) { await directNav.click(); await page.waitForTimeout(2000); }
  const contact = page.locator('.classic-contact').first();
  if (await seen(contact, 6000)) {
    await contact.click();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/light-direct-thread.png` });
    console.log('[verify] captured light-direct-thread');
  } else {
    console.log('[verify] direct contact not found for thread capture');
  }

  expect(authed).toBe(true);
});

test('channel members rail', async ({ page }) => {
  test.setTimeout(120_000);
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const relayNav = page.getByRole('button', { name: 'Relay', exact: true }).first();
  await relayNav.waitFor({ state: 'visible', timeout: 90_000 });
  await relayNav.click();
  await page.getByText('Channels', { exact: true }).first().click();

  // Wait for the workspace/channel data to load + auto-select (async from
  // Supabase; racy). Poll up to ~20s for the "Select a channel" empty state to
  // clear (i.e. a channel became active), then try a channel button as backup.
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000);
    const empty = await page.getByText('Select a channel', { exact: false }).isVisible().catch(() => false);
    if (!empty) break;
    const ch = page.locator('button', { hasText: 'General' }).first();
    if (await ch.isVisible().catch(() => false)) { await ch.click().catch(() => {}); }
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/channel-rail.png` });
  console.log('[verify] captured channel-rail');
});

test('direct conversation day-grouping', async ({ page }) => {
  test.setTimeout(120_000);
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const relayNav = page.getByRole('button', { name: 'Relay', exact: true }).first();
  await relayNav.waitFor({ state: 'visible', timeout: 90_000 });
  await relayNav.click();
  await page.getByText('Direct', { exact: true }).first().click();
  await page.waitForTimeout(2500);

  const contacts = page.locator('.classic-contact');
  const n = await contacts.count();
  console.log(`[verify] classic-contact count: ${n}`);
  if (n > 0) {
    await contacts.first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/direct-thread.png` });
    console.log('[verify] captured direct-thread');
  } else {
    // Fallback: click the first row inside the contacts scroll area.
    const row = page.locator('.classic-contacts button, .classic-contacts [role="button"]').first();
    if (await row.count()) {
      await row.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/direct-thread.png` });
      console.log('[verify] captured direct-thread (fallback row)');
    }
  }
});
