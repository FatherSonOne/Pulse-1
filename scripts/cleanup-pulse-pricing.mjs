#!/usr/bin/env node
/**
 * Cleanup for the 2026 Pulse pricing migration (#126). DRY-RUN by default.
 *
 * Archives the STRAY Pulse Team prices left over from multiple setup-script
 * runs + the $18→$15 change, AND (per operator instruction, TEST accounts)
 * cancels any active subscriptions on those stray/old prices so accounts can
 * re-subscribe on the canonical tiers. Cancellations cascade to Supabase via
 * the billing-webhook.
 *
 * Canonical prices that are KEPT (never touched):
 *   Solo:          price_1TdDzjGb3AGXe9w86fBuX5Kh ($20/mo) · price_1TdDzjGb3AGXe9w8KyIZBspq ($200/yr)
 *   Team per-seat: price_1TdEIxGb3AGXe9w8nL85q7mM ($15/seat/mo) · price_1TdEIxGb3AGXe9w8krIDmRiK ($150/seat/yr)
 *   Growth:        price_1TYGWNGb3AGXe9w8PjNHmR8L ($300/mo) · price_1TYGWOGb3AGXe9w8rfCzjg4k ($3,000/yr)
 *
 * Run (PowerShell):
 *   node scripts/cleanup-pulse-pricing.mjs                 # dry-run (default) — shows what WOULD happen
 *   $env:APPLY='true'; node scripts/cleanup-pulse-pricing.mjs; Remove-Item Env:APPLY   # actually cancel + archive
 *
 * bash:
 *   node scripts/cleanup-pulse-pricing.mjs
 *   APPLY=true node scripts/cleanup-pulse-pricing.mjs
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
      const eq = line.indexOf('='); if (eq === -1) continue;
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
if (!KEY || !KEY.startsWith('sk_')) { console.error('❌ STRIPE_SECRET_KEY (sk_...) not found.'); process.exit(1); }
const APPLY = process.env.APPLY === 'true';
const MODE = KEY.startsWith('sk_test_') ? 'TEST' : 'LIVE';
console.log(`🔧 Stripe mode: ${MODE}`);
console.log(APPLY ? '⚠️  APPLY=true — this WILL cancel subscriptions + archive prices.\n' : '🧪 DRY-RUN (no changes). Set APPLY=true to execute.\n');
if (APPLY && MODE === 'LIVE') { console.error('🛑 Refusing to auto-apply in LIVE. Review carefully and run manually.'); process.exit(1); }

// Stray / old prices to archive (and cancel subs on). Each entry: id + label.
const STRAY = [
  { id: 'price_1TdDzjGb3AGXe9w8saPsIDp7', label: '$18/seat/mo (superseded)' },
  { id: 'price_1TdDzjGb3AGXe9w8aeeKuS7O', label: '$180/seat/yr (superseded)' },
  { id: 'price_1TdE7lGb3AGXe9w8o1y7xQl2', label: '$15/seat/mo (duplicate)' },
  { id: 'price_1TdE7mGb3AGXe9w8nA5EtG2Y', label: '$150/seat/yr (duplicate)' },
  { id: 'price_1TWqizGb3AGXe9w8jrkWDIsP', label: '$100/mo flat (old Team)' },
  { id: 'price_1TWqizGb3AGXe9w8AOipxGjx', label: '$1,000/yr flat (old Team)' },
];

async function stripe(method, path, body) {
  const headers = { Authorization: `Bearer ${KEY}` };
  let formBody;
  if (body) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) p.append(k, String(v));
    formBody = p.toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body: formBody });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${method} ${path}: ${res.status} — ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

try {
  let totalSubs = 0;
  for (const price of STRAY) {
    // Subscriptions on this price (any non-terminal status).
    const subs = await stripe('GET', `/subscriptions?price=${price.id}&status=all&limit=100`);
    const live = (subs.data || []).filter(s => ['active', 'trialing', 'past_due', 'unpaid', 'paused'].includes(s.status));
    console.log(`• ${price.label}  ${price.id}`);
    if (live.length === 0) {
      console.log('    subs: none');
    } else {
      for (const s of live) {
        console.log(`    sub ${s.id}  status=${s.status}  customer=${s.customer}`);
        totalSubs++;
        if (APPLY) {
          await stripe('DELETE', `/subscriptions/${s.id}`);
          console.log('      ↳ cancelled');
        }
      }
    }
    if (APPLY) {
      await stripe('POST', `/prices/${price.id}`, { active: false });
      console.log('    ↳ price archived');
    } else {
      console.log('    → would archive this price');
    }
    console.log('');
  }

  console.log('══════════════════════════════════════════════════════');
  if (APPLY) {
    console.log(`✅ Done. Cancelled ${totalSubs} subscription(s) + archived ${STRAY.length} stray price(s).`);
    console.log('   Canonical Solo / Team-per-seat / Growth prices untouched.');
    console.log('   Re-subscribe test accounts on the new tiers via Settings → Billing.');
  } else {
    console.log(`🧪 DRY-RUN: would cancel ${totalSubs} subscription(s) + archive ${STRAY.length} stray price(s).`);
    console.log('   Re-run with APPLY=true to execute.');
  }
  console.log('══════════════════════════════════════════════════════');
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}
