# Slack-Grounded Messages — Continuation Handoff (P2 onward)

> **Created:** 2026-06-07 · **Type:** continuation handoff. Resume point after **P0 + P1 shipped & verified.**
> **The contract:** `docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md` (locked scope, decisions D1–D8, full P0–P6 plan, schema/OAuth/Events contracts). Read it first — this handoff is the *state delta* + the immediate next decision, not a re-spec.
> **Predecessor docs:** `docs/SLACK_MESSAGES_GROUNDING_HANDOFF_2026-06-06.md` (investigation brief). **Memory:** `project_pulse_slack_messages_grounding`, `reference_pulse_messages_auth_fks`.
> **Flag:** `slackMessagesGrounding` (FeatureContext, default OFF). Surfaced as an **Integrations (Beta)** toggle in Settings → Features & Labs.

---

## 1. Where we are (verified)

**P0 — schema foundation. SHIPPED (`2e4ae17`), applied to prod `pulse-chat` + verified live.**
- Migration `supabase/migrations/20260606155711_slack_messages_grounding_p0.sql`.
- `pulse_conversations`: `transport text NOT NULL DEFAULT 'pulse'`, `external_slack_user_id`, `external_email`, `external_display_name`.
- `contacts.pulse_user_id uuid` + `dbToContact`/`contactToDb`/`DBContact` mapping (`src/services/dataService.ts`).
- `user_slack_tokens` (RLS-on, **0 policies** = service-role-only; cols: `user_id, access_token, scope, slack_user_id, slack_team_id, bot_user_id, token_type, created_at, updated_at`; UNIQUE(user_id); no refresh/expiry).
- `slackMessagesGrounding` flag + `FEATURE_NAMES`/`FEATURE_DESCRIPTIONS`/`FEATURE_CATEGORIES.integrations` entries (`src/contexts/FeatureContext.tsx`).
- tsc: 917 baseline, no new errors.

**P1 — Slack user-OAuth broker + Connect button. SHIPPED + VERIFIED end-to-end 2026-06-07.**
- Backend broker `00816ab` (`server.js`): `GET /api/slack/status`, `GET /api/slack/auth/url`, `GET /api/slack/auth/callback`, `DELETE /api/slack/disconnect` — mirrors the Gmail per-user block (`server.js:476-663`); HMAC signed-state (`signSlackState`/`verifySlackState`); token store helpers (`getUserSlackToken`/`upsertUserSlackToken`/`deleteUserSlackToken`) via `tokenStoreClient()`; `xoxp-` never reaches the browser.
- Frontend `5bd3749`: `src/services/slackUserConnect.ts` (mirrors `gmailConnect.ts`) + a gated **"Send as you"** section in `src/components/settings/integrations/SlackIntegration.tsx`.
- **Verified:** `SELECT … FROM user_slack_tokens` returned a row for user `feedaa8d-1f48-4ad1-b757-11c7b79b7510` — `access_token` prefix `xoxp-` (len 82), `slack_user_id=U0B5X67Q7A7`, `slack_team_id=T0B63H511LJ`, `token_type=user`, `scope=im:history,users:read,users:read.email,chat:write,im:write`. (Note: **`im:write`** was missing from the original handoff scope set — correction held.)
- Bugfix chain during live bring-up (all on `main`): `d9a8081` (read `SLACK_OAUTH_REDIRECT_URL` as well as `_URI`), `8fd152c` (surface store failures instead of a false `?slack=connected`), `b4d39fe` (`.trim()` the redirect_uri — a trailing space → `+` → `bad_redirect_uri`), `da52d0b` (`.trim()` `SUPABASE_URL`/`ANON`/`SERVICE_KEY` — whitespace → `Invalid API key`).

**Everything above is pushed to `origin/main`.** Working tree clean at handoff (a parallel command-palette session also commits to `main` — see §7).

---

## 2. Live environment facts (don't re-derive — verified this session)

