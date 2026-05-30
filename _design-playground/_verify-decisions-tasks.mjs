import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./decisions-tasks-redesign.html')).href;
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
async function selectView(view) {
  // force:true — when the Create overlay is open its backdrop intercepts pointer
  // events; we still want to drive the pill (it toggles the underlying view).
  await page.locator(`button[data-view="${view}"]`).first().click({ force: true });
  await page.waitForTimeout(350);
}
async function shot(name) {
  await page.screenshot({ path: `_shots/decisions-tasks-${name}.png`, fullPage: false });
  console.log('shot:', name);
}

const shots = [
  { name: '01-triage-dark',  view: 'triage',  theme: 'dark'  },
  { name: '02-triage-light', view: 'triage',  theme: 'light' },
  { name: '03-archive-dark', view: 'archive', theme: 'dark'  },
  { name: '04-archive-light',view: 'archive', theme: 'light' },
  { name: '05-create-dark',  view: 'create',  theme: 'dark'  },
  { name: '06-create-light', view: 'create',  theme: 'light' },
  { name: '07-empty-dark',   view: 'empty',   theme: 'dark'  },
  { name: '08-empty-light',  view: 'empty',   theme: 'light' },
];

for (const s of shots) {
  await setTheme(s.theme);
  await selectView(s.view);
  await shot(s.name);
}

// hover quick-actions on a queue row
await setTheme('dark');
await selectView('triage');
await page.getByText('Analytics vendor — PostHog vs Amplitude').first().hover();
await page.waitForTimeout(300);
await shot('09-triage-hover-dark');

if (errors.length) {
  console.error('\n=== ERRORS ===');
  errors.forEach(e => console.error(e));
  await browser.close();
  process.exit(1);
}
console.log('\n✓ clean, no console errors');
await browser.close();
