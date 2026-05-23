# Pulse E2E — Playwright

## One-time setup

The e2e suite reads an authenticated Supabase session from
`e2e/.auth/user.json`. That file is **gitignored** (it contains a JWT) so
each developer must capture their own.

```powershell
# 1. Make sure the Vite dev server is reachable on http://localhost:5173
#    (Playwright will start one automatically if not, but you can also
#     run `npm run dev` in another terminal.)

# 2. Run the headed setup project. A Chromium window will open.
npx playwright test --project=setup --headed
```

When the window opens, sign in via Google OAuth as the test account you
want the suite to run as. The script will detect the rendered sidebar,
write `e2e/.auth/user.json`, and exit.

After that, every other project (`chromium`, `firefox`, `webkit`,
`Mobile Chrome`, `Mobile Safari`) loads that storageState automatically
via the `dependencies: ['setup']` wiring in `playwright.config.ts`.

The setup script also persists the `pulseMessagesV2` feature flag override
to `localStorage.ff_pulseMessagesV2 = "on"`, so tests that exercise the
Messages V2 surface land on V2 without needing a query-param dance.

## Running tests

```powershell
# All tests, all browsers
npm run test:e2e

# One spec, chromium only — much faster while iterating
npx playwright test messages-coral-cockpit-a11y --project=chromium

# Headed (watch what happens), with the inspector
npx playwright test --project=chromium --headed --debug
```

## When the saved session expires

Supabase sessions refresh automatically until the refresh token's TTL
elapses (~30 days for Pulse). If `npm run test:e2e` starts failing with
auth errors, just re-run the setup step:

```powershell
npx playwright test --project=setup --headed
```

## Notes

- Pulse is a single-page app with **no URL routes for views**. `view`
  state (the `AppView` enum) drives which surface is active. Test
  helpers must navigate by clicking the Sidebar nav button, not by
  calling `page.goto('/messages')` or `page.waitForURL`.
- The `pulseMessagesV2` flag stays `enabled: false` in production. Tests
  that need V2 either rely on the setup-persisted localStorage override
  or pass `?ff_pulseMessagesV2=on` themselves.
- `e2e/fixtures/test-data.ts` contains placeholder test users with
  fictional passwords (`test@example.com / password123`). These are NOT
  real Supabase accounts — they predate the storageState fixture and
  exist only for data shaping in mocked tests. Don't use them for login.
