#!/usr/bin/env node
/**
 * One-time Stripe setup for Pulse Growth tier.
 *
 * Creates:
 *   - Product: "Pulse Growth"
 *   - Monthly price: $300/mo with 30-day free trial
 *   - Yearly price: $3,000/yr with 30-day free trial (2 months free)
 *
 * Prints new price IDs for pasting into the SQL migration.
 *
 * Run with:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-pulse-growth-stripe.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
  console.error('     STRIPE_SECRET_KEY=sk_test_... node scripts/setup-pulse-growth-stripe.mjs');
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

async function createPulseGrowth() {
  console.log('📦 Creating Pulse Growth product...');
  const product = await stripe('POST', '/products', {
    name: 'Pulse Growth',
    description: 'For growing organizations: 5× capacity, SSO (coming soon), API access, audit log retention, custom branding, priority support.',
    metadata: { app: 'pulse', tier: 'growth' },
  });
  console.log(`   ✅ Product created: ${product.id}`);

  console.log('💰 Creating monthly price ($300/mo, 30-day trial)...');
  const monthly = await stripe('POST', '/prices', {
    product: product.id,
    currency: 'usd',
    unit_amount: 30000, // $300.00
    recurring: {
      interval: 'month',
      interval_count: 1,
      trial_period_days: 30,
    },
    metadata: { app: 'pulse', tier: 'growth', cycle: 'monthly' },
    nickname: 'Pulse Growth Monthly',
  });
  console.log(`   ✅ Monthly price: ${monthly.id}`);

  console.log('💰 Creating yearly price ($3,000/yr, 30-day trial)...');
  const yearly = await stripe('POST', '/prices', {
    product: product.id,
    currency: 'usd',
    unit_amount: 300000, // $3,000.00 = 2 months free vs $3,600 annualized
    recurring: {
      interval: 'year',
      interval_count: 1,
      trial_period_days: 30,
    },
    metadata: { app: 'pulse', tier: 'growth', cycle: 'yearly' },
    nickname: 'Pulse Growth Yearly',
  });
  console.log(`   ✅ Yearly price:  ${yearly.id}`);

  return { product, monthly, yearly };
}

try {
  const { product, monthly, yearly } = await createPulseGrowth();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('✅ Stripe setup complete. Paste these into the SQL migration:');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Product ID:     ${product.id}`);
  console.log(`  Monthly price:  ${monthly.id}`);
  console.log(`  Yearly price:   ${yearly.id}`);
  console.log('══════════════════════════════════════════════════════\n');
  console.log('Next step: edit supabase/migrations/20260428000001_pulse_growth_tier.sql');
  console.log('and replace the REPLACE_WITH_STRIPE_* placeholders with the IDs above.\n');
} catch (e) {
  console.error('\n❌ Setup failed:', e.message);
  process.exit(1);
}
