# Pulse — Claude Session Conventions

Pulse is a solo project. One person ships everything, sometimes with
multiple Claude sessions in flight. The rules below are tuned for
that reality — light by default, with an escalation tier for the rare
case it's actually needed.

---

## 0. Code preservation & no-assumptions (read this first)

This is an 8-month-old project. **Code that exists was written for a
reason.** The default assumption is that any function, component,
service, table, wiring, or UI/UX surface is intentional and load-bearing
until proven otherwise. The two rules below outrank every convenience,
cleanup instinct, or "this looks redundant" impulse. They exist because
repeated sessions have over-estimated gaps, condemned working code on a
bad read, and rebuilt-from-scratch something that was more complete
before the rebuild. That is the single most expensive failure mode in
this repo and it stops here.

### Rule A — No destructive change without an explicit, approved pros/cons

**Auditing/suggesting and executing are two different acts. Never let
one slide into the other.** Finding an issue and forming a plan does
NOT grant permission to carry it out. A plan that "looks sound" is still
a proposal, not a green light.

Any time Claude is about to **remove, replace, rewrite, overwrite,
consolidate, "distill", or otherwise materially alter existing
functional code or UI/UX**, Claude MUST first STOP and present:

1. **Exactly what will change** — name the specific files, functions,
   components, styles, or surfaces that would be overwritten or deleted.
   No vague "clean up the X section." Quote the real lines.
2. **A Pros / Cons list** for the removal or replacement:
   - **Pros** — what is genuinely gained (be honest; "fewer lines" is
     rarely a real gain on its own).
   - **Cons** — what working behavior, edge-case handling, styling,
     state, or integration is put at risk or lost. Assume there IS a
     cost and go find it before writing the Cons.
3. **What is preserved vs. what is sacrificed**, and whether the
   replacement is provably at least as complete as what it replaces.
4. **An explicit ask**: "Do you want me to proceed with this specific
   removal/replacement?" Then WAIT. Do not execute until the user
   approves THAT change. Approval of a direction is not approval to
   delete.

**No aggressive distilling.** When the choice is between preserving
working code and trimming it for elegance, preserve. When in doubt,
**over-engineer rather than undercut months of progress and replace it
with slop.** Additive and reversible beats subtractive and clever.
Deleting working code is the last resort, never the opening move.

### Rule B — No assumptions; investigate before you judge

**Never assume anything about tables, columns, data shape, wiring,
control flow, or why code is written the way it is.** If something is in
doubt, looks broken, looks redundant, or "needs servicing," that is a
trigger to INVESTIGATE, not to conclude.

Before declaring a gap, a bug, missing functionality, or dead code —
and before proposing any plan that rests on that declaration:

- **Read the actual code in full**, including the files it imports,
  the files that import it, the services and hooks it calls, and the
  schema it touches. Quote the real lines that justify the conclusion.
- **Check git history** (`git log`, `git blame`, `git log -- <path>`,
  reflog) to understand *why* the code is the way it is. Apparent
  weirdness is often a deliberate fix for a past incident — find out
  before "correcting" it.
- **Verify the schema / types / signatures** against ground truth (the
  real table, the real type, the real function), never against naming
  convention or memory. Pulse's schema is deliberately inconsistent.
- **Prove the gap is real.** Do not over-estimate what's missing. A
  feature is not "incomplete" until you have confirmed in the code that
  the path genuinely does not exist — not because you didn't find it on
  a first skim. "I couldn't find it" ≠ "it isn't there."

If after a thorough examination something is still genuinely unclear,
**ask the user** rather than guessing and building on the guess. A
clarifying question costs one turn; a rebuild founded on a bad
assumption costs months.

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

### Default workflow — direct to main

**Work happens on `main`.** No feature branches, no PRs, no worktrees.
Edit, commit, push. The user owns rollback discipline (`git revert
<sha>` if a commit goes wrong).

```bash
cd f:/pulse1
git pull origin main
# ... edit, save, commit as pieces complete
git push origin main
```