- **Slack app:** "Pulse Smoke", **App ID `A0B6SUJDAUX`**, workspace **Qntmecos** (`team T0B63H511LJ`), `client_id 11207583035698.11230970452983`. Single-tenant, **Not distributed** (no Slack review — correct for L1). **Redirect URLs registered:** `https://pulse-api-1epw.onrender.com/api/slack/auth/callback` AND `http://localhost:3003/api/slack/auth/callback`. **User-token scopes:** `chat:write, im:write, im:history, users:read, users:read.email`. `SLACK_SIGNING_SECRET` exists (for P3 Events).
- **Backend (Render):** service **`pulse-api`** (`srv-d8agh6ektjcs73fvd9bg`), origin **`https://pulse-api-1epw.onrender.com`**, Blueprint-managed off `FatherSonOne/Pulse-1` `main` (auto-deploys on push). Env present: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_OAUTH_REDIRECT_URL` (= the Render callback), `SLACK_SIGNING_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (now the correct `pulse-chat` secret), `VITE_APP_URL` (= `https://pulse.logosvision.org`), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Frontend (Vercel):** project **`pulse1`** (`prj_BDfZckGXGw49sW7FGuM4DA232FDn`, team `team_Gst9VOe3b03UvTkO8V6nkIbV`), served at **`https://pulse.logosvision.org`**; `BACKEND_URL` is baked at build to `https://pulse-api-1epw.onrender.com` (verified in the `svc-core` chunk). `VITE_BACKEND_URL` is the Vercel build-time var.
- **Supabase:** project **`pulse-chat`**, ref **`ucaeuszgoihoyrvhewxk`**, URL `https://ucaeuszgoihoyrvhewxk.supabase.co`. Publishable-key fingerprint (safe, public): `sb_publishable_gm7Ipp-tgXIxo97cUpvdPA_GzelsBtf`.

### Env-var gotchas (durable — for any future Render-backend OAuth work)
1. The env var is named `SLACK_OAUTH_REDIRECT_URL` (URL), not `_URI`. `server.js` now reads either + `.trim()`s.
2. `VITE_APP_URL` MUST be set on Render or post-OAuth redirects fall back to `http://localhost:5173` (same fallback Gmail uses).
3. **Trailing whitespace in env values is fatal and invisible:** a space in the redirect URL encoded as `+` → Slack `bad_redirect_uri`; a space (or wrong/stale value) in the service key → `Invalid API key`. `server.js` now `.trim()`s the Slack redirect + `SUPABASE_URL/ANON/SERVICE_KEY`.
4. `SUPABASE_SERVICE_KEY` falls back to the **anon** key if `SUPABASE_SERVICE_ROLE_KEY` is unset (`server.js:18`) → silent RLS-blocked writes. The key + `VITE_SUPABASE_URL` must point at the **same** project.

---

## 3. 🚦 IMMEDIATE NEXT DECISION — the shadow-`auth.users` mint (gates P2 + P3)

This is the first thing to resolve. To put a Slack person into a `pulse_conversations`/`pulse_messages` row, they need a real `auth.users` row (all 4 participant columns FK to `auth.users(id)` — see `reference_pulse_messages_auth_fks`; a bare synthetic uuid fails `foreign_key_violation`). Deterministic id = `uuidv5('slack:'||team_id||':'||slack_user_id)`. Only `auth.users.{id, is_sso_user, is_anonymous}` are NOT NULL (latter two default false), so a service-role insert / `auth.admin.createUser` is feasible.

**The catch (verified via `pg_trigger` + `pg_get_functiondef`):** `auth.users` has **4 `AFTER INSERT` triggers**, all enabled:

| Trigger → function | What it does on insert | Hazard for a shadow row |
|---|---|---|
| `bootstrap_pulse_user_on_auth_insert` → `ensure_pulse_user_for_auth(NEW.id)` | creates a `pulse_users` row | wrapped in best-effort `EXCEPTION`; would make the Slack person look like a real Pulse user unless flagged |
| `auto_join_workspace_by_domain` | auto-joins workspaces matching the email domain | **guards `IF new.email IS NULL/'' THEN RETURN new`** → SAFE if the shadow has no email |
| `on_auth_user_created` → `handle_new_user_workspace` | **creates a NEW workspace** (name = meta name or email prefix) + a `workspace_members` owner row | **NOT wrapped** → a workspace per shadow (pollution); with a null name it can **ERROR and block the insert** |
| `create_user_security_settings` → `create_default_security_settings` | inserts `security_settings(user_id)` ON CONFLICT DO NOTHING | benign |

