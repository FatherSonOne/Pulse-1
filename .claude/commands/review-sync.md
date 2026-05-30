---
name: review-sync
description: Compile an outside-in product review's findings into the Pulse pre-launch roadmap — diff the review's Findings Ledger against open launch-roadmap issues, propose new issues for untracked findings + Status/Notes edits for tracked ones, then (on approval) file + update + commit.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - TodoWrite
---

<objective>
Turn a product-review pass into roadmap motion. A review (e.g. `docs/PULSE_REVIEW_AUDIT_<date>.md`) produces a **Findings Ledger** — rows of `R-NN | finding | evidence(file:line) | verdict | tracking issue`. This command reconciles that Ledger with the live launch state so no finding evaporates into prose: untracked findings become GitHub issues, tracked findings get their Status/Notes refreshed, and the roadmap Changelog records the pass.

It is the **third sibling** to `/launch-prep` (works code-actionable issues, one per run) and `/launch-followups` (works human-only items). `/review-sync` is the **intake funnel** that feeds both.

Usage:
- `/review-sync` — use the newest `docs/PULSE_REVIEW_AUDIT_*.md`.
- `/review-sync <path>` — use a specific review doc.
- `/review-sync dry` — print the reconciliation plan (new issues + edits) and STOP. File nothing.
</objective>

<process>

## Step 0 — Session safety (CLAUDE.md is law)
```bash
git branch --show-current
git status --short
```
- On `main`, clean tree → proceed. **Uncommitted work this session didn't author → STOP, surface it, ask** (pause-and-verify). Never branch, never run a destructive git op.

## Step 1 — Load context
Read, in order:
1. The review doc (arg path, or newest `docs/PULSE_REVIEW_AUDIT_*.md`) — especially its **Findings Ledger** and **Fix-Before-Launch Punch List**.
2. `docs/PULSE_PRELAUNCH_ROADMAP.md` — the **Status Table** + **Resume Pointer** + **Capability Matrix**.
3. `CLAUDE.md` (git discipline, coral budget, server-side Gemini, truth-in-product) and `MEMORY.md`.
4. `gh issue list --label launch-roadmap --state all --limit 80` — the live issue set (open AND closed, so you don't refile a closed finding).

## Step 2 — Reconcile the Ledger
For each `R-NN` row, classify:
- **Tracked + resolved (✅):** an existing issue already covers it and is closed/done → no new issue; just confirm the roadmap Status row is accurate.
- **Tracked + open (🟡):** an open issue covers it → **append the review's evidence** (file:line, the reviewer's framing) as an issue comment + refresh the roadmap Notes cell. Do NOT duplicate.
- **Untracked (🔴):** no issue covers it → **candidate new issue.**
- **Context-only (⚪):** honest-by-hiding or already-known; fold a one-line note into the nearest existing issue, no new issue.

**Verify before filing.** Re-read each 🔴 finding's evidence anchor in the actual source (grep/read the cited `file:line`) before creating an issue — a review can be stale. If the evidence no longer holds, downgrade to ⚪ and note why. Never file an issue on an unverified claim.

## Step 3 — Present the plan (always gate before filing)
Summarize, then confirm with the human (use `AskUserQuestion` if the call is non-trivial):
- **New issues to file:** for each — proposed title (`P{0,1,2}: …`), labels (`launch-roadmap` + `priority: {critical,high,medium}` + any `type:`/section label), Depends-on, and a 2-line body preview.
- **Existing issues to comment on / roadmap rows to edit.**
- **Findings intentionally NOT actioned** (⚪) + why.

If invoked as `dry`, STOP here.

## Step 4 — File + wire (on approval)
1. **New issues:** `gh issue create --label launch-roadmap --label "priority: <p>" --title "…" --body "…"`. Body MUST include: the finding, the evidence `file:line`, the acceptance criteria, and a back-link to the review doc. Capture the returned issue numbers.
2. **Existing issues:** `gh issue comment <#> --body "…"` with the review evidence + a link to the review doc.
3. **Roadmap doc** (`docs/PULSE_PRELAUNCH_ROADMAP.md`):
   - Add new issues as rows in the correct priority section of the **Status Table** (status `open`, Notes = one-line + review back-ref).
   - Refresh Notes cells for any tracked issue you commented on.
   - Add a dated **Changelog** line: "review-sync <date>: filed #NNN/#NNN from `PULSE_REVIEW_AUDIT_<date>.md` (R-xx, R-yy); commented #ZZ."
   - **Do not rewrite the Resume Pointer's "Next up"** unless a new issue is now the highest-priority unblocked item — if it is, update it and say why.
4. **Review doc:** fill the tracking-issue column for any row that was `NEW (#NNN)` with the real number once filed.

## Step 5 — Commit (orchestrator keeps commit authority)
- Commit with **explicit paths** (never bare `git commit`, never `git add -A` — parallel-session hazard, see memory `feedback_parallel_session_commit_a_sweep`):
  ```
  git add docs/PULSE_PRELAUNCH_ROADMAP.md docs/PULSE_REVIEW_AUDIT_<date>.md
  git commit -m "docs(roadmap): sync <date> review findings (#NNN, #NNN)" ...
  ```
- Conventional-commit form, HEREDOC body, trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- `git push origin main`.

## Step 6 — Report + stop
Print: issues filed (with numbers + URLs), issues commented, roadmap rows touched, findings deferred. Suggest the natural next move (`/launch-prep <#>` for the highest-priority new code issue, or `/launch-followups <key>` if it's human-only). STOP.

</process>

<guardrails>
- **Gate before filing.** Never create GitHub issues without showing the plan first (Step 3). `dry` mode files nothing.
- **No duplicates.** Always diff against open AND closed issues. A finding already owned by an issue gets a comment, not a new issue.
- **Verify evidence.** Re-read the cited `file:line` before filing — reviews go stale.
- **Respect the conventions.** Same labels, priority tiers, and `P{0,1,2}:` title prefix the roadmap already uses. New issues reference the review doc.
- **Truth-in-product is the through-line.** Findings about public copy / mocked surfaces advertised as real are first-class launch issues, not nitpicks.
- **Never branch / never destructive git / commit authority stays here.** Same hard-nevers as `/launch-prep`.
</guardrails>
