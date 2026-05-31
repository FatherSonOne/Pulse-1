#!/usr/bin/env node
/**
 * Stripe setup for the 2026 Pulse pricing re-structure (#119 decision).
 *
 * Creates / ensures:
 *   - Product:  "Pulse Solo"  (NEW — the Lane-A solo-operator hero tier)
 *       · Monthly price: $20/mo   (30-day trial)
 *       · Yearly  price: $200/yr  (10 months for 12 — matches the existing annual discount)
 *   - Per-seat prices on the EXISTING "Pulse Team" product (reframe from $100 flat):
 *       · Monthly per-seat: $18/seat/mo  (30-day trial)
 *       · Yearly  per-seat: $180/seat/yr (10 months for 12)
 *     Stripe per-seat = a normal licensed recurring price (unit_amount per seat);
 *     the *quantity* (seat count) is set by checkout + kept in sync by the
 *     existing billing-sync-seats / billing-reconcile-seats edge functions.
 *
 * Pulse Growth is UNCHANGED ($300/mo) — not touched here.
 *
 * Does NOT archive the old $100 flat Team price by default (so existing subs
 * keep billing). Pass ARCHIVE_OLD_TEAM_FLAT=true once all Team subs are
 * migrated to the per-seat price.
 *
 * Idempotent-ish: re-running creates NEW prices (Stripe prices are immutable),
 * so run ONCE per environment and paste the printed IDs into the migration.
 * The Solo product is matched by metadata.plan_id to avoid duplicate products.
 *
 * Run:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-pulse-pricing-2026.mjs
 *   # override the seat price (within the decided $15-20 band):
 *   PULSE_TEAM_SEAT_AMOUNT=1500 STRIPE_SECRET_KEY=sk_test_... node scripts/setup-pulse-pricing-2026.mjs
 *   # point at a different Team product if the id changed:
 *   PULSE_TEAM_PRODUCT_ID=prod_xxx STRIPE_SECRET_KEY=sk_test_... node scripts/setup-pulse-pricing-2026.mjs
 *
 * After running: paste the printed IDs into the new plans migration
 * (pulse_solo plan row + pulse_team per-seat price ids). See the #pricing
 * implementation issue for the full chain.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── Load .env.local if STRIPE_SECRET_KEY isn't already set ─────────
const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.STRIPE_SECRET_KEY) {
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (k === 'STRIPE_SECRET_KEY' && !process.env.STRIPE_SECRET_KEY) process.env.STRIPE_SECRET_KEY = v;
      if (k === 'VITE_STRIPE_SECRET_KEY' && !process.env.STRIPE_SECRET_KEY) {
        process.env.STRIPE_SECRET_KEY = v;
        console.warn('⚠️  Found VITE_STRIPE_SECRET_KEY in .env.local — the VITE_ prefix exposes it to the browser bundle. Rename to STRIPE_SECRET_KEY.');
        console.warn('');
      }
    }
  } catch { /* no .env.local — fine */ }
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not set. Add it to .env.local (no VITE_ prefix) or pass inline.');
  console.error('   Get it from: https://dashboard.stripe.com/test/apikeys');
  process.exit(1);
}
if (!STRIPE_SECRET_KEY.startsWith('sk_')) {
  console.error('❌ STRIPE_SECRET_KEY must start with "sk_" (you may have pasted the pk_ publishable key).');
  process.exit(1);
}

const isTestMode = STRIPE_SECRET_KEY.startsWith('sk_test_');
console.log(`🔧 Stripe mode: ${isTestMode ? 'TEST' : 'LIVE'}`);
console.log(`🔧 Key prefix:  ${STRIPE_SECRET_KEY.slice(0, 12)}...`);
if (!isTestMode) console.log('⚠️  LIVE mode — this creates REAL products/prices.');
console.log('');

// Decided amounts (cents). Seat amount overridable within the $15-20 band.
const SOLO_MONTHLY = Number(process.env.PULSE_SOLO_MONTHLY_AMOUNT ?? 2000);   // $20/mo
const SOLO_YEARLY  = Number(process.env.PULSE_SOLO_YEARLY_AMOUNT  ?? 20000);  // $200/yr (10-for-12)
const SEAT_MONTHLY = Number(process.env.PULSE_TEAM_SEAT_AMOUNT    ?? 1800);   // $18/seat/mo
const SEAT_YEARLY  = Number(process.env.PULSE_TEAM_SEAT_YEARLY    ?? 18000);  // $180/seat/yr (10-for-12)
// Known active Pulse Team product (memory: stripe-configuration-price-ids, 2026-05-17).
const TEAM_PRODUCT_ID = process.env.PULSE_TEAM_PRODUCT_ID ?? 'prod_UVsT5yp61p6Vxo';
const TRIAL_DAYS = 30;

