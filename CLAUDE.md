# Pulse — Claude Session Conventions

Pulse is a solo project. One person ships everything, sometimes with
multiple Claude sessions in flight. The rules below are tuned for
that reality — light by default, with an escalation tier for the rare
case it's actually needed.

---

## 1. Branch & session discipline

### The one rule that matters

**Commit new files and folders before walking away from them.** Every
lost-work incident in this repo has the same shape: a session created
new files, never `git add`ed them, then something (a checkout, a
worktree teardown, a window close) made them vanish. Tracked files
always survive; untracked files don't. If you create a folder, even
empty:

```bash
git add <new-folder-or-file>
git commit -m "wip: scaffold <thing>"
```

…makes it safe. You can amend or rewrite later. This single discipline
makes everything else in this section a fallback, not a tightrope.

### Default workflow (use this 95% of the time)

Single directory, feature branch, commit, push, PR, merge. No
worktrees. No `start-session.cmd`. No multi-folder dance.

```bash
cd f:/pulse1
git pull origin main
git checkout -b feat/<short-task-slug>
# ... edit, save, commit as pieces complete
# when ready to ship:
git push -u origin HEAD
gh pr create --fill          # or use /git-commit-merge slash command
# review the Vercel preview, click Merge on GitHub
git checkout main && git pull
```

Naming: `feat/...` for new work, `fix/...` for bug fixes, `refactor/...`
for restructuring. Keep the slug under ~30 chars.

Why feature branches (not pushing straight to main): cheap rollback
(`git revert <merge-sha>`), Vercel preview before merge, self-review
via the PR diff. Branch protection isn't enforced on `main` — this is
voluntary discipline, but it pays for itself the first time you ship
a regression.

### Always at session start

Two cheap commands, run them before any file changes:

```bash
git branch --show-current        # know where you are
git status --short               # note pre-existing changes — don't stage them later
```

If the working tree is dirty or you're on a branch you don't recognise,
STOP and surface to the user. Don't `git checkout` to "fix" it — that's
the actual route to lost work.

### Hard nevers (without explicit user request)

- **`git checkout -b <new-branch>`** — Claude must NOT create a new
  feature branch without an explicit user instruction to do so. Stay on
  the current branch (typically the active feature branch or main) and
  ask before branching. If multiple commits need to be sequenced as
  separate units, stack them on the existing branch and discuss
  branching strategy with the user first.
- **`git checkout <other-branch>`** mid-session with uncommitted work.
- **`git stash pop`** without confirming the stash belongs to the
  current branch.
- **`git reset --hard`** — ever, unless asked.
- **`git push --force`** to `main` — ever.

### When work seems missing (recovery checklist)

1. `git branch --show-current` — which branch are you actually on?
2. `git status --short` — note `??` files; untracked-only work only
   exists in the working tree.
3. `git reflog --oneline -30` — every HEAD movement; look for
   unexpected `checkout: moving from X to Y` entries.
4. `git log --all --oneline -- <missing-file-path>` — does the file
   live in any branch's history?
5. `git branch -a` + `git worktree list` — what branches/worktrees
   exist?
6. Surface the diagnosis to the user. Never silently `git checkout`,
   `reset`, or `clean` to recover.

### Cross-branch coordination

Use commit-level operations, never working-tree-level ones:

- `git fetch && git merge <branch>` — preferred, preserves history.
- `git cherry-pick <commit>` — surgical, specific commits only.
- NEVER do an in-place `git checkout` swap that abandons the current
  branch's uncommitted state.

---

## 2. Parallel worktrees (escalation tier — opt-in, rarely needed)

The worktree apparatus exists for one specific case: you're touching
overlapping files in two surfaces simultaneously and need them
physically isolated. **For 95% of work, skip this entirely.**

Multiple parallel Claude sessions in the same `f:/pulse1/` directory
are fine — IF every session follows the "commit before walking away"
rule above. The May 2026 incident that motivated the worktree
machinery was specifically about untracked files vanishing during a
mid-session checkout. With commits eagerly made, that failure mode
disappears.

### When a worktree is actually justified

