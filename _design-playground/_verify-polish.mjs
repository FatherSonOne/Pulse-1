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

// Measure whether any .filter-seg overflows its column (would mean horizontal scroll)
const filterOverflow = () => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.filter-seg').forEach(el => out.push(el.scrollWidth - el.clientWidth));
  return out;
});

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(900); // let spine + msg-in animations settle

await page.screenshot({ path: '_shots/msg-13-D-polished.png' });
console.log('✓ msg-13-D-polished');
console.log('D filter overflow px (≤0 = no scroll):', JSON.stringify(await filterOverflow()));

for (const f of ['Unread', 'Pinned', 'Tasks', 'Decisions', 'All']) {
  await page.locator(`.filter-btn[title="${f}"]`).first().click();
  await page.waitForTimeout(110);
}
await page.locator('.filter-btn[title="Unread"]').first().click();
await page.waitForTimeout(260);
await page.screenshot({ path: '_shots/msg-14-D-filter-unread.png' });
console.log('✓ msg-14-D-filter-unread');
await page.locator('.filter-btn[title="All"]').first().click();
await page.waitForTimeout(200);

// AI summary loading skeleton (capture fast, <1100ms)
await page.locator('main button:has-text("Summary")').first().click();
await page.waitForTimeout(220);
const skeletonVisible = await page.locator('.skeleton').first().isVisible().catch(() => false);
console.log('summary skeleton visible:', skeletonVisible);
await page.screenshot({ path: '_shots/msg-15-D-summary-loading.png' });
console.log('✓ msg-15-D-summary-loading');
await page.waitForTimeout(1100);
const doneVisible = await page.locator('text=Summarized from 48 messages').isVisible().catch(() => false);
console.log('summary done visible:', doneVisible);
await page.screenshot({ path: '_shots/msg-16-D-summary-done.png' });
console.log('✓ msg-16-D-summary-done');
await page.locator('main button:has-text("Summary")').first().click();

// Open-items empty state — check both checkboxes
const checks = await page.locator('button[title="Mark done"]').count();
console.log('open-item checkboxes:', checks);
for (let i = 0; i < checks; i++) {
  await page.locator('button[title="Mark done"]').first().click();
  await page.waitForTimeout(150);
}
const allClear = await page.locator('text=All clear').isVisible().catch(() => false);
console.log('open-items empty state visible:', allClear);
await page.screenshot({ path: '_shots/msg-17-D-openitems-empty.png' });
console.log('✓ msg-17-D-openitems-empty');

// A & B filter bars also fit (light)
await page.locator('.pg-bar button', { hasText: /LIGHT|DARK/ }).first().click();
await page.waitForTimeout(150);
await page.locator('.pg-bar button:has-text("A ·")').first().click();
await page.waitForTimeout(250);
await page.screenshot({ path: '_shots/msg-18-A-light-filters.png' });
console.log('A filter overflow px:', JSON.stringify(await filterOverflow()));
await page.locator('.pg-bar button:has-text("B ·")').first().click();
await page.waitForTimeout(250);
console.log('B filter overflow px:', JSON.stringify(await filterOverflow()));

console.log(errors.length ? '\n--- errors ---\n' + errors.join('\n') : '\nno console/page errors');
await browser.close();
