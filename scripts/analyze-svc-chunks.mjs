// One-off chunk-cycle analyzer. Replays vite.config manualChunks classification
// for /src/services/ and parses real (value) static imports to find svc-* cycles.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const SVC = resolve('src/services');

function classify(id) {
  id = id.replace(/\\/g, '/');
  if (!id.includes('/src/services/')) return null;
  if (process.env.FIX) {
    if (id.includes('dailyBriefingService')) return 'svc-calendar';
    if (id.includes('smartComposeService')) return 'svc-email';
    if (id.includes('slackChannelsService')) return 'svc-voice';
  }
  if (id.includes('/relay/') || id.includes('voiceCommand') || id.includes('voiceIntelligence') ||
      id.includes('voiceGuardrail') || id.includes('voiceRoom') || id.includes('voiceSearch') ||
      id.includes('audioVoice') || id.includes('audioService') || id.includes('assemblyService') ||
      id.includes('whisperService') || id.includes('elevenLabs') || id.includes('nativeVoice')) return 'svc-voice';
  if (id.includes('geminiService') || id.includes('openAiService') || id.includes('anthropicService') ||
      id.includes('perplexity') || id.includes('unifiedAIService') || id.includes('advancedAI') ||
      id.includes('conversationalAI') || id.includes('ragService') || id.includes('realtimeAgent') ||
      id.includes('aiInsights') || id.includes('aiFormatting') || id.includes('aiLab') ||
      id.includes('smartCompose') || id.includes('proactiveSuggestions') || id.includes('toolRegistry') ||
      id.includes('agentHandoffService') || id.includes('conversationIntelligenceService')) return 'svc-ai';
  if (id.includes('emailSync') || id.includes('emailAI') || id.includes('emailFilter') ||
      id.includes('emailMeet') || id.includes('emailSearch') || id.includes('emailSignature') ||
      id.includes('emailTemplate') || id.includes('emailAccounts') || id.includes('gmailService') ||
      id.includes('enhancedEmail') || id.includes('offlineEmail') || id.includes('confidentialEmail') ||
      id.includes('vacationResponder') || id.includes('emailService') || id.includes('unifiedInbox') ||
      id.includes('bulkOperationsService') || id.includes('emailCampaignService') ||
      id.includes('labelService') || id.includes('webhookService')) return 'svc-email';
  if (id.includes('googleCalendar') || id.includes('calendarAI') || id.includes('customEventTypes') ||
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
    // model geminiService dynamic-import fix: its calendar import becomes dynamic
    if (process.env.GEMINI_DYN && f.replace(/\\/g, '/').endsWith('geminiService.ts') && m[1] === './googleCalendarService') continue;
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

console.log('\n=== edge provenance for suspect edges ===');
for (const k of ['svc-core -> svc-calendar', 'svc-core -> svc-email', 'svc-core -> svc-storage', 'svc-core -> svc-voice',
                 'svc-ai -> svc-calendar', 'svc-ai -> svc-core', 'svc-ai -> svc-email']) {
  console.log(`\n${k}:`);
  (why.get(k) || ['  (none)']).forEach(l => console.log(l));
}