- Long-running surface (e.g. a multi-day redesign branch) plus an
  unrelated quick fix you need to ship today, and they touch nearby
  files.
- Experimenting with a risky refactor while keeping a clean dev
  server running on a stable branch.
- The user explicitly says "spawn a worktree" / "parallel session."

If none of those apply, work in `f:/pulse1/` on feature branches.

### Spawning a worktree (when escalating)

```powershell
.\scripts\branch-safety\start-session.ps1 -Slug fix-message-overflow
# or just double-click start-session.cmd
```

```bash
./scripts/branch-safety/new-worktree.sh fix-message-overflow
```

Creates `f:/pulse1-fix-message-overflow/` on branch
`feat/fix-message-overflow` off `origin/main`, and auto-copies
gitignored `.env*` files from the source worktree so the dev server
runs out of the box. Open a fresh Claude Code window pointed at that
directory.

Tear down when the PR is merged:

```bash
git worktree remove ../pulse1-<slug>
git branch -d feat/<slug>     # only if merged
```

List active worktrees: `git worktree list`.

### The post-checkout safety banner

`.git/hooks/post-checkout` prints a loud banner on every branch swap
showing commit deltas + untracked-file count at risk. If you see it
unexpectedly, STOP and diagnose with `git reflog` before continuing.

---

## 3. Multi-PR chains

When a single task produces multiple feature-flagged PRs in sequence
(e.g. the May 2026 Messages Tools Redesign shipped PR 1 → 2 → 3a → 3b):

- **Commit each PR independently** with its own `git commit` before
  starting the next agent / step
- Commit messages should follow the existing repo style — conventional
  commits with scope, e.g. `feat(messages): ...` or `fix(billing): ...`
- Use HEREDOC for multi-paragraph commit bodies; include
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
  at the end per the harness convention
- Do NOT batch unrelated changes into one commit — keep PRs reviewable

This discipline was added after PR 3a returned BLOCKED in May 2026
because PR 1's files were never persisted between agent spawns — the
fix was to verify and commit after each agent return.

---

## 4. Pulse-specific gotchas

- **Coral as signal, not decoration.** `--pulse-coral` and its derived
  tokens (`--pulse-coral-fg`, `--pulse-coral-bg-12`, `--pulse-coral-bg-08`)
  are reserved for AI-output surfaces only (Thread Summary, Insights,
  AI provenance chips). Do not use coral for chrome, buttons, dividers,
  or general accents. See `docs/messages-tools-redesign.md` for the full
  coral budget audit.
- **Design tokens are canonical at `src/styles/pulse-tokens.css`.**
  Don't redeclare colors locally in component styles; consume via
  `var(--pulse-*)`. The `--pulse-coral` base lives in `src/App.css`.
- **Gemini routing is server-side.** All Gemini calls go through
  Supabase edge functions (`ai-router` and equivalents). Do not
  introduce direct API calls from React.
- **Pulse-to-Pulse conversation real-time** lives in
  `pulseService.subscribeToMessages` — trust the subscription's dedup
  logic; do not refetch the full message list after every send (that
  caused the May 2026 disappearing-message race).

---

## 5. Pulse-specific commands

- Type-check: `npx tsc --noEmit` (full-repo, slow). For a targeted check
  on changed files only, pipe through `grep -E "<scope>"`.
- Tests: `npm run test` (Vitest)
- E2E: `npm run test:e2e` (Playwright, requires dev server running)
- Pre-commit hooks: gitleaks scans every commit for secrets. Don't
  bypass with `--no-verify`.

---

## 6. Documentation conventions

- Spec docs live in `docs/`. Naming: `<feature>-redesign.md` for in-flight
  redesigns; `<DATE>_<feature>_HANDOFF.md` for handoffs (see
  `docs/LANDING_PAGE_HANDOFF_2026-05-15.md` for the pattern).
- The user's preferences and project memory live in
  `C:\Users\Aegis{FM}\.claude\projects\f--pulse1\memory\` — read
  `MEMORY.md` there at session start for context that persists across
  sessions.

---

**When in doubt, ask the user before making destructive or
branch-affecting changes.** The cost of a clarifying question is one
turn; the cost of a silent branch swap is hours of lost work.