Commit messages still follow conventional-commit form
(`feat(scope): ...`, `fix(scope): ...`, `refactor(scope): ...`) for
readable history. HEREDOC the body, sign with the
`Co-Authored-By: Claude Opus 4.7 (1M context)` line per the harness
convention.

Claude does NOT create branches. If a piece of work feels genuinely
PR-worthy (large refactor, risky cutover, multi-day surface), surface
that judgment to the user and ask — the user decides whether to spin
up a branch. Default is no.

### Always at session start

Two cheap commands, run them before any file changes:

```bash
git branch --show-current        # know where you are
git status --short               # note pre-existing changes — don't stage them later
```

If the working tree is dirty or you're on a branch you don't recognise,
STOP and surface to the user. Don't `git checkout` to "fix" it — that's
the actual route to lost work.

### Pause-and-verify when uncommitted work is encountered

**Any time Claude detects uncommitted work in the working tree (staged
OR unstaged OR untracked) that Claude did not author in the current
session, the default assumption is that work needs to be committed
before any new work is committed.** Claude does NOT silently work
around it, does NOT proceed assuming the user knows it's there, does
NOT begin its own commits while the user's work sits exposed.

Required flow:

1. **Pause the session** before making any new commits or destructive
   operations.
2. **Report the state** to the user: list the staged / unstaged /
   untracked paths and a one-line characterization of each
   (file size, +N/-M lines, what they look like — feature work,
   test files, scaffold, etc.).
3. **Ask the user explicitly** whether the uncommitted work needs to
   be committed first, and if so, whether Claude should commit it
   or the user will.
4. **Only proceed** with Claude's own work after the user has
   answered. If the user says "leave it, it's WIP I'm holding," then
   Claude continues but commits ONLY its own changes with explicit
   paths (`git add <my-files>` then `git commit <my-files>`, never
   `git commit` bare).

This rule exists because of the 2026-05-23 incident where staged
file deletions sitting in the working tree got swept into a Claude
commit alongside legit changes, producing a polluted commit that
needed force-push recovery. The fix is to never assume the working
tree is empty just because Claude didn't put anything there.

### Hard nevers (without explicit user request)

**Prime directive: Claude must never run a git command that can
destroy uncommitted work.** If a recovery or workflow step would
require any of the operations below, STOP and ask the user first —
even if it looks like the obvious fix. The user owns the decision
to discard work; Claude does not.

The full risk catalog (each one is forbidden without explicit
instruction):

- **`git checkout -b <new-branch>`** — never. Pulse works on `main`.
  If a task genuinely needs a branch (large refactor, risky cutover),
  surface the judgment and ask before branching.
- **`git checkout <other-branch>`** mid-session with uncommitted work
  — branch swaps where the target branch has conflicting changes to
  the same file can lose the working-tree edits (git may warn, may
  refuse, may proceed depending on the conflict shape).
- **`git stash pop`** or **`git stash drop`** without confirming the
  stash belongs to the current branch and the user actually wants it
  discarded / re-applied.
- **`git reset --hard`** — ever, unless asked. This destroys ALL
  uncommitted changes (staged AND unstaged) in the working tree.
- **`git restore <file>`** or **`git checkout -- <file>`** — discards
  unstaged changes to that specific file. Ask first.
- **`git clean -f`** / **`git clean -fd`** — deletes untracked files
  and (with `-d`) untracked directories. Per "the one rule that
  matters" up top, untracked is exactly the state most at risk;
  `git clean` formalizes the loss.
- **Manual file deletion** (`rm`, `Remove-Item`, `Delete` in IDE)
  on files Claude did not create in this session.
- **`git push --force`** / **`git push --force-with-lease`** to
  `main` — ever. To any other branch — only with explicit OK and a
  clearly stated reason (e.g. fixing a polluted commit on a
  feature branch nobody else is on).

Adjacent risk that Claude can't directly cause but should warn
about: **editor crashes lose unsaved buffer contents.** If Claude
generates a large pending change, encourage the user to save and
commit before walking away from the session.

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

