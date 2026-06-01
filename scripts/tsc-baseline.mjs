#!/usr/bin/env node
/**
 * tsc-baseline.mjs — TypeScript error baseline gate.
 *
 * The Pulse repo carries a large set of pre-existing `tsc --noEmit` errors
 * (Vite/esbuild skip type-checking, so they accumulated unnoticed). Fixing
 * them all at once is out of scope and risky. Instead, this script freezes
 * the current error set as a *baseline* and fails CI only when NEW errors
 * are introduced — letting the count ratchet down over time but never up.
 *
 * Modes:
 *   node scripts/tsc-baseline.mjs --update   Run tsc, write tsc-baseline.json.
 *   node scripts/tsc-baseline.mjs            Gate mode: run tsc, compare to
 *                                            baseline, exit 1 on any new error.
 *
 * Signature scheme: errors are keyed by
 *   <repo-relative-posix-path>::<TScode>::<normalized-message>
 * deliberately EXCLUDING line/column, so that edits which merely shift line
 * numbers do not register as "new" errors. Identical (file, code, message)
 * triples are counted; a new error = a signature absent from the baseline OR
 * a signature whose count exceeds its baseline count.
 *
 * No new dependencies. tsc is launched with
 * NODE_OPTIONS=--max-old-space-size=8192 so it never OOMs, making the gate
 * cross-platform (Windows dev + Linux CI) without relying on cross-env.
 * Launch uses spawnSync with an explicit argv (no shell), so there is no
 * command-injection surface.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(REPO_ROOT, 'tsc-baseline.json');

const isUpdate = process.argv.includes('--update');

/** Resolve the local tsc entry (the .js entry we invoke with `node`). */
function resolveTscEntry() {
  const candidate = path.join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!existsSync(candidate)) {
    console.error('[tsc-baseline] Could not find node_modules/typescript/bin/tsc. Run `npm ci` first.');
    process.exit(2);
  }
  return candidate;
}

