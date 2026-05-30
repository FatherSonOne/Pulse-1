// Headless smoke test for the live Search Workbench (Phase 10 verify).
//
// Drives the real app at http://localhost:5173 using the Playwright e2e auth
// fixture (e2e/.auth/user.json), forces searchWorkbench ON, navigates to the
// Search view, runs a query, and exercises Table / Cards / empty-state in both
// themes — capturing every console.error / pageerror and screenshots.
//
// Run from repo root (dev server must be up on :5173):
//   node _design-playground/_verify-search-workbench.mjs
import { chromium } from 'playwright';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const BASE = process.env.SW_BASE || 'http://localhost:5173';
const QUERY = process.env.SW_QUERY || 'a';
const STORAGE = resolve('e2e/.auth/user.json');
const SHOTS = resolve('_shots');
mkdirSync(SHOTS, { recursive: true });

const errors = [];
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: STORAGE,
  viewport: { width: 1440, height: 920 },
  deviceScaleFactor: 1,
});
// Force the flag ON before any app code runs, on every navigation.
await context.addInitScript(() => {
  try { localStorage.setItem('ff_searchWorkbench', 'on'); } catch {}
});

const page = await context.newPage();
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}/search-wb-${name}.png`, fullPage: false });
  log('  shot:', name);
}
async function setTheme(theme) {
  await page.evaluate(t => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
}
async function gotoSearch() {
  // Try the sidebar nav button, then fall back to the command palette.
  const navBtn = page.locator('button:has-text("Search"), [aria-label="Search" i]').first();
  if (await navBtn.count()) {
    await navBtn.click({ timeout: 4000 }).catch(() => {});
  }
  const ok = await page.locator('.search-workbench').first()
    .waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
  if (ok) return true;
  // Fallback: ⌘K palette
  await page.keyboard.press('Meta+k').catch(() => {});
  await page.waitForTimeout(400);
  await page.keyboard.type('Search');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter').catch(() => {});
  return page.locator('.search-workbench').first()
    .waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
}

log(`\n▶ Verifying Search Workbench at ${BASE}\n`);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500); // app boot + auth

// Are we authed (not on the landing page)?
const landed = await page.locator('text=Launch Pulse').count();
if (landed) {
  log('⚠ Looks like the landing page — token likely expired. Aborting.');
  await shot('00-landing');
  await browser.close();
  console.log('\nERRORS:', errors.length ? errors : 'none');
  process.exit(2);
}

const reached = await gotoSearch();
log(reached ? '✓ Search Workbench mounted' : '⚠ could not confirm .search-workbench — screenshotting anyway');

// ── Empty state (working memory), dark ──
await setTheme('dark');
await gotoSearch();
await shot('01-empty-dark');

// ── Run a query ──
const input = page.locator('.sw-search-input').first();
if (await input.count()) {
  await input.click();
  await input.fill(QUERY);
  await page.waitForTimeout(2600); // debounce + multi-source fetch
  await shot('02-table-dark');

  // Cards view
  const cardsBtn = page.locator('.sw-view-btn:has-text("Cards")').first();
  if (await cardsBtn.count()) { await cardsBtn.click(); await page.waitForTimeout(700); await shot('03-cards-dark'); }

  // Back to table, light theme
  const tableBtn = page.locator('.sw-view-btn:has-text("Table")').first();
  if (await tableBtn.count()) await tableBtn.click();
  await page.waitForTimeout(300);
} else {
  log('⚠ .sw-search-input not found');
}

// ── Light theme ──
await setTheme('light');
await gotoSearch();
await shot('04-empty-light');
const input2 = page.locator('.sw-search-input').first();
if (await input2.count()) {
  await input2.fill(QUERY);
  await page.waitForTimeout(2600);
  await shot('05-table-light');
}

await browser.close();

console.log('\n──────── RESULT ────────');
console.log('console.error / pageerror count:', errors.length);
for (const e of errors) console.log('  •', e);
console.log('screenshots → _shots/search-wb-*.png');
process.exit(errors.length ? 1 : 0);
