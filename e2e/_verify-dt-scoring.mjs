import { chromium } from '@playwright/test';
import fs from 'fs';
const TARGET = process.env.TARGET || 'http://localhost:5173';
const DIR = '.dt-verify';
fs.mkdirSync(DIR, { recursive: true });
const log = (...a) => console.log(...a);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: 'e2e/.auth/user.json' });
const page = await ctx.newPage();
const results = {};
try {
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(7000);
  const trial = page.locator('[aria-label="Trial expired"]');
  if (await trial.count()) { await trial.locator('button').first().click().catch(() => {}); await page.waitForTimeout(1000); }
  await page.getByText('Decisions & Tasks', { exact: true }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(4000);

  const dec = page.locator('.ck-qitem-title', { hasText: /Resolve|data leaks/i }).first();
  results.decisionRowFound = (await dec.count()) > 0;
  await dec.click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DIR}/10-decision-focal.png` });
  results.scoringSection = (await page.getByText('Option scoring', { exact: false }).count()) > 0;

  // Build a small matrix: 2 options × 1 criterion, score them.
  const addOpt = page.getByRole('button', { name: /^\s*Option\s*$/ }).first();
  const addCrit = page.getByRole('button', { name: /^\s*Criterion\s*$/ }).first();
  if (await addOpt.count()) { await addOpt.click(); await page.waitForTimeout(250); await addOpt.click(); await page.waitForTimeout(250); }
  if (await addCrit.count()) { await addCrit.click(); await page.waitForTimeout(250); }
  await page.waitForTimeout(400);
  results.scoringGrid = (await page.locator('.ck-sm-table').count()) > 0;
  // Enter scores so a winner is computed.
  const scores = page.locator('.ck-sm-score');
  const n = await scores.count();
  if (n >= 2) {
    await scores.nth(0).fill('5'); await page.waitForTimeout(150);
    await scores.nth(1).fill('2'); await page.waitForTimeout(150);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/11-scoring-grid.png` });
  results.scoreCells = n;
  results.winnerRow = (await page.locator('.ck-sm-table tr[data-winner]').count()) > 0;

  log('SCORING RESULTS:', JSON.stringify(results, null, 2));
} catch (e) {
  log('ERR', e.message);
  await page.screenshot({ path: `${DIR}/ZZ-scoring-error.png` }).catch(() => {});
  log('PARTIAL:', JSON.stringify(results, null, 2));
}
await browser.close();
