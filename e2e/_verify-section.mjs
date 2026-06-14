import { chromium, devices } from '@playwright/test';

const SECTION = process.env.SECTION || 'Search';
const OUT = process.env.OUT || 'e2e/_section.png';
const TARGET = process.env.TARGET || 'http://localhost:5174';
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 5'], storageState: 'e2e/.auth/user.json' });
const page = await ctx.newPage();

try {
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  // Dismiss the trial-expired paywall if it's blocking (this account's trial ended).
  const trial = page.locator('[aria-label="Trial expired"]');
  if (await trial.count()) {
    log('trial paywall present — dismissing via X');
    await trial.locator('button').first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  await page.locator('[aria-label="Open navigation"]').first().click();
  await page.waitForTimeout(1000);
  await page.locator('[role="dialog"][aria-label="Navigate"]').getByText(SECTION, { exact: true }).first().click();
  await page.waitForTimeout(4500);
  await page.screenshot({ path: OUT });
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    let maxW = 0, el = null;
    document.querySelectorAll('*').forEach((n) => { if (n.scrollWidth > maxW) { maxW = n.scrollWidth; el = n; } });
    const id = el ? `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean).slice(0, 3).join('.')}`.slice(0, 90) : '';
    return { docScrollW: root.scrollWidth, docClientW: root.clientWidth, widestEl: maxW, widestId: id };
  });
  log('SECTION:', SECTION, '| OUT:', OUT, '| OVERFLOW:', JSON.stringify(overflow));
} catch (e) {
  log('ERR', e.message);
  await page.screenshot({ path: OUT }).catch(() => {});
}
await browser.close();