- Long-running surface (e.g. a multi-day redesign) plus an unrelated
  quick fix you need to ship today, and they touch nearby files.
- Experimenting with a risky refactor while keeping a clean dev
  server running on the main canvas.
- The user explicitly says "spawn a worktree" / "parallel session."

If none of those apply, work in `f:/pulse1/` directly on `main`.

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

## 3. Multi-commit work sequences

When a single task produces a series of commits (e.g. an
impeccable critique pass shipping Action 1 → 2 → 3 → ...), all of
them land on `main` as separate commits. Branches and PRs only enter
the picture if the user explicitly asks for them.

- **Commit each unit independently** with its own `git commit` before
  starting the next step
- Commit messages should follow the existing repo style — conventional
  commits with scope, e.g. `feat(messages): ...` or `fix(billing): ...`
- Use HEREDOC for multi-paragraph commit bodies; include
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
  at the end per the harness convention
- Do NOT batch unrelated changes into one commit — keep history readable

This discipline was added after a multi-step task in May 2026 returned
BLOCKED because earlier-step files were never persisted between agent
spawns — the fix was to verify and commit after each step.

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
- **Schema-first for migrations — never guess at data structure.** Before writing ANY migration, RPC, or raw SQL that references a table/column, verify the real schema first (query `information_schema.columns`/`pg_proc` via the Supabase MCP, or read the table's migration). Do NOT infer column names or types from naming convention. Pulse's schema is inconsistent: some id columns are `text` not `uuid` (`voxer_recordings.user_id`, `tasks.user_id`, `contacts.user_id`, `emails.user_id`, etc.), some tables lack `user_id` and key off `sender_id`/`owner_id`/`created_by` (`vox_drops`, `brainstorm_sessions`, `relationships`), and triggers can block deletes (`workspace_members_protect_last_owner`). The 2026-05-31 `delete_user_account` repair took FIVE rounds because columns were guessed instead of checked. **Always dry-run a destructive migration in a rolled-back transaction (`DO $$ ... RAISE EXCEPTION 'rollback' $$`) until it completes clean, THEN apply once** — never apply-then-debug against the live function.
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
- **Always surface a new doc so it opens in one click — never make the user
  hunt for it.** Any time Claude creates or updates a document, report, or
  handoff, it MUST end that turn by presenting the file as a clickable
  markdown link **with the FULL ABSOLUTE path** (e.g.
  `[HANDOFF-foo.md](f:/pulse1/docs/deep-dives/HANDOFF-foo.md)`), not a
  path relative to the primary workspace root. This repo is opened as a
  *secondary* working root (primary is `f:\QNTM-Assets`), so root-relative
  links do NOT resolve to a clickable/open-in-editor target — only absolute
  `f:/pulse1/...` links do. Use forward slashes in the link URL. If several
  docs were written, list each as its own absolute link.
- The user's preferences and project memory live in
  `C:\Users\Aegis{FM}\.claude\projects\f--pulse1\memory\` — read
  `MEMORY.md` there at session start for context that persists across
  sessions.

---

## 7. Token & usage efficiency (read before heavy operations)

Usage telemetry (2026-06-16) showed the real cost drivers on this
project: **90% subagent-heavy sessions, 66% of usage at >150k context,
30% from the Supabase MCP connector.** The rules below target exactly
those three. They are about cost, not correctness — Rules A/B and the
schema-first/verify rules always win when they conflict.

### 7.1 Announce-before-heavy (the alert rule)

Before invoking a **token-heavy operation**, STOP and tell the user in
one line what you're about to run and the cheaper alternative you
considered, then proceed (no need to wait unless the user is watching
cost). "Heavy" means any of:

- **`list_tables` / `list_migrations` / `generate_typescript_types`**
  on the Supabase MCP — the schema is 338 tables; these dump the whole
  thing into context and it stays there all session.
- **`get_logs` / `get_advisors`** — large, only justified mid-debug.
- **Spawning 2+ subagents**, or any Workflow/`/team-plan`/Nexus fan-out.
- **`Grep` with `output_mode:"content"` and a high/zero `head_limit`**,
  or reading a file >1500 lines in full.
- A **full-repo `tsc --noEmit`** (also OOMs — see the tsc memory note).

The point is not to ask permission for routine work — it's to make the
expensive moves visible so they're a choice, not an accident.

### 7.2 MCP is sticky — prefer local, narrow, and disposable

**Every MCP tool result stays in context for the rest of the session.**
That is why Supabase alone was 30% of usage (43% by 2026-06-18 — it is
the single biggest line item and trending UP). Order of preference for
schema/data work:

1. **Read a local file** — `supabase/migrations/*.sql`, the committed
   generated types at `src/types/database.types.ts` (see below), or
   service code. For one table's shape, **`Grep` the types file for
   `table_name: {`** — surgical and cheap; do NOT read the 338-table
   file whole. File reads are cheap and can be flushed with `/compact`;
   MCP results can't be selectively removed.
2. **Narrow `execute_sql`** — `SELECT specific_cols ... LIMIT n`, or
   query `information_schema.columns WHERE table_name = 'one_table'`.
   Never `list_tables` when you need one table's shape.
3. **Full introspection (`list_tables`) only as a last resort**, and
   per 7.1 announce it first.

**The `claude.ai Supabase` connector stays DISCONNECTED by default.**
Connect it via `/mcp` only for a specific live-schema or migration task,
extract what's needed to a local file/answer, then disconnect again.
A connected MCP server's results stay in context for the whole session —
the connection itself is the cost, not just the individual call.

**Schema source of truth — `src/types/database.types.ts`.** Generated
once via `generate_typescript_types` and committed. Answer single-table
shape questions by grepping it, NOT by hitting the live MCP. Regenerate
(and re-announce per 7.1) only after a migration changes the schema.

After a necessary heavy MCP pull, suggest `/compact` to the user to
flush the result once you've extracted what you need.

### 7.3 Subagents — the 90% line item

Subagents each run their own model requests in their own context, so
they multiply cost. Before spawning:

- **Don't spawn for work you can do inline.** A single file read, a
  targeted Grep, a known-location edit — just do it. Subagents earn
  their cost on genuine fan-out (many files, parallel independent work)
  or read-heavy sweeps whose intermediate file-dumps you don't want in
  the main context.
- **Match the model to the task.** Simple search/format/lookup agents
  should run on **Haiku or Sonnet**, not Opus — pass `model: "haiku"`
  / `"sonnet"` to the Agent tool. Reserve Opus subagents for genuine
  reasoning.
- **Prefer `Explore`** (read-only, reads excerpts not whole files) for
  "where/does X exist" questions over `general-purpose`.
- **Tell the agent to return only the conclusion**, not file contents
  or transcripts — its final message is the only thing that should come
  back into your context.
- **Workflows / `/team-plan` / Nexus are opt-in.** They can spawn dozens
  of agents. Only run them when the user explicitly asked for that
  scale; otherwise describe what one would do and let the user decide.

### 7.4 Session length

66% of usage was at >150k context (77% by 2026-06-18, trending UP) —
long sessions are expensive even when cached. **`/clear` at every task
boundary, not just unrelated ones; `/compact` mid-task** when a thread
has accumulated large tool outputs you no longer need. Treat crossing
~150k context as a prompt to wrap the current thread and clear — a long
cached session is still billed, and staying under the 150k band is
cheaper than riding above it.

### 7.5 Baseline MCP servers

`.mcp.json` registers **stitch, blender, @21st-dev/magic** — none are
used in normal Pulse work, so they're pure baseline overhead. If you
notice them unused, suggest the user disable them via `/mcp` or trim
`.mcp.json` (also: their API keys are committed in plaintext there —
flag that for rotation).

---

**When in doubt, ask the user before making destructive or
branch-affecting changes.** The cost of a clarifying question is one
turn; the cost of a silent branch swap is hours of lost work.
