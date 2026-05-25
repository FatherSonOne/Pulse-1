import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./messages-redesign.html')).href;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(400);

async function ensureTheme(target) {
  const current = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (current !== target) {
    await page.locator('.pg-bar button', { hasText: /LIGHT|DARK/ }).first().click();
    await page.waitForTimeout(150);
  }
}
async function gotoPath(p) {
  await page.locator(`.pg-bar button:has-text("${p} ·")`).first().click();
  await page.waitForTimeout(250);
}

const shots = [
  { name: 'msg-01-A-dark',  path: 'A', theme: 'dark' },
  { name: 'msg-02-A-light', path: 'A', theme: 'light' },
  { name: 'msg-03-B-dark',  path: 'B', theme: 'dark' },
  { name: 'msg-04-B-light', path: 'B', theme: 'light' },
  { name: 'msg-05-C-dark',  path: 'C', theme: 'dark' },
  { name: 'msg-06-C-light', path: 'C', theme: 'light' },
];

for (const s of shots) {
  await ensureTheme(s.theme);
  await gotoPath(s.path);
  await page.screenshot({ path: `_shots/${s.name}.png`, fullPage: false });
  console.log(`✓ ${s.name}`);
}

// Path A — open the AI summary card
await ensureTheme('dark');
await gotoPath('A');
await page.locator('main button:has-text("Summary")').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: '_shots/msg-07-A-summary-open.png', fullPage: false });
console.log('✓ msg-07-A-summary-open');

// Path C — open ⌘K command palette
await gotoPath('C');
await page.locator('main button:has-text("Search or run a command")').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: '_shots/msg-08-C-palette.png', fullPage: false });
console.log('✓ msg-08-C-palette');

if (errors.length) {
  console.log('\n--- errors ---');
  errors.forEach(e => console.log(e));
} else {
  console.log('\nno console/page errors');
}
await browser.close();
