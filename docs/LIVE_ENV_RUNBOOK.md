# Pulse Live Deployment — Env & Config Checklist

**Created:** 2026-06-07
**Why:** First real smoke test of the deployed stack (Vercel frontend +
Render backend `pulse-api-1epw.onrender.com` + Supabase `pulse-chat`
`ucaeuszgoihoyrvhewxk`) surfaced four console errors. All four are
**deployment-environment config gaps, not code bugs** — every one has a
graceful fallback in code. This doc is the single reference for clearing
them from the dashboards.

Source logs: production console at `pulse.logosvision.org`, 2026-06-07.

---

## The four issues at a glance

| # | Symptom (console) | Where the fix lives | Status |
|---|---|---|---|
| 1 | `POST /api/gmail/refresh-token 500` · `MISSING_CONFIG` | **Render** (3 `GMAIL_OAUTH_*` vars) | GCP project built; **fill Render → redeploy → connect** |
| 2 | `Google Client ID not configured … VITE_GOOGLE_CLIENT_ID` | **Vercel** (build-time) | set value → **rebuild** |
| 3 | `InvalidAccessError: applicationServerKey is not valid` | **Vercel** `VITE_VAPID_PUBLIC_KEY` (stale/bad) | set to verified value → **rebuild** |
| 4 | `[briefing] … Unterminated string … position 1821` | `ai-router` (`gemini-2.5-flash` thinking budget) | code/server fix — needs sign-off |

Verified facts (queried live, 2026-06-07):
- `user_gmail_tokens` table **exists** on `pulse-chat` with correct columns
  (so Gmail needs **no** Supabase work — config is all on Render).
