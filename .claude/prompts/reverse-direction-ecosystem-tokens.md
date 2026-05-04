# Prompt: Wire reverse-direction ecosystem tokens (entomate→pulse, LV→pulse)

> **How to use:** paste the entire contents of this file as the opening message to a fresh Claude Code session in the `f:\pulse1` repo. The prompt is self-contained — the agent does not need any conversation context to start.

---

You are picking up an ecosystem-bridge token alignment task. Pulse, Entomate, and Logos Vision are three separate Supabase projects that send cross-app events to each other via `ecosystem-inbound` edge functions. The **outbound direction (pulse → entomate, pulse → logos_vision) is fully working** as of session 2026-05-03 — heartbeats land green every 15 minutes, and `ecosystem_config.last_heartbeat` updates on all three rows in pulse-chat. This prompt covers the **reverse direction**: entomate or LV calling INTO pulse-chat.

## Why this matters

Heartbeat is one-way (pulse calls out, others respond pong). But real ecosystem events are bidirectional:
- Entomate → pulse: e.g. when a meeting note triggers a task in pulse
- Logos Vision → pulse: e.g. when a contact is updated in LV that should reflect in pulse

If a foreign app calls pulse-chat's `ecosystem-inbound` today, the request will be **rejected with HTTP 401** because pulse-chat's `ecosystem_config.inbound_token` for those rows currently holds **stale legacy values that don't match what the foreign apps will actually send**.

## Background — how the auth model works (read this first)

The `ecosystem-inbound` function on each project:

```ts
const token = req.headers.get('X-Ecosystem-Token');
const { data: config } = await supabase
  .from('ecosystem_config')
  .select('*')
  .eq('inbound_token', token)
  .eq('enabled', true)
  .single();
if (!config) return 401;
```

Receiver looks up the inbound `X-Ecosystem-Token` against its own `ecosystem_config.inbound_token` column. If found AND `enabled=true`, the call proceeds.

So for app A → app B to work:
- A's `ecosystem_config` row for "B" has `service_token = T_AB` (what to send when calling B)
- B's `ecosystem_config` row for "A" has `inbound_token = T_AB` (what B expects when A calls in)

These can be the same value (symmetric, simple) or different (asymmetric, stronger isolation per direction). Today's setup is symmetric for the outbound direction (we set `pulse-chat.pulse-row.inbound_token = pulse-chat.pulse-row.service_token` for the self-ping).

**Required headers** when calling `ecosystem-inbound`, learned the hard way in the prior session — entomate's and LV's deployed functions reject anything missing these:
- `Content-Type: application/json`
- `Authorization: Bearer <target-project-publishable-key>` (Supabase API gateway)
- `apikey: <same-publishable-key>` (some receivers explicitly check this header too)
- `X-Ecosystem-Token: <the-shared-secret>` (function-level auth — what this prompt is about)
- `X-Ecosystem-Source: <caller-app-name>` (e.g. `entomate`)
- `X-Ecosystem-Event-Id: <uuid>`

## Operational facts you need

- **Pulse-chat Supabase project ref:** `ucaeuszgoihoyrvhewxk` (region us-east-1, in Quantum Ecosystems org)
- **Entomate project ref:** `epftmicjaxrthmpyoguy`
- **Logos Vision project ref:** `psjgmdnrehcwvppbeqjy` (was the placeholder `your-logos-vision-project` until 2026-05-03)
- **Pulse-chat publishable key:** `sb_publishable_gm7Ipp-tgXIxo97cUpvdPA_GzelsBtf`
- **Entomate publishable key:** `sb_publishable_Er9gBHA5IudEBgy6kZTSLw_55XYeW8O`
- **LV publishable key:** `sb_publishable_4kAMZda2ZUsfd98QDOB-XQ_aJJXPSYp`

## Step 1 — Inspect what pulse-chat currently expects

Use the Supabase MCP `execute_sql` against project `ucaeuszgoihoyrvhewxk` (DO NOT log secrets — only show prefixes):

```sql
SELECT app_name,
       LEFT(service_token, 12) || '...' AS svc_preview,
       LEFT(COALESCE(inbound_token,''), 12) || '...' AS inb_preview,
       enabled,
       last_heartbeat
FROM ecosystem_config
ORDER BY app_name;
```

Expected current state (as of 2026-05-03 session close):
- `pulse` row: `service_token = inbound_token` (symmetric, set during self-ping fix)
- `entomate` row: `service_token = 39aa886e7f75…` (used for pulse → entomate, set in heartbeat config), `inbound_token` = some legacy value that does NOT match what entomate's `pulse` row sends
- `logos_vision` row: similar — `service_token = 1f46d01886ca…`, `inbound_token` = legacy, mismatched

The legacy `inbound_token` values were set when the schema was first scaffolded and have never been aligned with the corresponding sender's `service_token` on the foreign project.

## Step 2 — Decision point: symmetric vs fresh tokens

Two strategies, pick one with the user:

### Strategy A — symmetric (simplest, recommended for trusted ecosystem)

Make pulse-chat's `inbound_token` match the foreign project's `service_token` (whatever value entomate has set as `entomate.service_token` for "pulse"). User must query each foreign project to retrieve.

### Strategy B — generate fresh paired tokens, update both sides

Generate a new shared secret per app pair (`T_pe` for pulse↔entomate, `T_pl` for pulse↔logos_vision). Update BOTH:
- pulse-chat: `inbound_token` for that row = new value
- foreign project: `service_token` for "pulse" row = same new value (and vice-versa for the OUTBOUND direction)

