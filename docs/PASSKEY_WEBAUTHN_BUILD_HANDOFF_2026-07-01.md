# Passkey / WebAuthn — Build Handoff

**Date:** 2026-07-01
**Status:** Planned, not started
**Owner:** unassigned
**Origin:** `/impeccable critique` of the auth surface (2026-07-01). Nielsen H7 (Flexibility & efficiency) scored **2/40** — the lowest heuristic. The reviewer's sharpest note: *"Password-first in 2026 is the least on-brand choice on this screen"* for a product with a technical, cockpit-ethos audience. This handoff scopes closing that gap.

---

## 1. Goal

Let users sign in with a **passkey** (WebAuthn / FIDO2 — Face ID, Touch ID, Windows Hello, hardware keys, phone-as-authenticator) as a first-class method, sitting **above** Google / Microsoft / Email in the method chooser.

Success = a returning user taps "Sign in with a passkey", completes a platform biometric prompt, and lands in Pulse with a valid Supabase session — no password, no OAuth round-trip.

### Non-goals (for the first pass)
- Replacing password/OAuth. Passkey is **additive** — the existing methods stay.
- Passkey-only accounts. First pass assumes an existing account (created via OAuth/email) **enrolls** a passkey from Settings; sign-in then offers it.
- Cross-account passkey discovery UX beyond what the platform authenticator provides.

---

## 2. Why this is non-trivial with our stack

**Supabase Auth has no native WebAuthn primitive.** It ships email/password, OAuth, magic link, phone, and TOTP MFA — but not passkeys as a login factor. So we cannot call `supabase.auth.signInWithPasskey()`. We have to run the WebAuthn ceremony ourselves and then mint a Supabase session at the end. That is the crux of the whole build.

Two viable architectures:

