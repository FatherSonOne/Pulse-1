/**
 * One-time migration: move inline base64 data-URI avatars out of
 * `user_profiles.avatar_url` and into the `pulse-attachments` Storage bucket,
 * replacing the column with the public URL.
 *
 * WHY: a broken intake path (AccountSettings uploaded to a non-existent
 * `avatars` bucket, then fell back to persisting the base64 data URL) bloated
 * some profile rows to >1 MB each. The Relay/Glimpse contact-picker query
 * (`user_profiles.* WHERE is_public ORDER BY display_name`) ships the WHOLE
 * public directory on every call and was invoked ~92k times in 9 days →
 * ~135 GB of PostgREST egress. Moving avatars to Storage makes avatar_url
 * ~100 bytes, cutting the per-call payload ~250x.
 *
 * Safe to re-run (idempotent: only touches rows whose avatar_url is a
 * data:image/... URI; uploads use upsert). Reads the service-role key from
 * .env / .env.local at runtime — nothing secret is hard-coded here.
 *
 *   node scripts/migrate-base64-avatars.mjs          # dry run (no writes)
 *   node scripts/migrate-base64-avatars.mjs --apply  # perform migration
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const BUCKET = 'pulse-attachments';
const EXT_BY_MIME = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
};

function loadEnv(files) {
  const env = {};
  for (const f of files) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, k, rawV] = m;
      const v = rawV.replace(/^["']|["']$/g, '');
      if (!(k in env)) env[k] = v; // first file wins (.env.local over .env)
    }
  }
  return env;
}

const env = loadEnv(['.env.local', '.env']);
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('✗ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/.env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log(`\n${APPLY ? '🚀 APPLY' : '🔍 DRY RUN'} — scanning user_profiles for inline base64 avatars…\n`);

const { data: rows, error } = await supabase
  .from('user_profiles')
  .select('id, display_name, avatar_url')
  .like('avatar_url', 'data:image/%');

if (error) { console.error('✗ query failed:', error.message); process.exit(1); }
if (!rows.length) { console.log('✓ No base64 avatars found — nothing to migrate.'); process.exit(0); }

console.log(`Found ${rows.length} profile(s) with inline base64 avatars:`);
for (const r of rows) {
  console.log(`  • ${r.display_name} (${r.id}) — ${(r.avatar_url.length / 1024).toFixed(0)} KB`);
}

if (!APPLY) {
  console.log('\n(dry run — no changes made. Re-run with --apply to migrate.)');
  process.exit(0);
}

// Reversibility: keep a local backup of the original data-URIs (gitignored *.backup).
writeFileSync('_avatars-original.backup', JSON.stringify(rows, null, 2));
console.log('\n📦 Backed up originals → _avatars-original.backup\n');

let ok = 0, fail = 0;
for (const row of rows) {
  const m = row.avatar_url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s);
  if (!m) { console.log(`  ↷ skip ${row.id} (not base64-encoded)`); continue; }
  const mime = m[1].toLowerCase();
  const ext = EXT_BY_MIME[mime] || 'jpg';
  const buf = Buffer.from(m[2], 'base64');
  const path = `avatars/${row.id}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: mime, upsert: true, cacheControl: '3600' });
  if (upErr) { console.error(`  ✗ upload ${row.id}: ${upErr.message}`); fail++; continue; }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  const { error: updErr } = await supabase
    .from('user_profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', row.id);
  if (updErr) { console.error(`  ✗ update ${row.id}: ${updErr.message}`); fail++; continue; }

  console.log(`  ✓ ${row.display_name}: ${(buf.length / 1024).toFixed(0)} KB → ${publicUrl}`);
  ok++;
}

console.log(`\nDone. ${ok} migrated, ${fail} failed.\n`);
process.exit(fail ? 1 : 0);
