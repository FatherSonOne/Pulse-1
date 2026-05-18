#!/usr/bin/env node
/**
 * Idempotent Stripe setup for the Pulse Growth tier.
 *
 * Ensures the active Stripe catalog for the provided secret key contains:
 *   - Product: "Pulse Growth"
 *   - Monthly recurring price: $300/mo by default
 *   - Yearly recurring price: $3,000/yr by default
 *
 * Override the amounts only when intentionally changing pricing:
 *   PULSE_GROWTH_MONTHLY_AMOUNT=24900 PULSE_GROWTH_YEARLY_AMOUNT=249000 ...
 *
 * Run against the intended Stripe account:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-pulse-growth-stripe.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadLocalEnv() {
  if (process.env.STRIPE_SECRET_KEY) return;

  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key === 'STRIPE_SECRET_KEY' && !process.env.STRIPE_SECRET_KEY) {
        process.env.STRIPE_SECRET_KEY = value;
      }

      if (key === 'VITE_STRIPE_SECRET_KEY' && !process.env.STRIPE_SECRET_KEY) {
        process.env.STRIPE_SECRET_KEY = value;
        console.warn('WARNING: Found VITE_STRIPE_SECRET_KEY in .env.local.');
        console.warn('The VITE_ prefix exposes this key to the browser bundle. Rename it to STRIPE_SECRET_KEY.');
        console.warn('');
      }
    }
  } catch {
    // No local env file is fine when the key is supplied inline.
  }
}

loadLocalEnv();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const MONTHLY_AMOUNT = Number(process.env.PULSE_GROWTH_MONTHLY_AMOUNT || 30000);
const YEARLY_AMOUNT = Number(process.env.PULSE_GROWTH_YEARLY_AMOUNT || 300000);
const CURRENCY = (process.env.PULSE_GROWTH_CURRENCY || 'usd').toLowerCase();

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY not set.');
  console.error('');
  console.error('Run with the secret key for the Stripe account shown in Product catalog:');
  console.error('  STRIPE_SECRET_KEY=sk_test_... node scripts/setup-pulse-growth-stripe.mjs');
  process.exit(1);
}

if (!STRIPE_SECRET_KEY.startsWith('sk_')) {
  console.error('STRIPE_SECRET_KEY must be a Stripe secret key beginning with sk_.');
  process.exit(1);
}

for (const [name, amount] of [['PULSE_GROWTH_MONTHLY_AMOUNT', MONTHLY_AMOUNT], ['PULSE_GROWTH_YEARLY_AMOUNT', YEARLY_AMOUNT]]) {
  if (!Number.isInteger(amount) || amount <= 0) {
    console.error(`${name} must be a positive integer amount in cents.`);
    process.exit(1);
  }
}

const mode = STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';

async function stripe(method, path, body) {
  const headers = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  let formBody;
  if (body) {
    const params = new URLSearchParams();
    const append = (key, value) => {
      if (value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((item, index) => append(`${key}[${index}]`, item));
        return;
      }
      if (typeof value === 'object') {
        for (const [childKey, childValue] of Object.entries(value)) {
          append(`${key}[${childKey}]`, childValue);
        }
        return;
      }
      params.append(key, String(value));
    };

    for (const [key, value] of Object.entries(body)) append(key, value);
    formBody = params.toString();
  }

  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body: formBody });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path} failed: ${data.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

async function listAll(path) {
  const results = [];
  let startingAfter;

  do {
    const separator = path.includes('?') ? '&' : '?';
    const page = await stripe('GET', `${path}${separator}limit=100${startingAfter ? `&starting_after=${startingAfter}` : ''}`);
    results.push(...page.data);
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);

  return results;
}

async function ensurePulseGrowthProduct() {
  const products = await listAll('/products?active=true');
  const existing = products.find((product) =>
    product.metadata?.app === 'pulse' &&
    product.metadata?.tier === 'growth'
  ) || products.find((product) => product.name === 'Pulse Growth');

  if (existing) {
    console.log(`Using existing Pulse Growth product: ${existing.id}`);
    return existing;
  }

  console.log('Creating Pulse Growth product...');
  return stripe('POST', '/products', {
    name: 'Pulse Growth',
    description: 'For growing organizations: 5x capacity, SSO (coming soon), API access, audit log retention, custom branding, priority support.',
    metadata: { app: 'pulse', tier: 'growth' },
  });
}

async function ensurePrice(productId, { interval, unitAmount, nickname, cycle }) {
  const prices = await listAll(`/prices?active=true&type=recurring&product=${productId}`);
  const existing = prices.find((price) =>
    price.currency === CURRENCY &&
    price.unit_amount === unitAmount &&
    price.recurring?.interval === interval &&
    price.recurring?.interval_count === 1
  );

  if (existing) {
    console.log(`Using existing ${cycle} price: ${existing.id}`);
    return existing;
  }

  console.log(`Creating ${cycle} price (${CURRENCY.toUpperCase()} ${unitAmount} cents / ${interval})...`);
  return stripe('POST', '/prices', {
    product: productId,
    currency: CURRENCY,
    unit_amount: unitAmount,
    recurring: {
      interval,
      interval_count: 1,
    },
    metadata: { app: 'pulse', tier: 'growth', cycle },
    nickname,
  });
}

function printPlanSql({ product, monthly, yearly }) {
  console.log('');
  console.log('Stripe setup complete.');
  console.log(`Mode:          ${mode}`);
  console.log(`Product ID:    ${product.id}`);
  console.log(`Monthly price: ${monthly.id}`);
  console.log(`Yearly price:  ${yearly.id}`);
  console.log('');
  console.log('Apply this to the Supabase plans table for the same environment:');
  console.log('');
  console.log(`UPDATE public.plans`);
  console.log(`   SET stripe_price_monthly = '${monthly.id}',`);
  console.log(`       stripe_price_yearly = '${yearly.id}',`);
  console.log(`       is_active = true`);
  console.log(` WHERE id = 'pulse_growth';`);
  console.log('');
}

try {
  console.log(`Stripe mode: ${mode}`);
  console.log(`Growth monthly amount: ${MONTHLY_AMOUNT} cents`);
  console.log(`Growth yearly amount:  ${YEARLY_AMOUNT} cents`);
  console.log('');

  const product = await ensurePulseGrowthProduct();
  const monthly = await ensurePrice(product.id, {
    interval: 'month',
    unitAmount: MONTHLY_AMOUNT,
    nickname: 'Pulse Growth Monthly',
    cycle: 'monthly',
  });
  const yearly = await ensurePrice(product.id, {
    interval: 'year',
    unitAmount: YEARLY_AMOUNT,
    nickname: 'Pulse Growth Yearly',
    cycle: 'yearly',
  });

  printPlanSql({ product, monthly, yearly });
} catch (error) {
  console.error('');
  console.error('Setup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
