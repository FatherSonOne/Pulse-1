# Honest README — drop-in draft (closes the truth-in-product gap)

**Source:** [`PULSE_REVIEW_AUDIT_2026-05-29.md`](./PULSE_REVIEW_AUDIT_2026-05-29.md) · **Issue:** #124 · **Status:** ✅ APPLIED to `README.md` 2026-05-29 (apply-time correction: TypeScript badge/stack is **5.8**, not 5.6 — `package.json` ships `typescript@~5.8.2`; the old README's 5.6 was also stale). The README half of #124 is done; landing-FAQ + SMS-pricing copy remain open under #124.

> **Artifact (c)** of the 2026-05-29 review. This is a ready-to-swap replacement for `README.md` that removes every claim contradicted by `package.json`, the corrected Privacy Policy (#112), or an OFF feature flag. Nothing real is removed — the genuinely-shipped surface is described accurately. **Apply step:** once approved, copy the "## Proposed README" section below over `README.md` verbatim, then close #124.

## What changed vs the current README (and why)

| Current claim | Problem | Honest replacement |
|---|---|---|
| `React 19.0` badge + stack | Ships `react@^18.2.0` | `React 18.2` |
| `version-27.0.0` badge | `package.json` is `25.1.3` | `25.1.3` (or read from package.json) |
| "Message Encryption (End-to-end)" / "End-to-end encryption for sensitive messages" | No E2EE; #113 open; server-side AI needs plaintext | "Encrypted in transit (TLS) and at rest. AI processes content server-side for opted-in features." |
| "Voxer Voice Features (Phase 1 Complete)" | Renamed to **Relay**; Voxer is dead branding | "Relay — voice-first messaging" |
| Tagline "SMS, email, Slack… single intelligent inbox" | SMS is mocked + hidden (`inAppSms` OFF, #100) | Drop SMS from the headline; list it under "Planned" |
| "CRM… Bi-directional Sync: Automatic" ✅ | OAuth broken server-side (#99/#108) | "CRM API integration (server-side OAuth refactor in progress)" |
| "Push notifications" as Phase 4 TODO | Real push shipped in #101 | Move to shipped features |
| Perf metrics (66% bundle cut, Lighthouse 90+, <200ms p95) | Unverified / aspirational | Remove hard numbers or mark "targets" |
| Contact `jehovahsneaky83@gmail.com` | Abandoned account (roadmap #102); canonical is `fm1@qntmecos.com` | `fm1@qntmecos.com` |
| "Secure token storage in localStorage (encrypted)" | Overclaim | "Tokens stored client-side; sensitive secrets server-side only" |

---

## Proposed README

```markdown
# Pulse — AI command surface for work conversations

[![Version](https://img.shields.io/badge/version-25.1.3-blue.svg)](https://github.com/FatherSonOne/Pulse-1)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
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
- **Email.** Gmail sync, templates, scheduling, snooze, and inline AI summary/extraction cards.
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
  tracked in #109 / #120; the in-app surface is hidden until then.
- **CRM bi-directional sync** — API integration exists; server-side OAuth refactor + pagination are
  in progress (#99 / #108).
- **Email campaigns** — disabled for v1 pending a compliant batched-send path (#105).
- **Encryption posture** — data is encrypted in transit (TLS) and at rest. Pulse does **not** offer
  end-to-end encryption: AI features process content server-side. (Positioning tracked in #113.)

---

## Tech stack

- **Frontend:** React 18.2, TypeScript 5.6, Vite, TailwindCSS, Framer Motion
- **Backend:** Supabase (Postgres + RLS + Edge Functions); an Express integration backend on Render
- **AI:** Google Gemini + Anthropic Claude (+ OpenAI), all server-side via the `ai-router` edge function
- **Integrations:** Slack, Google (OAuth + Gmail + Calendar), Daily.co (video), Stripe (billing),
  HubSpot / Salesforce / Pipedrive / Zoho (CRM)
- **Clients:** Web, Electron desktop, Capacitor 8 (Android)
- **Testing:** Vitest, Playwright, React Testing Library

---

## Quick start

\`\`\`bash
git clone https://github.com/FatherSonOne/Pulse-1.git
cd Pulse-1
npm install
cp .env.example .env   # add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc.
npm run dev            # http://localhost:5173
\`\`\`

See [docs/](docs/) for CRM setup, deployment, and the pre-launch roadmap.

---

## Security

- Encrypted in transit (TLS) and at rest (Supabase storage encryption)
- Row Level Security (RLS) on all tables
- OAuth 2.0 for integrations; MFA (TOTP) + biometric (WebAuthn) auth
- Server-side AI: content is sent to AI providers for opted-in features; no client-side AI keys;
  not used for model training. (Pulse does not offer end-to-end encryption — see "Planned" above.)

---

## License

MIT — see [LICENSE](LICENSE).

## Contact

- Issues: https://github.com/FatherSonOne/Pulse-1/issues
- Email: fm1@qntmecos.com
```

---

## Changelog
- **2026-05-29** — Drafted from the review's R-01 finding. Awaiting approval before overwriting `README.md` (the apply step closes #124). Verify the TypeScript and Supabase badge versions against `package.json` at apply time.
