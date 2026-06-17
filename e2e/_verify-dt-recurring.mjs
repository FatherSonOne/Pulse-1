// Live verification of recurring regenerate-on-complete (launch-readiness item A).
// Pre-seeded throwaway task "ZZ-RECUR-VERIFY-0617" (FREQ=DAILY, deadline today) is
// marked done via the real queue quick-action, which triggers CockpitHub.handleQuickAction
// -> taskService.updateTaskStatus + regenerateRecurring -> taskService.createTask.
// DB assertion of the spawned child row is done via Supabase MCP after this run.
// DESTRUCTIVE: completes the throwaway task and spawns a child. Both cleaned via MCP after.
//
// HEADLESS CAVEAT (2026-06-17): this script DOES NOT complete headless. In the
// Playwright/storageState context WorkspaceContext never resolves currentWorkspace,
// so CockpitHub falls back to user.id, the cockpit loads 0 tasks, and the seed row
// never renders (same known headless-auth limit as Relay/Direct). Item A was instead
// verified by seeding via MCP, having the signed-in user click Mark done in their live
// browser, then asserting the spawned child (recurrence_parent_id + local-day deadline
// advance + carried tags/created_by) via MCP. Kept as a record + a starting point if the
// headless workspace race is ever fixed.
import { chromium } from '@playwright/test';
import fs from 'fs';

const TARGET = process.env.TARGET || 'http://localhost:5173';
const TITLE = 'ZZ-RECUR-VERIFY-0617';
const DIR = '.dt-verify';
fs.mkdirSync(DIR, { recursive: true });
const log = (...a) => console.log(...a);
const shot = async (p, name) => { await p.screenshot({ path: `${DIR}/${name}.png`, fullPage: false }).catch(() => {}); };

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
  // WorkspaceContext loads currentWorkspace async, then tasks load — poll for the seed row.
  const row = page.locator('.ck-qitem', { has: page.locator('.ck-qitem-title', { hasText: TITLE }) }).first();
  await row.waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
  await shot(page, 'R0-cockpit');

  results.seedRowVisible = (await row.count()) > 0;
  if (!results.seedRowVisible) {
    log('RESULTS:', JSON.stringify(results, null, 2));
    log('Seed row not in queue — cannot exercise UI path.');
    await shot(page, 'R1-no-seed-row');
  } else {
    await row.scrollIntoViewIfNeeded().catch(() => {});
    await row.hover();
    await page.waitForTimeout(400);
    await shot(page, 'R1-seed-row-hover');
    const doneBtn = row.getByRole('button', { name: 'Mark done' });
    results.doneBtnVisible = (await doneBtn.count()) > 0;
    await doneBtn.click({ timeout: 5000 });
    // regenerateRecurring is fire-and-forget (void); give the createTask round-trip time.
    await page.waitForTimeout(4000);
    await shot(page, 'R2-after-done');
    // Toast confirms the spawn ("Next occurrence created").
    results.toastSeen = (await page.getByText('Next occurrence created', { exact: false }).count()) > 0;
  }

  log('RESULTS:', JSON.stringify(results, null, 2));
} catch (e) {
  log('ERR', e.message);
  await shot(page, 'RZZ-error');
  log('PARTIAL RESULTS:', JSON.stringify(results, null, 2));
}
await browser.close();
