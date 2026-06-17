// Non-destructive UI verification of the "New from template" create path (launch item B).
// Verifies: + New menu -> "New from template" -> DecisionTemplates picker opens ->
// system templates render -> selecting one shows the variable form + a live preview
// that substitutes the typed variable into the title. STOPS before "Use This Template":
// headless cannot resolve WorkspaceContext, so a real create would target user.id (wrong
// workspace). The actual create is verified via the live user click + MCP DB assert.
import { chromium } from '@playwright/test';
import fs from 'fs';

const TARGET = process.env.TARGET || 'http://localhost:5173';
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
  await page.waitForTimeout(4000);
  await shot(page, 'T0-cockpit');

  // Open the + New menu.
  await page.locator('.ck-new').first().click().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, 'T1-new-menu');
  const tmplItem = page.getByRole('menuitem', { name: /New from template/ });
  results.menuItemPresent = (await tmplItem.count()) > 0;

  // Open the picker.
  await tmplItem.first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, 'T2-picker');
  results.pickerOpens = (await page.locator('.decision-templates-modal').count()) > 0;
  results.templateCards = await page.locator('.template-card').count();
  results.buildFeaturePresent = (await page.getByText('Build New Feature', { exact: false }).count()) > 0;

  // Select "Build New Feature" -> config view.
  const card = page.locator('.template-card', { hasText: 'Build New Feature' }).first();
  if (await card.count()) {
    await card.click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, 'T3-config');
    // Variable input(s) present.
    const varInput = page.locator('.variable-input').first();
    results.variableInputPresent = (await varInput.count()) > 0;
    // Type a value and confirm the live preview substitutes it into the title.
    await varInput.fill('ZZ-TEMPLATE-VERIFY-0617').catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, 'T4-preview');
    results.previewSubstitutes =
      (await page.locator('.preview-title', { hasText: 'ZZ-TEMPLATE-VERIFY-0617' }).count()) > 0;
    results.suggestedTasksShown = (await page.locator('.task-preview-card').count()) > 0;
    results.useButtonEnabled = await page.locator('.use-template-button').first().isEnabled().catch(() => false);
  }

  // Intentionally NOT clicking "Use This Template" (would create in the wrong workspace headless).
  log('RESULTS:', JSON.stringify(results, null, 2));
} catch (e) {
  log('ERR', e.message);
  await shot(page, 'TZZ-error');
  log('PARTIAL RESULTS:', JSON.stringify(results, null, 2));
}
await browser.close();
