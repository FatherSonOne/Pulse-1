# Pulse Encryption & E2EE Positioning — Decision Guide

**Issue:** [#113](https://github.com/FatherSonOne/Pulse-1/issues/113) (P1, `priority: medium`, compliance) ·
**Created:** 2026-05-30 · **Status:** ✅ **DECIDED 2026-05-30 — Option B** (operator approved) ·
**Unblocks:** [#124](https://github.com/FatherSonOne/Pulse-1/issues/124) (public-copy truth-in-product — the final crypto wording is now settled; see "Required copy fixes")

> **DECISION (2026-05-30):** Pulse adopts **Option B — the honest "encrypted in transit + at rest, server-side AI on the content you turn on, no end-to-end encryption" posture** for v1. It's the only option consistent with Pulse's core differentiator (cross-surface AI over one data model) and with every legal/marketing doc already written. Full E2EE (Option A) would forfeit the entire AI moat; the hybrid (Option C) is logged as a post-launch roadmap candidate but is **not** marketed until it ships. **Use the [Canonical approved wording](#canonical-approved-wording-use-verbatim-everywhere) verbatim.**

---

## Why this is a decision, not a bug

Users have a default expectation — fed by Signal/WhatsApp/iMessage — that a messaging app is end-to-end encrypted (E2EE): only the sender and recipient can read content; the operator mathematically cannot. **Pulse cannot offer that today without killing its reason to exist.** Pulse's headline value is *cross-surface AI over one data model* — thread summaries, smart compose, decision extraction, RAG, autopilot. Every one of those features requires the server to read **plaintext** message/email/transcript/contact content at inference time (verified: all AI calls broker through the server-side `ai-router`; no client AI keys — Privacy Policy §5, `README.md:43`). E2EE and server-side AI-on-content are **mutually exclusive** for the same data. So the question isn't "can we add encryption" — it's "**what do we honestly claim**," and the launch risk is *truth-in-product*: shipping a UI/README/FAQ that promises E2EE the architecture can't back.

---

## Ground truth (verified in-repo, 2026-05-30)

| Claim | Reality | Evidence |
|---|---|---|
| **In transit** | ✅ TLS/SSL on all client↔Supabase / client↔backend / server↔AI-provider traffic | HTTPS everywhere; Privacy Policy §7 (`PrivacyPolicy.tsx:242`) |
| **At rest** | ✅ AES-256 (Supabase-managed storage + Postgres encryption) | Privacy Policy §7 (`PrivacyPolicy.tsx:243`); `README.md:120` |
| **Tenant isolation** | ✅ Row Level Security on all tables | `README.md:121` |
| **End-to-end encryption (messages)** | 🔴 **None in practice.** Messages are stored as plaintext rows (RLS-protected, AES-256-at-rest) and read in plaintext server-side. | see "the orphaned crypto" below |
| **Server-side AI reads content** | ✅ By design. message text, email bodies, meeting transcripts, contact data → `ai-router` → Gemini / Claude / OpenAI, transiently, not used for training | Privacy Policy §5 (`PrivacyPolicy.tsx:216`); `ai-router` (memory `project_pulse_gemini_serverside`) |
| **Operator/support can read content** | ⚠️ **Technically yes.** Service-role access + server-side AI means there is **no cryptographic barrier** stopping a Pulse/Supabase operator from reading content. Protection is **policy + access controls**, not math. | direct consequence of the rows above |

### The orphaned crypto (important — informs the "no E2EE" verdict)

`src/services/encryption.ts` *does* exist and imports `libsodium-wrappers` with a real `crypto_box`
public-key API (`generateKeyPair` / `encryptMessage` / `decryptMessage`). **It is dead code:**

- **Zero callers.** A repo-wide search for `encryptionService` / `encryptMessage` / `generateKeyPair` / `crypto_box` outside the file itself returns nothing — it is never wired into the message send/receive path (`pulseService.sendMessage` stores plaintext).
- **Buggy even if wired.** Line 63 derives the "sender public key" by string-slicing the *secret* key (`senderSecretKey.substring(0, 44)`) — cryptographically nonsensical; there is no key-distribution, key-storage, or recipient-key-lookup layer anywhere.

**Conclusion:** Pulse has **no functioning E2EE**, only a scaffold someone started and abandoned. Its mere presence is itself a small truth-in-product hazard (a future dev or auditor could mistake it for a real feature). → *cleanup recommendation under #104/#124, see below; not touched by this decision run.*

---

## The options

### Option A — Become actually end-to-end encrypted

Wire real E2EE (finish/replace `encryption.ts`: key generation, secure key storage, recipient key exchange, per-conversation keys, multi-device, key rotation, backup/recovery).

- ✅ Strongest possible privacy claim; matches the strict consumer-messaging default.
- 🔴 **Forfeits the entire cross-surface AI moat** — summaries, compose, decision extraction, RAG, autopilot all need plaintext server-side. You'd be shipping "another encrypted chat app" *without* the thing that differentiates Pulse.
- 🔴 Months of hard, high-risk crypto work (key management is where E2EE projects die); multi-device + recovery alone are large. Not a v1 item.
- 🔴 Breaks server-side search indexing, transcription pipelines, and most of the productivity core.
- **Verdict:** wrong product. E2EE-for-everything contradicts an AI-native hub.

### Option B — Honest "encrypted in transit + at rest; server-side AI on opted-in content; no E2EE"  ⭐ recommended

State plainly what's true: TLS in transit, AES-256 at rest, RLS isolation, OAuth/MFA/WebAuthn; AI features process content server-side for the features you turn on; **Pulse does not offer end-to-end encryption.**

- ✅ **Already the de-facto standard** across the codebase: `README.md:43-45` & `:120-124`, `PULSE_MARKETING_COPY_GUIDE.md:45`, and `PULSE_README_HONEST_DRAFT_HANDOFF_2026-05-29.md:13` all use exactly this wording as a placeholder *pending this decision*. Choosing B simply ratifies it.
- ✅ Consistent with the Privacy Policy as corrected in #112 (false "anonymized" AI claim already removed).
- ✅ Preserves the AI moat; zero engineering cost; ships today.
- ⚠️ Must also fix the **operator-access overclaim** (see "Required copy fixes" — the landing FAQ currently says "support staff cannot read your message content," which Option B's honesty does not support as a hard guarantee).
- **Verdict:** truthful, shippable, protects the product thesis. **Recommended for v1.**

### Option C — Hybrid: server-side AI by default, opt-in E2EE "private" conversations

Default conversations stay AI-enabled (Option B); offer a separate **E2EE mode** for sensitive 1:1/threads where AI features are explicitly disabled for that conversation.

- ✅ Best-of-both *eventually*; a genuine differentiator ("AI everywhere, except where you lock it down").
- 🔴 All of Option A's key-management complexity, just scoped smaller — still not a v1-sized build, and the orphaned `encryption.ts` is nowhere near it.
- 🟡 Good **roadmap** item; the honest v1 claim while it's unbuilt is still Option B.
- **Verdict:** adopt the **language of B now**, file C as a post-launch enhancement if user demand appears. Don't market C until it ships.

---

## Recommendation

**Choose Option B for v1; log Option C as a post-launch roadmap candidate.** B is the only option that (a) tells the truth, (b) keeps Pulse's AI-native differentiation intact, and (c) costs nothing to ship. It also requires no new decision from anyone downstream — the README and marketing guide already wrote B as the placeholder. The single remaining honesty gap B forces us to close is the operator-access overclaim in the landing FAQ.

### Canonical approved wording (use verbatim everywhere)

> **Short form (badges, hero, one-liners):**
> "Encrypted in transit (TLS) and at rest. AI processes content server-side for the features you turn on."

> **FAQ / Privacy long form:**
> "Pulse encrypts your data in transit (TLS) and at rest (AES-256), and isolates every workspace with row-level security. Pulse does **not** offer end-to-end encryption: to power AI features like summaries, smart compose, and decision extraction, your content is processed server-side at the time of your request. We treat your content as confidential and restrict internal access through access controls and policy — but, unlike an end-to-end-encrypted messenger, there is no cryptographic barrier that makes content unreadable to us. We never use your content to train AI models."

**Hard rule:** no surface (README, landing, FAQ, pricing, in-app, docs) may use the words "end-to-end encryption," "E2EE," or imply that Pulse/operators *cannot* read content, until/unless Option C ships.

---

## Acceptance criteria mapping (#113)

- [x] **Documented decision: what is encrypted, what is processed server-side, why** → this doc (Ground Truth + Options + Recommendation).
- [x] **Privacy copy is honest about server-side AI access to content + metadata** → Privacy Policy §5 already reconciled in #112; §7 states TLS + AES-256 (truthful). No false E2EE claim in the Privacy Policy.
- [x] **No marketing implies E2EE where it does not exist** → README already honest (`:43`, `:120`, references #113 as the pending pointer). **One residual contradiction to fix under #124** (below).

## Required copy fixes (hand off to #124 — public-copy truth-in-product)

These are the concrete edits the Option-B decision unblocks. They belong to **#124**, not this decision run:

1. **`src/components/LandingPage/landingData.ts:48`** — current: *"Support staff cannot read your message content — only metadata, with your explicit written consent."* This **overclaims** (no E2EE → no technical barrier; "cannot read" is not true at the architecture level). Replace with the FAQ long-form wording above (confidential + access-controlled, *not* cryptographically unreadable).
2. **`landingData.ts:10,43`** — drop ElevenLabs/AssemblyAI/Whisper from the AI-vendor copy (reconcile to Gemini + Claude + OpenAI, per Privacy §5 / #112). *(Already on #124's list.)*
3. **README** — already honest; just remove the "pending #113" hedge and state Option B as settled once the human confirms.

## Suggested follow-up (truth-in-product cleanup, not this run)

- **Delete or quarantine `src/services/encryption.ts`** (orphaned, buggy `crypto_box` scaffold). Leaving dead E2EE code in the tree invites a future "but we have encryption.ts" misread. If kept as a seed for Option C, add a header comment: *"EXPERIMENTAL / UNWIRED — Pulse does not currently offer E2EE; see PULSE_E2EE_POSITIONING_GUIDE.md."* File under #104 (truth-in-product umbrella) or fold into #124.

---

## Changelog

- **2026-05-30** — Doc created (`/launch-prep #113`). Ground-truth verified in-repo: no functioning E2EE (orphaned + buggy `encryption.ts`, 0 callers); TLS-in-transit + AES-256-at-rest + RLS are real; server-side AI reads plaintext by design. Three options laid out; **Option B recommended** (ratifies the placeholder already used in README + marketing guide + README-handoff). Surfaced the landing-FAQ operator-access overclaim (`landingData.ts:48`) as the residual contradiction for #124.
- **2026-05-30** — **DECIDED: Option B** (operator approved via `/launch-prep`). Canonical wording locked; #124 now unblocked for the public-copy fixes (FAQ operator-access overclaim + AI-vendor reconcile + README hedge removal). #113 closed.
</content>
</invoke>