### Option A — Self-hosted WebAuthn via Edge Functions (recommended)
Run the registration/authentication ceremonies in Supabase Edge Functions using [`@simplewebauthn/server`](https://simplewebauthn.dev/), store credential public keys in a Postgres table, and on successful assertion mint a session for the matching user.

- **Session minting** is the hard part. On the server, after verifying the assertion, use the Supabase **service-role** key with the Admin API to issue a session for that user. Cleanest path today: `supabase.auth.admin.generateLink({ type: 'magiclink', email })` and exchange server-side, or the admin `createSession`-style flow via the GoTrue admin endpoints. **Confirm the exact supported call against the deployed GoTrue version before committing** — this API surface has changed across releases. (Use the Supabase MCP `search_docs` + `get_project` to pin the version.)
- Pros: full control, no vendor lock, works on web + Capacitor + Electron.
- Cons: we own the security-critical ceremony code and the session-minting bridge.

### Option B — Managed passkey provider (Hanko, Corbado, Passage/1Password, Stytch)
Drop-in passkey UI + backend; bridge their post-auth token into a Supabase session (again via admin session minting).
- Pros: much less security-critical code to own; polished fallback flows.
- Cons: new vendor + cost + another SDK; still need the Supabase session bridge; less control over the cockpit-brand styling.

**Recommendation:** Option A. We already run Edge Functions (see `docs/EDGE_FUNCTION_FIXES_HANDOFF_2026-06-16.md`), the audience is technical, and owning the flow avoids a vendor in the auth hot path. Revisit B only if session-minting against GoTrue proves unreliable.

---

## 3. Data model (Option A)

New table, RLS-locked so a user can only see/manage their own credentials:

```sql
create table public.user_passkeys (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  credential_id  text not null unique,          -- base64url
  public_key     bytea not null,                -- COSE public key
  counter        bigint not null default 0,     -- signature counter (clone detection)
  transports     text[],                        -- ['internal','hybrid','usb',...]
  device_label   text,                          -- user-facing ("MacBook Touch ID")
  aaguid         text,                           -- authenticator model (optional)
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz
);

alter table public.user_passkeys enable row level security;
create policy "own passkeys" on public.user_passkeys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Plus a short-lived **challenge** store (registration + authentication challenges must be single-use, ~5 min TTL). Either a `passkey_challenges` table keyed by a request id, or a signed/encrypted stateless challenge cookie. Prefer a table for auditability.

---

## 4. Edge Functions (Option A)

Four endpoints (`@simplewebauthn/server`):

| Function | Purpose |
|---|---|
| `passkey-register-begin` | Authed. Returns `PublicKeyCredentialCreationOptions`, stores challenge. `excludeCredentials` = user's existing creds. |
| `passkey-register-finish` | Authed. Verifies attestation, inserts into `user_passkeys` with a device label. |
| `passkey-auth-begin` | Anon. Returns `PublicKeyCredentialRequestOptions` (allowCredentials empty = discoverable/usernameless, or scoped by email). Stores challenge. |
| `passkey-auth-finish` | Anon. Verifies assertion, bumps `counter` + `last_used_at`, **mints a Supabase session**, returns tokens. |

**rpID / origin:** set `rpID` to the registrable domain and validate `origin` strictly. Production brands as `qntmecos.com` but the app is served from `pulse.logosvision.org` (see the `pulse-domain-split` note). **Passkeys are bound to the origin they were created on.** Decide the canonical rpID up front — almost certainly the domain the app is actually served from (`pulse.logosvision.org`), or a parent if we want portability. Getting this wrong means credentials that silently fail to appear. Document the chosen rpID here once decided.

---

## 5. Frontend integration

### Where it plugs in
`src/components/Login.tsx` — the method chooser (`!showEmailForm && !showResetForm` branch, the `.login-btn-group` with Google/Microsoft/Email). Add a passkey button as the **top** option, styled like `.login-social-btn` with a fingerprint/key `lucide-react` icon (e.g. `Fingerprint` or `KeyRound`), or promote it to the primary rose CTA if we want it to be *the* default.

The component takes callbacks via `LoginProps` (`onLogin`, `onEmailLogin`, `onSignup`, `onMicrosoftLogin`, `onPasswordReset`). **Follow that pattern:** add `onPasskeyLogin?: () => Promise<void>` to `LoginProps`, implement it in `App.tsx` alongside `handleLogin`/`handleMicrosoftLogin`, and back it with a new `loginWithPasskey()` in `src/services/authService.ts` (keep all Supabase/ceremony calls in the service, not the component — matches the existing `loginWithGoogle`/`updatePassword` split).

### Client ceremony
`loginWithPasskey()` in `authService.ts`:
1. `POST passkey-auth-begin` → options.
2. `startAuthentication()` from [`@simplewebauthn/browser`](https://simplewebauthn.dev/) (handles the `navigator.credentials.get` base64url plumbing).
3. `POST passkey-auth-finish` with the assertion → `{ access_token, refresh_token }`.
4. `supabase.auth.setSession({ access_token, refresh_token })` → AuthContext swaps the Login screen out, same as the existing OAuth path.

Enrollment lives in **Settings** (`src/components/Settings.tsx` or an account/security panel): "Add a passkey" → `register-begin` → `startRegistration()` → `register-finish`, then list `user_passkeys` with device label + `last_used_at` and a remove action.

### Progressive disclosure / capability check
Only show the passkey button when supported:
```ts
const supported = typeof window !== 'undefined'
  && !!window.PublicKeyCredential
  && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
```
Optionally use conditional UI (autofill / `mediation: 'conditional'`) on the email field so passkeys surface in the input's autofill without a separate click — nice-to-have, not first pass.

### Error copy
Route all failures through the existing `friendlyAuthError()` (`src/utils/authErrors.ts`) — it already maps `popup/cancel/closed` and network cases. Add passkey-specific cases as needed (`NotAllowedError` = user cancelled/timed out → "Passkey sign-in was cancelled.").

---

## 6. Platform matrix (we ship web + Capacitor Android + Electron desktop)

- **Web (Chrome/Safari/Firefox/Edge):** WebAuthn is native. Primary target.
- **Capacitor / Android:** the system WebView's WebAuthn support is inconsistent. Prefer the Android **Credential Manager** API via a Capacitor plugin (e.g. a community passkey/Credential Manager plugin) rather than relying on the WebView. **This is the riskiest platform — spike it early.** Needs an `assetlinks.json` (Digital Asset Links) served at `/.well-known/assetlinks.json` on the rpID domain to associate the Android app with the origin.
- **Electron desktop (`Pulse.Setup.*.exe`):** WebAuthn works through Chromium but hardware/Windows Hello binding under Electron needs verification. Spike before promising it.
- **iOS (if/when):** Associated Domains entitlement + `apple-app-site-association` file.

Given the matrix, **first ship = web only**, with the button feature-detected so Capacitor/Electron users simply don't see it until those paths are verified.

---

## 7. Interim win (much cheaper, ship first) — ✅ SHIPPED 2026-07-01

The critique also flagged: no "remember me", no last-used-method hint. This needs **no backend**:
- ✅ Persist the last successful method (`'google' | 'microsoft' | 'email'`) — `authService.ts` stashes the attempt's intent in `sessionStorage` (`markPendingAuthMethod`, survives the OAuth redirect) and promotes it to a durable `localStorage` record (`pulse_last_auth_method`) only on a genuine `SIGNED_IN` (`commitPendingAuthMethod` in the global `onAuthStateChange`), so a cancelled/failed attempt never sticks. Read via `getLastAuthMethod()`.
- ✅ On the chooser, `Login.tsx` badges the matching button ("Last used" pill, `.login-last-used-badge`) **and** floats the last-used social method to the top. Suppressed in signup mode.
- ✅ "Keep me signed in" toggle already existed in `AccountSettings.tsx` (`pulse_keep_logged_in`) with the fresh-launch session-clear sentinel in `authService.ts` — no new work needed.

Touchpoints: `src/services/authService.ts` (tracking helpers + commit-on-SIGNED_IN), `src/components/Login.tsx` (badge + reorder), `src/components/Login.css` (`.login-last-used-badge` / `.login-btn--last`). Banks an immediate H7 improvement while the passkey build below is scoped.

---

## 8. Security checklist

- Challenges single-use, short TTL, bound to the request; reject reuse.
- Strict `origin` + `rpID` validation server-side (never trust client-sent values).
- Enforce signature `counter` monotonicity (clone/replay detection); flag regressions.
- `user_passkeys` service-role-only for writes from the finish functions; RLS for user reads/deletes.
- Rate-limit `auth-begin`/`auth-finish` (reuse the same rate-limit posture as the rest of auth).
- Session minting uses the **service-role key only inside the Edge Function** — never expose it client-side.
- Enumeration: keep `auth-begin` responses uniform whether or not the email has credentials (mirrors the existing enumeration-safe reset copy in `Login.tsx`).
- Require a **second enrolled method or recovery path** before allowing passkey-only, so a lost authenticator can't permanently lock a user out. First pass sidesteps this by keeping password/OAuth active.

---

## 9. Testing

- Unit: `friendlyAuthError` passkey cases; option/assertion serialization.
- Integration: register → sign out → sign in with passkey → session valid; wrong-origin rejection; expired-challenge rejection; counter-regression rejection.
- Manual matrix: macOS Safari/Chrome (Touch ID), Windows Hello, Android Chrome, a hardware key (YubiKey), and the Capacitor Android build.
- Regression: confirm Google/Microsoft/email/reset flows untouched (this is additive).

---

## 10. File touchpoints (anticipated)

- `supabase/functions/passkey-register-begin|finish`, `passkey-auth-begin|finish` (new)
- `supabase/migrations/*_user_passkeys.sql` (new table + RLS + challenge store)
- `src/services/authService.ts` — `loginWithPasskey()`, `registerPasskey()`, `listPasskeys()`, `removePasskey()`
- `src/components/Login.tsx` — passkey button in the chooser + `onPasskeyLogin` prop; capability gate
- `src/App.tsx` — `handlePasskeyLogin` wired to `authService`, passed into `<Login />`
- `src/components/Settings.tsx` (or a security panel) — enrollment + management UI
- `src/utils/authErrors.ts` — passkey error cases
- `public/.well-known/assetlinks.json` (Android) / `apple-app-site-association` (iOS, later)
- `package.json` — `@simplewebauthn/browser`, `@simplewebauthn/server`

---

## 11. Open questions (resolve before coding)

1. **rpID / canonical origin** — `pulse.logosvision.org` (served) vs `qntmecos.com` (brand)? Passkeys bind to origin; this decision is load-bearing.
2. **Session minting API** — which GoTrue admin call reliably issues a session for a verified user on the deployed Supabase version? Spike this first; it's the make-or-break of Option A.
3. **First-ship platforms** — web-only initially (recommended), or block on Capacitor Android parity?
4. **Passkey as top method vs. behind a toggle** — how prominent on the chooser?
5. **Managed provider fallback** — if session minting is painful, is a provider (Hanko/Corbado) acceptable, and what's the cost ceiling?

---

## 12. Suggested sequence

1. Ship the **interim remember-me / last-used** win (no backend). ~half day.
2. **Spike** the Supabase session-minting bridge (Q2) in isolation — prove a verified server-side identity can produce a client session. Gate the whole build on this.
3. Build data model + 4 edge functions (web only).
4. Enrollment UI in Settings.
5. Passkey button + capability gate in `Login.tsx` / `App.tsx` / `authService.ts`.
6. Web QA matrix, then tackle Capacitor Android (Credential Manager + assetlinks).
7. Re-run `/impeccable critique` — H7 should move from 2 toward 4.