**Recommended approach (bring a Rule-A pros/cons before editing):** add a one-line early-return guard to each of the 4 trigger functions:
```sql
IF NEW.raw_user_meta_data->>'pulse_shadow' = 'true' THEN RETURN NEW; END IF;
```
…and mint shadow rows with `raw_user_meta_data = {"pulse_shadow": true}`. Then the shadow insert fires none of the side effects — clean, additive, reversible. **This edits existing SECURITY DEFINER functions → CLAUDE.md §0 Rule A requires an explicit, approved pros/cons first.** Dry-run-rollback each function change before applying.

**Alternatives (document, but weaker):** (a) mint-then-cleanup the spawned rows — fragile/racy; (b) DROP the 4 `auth.users` FKs to allow bare synthetic uuids — strictly worse (loses `ON DELETE CASCADE`, weakens integrity for ALL real rows).

**Deliverable for this step:** the Rule-A pros/cons doc → approval → a migration adding the 4 guards (dry-run first) → a service-role `ensureSlackShadowUser(team_id, slack_user_id, email?, display_name?)` helper (server-side, idempotent on the deterministic uuid). Verify: minting twice yields one row; the 4 side-effect tables (`pulse_users`, `workspaces`, `workspace_members`, `security_settings`) gain NO rows for a shadow.

---

## 4. P2 — Send-as-you (outbound 1:1). After the shadow mint.

