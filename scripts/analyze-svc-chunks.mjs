// One-off chunk-cycle analyzer. Replays vite.config manualChunks classification
// for /src/services/ and parses real (value) static imports to find svc-* cycles.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const SVC = resolve('src/services');

// NOTE: this MUST mirror the manualChunks(id) classification in vite.config.ts.
// If you change the service-chunk patterns there, update them here too — this
// guard's whole job is to fail when svc-core/svc-ai stop being clean foundations.
function classify(id) {
  id = id.replace(/\\/g, '/');
  if (!id.includes('/src/services/')) return null;
  if (id.includes('/relay/') || id.includes('voiceCommand') || id.includes('voiceIntelligence') ||
      id.includes('voiceGuardrail') || id.includes('voiceRoom') || id.includes('voiceSearch') ||
      id.includes('audioVoice') || id.includes('audioService') || id.includes('assemblyService') ||
      id.includes('whisperService') || id.includes('elevenLabs') || id.includes('nativeVoice') ||
      id.includes('slackChannelsService')) return 'svc-voice';
  if (id.includes('geminiService') || id.includes('openAiService') || id.includes('anthropicService') ||
      id.includes('perplexity') || id.includes('unifiedAIService') || id.includes('advancedAI') ||
      id.includes('conversationalAI') || id.includes('ragService') || id.includes('realtimeAgent') ||
      id.includes('aiInsights') || id.includes('aiFormatting') || id.includes('aiLab') ||
      id.includes('proactiveSuggestions') || id.includes('toolRegistry') ||
      id.includes('agentHandoffService') || id.includes('conversationIntelligenceService')) return 'svc-ai';
  if (id.includes('smartComposeService') ||
      id.includes('emailSync') || id.includes('emailAI') || id.includes('emailFilter') ||
      id.includes('emailMeet') || id.includes('emailSearch') || id.includes('emailSignature') ||
      id.includes('emailTemplate') || id.includes('emailAccounts') || id.includes('gmailService') ||
      id.includes('enhancedEmail') || id.includes('offlineEmail') || id.includes('confidentialEmail') ||
      id.includes('vacationResponder') || id.includes('emailService') || id.includes('unifiedInbox') ||
      id.includes('bulkOperationsService') || id.includes('emailCampaignService') ||
      id.includes('labelService') || id.includes('webhookService')) return 'svc-email';
  if (id.includes('dailyBriefingService') ||
      id.includes('googleCalendar') || id.includes('calendarAI') || id.includes('customEventTypes') ||
      id.includes('conflictDetection') || id.includes('meetingDetection') || id.includes('postMeeting') ||
      id.includes('inviteService') || id.includes('briefingService') || id.includes('outlookCalendar') ||
      id.includes('unifiedCalendar') || id.includes('videoConferencingService')) return 'svc-calendar';
  if (id.includes('messageChannel') || id.includes('messageService') || id.includes('messageAuto') ||
      id.includes('messageEnhance') || id.includes('messageSummariz') || id.includes('messagesExport') ||
      id.includes('pulseService') || id.includes('collaborationService') || id.includes('notificationService') ||
      id.includes('notificationRule') || id.includes('pushNotification') || id.includes('attentionService') ||
      id.includes('channelExport')) return 'svc-messaging';
  if (id.includes('/crm/') || id.includes('crmService') || id.includes('crmActions') || id.includes('leadScoring') ||
      id.includes('contactEnrich') || id.includes('googleContacts') || id.includes('userContact') ||
      id.includes('relationshipHealth') || id.includes('relationshipIntelligence') || id.includes('relationshipAlert') ||
      id.includes('analyticsService') || id.includes('analyticsCollector') || id.includes('analyticsExport') ||
      id.includes('decisionAnalytics') || id.includes('predictiveAnalytics') || id.includes('teamHealth') ||
      id.includes('teamService') || id.includes('recognitionService') || id.includes('achievementService') ||
      id.includes('outcomeService') || id.includes('contactCircle') || id.includes('contactSearchAI') ||
      id.includes('contactGoal') || id.includes('todayFeed') || id.includes('weeklyBriefingService') ||
      id.includes('relationshipAutopilotService')) return 'svc-crm-analytics';
  if (id.includes('dataService') || id.includes('dbService') || id.includes('archiveService') ||
      id.includes('dataExport') || id.includes('dataPrivacy') || id.includes('dataRetention') ||
      id.includes('backupSync') || id.includes('googleDrive') || id.includes('fileUpload') ||
      id.includes('fileSecurity') || id.includes('virusScan') || id.includes('encryptionService') ||
      id.includes('encryption.ts') || id.includes('warRoom') || id.includes('brainstorm') ||
      id.includes('contextBank') || id.includes('savedSearch') || id.includes('/documentProcessors/') ||
      id.includes('authService') || id.includes('meetingService')) return 'svc-storage';
  return 'svc-core';
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(e) && !/\.test\.|\.spec\./.test(e)) acc.push(p);
  }
  return acc;
}

