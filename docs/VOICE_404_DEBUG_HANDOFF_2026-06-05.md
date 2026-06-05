# War Room / Summit Voice — `openai-realtime-token` 404 — DEBUG HANDOFF (2026-06-05)

## TL;DR
Realtime **voice** (War Room Live stage + Summit) is blocked: the browser gets
**`POST /functions/v1/openai-realtime-token → 404`**, which surfaces as
`FunctionsHttpError: Edge Function returned a non-2xx status code`
(LiveDashboard.tsx:167) and, in Summit, a thrown
`Error: Invalid URL (POST /v1/realtime/sessions)` (realtimeAgentService.ts:1457).

**Root cause is NOT yet found.** It is NOT the OpenAI key, NOT the entitlement,
NOT the function code, NOT a stale build. The function is **server-side healthy**
— it returns 401/402/200 when it actually runs. The 404 is happening **between
the browser and the function** (the 404 body `Invalid URL (POST /v1/realtime/sessions)`
is NOT a string the edge function ever emits — something is fabricating it).

## The decisive evidence
1. **curl WITH apikey → `401`** (healthy auth rejection of a dummy bearer),
   identical to the `ai-router` control which **works for the browser (200)**:
   ```bash
   ANON=$(grep -rhE "^VITE_SUPABASE_ANON_KEY=" .env* | head -1 | cut -d= -f2- | tr -d "\"'" | tr -d '[:space:]')  # len 208
   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     "https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/openai-realtime-token" \
     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
     -H "Content-Type: application/json" -d '{"workspace_id":"00000000-0000-0000-0000-000000000000"}'
   # → 401   (ai-router same call → 401 too; both boot fine)
   ```
2. **Supabase edge logs (function_id d822c884…, version 46)** show the SAME
   function returning a MIX of `401` (my curls) and `404` (the browser) for POST,
   ~350–490ms each. OPTIONS always 200. So the function boots+runs for some
   callers and 404s for others — split by **caller**, not random.
3. The 404 first appeared ~17 min after the last good `402` on v44
   (1780631870 `402` → 1780632919 `404`); cause-of-onset unknown. Persisted
   across redeploys v44→v45→v46.

## What is RULED OUT (with evidence)
- **OpenAI key / its permissions/restrictions** — the function 404s *before* it
  ever calls OpenAI. A key problem would be a 401/402 *relayed from inside* the
  function (code `UPSTREAM_ERROR`), never a pre-run 404. (Key `pulse-voice-model`
  is `All` perms + funded; the older `402`s were the entitlement gate, not OpenAI.)
- **Entitlement / tier** — was a real `402 WRONG_TIER` ("Summit not included")
  because the workspace is on **Pulse Solo** (Summit is Team/Growth-only). Worked
  around with a manual override (see below). Not the 404.
- **Function code** — returns 401/402/200 correctly when it runs (curl proof).
- **Stale build artifact** — redeployed 3× (v44→45→46), still 404s in browser.
- **External-CDN imports** — swapped `deno.land/std serve` + `esm.sh` →
  `Deno.serve` + `npm:` (commit fa2fab3, v46). Function still healthy via curl,
  browser still 404s. (Good modernization, but was NOT the fix.)

## The KEY mystery to crack next
Same browser, same project, same apikey: `ai-router` → **200**, but
`openai-realtime-token` → **404** with body `Invalid URL (POST /v1/realtime/sessions)`.
The real function NEVER returns that body. So **something in the request path for
THIS endpoint specifically** is intercepting/fabricating the 404. Candidates:
service worker, browser extension (a `content.js … Extension context invalidated`
was in the console), Comet browser's assistant — BUT the user reports it also
fails in **Edge browser**, which weakens the browser-specific theory.

## NEXT STEPS (prioritized for the fresh session)
1. **Capture the EXACT failing browser request** (DevTools → Network → the red
   `openai-realtime-token` POST):
   - Request headers: the **`apikey` value** (does it == the `.env`
     `VITE_SUPABASE_ANON_KEY`, len 208? a stale build-time key could matter),
     `Authorization`, `Origin`.
   - Response: status, **all response headers** (look for `server`/`via`/cache
     headers that reveal an interceptor vs Supabase), and the **response body**.
   - Compare side-by-side with the working `ai-router` POST (same tab).
