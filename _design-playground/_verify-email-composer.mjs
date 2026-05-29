import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdir } from 'fs/promises';

const file = pathToFileURL(resolve('./email-composer-redesign.html')).href;
await mkdir('./_shots', { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('pageerror',  e => errors.push(`pageerror: ${e.message}`));
page.on('console',    m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
page.on('requestfailed', r => {
  // Ignore CDN noise from Tailwind play
  if (r.url().includes('tailwindcss.com')) return;
  errors.push(`reqfail: ${r.url()} — ${r.failure()?.errorText}`);
});

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);

async function setTheme(t) {
  await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), t);
}
async function selectPath(letter) {
  await page.locator(`button:has-text("${letter} · ")`).first().click();
  await page.waitForTimeout(280);
}
async function shot(name) {
  await page.screenshot({ path: `_shots/composer-${name}.png`, fullPage: false });
  console.log('shot:', name);
}

const shots = [
  { name: '01-A-focal-dark',         path: 'A', theme: 'dark'  },
  { name: '02-A-focal-light',        path: 'A', theme: 'light' },
  { name: '03-B-inline-dark',        path: 'B', theme: 'dark'  },
  { name: '04-B-inline-light',       path: 'B', theme: 'light' },
  { name: '05-C-sidecar-dark',       path: 'C', theme: 'dark'  },
  { name: '06-C-sidecar-light',      path: 'C', theme: 'light' },
];

for (const s of shots) {
  await selectPath(s.path);
  await setTheme(s.theme);
  await page.waitForTimeout(220);
  await shot(s.name);
}

if (errors.length) {
  console.error('\n=== ERRORS ===');
  errors.forEach(e => console.error(e));
  await browser.close();
  process.exit(1);
}
console.log('\n✓ clean, no errors');
await browser.close();
