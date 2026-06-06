import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./contacts-redesign.html')).href;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);

async function setTheme(t) { await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), t); }
async function selectPath(letter) {
  await page.locator(`button:has-text("${letter} · ")`).first().click();
  await page.waitForTimeout(350);
}
async function shot(name) {
  await page.screenshot({ path: `_shots/contacts-${name}.png`, fullPage: false });
  console.log('shot:', name);
}

const shots = [
  { name: '00-D-dark',  path: 'D', theme: 'dark'  },
  { name: '00-D-light', path: 'D', theme: 'light' },
  { name: '01-A-dark',  path: 'A', theme: 'dark'  },
  { name: '02-A-light', path: 'A', theme: 'light' },
  { name: '03-B-dark',  path: 'B', theme: 'dark'  },
  { name: '04-B-light', path: 'B', theme: 'light' },
  { name: '05-C-dark',  path: 'C', theme: 'dark'  },
  { name: '06-C-light', path: 'C', theme: 'light' },
];

for (const s of shots) {
  await setTheme(s.theme);
  await selectPath(s.path);
  await shot(s.name);
}

// Open the Path C dossier to verify the focal overlay renders cleanly.
await setTheme('dark');
await selectPath('C');
await page.locator('.lane-card').first().click();
await page.waitForTimeout(350);
await page.screenshot({ path: '_shots/contacts-07-C-dossier.png', fullPage: false });
console.log('shot: 07-C-dossier');

if (errors.length) {
  console.error('\n=== ERRORS ===');
  errors.forEach(e => console.error(e));
  process.exit(1);
}
console.log('\n✓ clean, no console errors');
await browser.close();
