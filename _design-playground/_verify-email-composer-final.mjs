import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdir } from 'fs/promises';

const file = pathToFileURL(resolve('./email-composer-final.html')).href;
await mkdir('./_shots', { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('pageerror',  e => errors.push(`pageerror: ${e.message}`));
page.on('console',    m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
page.on('requestfailed', r => {
  if (r.url().includes('tailwindcss.com')) return;
  errors.push(`reqfail: ${r.url()} — ${r.failure()?.errorText}`);
});

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(900);

async function setTheme(t) { await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), t); }
async function clickDemo(label) {
  await page.locator(`button:has-text("${label}")`).first().click();
  await page.waitForTimeout(420);
}
async function press(key) { await page.keyboard.press(key); await page.waitForTimeout(380); }
async function shot(name) {
  await page.screenshot({ path: `_shots/composer-final-${name}.png`, fullPage: false });
  console.log('shot:', name);
}

// 1. Default state — sidecar pre-open (the most-used path)
await setTheme('dark');
await shot('01-default-sidecar-open-dark');
await setTheme('light');
await shot('02-default-sidecar-open-light');

// 2. Close sidecar (Esc) — pure inbox + viewer
await setTheme('dark');
await press('Escape');
await shot('03-inbox-viewer-dark');
await setTheme('light');
await shot('04-inbox-viewer-light');

// 3. Re-open sidecar via R hotkey
await setTheme('dark');
await press('r');
await shot('05-sidecar-reopened-via-R-dark');

// 4. New Message via ⌘N (Focal Canvas)
await press('Escape'); // close sidecar
await page.waitForTimeout(200);
await page.keyboard.down('Control');
await page.keyboard.press('n');
await page.keyboard.up('Control');
await page.waitForTimeout(420);
await shot('06-focal-canvas-new-dark');
await setTheme('light');
await shot('07-focal-canvas-new-light');

// 5. Close Focal, then promote sidecar to fullscreen
await press('Escape');
await setTheme('dark');
await press('r');                              // reopen sidecar
await page.locator('button[title*="Expand to fullscreen"]').first().click();
await page.waitForTimeout(500);
await shot('08-focal-canvas-reply-promoted-dark');

if (errors.length) {
  console.error('\n=== ERRORS ===');
  errors.forEach(e => console.error(e));
  await browser.close();
  process.exit(1);
}
console.log('\n✓ clean, no errors');
await browser.close();
