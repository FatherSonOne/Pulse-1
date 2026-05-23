import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./relay-redesign.html')).href;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

const shots = [
  // path A
  { name: '01-A-triage-dark', path: 'A', theme: 'dark', section: 'triage' },
  { name: '02-A-triage-light', path: 'A', theme: 'light', section: 'triage' },
  { name: '03-A-direct-dark', path: 'A', theme: 'dark', section: 'direct' },
  { name: '04-A-channel-dark', path: 'A', theme: 'dark', section: 'channel' },
  { name: '05-A-broadcast-dark', path: 'A', theme: 'dark', section: 'broadcast' },
  { name: '06-A-notes-dark', path: 'A', theme: 'dark', section: 'notes' },
  { name: '07-A-live-dark', path: 'A', theme: 'dark', section: 'live' },
  // path B
  { name: '10-B-triage-dark', path: 'B', theme: 'dark', section: 'triage' },
  { name: '11-B-triage-light', path: 'B', theme: 'light', section: 'triage' },
  { name: '12-B-direct-dark', path: 'B', theme: 'dark', section: 'direct' },
  { name: '13-B-channel-dark', path: 'B', theme: 'dark', section: 'channel' },
  { name: '14-B-broadcast-dark', path: 'B', theme: 'dark', section: 'broadcast' },
  { name: '15-B-notes-dark', path: 'B', theme: 'dark', section: 'notes' },
  { name: '16-B-live-dark', path: 'B', theme: 'dark', section: 'live' },
  // path C
  { name: '20-C-triage-dark', path: 'C', theme: 'dark', section: 'triage' },
  { name: '21-C-triage-light', path: 'C', theme: 'light', section: 'triage' },
  { name: '22-C-direct-dark', path: 'C', theme: 'dark', section: 'direct' },
  { name: '23-C-channel-dark', path: 'C', theme: 'dark', section: 'channel' },
  { name: '24-C-broadcast-dark', path: 'C', theme: 'dark', section: 'broadcast' },
  { name: '25-C-notes-dark', path: 'C', theme: 'dark', section: 'notes' },
  { name: '26-C-live-dark', path: 'C', theme: 'dark', section: 'live' },
];

async function ensureTheme(target) {
  const current = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (current !== target) {
    // Click the theme toggle in the playground top bar — drives React state.
    await page.locator('.pg-bar button', { hasText: /LIGHT|DARK/ }).first().click();
    await page.waitForTimeout(150);
  }
}

for (const s of shots) {
  await ensureTheme(s.theme);
  // Click path button (exact label start)
  await page.locator(`button[data-active]:has-text("${s.path} ·")`).first().click({ timeout: 5000 }).catch(async () => {
    await page.locator(`button:has-text("${s.path} ·")`).first().click();
  });
  await page.waitForTimeout(200);
  await page.locator(`main button[data-section="${s.section}"]`).first().click({ timeout: 4000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `_shots/${s.name}.png`, fullPage: false });
  console.log(`✓ ${s.name}`);
}

if (errors.length) {
  console.log('\n--- errors ---');
  errors.forEach(e => console.log(e));
} else {
  console.log('\nno console/page errors');
}

await browser.close();
