import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 5'], storageState: 'e2e/.auth/user.json' });
const page = await ctx.newPage();
try {
  await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  const trial = page.locator('[aria-label="Trial expired"]');
  if (await trial.count()) { await trial.locator('button').first().click().catch(() => {}); await page.waitForTimeout(1200); }
  await page.locator('[aria-label="Open navigation"]').first().click();
  await page.waitForTimeout(1000);
  await page.locator('[role="dialog"][aria-label="Navigate"]').getByText('Summit', { exact: true }).first().click();
  await page.waitForTimeout(4500);

  const probe = async (tag) => page.evaluate((t) => {
    const main = document.querySelector('.pvc-main');
    const art = document.querySelector('.pvc-artifacts');
    const cs = main ? getComputedStyle(main) : null;
    const acs = art ? getComputedStyle(art) : null;
    const ar = art ? art.getBoundingClientRect() : null;
    let maxW = 0, id = '';
    document.querySelectorAll('*').forEach((n) => { if (n.scrollWidth > maxW) { maxW = n.scrollWidth; id = `${n.tagName.toLowerCase()}.${(n.className||'').toString().split(' ').filter(Boolean).slice(0,2).join('.')}`.slice(0,70); } });
    return { tag: t, mainGTC: cs?.gridTemplateColumns, artDisplay: acs?.display, artW: ar ? Math.round(ar.width) : null, artLeft: ar ? Math.round(ar.left) : null, widest: maxW, widestId: id };
  }, tag);

  // State 1: default (should be collapsed handle on the right, canvas full-width)
  await page.screenshot({ path: 'e2e/_Summit-collapsed.png' });
  console.log('COLLAPSED:', JSON.stringify(await probe('collapsed')));

  // Tap the handle to expand -> full-bleed sheet
  const handle = page.locator('.pvc-artifacts-handle');
  if (await handle.count()) {
    await handle.first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e/_Summit-expanded.png' });
    console.log('EXPANDED :', JSON.stringify(await probe('expanded')));
  } else {
    console.log('NO .pvc-artifacts-handle found (not collapsed by default?)');
  }
} catch (e) { console.log('ERR', e.message); }
await browser.close();
