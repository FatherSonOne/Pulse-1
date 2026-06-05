# War Room / Summit Voice — `openai-realtime-token` 404 — RESOLVED (2026-06-05)

## STATUS: ✅ RESOLVED — voice working end-to-end (user-confirmed 2026-06-05)

The 404 was **OpenAI deprecating the beta endpoint `/v1/realtime/sessions`**.
Fixing it surfaced the rest of a full **beta→GA Realtime migration**. All shipped,
deployed (edge fn **v47**, frontend on Vercel), and confirmed working live (mint
**200** in the edge logs; assistant speaks back after the user picks the right mic).

The five layers, in the order they were hit:

1. **Mint endpoint** — `/v1/realtime/sessions` (404 "Invalid URL") → GA
   `/v1/realtime/client_secrets` (nested `session` body, token at top-level
   `value`/`ek_`). `0a2b3d9` + edge redeploy.
2. **WebRTC SDP exchange** — `/v1/realtime?model=` (deprecated) → GA
   `/v1/realtime/calls?model=`; model `gpt-4o-realtime-preview` → `gpt-realtime`.
   `0a2b3d9`.
3. **`session.update`** (data channel) — beta flat shape rejected with
   `Missing required parameter: 'session.type'` → GA shape: `type:'realtime'`,
   `output_modalities:['audio']`, audio under `audio.input`/`audio.output`; plus
   GA server-event aliases (`response.output_audio[_transcript].delta/done`).
   `59dedb4`.
4. **Benign barge-in race** — `response_cancel_not_active` surfaced as a scary
   toast → swallowed in the `error` handler. `f813d52`.
5. **Mic capture / device selection** — session grabbed the *system default* mic
   (silence on the wrong device) with no picker → added an audio device picker +
   live pre-connect mic meter (`AudioDeviceSettings` + `audioDevicePrefs`;
   `inputDeviceId`/`outputDeviceId` plumbed through `connect()` + live
   `setInputDevice`/`setOutputDevice`). `17fc054`, dark-mode `<option>` fix
   `1a6b8e9`.

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
| `session.update` (data channel) | flat `{modalities, voice, input_audio_format, input_audio_transcription, turn_detection}` | `{type:'realtime', output_modalities:['audio'], audio:{input:{transcription,turn_detection}, output:{voice}}}` |
| Server event names | `response.audio[_transcript].delta/done` | `response.output_audio[_transcript].delta/done` (handler keeps both) |
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
- **`src/services/realtimeAgentService.ts`** (round 2) — GA `session.update`
  shape, GA server-event aliases, swallow `response_cancel_not_active`, plus
  `inputDeviceId`/`outputDeviceId` config + `setInputDevice`/`setOutputDevice`.
- **`src/components/WarRoom/AudioDeviceSettings.tsx` + `.css`** (new) — mic/speaker
  picker with a live pre-connect input meter; dark-mode `<option>` fix.
- **`src/services/audioDevicePrefs.ts`** (new) — localStorage mic/speaker choice.
- **`server.js`** (`/api/realtime/session-token`, legacy Express path, NOT in the
  live War Room/Summit flow) — same endpoint/body/response migration, for parity.

Commits: `0a2b3d9` (mint+WebRTC+model), `59dedb4` (session.update), `f813d52`
(cancel race), `17fc054` (device picker), `1a6b8e9` (dropdown dark-mode).

## Verified ✅ (end-to-end, user-confirmed 2026-06-05)
- `openai-realtime-token` redeployed **v47 ACTIVE**, `verify_jwt=false` preserved.
- Edge logs show the user's real authenticated mint returning **200** on v47
  (was 404 on v46) — token minted, OpenAI reached cleanly.
- Connection + session config + audio device meter all confirmed in-browser; the
  assistant speaks back once the correct mic is selected.
- `tsc`: no new errors in any touched file (≈918 pre-existing baseline).

## Only open item
- Decide on the entitlement override band-aid on workspace
  `8a1fe2cf-5810-434a-b24f-9d6c392ed284` (Summit is Team/Growth-only by design).
  See memory `project_pulse_summit_voice_entitlement`.

## Adjacent landmine (not changed — flagged)
`supabase/functions/whisper-proxy/index.ts` (speech-to-text) still imports `serve`
from `deno.land/std` + `createClient` from `esm.sh` — the exact external-CDN-boot
pattern that fa2fab3 removed from the realtime fn. It's a latent boot-404 risk on
the Speech path. Harden it to `Deno.serve` + `npm:@supabase/supabase-js` when
convenient (one-line-class change, same as fa2fab3).
