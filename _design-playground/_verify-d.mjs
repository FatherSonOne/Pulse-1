import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
const file = pathToFileURL(resolve('./messages-redesign.html')).href;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(400);
// default is D dark
await page.screenshot({ path: '_shots/msg-09-D-dark.png' });
console.log('✓ msg-09-D-dark');
// open slash palette
await page.locator('main button[title="Slash commands"]').first().click();
await page.waitForTimeout(250);
await page.screenshot({ path: '_shots/msg-10-D-slash.png' });
console.log('✓ msg-10-D-slash');
// light
await page.locator('.pg-bar button', { hasText: /LIGHT|DARK/ }).first().click();
await page.waitForTimeout(250);
await page.screenshot({ path: '_shots/msg-11-D-light.png' });
console.log('✓ msg-11-D-light');
console.log(errors.length ? '\n--- errors ---\n' + errors.join('\n') : '\nno console/page errors');
await browser.close();
