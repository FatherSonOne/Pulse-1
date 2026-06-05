# War Room / Summit Voice — `openai-realtime-token` 404 — RESOLVED (2026-06-05)

## STATUS: ROOT CAUSE FOUND + FIXED

The 404 was **OpenAI deprecating the beta endpoint `/v1/realtime/sessions`**.
Migrated both the mint and the WebRTC SDP-exchange to the GA Realtime API.
Edge function `openai-realtime-token` redeployed to **v47** (verify_jwt=false
preserved). Client + `server.js` updated to match. Pending: frontend redeploy
(Vercel) so the browser ships the GA WebRTC path, then a logged-in retry.

---

## The actual root cause (correcting the earlier theory in this doc's history)

The earlier pass concluded the 404 was "fabricated between the browser and the
function" because "the function never returns 404 and never emits the string
`Invalid URL (POST /v1/realtime/sessions)`." **That was wrong**, and the function's
own code proves it:

```ts
// supabase/functions/openai-realtime-token/index.ts (pre-fix, ~L185-195)
const response = await fetch('https://api.openai.com/v1/realtime/sessions', {...});
if (!response.ok) {
  const errorJson = JSON.parse(errorText);
  errorMessage = errorJson.error?.message || errorMessage;   // = OpenAI's "Invalid URL (...)"
  return json({ error: errorMessage, code: 'UPSTREAM_ERROR' }, response.status); // relays OpenAI's 404
}
```

- The function **does** relay upstream 404s, and the body
  `Invalid URL (POST /v1/realtime/sessions)` is **OpenAI's own error message** —
  OpenAI removed that beta route, so a POST to it 404s.
- **Why curl 401'd but the browser 404'd** (the "split by caller" mystery): the
  curls used the anon key as a dummy bearer → failed `auth.getUser()` and returned
  **401 before** the OpenAI call. The real browser JWT **passed** auth + the
  (overridden) entitlement gate, **reached** the OpenAI call, and got OpenAI's 404.
  Not an interceptor — just auth depth.
- **Why the 404 appeared "~17 min after the last good 402"**: the 402 was the
  `WRONG_TIER` gate firing *before* the OpenAI call. Once the manual entitlement
  override landed, requests started *passing* the gate and reaching the dead
  endpoint → 404. Onset tracked the override, not a platform glitch.

## The GA migration (verified against OpenAI + Microsoft GA docs)

| Concern | OLD (beta, dead) | NEW (GA) |
|---|---|---|
| Mint ephemeral token | `POST /v1/realtime/sessions` body `{model,voice}` | `POST /v1/realtime/client_secrets` body `{session:{type:'realtime',model,audio:{output:{voice}}}}` |
| Token field in response | `client_secret.value` | top-level **`value`** (prefix `ek_`) |
| WebRTC SDP exchange | `POST /v1/realtime?model=` | `POST /v1/realtime/calls?model=` |
| Model id | `gpt-4o-realtime-preview` | **`gpt-realtime`** |
| `OpenAI-Beta` header | (was implied for beta) | **omit entirely** |

Preview endpoints are slated for hard removal; GA is the only forward path.

## Files changed this fix

- **`supabase/functions/openai-realtime-token/index.ts`** — mint → `/client_secrets`,
  nested `session` body, token via `data.value`, default model `gpt-realtime`.
  **DEPLOYED v47** (MCP, verify_jwt=false, same function_id d822c884…).
- **`src/services/realtimeAgentService.ts`** — `connect()` WebRTC →
  `/v1/realtime/calls?model=`, dropped the `gpt-realtime→preview` remap,
  `generateEphemeralToken` default model `gpt-realtime`.
- **`src/components/WarRoom/RealtimeVoiceAgent.tsx`** — mint model `gpt-realtime`.
- **`src/components/LiveDashboard.tsx`** — mint model `gpt-realtime`.
- **`server.js`** (`/api/realtime/session-token`, legacy Express path, NOT in the
  live War Room/Summit flow) — same endpoint/body/response migration, for parity.

## Verified
- `openai-realtime-token` redeployed **v47 ACTIVE**, `verify_jwt=false` preserved.
- Boot health: dummy-bearer POST → **401 "Invalid or expired token"** (function
  boots + runs; not a boot 404/500).
- OPENAI_API_KEY secret is set (previously reached OpenAI to get "Invalid URL").

## Still to do (user's side)
1. **Redeploy the frontend** (Vercel) so the browser uses `/v1/realtime/calls`.
2. **Logged-in retry** in War Room Live + Summit. If it still fails, read edge
   logs: a working mint logs `mode=hosted … tier=…`; the OpenAI response should
   now be 200 (ek_ token) instead of 404. Any new failure will be a *real* OpenAI
   error (e.g. invalid voice) relayed with `code: UPSTREAM_ERROR`.
3. Decide on the entitlement override band-aid on workspace
   `8a1fe2cf-5810-434a-b24f-9d6c392ed284` (Summit is Team/Growth-only by design).
   See memory `project_pulse_summit_voice_entitlement`.

## Adjacent landmine (not changed — flagged)
`supabase/functions/whisper-proxy/index.ts` (speech-to-text) still imports `serve`
from `deno.land/std` + `createClient` from `esm.sh` — the exact external-CDN-boot
pattern that fa2fab3 removed from the realtime fn. It's a latent boot-404 risk on
the Speech path. Harden it to `Deno.serve` + `npm:@supabase/supabase-js` when
convenient (one-line-class change, same as fa2fab3).
