# GitMainCheck Skill

You are helping the user check whether `origin/main` can be safely
merged into the current feature branch — BEFORE they attempt a real
merge. Use this when running parallel sessions and you want to know:
"is it safe to pull main in right now, or will I hit conflicts?"

This is a **dry-run only** by default. It does not touch the working
tree, switch branches, or modify history.

## Hard rules

- **Read-only by default.** Never run `git merge`, `git rebase`,
  `git reset`, `git checkout <branch>`, or any tree-changing command
  unless the user explicitly confirms at the end.
- **Never run on `main` / `master`.** This command checks whether
  main can be merged INTO a feature branch, so it shouldn't run on
  main itself.
- **Don't touch the working tree.** Use `git merge-tree` (virtual
  merge) for the conflict detection, not a real `git merge` + abort.
- **Don't switch branches.** Don't `git stash`. Don't `git fetch
  origin main:main` (that updates local main without checking it
  out, but is still unnecessary side effect).

## Steps

### Step 0 — Orient

Run in parallel:
- `git rev-parse --show-toplevel`
- `git branch --show-current`
- `git status --short`

**If current branch is `main` or `master`:** STOP. Tell the user this
check is for feature branches and they should switch to one first.

**If working tree has uncommitted changes:** continue, but note in
the final report that a real `git merge origin/main` would be blocked
until they commit or stash. The dry-run itself is safe regardless.

### Step 1 — Fetch

```
git fetch origin --prune
```

If this fails (network / auth / unknown remote), STOP and surface the
exact error to the user.

### Step 2 — Compute divergence

Run in parallel:
- `git log --oneline HEAD..origin/main` — commits on main this branch lacks
- `git log --oneline origin/main..HEAD` — commits on this branch not on main
- `git merge-base HEAD origin/main` — common ancestor SHA

**Three cases:**

**Case A — Already in sync.** `HEAD..origin/main` is empty.
Print:
```
✓ Already in sync with origin/main. Nothing to merge.
   <current-branch> contains every commit reachable from origin/main.
```
Stop.

**Case B — Fast-forward possible.** `origin/main..HEAD` is empty,
`HEAD..origin/main` is non-empty. The branch hasn't diverged — it's
just behind. A real merge would be a clean fast-forward with zero
conflict possibility.

Print:
```
✓ Safe to merge — fast-forward only.
  N commits would come in from origin/main:
    <list of commits, max 10>
```
Skip to Step 5 with verdict = SAFE_FF.

**Case C — Diverged.** Both lists non-empty. A real merge would
create a merge commit, and conflicts are possible. Continue to Step 3.

### Step 3 — Identify the overlap zone

Run in parallel:
- `git diff --name-only origin/main...HEAD` — files this branch changed since the merge base
- `git diff --name-only HEAD...origin/main` — files main changed since the merge base

Compute the intersection: files both sides touched. This is the
high-risk overlap zone. Even if git auto-merges these (no textual
conflict on the same lines), it's worth flagging because semantic
conflicts (two sides editing different parts of the same function in
incompatible ways) won't show up as textual conflicts.

### Step 4 — Dry-run the merge

Use `git merge-tree` to simulate the merge without any side effects.

**Preferred form (git 2.38+):**
```
git merge-tree --write-tree --no-messages HEAD origin/main
```
- Exit code 0: clean merge. The output starts with a tree SHA.
- Exit code 1: conflicts. The output includes a tree SHA, then blank
  line, then `Auto-merging <file>` / `CONFLICT (...): Merge conflict
  in <file>` lines, then a list of conflicted entries.
- Exit code 2: usage / fatal error — fall back to legacy form.

**Legacy form (older git):**
```
git merge-tree $(git merge-base HEAD origin/main) HEAD origin/main
```
- Output empty: clean.
- Output contains `<<<<<<<` markers: conflicts. The files with
  conflicts are shown above each conflict block in the output.

Parse the output into a list of conflicted file paths.

### Step 5 — Report verdict

Always print one of three clearly-marked verdict blocks:

**SAFE (fast-forward or clean three-way merge):**
```
═══════════════════════════════════════════════════════
  ✓ SAFE TO MERGE
═══════════════════════════════════════════════════════
  origin/main → <current-branch>

  • N commits incoming
  • No textual conflicts (dry-run via git merge-tree)
  • Overlap zone (files touched by both): <count or 'none'>
      <up to 10 files>

  Recommended next step:
    git merge origin/main

  Reply 'merge now' to run the merge, or 'wait' to skip.
═══════════════════════════════════════════════════════
```

If the user replies `merge now`:
1. Re-check `git status --short` — if dirty, refuse and tell them to
   commit/stash first.
2. Run `git merge origin/main`.
3. Show the result + new ahead/behind counts.

If they reply anything else, stop.

**CONFLICTS (do not merge automatically):**
```
═══════════════════════════════════════════════════════
  ⚠ CONFLICTS DETECTED — DO NOT MERGE BLINDLY
═══════════════════════════════════════════════════════
  origin/main → <current-branch>

  • N commits incoming
  • M files have textual conflicts:
      <file1>
      <file2>
      ...

  Overlap zone (touched by both, including auto-merged):
      <list>

  Options:
    1. Pull the conflicts into your tree to resolve interactively:
         git merge origin/main
       (then resolve, git add, git commit — or git merge --abort to back out)

    2. Wait — let the other session land its work via PR first,
       then re-run /git-main-check after their merge.

    3. Coordinate: ask who's editing the conflicting files in the
       other worktree(s). If overlap is small, one of you can move
       the change to the other branch via cherry-pick instead.

  NOT running any merge automatically.
═══════════════════════════════════════════════════════
```

Stop. Do NOT offer to auto-merge when conflicts exist.

**ALREADY IN SYNC:** (case A above) Already printed in Step 2. Stop.

### Optional Step 6 — Suggest a follow-up

If the user is on a feature branch and main moved significantly
(N > 5 commits incoming), end with:
```
  Tip: consider running /git-main-check again before pushing your
  branch — main may have moved further by then.
```

## Failure modes to watch for

- **`git fetch` fails:** network / auth / unknown remote. Surface
  the error verbatim, stop.
- **`git merge-tree` not available:** falls back to legacy form
  (also `git merge-tree`, different signature). If both fail, tell
  the user their git is too old and suggest upgrading; do NOT fall
  back to a real `git merge --no-commit` because that mutates the
  index.
- **`origin/main` doesn't exist:** maybe the repo uses `master` or
  the remote is named differently. Run `git branch -r` and ask the
  user which remote branch to compare against, then retry.
- **`origin/main` is `HEAD`'s direct ancestor at fetch time:** that's
  Case A; report "already in sync".
- **Detached HEAD:** refuse. Tell the user to check out a branch first.
