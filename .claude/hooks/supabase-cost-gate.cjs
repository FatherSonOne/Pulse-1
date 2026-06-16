#!/usr/bin/env node
/*
 * PreToolUse hook: SUPABASE COST GATE.
 *
 * Purpose: enforce CLAUDE.md §7.1 "announce-before-heavy" as a hard gate
 * rather than best-effort guidance. The Supabase MCP connector was 30% of
 * usage (2026-06-16 telemetry) because its results are STICKY — every MCP
 * result stays in context for the rest of the session. These five tools dump
 * the most into context (the schema is 338 tables).
 *
 * Behavior: when one of the heavy tools is about to run, return
 * permissionDecision "ask" with a cost reason + the cheaper alternative, so
 * a visible confirmation prompt fires EVERY time. The user can still proceed.
 *
 * Deliberately NOT gated: execute_sql — §7.2 names it as the cheaper,
 * narrow alternative, so gating it would push toward the expensive path.
 *
 * Design principle (matches verify-gate.cjs): guardrail, not tripwire. ANY
 * error or ambiguity -> exit 0 (let the tool through). A gate that crashes
 * the session is worse than no gate.
 */
const fs = require('fs');

function allow() { process.exit(0); } // emit nothing -> tool proceeds per normal permissions

// The token-heavy Supabase MCP tools (CLAUDE.md §7.1). Matched on the bare
// tool name suffix so it survives connector-prefix changes.
const HEAVY = new Set([
  'list_tables',
  'list_migrations',
  'generate_typescript_types',
  'get_logs',
  'get_advisors',
]);

function main() {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch { return allow(); }

  let input = {};
  try { input = JSON.parse(raw); } catch { return allow(); }

  const toolName = String(input.tool_name || '');
  // Only act on the Supabase connector's heavy tools.
  if (!/supabase/i.test(toolName)) return allow();
  const bare = toolName.split('__').pop();
  if (!HEAVY.has(bare)) return allow();

  const reason =
    `⚠ Token-heavy Supabase MCP tool: ${bare}. Its result is STICKY — it ` +
    `stays in context for the rest of the session (this connector was 30% of ` +
    `usage). Per CLAUDE.md §7.2, prefer first: read a local ` +
    `supabase/migrations/*.sql file, or run a narrow execute_sql ` +
    `(SELECT specific cols ... LIMIT n / query information_schema for ONE ` +
    `table). Proceed with the full ${bare} only if you genuinely need it — ` +
    `and consider /compact afterward to flush the result.`;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

try { main(); } catch { allow(); }
