import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./warroom-redesign.html')).href;
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
  await page.locator(`button:has-text("${letter} · ")`).first().click();
  await page.waitForTimeout(320);
}
async function shot(name) {
  await page.screenshot({ path: `_shots/warroom-${name}.png`, fullPage: false });
  console.log('shot:', name);
}
async function clickFirst(selector) {
  const el = page.locator(selector).first();
  if (await el.count()) { await el.click(); await page.waitForTimeout(280); return true; }
  return false;
}

const base = [
  { name: '01-A-dark',  path: 'A', theme: 'dark'  },
  { name: '02-A-light', path: 'A', theme: 'light' },
  { name: '03-B-dark',  path: 'B', theme: 'dark'  },
  { name: '04-B-light', path: 'B', theme: 'light' },
  { name: '05-C-dark',  path: 'C', theme: 'dark'  },
  { name: '06-C-light', path: 'C', theme: 'light' },
];
for (const s of base) { await setTheme(s.theme); await selectPath(s.path); await shot(s.name); }

// A — interactions: open voice dock, open a citation, expand reasoning
await setTheme('dark'); await selectPath('A');
await clickFirst('button[data-voice]');
await shot('07-A-voice-dock');
await clickFirst('button[data-voice]'); // close
await clickFirst('button:has-text("THOUGHT FOR")');
await shot('08-A-reasoning-open');
await clickFirst('.cite');
await shot('09-A-citation-popover');
await clickFirst('button:has-text("Open source")'); // closes via backdrop? click popover button (no-op) — then esc
await page.keyboard.press('Escape');

// B — open command palette via ⌘K
await selectPath('B');
await page.keyboard.press('Meta+K');
await page.waitForTimeout(300);
await shot('10-B-cmdk-palette');
await page.keyboard.press('Escape');

// C — cycle voice state
await selectPath('C');
await clickFirst('button:has(svg) >> nth=0'); // harmless
await shot('11-C-voice-stage');

if (errors.length) {
  console.error('\n=== ERRORS ==='); errors.forEach(e => console.error(e));
  process.exit(1);
}
console.log('\n✓ verify-warroom clean, no errors');
await browser.close();
