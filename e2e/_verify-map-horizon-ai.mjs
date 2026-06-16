// Deterministic verification of the Direction D (P4) AI affordances via the
// dev-only MapTestHarness (mode=ai) — no auth, no live model, no real data.
// Confirms the NEXT-STOP framing (horizon='now') + the focusDate/focusId
// affordances render AND their handlers fire.
//   TARGET=http://localhost:5173 node e2e/_verify-map-horizon-ai.mjs
import { chromium, devices } from '@playwright/test';

const TARGET = process.env.TARGET || 'http://localhost:5173';
const APP_VERSION = '28.2.0';
const log = (...a) => console.log(...a);
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); log(`${ok ? 'PASS' : 'FAIL'} · ${name}${extra ? ' · ' + extra : ''}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
// Pre-seed the anti-cache keys so index.html doesn't redirect to ?nocache= and
// strip the harness query string.
await ctx.addInitScript((v) => {
  try {
    localStorage.setItem('pulse_app_version', v);
    localStorage.setItem(`pulse_cache_cleared_${v}`, 'true');
  } catch { /* private mode */ }
}, APP_VERSION);
const page = await ctx.newPage();
page.on('pageerror', e => log('PAGEERROR:', e.message));

try {
  await page.goto(`${TARGET}/?e2eHarness=map&mode=ai`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('heading', { name: /Map test harness/i }).waitFor({ timeout: 12000 });
  await page.waitForTimeout(800);

  // P4 — NEXT-STOP framing at the 'now' detent (vs the generic ROUTE label).
  check('route strip framed "PULSE AI · NEXT STOP" at horizon=now',
    (await page.getByText('PULSE AI · NEXT STOP').count()) > 0);

  // P4 — plan strip surfaces the (formerly dead) focusDate as a date chip.
  const planChip = page.locator('[data-testid="ai-plan-focusdate"] button').first();
  check('plan strip renders a focusDate chip', (await planChip.count()) > 0);

  // P4 — insight strip surfaces the (formerly dead) focusId as a Focus button.
  const focusBtn = page.locator('[data-testid="ai-insight-focusid"]').getByRole('button', { name: /Focus/ }).first();
  check('insight strip renders a "Focus" button', (await focusBtn.count()) > 0);

  await page.screenshot({ path: 'e2e/_map-horizon-ai.png', fullPage: false });

  // Handlers fire — click the chip, then the Focus button, asserting the result.
  if (await planChip.count()) {
    await planChip.click().catch(() => {});
    await page.waitForTimeout(300);
    const r = await page.locator('[data-testid="ai-affordance-result"]').textContent().catch(() => '');
    check('focusDate chip fires onJumpToDate', (r || '').includes('jump:2026-06-17'), r || '(no result)');
  }
  if (await focusBtn.count()) {
    await focusBtn.click().catch(() => {});
    await page.waitForTimeout(300);
    const r = await page.locator('[data-testid="ai-affordance-result"]').textContent().catch(() => '');
    check('focusId button fires onFocusEntity', (r || '').includes('focus:c3'), r || '(no result)');
  }
} catch (e) {
  log('ERR', e.message);
  await page.screenshot({ path: 'e2e/_map-horizon-ai-error.png' }).catch(() => {});
}

log(`\nSUMMARY: ${results.filter(Boolean).length}/${results.length} checks passed`);
await browser.close();
process.exit(0);
