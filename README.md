# Pulse — AI command surface for work conversations

[![Version](https://img.shields.io/badge/version-25.1.3-blue.svg)](https://github.com/FatherSonOne/Pulse-1)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.87-3ecf8e.svg)](https://supabase.com/)

> One screen for every work conversation — chat, email, voice, video, calendar, contacts, and
> decisions — with a cross-surface AI that summarizes, drafts, and triages, and labels every word
> it writes so you always know what is yours.

[Documentation](docs/) • [Report Bug](https://github.com/FatherSonOne/Pulse-1/issues)

---

## What Pulse does today (shipped + real)

- **Cross-surface AI.** Summaries, smart replies, task/meeting extraction, and daily briefings over
  one data model — routed server-side through a metered AI router (Gemini + Claude). No client-side
  AI keys. Every AI artifact carries a provenance chip (`CLAUDE · SUMMARY`, `GEMINI · DRAFT`).
- **Messages.** Real-time Pulse-to-Pulse chat with triage, focus mode, and AI plugins.
- **Email (opt-in connector).** Connect Gmail to sync mail with templates, scheduling, snooze, and inline AI summary/extraction cards. Off by default (enable in Settings, then connect a Gmail grant).
- **Relay (voice).** Async push-to-talk threads, 1:1 voice, broadcasts, and notes, with transcription.
- **Glimpse (video).** Async video messages with AI transcripts.
- **Calendar & Meetings.** Scheduling, recurrence, public booking pages, and Daily.co video rooms
  with post-meeting AI summaries.
- **Contacts.** A relationship CRM — health scoring, Google import, saved filters.
- **Decisions & Tasks.** Capture a decision or task from any thread and track it to completion.
- **Map.** Contacts and teams as a spatial layer with live presence and ETA sharing.
- **Push notifications**, **Stripe billing**, **MFA / biometric auth**, and unified **Search**.

## Planned / not yet enabled (honest status)

- **In-app SMS** — currently disabled (`inAppSms` flag OFF). Real Twilio + A2P 10DLC compliance is
  tracked in [#109](https://github.com/FatherSonOne/Pulse-1/issues/109) /
  [#120](https://github.com/FatherSonOne/Pulse-1/issues/120); the in-app surface is hidden until then.
- **CRM bi-directional sync** — API integration exists; server-side OAuth refactor + pagination are
  in progress ([#99](https://github.com/FatherSonOne/Pulse-1/issues/99) /
  [#108](https://github.com/FatherSonOne/Pulse-1/issues/108)).
- **Email campaigns** — disabled for v1 pending a compliant batched-send path
  ([#105](https://github.com/FatherSonOne/Pulse-1/issues/105)).
- **Encryption posture** — data is encrypted in transit (TLS) and at rest, with row-level security
  per workspace. Pulse does **not** offer end-to-end encryption: AI features process content
  server-side for the features you turn on. (Decided posture — see
  [`docs/PULSE_E2EE_POSITIONING_GUIDE.md`](docs/PULSE_E2EE_POSITIONING_GUIDE.md).)

---

## Tech stack

- **Frontend:** React 18.2, TypeScript 5.8, Vite, TailwindCSS, Framer Motion
- **Backend:** Supabase (Postgres + RLS + Edge Functions); an Express integration backend on Render
- **AI:** Google Gemini + Anthropic Claude (+ OpenAI), all server-side via the `ai-router` edge function
- **Integrations:** Slack, Google (OAuth + Gmail + Calendar), Daily.co (video), Stripe (billing),
  HubSpot / Salesforce / Pipedrive / Zoho (CRM)
- **Clients:** Web, Electron desktop, Capacitor 8 (Android)
- **Testing:** Vitest, Playwright, React Testing Library

---

## Quick start

```bash
git clone https://github.com/FatherSonOne/Pulse-1.git
cd Pulse-1
npm install
cp .env.example .env   # add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc.
npm run dev            # http://localhost:5173
```

### Environment

Minimum to boot:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

See [docs/](docs/) for CRM setup, deployment, and the pre-launch roadmap.

---

## Scripts

```bash
npm run dev            # dev server (http://localhost:5173)
npm run build          # production build
npm test               # unit & integration tests (Vitest)
npm run test:e2e       # end-to-end tests (Playwright)
npm run android:sync   # sync web build into the Android (Capacitor) project
npm run android:bundle # produce a signed release AAB
```

---

## Project structure

```
pulse1/
├── src/
│   ├── components/          # React components (one folder per surface)
│   ├── services/            # business logic (AI, CRM, email, voice, maps, …)
│   ├── lib/                 # feature flags, monitoring, shared utilities
│   ├── styles/              # canonical design tokens (pulse-tokens.css)
│   └── types/               # TypeScript definitions
├── supabase/
│   ├── functions/           # Edge Functions (ai-router, billing-*, send-push, …)
│   └── migrations/          # database migrations
├── docs/                    # documentation + pre-launch roadmap
├── e2e/                     # Playwright end-to-end tests
└── android/                 # Android app (Capacitor)
```

---

## Security

- Encrypted in transit (TLS) and at rest (Supabase storage encryption)
- Row Level Security (RLS) on all tables
- OAuth 2.0 for integrations; MFA (TOTP) + biometric (WebAuthn) auth
- Server-side AI: content is sent to AI providers for opted-in features; no client-side AI keys;
  not used for model training. (Pulse does not offer end-to-end encryption — see "Planned" above.)

---

## Contributing

Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`). See
[CONTRIBUTING.md](CONTRIBUTING.md) if present.

## License

MIT — see [LICENSE](LICENSE).

## Contact

- Issues: https://github.com/FatherSonOne/Pulse-1/issues
- Email: fm1@qntmecos.com
