#!/usr/bin/env node
/**
 * READ-ONLY — lists the active Pulse products + prices from Stripe so you can
 * eyeball the live price tiers. Makes only GET requests; creates/changes
 * nothing. Mirrors the env-loading of the setup scripts (reads .env.local).
 *
 * Run:
 *   node scripts/list-pulse-pricing.mjs
 *   # (STRIPE_SECRET_KEY is read from .env.local; or set it in the env first)
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if ((k === 'STRIPE_SECRET_KEY' || k === 'VITE_STRIPE_SECRET_KEY') && !process.env.STRIPE_SECRET_KEY) {
        process.env.STRIPE_SECRET_KEY = v;
      }
    }
  } catch { /* no .env.local */ }
}

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY || !KEY.startsWith('sk_')) {
  console.error('❌ STRIPE_SECRET_KEY (sk_...) not found in env or .env.local.');
  process.exit(1);
}
console.log(`🔧 Stripe mode: ${KEY.startsWith('sk_test_') ? 'TEST' : 'LIVE'}\n`);

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe GET ${path}: ${res.status} — ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

const fmt = (cents, cur) => `${(cents / 100).toLocaleString(undefined, { style: 'currency', currency: (cur || 'usd').toUpperCase() })}`;

try {
  const products = await stripeGet('/products?active=true&limit=100');
  const pulse = (products.data || []).filter(
    p => p.metadata?.plan_id?.startsWith('pulse') || /pulse/i.test(p.name),
  );
  if (!pulse.length) {
    console.log('No active Pulse products found.');
    process.exit(0);
  }

  for (const prod of pulse.sort((a, b) => a.name.localeCompare(b.name))) {
    const prices = await stripeGet(`/prices?product=${prod.id}&active=true&limit=100`);
    console.log(`📦 ${prod.name}  (${prod.id})`);
    if (prod.metadata?.plan_id) console.log(`   plan_id: ${prod.metadata.plan_id}`);
    const rows = (prices.data || []).sort(
      (a, b) => (a.recurring?.interval || '').localeCompare(b.recurring?.interval || ''),
    );
    if (!rows.length) console.log('   (no active prices)');
    for (const pr of rows) {
      const per = pr.metadata?.per_seat === 'true' ? '/seat' : '';
      const cycle = pr.recurring ? `/${pr.recurring.interval}` : ' one-time';
      const trial = pr.recurring?.trial_period_days ? ` · ${pr.recurring.trial_period_days}-day trial` : '';
      console.log(`   • ${fmt(pr.unit_amount, pr.currency)}${per}${cycle}${trial}   ${pr.id}${pr.nickname ? `  "${pr.nickname}"` : ''}`);
    }
    console.log('');
  }
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}
