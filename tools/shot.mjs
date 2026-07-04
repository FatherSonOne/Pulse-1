#!/usr/bin/env node
/**
 * shot.mjs — brace-safe headless screenshot tool for this box.
 *
 * WHY THIS EXISTS: the Windows username on this machine is `Aegis{FM}`.
 * The `{` `}` break the temp-profile paths that Puppeteer / chrome-launcher
 * (Lighthouse) construct, so those tools fail to launch Chrome here.
 * Playwright's bundled Chromium resolves its temp dir differently and is
 * IMMUNE to the bug — so we drive it directly. Verified working 2026-07-04.
 *
 * Playwright is installed in f:\pulse1, so run this from there (or via the
 * absolute path below) — Node resolves `playwright` from pulse1's node_modules.
 *
 * USAGE:
 *   node f:/pulse1/tools/shot.mjs <url-or-file> [outPath] [--w=1440] [--h=900] [--no-full] [--wait=load]
 *
 * EXAMPLES:
 *   node f:/pulse1/tools/shot.mjs https://qntmecos.com C:/ClaudeChrome/home.png
 *   node f:/pulse1/tools/shot.mjs "f:/entomate/playground/x.html" C:/ClaudeChrome/x.png --w=390 --h=844
 *   node f:/pulse1/tools/shot.mjs http://localhost:5173 C:/ClaudeChrome/dev.png --no-full --wait=networkidle
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const positional = argv.filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(
  argv.filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

let target = positional[0];
if (!target) {
  console.error('Usage: node shot.mjs <url-or-file> [out.png] [--w=] [--h=] [--no-full] [--wait=]');
  process.exit(1);
}
// Local file path -> file:// URL
if (!/^https?:\/\//i.test(target) && !/^file:/i.test(target)) {
  if (!existsSync(target)) { console.error('File not found:', target); process.exit(1); }
  target = pathToFileURL(target).href;
}

const out = positional[1] || 'C:/ClaudeChrome/shot.png';
const width = parseInt(flags.w, 10) || 1440;
const height = parseInt(flags.h, 10) || 900;
const fullPage = flags['no-full'] ? false : true;
const waitUntil = flags.wait || 'load';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(target, { waitUntil, timeout: 45000 }).catch(e => console.error('goto warning:', e.message));
  await page.waitForTimeout(600); // let fonts/animations settle
  await page.screenshot({ path: out, fullPage });
  console.log('OK ->', out, `(${width}x${height}, fullPage=${fullPage})`);
} finally {
  await browser.close();
}
