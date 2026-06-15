import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./maps-redesign.html')).href;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(900);

const dirs = [
  { btn: 'Cockpit', tag: 'A' },
  { btn: 'Console', tag: 'B' },
  { btn: 'Field',   tag: 'C' },
  { btn: 'Horizon', tag: 'D' },
];

async function dirBtn(name){ return page.locator('button', { hasText: name }).first(); }

// LIGHT pass (default theme)
for (const d of dirs) {
  await (await dirBtn(d.btn)).click();
  await page.waitForTimeout(550);
  await page.screenshot({ path: `_shots/maps-${d.tag}-light.png` });
  console.log(`✓ maps-${d.tag}-light`);
}

// DARK pass — toggle app theme via the stable top-bar hook
await page.locator('#theme-toggle').click();
await page.waitForTimeout(300);
for (const d of dirs) {
  await (await dirBtn(d.btn)).click();
  await page.waitForTimeout(550);
  await page.screenshot({ path: `_shots/maps-${d.tag}-dark.png` });
  console.log(`✓ maps-${d.tag}-dark`);
}
// back to light for the interaction captures below
await page.locator('#theme-toggle').click();
await page.waitForTimeout(250);

// A interactions: open Live drawer + I'm at sheet
await (await dirBtn('Cockpit')).click();
await page.waitForTimeout(350);
await page.locator('button[aria-label="Live"]').first().click();
await page.waitForTimeout(450);
await page.screenshot({ path: '_shots/maps-A-live-drawer.png' });
console.log('✓ maps-A-live-drawer');
await page.keyboard.press('Escape').catch(()=>{});
await page.mouse.click(700, 470);
await page.waitForTimeout(200);
await page.locator('button:has-text("I\'m at")').first().click();
await page.waitForTimeout(400);
const geo = await page.locator('text=Live results').count();
await page.screenshot({ path: '_shots/maps-A-imat.png' });
console.log('✓ maps-A-imat · geosearch panel present:', geo > 0);

// B interactions: rail tabs Routes / Live / Fences + week lens
await (await dirBtn('Console')).click();
await page.waitForTimeout(400);
for (const t of ['Routes','Live','Fences']) {
  await page.locator(`button:has-text("${t}")`).first().click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `_shots/maps-B-${t.toLowerCase()}.png` });
  console.log(`✓ maps-B-${t.toLowerCase()}`);
}
await page.locator('button:has-text("Week")').first().click();
await page.waitForTimeout(350);
await page.screenshot({ path: '_shots/maps-B-week.png' });
console.log('✓ maps-B-week');

// C interactions: focus a few feed cards
await (await dirBtn('Field')).click();
await page.waitForTimeout(400);
for (const c of ['Dana Brooks','Sarah K.','Arrived']) {
  await page.locator(`button:has-text("${c}")`).first().click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `_shots/maps-C-${c.split(' ')[0].toLowerCase()}.png` });
  console.log(`✓ maps-C-${c.split(' ')[0].toLowerCase()}`);
}

// D interactions: horizon scrubber steps + Atlas toggle
await (await dirBtn('Horizon')).click();
await page.waitForTimeout(400);
for (const h of ['Now','3 days','Week']) {
  await page.locator(`button:has-text("${h}")`).first().click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `_shots/maps-D-${h.replace(' ','')}.png` });
  console.log(`✓ maps-D-${h.replace(' ','')}`);
}
await page.locator('button:has-text("Atlas")').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: '_shots/maps-D-atlas.png' });
console.log('✓ maps-D-atlas');

const stats = await page.evaluate(() => ({
  mapCanvas: document.querySelectorAll('svg').length,
  buttons: document.querySelectorAll('button').length,
}));
console.log('structure:', JSON.stringify(stats));
console.log(errors.length ? '\n--- errors ---\n' + errors.join('\n') : '\n✅ no console/page errors');
await browser.close();