2. **Find who emits `Invalid URL (POST /v1/realtime/sessions)`** — it is NOT the
   edge function. `grep -rn "Invalid URL" src/ public/` and check the service
   worker. SW is registered only in PROD (`main.tsx:80`, `/sw.js`) and dev
   *unregisters* it (`main.tsx:48-53`), but a stale prod SW can linger:
   DevTools → Application → Service Workers → **Unregister** + Clear storage,
   then test. Also check `src/utils/offlineManager.ts` / `src/services/pwaService.ts`.
3. **Try the BYO-key path** as a probe: `generateEphemeralToken` supports
   `byo_key` (skips all gates). If a BYO `sk-...` call to the SAME endpoint also
   404s in-browser → confirms it's transport/interceptor, not gates.
4. **Delete + recreate the function** with a fresh slug/id — the deployment may
   be in a bad platform state that redeploys don't clear. (Last resort-ish; the
   function_id `d822c884-1783-4b9d-8c2d-af6ac134cc4b` has been ACTIVE throughout.)
5. **Restore canonical deploy structure** — my MCP deploys (v45/v46) put the
   entrypoint at root `index.ts` (`source/index.ts`); the original CLI deploy
   used `supabase/functions/openai-realtime-token/index.ts`. If the user has the
   Supabase CLI linked, `supabase functions deploy openai-realtime-token` restores
   the repo structure exactly (and is the byte-safe way to deploy vs hand-passing
   content through the MCP). NOTE: v44 (nested, CLI) ALSO 404'd, so this is not
   the original cause — but worth normalizing.

## What was DONE this session (so it's not redone)
**Commits (on `main`):**
- `ffedb87` fix(warroom): voice token mint wedged shut by self-referential effect
  dep — `LiveDashboard` resolve effect had `isResolvingOpenaiToken` in its own
  deps → self-cancelled → stuck `true` → mint never fired (no network call). Now
  a ref-free `cancelled`-guarded effect, deps `[showVoiceAgentPanel, openaiApiKey,
  workspaceId]`. **This was a real, separate bug and is fixed.**
- `fa2fab3` fix(summit): drop external-CDN imports in realtime-token fn — see above.
- (earlier, the voice-UI feature work, all green: layout-mode switcher, voice-first
  Live stage `RadialVoiceVisual`, Comet-style composer dictation `useMicLevel`,
  Live notetaker + caption + activity label, board-only Focus, coral frame.)

**Supabase (project `ucaeuszgoihoyrvhewxk` = pulse-chat):**
- Deployed `openai-realtime-token` v45 then v46 via MCP (verify_jwt=false preserved).
- **Manual entitlement override (band-aid):** workspace
  `8a1fe2cf-5810-434a-b24f-9d6c392ed284` (child of "My Workspace" `c54f5267…`,
  which is on **pulse_solo** after a Growth→Solo downgrade) →
  `UPDATE entitlements SET max_summit_minutes_mo=60, max_summit_session_sec=900`.
  User chose "leave the override for now." If keeping voice Team/Growth-only,
  revert it; the proper test path is `start_pulse_team_trial(ws)` (30-day
  pulse_team trial → 60 min). See memory `project_pulse_summit_voice_entitlement`.

## Key references
- Client mint (raw fetch): `src/services/realtimeAgentService.ts:1394-1458`
  (sends `apikey` + `Authorization`; throws on non-2xx at :1457).
- Client mint (War Room resolve effect): `src/components/LiveDashboard.tsx:150-186`.
- Edge function: `supabase/functions/openai-realtime-token/index.ts` (returns
  401/400/402/403/500 only — NEVER 404; gates at :119-168, OpenAI call at :177).
- Summit caller: `src/components/Summit/Summit.tsx:920` → `RealtimeVoiceAgent.connect`.
- Memory: `project_pulse_summit_voice_entitlement` (Summit voice = Team/Growth-only,
  tier-1 label conflation, the override, 404=transient-boot note now SUPERSEDED by
  this doc — the 404 is browser-side, not a transient boot glitch).
