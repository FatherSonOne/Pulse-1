# Microsoft / Outlook Contacts Import — Implementation Handoff (2026-06-15)

## What this is

The Contacts import wizard ("Choose who Pulse sees") used to be **Google-only** —
even with a Microsoft account connected, it had no source to pull Outlook
contacts from. The `Contacts.Read` scope was requested at Microsoft login and
the Settings card advertised a "Contacts" tile, but **no code ever read those
contacts**. This change builds the Microsoft path as a faithful, server-side
mirror of the Google path (the durable token model the user chose).

## Status

- **Code: complete and committed** (8 commits on `main`, listed below).
- **Type-check: clean** — `tsc --noEmit` shows no new errors from this work
  (893 total vs 894 pre-existing baseline; the lone TrimWizard hit is a
  pre-existing `react-window` `rowComponent` typing issue on an untouched line).
- **Live end-to-end: BLOCKED on your Azure + env config** (see "What you must
  do" below). The happy-path (fast-path token right after a fresh Microsoft
  login) works without config; durable refresh needs the server secret.

## How it works (token model — mirror of Google)

| Concern | Google (existing) | Microsoft (new) |
|---|---|---|
| Refresh token store | `public.user_google_tokens` | `public.user_microsoft_tokens` (uuid PK → auth.users, RLS-on, server-only) |
| Server refresh endpoint | `/api/google/refresh-token` | `/api/microsoft/refresh-token` |
| Store-on-sign-in endpoint | `/api/google/store-refresh-token` | `/api/microsoft/store-refresh-token` |
| Client refresh module | `services/google/googleTokenRefresh.ts` | `services/microsoft/microsoftTokenRefresh.ts` |
| Contacts service | `googleContactsService.ts` (People API) | `microsoftContactsService.ts` (Graph `/me/contacts`) |
| Secret holder | server.js (`GOOGLE_LOGIN_CLIENT_SECRET`) | server.js (`MICROSOFT_CLIENT_SECRET`) — **you must set this** |

- On `SIGNED_IN` with the **azure** active provider, the `provider_refresh_token`
  is persisted to `user_microsoft_tokens` (previously every sign-in wrote to the
  Google table — a latent mis-store this fixes).
- The contacts service resolves a Graph token by: (1) `session.provider_token`
  **only when the active provider is azure** (so a Google-login token is never
  mistaken for a Graph token), else (2) backend refresh using the stored token.
- **Azure rotates refresh tokens** on every refresh, so the server persists the
  returned `refresh_token` (unlike Google, which omits it).
- Groups in the wizard derive from **Outlook categories** on the contacts (no
  extra scope; `MailboxSettings.Read` for masterCategories isn't granted). Users
  with no categories see one "Uncategorized" bucket — fully functional.

## What you must do (config — I can't do these)

These live in the Azure portal / Supabase dashboard / host env, not the repo.

1. **Azure portal** → App registrations → the Pulse app
   (`VITE_MICROSOFT_CLIENT_ID = 591bf117-e522-4279-a364-a1236116d4f3`):
   - **Certificates & secrets** → *New client secret* → copy the **Value**.
   - Confirm **API permissions** include delegated `Contacts.Read`, `User.Read`,
     `offline_access` (they're already in the login scope set).
   - Confirm a **Web** platform redirect URI exists for Supabase:
     `https://ucaeuszgoihoyrvhewxk.supabase.co/auth/v1/callback`.

2. **Supabase dashboard** → Auth → Providers → **Azure**: must be configured with
   **this same app** (`591bf117…`) + its client secret. (It already is if
   Microsoft login works today.) ⚠️ **The server's `MICROSOFT_CLIENT_SECRET`
   must belong to the same Azure app Supabase uses** — a refresh token can only
   be refreshed by its minting client. If Supabase's Azure provider points at a
   *different* app, set `MICROSOFT_CLIENT_ID` to that app and use its secret.

3. **Server env** (Render `pulse-api`, and local `.env` for `npm run dev:full`):
   - `MICROSOFT_CLIENT_SECRET=<the secret value>`  ← **required**, never `VITE_`-prefixed.
   - `MICROSOFT_CLIENT_ID` — optional (defaults to `VITE_MICROSOFT_CLIENT_ID`).
   - `MICROSOFT_TENANT_ID` — optional (defaults to `common`).

Until `MICROSOFT_CLIENT_SECRET` is set, `/api/microsoft/refresh-token` returns
`MISSING_CREDENTIALS` (exactly like the Google endpoint behaves unconfigured).
A user who *just* logged in with Microsoft can still import immediately via the
session fast-path; the secret is what keeps it working past ~1h and across
non-Microsoft logins.

## How to verify live (after config)

1. `npm run dev:full` (backend must be up — Microsoft refresh is server-side).
2. Sign in with Microsoft (or have it connected). Open Contacts → import wizard.
3. If both Google + Microsoft are connected, a **Google | Outlook** toggle
   appears; pick Outlook. Your Outlook contacts load (grouped by category, or one
   "Uncategorized" bucket). Pick → tag → import.
4. Imported rows land in `contacts` with `source='microsoft'`, `platform='microsoft'`,
   and show a "From Outlook" provenance chip. They appear in the People list.
5. Durability: stay signed in past ~1h (or reload) and re-open — contacts still
   load (server refresh kicking in) without a reconnect prompt.

## Deferred (v1 scope notes)

- **Contact folders**: v1 pulls the default `/me/contacts` collection (covers
  personal accounts). Sub-folder contacts and folder-based grouping are not yet
  fetched; grouping uses categories instead.
- **Reconnect gesture** for Microsoft re-runs the full OAuth grant (no dedicated
  Microsoft reconnect modal like Google's). Functional, slightly heavier UX.
- The shared wizard header copy still says "Skipped contacts stay on Google" —
  cosmetic; left as-is to avoid changing Google's established string.
- No backfill/incremental sync; this is a one-shot selective import like Google.

## Commits (on `main`)

1. `feat(contacts): add user_microsoft_tokens table + allow 'microsoft' source` — migration
2. `feat(contacts): teach the contact model + trim/provenance about 'microsoft'`
3. `feat(server): Microsoft token store + /api/microsoft/refresh-token endpoints`
4. `feat(contacts): Microsoft Graph contacts service + token-refresh client module`
5. `feat(auth): persist Microsoft refresh token on azure sign-in`
6. `feat(contacts): make the import wizard provider-aware (Google + Outlook)`
7. `fix(contacts): widen DBContact.source to include 'microsoft'`

(The migration was applied live to project `ucaeuszgoihoyrvhewxk` via the
Supabase MCP — dry-run in a rolled-back transaction first, then applied once.)
