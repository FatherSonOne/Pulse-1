// Headless verification for slack-messages-grounding.html.
// Mirrors _verify-messages.mjs (state-pill walk + error capture) and the
// _shoot-slack.mjs screenshot pattern.
// Run from the _design-playground/ dir:  node _verify-slack-grounding.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const file = pathToFileURL(resolve('./slack-messages-grounding.html')).href;
mkdirSync(resolve('./_shots'), { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(600); // let Tailwind CDN + Babel + fonts settle

// sanity: the app actually mounted
const mounted = await page.locator('#root .pg-bar').count();
if (!mounted) errors.push('mount-check: #root did not render the playground bar (React failed to mount)');

async function ensureTheme(target) {
  const current = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (current !== target) {
    await page.locator('.pg-bar button', { hasText: /LIGHT|DARK/ }).first().click();
    await page.waitForTimeout(150);
  }
}
async function gotoState(label) {
  await page.locator(`.pg-bar button:has-text("${label}")`).first().click();
  await page.waitForTimeout(250);
}

const shots = [
  { name: 'slack-grounding-1-coldstart-dark',  state: '1 · Cold start',           theme: 'dark'  },
  { name: 'slack-grounding-1-coldstart-light', state: '1 · Cold start',           theme: 'light' },
  { name: 'slack-grounding-2-thread-dark',     state: '2 · Slack thread',         theme: 'dark'  },
  { name: 'slack-grounding-2-thread-light',    state: '2 · Slack thread',         theme: 'light' },
  { name: 'slack-grounding-3-graduation-dark', state: '3 · Graduation',           theme: 'dark'  },
  { name: 'slack-grounding-4-composer-dark',   state: '4 · Composer + identity',  theme: 'dark'  },
];

for (const s of shots) {
  await ensureTheme(s.theme);
  await gotoState(s.state);
  await page.screenshot({ path: `_shots/${s.name}.png`, fullPage: false });
  console.log(`OK  ${s.name}`);
}

// Graduation interaction — confirm the flip renders the native (flipped) state.
await ensureTheme('dark');
await gotoState('3 · Graduation');
await page.locator('main button:has-text("Switch to native")').first().click();
await page.waitForTimeout(350);
const flipped = await page.locator('main:has-text("NOW ON PULSE")').count();
if (!flipped) errors.push('graduation-check: clicking "Switch to native" did not surface the flipped/native state');
await page.screenshot({ path: '_shots/slack-grounding-3-graduation-flipped-dark.png', fullPage: false });
console.log('OK  slack-grounding-3-graduation-flipped-dark');

// Composer detail — click Send, assert the terminal "Sent to Slack" state appears.
await gotoState('4 · Composer + identity');
await page.locator('main button:has-text("Send")').first().click();
await page.waitForTimeout(300);
const sent = await page.locator('main:has-text("Sent to Slack · as you")').count();
if (!sent) errors.push('composer-check: clicking Send did not surface the "Sent to Slack" terminal state');
await page.screenshot({ path: '_shots/slack-grounding-4-composer-sent-dark.png', fullPage: false });
console.log('OK  slack-grounding-4-composer-sent-dark');

// Guardrail: assert NO coral is used anywhere (coral is AI-only; this feature has no AI).
// We scan computed styles for the coral foreground token's resolved value vs. plum/rose.
const coralLeak = await page.evaluate(() => {
  const coralFg = getComputedStyle(document.documentElement).getPropertyValue('--pulse-coral-fg').trim();
  // The coral-bg utility classes from the redesign shell must not be present in markup.
  const banned = document.querySelectorAll('.pulse-coral-fg-color, .pulse-coral-bg-color');
  return { coralFg, bannedCount: banned.length };
});
if (coralLeak.bannedCount > 0) {
  errors.push(`coral-guardrail: found ${coralLeak.bannedCount} element(s) using coral utility classes (coral is AI-only; none allowed here)`);
}
console.log(`coral guardrail: ${coralLeak.bannedCount} coral-class elements (expected 0)`);

if (errors.length) {
  console.log('\n--- ERRORS ---');
  errors.forEach(e => console.log(e));
  console.log(`\nRESULT: FAIL (${errors.length} issue(s))`);
  process.exitCode = 1;
} else {
  console.log('\nRESULT: PASS — no console/page errors, all interaction checks passed');
}
await browser.close();
