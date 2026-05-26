---
name: backend-setup
description: Interactively walk the human through the deploy-side of #99 — host server.js, wire VITE_BACKEND_URL, register CRM OAuth redirect URIs, and verify round-trips. Claude does the code prep + smoke tests; the human does the host/provider dashboard clicks.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - WebFetch
  - TodoWrite
---

<objective>
Get the Pulse auxiliary Express backend (`server.js`) actually running in production and wired to the deployed frontend — the **human-owned remainder of [#99](https://github.com/FatherSonOne/Pulse-1/issues/99)** that `/launch-prep` could not finish because it needs a hosting decision and provider credentials.

This command is a **guided, interactive walk-through**, not an autonomous job. The split:

- **Claude does:** the repo-side code prep (make `PORT` env-aware, add a backend start/deploy config, fix the `process.env` client-id bug, set `VITE_BACKEND_URL` for the frontend build), and runs the round-trip smoke tests once a URL exists.
- **The human does (only you can):** create the host account, click deploy / connect the repo, paste secret env vars into the host dashboard, register OAuth redirect URIs in each provider's developer console, approve any billing.

Work through it **one phase at a time**. After each phase that needs a dashboard action, Claude pauses, tells you exactly what to click, and waits for you to say "done" (and paste back any URL/value it needs) before continuing.

Usage:
- `/backend-setup` — start (or resume) the walk-through from the first incomplete phase.
- `/backend-setup status` — print which phases are done vs pending and stop.
</objective>

<ground-truth>
**Verified facts about `server.js` (re-confirm with a quick read if the file changed since 2026-05-25):**

- ESM (`"type": "module"`), Express 5. Started by `npm run server` → `node server.js`.
- **`const PORT = 3003;` is hardcoded** (server.js:12) and `app.listen(PORT)` (server.js:~2352). Railway/Render/Fly/Heroku inject a `$PORT` — this MUST become `process.env.PORT || 3003` or the deploy will bind the wrong port and health checks fail. This is the #1 code prep.
- Loads `dotenv.config({ path: '.env.local' })` (server.js:9). In production the host injects env vars directly; a missing `.env.local` is harmless (dotenv no-ops), so no change strictly required, but env must come from the host dashboard, not a committed file. **Never commit real secrets.**
- Has a no-auth **`GET /api/health`** (server.js:~2260) — use it as the platform health-check path.
- **Server-side env vars it reads** (`grep -oE "process\.env\.[A-Z_]+" server.js` to refresh): `SUPABASE_URL`/`VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`** (the `sb_secret_*` format — see memory `reference_supabase_service_role_key`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and optionally `LOGOS_VISION_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`. **Confirm the exact set at runtime — do not trust this list blindly.**
- **Twilio + Slack proxies take the user's tokens per-request from the client body** (`/api/twilio/proxy`, `/api/slack/proxy`) — so they need **no** server-side Twilio/Slack secret. Good: fewer secrets to host.
- **CRM OAuth callback** is `GET /api/crm/callback/:platform` (server.js:~725). Before telling the human which secrets to set, **read that handler** to enumerate exactly which per-provider client-secret env vars it expects — don't guess the names.
- CORS already allow-lists `process.env.VITE_APP_URL`, `VITE_API_URL`, `PRODUCTION_URL`, `VERCEL_URL`, a hardcoded `https://pulse.logosvision.org`, and `*.vercel.app` previews (server.js:71-99). So the deployed **frontend** origin must either match one of those or be supplied via `PRODUCTION_URL`/`VITE_APP_URL` on the **backend** host.

**Deploy topology (verified 2026-05-25):**
- Root **`Dockerfile` builds the FRONTEND** (multi-stage → nginx serving `dist`). It does **not** run `server.js`.
- **`vercel.json` deploys the SPA to Vercel** (framework vite, `dist`). So the frontend is static-hosted on Vercel; a long-running Express process **cannot** ride that same deploy. `server.js` needs its **own** Node host.
- Hosting convention (memory `project_qntm_ecos_attribution`): stays on `*.logosvision.org` until the qntmecos.com migration. A backend at e.g. `https://pulse-api.logosvision.org` or a host-provided subdomain both work.

**The frontend already consumes the backend URL** via `src/config/backend.ts` → `BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003'` (shipped in #99, commit `7919edb`). So **`VITE_BACKEND_URL` is a FRONTEND build-time var set in Vercel**, whose value is the **deployed backend's** public origin (no trailing slash). Getting this direction backwards is the most common mistake — state it plainly to the human.

**Known latent bug to fix while here:** `src/components/crm/wizard/OAuthConfiguration.tsx:89` reads CRM client IDs via `process.env[...]`, which is always `undefined` under Vite (must be `import.meta.env[...]`). The CRM OAuth flow alerts "not configured" until this is fixed. Fix it in Phase 4 since you're wiring CRM anyway.
</ground-truth>

<process>

## Step 0 — Session safety + status (CLAUDE.md is law)

```bash
git branch --show-current      # expect: main
git status --short             # expect: clean, or only this session's work
```
- On `main`, clean tree → proceed. **Never branch, never run a destructive git op.** Commit each code-prep unit with explicit paths + conventional-commit form + the `Co-Authored-By: Claude Opus 4.7 (1M context)` trailer.
- If there's uncommitted work this session didn't author → **pause-and-verify**: report the paths, ask the human, do not work around it.

Re-confirm the ground-truth facts with a quick `git grep`/read if `server.js` changed since 2026-05-25. Then track progress with TodoWrite (one todo per phase below) so a resumed run knows where it stopped. If the arg is `status`, print the phase checklist and stop.

## Step 1 — Decide the host (AskUserQuestion)

The backend is a long-running Node process, so it needs a process host, not Vercel static. Ask the human to pick, with honest trade-offs:

- **Railway** *(recommended)* — connect the GitHub repo, set start command `npm run server`, paste env vars, get a public URL in minutes. Usage-based pricing. Cleanest "deploy a Node server from a repo" path.
- **Render** — free tier exists (cold-starts after idle, which will make first Slack/Twilio calls slow), Node web service, similar repo-connect flow.
- **Fly.io** — needs a `fly.toml` + Dockerfile-for-the-backend; more control, more setup. Best if you want it at a logosvision.org subdomain with fine-grained regions.
- **Other / already decided** — let the human tell you (e.g. an existing VPS, Cloud Run, or converting routes to Supabase edge functions — note that last one is a much larger refactor, not this command's job).

Do NOT pick for them — the answer changes every subsequent instruction. Record the choice in the todo notes.

## Step 2 — Code prep (Claude does this, commit each unit)

These are safe, host-agnostic repo changes that must land before any deploy works:

1. **Make the port env-aware** — `server.js`: `const PORT = process.env.PORT || 3003;`. Commit: `fix(server): respect host-injected PORT for deployment (#99)`.
2. **Add the backend's start/deploy config for the chosen host** (only the one they picked):
   - Railway/Render: confirm `npm run server` is the start command (it is). Optionally add a `Procfile` (`web: node server.js`) if the host wants one. Do NOT touch the existing frontend `Dockerfile`/`vercel.json`.
   - Fly.io: scaffold a **backend** `Dockerfile` (e.g. `Dockerfile.server` — node:18-alpine, `npm ci`, `CMD ["node","server.js"]`, `EXPOSE` the port) + a minimal `fly.toml` pointing health checks at `/api/health`. Keep it clearly separate from the frontend Dockerfile.
   - Commit the new file(s) immediately (CLAUDE.md "commit new files before walking away").
3. **Fix the CRM client-id bug** — `OAuthConfiguration.tsx:89` `process.env[...]` → `import.meta.env[...]`. Commit: `fix(crm): read OAuth client IDs from import.meta.env, not process.env (#99)`. (Defer if the human isn't wiring CRM in this pass — note it stays broken until then.)

Run the targeted check after edits (memory `reference_pulse_tsc_oom`): `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "server|OAuthConfiguration"` → gate on no NEW errors. Push.

## Step 3 — Deploy the backend (human clicks; Claude narrates exactly what to do)

Give host-specific, click-level steps for the chosen host. The shape:
1. Create the project / connect the GitHub repo (`FatherSonOne/Pulse-1`), branch `main`.
2. Set the **start command** to `npm run server` (or the Dockerfile CMD for Fly).
3. Set the **health-check path** to `/api/health`.
4. Paste the **server-side env vars** — first re-read `server.js` + the `/api/crm/callback` handler to produce the **exact** list the human must set (Supabase URL/anon/**service-role**, Google client id/secret/redirect, plus any CRM client secrets the callback expects, plus optional AI keys). Pull current values from the human's local `.env.local` **names only** — never print secret values into the transcript or any committed file; tell the human which keys to copy, let them paste into the dashboard.
5. **PAUSE.** Ask the human to deploy and paste back the resulting **public backend URL** (e.g. `https://pulse-1-production.up.railway.app`). Wait.
6. Smoke-test it the moment you have the URL: `curl -fsS <BACKEND_URL>/api/health` → expect a 200 JSON. If it fails, debug (port binding, missing env, build logs) before moving on.

## Step 4 — Wire the frontend + register OAuth redirect URIs

1. **Set `VITE_BACKEND_URL` in the FRONTEND deploy (Vercel)** to the backend URL from Step 3 (no trailing slash). Tell the human: Vercel → Project → Settings → Environment Variables → add `VITE_BACKEND_URL` for Production (and Preview if desired) → **redeploy** (Vite inlines env at build time, so a redeploy is required). Restate the direction: this is a *frontend* var holding the *backend* origin.
2. **Set the backend's `GOOGLE_REDIRECT_URI`** (and re-register it in Google Cloud Console → Credentials → the OAuth client) to `<BACKEND_URL>/api/google/...` matching what the callback expects — read the Google callback handler to get the exact path.
3. **Register CRM redirect URIs** — for each provider the human uses, in that provider's developer console, add the redirect URI `<BACKEND_URL>/api/crm/callback/<platform>`:
   - HubSpot → `.../api/crm/callback/hubspot`
   - Salesforce → `.../api/crm/callback/salesforce`
   - Pipedrive → `.../api/crm/callback/pipedrive`
   - Zoho → `.../api/crm/callback/zoho`
   Also set each `VITE_<PLATFORM>_CLIENT_ID` in Vercel (frontend) and the matching client secret on the backend host (re-read the callback handler for exact secret env-var names). **PAUSE** after listing them; wait for the human to confirm each provider is registered.
4. Ensure the deployed **frontend origin** is allowed by the backend CORS — set `PRODUCTION_URL` (or `VITE_APP_URL`) on the backend host to the frontend origin if it isn't already one of the allow-listed values.

## Step 5 — Verify the round-trips (Claude runs; needs a live token)

Confirm each integration end-to-end. `/api/health` is unauthenticated; the proxies need a real bearer/token, so either drive them from the deployed UI or curl with a token the human provides (see memory `reference_pulse_e2e_token_export` for grabbing a Supabase access token):

- **Health:** `curl -fsS <BACKEND_URL>/api/health` → 200.
- **Slack:** from the app, connect Slack and load channels (hits `/api/slack/proxy`). Expect channels to return, not a CORS/❌ network error.
- **Twilio:** from the app, the SMS surface (note: in-app SMS is mock-flagged per #100 — verify the proxy reachability, not necessarily live send).
- **Gmail refresh:** trigger a token refresh (`/api/google/refresh-token`) — expect a fresh access token, not a 500.
- **CRM:** run one provider's OAuth from the wizard end-to-end; expect the callback to land and an integration row to be created.

Capture each result (pass/fail + evidence) for the issue comment.

## Step 6 — Close the loop with the roadmap

When the round-trips pass (fully or partially):
1. **Update `docs/PULSE_PRELAUNCH_ROADMAP.md`**: flip the #99 Status-Table row from `blocked` → `done` (or note which sub-parts remain), update the Capability-Matrix rows whose "depends on the localhost backend" caveat is now resolved (Unified Inbox, Email/Gmail, CRM sync feeders), refresh the Resume Pointer's "Open blockers" (drop the #99 deploy item), and add a dated Changelog line. Commit `docs(roadmap): #99 backend deployed + integrations live`.
2. **Comment on #99** with the backend URL (host, not secrets), the per-route smoke-test results, and the commit SHAs. If fully verified, `gh issue close 99` and swap `status: blocked` → remove it. If partial, keep it open and state precisely what's left.
3. Push.

## Step 7 — Report + stop

Print: backend URL, which integrations are verified live, what (if anything) remains, and the commit SHAs. Remind the human that `#108` (CRM sync pagination) was gated on #99 and is now unblocked for a future `/launch-prep` run.

</process>

<guardrails>
- **Interactive, not autonomous.** Pause at every dashboard handoff; never pretend a human-only step (account creation, secret paste, provider registration, billing) is done. Wait for confirmation + any URL/value you need.
- **Secrets discipline.** Never print secret *values* into the transcript, a commit, or any tracked file. Reference env vars by **name**; the human pastes values into host/provider dashboards. gitleaks runs on every commit — don't try to bypass it.
- **Git discipline (CLAUDE.md).** Stay on `main`, commit each code-prep unit with explicit paths + conventional commits + the `Co-Authored-By` trailer, commit new files immediately, never branch or run a destructive git op without explicit instruction.
- **Don't break the frontend deploy.** The root `Dockerfile` and `vercel.json` serve the SPA — leave them alone; backend deploy config is separate.
- **Truth-in-product.** If a round-trip can't be verified, say so plainly and leave #99 open — don't mark it done on hope.
- **Stay in scope.** This command finishes #99's deploy. It does not migrate routes to edge functions, build push (#101), or touch SMS mocking (#100) — flag those as separate roadmap items if they come up.
</guardrails>
