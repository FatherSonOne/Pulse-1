---
name: launch-followups
description: Walk the human through the pending Pulse pre-launch follow-ups (Vercel env vars, live smoke tests, decisions, etc.) one at a time, in priority order. Tracks completion state inline.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - WebFetch
---

<objective>
Drive the **human-action queue** for Pulse launch — the items that `/launch-prep` cannot do because they require browser clicks, Vercel access, real OAuth flows, a lawyer, or an operator decision. Walk the human through them **one item per turn**, with full detail per step, verifying completion before moving on. Update the inline checklist in this file as each item closes.

Usage:
- `/launch-followups` — auto-pick the next unchecked item in priority order.
- `/launch-followups <key>` — jump to a specific item by key (e.g. `vercel-region`, `calea`, `keystore`). Keys are listed in the checklist below.
- `/launch-followups status` — print the checklist + remaining count, no work.
- `/launch-followups skip` — mark the current item as skipped (with a reason the user gives) and advance.

This is the sister command to `/launch-prep`. `/launch-prep` works the **code-actionable** roadmap issues; `/launch-followups` works the **human-only** items that the roadmap surfaced.
</objective>

<process>

## Step 0 — Session safety (CLAUDE.md is law)

```bash
git branch --show-current
git status --short
```
- If on `main` with a clean tree: proceed.
- **If there is uncommitted work this session did not author**: STOP. Surface paths + a one-line characterization. Ask the human before doing anything else. (Same pause-and-verify rule as `/launch-prep`.)
- Never branch. Never run a destructive git operation. Same hard-nevers as CLAUDE.md.

## Step 1 — Read the checklist

The checklist lives at the bottom of this file ("## Checklist state" section). Each item has:
- A unique `key:` (used for `/launch-followups <key>`)
- A status: `pending` / `in-progress` / `done` / `skipped` / `parked`
- A priority bucket (P0 / P1 / P2 / P3)
- Last-touched date (when state changed)

If the argument is `status`: print the checklist + remaining count and stop.

## Step 2 — Pick the item

