import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = pathToFileURL(resolve(__dirname, 'calendar-ai-panel-redesign.html')).href;
const shotsDir = resolve(__dirname, '_shots');
mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(700);

async function setTheme(t) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t);
  await page.waitForTimeout(120);
}
async function selectPath(letter) {
  await page.locator(`button:has-text("${letter} · ")`).first().click();
  await page.waitForTimeout(300);
}
async function shot(name) {
  await page.screenshot({ path: resolve(shotsDir, `calendar-ai-panel-${name}.png`), fullPage: false });
  console.log('shot:', name);
}

const shots = [
  { name: '01-A-dark',  path: 'A', theme: 'dark'  },
  { name: '02-A-light', path: 'A', theme: 'light' },
  { name: '03-B-dark',  path: 'B', theme: 'dark'  },
  { name: '04-B-light', path: 'B', theme: 'light' },
  { name: '05-C-dark',  path: 'C', theme: 'dark'  },
  { name: '06-C-light', path: 'C', theme: 'light' },
];

for (const s of shots) {
  await selectPath(s.path);
  await setTheme(s.theme);
  await shot(s.name);
}

// Path A tab interaction
await selectPath('A');
await setTheme('dark');
for (const t of ['Insights', 'Analytics', 'Goals']) {
  await page.locator(`.a-tab:has-text("${t}")`).click();
  await page.waitForTimeout(200);
  await shot(`07-A-tab-${t.toLowerCase()}-dark`);
}

// Path C lens interaction
await selectPath('C');
await setTheme('dark');
for (const l of ['Reflect', 'People']) {
  await page.locator(`.c-lens:has-text("${l}")`).click();
  await page.waitForTimeout(200);
  await shot(`08-C-lens-${l.toLowerCase()}-dark`);
}

if (errors.length) {
  console.error('\n=== ERRORS ===');
  errors.forEach((e) => console.error(e));
  await browser.close();
  process.exit(1);
}
console.log('\n✓ clean, no errors');
await browser.close();