Scope doc §14 P2. Build:
- **New authenticated send endpoint** in `server.js` (e.g. `POST /api/slack/send`): `resolveUserId(req)` → read the user's `xoxp-` from `user_slack_tokens` via `tokenStoreClient()` → `conversations.open` (needs `im:write`) then `chat.postMessage` **as the human** (server-injects `xoxp-`). **Do NOT** route the user token through the open body-token proxy `POST /api/slack/proxy` (`server.js:139`) — D7. On `invalid_auth`, delete the row + signal reconnect (mirror Gmail `invalid_grant`, `server.js:625-632`).
- **`slackService` send-as-you mode** (or a new client fn) that calls the new endpoint with the Bearer token (mirror `slackUserConnect.ts`'s `authHeaders()`).
- **Messages wiring:** for a `transport='slack'` conversation, route the composer send through the new endpoint instead of `pulseService.sendMessage` (`Messages.tsx:1342-1377`). Also write the **local outbound row** so the operator sees their sent message in the thread: `send_pulse_message(p_sender_id=PulseUser, p_recipient_id=shadow, …)` (needs the shadow conversation — hence shadow-mint is a prerequisite). Tag `metadata.transport='slack'`.
- Keep Phase-8 bot send (Contacts) untouched (D8 — both tokens coexist).
- **Verify:** a DM lands in Slack **as the operator** (not the app); `xoxp-` never appears client-side; the local outbound row renders right-aligned in the thread; Phase-8 send still works; tsc no-new-errors.

---

## 5. P3 — Inbound Events API (live 1:1). After P2.

Scope doc §9 + §14 P3. New `supabase/functions/slack-events/index.ts`, **skeletoned on `billing-webhook`** (the only existing HMAC mirror; `daily-webhook` declares but never verifies — don't copy its security; `webhookService.ts` is dormant + wrong HMAC — do NOT use). Request URL = `https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/slack-events`. Steps: raw `await req.text()` before parse → reconstruct `v0:{x-slack-request-timestamp}:{body}` → `'v0='+hex(HMAC-SHA256(SLACK_SIGNING_SECRET, basestring))`, constant-time compare (hand-rolled — no existing helper), 5-min replay window, 401 on mismatch → `url_verification` challenge echo → on `message` events skip echoes (`event.bot_id || event.subtype || event.user===ownBotUserId`) → de-dup on `slack_ts` (pre-insert SELECT on `pulse_messages.metadata->>'slack_ts'` + `X-Slack-Retry-Num` short-circuit) → resolve `event.user → contacts.slack_user_id → owning Pulse user` (**auto-create a contact if unknown — L3**), ensure the **shadow `auth.users` row** exists, upsert `pulse_conversations` (`transport='slack'`, external_* identity, `{user1_id:pulseUser, user2_id:shadow}`), INSERT `pulse_messages` (`sender_id:shadow, recipient_id:pulseUser, content_type:'text', metadata:{transport:'slack',slack_ts,slack_channel}`) via the **service-role** client. Both `pulse_*` tables are in `supabase_realtime` → the row is delivered live to the open thread (the existing `pulseService.subscribeToMessages` at `:704-730` catches it because `recipient_id` = the Pulse user). Always 200 fast (Slack 3s timeout). **L4 = go-forward only, no backfill.** Slack app config: subscribe to the **user-token** `message.im` event (a bot-token sub only delivers DMs to the bot).

---

## 6. P4 / P5 / P6 — see scope doc §11, §10, §14.

- **P4 Messages UI provenance:** branch the 10 Pulse-participant seams on `transport` (Reader-A list in the scope doc §4): relax the `validPulseConversations` `other_user`-only filter (`Messages.tsx:2798`), render external identity, **fix me/them at `Messages.tsx:4140`** (compare to the shadow uuid, not `other_user.id`), **gate OFF** presence/typing/READ receipts for `transport='slack'`, Slack **plum** marker (coral = AI-only, never here; rose = Send). Visual reference: `_design-playground/slack-messages-grounding.html` (Playwright-verified).
- **P5 Graduation (prompted-then-auto, L2):** new global SECURITY DEFINER `resolve_pulse_user_by_email` (un-gated, `is_bot`-filtered); flip = a **conditional MERGE** in one service-role txn (the unique-pair index `idx_pulse_conversations_unique_pair` throws on a naive re-point if a native conversation already exists — re-point `pulse_messages.thread_id` + counterpart side, delete the emptied shadow conversation); add a `pulse_conversations` UPDATE realtime subscription; persist `contacts.pulse_user_id`.
- **P6 Hardening:** confirm no `xoxp-` touches the open proxy; 429/Retry-After backoff for future channel/backfill; channels/threads/Marketplace/analytics stay out (their own flags).

---

## 7. Working conventions (this repo, this session)

- **`docs/*.md` is gitignored** (`.gitignore:161`) → commit docs with **`git add -f`** (the predecessor handoffs are tracked this way).
- **Commit with explicit paths**, never `-a`/`-A` — a parallel command-palette session also commits to `main` (it shipped `4c92bf3`, `dad241f`, etc. during this session). Verify `git diff --cached --name-only` shows only your files before committing. Don't stage its WIP.
- **Push only when asked.** `main` auto-deploys: Render (backend, on `server.js` changes) + Vercel (frontend). Pushing also carries the parallel session's commits that are already on local `main`.
- **`server.js` is NOT in the `tsc`/`vitest` project** — verify it with **`node --check server.js`**. The repo's **verify-gate Stop hook** blocks "done/fixed" claims unless a build/check ran *or* you explicitly state why it doesn't apply; for `server.js` say "`node --check` ran" + the result. tsc gate for `src/`: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, **917 = baseline**, gate on *no new* errors in touched files.
- **Schema-first + dry-run-rollback** every migration (`DO $$ … RAISE EXCEPTION 'rollback' $$` until clean, then apply once). Re-confirm the 4 `auth.users` FKs + `different_users`/`no_self_message` CHECKs + `idx_pulse_conversations_unique_pair` via `pg_constraint` (NOT `information_schema` — it hides cross-schema FKs) before building on them.

---

## 8. Start-here for the next session

1. Read `docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md` (the contract) + memory `project_pulse_slack_messages_grounding`, `reference_pulse_messages_auth_fks`.
2. **Resolve §3 (shadow-mint)** — draft the Rule-A pros/cons for the trigger-guard, get approval, implement + dry-run.
3. Build **P2** (§4), then **P3** (§5), each flag-gated (OFF), independently committed + verified.
4. Files: `server.js` (Slack block ~lines 665+, Gmail template 476-663), `src/services/slackUserConnect.ts`, `src/components/settings/integrations/SlackIntegration.tsx`, `src/services/pulseService.ts` (`getOrCreateConversation`/`sendMessage`/`subscribeToMessages`), `src/components/Messages.tsx` (the 10 seams), `supabase/functions/billing-webhook/index.ts` (Events skeleton), `src/services/dataService.ts` (`dbToContact`). Schema: `pulse_conversations`, `pulse_messages`, `contacts`, `user_slack_tokens`, `auth.users` (triggers).
