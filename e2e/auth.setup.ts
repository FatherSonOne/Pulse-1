/**
 * Playwright auth setup — captures a real Supabase session as storageState
 *
 * One-time interactive bootstrap for the e2e suite. Pulse uses Google OAuth
 * (no password grant for production accounts), so headless programmatic login
 * is not viable. Instead, this setup project opens a headed browser, asks the
 * tester to sign in manually, then snapshots the resulting browser storage
 * to `e2e/.auth/user.json`. All subsequent tests inherit that session via
 * the `storageState` config in playwright.config.ts.
 *
 * Run once when first cloning the repo or after the saved session expires:
 *   npx playwright test --project=setup --headed
 *
 * The captured file is gitignored — it contains a Supabase JWT that must
 * not be committed.
 *
 * Also persists `localStorage.ff_pulseMessagesV2 = "on"` so every test that
 * relies on the saved state lands on the V2 surface without needing the
 * `?ff_pulseMessagesV2=on` query param.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const AUTH_DIR = path.join('e2e', '.auth');
const STORAGE_FILE = path.join(AUTH_DIR, 'user.json');

setup('authenticate', async ({ page }) => {
  // Ensure the .auth directory exists before Playwright tries to write to it.
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // Short-circuit: if a storageState file already exists and contains a
  // Supabase auth token, trust it and skip the OAuth dance. Tokens auto-
  // refresh inside the SDK on first navigation, so a slightly-expired
  // file still works as long as the refresh window hasn't elapsed.
  // To force a fresh capture, delete e2e/.auth/user.json before running.
  if (fs.existsSync(STORAGE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
      const ls = parsed?.origins?.[0]?.localStorage ?? [];
      const hasAuth = ls.some(
        (e: { name?: string }) =>
          typeof e?.name === 'string' && e.name.startsWith('sb-') && e.name.endsWith('-auth-token'),
      );
      if (hasAuth) {
        console.log(`[auth.setup] Reusing existing storageState at ${STORAGE_FILE}`);
        return;
      }
    } catch {
      // Malformed file — fall through to the full capture path.
    }
  }

  // Land on the V2 surface — the URL param flips the override AND persists
  // it to localStorage so subsequent navigations stay on V2.
  await page.goto('/?ff_pulseMessagesV2=on');

  // Detect whether a session is already present (e.g. the dev browser is
  // currently signed in via Google). If yes, skip the manual sign-in wait.
  const sidebarMessagesBtn = page.getByRole('button', { name: 'Messages', exact: true }).first();
  const alreadySignedIn = await sidebarMessagesBtn
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (!alreadySignedIn) {
    // Print a clear instruction to the human running this setup, then wait
    // up to 5 minutes for them to complete Google OAuth.
    console.log(
      '\n[auth.setup] Please sign in via Google OAuth in the headed browser.\n' +
        '             The setup will resume automatically once the Pulse sidebar\n' +
        '             renders. You have 5 minutes.\n',
    );
    await sidebarMessagesBtn.waitFor({ state: 'visible', timeout: 5 * 60 * 1000 });
  }

  // Sanity assertion — we're inside the app shell.
  await expect(sidebarMessagesBtn).toBeVisible();

  // Belt-and-braces: ensure the V2 override is persisted to localStorage,
  // not just the in-memory URLSearchParams reading at boot.
  await page.evaluate(() => {
    window.localStorage.setItem('ff_pulseMessagesV2', 'on');
  });

  await page.context().storageState({ path: STORAGE_FILE });

  console.log(`\n[auth.setup] Saved storageState to ${STORAGE_FILE}\n`);
});
