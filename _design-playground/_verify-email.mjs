import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./email-redesign.html')).href;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(700);

async function setTheme(t) {
  await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), t);
}
async function selectPath(letter) {
  const btn = page.locator(`button:has-text("${letter} · ")`).first();
  await btn.click();
  await page.waitForTimeout(300);
}
async function shot(name) {
  await page.screenshot({ path: `_shots/email-${name}.png`, fullPage: false });
  console.log('shot:', name);
}
async function clickFirst(selector) {
  const el = page.locator(selector).first();
  if (await el.count()) { await el.click(); await page.waitForTimeout(280); return true; }
  return false;
}

// PATH A — focus polish run
await setTheme('dark');
await selectPath('A');
await shot('A1-cockpit-fresh');

// Switch to Triage via seg toggle
await clickFirst('.seg-toggle button:nth-child(2)');
await shot('A2-triage-fresh');

// Click Archive (first action button) — should fire toast + advance
await clickFirst('.triage-stage button:has-text("Archive")');
await shot('A3-triage-after-archive');

// Click Snooze on next card
await clickFirst('.triage-stage button:has-text("Snooze")');
await shot('A4-triage-after-snooze');

// Switch back to cockpit — should preserve triage progress + show queue pips updated
await clickFirst('.seg-toggle button:nth-child(1)');
await page.waitForTimeout(400);
await shot('A5-cockpit-after-2-cleared');

// Back to triage — should resume mid-queue
await clickFirst('.seg-toggle button:nth-child(2)');
await shot('A6-triage-resumed');

// Try ⌘E keyboard switch
await page.keyboard.press('Meta+E');
await page.waitForTimeout(320);
await shot('A7-cockpit-via-cmdE');

await page.keyboard.press('Control+E');
await page.waitForTimeout(320);
await shot('A8-triage-via-ctrlE');

// Power-through: dispatch all remaining items to see done state
for (let i = 0; i < 8; i++) {
  await clickFirst('.triage-stage button:has-text("Archive")');
}
await page.waitForTimeout(400);
await shot('A9-triage-done');

// Light theme spot check
await setTheme('light');
await page.keyboard.press('Meta+E');
await page.waitForTimeout(300);
await shot('A10-cockpit-light');

// Hover over a signal row to reveal TRIAGE chip (use focus instead since headless)
const signalRow = page.locator('.signal-row > button').first();
if (await signalRow.count()) {
  await signalRow.hover();
  await page.waitForTimeout(200);
  await shot('A11-signal-hover-light');
}

if (errors.length) {
  console.error('\n=== ERRORS ===');
  errors.forEach(e => console.error(e));
  process.exit(1);
}
console.log('\n✓ verify-email clean, no errors');
await browser.close();
