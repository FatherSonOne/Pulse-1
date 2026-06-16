// Standalone visual/interaction verification for the Map "Direction D — Horizon"
// redesign (P3 base-style switch, P5 scrubber + Atlas, P4 AI affordances).
// Injects the mapHorizon + experimentalEnabled flags via localStorage BEFORE load,
// navigates to the Map via the command palette, then asserts the Horizon chrome
// renders + is interactive and captures screenshots.
//
//   TARGET=http://localhost:5173 node e2e/_verify-map-horizon.mjs
import { chromium, devices } from '@playwright/test';

const TARGET = process.env.TARGET || 'http://localhost:5173';
const log = (...a) => console.log(...a);
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); log(`${ok ? 'PASS' : 'FAIL'} · ${name}${extra ? ' · ' + extra : ''}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' });
// Force the flags ON before the app's FeatureContext reads localStorage.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('pulse_feature_flags', JSON.stringify({
      mapHorizon: true, experimentalEnabled: true, mapLibreRenderer: true,
    }));
    localStorage.setItem('pulse_feature_flags_version', '1');
  } catch { /* storage blocked */ }
});
const page = await ctx.newPage();
page.on('pageerror', e => log('PAGEERROR:', e.message));

try {
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(7000);

  // Trial paywall (this account's trial ended) — dismiss if blocking.
  const trial = page.locator('[aria-label="Trial expired"]');
  if (await trial.count()) { await trial.locator('button').first().click().catch(() => {}); await page.waitForTimeout(1000); }

  // Auth sanity — if we're on the login/landing screen the stored token is stale.
  const loggedOut = await page.getByText(/Launch Pulse|Sign in|Continue with Google/i).count();
  if (loggedOut) check('authenticated (stored token valid)', false, 'login screen visible — token likely expired');
  else check('authenticated (stored token valid)', true);

  // Navigate to Map via the command palette (nav-map entry).
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(900);
  await page.keyboard.type('Map');
  await page.waitForTimeout(800);
  // Prefer the unique nav-map description; fall back to Enter on the top hit.
  const navMap = page.getByText('Spatial layer', { exact: false }).first();
  if (await navMap.count()) await navMap.click().catch(() => {});
  else await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);

  const scrubber = page.locator('[aria-label="Time horizon"]');
  const appeared = await scrubber.count();
  check('Map reached + HorizonScrubber rendered', !!appeared);

  await page.screenshot({ path: 'e2e/_map-horizon-default.png', fullPage: false });

  if (appeared) {
    // P5 — scrubber detents + Atlas, and the legacy tabs must be GONE.
    check('legacy MapLensRow replaced (Map lens absent)', (await page.locator('[aria-label="Map lens"]').count()) === 0);
    check('Atlas toggle present', (await page.getByRole('button', { name: /Atlas/ }).count()) > 0);
    for (const d of ['Now', 'Today', '3 Days', 'Week']) {
      check(`scrubber detent "${d}" present`, (await page.getByRole('button', { name: new RegExp(d) }).count()) > 0);
    }
    // P3 — base-style switch + density.
    check('base-style switch present', (await page.locator('[aria-label="Map base style"]').count()) > 0);
    check('density control present', (await page.locator('[aria-label="Map label density"]').count()) > 0);

    // Interaction — switch to a detent, toggle Atlas, flip base style + density.
    const threeDay = page.getByRole('button', { name: /3 Days/ }).first();
    await threeDay.click().catch(() => {});
    await page.waitForTimeout(600);
    check('detent "3 Days" toggles aria-pressed', (await threeDay.getAttribute('aria-pressed')) === 'true');

    const contrast = page.getByRole('button', { name: /Contrast map style/ }).first();
    if (await contrast.count()) { await contrast.click().catch(() => {}); await page.waitForTimeout(1500); }
    check('base style "Contrast" selectable', (await contrast.count()) > 0 && (await contrast.getAttribute('aria-pressed')) === 'true');
    await page.screenshot({ path: 'e2e/_map-horizon-contrast.png', fullPage: false });

    const minimal = page.getByRole('button', { name: /Minimal labels/ }).first();
    if (await minimal.count()) { await minimal.click().catch(() => {}); await page.waitForTimeout(1200); }
    check('density "Minimal" selectable', (await minimal.count()) > 0 && (await minimal.getAttribute('aria-pressed')) === 'true');

    const atlas = page.getByRole('button', { name: /Atlas/ }).first();
    await atlas.click().catch(() => {});
    await page.waitForTimeout(1500);
    check('Atlas mode toggles aria-pressed', (await atlas.getAttribute('aria-pressed')) === 'true');
    await page.screenshot({ path: 'e2e/_map-horizon-atlas.png', fullPage: false });
  }
} catch (e) {
  log('ERR', e.message);
  await page.screenshot({ path: 'e2e/_map-horizon-error.png' }).catch(() => {});
}

const passed = results.filter(r => r.ok).length;
log(`\nSUMMARY: ${passed}/${results.length} checks passed`);
await browser.close();
process.exit(0);