- If a `<key>` was passed, jump to that item (verify it's `pending` or `in-progress`).
- Otherwise, pick the **highest-priority `pending`** item (P0 → P1 → P2 → P3, lowest priority first if tied).
- If everything is `done`/`skipped`/`parked`, congratulate the user and stop.

## Step 3 — Walk the item

For the chosen item:

1. **Find the item's detail block** in this file under "## Item details". Each item has WHY / WHAT / VERIFY / NOTES sections.
2. **Present the WHY** in 2-3 sentences so the user knows what they're about to do and why it matters.
3. **Walk through WHAT step by step.** Number each step. Where commands or URLs are involved, paste them verbatim — don't make the human alt-tab to look things up.
4. **Pause for the human to do the action.** Some steps you can verify yourself (read a file, curl an endpoint, query Supabase via MCP); others require the human to attest ("yes, the channels loaded").
5. **For decisions (CALEA, E2EE, v1 lane):** draft the options brief + recommendation, present via `AskUserQuestion`, capture the human's choice, write the decision doc.
6. **Mark the item `in-progress`** in the checklist as soon as you start it.

## Step 4 — Verify

After the human says they're done (or the agent-verifiable check passes):
- Run any VERIFY step the item specifies.
- If verification fails, surface what failed and let the user retry or skip.
- If verification passes, mark `done` + record today's date in the checklist.

## Step 5 — Update + report

1. Update the checklist row in THIS file (status + last-touched date).
2. If the item touches a roadmap issue (#99, #103, #110, #111, #113, #115, etc.), post a comment on that issue capturing what was verified. Close the issue if appropriate.
3. If the item touches the roadmap doc (`docs/PULSE_PRELAUNCH_ROADMAP.md`), update the relevant row.
4. Commit the checklist + roadmap changes with `docs(launch-followups): <key> done` (explicit paths, no `git add -A`).
5. Push.
6. Report: which item, what verified, what's next. STOP — one item per invocation.

</process>

<guardrails>
- **One item per invocation.** Resist running multiple Vercel env-var changes back to back in the same turn — each one needs its own redeploy + verification.
- **Never branch.** Same as CLAUDE.md.
- **Never commit secrets.** PostHog API keys / Supabase service-role keys / Twilio creds NEVER land in code or markdown — they live in Vercel/Supabase secret vaults only. If a step would write a key to a file, refuse and ask the human to put it in the relevant vault instead.
- **External services (Vercel, PostHog, Twilio, Play Console, Supabase Studio):** the agent cannot click these for the human. State each click precisely; the human does it; the agent verifies the outcome (via a curl, a Supabase query, or attestation).
- **Decisions are the human's.** For CALEA/E2EE/v1 lane, the agent presents options + a recommendation, never picks for the human.
- **Truth in completion.** Don't mark `done` based on the agent's belief — only on verification or explicit human attestation.
</guardrails>

---

## Item details

Each item: a unique `key`, WHY (motivation), WHAT (exact steps), VERIFY (how to confirm), NOTES (gotchas).

### `vercel-region` — Set `VITE_SUPABASE_REGION` in Vercel (P0, #111)

**WHY.** Settings → Privacy/Compliance currently falls back to "Multi-region" because the env var is unset. The code reads `import.meta.env.VITE_SUPABASE_REGION` — without it, you're showing a vague/wrong region label to users asking "where does my data live?" The var is wired and documented in `docs/DSAR_RUNBOOK.md`; only the Vercel value is missing. Last gating piece for #111.

**WHAT.**
1. Go to https://vercel.com/dashboard
2. Open the Pulse project (likely `pulse-frontend` or similar — confirm by checking which one has `pulse.logosvision.org` as a domain)
3. Settings → Environment Variables → "Add New"
4. **Name:** `VITE_SUPABASE_REGION`
5. **Value:** `US East (us-east-1)` (verbatim — matches DSAR_RUNBOOK string)
6. **Environments:** tick **Production** AND **Preview** (leave Development unchecked — local devs may want the fallback for testing)
7. Save
8. Deployments tab → latest production deployment → ⋮ menu → "Redeploy" → confirm. Wait for green.

**VERIFY.**
- Open `pulse.logosvision.org` → log in → Settings → Privacy or Compliance section
- The region label should now read **"US East (us-east-1)"** instead of "Multi-region"
- Agent can also verify by fetching the deployed bundle and grepping for the string: `curl -s https://pulse.logosvision.org/ | grep -o 'pulse-[a-z0-9]*\.js' | head -1` then fetching that bundle and grepping for `US East`

**NOTES.**
- Don't deploy a new commit — Vercel will redeploy with the new var on the existing build. If for any reason you need a fresh build, `git commit --allow-empty -m "chore: trigger redeploy"` is fine but not necessary.

---

### `vercel-posthog` — Set PostHog env vars in Vercel (P0, #117)

**WHY.** #117 wired PostHog instrumentation end-to-end (identify, activation funnel, trunk message event) but the SDK is gated on `VITE_POSTHOG_API_KEY` being set AND `VITE_APP_MODE !== 'development'`. Without the key in Vercel, the deployed bundle never `.init()`s and zero events arrive. Set this and the four insights from `docs/PULSE_NSM_AND_RETENTION_GUIDE.md` come alive.

**WHAT.**
1. **If you don't have a PostHog project yet:**
   - https://app.posthog.com → create project "Pulse Production" (or "Pulse" — your call)
   - Settings → Project → Project API Key — copy the `phc_…` string
   - Note the API host (Settings → Project header shows it): typically `https://us.i.posthog.com` (US cloud) or `https://eu.i.posthog.com` (EU cloud)
2. **In Vercel** → Pulse project → Settings → Environment Variables → Add New, twice:
   - `VITE_POSTHOG_API_KEY` = `phc_…` (the value you copied)
   - `VITE_POSTHOG_HOST` = `https://us.i.posthog.com` (or your region's host)
3. **Both:** Production + Preview (skip Development — local stays dormant per the existing `VITE_APP_MODE !== 'development'` gate in `src/lib/monitoring/analytics.ts:23-27`)
4. Save → Redeploy from the Deployments tab

**VERIFY.**
- Open `pulse.logosvision.org` in **incognito** (so PostHog sees a fresh distinct_id)
- Log in → send one Pulse message
- Within ~30 seconds, in PostHog → **Activity** → Live events should show `$identify` then `Message Sent` arriving
- If nothing arrives within 60s: open browser DevTools → Network tab → filter `i.posthog.com` — you should see at least one POST to `/e/`. If the request 4xx's, the API key is wrong. If there's no request at all, the env var didn't reach the bundle (check Vercel deployment logs)

**NOTES.**
- Don't paste the `phc_…` key into chat or commits — it's a project key, not catastrophic if leaked, but treat as secret. Vercel-only.
- After events arrive, do `vercel-posthog-dashboards` next to actually build the four insights.

---

### `live-smoke-99` — Live Slack + Gmail round-trip smoke (P0, #99)

**WHY.** The Render-deployed backend (`pulse-api-1epw.onrender.com`) has Slack/Twilio/Gmail proxy routes mounted, input-validating, and CORS-correct. But no human has yet completed a full OAuth round-trip from the live `pulse.logosvision.org` against a real Slack workspace or Gmail mailbox. Until that smoke runs, #99 stays `in-progress` with theoretical correctness, not verified.

**WHAT — Slack.**
1. Open `pulse.logosvision.org` (production, not preview)
2. Log in as `fm1@qntmecos.com`
3. Settings → Integrations → Slack section → "Connect Slack" (or equivalent CTA)
4. Authorize on Slack's OAuth screen for any workspace you own
5. You should land back in Pulse with the workspace appearing in the integration card
6. Open the Unified Inbox → Slack tab → channels should populate within a few seconds
7. Pick a channel → click in → recent messages should load

**WHAT — Gmail.**
1. Settings → Integrations → Gmail
2. "Connect Gmail" → grant scopes on the Google consent screen
3. Return to Pulse → token stored (the integration card should switch to "Connected")
4. Open Email / Unified Inbox view → recent Gmail threads should load
5. (Optional, stronger smoke) wait an hour, refresh → backend should auto-refresh the access token via the Render route. If you see auth errors instead of fresh data, the refresh path is broken.

**VERIFY.**
- Agent: `curl -s https://pulse-api-1epw.onrender.com/api/health` should still 200 (backend up).
- Human attestation for the OAuth round-trips (the agent can't drive the browser).
- **Capture evidence:** screenshot Slack channels list + a loaded Gmail thread. Save to `docs/_evidence/99-live-smoke-<YYYY-MM-DD>/` (gitignored) OR drop into a comment on issue #99.

**NOTES.**
- If Slack OAuth fails with a "redirect_uri mismatch" — the Slack app's redirect URI in the Slack admin needs to be `https://pulse-api-1epw.onrender.com/api/slack/callback`. Update it in the Slack app config, retry.
- If Gmail OAuth fails — same shape, check the Google Cloud Console OAuth credentials' Authorized redirect URIs include `https://pulse-api-1epw.onrender.com/api/gmail/callback`.
- **CRM OAuth** is intentionally out of scope here — it's broken server-side (browser-Supabase coupling, see roadmap #99 notes) and tracked separately. Don't test it under this item.
- Closing #99: requires both Slack + Gmail smokes pass. CRM refactor and LV redirect remain deferred follow-ups (file separately if needed).

---

### `delete-test-111` — Throwaway-account deletion test (P0, #111)

**WHY.** The #111 fix added a `delete-account` edge function that does the full erasure including `auth.users` (the pre-fix bug was leaving identity intact, making the in-app GDPR Art. 17 "right to erasure" claim false). Can't verify on `fm1@` because the op is irreversible and `auth.uid()`-guarded — you'd destroy your operator account. Need a disposable account to confirm the cascade actually works.

**WHAT.**
1. Pick a Gmail alias you can receive at: `jehovahsneaky83+pulsedeltest1@gmail.com` (or any address you control — Gmail's `+suffix` aliasing routes back to the parent inbox)
2. Open `pulse.logosvision.org` in **incognito** so it doesn't try to use your `fm1@` session
3. Sign up with the alias + a throwaway password
4. Complete bare-minimum onboarding (organization name, etc.) — enough to get into the app
5. Send 1-2 messages so erasure has data to remove (creates rows in `voxer_recordings`, `messages`, etc.)
6. Settings → Privacy → Account Erasure → "Delete Account"
7. Confirm the modal
8. The app should log you out and redirect to landing
9. **Agent verifies in Supabase** via MCP (`mcp__claude_ai_Supabase__execute_sql` against project `pulse-chat` / ref `ucaeuszgoihoyrvhewxk`):
   - `select count(*) from auth.users where email = 'jehovahsneaky83+pulsedeltest1@gmail.com'` → expect **0**
   - `select count(*) from public.pulse_users where email ilike '%pulsedeltest1%'` → expect **0**
   - `select count(*) from public.user_profiles where email ilike '%pulsedeltest1%'` → expect **0**
10. **Human verifies login is impossible:**
    - Try logging back in with the throwaway credentials → should fail "Invalid login credentials"

**VERIFY.** All four SQL counts return 0 + login fails.

**NOTES.**
- If any count returns > 0: the erasure RPC didn't cascade fully. Capture the failing table + row count + post to a reopened #111 comment; spawn `/launch-prep 111` next to fix.
- The 13 NO-ACTION FK columns from the original audit (subtasks, task_activity, crm_*, ecosystem_alerts, org_invites, org_members, share_invites, archives, user_sessions) all get cleared by the expanded RPC; if any of them still hold references, the `auth.admin.deleteUser` call would 23503 — the deletion would have visibly failed in step 8 with an error, not silently succeeded.
- Save the Gmail alias somewhere — if you want to re-test after a future migration, reuse the same alias and the test is fast (sign up → delete → verify).

---

### `keystore-backup` — Back up the Android upload keystore (P0, #103)

**WHY.** `android/app/pulse-release-key.jks` and `android/keystore.properties` are gitignored — they live only on your machine. Lose the machine and you cannot publish updates to the existing Play listing. The entire app entry dies. Back this up BEFORE you ever upload to Play; once you've shipped one signed AAB, those keys are load-bearing forever (or until you complete Play App Signing enrollment — next item).

**WHAT.**
1. **Locate the files** (the agent can verify):
   - `f:/pulse1/android/app/pulse-release-key.jks` — the binary keystore
   - `f:/pulse1/android/keystore.properties` — the passwords/aliases file
2. **Copy both to two offsite locations:**
   - **Encrypted external drive** (BitLocker container, VeraCrypt volume, or APFS-encrypted USB)
   - **Password manager** (1Password / Bitwarden / KeePassXC) as encrypted file attachments — most password managers support this
3. **Also store the credentials as a separate note** in the password manager:
   - Keystore password (from `keystore.properties` — `storePassword`)
   - Key password (`keyPassword`)
   - Alias (`keyAlias`, currently `pulse-key`)
4. **Verify the backup is restorable:**
   - Restore one of the backed-up keystores to a temp folder (e.g. `C:\tmp\test-restore\pulse-release-key.jks`)
   - Run from PowerShell:
     ```powershell
     keytool -list -keystore C:\tmp\test-restore\pulse-release-key.jks -alias pulse-key
     ```
   - Enter the keystore password when prompted
   - Should print "Owner: …, Certificate fingerprints: SHA1: …, SHA-256: …"
   - If it errors with "keystore was tampered with" — backup is corrupt; retry the copy.
5. **Delete the temp restore** when done so you only have the real keystore in your working tree.

**VERIFY.**
- Agent: `ls f:/pulse1/android/app/pulse-release-key.jks` (the source file still exists)
- Agent: `ls f:/pulse1/android/keystore.properties` (likewise)
- Human attestation: backup keystores stored in 2 offsite locations + verified restorable.

**NOTES.**
- The `keytool` command ships with the JDK (you have one installed because Android Studio runs). If `keytool` is not on PATH, find it under `<JDK_HOME>/bin/keytool.exe`.
- Do **not** commit the keystore. It's in `.gitignore`; if you ever see it appear in `git status`, STOP and add to gitignore before doing anything else.
- The runbook for the full keystore lifecycle is `docs/ANDROID_RELEASE_RUNBOOK.md`.

---

### `play-signing` — Enroll in Play App Signing (P0, #103)

**WHY.** Even with the backup above, you carry full key-loss risk forever if you sign uploads with your local keystore. **Play App Signing** moves the actual app-distribution signing key into Google's HSM; you only manage an *upload* key (which Google can rotate if you lose it). Once enrolled, losing your local keystore is recoverable. Without enrollment, it's not.

**WHAT.**
1. **Build the AAB** (if you haven't recently):
   ```powershell
   npm run android:bundle
   ```
   - Output: `f:/pulse1/android/app/build/outputs/bundle/release/app-release.aab`
   - Agent can verify the file exists + size > 0
2. **Go to Play Console:** https://play.google.com/console
3. If this is the first time uploading Pulse: create the app → fill the required listing fields (privacy policy URL, default language, app category, etc.) → Save draft
4. Release → Production → "Create new release"
5. Upload `app-release.aab`
6. Play Console will prompt: **"Continue to use Play App Signing"** — YES, opt in (this is the default for new apps; for existing apps that already opted out, see the alternative path in the runbook)
7. Google generates the **app signing key** in their HSM. You can't download it (that's the point — they hold it, you can't lose it).
8. Your local `pulse-release-key.jks` becomes the **upload key** going forward. Google re-signs every upload with the app signing key before distributing to devices.
9. **Save the upload certificate fingerprint** that Play Console displays. You'll need it if you ever pin SHA-256 with a third-party SDK (Google OAuth, Facebook SDK, etc.).
   - For Pulse: Google OAuth on Android currently uses the certificate fingerprint configured in Google Cloud Console → Credentials → OAuth 2.0 Client IDs → Android. After App Signing enrollment, **update that fingerprint to match the new app-signing certificate** that Play Console gives you (NOT your local upload cert). Otherwise Google OAuth on prod devices will break.
10. Submit the release for review (can keep it as "Internal testing" track to avoid actual public rollout while smoking).

**VERIFY.**
- Play Console shows "Play App Signing: Enabled" on the app's overview.
- App signing certificate fingerprint visible + saved.
- (Optional) Test install from Internal testing track on a real Android device → app launches + Google OAuth still works.

**NOTES.**
- Once you've opted in, you can't opt out without a 30-day key transition window. Make sure you actually want this. (You do — there's no scenario where local-key-only is better than App Signing for a solo project.)
- The `keystore-backup` item above is still useful even after Play App Signing — your upload key still matters (if you lose it, you have to ask Google to rotate, which involves identity verification and a delay).
- See `docs/ANDROID_RELEASE_RUNBOOK.md` for the full recovery model.

---

### `calea` — CALEA legal determination for voice/video (P1, #110)

**WHY.** CALEA (47 USC §1001 et seq) requires "telecommunications carriers" to design networks for lawful intercept. Whether Pulse Relay (WebRTC voice via Daily.co + async voice messaging) qualifies is a lawyer question with significant downstream consequences (architecture, compliance, audit costs). Skip the determination and you're flying blind; pay $300-500 for a 30-min consult and you get a yes/no/conditional answer.

**WHAT.**
1. **Find a US lawyer with telecom/CALEA experience:**
   - LinkedIn search: "CALEA attorney" + "VoIP CALEA"
   - Or: search the FCC's CALEA registration database for filings from small VoIP operators, then look up their counsel — those lawyers know this niche.
   - Or: ask in r/lawyers or a LinkedIn AdLaw group for a CALEA-specialist referral.
   - Or: existing legal contact → ask for a CALEA-specialist referral.
2. **Brief them with this exact framing** (copy-paste):

   > We operate **Pulse**, a B2B communications app for SMB teams. The voice features in question:
   > 1. **Real-time voice/video** — WebRTC browser-to-browser audio/video via a SaaS provider (Daily.co). No PSTN, no SIP trunk, no TDM. No phone numbers assigned.
   > 2. **Async voice messaging** — recorded audio stored in object storage and replayed in the app.
   > 3. **Async video messaging** ("Glimpse") — recorded video stored similarly.
   >
   > We do **not** interconnect with the PSTN, do **not** assign phone numbers, do **not** operate as a CLEC. Users are authenticated and communicate within the app.
   >
   > Questions:
   > 1. Are we a "telecommunications carrier" under 47 USC §1001(8)(A)(i-iii)?
   > 2. Are we an "interconnected VoIP provider" under the FCC's 2005 First Report and Order (FCC 05-153) extending CALEA to interconnected VoIP?
   > 3. If not currently covered, what business changes would trigger CALEA obligations (e.g. adding PSTN interconnection, phone-number assignment, a certain user-count threshold)?
   > 4. What are our obligations for **lawful intercept assistance** absent CALEA coverage (Stored Communications Act, Wiretap Act 18 USC §2511(2)(a)(ii), pen register / trap-and-trace orders)?

3. **Budget:** $300-500 for a 30-min consult + 1-page memo. Don't pay for a full opinion letter unless they say "yes you're covered" (then you need one).
4. **Decision capture (agent will help draft):**
   - **If not covered (most likely outcome):** memo + reasoning → write `docs/CALEA_DETERMINATION_RUNBOOK.md` (allowlisted via `*_RUNBOOK.md` pattern). Document the lawyer's name, date of consult, the cited authorities, and the trigger conditions that would change the answer.
   - **If covered:** new launch-blocker. Open a new launch-roadmap issue: "CALEA-compliant architecture for voice/video" — probably means dropping Daily.co for a self-hosted SFU with intercept hooks, OR partnering with a CALEA-compliant voice provider. This is a 3-6 month re-architecture. Pulse v1 launch must either delay or **disable voice features** until resolved.
   - **If "depends on user count" or other threshold:** runbook captures the threshold + adds a triggered monitoring task (e.g. "when MAU crosses N, reassess").

**VERIFY.** Memo received from lawyer (date, name, citation). Runbook drafted.

**NOTES.**
- Agent CANNOT do the lawyer search or the consult; this is pure human action.
- Agent CAN: help draft the runbook from the memo content the user pastes in.
- Don't post the memo content to GitHub issue #110 publicly — your lawyer consult is privileged work product. Reference its existence + summary only.

---

### `e2ee` — E2EE positioning decision (P1, #113)

**WHY.** Pulse's server-side AI features (summaries, autocompose, embeddings, RAG, the cross-surface AI moat) require the server to see plaintext content. Client-side E2EE blocks all of that. You cannot honestly market both "your messages are E2EE and not even Pulse can read them" AND "our AI summarizes your threads." Pick one, defend it, write it in the Privacy Policy + marketing.

**WHAT.** This is a decision item — the agent will draft + present options + capture your choice.

The three options (the agent will present these via `AskUserQuestion`):

- **Option A — Server-side AI (current architecture, recommended):**
  Privacy Policy says: "Messages are encrypted in transit (TLS) and at rest (Supabase storage encryption). AI services process content server-side for the features you opt into." You lose the "true E2EE" marketing claim. You keep the cross-surface AI differentiator. This is what Pulse is wired for today; no architecture change needed.

- **Option B — Selective E2EE for one surface:**
  Pulse Relay 1:1 voice could be E2EE via Daily.co's mesh option (no SFU recording, no server transcription on that surface). Other surfaces stay server-AI-enabled. Hybrid story is honest but complex to explain. Competing with Signal/WhatsApp on E2EE is a losing fight regardless — they already won that brand.

- **Option C — Full E2EE:**
  Drop server-side AI features entirely. Pulse becomes "encrypted Slack alternative" — competitive position with Element/Matrix, but loses 80% of the AI moat. Almost certainly wrong for Pulse.

**Agent flow:**
1. Read the existing Privacy Policy `src/components/PrivacyPolicy.tsx` and pull the current §5 (AI processing) language.
2. Present the three options via `AskUserQuestion`.
3. Once the human picks, draft `docs/E2EE_POSITIONING_GUIDE.md` capturing the decision + reasoning + the exact Privacy Policy + marketing language to use.
4. If Option A picked: spot-check Privacy Policy §5 + ToS — they should already align (post #112). Note any drift.
5. If Option B or C picked: surface the architecture changes needed as new launch-roadmap issues (and probably delay launch).

**VERIFY.** Decision doc written + (if Option A) Privacy Policy already aligned.

**NOTES.**
- Recommendation: Option A. Pulse's whole product position is AI-over-comms; E2EE is a feature you build later for a specific surface if a customer demands it.
- Once decided, close #113 with the decision summary + link to the guide.

---

### `posthog-dashboards` — Build the four NSM dashboards in PostHog (P1, #117)

**WHY.** #117 wired the events but the dashboards exist only as instructions in `docs/PULSE_NSM_AND_RETENTION_GUIDE.md` §3. Build them once and they auto-update forever. Without them, the events arrive but you have no view into them.

**WHAT.** (Do this AFTER `vercel-posthog` is done and you've confirmed events are arriving in PostHog.)

Walk through each of the four insights:

1. **Insight 1 — DAU/MAU Stickiness Trend**
   - PostHog → Insights → New Insight → Trend
   - Series A: event `Message Sent`, math = "Unique users", date range last 7 days, interval = Day → label "DAU"
   - Series B: event `Message Sent`, math = "Unique users", date range last 28 days, interval = Day → label "MAU"
   - Formula: `A/B` → label "DAU/MAU Stickiness"
   - Y-axis: percentage
   - Save as "DAU/MAU Stickiness"

2. **Insight 2 — D1/D7/D30 Cohort Retention**
   - New Insight → Retention
   - Starting event: `$identify` (PostHog auto-event fired by `identifyUser` in `AuthContext`)
   - Returning event: `Message Sent`
   - Retention type: "First time" (cohort = users who first identified on day X)
   - Period: Day. Show 30 periods.
   - Save as "Pulse Retention — D1/D7/D30"

3. **Insight 3 — Activation Funnel**
   - New Insight → Funnel
   - Step 1: `$identify` (first auth)
   - Step 2: `onboarding.surface_shown` (post-Stripe surface mounted)
   - Step 3: `onboarding.first_message_sent` (PRIMARY ACTIVATION)
   - Step 4: `onboarding.teammate_invited` (NETWORK ACTIVATION)
   - Conversion window: 7 days
   - Save as "Activation Funnel"

4. **Insight 4 — NSM (placeholder)**
   - The real NSM needs the aggregation cron from GUIDE §5 — until then, a proxy:
   - New Insight → Trend
   - Event: `Message Sent`, math = "Total count", interval = Week
   - Breakdown by: event property `workspace_id` if it's being passed (check the `pulseService.ts` trunk call — currently `trackMessageSent` doesn't include workspace_id; if you want this insight functional, file a small follow-up to add `workspace_id` to the `trackMessageSent` properties)
   - Save as "NSM Proxy — Weekly Messages by Workspace"

5. **Bundle the four into a Dashboard:** Dashboards → New Dashboard "Pulse — North Star" → Add Insight × 4. Pin it as your homepage in PostHog.

**VERIFY.**
- All four insights saved + visible in the dashboard.
- Insights 1-3 should immediately render real data (you generated some by the smoke in `vercel-posthog`).
- Insight 4 may be empty until `workspace_id` is added to the trunk event (follow-up to file).
- Screenshot the dashboard once data populates → save to `docs/_evidence/posthog-dashboard-<date>.png` or post to #117 comment.

**NOTES.**
- Real NSM aggregation needs either (a) a Supabase weekly cron writing an `nsm_weekly` row + a single PostHog `nsm.snapshot` capture, or (b) PostHog Group Analytics (paid tier). See GUIDE §5 for both paths. Decide before public launch.

---

### `qa-flags-115` — Feature-flag QA click-through (P1, #115/#104)

**WHY.** #100 (SMS hidden), #105 (Campaigns hidden), #106 (Meeting Analytics gated on Entomate), #103 (Android signing config), various other gates — they all need a manual click-through against the **production** site to confirm they actually hide what they claim. This is the last gate before #104 (the truth-in-product umbrella) closes.

**WHAT.** Operator account (`fm1@`), production site (`pulse.logosvision.org`):

For each row, click the surface and record observed behavior:

| Surface | Expected | How to verify |
|---|---|---|
| **SMS** in main nav | Should NOT appear | Sidebar nav: no "SMS" entry. Visiting `/sms` URL should bounce to Dashboard. |
| **Email → Campaigns** tab | Should NOT appear inside the Email surface | Open Email → no "Campaigns" tab. If you can construct a URL that targets `currentView=campaigns`, it should reset to Inbox. |
| **Meetings → Analytics** | Honest empty/locked state (NOT fake metrics) when Entomate is NOT connected | Open Meetings → click Analytics (or open `AnalyticsModal`). Expected: locked card OR honest empty state. NOT: fake sentiment %, fake topic word-cloud. |
| **Map** | Should appear as "Experimental" (operator decided to keep) | Sidebar nav or Experimental section. |
| **Message Analytics** | Should be wired into nav | Per #104 audit decision: in Intelligence section. |
| **Email Compose / Invites / RSVPs** | Real send (not the dead `jehovahsneaky83` Resend account; uses fm1 key) | Send a real invite to `fm1+qatest@qntmecos.com`. Should arrive within 30s. |
| **Push notifications enable** | Settings has an always-visible Enable/Disable card (per #101) | Settings → Notifications. Toggle enable → grants permission + subscribes (verifies `push_subscriptions` table has a row). |

Write findings into `docs/FEATURE_FLAG_AUDIT_v1.md` under a new section: "## QA pass <YYYY-MM-DD>"

For each row: ✅ pass / ❌ fail (+ what was actually shown).

**VERIFY.**
- All rows ✅, OR each ❌ has a new launch-roadmap issue filed.

**NOTES.**
- If anything is ❌, do NOT mark this item done. File the regression issue, run `/launch-prep <newissue>` next.
- Push subscriptions row: agent can verify via Supabase MCP `select count(*) from public.push_subscriptions where user_id = '<fm1-uid>' and is_active = true` after the toggle.

---

### `v1-lane` — Pick the v1 positioning lane (P2, #119)

**WHY.** Landing page + app store listings + marketing copy all need a single sharp value proposition. "Everything app" is a 10-year bet against Slack + Microsoft — wrong for Pulse v1. Per the roadmap audit point 8: lead with cross-surface AI, pick a lane.

**WHAT.** Decision item via `AskUserQuestion`. Three lanes:

- **A — Cross-surface AI hub:** *"One AI brain over all your work conversations."* Leans into the actual moat (ai-router + cross-surface data model + Decisions/Tasks/Contacts unified). Differentiates against Slack/Teams (no AI moat), Front/Missive (single-channel), Notion (not real-time). Target: SMB teams with mixed comms (Slack + email + SMS + voice).
- **B — Customer-facing teams vertical:** *"Sales/CX teams: every customer conversation, one inbox, one AI."* Narrows to a vertical (sales/CX/CSM). Bigger willingness-to-pay; smaller TAM; clearer competitor (Front, Intercom).
- **C — Async-first comms:** *"The Slack you actually use because the AI catches you up."* Retention angle — leans on the Slack-stickiness finding. Targets remote-async teams.

**Agent flow:**
1. Read current landing copy: `src/components/LandingPage.tsx` (hero block, value-prop blocks).
2. Present options via `AskUserQuestion`.
3. Once picked, write `docs/PULSE_POSITIONING_GUIDE.md` with: the lane, the headline, the sub-head, the three value props, the proof points, the not-this list (anti-positioning).
4. **Do NOT modify landing copy in the same turn** — that's a separate execution step. Surface that as the follow-up.

**VERIFY.** Positioning guide written + lane chosen.

**NOTES.**
- Recommendation: A (cross-surface AI hub). Best alignment with the existing product moat per the audit.
- Once decided, optionally spawn `/launch-prep` against the landing-copy update (file as a new launch-roadmap issue, "Update landing copy + meta tags + ASO listings to v1 lane").

---

### `sms-10dlc` — A2P 10DLC + brand registration (PARKED, #109)

**WHY.** SMS is currently flag-OFF for v1 (#100, `inAppSms` flag false). Real wiring is deferred to #120 (depends on backend #99 + this). A2P 10DLC registration takes 2-4 weeks + ~$50 + brand vetting. Only start when you decide SMS is a v1 feature. **Don't do this preemptively** — the brand/campaign filings expire and the fees recur.

**WHAT** (only when triggered):
1. Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC
2. Register Brand → fill business info (Quantum Ecosystems LLC, EIN, address). $4 one-time + vetting fee.
3. Register Campaign → "Low Volume Mixed" use case is cheapest ($10 one-time + $1.50/mo). Provide sample message content.
4. Submit → wait for The Campaign Registry approval (2-4 weeks; first-time brand vetting longer)
5. Once approved: Twilio dashboard shows Campaign as "Approved"
6. Then implement real Twilio Programmable Messaging in `src/services/smsService.ts` (replace `isMockMode → true`), wire to the Render backend's Twilio proxy route, flip `inAppSms` flag to ON.

**VERIFY.** Brand + Campaign approved in Twilio. (Not now — only when you commit to SMS for v1.)

**NOTES.**
- Status: `parked`. Run `/launch-followups sms-10dlc` to unpark and walk through when ready.
- TCPA risk: $500-1,500 per non-consenting message + class-action exposure. Don't enable SMS without explicit one-to-one consent capture in the signup flow (see #109 for the consent UX requirements).

---

### `dsar-export-gap` — Extend `dataExportService` to cover contacts/calendar/email (PARKED, #111 follow-up)

**WHY.** The legacy `dataExportService` covers ~21 tables but returns empty arrays for contacts/calendar/email categories. Documented gap in `docs/DSAR_RUNBOOK.md` §8. Not launch-blocking — when the first GDPR DSAR comes in, you handle it manually via Supabase queries + then fix the service. Most v1 users won't request DSARs in the first month.

**WHAT** (when triggered): file a new launch-roadmap issue + run `/launch-prep <new#>`. Tables to add to the export:
- `public.contacts` (and any related `contact_*` tables — verify exact schema via Supabase Studio first)
- `public.calendar_events` (or whatever the calendar table is called — same verification)
- `public.gmail_messages` / `public.email_messages` (same)

**VERIFY.** Run a self-DSAR export → arrays populated for the three categories.

**NOTES.**
- Status: `parked`. Unpark only when (a) you receive a real DSAR, OR (b) you have a free Sunday and want to close the gap proactively.

---

## Checklist state

The agent updates this section every time an item changes state. Each row:
`key | status | priority | last-touched | one-line-note`

| key | status | priority | last-touched | note |
|---|---|---|---|---|
| `vercel-region` | pending | P0 | — | Settings → Compliance shows "Multi-region" until set |
| `vercel-posthog` | pending | P0 | — | Without this, #117 instrumentation is dormant in prod |
| `live-smoke-99` | pending | P0 | — | Slack + Gmail OAuth round-trip from production |
| `delete-test-111` | pending | P0 | — | Throwaway account → erasure → Supabase verify |
| `keystore-backup` | pending | P0 | — | Backup keystore + properties to 2 offsite locations |
| `play-signing` | pending | P0 | — | Enroll Play App Signing on first AAB upload |
| `calea` | pending | P1 | — | Lawyer consult + memo + runbook |
| `e2ee` | pending | P1 | — | Pick Option A/B/C, write positioning guide |
| `posthog-dashboards` | pending | P1 | — | Build the 4 PostHog insights (after `vercel-posthog`) |
| `qa-flags-115` | pending | P1 | — | Feature-flag QA click-through against production |
| `v1-lane` | pending | P2 | — | Pick A/B/C, write positioning guide |
| `sms-10dlc` | parked | P3 | — | Only when SMS unhides for v1 |
| `dsar-export-gap` | parked | P3 | — | Only when first DSAR arrives or capacity allows |

**Resume Pointer:** next unblocked item is `vercel-region`. Run `/launch-followups` to start there, or `/launch-followups <key>` to jump.

---

## Changelog

- **2026-05-27** — Command created. Initial checklist captures 13 items (6 × P0, 4 × P1, 1 × P2, 2 parked). All P0 items are real launch gates — bias toward clearing those before P1 decisions.
