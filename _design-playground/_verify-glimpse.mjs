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
await page.waitForTimeout(500);

const PATHS = { A: 'A · Triage Cockpit', B: 'B · Reel Wall', C: 'C · Daily Briefing' };
const SUBS = ['Inbox', 'Thread', 'Record', 'Search', 'Elements'];

async function ensureTheme(target) {
  const current = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (current !== target) {
    await page.locator('.pg-bar button', { hasText: /LIGHT|DARK/ }).first().click();
    await page.waitForTimeout(150);
  }
}
async function setPath(p) {
  await page.locator(`.pg-pill:has-text("${PATHS[p]}")`).first().click();
  await page.waitForTimeout(150);
}
async function setSub(label) {
  await page.locator('main').locator('header, div').locator(`button:has-text("${label}")`).first().click().catch(async () => {
    await page.locator(`main button:has-text("${label}")`).first().click();
  });
  await page.waitForTimeout(220);
}

let n = 0;
const pad = () => String(++n).padStart(2, '0');

// Full matrix: each path × each subsection (dark), plus light inbox/elements per path.
for (const p of ['A', 'B', 'C']) {
  await ensureTheme('dark');
  await setPath(p);
  for (const s of SUBS) {
    await setSub(s);
    await page.screenshot({ path: `_shots/gl-${pad()}-${p}-${s.toLowerCase()}-dark.png` });
    console.log(`✓ ${p} ${s} dark`);
  }
  // light inbox
  await setSub('Inbox');
  await ensureTheme('light');
  await page.screenshot({ path: `_shots/gl-${pad()}-${p}-inbox-light.png` });
  console.log(`✓ ${p} Inbox light`);
}

// Record interactive: click the record button to reach recording + ready states (Path A).
await ensureTheme('dark');
await setPath('A');
await setSub('Record');
// open recipient picker
await page.locator('main button:has-text("selected")').first().click().catch(() => {});
await page.waitForTimeout(200);
await page.screenshot({ path: `_shots/gl-${pad()}-A-record-recipients.png` });
console.log('✓ A Record recipient picker');

if (errors.length) {
  console.log('\n--- ERRORS ---');
  errors.forEach(e => console.log(e));
  process.exitCode = 1;
} else {
  console.log('\nNo console/page errors ✓');
}
await browser.close();