// Match value imports (NOT `import type`) and side-effect imports.
const importRe = /import\s+(?!type[\s{])(?:[^'";]+\s+from\s+)?['"]([^'"]+)['"]/g;

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // bare module → node_modules
  const base = resolve(dirname(fromFile), spec);
  const cands = [base, base + '.ts', base + '.tsx', base + '.js', base + '.jsx',
                 join(base, 'index.ts'), join(base, 'index.tsx'), join(base, 'index.js')];
  for (const c of cands) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

const files = walk(SVC);
const edges = new Map(); // chunkA -> Set(chunkB)
const why = new Map();   // "A->B" -> [ "fromFile imports spec" ]

for (const f of files) {
  const fromChunk = classify(f);
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(importRe)) {
    const target = resolveImport(f, m[1]);
    if (!target) continue;
    const toChunk = classify(target);
    if (!toChunk || toChunk === fromChunk) continue;
    if (!edges.has(fromChunk)) edges.set(fromChunk, new Set());
    edges.get(fromChunk).add(toChunk);
    const k = `${fromChunk} -> ${toChunk}`;
    if (!why.has(k)) why.set(k, []);
    if (why.get(k).length < 8)
      why.get(k).push(`  ${f.replace(SVC, 'services').replace(/\\/g, '/')}  <= '${m[1]}'`);
  }
}

console.log('=== svc-* chunk edges (value imports only) ===');
for (const [a, set] of [...edges].sort()) console.log(`${a} -> ${[...set].sort().join(', ')}`);

console.log('\n=== cycles ===');
const cycles = [];
function dfs(node, path, visiting) {
  for (const nxt of edges.get(node) || []) {
    const idx = path.indexOf(nxt);
    if (idx !== -1) { cycles.push([...path.slice(idx), nxt]); continue; }
    if (visiting.has(nxt)) continue;
    visiting.add(nxt);
    dfs(nxt, [...path, nxt], visiting);
  }
}
for (const n of edges.keys()) dfs(n, [n], new Set([n]));
const seen = new Set();
for (const c of cycles) {
  const norm = c.join(' -> ');
  if (seen.has(norm)) continue; seen.add(norm);
  console.log(norm);
}

// ── Gate ─────────────────────────────────────────────────────────────────────
// The foundation invariant (vite.config.ts §132): svc-core must import NO other
// svc-* chunk, and svc-ai may import only svc-core. These two conditions keep the
// chunks every other chunk depends on free of init cycles, which is what prevents
// the "Cannot access 'X' before initialization" TDZ crash on first load.
// `--check` exits non-zero (CI gate) when they are violated; the residual
// svc-calendar <-> svc-email cycle is intentionally NOT gated (pre-existing,
// touches neither foundation chunk nor svc-messaging).
const out = (c) => [...(edges.get(c) || [])].sort();
const coreOut = out('svc-core');
const aiOut = out('svc-ai').filter((c) => c !== 'svc-core');
const violations = [];
if (coreOut.length) violations.push(['svc-core', coreOut]);
if (aiOut.length) violations.push(['svc-ai', aiOut]);

if (process.argv.includes('--check')) {
  if (!violations.length) {
    console.log('\n✓ chunk-foundation invariant holds: svc-core is a pure sink; svc-ai imports only svc-core.');
    process.exit(0);
  }
  console.error('\n✗ chunk-foundation invariant VIOLATED — this will trip a first-load TDZ crash.');
  for (const [chunk, targets] of violations) {
    for (const t of targets) {
      console.error(`\n  ${chunk} -> ${t}  (forbidden) — caused by:`);
      (why.get(`${chunk} -> ${t}`) || ['    (unknown)']).forEach((l) => console.error(l));
    }
  }
  console.error('\nFix: pin the offending file into the importee\'s chunk in vite.config.ts manualChunks,');
  console.error('or convert the offending import to `import type` / a dynamic import(). See vite.config.ts §132.');
  process.exit(1);
} else {
  console.log('\n=== foundation check (run with --check to gate) ===');
  console.log(violations.length
    ? `✗ ${violations.map(([c, t]) => `${c} -> ${t.join(', ')}`).join(' ; ')}`
    : '✓ svc-core pure sink; svc-ai -> svc-core only');
}