// ── Stripe REST helper (no SDK dep, matches the other setup scripts) ──
async function stripe(method, path, body) {
  const headers = {
    'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  let formBody;
  if (body) {
    const params = new URLSearchParams();
    const append = (key, val) => {
      if (val === null || val === undefined) return;
      if (typeof val === 'object') {
        for (const [k, v] of Object.entries(val)) append(`${key}[${k}]`, v);
      } else {
        params.append(key, String(val));
      }
    };
    for (const [k, v] of Object.entries(body)) append(k, v);
    formBody = params.toString();
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body: formBody });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path} failed: ${res.status} — ${data.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

// ── Find-or-create the Pulse Solo product (matched by metadata.plan_id) ──
async function ensureSoloProduct() {
  console.log('🔎 Looking for an existing Pulse Solo product...');
  const existing = await stripe('GET', '/products?active=true&limit=100');
  const found = (existing.data || []).find(p => p.metadata?.plan_id === 'pulse_solo');
  if (found) {
    console.log(`   ↩︎  Reusing existing Pulse Solo product: ${found.id}`);
    return found;
  }
  console.log('📦 Creating Pulse Solo product...');
  const product = await stripe('POST', '/products', {
    name: 'Pulse Solo',
    description: 'Cross-surface AI for the solo operator — one screen for every work conversation, with AI that summarizes, drafts, and triages over one data model. 1 seat.',
    metadata: { plan_id: 'pulse_solo' },
  });
  console.log(`   ✅ Product created: ${product.id}`);
  return product;
}

async function createPrice({ product, amount, interval, plan_id, cycle, nickname, perSeat }) {
  const body = {
    product,
    currency: 'usd',
    unit_amount: amount,
    recurring: { interval, interval_count: 1, trial_period_days: TRIAL_DAYS },
    metadata: { plan_id, cycle, ...(perSeat ? { per_seat: 'true' } : {}) },
    nickname,
  };
  const price = await stripe('POST', '/prices', body);
  console.log(`   ✅ ${nickname}: ${price.id}`);
  return price;
}

// ── Main ────────────────────────────────────────────────────────────
try {
  // 1) Pulse Solo (new tier)
  const soloProduct = await ensureSoloProduct();
  console.log('💰 Creating Pulse Solo prices...');
  const soloMonthly = await createPrice({
    product: soloProduct.id, amount: SOLO_MONTHLY, interval: 'month',
    plan_id: 'pulse_solo', cycle: 'monthly', nickname: 'Pulse Solo Monthly',
  });
  const soloYearly = await createPrice({
    product: soloProduct.id, amount: SOLO_YEARLY, interval: 'year',
    plan_id: 'pulse_solo', cycle: 'yearly', nickname: 'Pulse Solo Yearly',
  });

  // 2) Per-seat prices on the existing Pulse Team product
  console.log(`\n🔎 Verifying Pulse Team product ${TEAM_PRODUCT_ID}...`);
  const teamProduct = await stripe('GET', `/products/${TEAM_PRODUCT_ID}`);
  console.log(`   ✅ Found: ${teamProduct.name} (${teamProduct.id})`);
  console.log('💰 Creating Pulse Team PER-SEAT prices...');
  const seatMonthly = await createPrice({
    product: teamProduct.id, amount: SEAT_MONTHLY, interval: 'month',
    plan_id: 'pulse_team', cycle: 'monthly', perSeat: true,
    nickname: `Pulse Team Per-Seat Monthly ($${(SEAT_MONTHLY / 100).toFixed(0)}/seat)`,
  });
  const seatYearly = await createPrice({
    product: teamProduct.id, amount: SEAT_YEARLY, interval: 'year',
    plan_id: 'pulse_team', cycle: 'yearly', perSeat: true,
    nickname: `Pulse Team Per-Seat Yearly ($${(SEAT_YEARLY / 100).toFixed(0)}/seat)`,
  });

  // 3) Optionally archive the old $100 flat Team price (only when migrated)
  if (process.env.ARCHIVE_OLD_TEAM_FLAT === 'true' && process.env.OLD_TEAM_FLAT_PRICE_ID) {
    console.log(`\n📦 Archiving old flat Team price ${process.env.OLD_TEAM_FLAT_PRICE_ID}...`);
    await stripe('POST', `/prices/${process.env.OLD_TEAM_FLAT_PRICE_ID}`, { active: false });
    console.log('   ✅ Archived.');
  } else {
    console.log('\n⏭️  Left the old $100 flat Team price ACTIVE (existing subs keep billing).');
    console.log('   Once all Team subs are on per-seat, archive it with:');
    console.log('   ARCHIVE_OLD_TEAM_FLAT=true OLD_TEAM_FLAT_PRICE_ID=price_xxx node scripts/setup-pulse-pricing-2026.mjs');
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log('✅ Done. Paste these into the new plans migration:');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Pulse Solo product:        ${soloProduct.id}`);
  console.log(`  Solo monthly ($20):        ${soloMonthly.id}`);
  console.log(`  Solo yearly  ($200):       ${soloYearly.id}`);
  console.log(`  Team per-seat monthly:     ${seatMonthly.id}   ($${(SEAT_MONTHLY / 100).toFixed(0)}/seat)`);
  console.log(`  Team per-seat yearly:      ${seatYearly.id}   ($${(SEAT_YEARLY / 100).toFixed(0)}/seat)`);
  console.log('══════════════════════════════════════════════════════\n');
  console.log('Next: add a pulse_solo plan row + repoint pulse_team at the per-seat');
  console.log('price in a plans migration, set Solo entitlement caps, and update');
  console.log('billing-checkout to pass quantity=member_count for the per-seat Team');
  console.log('price (Solo stays quantity=1). See the pricing-implementation issue.\n');
} catch (e) {
  console.error('\n❌ Setup failed:', e.message);
  if (/No such product/.test(e.message)) {
    console.error('   The Pulse Team product id may have changed. Pass the right one:');
    console.error('   PULSE_TEAM_PRODUCT_ID=prod_xxx node scripts/setup-pulse-pricing-2026.mjs');
  }
  process.exit(1);
}
