# Branch-safety scripts

Tooling that prevents parallel Claude / AI sessions from silently
clobbering each other's working tree state. See `CLAUDE.md` at the repo
root for the broader branch-discipline rules these scripts back up.

## Why this exists

Pulse has lost work three times in the May 2026 redesign window because
two Claude sessions running in parallel both manipulated the same `f:/pulse1/`
working tree. One session would `git checkout` to a different branch
mid-task; the other's uncommitted files would silently disappear from disk.
Tracked changes were always recoverable (commits don't get lost); but
new directories (`PulseComposer/`, `MessageContextMenu/`, `ToolsMenuV2/`,
~2,000 LOC at peak) only existed in the working tree and had to be
re-spawned.

These scripts make the failure mode visible (the post-checkout banner)
and provide a path to avoid it entirely (worktrees).

## What's here

| File | Purpose |
|---|---|
| `hooks/post-checkout` | Canonical source for the branch-swap banner. Print on every checkout that crosses branches; surfaces commit deltas and untracked-file count. **Not active until installed** with the installer below. |
| `install-hooks.sh` / `install-hooks.ps1` | Copy `hooks/*` into `.git/hooks/`. Run once per fresh clone. Idempotent. |
| `new-worktree.sh` / `new-worktree.ps1` | Spawn an isolated worktree directory (`f:/pulse1-<slug>/`) on a fresh feature branch. The strongest defense: parallel sessions each work in their own physical directory and physically cannot collide. |

## First-time setup (per clone)

```powershell
.\scripts\branch-safety\install-hooks.ps1
```

```bash
./scripts/branch-safety/install-hooks.sh
```

Smoke-test the banner:

```bash
git checkout -            # swap to previous branch
git checkout -            # swap back
```

You should see a `BRANCH SWAP DETECTED` block each time.

## Spawning a parallel session safely

When you want to start a second Claude / AI session on a separate task
without touching the main `f:/pulse1/` working tree:

```powershell
.\scripts\branch-safety\new-worktree.ps1 -Slug fix-message-overflow
```

```bash
./scripts/branch-safety/new-worktree.sh fix-message-overflow
```

This creates:
- Directory: `../pulse1-fix-message-overflow/` (sibling of the main repo)
- Branch: `feat/fix-message-overflow` (forked from the current branch)
- A linked worktree that shares the `.git/` directory with the main repo

Open a new Claude Code window pointed at the new directory. It will
have its own working tree, its own branch, its own running state.
Branch swaps in one session no longer affect the other.

When the task is done:

```bash
cd f:/pulse1                                       # back to main worktree
git fetch origin                                   # if you pushed
git merge feat/fix-message-overflow                # bring the work in
git worktree remove ../pulse1-fix-message-overflow # tear down the spawn
```

## Why not `core.hooksPath = scripts/branch-safety/hooks/`?

Pulse already has a gitleaks pre-commit hook + Git LFS hooks living in
`.git/hooks/`. Re-pointing `core.hooksPath` would skip them. The
installer instead copies our hooks **on top of** `.git/hooks/`, so the
gitleaks scan still runs on every commit and LFS still handles binary
checkout / push.

If the installer ever needs to coexist with a hook chain (e.g. husky
adds its own pre-commit later), update `install-hooks.sh` to append
rather than overwrite.