/** Run a full, cache-free tsc --noEmit and return combined stdout+stderr. */
function runTsc() {
  const tscEntry = resolveTscEntry();
  const result = spawnSync(
    process.execPath,
    [tscEntry, '--noEmit', '--incremental', 'false', '--pretty', 'false'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: false,
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        // Force a generous heap so tsc never OOMs (the real reason bare
        // `npx tsc` produced misleading exits in CI).
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=8192`.trim(),
      },
    }
  );

  if (result.error) {
    console.error('[tsc-baseline] Failed to launch tsc:', result.error.message);
    process.exit(2);
  }
  // tsc exits non-zero when there are type errors — that's expected and NOT a
  // script failure. We parse the output regardless of exit code.
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

/** Normalize a raw tsc file path to a repo-relative POSIX path. */
function toRelPosix(rawPath) {
  let p = rawPath.trim();
  if (path.isAbsolute(p)) {
    p = path.relative(REPO_ROOT, p);
  }
  return p.split(path.sep).join('/').replace(/\\/g, '/');
}

// tsc embeds the *absolute* repo path inside some messages (e.g. dynamic-import
// TS2322: `import("F:/pulse1/src/…")`). That prefix is environment-specific —
// its drive-letter case varies by shell on Windows, and on Linux CI it's a
// completely different root (`/home/runner/work/…`) — so leaving it in the
// signature makes the baseline non-portable (spurious "new errors" on CI).
// Strip the runtime repo root (either separator style, case-insensitive) so
// embedded paths collapse to the same repo-relative form everywhere.
const REPO_ROOT_RE = new RegExp(
  REPO_ROOT
    .split(path.sep)
    .join('/')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // regex-escape literals
    .replace(/\//g, '[\\\\/]') +            // match / or \ at each separator
    '[\\\\/]?',                             // and an optional trailing separator
  'gi'
);

// TypeScript emits the members of a union type in a NON-deterministic order
// (e.g. `"tap" | "hold"` one run, `"hold" | "tap"` the next), which flips a
// signature between runs and produces phantom "new error / fixed" pairs. Sort
// the members of quoted-string-literal unions so the signature is order-stable.
function sortQuotedUnions(s) {
  return s.replace(/"[^"]*"(?:\s*\|\s*"[^"]*")+/g, (m) =>
    m.split('|').map((p) => p.trim()).sort().join(' | '),
  );
}

/** Collapse whitespace + strip the env-specific repo root + sort union members
 *  so messages are stable across platforms (Windows dev ↔ Linux CI), drive-letter
 *  casing, and TypeScript's nondeterministic union ordering. */
function normalizeMessage(msg) {
  return sortQuotedUnions(
    msg.replace(REPO_ROOT_RE, '').replace(/\s+/g, ' ').trim(),
  );
}

// Matches: path/to/file.ts(LINE,COL): error TSxxxx: message
const ERROR_LINE_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

/**
 * Parse tsc output into a structured error list.
 * @returns {{signature:string, code:string, file:string, line:number, col:number, message:string}[]}
 */
function parseErrors(output) {
  const errors = [];
  for (const rawLine of output.split(/\r?\n/)) {
    const m = ERROR_LINE_RE.exec(rawLine);
    if (!m) continue;
    const [, rawPath, lineStr, colStr, code, rawMsg] = m;
    const file = toRelPosix(rawPath);
    const message = normalizeMessage(rawMsg);
    const signature = `${file}::${code}::${message}`;
    errors.push({
      signature,
      code,
      file,
      line: Number(lineStr),
      col: Number(colStr),
      message,
    });
  }
  return errors;
}

/** Build a sorted { signature: count } map from a parsed error list. */
function toCountMap(errors) {
  const counts = {};
  for (const e of errors) {
    counts[e.signature] = (counts[e.signature] ?? 0) + 1;
  }
  // Sort keys so the JSON diffs cleanly.
  const sorted = {};
  for (const key of Object.keys(counts).sort()) {
    sorted[key] = counts[key];
  }
  return sorted;
}

function total(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------

function update() {
  console.log('[tsc-baseline] Running full tsc --noEmit (heap=8192MB)…');
  const output = runTsc();
  const errors = parseErrors(output);
  const counts = toCountMap(errors);
  const baseline = {
    note: 'Auto-generated by scripts/tsc-baseline.mjs --update. Do not hand-edit. Signature = relPosixPath::TScode::normalizedMessage (line/col excluded so unrelated edits do not churn this file). See docs/TS_ERROR_BURNDOWN.md.',
    total: total(counts),
    errors: counts,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  console.log(`[tsc-baseline] Wrote ${path.relative(REPO_ROOT, BASELINE_PATH)} — ${baseline.total} errors across ${Object.keys(counts).length} signatures.`);
}

function gate() {
  if (!existsSync(BASELINE_PATH)) {
    console.error('[tsc-baseline] No tsc-baseline.json found. Generate it first:');
    console.error('               node scripts/tsc-baseline.mjs --update');
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const baselineCounts = baseline.errors ?? {};

  console.log('[tsc-baseline] Running full tsc --noEmit (heap=8192MB)…');
  const output = runTsc();
  const errors = parseErrors(output);
  const currentCounts = toCountMap(errors);

  // NEW errors: occurrences of a signature beyond its allowed baseline count.
  const remainingAllowance = { ...baselineCounts };
  const newErrors = [];
  for (const e of errors) {
    const allowed = remainingAllowance[e.signature] ?? 0;
    if (allowed > 0) {
      remainingAllowance[e.signature] = allowed - 1;
    } else {
      newErrors.push(e);
    }
  }

  // FIXED errors: baseline signatures whose count dropped.
  const fixedSignatures = [];
  for (const sig of Object.keys(baselineCounts)) {
    const cur = currentCounts[sig] ?? 0;
    if (cur < baselineCounts[sig]) {
      fixedSignatures.push({ sig, was: baselineCounts[sig], now: cur });
    }
  }

  const baseTotal = baseline.total ?? total(baselineCounts);
  const curTotal = total(currentCounts);
  const fixedCount = Math.max(0, baseTotal - curTotal + newErrors.length);

  console.log(
    `Baseline: ${baseTotal} errors · Current: ${curTotal} · New: ${newErrors.length} · Fixed: ${fixedCount}`
  );

  if (fixedSignatures.length > 0) {
    console.log(`\n[tsc-baseline] ${fixedSignatures.length} baseline signature(s) improved — you can tighten the baseline:`);
    console.log('               npm run typecheck:baseline   (then commit tsc-baseline.json)');
    for (const f of fixedSignatures.slice(0, 20)) {
      console.log(`   FIXED  ${f.sig}  (${f.was} → ${f.now})`);
    }
    if (fixedSignatures.length > 20) {
      console.log(`   …and ${fixedSignatures.length - 20} more.`);
    }
  }

  if (newErrors.length > 0) {
    console.error(`\n[tsc-baseline] ✗ ${newErrors.length} NEW TypeScript error(s) not in the baseline:\n`);
    for (const e of newErrors) {
      console.error(`   ${e.file}:${e.line}:${e.col}  ${e.code}  ${e.message}`);
    }
    console.error('\n[tsc-baseline] Fix these before merging. If a change is intentional and');
    console.error('               unavoidable, regenerate the baseline (npm run typecheck:baseline)');
    console.error('               and commit tsc-baseline.json — but never let the total climb casually.');
    process.exit(1);
  }

  console.log('\n[tsc-baseline] ✓ No new TypeScript errors vs baseline.');
  process.exit(0);
}

if (isUpdate) {
  update();
} else {
  gate();
}
