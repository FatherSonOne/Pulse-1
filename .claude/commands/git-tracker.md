---
name: git-tracker
description: Track the current plan/implementation as a GitHub Issue + keep repo docs (README/CHANGELOG/docs) updated as work progresses
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
---

<objective>
Establish or update GitHub-side tracking for the work happening in this session — so every plan or implementation has a paper trail (Issue, checklist, doc updates, commit links) without the user having to remember to file it manually.

This is the user's on-ramp to GitHub best-practices: nothing slips through the cracks, future-you can trace any change back to its plan, and the repo's README/CHANGELOG/docs stay in sync with what actually shipped.
</objective>

<when_to_invoke>
Run this command at three natural beats during a session:

1. **At the start of a non-trivial task** — once a plan exists or an implementation has begun (more than ~2 files touched, or a feature/bugfix the user described in a sentence). Creates the tracking Issue.
2. **Mid-implementation** — after a meaningful chunk of work lands. Updates Issue checklist + posts a progress comment.
3. **At session end / before push** — finalizes the Issue, links commit SHAs, updates docs (README section, CHANGELOG entry, relevant docs/ pages), and either closes the Issue (if work is done) or leaves it open with clear next steps.

Skip for: trivial typo fixes, single-line config tweaks, exploratory throwaway work the user explicitly says is not going to ship.
</when_to_invoke>

<process>

## Step 1 — Establish context

Determine what's being tracked in this session. In order of preference:

1. The **active plan** (if `ExitPlanMode` was used or a plan doc exists at `docs/plans/`, `.claude/plans/`, or similar)
2. The **session goal** the user stated explicitly ("we're adding X", "fix the Y bug")
3. The **diff signal** — what's modified in `git status` + recent commits on this branch since it diverged from `main`

Run:
```bash
git rev-parse --abbrev-ref HEAD
git status --short
git log main..HEAD --oneline 2>/dev/null || git log -10 --oneline
gh repo view --json nameWithOwner -q .nameWithOwner
```

Verify `gh auth status` succeeds before any GitHub write. If unauthenticated, stop and tell the user to run `gh auth login`.

### Conventional Commits + label conventions

Best-practice prefixes (use in Issue title, commit messages, PR title):
`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Standard label set (create with `gh label create <name> --color <hex>` if missing):
`type: feature` `type: bug` `type: refactor` `type: docs` `type: chore` ·
`priority: low` `priority: medium` `priority: high` ·
`status: in-progress` `status: blocked` `status: needs-review`.

Apply at minimum a `type:` label and `status: in-progress` when the Issue is created.

## Step 2 — Find or create the tracking Issue

Search for an existing Issue first to avoid duplicates:

```bash
gh issue list --state all --search "<short-task-keywords> in:title" --limit 5
```

Also check the current branch name — if it follows `feat/<slug>` or `fix/<slug>`, search for issues mentioning that slug.

**If a matching Issue exists**, use it. Note its number (`#NNN`).

**If no matching Issue exists**, create one:

```bash
gh issue create \
  --title "<Type>: <concise summary, ≤70 chars>" \
  --body "$(cat <<'EOF'
## Goal
<one-paragraph what & why — pulled from the plan/session context>

## Scope
- [ ] <task 1 derived from plan or staged changes>
- [ ] <task 2>
- [ ] <task 3>

## Out of scope
- <anything explicitly deferred>

## Plan reference
<link to plan doc if one exists, or paste the plan summary>

## Branch
`<current-branch-name>`

---
*Tracked via /git-tracker*
EOF
)" \
  --label "<type-label>" \
  --assignee "@me"
```

Type-label conventions: `feature`, `bug`, `refactor`, `chore`, `docs`. Create the label with `gh label create` if it doesn't exist (don't fail loudly).

Capture the new issue number from the URL in stdout. Store it for the rest of the session — if you'll need to reference it later, save the number to `.claude/.git-tracker-issue` (gitignored) so subsequent invocations pick it up automatically:

```bash
echo "<issue-number>" > .claude/.git-tracker-issue
```

## Step 3 — Update Issue progress

When invoked mid-implementation or at session end, sync the Issue's checklist with what's actually been done.

