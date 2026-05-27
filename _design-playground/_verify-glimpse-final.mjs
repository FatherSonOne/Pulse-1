import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./glimpse-redesign.html')).href;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(450);

// Confirm it opens on Path D
const activePath = await page.locator('.pg-pill[data-active="true"]').first().innerText();
console.log('opens on:', activePath.trim());

async function ensureTheme(t) {
  const cur = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (cur !== t) { await page.locator('.pg-bar button', { hasText: /LIGHT|DARK/ }).first().click(); await page.waitForTimeout(150); }
}
async function setSub(label) { await page.locator(`main button:has-text("${label}")`).first().click(); await page.waitForTimeout(250); }

// Default landing = D Inbox (should be Briefing + Reel)
await page.screenshot({ path: '_shots/glf-01-D-inbox-reel-default.png' });
console.log('✓ D Inbox (Briefing + Reel) default dark');

await setSub('Thread');
await page.screenshot({ path: '_shots/glf-02-D-thread-tasks-default.png' });
console.log('✓ D Thread (Stacked cockpit cards + task rail) default dark');

await setSub('Inbox');
await ensureTheme('light');
await page.screenshot({ path: '_shots/glf-03-D-inbox-reel-light.png' });
console.log('✓ D Inbox light');

await setSub('Thread');
await page.screenshot({ path: '_shots/glf-04-D-thread-tasks-light.png' });
console.log('✓ D Thread light');

if (errors.length) { console.log('\n--- ERRORS ---'); errors.forEach(e => console.log(e)); process.exitCode = 1; }
else console.log('\nNo console/page errors ✓');
await browser.close();
