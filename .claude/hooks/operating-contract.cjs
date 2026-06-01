#!/usr/bin/env node
/*
 * UserPromptSubmit hook: OPERATING CONTRACT.
 *
 * Re-injects four non-negotiable rules into context on every prompt so they
 * cannot decay out of the window over a long session. Pure stdout -> appended
 * to the model's context. Never blocks.
 */
process.stdout.write([
  'OPERATING CONTRACT (re-injected each turn — follow before acting):',
  '1. READ before you assert. Open the actual file / schema / type signature and quote the real lines. Never infer names or behavior from convention, filename, or memory — Pulse schema is deliberately inconsistent (text vs uuid ids, missing user_id).',
  '2. EDIT only what was asked. Confirm you are in the correct file/section before changing it. Do not drift into unrelated edits or refactors.',
  '3. VERIFY before you claim. "Done / fixed / working" requires a build, type-check, or test that ACTUALLY RAN — report the real output, not an assumption. If you cannot run it, say "not yet verified".',
  '4. HOLD the thread. Honor constraints already agreed this session and in CLAUDE.md. If something forces a deviation, name it out loud instead of silently working around it.'
].join('\n'));
process.exit(0);
