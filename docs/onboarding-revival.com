/impeccable critique

# AUDIT TARGET
The Pulse "post-Stripe, first-time setup" onboarding flow — everything a workspace
owner sees from the moment they finish Stripe Checkout to the moment they're
fully productive in the app. Today this is shaped like a two-stage funnel:

  1) Blocking modal: src/components/settings/OrgOnboardingModal.tsx
     - Shown when workspace.onboarding_step === 'pending'
     - Owner-only; collects ONLY the org name
     - Transitions onboarding_step → 'named'
  2) Dismissible dashboard checklist: src/components/settings/OrgSetupChecklist.tsx
     - Shown when onboarding_step === 'named' (status bar above the Dashboard)
     - 4 items: logo, invite team, auto-join domain, billing contact
     - Each item deep-links into the relevant Settings section
     - "Dismiss" flips state to 'complete'

Plus the surrounding context the user lands in:
  - Sidebar (src/components/Sidebar/Sidebar.tsx) — workspace switcher, billing
    alert banner, nav sections (Overview / Communication / Work & People /
    Intelligence / Experimental)
  - Dashboard.tsx — what the user actually sees behind the checklist
  - BillingSettings (src/components/settings/BillingSettings.tsx) — where
    "Add billing contact" deep-links to
  - WorkspaceSettings (src/components/settings/WorkspaceSettings.tsx) — where
    logo / auto-join deep-link to

Workspace creation entry point: src/services/workspaceService.ts → createWorkspace

# CRITIQUE WITH RUTHLESS HONESTY

Score the flow 0–10 across these dimensions and justify each score with concrete
file:line evidence — no generic platitudes. Be skeptical, not encouraging.

  1. Time-to-first-value
     - How many clicks/seconds from "Stripe payment confirmed" to "user does
       something productive"? Is anything load-bearing left out of band (e.g.
       no welcome screen explaining what Pulse IS, no contextual nudge into
       Relay/Messages, no sample data)?
     - Compare to the bar set by Linear, Notion, Slack, Vercel — what's missing
       that a 2026 SaaS user expects?

  2. Cognitive load & sequencing
     - Is the 4-item checklist the right 4 items, or are we asking for chores
       (logo, auto-join, billing contact) before letting the user feel the
       product?
     - Is "Add billing contact" really a setup task, or noise? They just paid.
     - What's the right ordering — does the current order reflect what unlocks
       most value first, or is it alphabetical-by-icon-design?

  3. Empty-state & first-impression UX
     - Behind the checklist, the Dashboard is largely empty. What's the
       experience there? Are widgets degrading gracefully or showing
       "no data yet" everywhere?
     - Does the user understand what Relay, Glimpse, War Room, Studio RAG
       actually DO before being told to invite a team?

  4. Personalization & social proof
     - Is anything tailored to the org name they just entered? Plan tier?
       Industry signals? Or is everyone seeing the same 4 generic boxes?
     - Is there ANY moment of "delight" — a confetti, a personalized headline,
       a Loom from the founder, a "while you're here" suggestion?

  5. Friction in each checklist task
     - Walk through "Add logo" — how many clicks, does the uploader auto-crop
       to square, does it surface immediately in the sidebar?
     - "Invite your team" — does it support paste-a-list-of-emails, copy-link,
       Google Workspace contact picker, or only one-at-a-time?
     - "Auto-join domain" — is the UX intelligible to a non-IT user, or does
       it assume they know what an email domain is in this context?
     - "Add billing contact" — what's the user's mental model here? Is this
       different from the email they already gave Stripe? If yes, is that
       difference explained?

  6. Edge cases this flow ignores
     - What if the owner closes the modal tab and comes back later?
     - What if Stripe checkout succeeded but the webhook hadn't synced when
       they returned to Pulse — do they see a confusing "trial expired"
       screen for a moment? (yes; we hit this today)
     - What if the user is invited TO a workspace (not creating one)? Do they
       see this checklist? Should they?
     - What if onboarding_step somehow goes null or stays 'pending' forever?
     - Multi-workspace user creating their second org — is the experience the
       same or contextual?

  7. Visual / interaction design
     - Honestly assess the checklist UI in the screenshot. Color hierarchy,
       icon style consistency, the "0 of 4 complete" progress affordance,
       hover states, the dismiss "X" placement. Critique like Pentagram would.
     - Does it match Pulse's established --pulse-* design tokens (see
       src/styles/pulse-tokens.css) or is it visually orphaned?

  8. Activation telemetry
     - What's instrumented? Can you tell from the codebase whether anyone is
       measuring drop-off between modal → checklist → first relay message →
       second-day return? If not, that itself is a finding.

# DELIVERABLE FORMAT

For each dimension:
  - Score (0–10) and a one-line verdict
  - 2–4 concrete file:line citations supporting the score
  - The single highest-leverage change to move that score up

Then end with:
  - **The 3 fixes you'd ship this week** (prioritized, with effort estimate)
  - **The 3 things to delete or kill** (chores masquerading as activation)
  - **The 1 ambitious bet** — what would Pulse's onboarding look like if it
    were Linear-tier polished? Describe it in 5 lines.

No emoji. No hedging. No "great job overall" framing. Treat this as a pre-launch
investor walkthrough — assume the reader is comparing Pulse to Slack circa 2014
and Linear circa 2024 and finds today's flow lacking.