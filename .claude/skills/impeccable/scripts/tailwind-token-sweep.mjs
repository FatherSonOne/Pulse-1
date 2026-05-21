#!/usr/bin/env node
/**
 * Tailwind island sweep — mechanical 1:1 substitution to --pulse-* tokens.
 *
 * Rules are ordered most-specific → least-specific. Each rule is regex + replacement.
 * Apply only inside `className="..."` / `className={\`...\`}` strings to avoid
 * touching prose, comments, or string literals that happen to look like classes.
 *
 * Safe-list: only paired light/dark patterns and a few unambiguous bare classes.
 * Status colors (red/amber/emerald/blue/purple/etc.) are NOT touched here —
 * those need per-occurrence judgment (see PR-3 in the scope).
 *
 * Usage: node tailwind-token-sweep.mjs <file>...  [--dry]
 *
 * Reports counts per file and exits non-zero if dry-run shows any change.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

const DRY = argv.includes('--dry');
const files = argv.slice(2).filter(a => !a.startsWith('--'));

if (files.length === 0) {
  console.error('usage: tailwind-token-sweep.mjs <file>... [--dry]');
  exit(2);
}

// Each rule: [pattern, replacement, label]. Patterns match the literal class
// substring inside a className. Order matters — composite patterns first.
const RULES = [
  // ─── Page / panel canvas ─────────────────────────────────────
  ['bg-white dark:bg-zinc-950', 'bg-[var(--pulse-surface)] dark:bg-[var(--pulse-canvas)]', 'canvas-surface-pair'],
  ['bg-white dark:bg-zinc-900',  'bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)]', 'surface-pair'],

  // ─── Card / hover surface ────────────────────────────────────
  ['bg-zinc-50 dark:bg-zinc-900', 'bg-[var(--pulse-canvas-soft)] dark:bg-[var(--pulse-surface)]', 'canvas-soft-pair'],
  ['bg-zinc-100 dark:bg-zinc-800', 'bg-[var(--pulse-surface-raised)] dark:bg-[var(--pulse-surface-raised)]', 'raised-pair'],
  ['bg-zinc-200 dark:bg-zinc-700', 'bg-[var(--pulse-surface-raised)] dark:bg-[var(--pulse-surface-raised)]', 'raised-pair-2'],

  // hover variants of the same
  ['hover:bg-zinc-50 dark:hover:bg-zinc-900', 'hover:bg-[var(--pulse-canvas-soft)] dark:hover:bg-[var(--pulse-surface)]', 'canvas-soft-hover'],
  ['hover:bg-zinc-100 dark:hover:bg-zinc-800', 'hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-[var(--pulse-surface-raised)]', 'raised-hover'],
  ['hover:bg-zinc-200 dark:hover:bg-zinc-700', 'hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-[var(--pulse-surface-raised)]', 'raised-hover-2'],

  // ─── Borders ─────────────────────────────────────────────────
  ['border-zinc-200 dark:border-zinc-800', 'border-[var(--pulse-border)]', 'border-pair'],
  ['border-zinc-100 dark:border-zinc-800', 'border-[var(--pulse-border)]', 'border-pair-faint'],
  ['border-zinc-200 dark:border-zinc-700', 'border-[var(--pulse-border-strong)]', 'border-strong-pair'],
  // hover border lift
  ['hover:border-zinc-300 dark:hover:border-zinc-700', 'hover:border-[var(--pulse-border-strong)]', 'border-hover'],
  // divides
  ['divide-zinc-100 dark:divide-zinc-800', 'divide-[var(--pulse-border)]', 'divide-pair'],
  ['divide-zinc-200 dark:divide-zinc-800', 'divide-[var(--pulse-border)]', 'divide-pair-2'],

  // ─── Text — primary/secondary/tertiary ───────────────────────
  ['text-zinc-900 dark:text-white', 'text-[var(--pulse-ink)]', 'ink-primary'],
  ['text-zinc-800 dark:text-zinc-100', 'text-[var(--pulse-ink)]', 'ink-primary-2'],
  ['text-zinc-700 dark:text-zinc-200', 'text-[var(--pulse-ink-2)]', 'ink-secondary'],
  ['text-zinc-700 dark:text-zinc-300', 'text-[var(--pulse-ink-2)]', 'ink-secondary-2'],
  ['text-zinc-600 dark:text-zinc-300', 'text-[var(--pulse-ink-2)]', 'ink-secondary-3'],
  ['text-zinc-600 dark:text-zinc-400', 'text-[var(--pulse-ink-2)]', 'ink-secondary-4'],
  ['text-zinc-500 dark:text-zinc-400', 'text-[var(--pulse-ink-3)]', 'ink-tertiary'],
  ['text-zinc-500 dark:text-zinc-500', 'text-[var(--pulse-ink-3)]', 'ink-tertiary-2'],
  ['text-zinc-400 dark:text-zinc-500', 'text-[var(--pulse-ink-3)]', 'ink-tertiary-3'],
  ['text-zinc-400 dark:text-zinc-600', 'text-[var(--pulse-ink-3)]', 'ink-tertiary-4'],

  // hover text
  ['hover:text-zinc-900 dark:hover:text-white', 'hover:text-[var(--pulse-ink)]', 'hover-ink'],
  ['hover:text-zinc-700 dark:hover:text-zinc-200', 'hover:text-[var(--pulse-ink-2)]', 'hover-ink-2'],
  ['hover:text-zinc-600 dark:hover:text-zinc-300', 'hover:text-[var(--pulse-ink-2)]', 'hover-ink-2b'],
];

// Scan and apply
let totalChanges = 0;
const results = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`skip ${file}: ${err.message}`);
    continue;
  }
  let fileChanges = 0;
  const fileLabels = {};

  for (const [pattern, replacement, label] of RULES) {
    // Escape regex special characters in pattern; classes contain none, but be safe.
    const re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = text.match(re);
    if (!matches) continue;
    text = text.replace(re, replacement);
    fileChanges += matches.length;
    fileLabels[label] = (fileLabels[label] || 0) + matches.length;
  }

  if (fileChanges > 0) {
    if (!DRY) writeFileSync(file, text);
    results.push({ file, count: fileChanges, labels: fileLabels });
    totalChanges += fileChanges;
  }
}

// Report
for (const r of results) {
  console.log(`${r.file}: ${r.count}`);
  for (const [label, n] of Object.entries(r.labels)) {
    console.log(`  ${label}: ${n}`);
  }
}
console.log(`\nTotal: ${totalChanges} substitutions across ${results.length} files`);
if (DRY) {
  console.log('(dry-run — no files written)');
}
