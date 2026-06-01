/**
 * War Room "Notebook" (Path A) verification tour.
 * Drives the authenticated app (reusing e2e/.auth/user.json) to screenshot the
 * redesigned War Room so the 3-pane (Sources · Chat · Studio) can be eyeballed
 * against the mockup without a manual logged-in pass. Shots land in
 * .warroom-verify/ (gitignored). Best-effort / resilient.
 *
 * The warRoomNotebook flag is ON by default; the ?ff override is belt-and-braces.
 *
 * Requires a fresh saved session — if it reports AUTH FAILED, re-capture:
 *   npx playwright test --project=setup --headed     (sign in via Google once)
 * Then:
 *   npx playwright test e2e/warroom-notebook-verify.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const OUT = '.warroom-verify';

const seen = async (loc: import('@playwright/test').Locator, ms = 4000) =>
  loc.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);

test('war room notebook screenshot tour', async ({ page }) => {
  test.setTimeout(180_000);
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  await page.setViewportSize({ width: 1600, height: 920 });
  await page.goto('/?ff_warRoomNotebook=on', { waitUntil: 'domcontentloaded' });

  // Auth proof: wait for the left app nav to render past the auth splash.
  const warRoomNav = page.getByRole('button', { name: 'War Room', exact: true }).first();
  let authed = false;
  try {
    await warRoomNav.waitFor({ state: 'visible', timeout: 90_000 });
    authed = true;
  } catch { /* fall through */ }
  await page.screenshot({ path: `${OUT}/00-landing.png` });
  if (!authed) {
    console.log('[verify] AUTH FAILED — shell did not render within 90s. Re-export e2e/.auth/user.json.');
    return;
  }
  console.log('[verify] AUTH OK — app shell rendered.');

  await warRoomNav.click();
  await page.waitForTimeout(2500);

  const setTheme = async (want: 'dark' | 'light') => {
    const btn = page.getByRole('button', { name: want === 'dark' ? 'Dark mode' : 'Light mode' }).first();
    if (await seen(btn, 2000)) { await btn.click(); await page.waitForTimeout(700); }
  };

  // Default (as-loaded) view of the 3-pane.
  await page.screenshot({ path: `${OUT}/01-warroom-default.png` });

  await setTheme('dark');
  await page.screenshot({ path: `${OUT}/02-warroom-dark.png` });
  await setTheme('light');
  await page.screenshot({ path: `${OUT}/03-warroom-light.png` });
  await setTheme('dark');

  // Try to populate the chat: pick the first project, then first session via the
  // folded-in ProjectSwitcher dropdowns (data loads async from Supabase; racy).
  try {
    const projBtn = page.getByRole('button', { name: /Select project|project/i }).first();
    if (await seen(projBtn, 4000)) {
      await projBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/04-project-menu.png` });
    }
  } catch { /* ignore */ }

  // Open the generator rail's Study Guide to confirm Studio dispatch (best-effort).
  try {
    const sg = page.getByText('Study Guide', { exact: false }).first();
    if (await seen(sg, 3000)) {
      await sg.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/05-studio-generator.png` });
    }
  } catch { /* ignore */ }

  expect(authed).toBe(true);
});
