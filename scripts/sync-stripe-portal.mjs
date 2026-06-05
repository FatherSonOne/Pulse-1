#!/usr/bin/env node
/**
 * Sync the Stripe Customer Portal's "switch plan" allowlist to the current
 * 2026 tiers (#126). DRY-RUN by default.
 *
 * The portal's subscription_update.products controls which plans a customer
 * can switch to in the billing portal. After the pricing re-structure it was
 * stale: only old Team (archived flat prices) + Growth, NO Solo — so customers
 * couldn't downgrade to Solo or switch to per-seat Team. This sets it to the
 * canonical Solo + per-seat Team + Growth prices.
 *
 * It also DISABLES the per-product quantity stepper (adjustable_quantity) on
 * every tier. Pulse seats are entirely server-derived — Solo/Growth are flat
 * plans pinned to quantity 1, and Team tracks the live workspace_members count
 * (floored at 2) via billing-sync-seats / billing-reconcile-seats. A customer-
 * editable stepper contradicts that model and is an overbilling hole: a manual
 * 1→2 bump on a flat plan is a 50% drift, which the reconciler's 20% guardrail
 * SKIPS — so the customer would stay double-billed. The portal lets customers
 * SWITCH plans, never hand-edit seat counts.
 *
 * Target config: the active/default portal config (override w/ PULSE_PORTAL_CONFIG_ID).
 * billing-checkout passes STRIPE_CUSTOMER_PORTAL_ID as the session `configuration`,
 * so update whichever id that env points at (default below is the account default).
 *
 * Run (PowerShell):
 *   node scripts/sync-stripe-portal.mjs                         # dry-run
 *   $env:APPLY='true'; node scripts/sync-stripe-portal.mjs; Remove-Item Env:APPLY
 * bash:  APPLY=true node scripts/sync-stripe-portal.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.STRIPE_SECRET_KEY) {
  try {
    for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
      const i = l.indexOf('='); if (i < 0 || l.trim().startsWith('#')) continue;
      const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if ((k === 'STRIPE_SECRET_KEY' || k === 'VITE_STRIPE_SECRET_KEY') && !process.env.STRIPE_SECRET_KEY) process.env.STRIPE_SECRET_KEY = v;
    }
  } catch { /* no .env.local */ }
}
const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY || !KEY.startsWith('sk_')) { console.error('❌ STRIPE_SECRET_KEY (sk_...) not found.'); process.exit(1); }
const APPLY = process.env.APPLY === 'true';
const MODE = KEY.startsWith('sk_test_') ? 'TEST' : 'LIVE';
const CONFIG_ID = process.env.PULSE_PORTAL_CONFIG_ID || 'bpc_1TIhx8Gb3AGXe9w8FA8SyJ8W';
console.log(`🔧 Stripe mode: ${MODE} · portal config: ${CONFIG_ID}`);
console.log(APPLY ? '⚠️  APPLY=true — this WILL update the portal config.\n' : '🧪 DRY-RUN (no changes). Set APPLY=true to write.\n');
if (APPLY && MODE === 'LIVE') { console.error('🛑 Refusing to auto-apply in LIVE. Review + run manually.'); process.exit(1); }

// Canonical 2026 tiers — product → [monthly, yearly] price ids.
// adjustableQuantity: false on every tier — seats are server-derived, the
// portal must not expose a quantity stepper (see docblock above).
const TIERS = [
  { name: 'Pulse Solo',   product: 'prod_UcSvG40DOMl4Pb', prices: ['price_1TdDzjGb3AGXe9w86fBuX5Kh', 'price_1TdDzjGb3AGXe9w8KyIZBspq'], adjustableQuantity: false },
  { name: 'Pulse Team',   product: 'prod_UVsT5yp61p6Vxo', prices: ['price_1TdEIxGb3AGXe9w8nL85q7mM', 'price_1TdEIxGb3AGXe9w8krIDmRiK'], adjustableQuantity: false },
  { name: 'Pulse Growth', product: 'prod_UVsTwrfbcAt4xv', prices: ['price_1TYGWNGb3AGXe9w8PjNHmR8L', 'price_1TYGWOGb3AGXe9w8rfCzjg4k'], adjustableQuantity: false },
];

async function stripe(method, path, form) {
  const headers = { Authorization: `Bearer ${KEY}` };
  let body;
  if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = form; }
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body });
  const d = await res.json();
  if (!res.ok) throw new Error(`Stripe ${method} ${path}: ${res.status} — ${d.error?.message || JSON.stringify(d)}`);
  return d;
}

try {
  const cfg = await stripe('GET', `/billing_portal/configurations/${CONFIG_ID}?expand[]=features.subscription_update.products`);
  console.log('Current allowlist:');
  for (const p of cfg.features?.subscription_update?.products || []) console.log(`  ${p.product}: ${(p.prices || []).join(', ')}  [stepper: ${p.adjustable_quantity?.enabled ? 'ON' : 'off'}]`);
  console.log('\nTarget allowlist:');
  for (const t of TIERS) console.log(`  ${t.name} (${t.product}): ${t.prices.join(', ')}  [stepper: ${t.adjustableQuantity ? 'ON' : 'off'}]`);
  console.log('');

  if (!APPLY) { console.log('🧪 DRY-RUN — re-run with APPLY=true to write the target allowlist.'); process.exit(0); }

  // Build the urlencoded form for the products array.
  const form = new URLSearchParams();
  form.append('features[subscription_update][enabled]', 'true');
  TIERS.forEach((t, i) => {
    form.append(`features[subscription_update][products][${i}][product]`, t.product);
    t.prices.forEach((pr, j) => form.append(`features[subscription_update][products][${i}][prices][${j}]`, pr));
    // Disable the customer-facing quantity stepper — seats are server-managed.
    form.append(`features[subscription_update][products][${i}][adjustable_quantity][enabled]`, String(t.adjustableQuantity === true));
  });
  await stripe('POST', `/billing_portal/configurations/${CONFIG_ID}`, form);
  console.log('✅ Portal config updated — customers can now switch between Solo / Team (per-seat) / Growth.');
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}