1. Read the current Issue body: `gh issue view <N> --json body -q .body`
2. For each `- [ ]` item, decide if it's now complete (look at git diff, recent commits, files modified). Flip to `- [x]`.
3. If new sub-tasks emerged that weren't in the original scope, append them.
4. Update the body:
   ```bash
   gh issue edit <N> --body "$(cat <<'EOF'
   <updated body with checked items>
   EOF
   )"
   ```
5. Post a progress comment summarizing what changed since last update:
   ```bash
   gh issue comment <N> --body "$(cat <<'EOF'
   ### Progress update
   - <bullet of what landed>
   - <commit SHAs: $(git log --oneline -5 --format='%h %s')>

   **Files touched:** <count> · **Net lines:** +<add>/-<del>
   EOF
   )"
   ```

## Step 4 — Update repo documentation

Walk these in order; only touch a file if its scope actually changed:

1. **README.md** — if the change adds/renames a feature, env var, or command surface that's documented there, update the relevant section. Use `Grep` first to find the section.
2. **CHANGELOG.md** (or `CHANGELOG/`, `docs/changelog/`) — add an entry under `## [Unreleased]` with: Keep-a-Changelog category (`Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`), short description, and `(#<issue-number>)` link. Create the file with a Keep-a-Changelog header if missing.

   **Filter — only add a CHANGELOG entry if the change is user-facing.** Skip for: internal refactors, test-only changes, CI/build tweaks, dev-tooling, code comments, dependency bumps without behavior change. If unsure, ask: "would a user / API consumer notice this on release notes?" If no, skip.
3. **docs/** — if there's a docs page that maps to the affected subsystem (e.g. `docs/auth.md` for an auth change), update it. Don't invent new docs files unless the user asked for them.
4. **CLAUDE.md** — only update if the change introduces a new convention or invariant future Claude sessions need to know. Don't pad it with feature notes.

For each updated doc, stage it but do NOT auto-commit — leave staging to the user's commit flow (`/git-commit` or manual).

## Step 5 — Link commits and PR

If commits exist on the current branch since the Issue was created:

1. Add the issue reference to commit messages going forward. Use `Refs #<N>` for in-progress commits and `Closes #<N>` (or `Fixes #<N>`) on the commit/PR that completes the work — GitHub auto-closes the Issue when a `Closes`-tagged PR merges. Don't rewrite existing commits.
2. **Open a Draft PR early** (best practice for visibility) once at least one commit is on the branch and it's pushed:
   ```bash
   gh pr create --draft --fill --body "Closes #<N>"
   ```
   Draft PRs surface CI status and allow inline review without signaling "ready to merge". Mark ready with `gh pr ready <PR#>` when done.
3. If a PR already exists (`gh pr view --json number,body 2>/dev/null`), make sure its description references the Issue. Edit the PR body if missing:
   ```bash
   gh pr edit <PR#> --body "<existing body>

   Closes #<N>"
   ```

## Step 6 — Final summary

Report to the user:
- Issue number + URL
- Checklist progress (e.g. "3/5 items done")
- Docs updated (list paths)
- Linked commits/PR
- Next action: continue work, push, open PR, or close Issue

If work is finished and merged, close the Issue:
```bash
gh issue close <N> --comment "Shipped in <commit-sha-or-PR-link>"
```

</process>

<rules>
- **Never fabricate Issue numbers, PR numbers, or commit SHAs.** Always verify with `gh` / `git` before referencing.
- **Never force-push, rewrite history, or close another user's Issue.** This command only writes to its own tracking Issue.
- **Idempotent**: re-running mid-session must not duplicate Issues or comments. The `.claude/.git-tracker-issue` cache + the title search in Step 2 prevents duplicates.
- **Fail soft on missing `gh` auth or missing remote** — print what would have been done and stop, don't error out the session.
- **Don't auto-commit doc changes.** Stage them; let the user's commit flow handle the message.
- **Respect existing CHANGELOG/README conventions** — read the file first, match its style, don't impose Keep-a-Changelog if the project uses something else.
- **Skip on detached HEAD or unpushable branches** unless the user confirms.
</rules>

<output_format>
End with a compact status block:

```
📋 Issue:    #<N> <title>          <url>
✅ Progress: <done>/<total> items   (<percent>%)
📝 Docs:     <list of updated files, or "none">
🔗 Linked:   <PR #M> · <commit-shas>
➡  Next:     <one-line next action>
```
</output_format>
