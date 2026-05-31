# Pulse CALEA Determination — Voice/Video (#110)

**Status: DETERMINATION DRAFT — awaiting operator sign-off.** · **Created 2026-05-31** · Issue [#110](https://github.com/FatherSonOne/Pulse-1/issues/110) (`priority: medium`, `compliance`, `launch-roadmap`)

> ⚠️ **This is an engineering/architecture determination, NOT legal advice.** It records the facts and applies the FCC's published CALEA test to Pulse as currently architected, so the operator can make an informed call. Given the penalties for getting carrier-classification wrong, the recommendation is a **one-time confirmation by a telecom/comms lawyer** before launch — but the analysis below should make that read short and cheap, because the determinative fact is unambiguous.

---

## TL;DR determination

**CALEA does not attach to Pulse v1 as architected.** Neither Relay voice nor Daily.co video is **interconnected VoIP** under the FCC test, because the determinative prong — **interconnection with the public switched telephone network (PSTN)** — is absent. Pulse has no PSTN bridge, no phone numbers, no dial-in/dial-out, no SIP trunking. Its voice/video are app-to-app only. Therefore there is **no SSI report obligation and no lawful-intercept capability to build/buy/TTP for v1** (AC2 resolves to "not required").

A tripwire is recorded below: this determination flips **only if** Pulse adds PSTN-interconnected calling — the same architectural line that gates real SMS (#109).

---

## What CALEA is and what triggers it

The **Communications Assistance for Law Enforcement Act** (47 U.S.C. §1001 et seq.) requires **"telecommunications carriers"** to build lawful-intercept capability into their networks (and file System Security & Integrity / SSI reports). By FCC rule (the 2005/2006 orders), CALEA's reach was extended to **facilities-based broadband internet access** and **interconnected VoIP** providers — but **not** to "information services" or to VoIP that doesn't touch the PSTN.

The FCC's definition of **interconnected VoIP** (47 C.F.R. §9.3) requires **all four** of:
1. Enables real-time, two-way voice communications;
2. Requires a broadband connection from the user's location;
3. Requires IP-compatible customer premises equipment (CPE); **and**
4. **Permits users generally to receive calls that originate on the PSTN *and* to terminate calls to the PSTN.**

Prong **(4) is the gate.** A service that only connects users *within its own app* (no PSTN origination/termination) is **not** interconnected VoIP and is treated as an information service — outside CALEA. (This is the same line that separates, e.g., in-app voice chat from a Twilio-style calling product.)

---

## Pulse architecture facts (the determinative record)

Verified against the codebase 2026-05-31:

| Surface | What it actually is | PSTN interconnection? |
|---|---|---|
| **Relay voice** (Direct / Channel / Broadcast / Notes) | **Asynchronous** voice *messages* — recorded, stored (Supabase storage), transcribed. Not a real-time call path. App-to-app only. | **None.** No phone numbers, no dial-out. (grep: no `pstn`/`sip`/`dial-out`/`phone number`/`interconnect` in `src/services/relay/`.) |
| **Glimpse video** | Asynchronous video *messages* (record → send → watch). App-to-app only. | **None.** |
| **Live video meetings** | **Daily.co** WebRTC rooms (`daily-rooms` edge fn) — browser/app participants joining a room over WebRTC. | **None.** No Daily PSTN dial-in/dial-out configured (grep: no `pstn`/`sip`/`phone`/`dial-in` in `supabase/functions/daily-rooms/`). |
| **SMS** | 100% mocked (`smsService.isMockMode → true`), **hidden** for v1 behind the `inAppSms` flag (#100). | N/A — not shipped; would be A2P 10DLC text, not voice, and is separately gated by #109. |

**Conclusion on the facts:** Pulse offers app-to-app real-time video (Daily) and async voice/video messages (Relay/Glimpse). None originates from or terminates to the PSTN. There is no carrier-grade calling product in v1.

---

## Applying the test

- Relay/Glimpse async messages aren't even "real-time two-way voice communications" (prong 1 fails) — they're stored media, closer to email/voicemail in legal character.
- Daily live video may satisfy prongs 1–3 (real-time, broadband, IP CPE) but **fails prong 4** (no PSTN origination/termination). WebRTC app-to-app calling has consistently been treated as **non-interconnected VoIP** / an information service.
- With prong 4 failing, **no surface is interconnected VoIP**, so **no CALEA carrier obligation attaches.** (AC1: the legal read is **"no — not interconnected VoIP."**)

### Secondary angles considered (and why they don't change the answer)
- **"Substantial replacement for local exchange service"** (an older CALEA hook for some VoIP): Pulse is a productivity/comms *app*, not a phone-line replacement; users keep their carrier. Doesn't apply.
- **Information-services exemption:** the app-to-app, store-and-forward, and WebRTC traffic fall on the information-service side of the line CALEA draws — outside its scope.
- **Wiretap/SCA (separate from CALEA):** CALEA is about *capability to assist*; the Wiretap Act / Stored Communications Act still govern *responding to lawful process* for stored content. Those obligations exist for any service holding user content and are handled operationally via the abuse/DMCA + DSAR runbooks (#111/#112), independent of CALEA. Worth a one-line note to the lawyer but not a CALEA capability build.

---

## Options (AC2) — what, if anything, to build

Because the determination is **"CALEA does not attach,"** the issue's conditional ("if yes: SSI report plan + intercept capability build/buy/TTP") is **moot for v1.** For completeness, the menu *only if the determination ever flips*:

| Path | When it would apply |
|---|---|
| **Do nothing (record the determination)** ✅ *recommended for v1* | Current architecture — no PSTN interconnection. |
| **TTP (Trusted Third Party)** | If Pulse later adds PSTN calling: outsource intercept capability + SSI compliance to a CALEA-compliant carrier/vendor (e.g. the calling provider itself). Lowest-build path. |
| **Buy** | Use a calling vendor (Twilio/Telnyx/etc.) that is itself the CALEA-obligated carrier and assumes the capability — Pulse rides on their compliance. |
| **Build** | Only if Pulse became a facilities-based carrier — not on any roadmap. |

---

## Recommendation

1. **Record the determination: CALEA is N/A for Pulse v1** (no interconnected VoIP; no PSTN interconnection). This doc satisfies AC3 ("decision recorded in docs/ regardless of outcome").
2. **Get a one-time confirmation from a telecom/comms attorney** before launch — hand them this doc + the architecture table. The read should be short because prong 4 is dispositive; the cost of being wrong about carrier classification is what justifies the sign-off.
3. **Install a tripwire (the same line as #109):** revisit CALEA the moment Pulse adds **any PSTN-interconnected calling** — phone numbers, dial-in/dial-out, SIP trunking, or a Daily/Twilio PSTN bridge. At that point the determination flips and the **TTP/Buy** path (ride the carrier's compliance) becomes the cheap answer. Until then, no capability work.
4. **Keep the Wiretap/SCA process** (lawful-process response for stored content) in the abuse/DSAR runbooks — that's separate from CALEA and already partly covered (#112).

---

## Open question for the operator (the actual decision)

**Approve recording "CALEA N/A for v1" as the determination, and confirm whether you want the one-time lawyer sign-off before launch (recommended) or are comfortable shipping on this engineering determination alone?** Either way, the tripwire (revisit if PSTN calling is ever added) stands.

---

## Changelog
- **2026-05-31** — Created as the #110 determination draft. Finding: CALEA does not attach to v1 (no PSTN interconnection → not interconnected VoIP); no SSI/intercept build required; tripwire recorded for any future PSTN calling. Awaiting operator sign-off on whether a lawyer confirmation is wanted.
