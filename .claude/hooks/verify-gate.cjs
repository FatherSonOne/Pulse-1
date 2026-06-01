#!/usr/bin/env node
/*
 * Stop-hook VERIFY GATE.
 *
 * Purpose: stop "I'm done / it's fixed / it works" claims that were never
 * actually built, type-checked, or tested. If this turn edited code AND the
 * closing message claims completion AND no verification command ran after the
 * last edit, BLOCK and send the session back to actually verify.
 *
 * Design principle: this is a guardrail, not a tripwire. ANY error or ambiguity
 * -> exit 0 (let the turn end). A guardrail that crashes the session is worse
 * than no guardrail. It also blocks at most once per stop-cycle (stop_hook_active)
 * so it can never trap you in a loop.
 */
const fs = require('fs');

function done() { process.exit(0); }

function main() {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch { return done(); }

  let input = {};
  try { input = JSON.parse(raw); } catch { return done(); }

  // Loop guard: if we already blocked this stop-cycle, let it through.
  if (input.stop_hook_active) return done();

  const tp = input.transcript_path;
  if (!tp || !fs.existsSync(tp)) return done();

  let lines;
  try { lines = fs.readFileSync(tp, 'utf8').split('\n').filter(Boolean); } catch { return done(); }

  const events = [];
  for (const l of lines) { try { events.push(JSON.parse(l)); } catch { /* skip */ } }
  if (!events.length) return done();

  // Walk backwards through the CURRENT turn only: collect tool_use calls and the
  // closing assistant text, stopping at the most recent genuine user prompt
  // (a user message that is NOT purely tool_result blocks).
  const toolSeq = [];          // reverse-chronological
  let lastAssistantText = '';
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    const msg = e && e.message;
    if (!msg) continue;
    const content = msg.content;

    if (msg.role === 'assistant') {
      if (Array.isArray(content)) {
        for (const b of content) {
          if (b && b.type === 'tool_use') toolSeq.push({ name: b.name, input: b.input || {} });
          else if (b && b.type === 'text' && !lastAssistantText) lastAssistantText = b.text || '';
        }
      } else if (typeof content === 'string' && !lastAssistantText) {
        lastAssistantText = content;
      }
    } else if (msg.role === 'user') {
      const isToolResultOnly = Array.isArray(content) && content.length > 0 &&
        content.every(b => b && b.type === 'tool_result');
      if (!isToolResultOnly) break; // start of this turn reached
    }
  }

  if (!toolSeq.length) return done();
  toolSeq.reverse(); // chronological

  const editTools = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
  let lastEditIdx = -1;
  for (let i = toolSeq.length - 1; i >= 0; i--) {
    if (editTools.has(toolSeq[i].name)) { lastEditIdx = i; break; }
  }
  if (lastEditIdx === -1) return done(); // no code changed this turn -> nothing to verify

  // Did a verification command run AFTER the last edit?
  const verifyRe = /\b(tsc|vitest|jest|playwright|type-?check|eslint|lint|vite build|npm (run )?(build|test|lint|typecheck)|npm test|cap sync)\b/i;
  for (let i = lastEditIdx + 1; i < toolSeq.length; i++) {
    const t = toolSeq[i];
    if (t.name === 'Bash') {
      const cmd = String((t.input && t.input.command) || '');
      if (verifyRe.test(cmd)) return done(); // verified -> all good
    }
  }

  // Did the closing message claim completion?
  const claimRe = /\b(done|fixed|complete[d]?|implemented|works? now|working now|all set|should (work|be fixed)|ready to (ship|go)|good to go)\b/i;
  if (!claimRe.test(lastAssistantText)) return done();

  const reason =
    'VERIFY GATE: this turn edited code and the closing message claims it is done/fixed/working, ' +
    'but no build, type-check, or test ran after the last edit. Per CLAUDE.md, "done" requires evidence. ' +
    'Run one of: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (gate on NO NEW errors vs the ~1234 pre-existing), ' +
    '`npm run build`, or the relevant `npm test`/vitest — then report the ACTUAL output. ' +
    'If verification genuinely does not apply (docs-only, config, design playground), say so explicitly and end again.';

  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

try { main(); } catch { done(); }
