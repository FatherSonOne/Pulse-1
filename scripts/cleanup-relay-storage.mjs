#!/usr/bin/env node
// scripts/cleanup-relay-storage.mjs
//
// One-shot cleanup: empty the `relay` and `voxer` Storage buckets.
//
// Why a script (and not SQL): Supabase ships a `storage.protect_delete()`
// trigger that blocks direct DELETE on storage.objects to prevent S3
// orphans. The Storage API removes the metadata row AND the underlying
// blob atomically — that's what this script uses.
//
// Run once after wiping voice_thread_messages / quick_vox_messages, when
// the audio blobs those rows pointed at are no longer reachable from the
// app. Idempotent: re-running on an empty bucket reports 0 / 0.
//
// Requirements: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
// (already present in this repo). Service-role key bypasses RLS — keep it
// out of any browser bundle.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Tiny .env.local parser — the script is meant to run via plain `node`,
// not vite, so we don't have process.env populated automatically.
function loadEnvLocal() {
  const path = resolve(__dirname, '..', '.env.local');
  const out = {};
  try {
    const txt = readFileSync(path, 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[m[1]] = val;
    }
  } catch (err) {
    console.error(`Could not read .env.local at ${path}:`, err.message);
    process.exit(1);
  }
  return out;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKETS = ['relay', 'voxer'];

/**
 * Walk a bucket recursively and yield every object's full path. Supabase's
 * storage list() is folder-shaped: it returns names only at the requested
 * prefix, with folders distinguishable from files via metadata === null.
 * We DFS so deeply-nested user folders (`user_id/.../file.webm`) all show
 * up in the flat list we hand to remove().
 */
async function listAllPaths(bucket, prefix = '') {
  const paths = [];
  const stack = [prefix];

  while (stack.length) {
    const current = stack.pop();
    let offset = 0;
    const PAGE = 100;

    // List() pages 100 at a time — keep pulling until we get a short page.
    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(current, {
        limit: PAGE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) {
        console.error(`[${bucket}] list("${current}") failed:`, error.message);
        return paths;
      }
      if (!data || data.length === 0) break;

      for (const entry of data) {
        const fullPath = current ? `${current}/${entry.name}` : entry.name;
        // metadata === null indicates a folder placeholder; recurse.
        if (entry.metadata == null) {
          stack.push(fullPath);
        } else {
          paths.push(fullPath);
        }
      }

      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }

  return paths;
}

async function purgeBucket(bucket) {
  console.log(`\n[${bucket}] discovering objects…`);
  const paths = await listAllPaths(bucket);
  if (paths.length === 0) {
    console.log(`[${bucket}] already empty.`);
    return { listed: 0, removed: 0, errors: [] };
  }
  console.log(`[${bucket}] found ${paths.length} object${paths.length === 1 ? '' : 's'}.`);

  // remove() accepts up to 1000 paths per call; chunk to stay safe.
  const CHUNK = 500;
  let removed = 0;
  const errors = [];
  for (let i = 0; i < paths.length; i += CHUNK) {
    const batch = paths.slice(i, i + CHUNK);
    const { data, error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      errors.push(error.message);
      console.error(`[${bucket}] remove() batch ${i / CHUNK + 1} failed:`, error.message);
      continue;
    }
    removed += data?.length ?? batch.length;
    console.log(`[${bucket}] removed batch ${i / CHUNK + 1} (${batch.length} files)`);
  }
  return { listed: paths.length, removed, errors };
}

(async () => {
  console.log('Storage cleanup — Pulse relay/voxer buckets');
  console.log(`Project: ${SUPABASE_URL}`);

  const summary = [];
  for (const bucket of BUCKETS) {
    const r = await purgeBucket(bucket);
    summary.push({ bucket, ...r });
  }

  console.log('\n--- summary ---');
  for (const s of summary) {
    console.log(
      `${s.bucket.padEnd(8)}  listed=${s.listed}  removed=${s.removed}  errors=${s.errors.length}`,
    );
  }
  const totalErrors = summary.reduce((acc, s) => acc + s.errors.length, 0);
  process.exit(totalErrors > 0 ? 2 : 0);
})();
