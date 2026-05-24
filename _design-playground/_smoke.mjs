// Phase 1 smoke check — boot the dev server (already running), load the app,
// confirm no console errors / page errors, capture whatever renders.
// Does NOT log in; just verifies the bundle compiles and the app shell
// mounts without crashing.

import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: '_shots/40-app-boot.png', fullPage: false });
console.log('✓ app boots, screenshot captured');

// Filter known-noise errors that pre-date this change.
const noise = [
  /favicon/i,
  /Manifest:/i,
  /supabase.*Failed to fetch/i,
  /WebSocket.*failed/i,
];
const real = errors.filter(e => !noise.some(rx => rx.test(e)));

if (real.length) {
  console.log('\n--- real errors ---');
  real.forEach(e => console.log(e));
  process.exitCode = 1;
} else {
  console.log('\nno real console / page errors');
}

if (errors.length !== real.length) {
  console.log(`\n(${errors.length - real.length} noisy errors filtered)`);
}

await browser.close();
