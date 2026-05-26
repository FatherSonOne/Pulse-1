---
name: launch-prep
description: Spawn a roadmap-aware agent that works the next Pulse pre-launch issue (one at a time), then updates the living roadmap so the next run resumes in place
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Agent
  - TodoWrite
---

<objective>
Drive Pulse toward launch by working the pre-launch roadmap **one GitHub issue per invocation**. Each run: load full roadmap context, pick the next unblocked issue, spawn a context-aware agent to implement it, commit, update the issue, and update the living roadmap doc's Status Table + Resume Pointer so the *next* invocation knows exactly where to continue.

The living document is `docs/PULSE_PRELAUNCH_ROADMAP.md`. The tracking label is `launch-roadmap`. The epic is #98.

Usage:
- `/launch-prep` — auto-pick the next highest-priority unblocked open issue.
- `/launch-prep 102` — work a specific issue number.
- `/launch-prep status` — just print the current Status Table + Resume Pointer and stop (no work).
</objective>

<process>

## Step 0 — Session safety (CLAUDE.md is law)

```bash
git branch --show-current
git status --short
```
- If on `main` with a clean tree: proceed.
- **If there is uncommitted work this session did not author** (staged/unstaged/untracked): STOP. Report the paths + a one-line characterization of each and ask the human whether to commit first. Do NOT work around it, do NOT branch, do NOT `git checkout`/`reset`/`clean`/`stash`. (See the "pause-and-verify" + "hard nevers" sections of `CLAUDE.md`.)
- Never create a branch. Pulse works directly on `main`.

## Step 1 — Load roadmap context

Read, in order:
1. `docs/PULSE_PRELAUNCH_ROADMAP.md` — especially the **Resume Pointer** and **Status Table**.
2. `CLAUDE.md` — git discipline, Pulse gotchas (coral budget, design tokens, server-side Gemini, real-time dedup).
3. `C:\Users\Aegis{FM}\.claude\projects\f--pulse1\memory\MEMORY.md` — persistent project facts.

If the argument is `status`: print the Status Table + Resume Pointer and stop here.

## Step 2 — Pick the issue

```bash
gh issue list --label launch-roadmap --state open --limit 50
```
- If an issue number was passed as an argument, use it (verify it's open + has `launch-roadmap`).
- Otherwise pick the **highest-priority unblocked** issue: `priority: critical` → `high` → `medium`, and within a tier the lowest issue number. Skip any whose **Depends-on** (per the Status Table) is still open. Cross-check against the Resume Pointer's "Next up".
- Read the full issue body: `gh issue view <#>`.
- Mark it `status: in-progress` (label) and post a one-line "starting" comment so parallel sessions don't double-work it.

If the next issue is a **decision, not a code task** (e.g. #110 CALEA legal read, #113 E2EE positioning, #112 ToS review): do NOT guess. Draft a short decision doc in `docs/` laying out the options + a recommendation, then ask the human. Treat that draft as the deliverable for this run.

## Step 3 — Spawn the context-aware worker agent

Use the **Agent** tool (`general-purpose`) to implement the one chosen issue. Give it everything it needs to act without re-discovering context. The prompt MUST include:

- The full issue title + body + acceptance criteria.
- The relevant rows from the Capability Matrix + any verified file:line evidence from the issue.
- The CLAUDE.md constraints that bite for this surface (coral = AI-only; consume `--pulse-*` tokens, don't redeclare; Gemini is server-side via edge functions; trust `pulseService.subscribeToMessages` dedup; truth-in-product = flag/hide non-real surfaces for v1).
- The instruction to implement the acceptance criteria, run the relevant targeted check (`npx tsc --noEmit` filtered to touched scope, `npm run test` for affected suites), and report back a concise summary of what changed (files + why) **without committing** — the orchestrator commits.

Spawn ONE agent for ONE issue. Do not fan out across multiple issues in a single run.

## Step 4 — Review + commit (orchestrator keeps commit authority)

When the agent returns:
1. Review the diff (`git status --short`, `git diff --stat`). Sanity-check it matches the acceptance criteria and didn't touch unrelated files.
2. Run the targeted check yourself if the agent didn't (gate on **no NEW** TS errors vs the ~1,234 baseline — see memory `reference_pulse_tsc_oom`; use `NODE_OPTIONS=--max-old-space-size=8192`).
3. Commit with explicit paths (never bare `git commit`), conventional-commit form, HEREDOC body, and the trailer:
   ```
   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```
   Scope the message to the issue, e.g. `fix(sms): flag mocked SMS surface off for v1 (#100)`.
4. Push: `git push origin main`.

If acceptance is only **partially** met, commit what's solid, keep the issue open, and record the remaining work in Step 5 (don't close prematurely).

## Step 5 — Update the issue + the living doc

1. **Issue:** post a comment summarizing what shipped (with commit SHA + evidence). If fully done, `gh issue close <#>`. If blocked, swap `status: in-progress` → `status: blocked` and state the blocker.
2. **Roadmap doc** (`docs/PULSE_PRELAUNCH_ROADMAP.md`):
   - Update the issue's **Status** cell (`open`→`done`/`blocked`/`in-progress`) and **Notes**.
   - Rewrite the **Resume Pointer** block: set "Last issue worked", "Last run (date)", recompute "Next up" (next highest-priority unblocked open issue), list any new human-waiting decisions, and leave a "Notes for next run".
   - Add a dated line to the **Changelog**.
3. Commit the doc update (can be folded into the Step 4 commit if same logical unit, or a separate `docs(roadmap): ...` commit) and push.

## Step 6 — Report + stop

Print a tight summary: which issue, what shipped, commit SHA, what's next. Then STOP — one issue per invocation. Offer the human the choice to run `/launch-prep` again for the next item.

</process>

<guardrails>
- **One issue per run.** Resist scope creep into adjacent issues.
- **Never branch, never run a destructive git op** (`reset --hard`, `restore`, `clean -f`, `stash drop`, force-push to main, manual delete of files not created this run). If a fix seems to need one, STOP and ask.
- **Truth-in-product:** when the honest move is to flag/hide a non-real surface for v1, do that — don't paper over a stub with more stub.
- **Commit authority stays with the orchestrator**, not the spawned agent (the agent reports a diff; you commit it). Mirrors the Apex pipeline pattern in memory.
- **Keep the doc honest:** the Resume Pointer must always reflect reality, because it's the only state the next run trusts.
</guardrails>
