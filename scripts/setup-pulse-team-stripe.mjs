#!/usr/bin/env node
/**
 * One-time Stripe setup for Pulse Team tier.
 *
 * Creates:
 *   - Product: "Pulse Team"
 *   - Monthly price: $100/mo with 30-day free trial
 *   - Yearly price: $1,000/yr with 30-day free trial (2 months free)
 *
 * Archives (optional — controlled by ARCHIVE_OLD_PRICES env flag):
 *   - pulse_starter, pulse_pro, pulse_business products + prices
 *
 * Prints new price IDs for pasting into the SQL migration.
 *
 * Run with:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-pulse-team-stripe.mjs
 *   # OR, to also archive the old Pulse tiers:
 *   STRIPE_SECRET_KEY=sk_test_... ARCHIVE_OLD_PRICES=true node scripts/setup-pulse-team-stripe.mjs
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
      // Back-compat: some setups mistakenly name it with the VITE_ prefix.
      // We'll honor it but warn — VITE_ vars get bundled into the client JS.
      if (k === 'VITE_STRIPE_SECRET_KEY' && !process.env.STRIPE_SECRET_KEY) {
        process.env.STRIPE_SECRET_KEY = v;
        console.warn('⚠️  Found VITE_STRIPE_SECRET_KEY in .env.local.');
        console.warn('   The VITE_ prefix exposes this key to the BROWSER BUNDLE.');
        console.warn('   Rename it to STRIPE_SECRET_KEY (no VITE_ prefix) as soon as possible.');
        console.warn('');
      }
    }
  } catch { /* no .env.local — that's fine */ }
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not set.');
  console.error('');
  console.error('   Add it to .env.local (server-side only — no VITE_ prefix):');
  console.error('     STRIPE_SECRET_KEY=sk_test_...');
  console.error('');
  console.error('   OR pass it inline:');
  console.error('     STRIPE_SECRET_KEY=sk_test_... node scripts/setup-pulse-team-stripe.mjs');
  console.error('');
  console.error('   Get the key from: https://dashboard.stripe.com/test/apikeys');
  process.exit(1);
}

if (!STRIPE_SECRET_KEY.startsWith('sk_')) {
  console.error('❌ STRIPE_SECRET_KEY does not start with "sk_".');
  console.error('   You may have pasted the publishable key (pk_...) by mistake.');
  console.error('   The SECRET key starts with "sk_test_" or "sk_live_".');
  process.exit(1);
}

const isTestMode = STRIPE_SECRET_KEY.startsWith('sk_test_');
console.log(`🔧 Stripe mode: ${isTestMode ? 'TEST' : 'LIVE'}`);
console.log(`🔧 Key prefix:  ${STRIPE_SECRET_KEY.slice(0, 12)}...`);
console.log('');

// ── Stripe REST API helper ──────────────────────────────────────────
async function stripe(method, path, body) {
  const url = `https://api.stripe.com/v1${path}`;
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

  const res = await fetch(url, { method, headers, body: formBody });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path} failed: ${res.status} — ${data.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

// ── Create product + prices ─────────────────────────────────────────
async function createPulseTeam() {
  console.log('📦 Creating Pulse Team product...');
  const product = await stripe('POST', '/products', {
    name: 'Pulse Team',
    description: 'Unified team communications with Voxer, AI, email, calendar, and messaging. Unlimited seats.',
    metadata: { app: 'pulse', tier: 'team' },
  });
  console.log(`   ✅ Product created: ${product.id}`);

  console.log('💰 Creating monthly price ($100/mo, 30-day trial)...');
  const monthly = await stripe('POST', '/prices', {
    product: product.id,
    currency: 'usd',
    unit_amount: 10000, // $100.00
    recurring: {
      interval: 'month',
      interval_count: 1,
      trial_period_days: 30,
    },
    metadata: { app: 'pulse', tier: 'team', cycle: 'monthly' },
    nickname: 'Pulse Team Monthly',
  });
  console.log(`   ✅ Monthly price: ${monthly.id}`);

  console.log('💰 Creating yearly price ($1,000/yr, 30-day trial)...');
  const yearly = await stripe('POST', '/prices', {
    product: product.id,
    currency: 'usd',
    unit_amount: 100000, // $1,000.00 = 2 months free vs $1,200 annualized
    recurring: {
      interval: 'year',
      interval_count: 1,
      trial_period_days: 30,
    },
    metadata: { app: 'pulse', tier: 'team', cycle: 'yearly' },
    nickname: 'Pulse Team Yearly',
  });
  console.log(`   ✅ Yearly price:  ${yearly.id}`);

  return { product, monthly, yearly };
}

// ── Archive old Pulse prices ────────────────────────────────────────
const OLD_PRICE_IDS = [
  'price_1TIi4XGb3AGXe9w8Zd4xKSI0', // pulse_starter monthly
  'price_1TIi4XGb3AGXe9w8iHicncCt', // pulse_starter yearly
  'price_1TIi6EGb3AGXe9w8VFr6tvmg', // pulse_pro monthly
  'price_1TIi6EGb3AGXe9w8IyHxK0RO', // pulse_pro yearly
  'price_1TIi6uGb3AGXe9w8zrjZOLvr', // pulse_business monthly
  'price_1TIi6uGb3AGXe9w8w8GobOxg', // pulse_business yearly
];

async function archiveOldPrices() {
  console.log('\n📦 Archiving old Pulse prices...');
  for (const id of OLD_PRICE_IDS) {
    try {
      await stripe('POST', `/prices/${id}`, { active: false });
      console.log(`   ✅ Archived ${id}`);
    } catch (e) {
      console.log(`   ⚠️  Could not archive ${id}: ${e.message}`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────
try {
  const { product, monthly, yearly } = await createPulseTeam();

  if (process.env.ARCHIVE_OLD_PRICES === 'true') {
    await archiveOldPrices();
  } else {
    console.log('\n⏭️  Skipped archiving old prices. To archive them, rerun with ARCHIVE_OLD_PRICES=true');
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log('✅ Stripe setup complete. Paste these into the SQL migration:');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Product ID:     ${product.id}`);
  console.log(`  Monthly price:  ${monthly.id}`);
  console.log(`  Yearly price:   ${yearly.id}`);
  console.log('══════════════════════════════════════════════════════\n');
  console.log('Next step: edit supabase/migrations/20260423000001_pulse_team_tier.sql');
  console.log('and replace the REPLACE_WITH_STRIPE_* placeholders with the IDs above.\n');
} catch (e) {
  console.error('\n❌ Setup failed:', e.message);
  process.exit(1);
}
