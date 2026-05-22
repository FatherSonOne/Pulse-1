# GitCommitMerge Skill

You are helping the user take a worktree (or feature branch) from "work
finished locally" through "merged into main and cleaned up", pausing at
every step that requires a human decision.

This command is the formal version of the flow documented in CLAUDE.md
§ Branch discipline and § Multi-PR chains. Follow it exactly — do not
shortcut, do not batch destructive steps, do not assume.

## Hard rules

- **Never** run `git checkout <other-branch>`, `git reset --hard`,
  `git stash pop`, or `git push --force` (without `--force-with-lease`)
  unless the user explicitly approves it in this session.
- **Never** merge into anything other than the user's stated target
  branch (default: `main`). Confirm if unclear.
- **Never** delete branches or worktrees until the PR is confirmed merged.
- **Always** show the user the exact command you're about to run before
  running anything destructive or anything that affects the remote, and
  PAUSE for explicit confirmation.
- If anything looks off (unexpected branch, dirty tree, unknown
  commits), STOP and surface the diagnosis. Do not "fix" it silently.

## Step 0 — Orient

Run in parallel:
- `git rev-parse --show-toplevel` (what directory are we in)
- `git branch --show-current` (what branch)
- `git worktree list` (which worktree this is, are there others)
- `git status --short` (what's uncommitted)
- `git log --oneline origin/main..HEAD` (commits ahead of main on this branch)
- `git log --oneline HEAD..origin/main` (commits on main we don't have)

Report a one-block summary to the user:
```
Worktree:  <path>
Branch:    <branch>  (N commits ahead of main, M commits behind)
Uncommitted: <count> files
Other worktrees: <count>
```

**If branch is `main` or `master`**: STOP. This command must not run
on the trunk branch. Tell the user to switch to / spawn a feature
branch first (`start-session.cmd`).

**If working tree is clean AND branch is 0 commits ahead of main**:
There is nothing to commit or merge. STOP and tell the user.

## Step 1 — Review what will be committed

Run `git status` and `git diff --stat` (and `git diff` if the user
wants detail). Show the user:
- Modified / added / deleted files
- Any files that look sensitive (`.env*`, `*.pem`, `*.key`,
  `credentials*.json`, `service-account*.json`, files containing
  obvious API key patterns)

**PAUSE 1 — confirm scope.** Ask the user:
> "Here's what's staged/unstaged. Do you want me to commit ALL of
> this, only specific files, or skip files? Reply with: 'all',
> 'only <file1> <file2>', or 'skip <file1>'."

Do NOT use `git add -A` or `git add .` blindly. Always stage the
specific files the user confirmed. Re-check `git status` after staging.

**If any sensitive file is staged**: STOP loudly and ask the user
to confirm explicitly before continuing.

## Step 2 — Draft the commit message

Look at recent commits on this branch (`git log --oneline -10`) to
match the repo's existing style. CLAUDE.md says: conventional commits
with scope, e.g. `feat(messages): ...`, `fix(billing): ...`. For
multi-paragraph bodies, use HEREDOC. End with:
```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Draft a message focused on the WHY, not the what. Show it to the user.

**PAUSE 2 — confirm commit message.** Ask:
> "Proposed commit message below. Reply 'ok' to use as-is, or paste a
> replacement / edit."
>
> ```
> <full proposed message>
> ```

When confirmed, run the commit with HEREDOC syntax (per CLAUDE.md
convention). Show the resulting commit SHA + first line back to the user.

## Step 3 — Sync with origin/main

This is the conflict-prevention step. Pull main into this branch
locally so any merge conflict is resolved here, not in the GitHub UI.

Run:
- `git fetch origin --prune`
- `git log --oneline HEAD..origin/main` (what's coming in)

**If main is ahead of this branch**, show the user the incoming
commits and ask:

**PAUSE 3 — choose merge or rebase.** Ask:
> "origin/main is N commits ahead. Pick one:
>   1. **merge** origin/main into this branch  (default, safe, adds a merge commit)
>   2. **rebase** this branch onto origin/main  (linear history, requires force-push)
>   3. **skip**  (push as-is, resolve any conflict on GitHub)
> Reply 1, 2, or 3."

Default to option 1 if unclear.

- For **merge**: run `git merge origin/main`.
- For **rebase**: run `git rebase origin/main`. Note that the next
  push will need `--force-with-lease` (NOT plain `--force`).
- For **skip**: continue to Step 4.

### Step 3a — If there are conflicts

If the merge/rebase reports conflicts:
- Run `git status` to list conflicted files.
- Surface the list to the user.
- **PAUSE 3a — conflict resolution.** Ask:
  > "Conflicts in: <files>. Want me to:
  >   1. Open each conflict, propose a resolution, you approve each
  >   2. Abort the merge/rebase and you'll resolve manually
  > Reply 1 or 2."
- For option 1: for each file, show the conflict markers, propose a
  resolution, get explicit user confirmation, then `git add` it.
  Repeat for all files. When done, complete the merge with
  `git commit --no-edit` (merge) or `git rebase --continue` (rebase).
- For option 2: run `git merge --abort` or `git rebase --abort` and
  STOP. Tell the user to resolve and re-run `/git-commit-merge`.

## Step 4 — Push the branch

Show the user the exact push command:
- First push: `git push -u origin <branch>`
- Subsequent push (no rebase): `git push`
- Subsequent push (after rebase): `git push --force-with-lease`

**PAUSE 4 — confirm push.** Ask:
> "About to run: `<command>`. This makes your work visible on GitHub.
> Reply 'ok' to push, or 'no' to stop here."

When confirmed, run it. Report success + the URL GitHub prints for
opening a PR.

## Step 5 — Open the PR

Check if a PR already exists:
```
gh pr view <branch> --json url,state,title 2>&1
```

**If a PR already exists** for this branch: show its URL + state.
Skip to Step 6.

**If no PR exists**: draft a title and body. Title under 70 chars.
Body should follow the repo convention (look at a recent merged PR
for the template — typically Summary + Test plan sections).

Draft:
```
Title: <draft>

Body:
## Summary
- <bullet 1>
- <bullet 2>

## Test plan
- [ ] <test 1>
- [ ] <test 2>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**PAUSE 5 — confirm PR.** Ask:
> "Proposed PR title + body below. Reply 'ok' to create, or paste
> edits. Also confirm base branch (default: `main`)."

When confirmed, create with HEREDOC:
```bash
gh pr create --base main --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

Report the PR URL.

## Step 6 — Wait for merge (user-driven)

**PAUSE 6 — hand off to user.** Tell the user:
> "PR is open at <URL>. I'll wait here. Steps now in your hands:
>   1. Review the PR on GitHub
>   2. Wait for CI checks to pass
>   3. Click Merge (whatever merge style your repo uses — squash / merge / rebase)
>   4. Come back here and reply 'merged' when done — or 'closed' if
>      you closed it without merging, or 'wait' to keep the worktree."

Do NOT poll, do NOT auto-merge, do NOT proceed past this until the
user replies.

When the user replies 'merged', verify with:
```
gh pr view <branch> --json state,mergedAt
```
If `state` is not `MERGED`, surface the discrepancy and ask again.

If 'closed' or 'wait' — STOP. Do not delete anything.

## Step 7 — Tear down (only after confirmed merge)

This step touches the main `f:\pulse1\` worktree. If we are currently
inside a spawned worktree (Step 0 showed a path other than
`f:\pulse1\`), the user needs to switch terminals.

**PAUSE 7 — switch terminals.** Tell the user:
> "PR is merged. Cleanup runs in the MAIN `f:\pulse1\` worktree, not
> this one. Open a terminal there (or a Claude session in that
> window) and I'll print the commands you should run. Or, if you're
> already in the main worktree, reply 'here' and I'll run them."

If the user says 'here', verify with `git rev-parse --show-toplevel`
that we are in fact in `f:\pulse1\` (not the spawned worktree). If
not, refuse and re-prompt.

When in the main worktree, run sequentially (each with brief
confirmation):
1. `git fetch origin --prune`
2. Show the user the worktree to remove + branch to delete:
   ```
   Worktree: <path-to-spawned-worktree>
   Branch:   <feat/...>
   ```
3. **PAUSE 7a — confirm teardown.** Ask:
   > "About to run:
   >   git worktree remove '<path>'
   >   git branch -d <branch>     (safe delete — refuses if unmerged upstream)
   > Reply 'ok' to proceed, or 'keep' to leave the worktree in place."
4. On 'ok', run both. If `git branch -d` refuses (unmerged), surface
   the warning and ask the user explicitly before falling back to
   `git branch -D` (force delete).
5. Run `git worktree list` and show the final state.

## Summary at the end

Print a 3-line wrap-up:
- PR # / URL (merged at <timestamp>)
- Branch deleted: <name>
- Worktree removed: <path>

Done.

---

## Failure modes to watch for

- **Uncommitted changes when running**: surface them, never discard.
- **Branch already pushed with different commits (non-fast-forward push)**:
  STOP. Show the user `git log --oneline origin/<branch>..HEAD` and
  `git log --oneline HEAD..origin/<branch>`. Ask before any force-push.
- **PR base branch ≠ user's intended target**: confirm before creating.
- **CI failures on PR**: surface them when the user reports 'merged' /
  asks for status. Don't paper over.
- **Worktree path doesn't match branch name**: harmless but worth a
  one-line note in the summary.
