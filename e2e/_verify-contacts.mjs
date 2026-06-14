import { chromium, devices } from '@playwright/test';

const TARGET = process.env.TARGET || 'http://localhost:5174';
const OUT = process.env.OUT || 'e2e/_contacts-before.png';
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 5'], storageState: 'e2e/.auth/user.json' });
const page = await ctx.newPage();

try {
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000); // auth handshake + app render

  const hasNav = await page.locator('[aria-label="Open navigation"]').count();
  const hasCmd = await page.locator('text=Run a command').count();
  const bodyStart = (await page.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ').slice(0, 160);
  log('hasNav:', hasNav, '| hasCmd:', hasCmd);
  log('BODY:', bodyStart);

  if (!hasNav && !hasCmd) {
    log('NOT AUTHED — likely the login page.');
    await page.screenshot({ path: OUT });
    await browser.close();
    process.exit(2);
  }

  // Navigate to Contacts via the bottom nav SHEET (scope to the dialog so we
  // don't match the now-hidden sidebar nav item).
  await page.locator('[aria-label="Open navigation"]').first().click();
  await page.waitForTimeout(1200);
  const sheet = page.locator('[role="dialog"][aria-label="Navigate"]');
  await sheet.waitFor({ state: 'visible', timeout: 5000 }).catch(() => log('nav sheet not visible'));
  const contactsLink = sheet.getByText('Contacts', { exact: true }).first();
  if (await contactsLink.count()) {
    await contactsLink.click({ timeout: 6000 }).catch((e) => log('contacts click failed:', e.message));
  } else {
    log('Contacts not in sheet. SHEET TEXT:', (await sheet.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300));
  }
  await page.waitForTimeout(3500);

  // Ensure the People tab (the overflowing 3-pane), if not already there.
  const peopleTab = page.locator('button:visible:has-text("People")').first();
  if (await peopleTab.count()) { await peopleTab.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500); }

  await page.screenshot({ path: OUT });
  log('SCREENSHOT:', OUT);

  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return { scrollW: el.scrollWidth, clientW: el.clientWidth, overflowX: el.scrollWidth > el.clientWidth };
  });
  log('OVERFLOW:', JSON.stringify(overflow));
} catch (e) {
  log('ERROR:', e.message);
  await page.screenshot({ path: OUT }).catch(() => {});
}
await browser.close();
