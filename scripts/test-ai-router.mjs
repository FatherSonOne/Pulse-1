#!/usr/bin/env node
/**
 * AI Router smoke test.
 *
 * Usage (pick one):
 *   node scripts/test-ai-router.mjs                         # prompts for email + password
 *   node scripts/test-ai-router.mjs user@x.com 'password'   # pass as CLI args
 *   TEST_EMAIL=user@x.com TEST_PASSWORD=xxx node scripts/test-ai-router.mjs
 *
 * Note: password is visible on-screen during prompt. This is a dev-only smoke test,
 * not a production tool. Close the terminal window after you're done if concerned.
 */

import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

// ── Load .env.local ─────────────────────────────────────────────
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  } catch (e) {
    console.error('❌ Could not read .env.local at:', envPath);
    console.error('   ', e.message);
    process.exit(1);
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  console.error('   Found keys:', Object.keys(env).filter(k => k.startsWith('VITE_')).join(', ') || '(none)');
  process.exit(1);
}

console.log('🔧 Using Supabase URL:', SUPABASE_URL);
console.log('🔧 Anon key prefix:   ', SUPABASE_ANON_KEY.slice(0, 20) + '...');

// ── Get credentials ─────────────────────────────────────────────
let email = process.argv[2] || process.env.TEST_EMAIL;
let password = process.argv[3] || process.env.TEST_PASSWORD;

if (!email || !password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  email = email || (await rl.question('Pulse email: ')).trim();
  password = password || (await rl.question('Pulse password (visible): ')).trim();
  rl.close();
}

console.log('\n🔑 Signing in as:', email);
console.log('   Password length:', password.length, 'characters');

// ── Sign in ─────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });

if (authErr || !authData?.session) {
  console.error('\n❌ Auth failed:', authErr?.message || 'no session returned');
  console.error('\nThings to check:');
  console.error('  • Is the email correct? (same one you use at app.pulse.com)');
  console.error('  • Is the password correct? Try signing in via the Pulse app to confirm.');
  console.error('  • Do you have a Supabase project confirmed? (VITE_SUPABASE_URL is:', SUPABASE_URL + ')');
  console.error('  • If the email/password are right, you may be on a different Supabase');
  console.error('    instance than .env.local points to. Check that you signed up here:');
  console.error('    ', SUPABASE_URL);
  process.exit(1);
}

console.log('✅ Signed in. User id:', authData.user.id);
const token = authData.session.access_token;

// ── Find a workspace ────────────────────────────────────────────
const { data: memberships, error: wsErr } = await supabase
  .from('workspace_members')
  .select('workspace_id, role')
  .eq('user_id', authData.user.id)
  .limit(5);

if (wsErr) {
  console.error('❌ Error querying workspaces:', wsErr.message);
  process.exit(1);
}
if (!memberships?.length) {
  console.error('❌ No workspace found. Create one in Pulse first.');
  process.exit(1);
}
const workspaceId = memberships[0].workspace_id;
console.log(`✅ Found ${memberships.length} workspace(s). Using first:`, workspaceId, `(${memberships[0].role})`);

// ── Tests ───────────────────────────────────────────────────────
const tests = [
  {
    name: 'pulse_assistant_chat  → Claude Haiku 4.5',
    task: 'pulse_assistant_chat',
    params: {
      systemPrompt: 'You are Pulse AI, a concise assistant.',
      messages: [{ role: 'user', content: 'Say hello in exactly 5 words.' }],
    },
  },
  {
    name: 'message_summary       → Gemini 2.0 Flash',
    task: 'message_summary',
    params: {
      messages: [{
        role: 'user',
        content: 'Summarize in one sentence: The team agreed to ship the refactor on Friday, pending one more code review.',
      }],
    },
  },
  {
    name: 'rag_query             → Claude Sonnet 4.6 (cached)',
    task: 'rag_query',
    params: {
      systemPrompt: 'You are a RAG assistant. Answer strictly from the provided context.',
      messages: [{
        role: 'user',
        content: 'Context: "Pulse supports 6 Voxer modes." Question: How many Voxer modes?',
      }],
    },
  },
];

console.log('\n──────────────────────────────────────────────────');
let passed = 0;
for (const t of tests) {
  console.log(`\n▶ ${t.name}`);
  const start = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-router`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ task: t.task, params: t.params, workspace_id: workspaceId }),
    });
    const elapsed = Date.now() - start;
    const body = await res.json();

    if (!res.ok) {
      console.log(`  ❌ HTTP ${res.status}`);
      console.log(' ', JSON.stringify(body, null, 2));
      continue;
    }

    console.log(`  ✅ ${elapsed}ms  ·  ${body.provider}/${body.model}  ·  tokens: in=${body.tokens.input} out=${body.tokens.output} cached=${body.tokens.cached}`);
    console.log(`  Response: "${body.text.slice(0, 200)}${body.text.length > 200 ? '…' : ''}"`);
    console.log(`  Usage this period: ${body.usage.current}/${body.usage.limit ?? '∞'}`);
    if (body.used_fallback) console.log('  ⚠️  used fallback provider');
    passed++;
  } catch (e) {
    console.log('  ❌ Error:', e.message);
  }
}
console.log('\n──────────────────────────────────────────────────');
console.log(`${passed}/${tests.length} tests passed.`);
process.exit(passed === tests.length ? 0 : 1);