Strategy B is cleaner and rotation-friendly. Strategy A is faster if you just want it working.

**Default to Strategy A unless the user prefers B.**

## Step 3 — For each foreign project, gather the value

If Strategy A: ask the user to run this on **entomate's Supabase SQL Editor** (project `epftmicjaxrthmpyoguy`):

```sql
-- What entomate sends to pulse as X-Ecosystem-Token
SELECT app_name, LEFT(service_token, 12) || '...' AS svc_preview, enabled
FROM ecosystem_config
WHERE app_name = 'pulse';
```

User pastes back the FULL `service_token` value (not just the preview). That value goes into pulse-chat's `entomate.inbound_token`.

Repeat for **LV's Supabase SQL Editor** (project `psjgmdnrehcwvppbeqjy`):

```sql
SELECT app_name, LEFT(service_token, 12) || '...' AS svc_preview, enabled
FROM ecosystem_config
WHERE app_name = 'pulse';
```

If the foreign project has NO row for `app_name = 'pulse'`, this is a setup issue — that project has never been configured to call pulse. Ask the user whether they want to create one (Strategy B is the fix in that case).

## Step 4 — Update pulse-chat

Once you have the two values from the user, run via Supabase MCP `execute_sql` on `ucaeuszgoihoyrvhewxk`:

```sql
UPDATE ecosystem_config
SET inbound_token = '<value-from-entomate>', updated_at = now()
WHERE app_name = 'entomate';

UPDATE ecosystem_config
SET inbound_token = '<value-from-logos_vision>', updated_at = now()
WHERE app_name = 'logos_vision';

-- Verify
SELECT app_name,
       LEFT(service_token, 12) || '...' AS svc_preview,
       LEFT(inbound_token, 12) || '...' AS inb_preview
FROM ecosystem_config WHERE app_name IN ('entomate','logos_vision');
```

## Step 5 — Verify the reverse path works

Pulse-chat has the helpers from the prior session ready:
- `pg_net` extension installed (schema `net`)
- `cron_secret` in `vault.decrypted_secrets`
- Ecosystem-inbound deployed at `https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound`

To verify entomate can NOW reach pulse, fire a synthetic call FROM pulse-chat TO pulse-chat **using entomate's expected outbound headers** (this simulates what entomate's heartbeat would send):

```sql
WITH r AS (
  SELECT net.http_post(
    url     := 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound',
    headers := jsonb_build_object(
      'Content-Type',         'application/json',
      'Authorization',        'Bearer sb_publishable_gm7Ipp-tgXIxo97cUpvdPA_GzelsBtf',
      'apikey',               'sb_publishable_gm7Ipp-tgXIxo97cUpvdPA_GzelsBtf',
      'X-Ecosystem-Token',    '<value-from-entomate>',
      'X-Ecosystem-Source',   'entomate',
      'X-Ecosystem-Event-Id', gen_random_uuid()::text
    ),
    body    := jsonb_build_object(
      'id',           gen_random_uuid()::text,
      'source',       'entomate',
      'timestamp',    now()::text,
      'serviceToken', '<value-from-entomate>',
      'eventType',    'heartbeat',
      'data',         jsonb_build_object('app','entomate')
    )
  ) AS request_id
)
SELECT request_id FROM r;
```

Wait 2-3 seconds, then:

```sql
SELECT id, status_code, content::text AS body
FROM net._http_response
ORDER BY id DESC LIMIT 1;
```

**Success criteria:** `status_code = 200`, body shape like `{"success":true,"pong":true,...}` or similar (depends on what pulse-chat's `ecosystem-inbound` returns for heartbeats — read `supabase/functions/ecosystem-inbound/index.ts` if you need the exact shape).

If 401: re-check Step 4 ran cleanly and the value matches what entomate actually sends. The user may have copy-pasted with whitespace or grabbed the wrong column.

Repeat for LV with `'X-Ecosystem-Source': 'logos_vision'` and the LV value.

## Step 6 — Commit + summarize

There is no code change in this task — only DB updates on pulse-chat. Don't commit anything. Just summarize for the user:
- What tokens were aligned
- That pulse-chat now accepts inbound from entomate + LV
- Note that the foreign projects' OUTBOUND code (their heartbeat function or whatever sends to pulse) must also be sending the same 6 headers from "Background" above — if they aren't, those calls will still fail even with tokens aligned. Suggest checking each foreign project's outbound function code if anything still 401s in practice.

## Working rules

- Don't log secret values. Use `LEFT(token, 12) || '...'` for previews when reading. When writing UPDATEs that contain the actual secret, the value lives in the SQL but does not need to be echoed back to the user in summaries.
- Use the Supabase MCP `execute_sql` for reads, not raw migrations. This is data, not schema.
- Pulse-chat is `ucaeuszgoihoyrvhewxk` — never confuse with entomate (`epftmicjaxrthmpyoguy`) or LV (`psjgmdnrehcwvppbeqjy`).
- The user only has access to their own projects via the Supabase Dashboard. The MCP only reaches pulse-chat. So foreign-project SQL is "ask the user to run this and paste back."
- Memory `project_ecosystem_bridge_auth.md` has additional context on the two-header pattern.

## First-message format expected from you

Reply with:

```
✅ Read prompt. Understanding confirmed.
📋 Step 1: I'll inspect pulse-chat's current ecosystem_config state.
   <run the query, summarize prefixes only>
🎯 Strategy proposed: A (symmetric) / B (fresh tokens) — recommendation + why
   Confirm strategy before I ask you for token values?
```

Then wait for the user's go-ahead before running any UPDATE.
