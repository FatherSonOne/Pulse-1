# TaskStart Skill

You are helping the user begin a new task on a fresh feature branch
off the latest `main`. This implements the **default-serial session
policy** from `CLAUDE.md` § 1: one Claude session per `f:/pulse1/`
working tree at a time, branched off main, PR'd to main, branch
deleted, then the next task starts.

## Usage

The user invokes `/task-start <type>/<slug>` and optionally `--worktree`.

Examples:
- `/task-start feat/voice-messages` — branch in this working tree
- `/task-start fix/login-redirect`
- `/task-start refactor/messages-extraction --worktree` — spawn a sibling worktree for parallel work

**Valid type prefixes** (matches Pulse's commit-message convention):
`feat`, `fix`, `refactor`, `chore`, `docs`, `perf`, `test`, `a11y`, `style`.

If the user omits the type prefix, default to `feat/`. If the user omits
the slug entirely, ask one focused question for it before continuing.

## Steps

1. **Read `CLAUDE.md` § 1** if you haven't already in this session. The
   branch-discipline + session-policy rules govern this entire command.

2. **Sanity-check current state.** Run in parallel:
   - `git branch --show-current`
   - `git status --short`
   - `git fetch origin main` (so we know if main has moved)

3. **If working tree is dirty** (any staged / unstaged / untracked
   files): **STOP**. List them. Ask the user to choose:
   - Commit them on the current branch first (`git add` + `git commit`)
   - Stash them (`git stash push -m "wip before task-start"`)
   - Discard them (only with explicit user confirmation — destructive)
   Do **not** auto-resolve. Wait for the user's choice, act on it,
   then return to step 4.

4. **If not on `main`:** ask the user:
   - "You're on `<branch>`. It has `<N>` commits not in main and
     `<M>` uncommitted changes. Do you want to: (a) merge it to main
     first via PR, (b) switch to main and abandon the branch, or
     (c) abort task-start?"
   - For (a), guide them through `git push -u origin <branch>` →
     `gh pr create` → `gh pr merge --merge --delete-branch`. Then
     proceed to step 5.
   - For (b), only if the branch has no unmerged work (`git branch
     --merged main` includes it).

5. **Switch to main + pull:**
   ```
   git checkout main
   git pull
   ```
   If the working tree was clean before the previous step but `git
   checkout` printed `M` warnings (modified files git was about to
   merge), STOP and surface the diagnosis — that's an unexpected
   state and the user must inspect before continuing.

6. **Parse the user's argument:**
   - If the argument contains `/`, split into `type` + `slug`.
   - If no `/`, treat the whole thing as `slug` with `type = feat`.
   - Validate `type` is in the list above; if not, ask the user to fix.
   - Validate `slug` is lowercase letters / digits / dashes, no spaces.
     If invalid, normalize and confirm the result with the user.

7. **Check branch uniqueness.** Run:
   - `git show-ref --verify --quiet refs/heads/<type>/<slug>`
   - `git ls-remote --heads origin <type>/<slug>`
   If either exists, ask the user to pick a different slug.

8. **Branch:**
   - **Default path (no `--worktree`):** `git checkout -b <type>/<slug>`
   - **`--worktree` escalation:** invoke the helper:
     - PowerShell: `.\scripts\branch-safety\new-worktree.ps1 -Slug <slug>`
     - Bash: `./scripts/branch-safety/new-worktree.sh <slug>`
     Then tell the user: "Open a new Claude Code window pointed at
     `f:/pulse1-<slug>/`. **Do not continue this session there** —
     this session stays on main in `f:/pulse1/`."

9. **Print policy reminder** (terse, one-screen):
   - Current branch: `<type>/<slug>`
   - One Claude per `f:/pulse1/` at a time (CLAUDE.md § 1)
   - **Never** `git checkout` to another branch mid-task — collision pattern
   - Commit early; new directories (untracked) vanish on branch swap
   - When the task is done: `git push -u origin <type>/<slug>` →
     `gh pr create --fill` → review → `gh pr merge --merge --delete-branch`
   - For escalation to parallel work: spawn a worktree via
     `scripts/branch-safety/new-worktree.{sh,ps1}`, never open a
     second Claude window on `f:/pulse1/`

10. **Confirm final state.** Print:
    - Branch name (must match `<type>/<slug>`)
    - HEAD commit (should match main's HEAD)
    - Working tree status (must be clean)
    - Ready-to-go message

## Important Notes

- **Never run `git reset --hard`, `git checkout --`, or `git clean -f`**
  to "resolve" dirtiness. Surface the state and ask the user. The cost
  of an unwanted reset (lost work) is high; the cost of asking is one turn.
- **Never push to main directly.** PRs only. The merge-to-main happens
  via `gh pr merge` after user review, not by direct push.
- **Do not auto-delete branches** even if they appear merged. Leave that
  for the user or a `/git-cleanup`-style explicit command.
- **If `gh` CLI is missing**, fall back to instructing the user to open
  a PR via `https://github.com/<owner>/<repo>/compare/main...<branch>`,
  but prefer `gh` everywhere it's available.
- **Commit attribution:** when this command later guides the user to
  commit, use the Pulse convention from `CLAUDE.md` § 2: conventional
  commits with scope, HEREDOC commit body, `Co-Authored-By: Claude
  Opus 4.7 (1M context) <noreply@anthropic.com>` footer.

## Mental model

The serial workflow this command implements:

```
   start         work                    finish
   ─────         ────                    ──────
   main  ──┐                          ┌─→ main
           ├──→  feat/<slug>  ────────┤
           └─→  (commit, commit, ...) ─┘
                                       (gh pr create → gh pr merge --delete-branch)
                                       (Claude session closes)

   Next /task-start begins the next loop, branched from the updated main.
```

Parallel sessions live in **sibling directories**, never overlapping:
```
   f:/pulse1/                    ← session A: feat/voice-messages
   f:/pulse1-other-thing/        ← session B: feat/other-thing (worktree)
```
They share commits via push/fetch. They never share a working tree.
