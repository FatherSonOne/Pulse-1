# Pulse — Claude Session Conventions

These rules are mandatory for every Claude session working in this repo.
The branch-discipline section is at the top because we have lost work
twice to silent branch swaps during parallel sessions.

---

## 1. Branch discipline (MANDATORY — read first)

### At session start, BEFORE any file changes:

1. **Check the branch.** Run `git branch --show-current` as one of the
   first commands of any non-trivial session.
2. **Check working-tree state.** Run `git status --short` — note any
   pre-existing untracked or modified files so you don't accidentally
   stage them later.
3. **If the task is anything more than a 1-line read-only question,
   create a dedicated feature branch:**
   ```
   git checkout -b feat/<short-task-slug>
   ```
   Naming convention: `feat/...` for new work, `fix/...` for bug fixes,
   `refactor/...` for restructuring. Keep the slug under ~30 chars.

### During the session:

- **NEVER run `git checkout <other-branch>` mid-session** unless the
  user explicitly asks for it. Switching branches with uncommitted work
  silently discards anything that lives in the working tree but isn't
  in git's tracked state for the new branch — which is how PR 1's
  ~2000 LOC vanished in May 2026.
- **NEVER run `git stash pop`** without first confirming the current
  branch matches the branch the stash was created on.
- **NEVER run `git reset --hard`** unless the user explicitly asks for it.
- **Commit early, commit often.** After each substantial change
  (one PR-shaped commit), `git add` + `git commit`. Uncommitted files
  are at risk; committed files are safe. See § Multi-PR chains below.

### At session end (or when the user requests):

- Push the branch: `git push -u origin <branch-name>`
- Open a PR from that branch to `main` (or wherever the user directs)
- Do NOT merge into another in-flight branch unless the user explicitly
  asks for it

### If you find work missing (recovery checklist):

1. `git branch --show-current` — which branch are you actually on?
2. `git branch -a` — list all branches (local + remote)
3. `git reflog --oneline -30` — recent HEAD movements; look for unexpected
   `checkout: moving from X to Y` entries
4. `git log --oneline --all -- <missing-file-path>` — find which branch
   has the missing file in its history
5. Surface the diagnosis to the user before taking recovery actions;
   never silently `git checkout` to recover

### Parallel sessions:

Multiple Claude sessions may be working in this repo simultaneously
(e.g. one writing tests on a fix branch while another redesigns a
feature on a refactor branch). **The strongest defense is to give each
session its own physical working tree directory** so they can never
clobber each other (see "Worktree workflow" below).

If two sessions must share a working tree, each must stay on its own
branch. If you need work from another branch:

- `git merge <other-branch>` (preserve both histories) — preferred
- `git cherry-pick <commit>` (specific commits only) — surgical
- NEVER do an in-place `git checkout` swap that abandons the
  current branch's uncommitted state

### Worktree workflow (recommended for parallel sessions):

Instead of switching branches in-place within `f:/pulse1`, spawn an
isolated working tree at a sibling directory. Each Claude session
opens its own directory; they share commits via push/fetch, never
through working-tree state.

Helper script (preferred):

```powershell
.\scripts\branch-safety\new-worktree.ps1 -Slug fix-message-overflow
```

```bash
./scripts/branch-safety/new-worktree.sh fix-message-overflow
```

Creates `f:/pulse1-fix-message-overflow/` on branch
`feat/fix-message-overflow`. Open a fresh Claude Code window pointed
at that directory and the session is fully isolated from any work
happening in `f:/pulse1/`.

Manual equivalent:

```bash
git worktree add -b feat/<slug> ../pulse1-<slug> main
```

When done with a worktree:

```bash
git worktree remove ../pulse1-<slug>
```

List active worktrees: `git worktree list`.

### The post-checkout safety banner:

`.git/hooks/post-checkout` is configured to print a loud banner on
every branch swap, showing:
- previous → new branch, with short SHAs
- the new tip commit
- commit deltas in both directions (lost / gained)
- a warning if another session might have uncommitted work that just
  vanished from the working tree
- count of untracked files at risk of loss on the next swap

If you see that banner unexpectedly, STOP — diagnose with `git reflog`
before taking further action.

---

## 2. Multi-PR chains

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

## 3. Pulse-specific gotchas

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

## 4. Pulse-specific commands

- Type-check: `npx tsc --noEmit` (full-repo, slow). For a targeted check
  on changed files only, pipe through `grep -E "<scope>"`.
- Tests: `npm run test` (Vitest)
- E2E: `npm run test:e2e` (Playwright, requires dev server running)
- Pre-commit hooks: gitleaks scans every commit for secrets. Don't
  bypass with `--no-verify`.

---

## 5. Documentation conventions

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
