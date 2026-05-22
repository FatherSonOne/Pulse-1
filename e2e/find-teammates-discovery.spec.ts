/**
 * Phase 1 — Find Teammates on Pulse: Discovery tile chooser E2E smoke
 *
 * PREREQUISITES (this test does NOT run without them):
 *   1. A running Vite dev server at http://localhost:5173
 *      (`npm run dev` in pulse1-contacts-pulse-users/)
 *   2. An authenticated Supabase session in the browser's localStorage
 *      (storageState-based auth is the correct approach; this repo does not
 *      yet have a saved storageState fixture, so the test is marked
 *      test.skip — see contacts-phase-c.spec.ts for the same convention).
 *   3. The `discover_pulse_users` Supabase RPC is mocked at the network
 *      layer inside the test so no live DB is required for the UI assertions.
 *
 * To promote this from skipped → active once the auth fixture exists:
 *   1. Run the app, sign in manually, then:
 *      `npx playwright codegen --save-storage=e2e/fixtures/auth.json http://localhost:5173`
 *   2. Add `storageState: 'e2e/fixtures/auth.json'` to playwright.config.ts use block.
 *   3. Remove (or flip) the test.skip guard below.
 *
 * Selector strategy: role/name — all locators use getByRole()+getByText()
 * to stay aligned with the accessibility tree rather than CSS class names.
 *
 * @tag @smoke @contacts @phase1
 */

import { test, expect, type Route } from '@playwright/test';

// ─── Suite ──────────────────────────────────────────────────────────────────

test.describe('Phase 1 — Find Teammates discovery tile chooser', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Intercept the Supabase RPC so the sheet can render without a real DB.
    // The Supabase client calls: POST /rest/v1/rpc/discover_pulse_users
    await page.route('**/rest/v1/rpc/discover_pulse_users', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            user_id: 'fake-user-001',
            display_name: 'Alice Demo',
            handle: 'alice',
            avatar_url: null,
            shared_workspace_id: 'ws-fake-001',
            shared_workspace_role: 'member',
            online_status: 'online',
            already_in_contacts: false,
            joined_at: '2026-01-01T00:00:00Z',
          },
          {
            user_id: 'fake-user-002',
            display_name: 'Bob Demo',
            handle: 'bob',
            avatar_url: null,
            shared_workspace_id: 'ws-fake-001',
            shared_workspace_role: 'admin',
            online_status: 'away',
            already_in_contacts: true,
            joined_at: '2026-01-02T00:00:00Z',
          },
        ]),
      });
    });
  });

  test(
    'happy path: three-tile chooser renders, Find Teammates sheet opens and closes',
    async ({ page }) => {
      // ── SKIP GUARD ───────────────────────────────────────────────────────
      // Remove this when a storageState auth fixture is available in the repo.
      test.skip(
        true,
        'Requires migration applied + dev server + authenticated storageState; smoke for future CI',
      );

      // ── 1. Navigate to Contacts ──────────────────────────────────────────
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // The Contacts nav item renders as a button in the sidebar rail.
      // Pattern mirrors contacts-phase-c.spec.ts navigation strategy.
      const contactsNav = page
        .getByRole('button', { name: /contacts/i })
        .first();
      await expect(contactsNav).toBeVisible({ timeout: 8000 });
      await contactsNav.click();
      await page.waitForLoadState('networkidle');

      // ── 2. Open the Add Contact chooser ─────────────────────────────────
      // The sidebar footer renders:
      //   <button class="contacts-add-btn">
      //     <Plus /> Add Contact
      //   </button>
      const addContactBtn = page.getByRole('button', { name: /add contact/i });
      await expect(addContactBtn).toBeVisible({ timeout: 5000 });
      await addContactBtn.click();

      // ── 3. Chooser dialog appears ────────────────────────────────────────
      // role="dialog" aria-labelledby="add-contact-chooser-title"
      const chooserDialog = page.getByRole('dialog', { name: /add a contact/i });
      await expect(chooserDialog).toBeVisible({ timeout: 3000 });

      // ── 4. Assert three tiles render in the expected order ───────────────
      // Source of truth: ContactsRedesigned.tsx lines ~1716-1784
      //   Tile #1 — "Find teammates on Pulse"
      //   Tile #2 — "Import from Google"
      //   Tile #3 — "Add manually"

      const tiles = chooserDialog.getByRole('button');

      // Tile #1
      const tile1 = tiles.nth(0);
      await expect(tile1).toContainText('Find teammates on Pulse');

      // Tile #2
      const tile2 = tiles.nth(1);
      await expect(tile2).toContainText('Import from Google');

      // Tile #3
      const tile3 = tiles.nth(2);
      await expect(tile3).toContainText('Add manually');

      // ── 5. Assert color-slot integrity ───────────────────────────────────
      // Tile #1 icon wrapper uses `--pulse-tone-info-soft` (info-soft slot).
      // We assert the computed background-color of the icon <div> resolves to
      // a non-transparent value AND differs from Tile #3's icon background.
      //
      // We locate each icon <div> by its position within the tile — the icon
      // is the first child div inside the tile button.
      const tile1IconWrapper = tile1.locator('div').first();
      const tile3IconWrapper = tile3.locator('div').first();

      // The inline `style` attributes set the background to CSS custom
      // property references.  getComputedStyle resolves them to RGB values.
      const tile1BgRaw = await tile1IconWrapper.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor,
      );
      const tile3BgRaw = await tile3IconWrapper.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor,
      );

      // Neither should be fully transparent.
      expect(tile1BgRaw).not.toBe('rgba(0, 0, 0, 0)');
      expect(tile3BgRaw).not.toBe('rgba(0, 0, 0, 0)');

      // Regression guard: Tile #3 ("Add manually") must NOT share the same
      // background as Tile #1 ("Find teammates") — palette collision fix.
      expect(tile1BgRaw).not.toEqual(tile3BgRaw);

      // ── 6. Click "Find teammates on Pulse" → FindTeammatesSheet opens ───
      await tile1.click();

      // The chooser should close and FindTeammatesSheet should open.
      // FindTeammatesSheet renders:
      //   role="dialog" aria-labelledby="find-teammates-title"
      //   h2#find-teammates-title text: "Teammates on Pulse"
      const findTeammatesDialog = page.getByRole('dialog', {
        name: /teammates on pulse/i,
      });
      await expect(findTeammatesDialog).toBeVisible({ timeout: 4000 });

      // The chooser dialog should be gone (only one dialog at a time).
      await expect(chooserDialog).toHaveCount(0, { timeout: 2000 });

      // ── 7. Close the sheet via the X button ─────────────────────────────
      // FindTeammatesSheet: <button aria-label="Close">
      const closeBtn = findTeammatesDialog.getByRole('button', { name: /close/i });
      await closeBtn.click();

      await expect(findTeammatesDialog).toHaveCount(0, { timeout: 3000 });
    },
  );
});
