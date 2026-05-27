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
await page.waitForTimeout(400);

async function ensureTheme(t) {
  const cur = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (cur !== t) { await page.locator('.pg-bar button', { hasText: /LIGHT|DARK/ }).first().click(); await page.waitForTimeout(150); }
}
async function setPath(p) { await page.locator(`.pg-pill:has-text("${p}")`).first().click(); await page.waitForTimeout(150); }
async function setSub(label) { await page.locator(`main button:has-text("${label}")`).first().click(); await page.waitForTimeout(200); }
async function blend(label) { await page.locator(`main button:has-text("${label}")`).first().click(); await page.waitForTimeout(200); }

await ensureTheme('dark');
await setPath('D · Hybrid');

// D Inbox — Briefing (default), full-width, bigger preview
await setSub('Inbox');
await page.screenshot({ path: '_shots/gld-01-D-inbox-briefing-dark.png' });
console.log('✓ D Inbox Briefing dark');
// expand a preview player
await page.locator('main button:has-text("Watch")').first().click().catch(() => {});
await page.waitForTimeout(250);
await page.screenshot({ path: '_shots/gld-02-D-inbox-preview-open.png' });
console.log('✓ D Inbox preview open');
// Briefing + Reel blend
await blend('Briefing + Reel');
await page.screenshot({ path: '_shots/gld-03-D-inbox-reel.png' });
console.log('✓ D Inbox Reel blend');

// D Thread — Cockpit bubbles (default)
await setSub('Thread');
await page.screenshot({ path: '_shots/gld-04-D-thread-bubbles-dark.png' });
console.log('✓ D Thread bubbles dark');
// Bubbles + task rail
await blend('Bubbles + task rail');
await page.screenshot({ path: '_shots/gld-05-D-thread-tasks.png' });
console.log('✓ D Thread + task rail');

// light mode inbox
await setSub('Inbox');
await ensureTheme('light');
await page.screenshot({ path: '_shots/gld-06-D-inbox-light.png' });
console.log('✓ D Inbox light');

if (errors.length) { console.log('\n--- ERRORS ---'); errors.forEach(e => console.log(e)); process.exitCode = 1; }
else console.log('\nNo console/page errors ✓');
await browser.close();
