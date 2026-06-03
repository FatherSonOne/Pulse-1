# Google OAuth / Cloud Console Runbook (Pulse)

GCP project: **Pulse** (project number `35770199098`). Last reviewed 2026-06-03.

There are **two distinct OAuth clients** — do not conflate them (see also the
`project_pulse_google_token_refresh` memory):

| Client | ID | Used by |
|---|---|---|
| **Pulse Web Client** (LOGIN) | `35770199098-…6c9gvr…` | Supabase Google provider (interactive login) + backend `GOOGLE_LOGIN_CLIENT_*` refresh |
| **logos-vision integration** | `234234056284-…` | server.js `GOOGLE_CLIENT_*`, server-side Contacts sync only |

---

## 1. Publishing status vs verification — two independent levers

| Lever | Values | Controls |
|---|---|---|
| Publishing status | Testing ↔ In production | The **7-day refresh-token expiry** (Testing only) |
| Verification | Unverified ↔ Verified | The **"unverified app" warning** + **100-user cap** |

The 7-day refresh-token expiry applies **only in Testing**. Moving to **In
production removes it even while unverified.**

### Publish to Production (kills the 7-day expiry — do this first)
1. console.cloud.google.com → project **`35770199098`**
2. **APIs & Services → OAuth consent screen** (newer UI: **Google Auth Platform → Audience**)
3. **Publishing status: Testing → "PUBLISH APP" → confirm "Push to production"**
4. Defer the "prepare for verification" prompt — the status change itself takes effect.

Trade-off while unverified-in-production: new sign-ins see the "Google hasn't
verified this app" screen (**Advanced → Go to … (unsafe)**), capped at ~100 users.

---

## 2. Scopes & the Gmail-restricted-scope decision

App-requested scopes ([src/services/authService.ts](../src/services/authService.ts) `GOOGLE_SCOPES`):

| Scope | Google category | Declared on consent screen (2026-06-03)? |
|---|---|---|
| `email`, `profile`, `openid` | Non-sensitive | ✅ |
| `drive.file` | Non-sensitive (per-file) | ✅ |
| `calendar.readonly`, `calendar.events` | Sensitive | ✅ |
| `contacts.readonly` | Sensitive | ✅ |
| `gmail.send` | Sensitive | ❌ not declared |
| `gmail.readonly`, `gmail.compose`, `gmail.modify` | **Restricted** | ❌ not declared |

**Mismatch:** the app requests 4 Gmail scopes (3 restricted) but the consent
screen declares **none** of them. Works today only because Testing mode is
lenient (Gmail API shows ~683 req/day). In production this must be reconciled:

- **Keep Gmail features →** add the 4 Gmail scopes to the consent screen's
  Data Access list. The 3 restricted ones then require a **CASA security
  assessment** for full verification (annual, third-party, has a cost).
- **Drop Gmail →** remove the Gmail scopes from `GOOGLE_SCOPES`. No restricted
  scopes ⇒ verification needs no CASA (much cheaper/faster). Loses the email
  feature. Product decision — not done here.

Also note the consent screen currently declares a **full `contacts`** scope
("see, edit, **delete** your contacts") in addition to `contacts.readonly`; the
app only uses `contacts.readonly`. Drop the broader one to minimise verification
scope.

---

## 3. Full verification (later, before public launch)
Removes the warning + 100-user cap. Requires: verified domain ownership
(`logosvision.org` in Search Console), privacy-policy + home-page URLs on that
domain, a demo video showing each sensitive/restricted scope in use, per-scope
justification, and — because of the restricted Gmail scopes — a **CASA Tier-2
assessment**.

---

## 4. Enabled-API audit (2026-06-03)

Verified **in use** by the codebase — KEEP:

| API | Where |
|---|---|
| Gmail API | server.js + gmailService (683 req) |
| Google Calendar API | googleCalendarService `calendar/v3` (115 req) |
| People API | googleContactsService `people.googleapis.com/v1` |
| Google Drive API | googleDriveService (`drive.file` archive) |
| Geocoding API | edge fn `maps-geocode` |
| Directions API | edge fn `maps-directions` |
| Distance Matrix API | edge fn `maps-distance` |
| Maps JavaScript API | browser map components (`@react-google-maps/api`) |
| Places API | Maps JS `places` library (`mapService.GOOGLE_MAPS_LIBRARIES`) |
| Generative Language API (Gemini) | gemini-* edge fns + ai-router |

Verify before relying on / disabling: **Time Zone API** (the "timezone" refs may
be JS `Intl`, not the Google API), **Routes API** (code uses legacy
`/maps/api/directions`, so Routes is only needed if migrating).

Zero usage + no code reference — **safe to disable** (optional; unused enabled
APIs are free):
- **Deprecated:** Google+ API, Contacts API (superseded by People API).
- **Unused Maps family:** Aerial View, Air Quality, Pollen, Solar, Weather,
  Roads, Street View Static/Publish, Navigation SDK, Maps 3D SDK (Android/iOS),
  Maps SDK (Android/iOS), Maps Elevation, Maps Embed, Maps Static, Map Tiles,
  Maps Grounding Lite, Maps Platform Datasets, Route Optimization, Places
  Aggregate, Places UI Kit, Geolocation, App Optimize, Telemetry.

Leave the **Cloud * infra** APIs (Cloud Monitoring, Cloud Resource Manager,
Gemini Cloud Assist) alone — harmless and sometimes required by tooling.

---

## 5. Credentials checklist
- **OAuth redirect URIs** must include the Supabase callback
  `https://ucaeuszgoihoyrvhewxk.supabase.co/auth/v1/callback` (present ✅) plus
  the app origins (`pulse.logosvision.org`, `localhost:5173`).
- **Secret rotation:** if the **login** client (`35770…`) secret is rotated, the
  new value MUST be updated in BOTH (a) Supabase → Auth → Providers → Google →
  Client Secret, and (b) the backend `GOOGLE_LOGIN_CLIENT_SECRET` (`.env.local`
  + Render). Rotating without updating Supabase breaks login. Google's
  add-then-disable flow lets both old+new work briefly — update consumers
  before disabling the old secret.
- API keys: `GOOGLE_MAPS_SERVER_KEY` (geocode/directions/distance — server),
  `Maps Platform API Key` (browser Maps JS, HTTP-referrer restricted),
  `pulse 1.2` (Gemini). Keys should stay API- and referrer/IP-restricted.
