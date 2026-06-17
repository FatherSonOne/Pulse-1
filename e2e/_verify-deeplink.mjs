// Live verification of the cross-surface "Open source" deep-link (P1/P2/P3).
// For each seeded DEEPLINK-VERIFY task: load cockpit → open focal → click
// "Open <source>" → assert the EXACT originating item opens on the target surface.
// Non-destructive: seeded tasks are thrown away via MCP after this run.
// Requires: dev server on :5173 + a fresh e2e/.auth/user.json token.
import { chromium } from '@playwright/test';
import fs from 'fs';

const TARGET = process.env.TARGET || 'http://localhost:5173';
const DIR = '.deeplink-verify';
fs.mkdirSync(DIR, { recursive: true });
const log = (...a) => console.log(...a);

// Seeded fixtures (ids from the MCP seed step).
const MSG_ID = '14d7a9d7-c178-42af-a109-bbf3032aee2a';
const EMAIL_SUBJECT = 'Introducing Framer 3.0';
const NOTE_TITLE = 'Board call prep';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: 'e2e/.auth/user.json' });
const results = {};

async function newPage() {
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6500);
  const trial = page.locator('[aria-label="Trial expired"]');
  if (await trial.count()) { await trial.locator('button').first().click().catch(() => {}); await page.waitForTimeout(800); }
  return page;
}

async function openCockpitTask(page, title) {
  await page.getByText('Decisions & Tasks', { exact: true }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3500);
  const row = page.locator('.ck-qitem-title', { hasText: title }).first();
  await row.scrollIntoViewIfNeeded().catch(() => {});
  await row.click({ timeout: 8000 });
  await page.waitForTimeout(1200);
}

async function clickOpenSource(page, labelRe) {
  const btn = page.locator('.ck-act-btn', { hasText: labelRe }).first();
  const found = await btn.count();
  await btn.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3500);
  return found > 0;
}

// ── Messages: exact-message focus + flash ──
try {
  const page = await newPage();
  await openCockpitTask(page, 'DEEPLINK-VERIFY messages');
  await page.screenshot({ path: `${DIR}/msg-01-focal.png` }).catch(() => {});
  results.messages_openBtn = await clickOpenSource(page, /Open message/);
  // Bubble for the exact message must be in the DOM (conversation opened to its thread).
  const bubble = page.locator(`[data-message-id="${MSG_ID}"]`);
  results.messages_bubblePresent = (await bubble.count()) > 0;
  // Flash attribute is set ~450ms after open and stripped at 2200ms — poll briefly.
  let flashed = false;
  for (let i = 0; i < 12; i++) {
    if (await page.locator(`[data-message-id="${MSG_ID}"][data-focus-flash="true"]`).count()) { flashed = true; break; }
    await page.waitForTimeout(200);
  }
  results.messages_flashed = flashed;
  await page.screenshot({ path: `${DIR}/msg-02-opened.png` }).catch(() => {});
  await page.close();
} catch (e) { results.messages_err = e.message; }

// ── Email: exact-email reader panel ──
try {
  const page = await newPage();
  await openCockpitTask(page, 'DEEPLINK-VERIFY email');
  await page.screenshot({ path: `${DIR}/email-01-focal.png` }).catch(() => {});
  results.email_openBtn = await clickOpenSource(page, /Open email/);
  await page.waitForTimeout(1500);
  results.email_readerPanel = (await page.locator('.reader-panel').count()) > 0;
  results.email_subjectShown = (await page.getByText(EMAIL_SUBJECT, { exact: false }).count()) > 0;
  await page.screenshot({ path: `${DIR}/email-02-opened.png` }).catch(() => {});
  await page.close();
} catch (e) { results.email_err = e.message; }

// ── Relay: exact-note selection ──
try {
  const page = await newPage();
  await openCockpitTask(page, 'DEEPLINK-VERIFY relay');
  await page.screenshot({ path: `${DIR}/relay-01-focal.png` }).catch(() => {});
  results.relay_openBtn = await clickOpenSource(page, /Open Relay/);
  await page.waitForTimeout(2000);
  results.relay_noteShown = (await page.getByText(NOTE_TITLE, { exact: false }).count()) > 0;
  await page.screenshot({ path: `${DIR}/relay-02-opened.png` }).catch(() => {});
  await page.close();
} catch (e) { results.relay_err = e.message; }

// ── Meeting: section-level routing (exact-open deferred) ──
try {
  const page = await newPage();
  await openCockpitTask(page, 'DEEPLINK-VERIFY meeting');
  await page.screenshot({ path: `${DIR}/meeting-01-focal.png` }).catch(() => {});
  results.meeting_openBtn = await clickOpenSource(page, /Open meeting/);
  // Section-level: just assert we left the cockpit onto the Meetings surface.
  results.meeting_leftCockpit = (await page.locator('.ck-qitem-title').count()) === 0;
  await page.screenshot({ path: `${DIR}/meeting-02-opened.png` }).catch(() => {});
  await page.close();
} catch (e) { results.meeting_err = e.message; }

log('DEEPLINK VERIFY RESULTS:\n' + JSON.stringify(results, null, 2));
await browser.close();
