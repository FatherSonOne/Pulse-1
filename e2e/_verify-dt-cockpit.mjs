// Desktop verification of the Decisions & Tasks cockpit UI shipped this session:
// sort, bulk-select, tag editor, RecurrencePicker, scoring matrix.
// Non-destructive: no real complete/delete; scoring-matrix test data cleaned via MCP after.
import { chromium } from '@playwright/test';
import fs from 'fs';

const TARGET = process.env.TARGET || 'http://localhost:5173';
const DIR = '.dt-verify';
fs.mkdirSync(DIR, { recursive: true });
const log = (...a) => console.log(...a);
const shot = async (p, name) => { await p.screenshot({ path: `${DIR}/${name}.png`, fullPage: false }).catch(() => {}); };
const seen = async (p, text) => (await p.getByText(text, { exact: false }).count()) > 0;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: 'e2e/.auth/user.json' });
const page = await ctx.newPage();
const results = {};

try {
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(7000);
  const trial = page.locator('[aria-label="Trial expired"]');
  if (await trial.count()) { await trial.locator('button').first().click().catch(() => {}); await page.waitForTimeout(1000); }
  await shot(page, '00-landing');

  // Navigate to Decisions & Tasks via the left sidebar.
  await page.getByText('Decisions & Tasks', { exact: true }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await shot(page, '01-cockpit');
  results.cockpitLoaded = await seen(page, 'Triage');

  // ── Sort (3a) ──
  const sortBtn = page.getByRole('button', { name: /Sort/ }).first();
  if (await sortBtn.count()) {
    await sortBtn.click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, '02-sort-menu');
    results.sortMenuOpens = await seen(page, 'Priority') && await seen(page, 'Due date');
    await page.getByRole('menu').getByText('Priority', { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, '03-sorted-priority');
  } else { results.sortMenuOpens = 'sort button not found'; }

  // ── Bulk select (3b) ──
  const check = page.locator('.ck-qitem-check').first();
  if (await check.count()) {
    await check.click().catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '04-bulkbar');
    results.bulkBarAppears = (await page.locator('.ck-bulkbar').count()) > 0;
    results.bulkButtons = await seen(page, 'Mark done') && await seen(page, 'Delete');
    // Non-destructive: clear instead of acting.
    await page.locator('.ck-bulkbar').getByText('Clear', { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(300);
  } else { results.bulkBarAppears = 'no task checkboxes found'; }

  // ── Task focal: Labels + Repeats (2d) ──
  // Click a task row title (avoid the checkbox).
  await page.locator('.ck-qitem-title').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '05-task-focal');
  results.labelsRow = await seen(page, 'Labels');
  results.repeatsRow = await seen(page, 'Repeats');

  // ── Decision focal: scoring matrix (3d) ──
  // The decision row shows "needs vote"; click its title.
  const decRow = page.locator('.ck-qitem-title', { hasText: /backend testing|Resolve|Testing/ }).first();
  if (await decRow.count()) {
    await decRow.click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, '06-decision-focal');
    results.scoringSection = await seen(page, 'Option scoring');
    // Render the grid (persists a scoring_matrix; cleaned via MCP after).
    const addOpt = page.getByRole('button', { name: /Option/ }).first();
    const addCrit = page.getByRole('button', { name: /Criterion/ }).first();
    if (await addOpt.count()) { await addOpt.click().catch(() => {}); await page.waitForTimeout(300); }
    if (await addCrit.count()) { await addCrit.click().catch(() => {}); await page.waitForTimeout(300); }
    if (await addOpt.count()) { await addOpt.click().catch(() => {}); await page.waitForTimeout(300); }
    await page.waitForTimeout(800);
    await shot(page, '07-scoring-grid');
    results.scoringGrid = (await page.locator('.ck-sm-table').count()) > 0;
  } else { results.scoringSection = 'decision row not found'; }

  log('RESULTS:', JSON.stringify(results, null, 2));
} catch (e) {
  log('ERR', e.message);
  await shot(page, 'ZZ-error');
  log('PARTIAL RESULTS:', JSON.stringify(results, null, 2));
}
await browser.close();
