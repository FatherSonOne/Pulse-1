import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./search-redesign.html')).href;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(700);

async function setTheme(t) { await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), t); }
async function selectPath(letter) {
  await page.locator(`button:has-text("${letter} · ")`).first().click().catch(async () => {
    await page.locator('.pg-pill', { hasText: letter }).first().click();
  });
  await page.waitForTimeout(320);
}
async function shot(name) {
  await page.screenshot({ path: `_shots/search-${name}.png`, fullPage: false });
  console.log('shot:', name);
}

// pg-pill text is "A Command Bar" etc — select by label
async function pick(label) {
  await page.locator('.pg-pill', { hasText: label }).first().click();
  await page.waitForTimeout(340);
}

const shots = [
  { name: '01-A-dark',  pick: 'Command Bar',  theme: 'dark'  },
  { name: '02-A-light', pick: 'Command Bar',  theme: 'light' },
  { name: '03-B-dark',  pick: 'Workbench',    theme: 'dark'  },
  { name: '04-B-light', pick: 'Workbench',    theme: 'light' },
  { name: '05-C-dark',  pick: 'Answer-First', theme: 'dark'  },
  { name: '06-C-light', pick: 'Answer-First', theme: 'light' },
];

for (const s of shots) {
  await setTheme(s.theme);
  await pick(s.pick);
  await shot(s.name);
}

// interaction spot-checks (dark)
await setTheme('dark');
await pick('Workbench');
await page.locator('main .grid > div').filter({ hasText: 'roadmap' }).first().click().catch(()=>{});
await page.waitForTimeout(250);
await shot('07-B-selected');

await pick('Command Bar');
const input = page.locator('input[placeholder="Search everything…"]');
await input.fill('');
await page.waitForTimeout(250);
await shot('08-A-empty-resume');

if (errors.length) {
  console.error('\n=== ERRORS ==='); errors.forEach(e => console.error(e));
  process.exit(1);
}
console.log('\n✓ verify-search clean, no errors');
await browser.close();
