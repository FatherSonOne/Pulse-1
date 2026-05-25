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
];

// DARK pass
for (const p of paths) {
  await page.locator(`.pg-bar button:has-text("${p.btn}")`).first().click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `_shots/cal-${p.tag}-dark.png` });
  console.log(`✓ cal-${p.tag}-dark`);
}

// LIGHT pass
await page.locator('.pg-bar button', { hasText: /LIGHT|DARK/ }).first().click();
await page.waitForTimeout(200);
for (const p of paths) {
  await page.locator(`.pg-bar button:has-text("${p.btn}")`).first().click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `_shots/cal-${p.tag}-light.png` });
  console.log(`✓ cal-${p.tag}-light`);
}

// quick structural sanity checks
const stats = await page.evaluate(() => ({
  evChips: document.querySelectorAll('.ev').length,
  aiChips: document.querySelectorAll('.ai-chip, .ai-card, .ai-ribbon').length,
  blocks: document.querySelectorAll('.block').length,
  ghost: document.querySelectorAll('.ghost-block').length,
}));
console.log('structure (path C active):', JSON.stringify(stats));

console.log(errors.length ? '\n--- errors ---\n' + errors.join('\n') : '\n✅ no console/page errors');
await browser.close();
