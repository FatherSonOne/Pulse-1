import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 5'], storageState: 'e2e/.auth/user.json' });
const page = await ctx.newPage();
const log = (...a) => console.log(...a);

try {
  await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  await page.locator('[aria-label="Open navigation"]').first().click();
  await page.waitForTimeout(1000);
  await page.locator('[role="dialog"][aria-label="Navigate"]').getByText('Contacts', { exact: true }).first().click();
  await page.waitForTimeout(3000);
  const people = page.locator('button:visible:has-text("People")').first();
  if (await people.count()) { await people.click().catch(() => {}); await page.waitForTimeout(2000); }

  // 1) Co-pilot toggle -> sheet
  const fab = page.locator('[aria-label="Open Pulse AI co-pilot"]');
  log('FAB count:', await fab.count());
  if (await fab.count()) {
    await fab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/_contacts-copilot.png' });
    log('copilot sheet saved');
    await page.locator('[aria-label="Close"]').first().click().catch(() => {});
    await page.waitForTimeout(800);
  }

  // 2) Select a contact -> Focus full-width + back (master-detail)
  const contact = page.locator('text=Frankie').first();
  if (await contact.count()) {
    await contact.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'e2e/_contacts-focus.png' });
    const back = page.locator('button:has-text("Contacts")');
    log('focus saved; back-button present:', await back.count() > 0);
  }
} catch (e) {
  log('ERR', e.message);
}
await browser.close();