- `pwa_settings.vapid_public_key` holds a **real, 87-char, well-formed**
  key set 2026-05-26 (the #101-verified one) — **do NOT regenerate**.

---

## Issue 1 — Gmail backend (Render)

`gmailConfigured()` ([server.js:490-492](../server.js#L490-L492)) requires all
three vars; any missing → the 500. These belong to the **third** Google
OAuth client — its own GCP project kept in **Testing** mode (keeps the login
client CASA-free). Tokens persist to `public.user_gmail_tokens` via the
service-role client ([server.js:482](../server.js#L482), [521-538](../server.js#L521-L538)).

Set on **Render → `pulse-api` → Environment** (already declared `sync:false`
in [render.yaml:56-61](../render.yaml#L56-L61), just blank):

| Var | Value / source |
|---|---|
| `GMAIL_OAUTH_CLIENT_ID` | Gmail GCP project → APIs & Services → Credentials → OAuth client → Client ID |
| `GMAIL_OAUTH_CLIENT_SECRET` | same OAuth client → Client secret |
| `GMAIL_OAUTH_REDIRECT_URI` | `https://pulse-api-1epw.onrender.com/api/gmail/auth/callback` |

### GCP project setup (done 2026-06-07 — recorded for history)
1. **Enable Gmail API** (APIs & Services → Library).
2. **OAuth consent screen / Google Auth Platform:** External, **Testing**.
3. **Scopes** (Data Access) — these four restricted scopes, matching
   [server.js:51-56](../server.js#L51-L56):
   ```
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/gmail.compose
   https://www.googleapis.com/auth/gmail.modify
   ```
4. **Test user** (Audience): `jehovahsneaky83@gmail.com`.
5. **OAuth client:** Web application; Authorized redirect URI =
   `https://pulse-api-1epw.onrender.com/api/gmail/auth/callback` (byte-for-byte).

> ⚠️ **7-day reconnect caveat.** In Testing publishing status, Google expires
> refresh tokens after **7 days** → the owner must reconnect Gmail ~weekly.
> The code handles it gracefully ([server.js:628-635](../server.js#L628-L635):
> `invalid_grant` → clears token → prompts reconnect). Going to Production
> would remove the limit but trigger CASA verification for the restricted
> scopes — the thing this separate project exists to avoid. Accept the weekly
> reconnect for v1.

**Verify:** after redeploy, `/api/gmail/refresh-token` should return
`404 GMAIL_NOT_CONNECTED` (not 500) until you click **Connect Gmail** in
Email settings; the consent flow bounces to `…/?gmail=connected`
([server.js:597](../server.js#L597)).

---

## Issue 2 — `VITE_GOOGLE_CLIENT_ID` (Vercel)

`console.warn` at [GoogleAccountSelector.tsx:108-110](../src/components/GoogleAccountSelector.tsx#L108-L110);
empty read at [line 99](../src/components/GoogleAccountSelector.tsx#L99) → the
Google Identity account picker early-returns.

- **Value:** the **login** client ID (`35770…`) — same as Supabase → Auth →
  Providers → Google → Client ID.
- **Goes to:** Vercel → Pulse project → Environment Variables (Production).
- ⚠️ `VITE_*` is **baked at build time** → must trigger a **fresh deploy**
  after saving (a no-rebuild redeploy won't pick it up).

---

## Issue 3 — Push VAPID key (Vercel only)

The browser error `applicationServerKey is not valid` is thrown at
`pushManager.subscribe()` purely from the **key's byte format** — it's a
malformed string, **not** a key/private-key mismatch (the browser never sees
the private key).

Priority logic ([pushNotificationService.ts:216-238](../src/services/pushNotificationService.ts#L216-L238)):
`VITE_VAPID_PUBLIC_KEY` is read first ([line 26](../src/services/pushNotificationService.ts#L26));
it only falls back to `pwa_settings.vapid_public_key` if the env value is
empty. Since the live DB value is **good** (verified below) yet push still
fails, the **Vercel build has a bad `VITE_VAPID_PUBLIC_KEY` overriding it**.

**Verified live (`pwa_settings`, updated 2026-05-26, the #101 `sent:1` key):**
```
BDosjYeKBkjz8j1T9wShKgT-EbdOPEdSDOeI4EoYaxNIiQ3ywQ4omv8u6iUBo3yYEgTQdcGSJtiPSDBwd4GRTmU
```
(87 chars = base64url of a 65-byte P-256 point. Public by design.)

**Fix (Vercel only — no Supabase change, no regen):** set
`VITE_VAPID_PUBLIC_KEY` (Production) to **exactly** the value above →
**rebuild**. (Deleting the var also works — the DB fallback is good — but
setting it explicitly matches the intended primary source.)

> If a browser already subscribed with the old bad key, `subscribe()` may
> keep erroring until the stale subscription is cleared (DevTools →
> Application → Service Workers → unsubscribe, or reinstall the PWA). Per-
> browser cleanup, not infra — only relevant if it errors *after* rebuild.

**Server side is already correct — leave it alone:** Supabase secrets
`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` and
`PUSH_DISPATCH_SECRET` were set + verified in #101. `PUSH_DISPATCH_SECRET`
lives in **both** `send-push` and `check-search-alerts`
([check-search-alerts/index.ts:28](../supabase/functions/check-search-alerts/index.ts#L28),
sent as `x-push-secret` at [:123](../supabase/functions/check-search-alerts/index.ts#L123)).

---

## Issue 4 — Daily briefing truncation (code/server — needs sign-off)

Lowest severity — falls back cleanly to the generic "Welcome back" briefing
([geminiService.ts:339-368](../src/services/geminiService.ts#L339-L368)), so
the app is fine; you just lose the personalized briefing that load.

**Root cause (code-grounded hypothesis, not yet empirically confirmed):**
- `thread_digest` → **`gemini-2.5-flash`** ([tasks.ts:50](../supabase/functions/ai-router/tasks.ts#L50),
  [:125](../supabase/functions/ai-router/tasks.ts#L125)) with **no
  `maxOutputTokens`** → 2048 default ([providers.ts:81](../supabase/functions/ai-router/providers.ts#L81)).
- 2.5 Flash is a **thinking** model; provider sets **no `thinkingConfig`**
  ([providers.ts:79-84](../supabase/functions/ai-router/providers.ts#L79-L84)).
  On 2.5, thinking tokens draw from the same `maxOutputTokens` budget, so
  ~1500 go to (invisible) thinking, leaving ~500 (~1821 chars) of visible
  JSON → truncated mid-string. Exact match for the logged error.
- [providers.ts:109-111](../supabase/functions/ai-router/providers.ts#L109-L111)
  **never checks `finishReason`**, so a `MAX_TOKENS` truncation passes
  downstream as if complete.

**To confirm:** log `candidates[0].finishReason` + `usageMetadata.thoughtsTokenCount`
on one live `thread_digest` call.

**Candidate fix (pending pros/cons + approval before touching shared code):**
- Add `thinkingConfig: { thinkingBudget: 0 }` to Gemini `generationConfig`
  for JSON-mode tasks (digests are deterministic extraction; thinking adds
  latency/cost and causes the truncation). Frees the full budget for output.
- Add a `finishReason` check in `invokeGemini` so future truncations surface
  loudly instead of silently. Orthogonal robustness win.

---

## Which dashboard gets what

| Dashboard | Action |
|---|---|
| **Render** (`pulse-api`) | `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REDIRECT_URI` → auto-redeploys |
| **Google Cloud Console** (Gmail project) | done: API enabled, scopes, test user, redirect URI registered |
| **Vercel** (Production → then **rebuild**) | `VITE_GOOGLE_CLIENT_ID`, `VITE_VAPID_PUBLIC_KEY` |
| **Supabase** | nothing to change — source of the `VITE_GOOGLE_CLIENT_ID` value + (read-only) confirmation of the VAPID key |
| **ai-router edge fn** | Issue 4 only, pending sign-off |
