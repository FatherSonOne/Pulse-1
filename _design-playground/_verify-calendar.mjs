import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./calendar-redesign.html')).href;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(700);

const paths = [
  { btn: 'A · Clear Month',     tag: 'A' },
  { btn: 'B · Today + Rail',    tag: 'B' },
  { btn: 'C · Timeline Studio', tag: 'C' },
  { btn: 'D · Hybrid',          tag: 'D' },
];

// DARK pass — all 4 paths (D lands on Split by default)
for (const p of paths) {
  await page.locator(`.pg-bar button:has-text("${p.btn}")`).first().click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `_shots/cal-${p.tag}-dark.png` });
  console.log(`✓ cal-${p.tag}-dark`);
}

// D sub-views: tabbed Agenda + tabbed Timeline (Split already captured above)
await page.locator(`.pg-bar button:has-text("D · Hybrid")`).first().click();
await page.waitForTimeout(300);
await page.locator('main .seg:has-text("Agenda")').first().click();
await page.waitForTimeout(350);
await page.screenshot({ path: '_shots/cal-D-tab-agenda.png' });
console.log('✓ cal-D-tab-agenda');
await page.locator('main .seg:has-text("Timeline")').first().click();
await page.waitForTimeout(350);
await page.screenshot({ path: '_shots/cal-D-tab-timeline.png' });
console.log('✓ cal-D-tab-timeline');

// cross-highlight check: in Split, click an agenda card, confirm rail "SELECTED" updates
await page.locator('main .seg:has-text("Split")').first().click();
await page.waitForTimeout(300);
const lunchCard = page.locator('main button:has-text("Lunch with Devin")').first();
await lunchCard.click();
await page.waitForTimeout(250);
const selText = await page.locator('main:has-text("SELECTED")').count();
console.log('rail shows SELECTED after click:', selText > 0);
await page.screenshot({ path: '_shots/cal-D-split-selected.png' });
console.log('✓ cal-D-split-selected');

// LIGHT pass — all 4
await page.locator('.pg-bar button', { hasText: /LIGHT|DARK/ }).first().click();
await page.waitForTimeout(200);
for (const p of paths) {
  await page.locator(`.pg-bar button:has-text("${p.btn}")`).first().click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `_shots/cal-${p.tag}-light.png` });
  console.log(`✓ cal-${p.tag}-light`);
}

const stats = await page.evaluate(() => ({
  blocks: document.querySelectorAll('.block').length,
  ghost: document.querySelectorAll('.ghost-block').length,
  aiCards: document.querySelectorAll('.ai-card').length,
}));
console.log('structure (path D / light split):', JSON.stringify(stats));
console.log(errors.length ? '\n--- errors ---\n' + errors.join('\n') : '\n✅ no console/page errors');
await browser.close();
