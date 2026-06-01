# Triage Repair — From Damage Report to Sequenced Repair Plan

Take a forensic triage report produced by `/section-triage` and turn it into a
**finely-tuned, approved repair plan with a recommended launch order**. Input
(optional): **$ARGUMENTS** — a path to a triage report, or a section name, or
empty (auto-discover the latest).

This is a **planning** tool, not an execution tool. It reads the damage report,
re-verifies that the damage is still real, converts each finding into a concrete
work item, surfaces the genuine design/direction forks to the user, and
recommends the order to ship them. It does **not** start changing code until the
user explicitly approves the plan — and then only one gated item at a time.

**Output:** `docs/triage/<section>-repair-plan-<date>.md`

---

## Why This Exists

`/section-triage` produces ground truth about what's broken. That report is an
*assessment*, not a *plan*. Acting on it directly invites exactly the failure
mode CLAUDE.md Rule A exists to prevent: a finding that "looks sound" slides
straight into a destructive edit. This tool inserts the missing step — it
develops the plan, forces the pros/cons and design decisions into the open,
gets the user's direction, and sequences the work so foundations land before
the things that depend on them.

It is the bridge between "here's the damage" and "here's what we do about it, in
what order, with your sign-off."

---

## Operating Rules (read before anything else)

These outrank convenience. They are CLAUDE.md Rules A & B applied to repair
planning:

1. **Plan, don't execute.** This command's deliverable is a written, approved,
   sequenced plan. Do NOT remove, rewrite, overwrite, consolidate, or materially
   alter functional code while running it, unless the user has approved that
   specific item and explicitly asked to proceed. Approval of the *plan's
   direction* is not approval to *delete*.
2. **Re-verify before you plan.** A triage report is a snapshot. Code may have
   changed since it was written; the report itself may have over- or
   under-estimated a finding. Before building a work item on any finding —
   especially the high-stakes ones — re-open the actual file and confirm the
   finding still holds. Quote the real current lines. If a finding is stale,
   say so and drop or revise it.
3. **No assumptions.** Verify tables/columns/types/wiring against ground truth,
   not the report's prose and not naming convention. Pulse's schema is
   deliberately inconsistent.
4. **Surface the forks; let the user choose.** Many findings have more than one
   legitimate resolution (build vs cut, restore vs rebuild, reconnect vs remove,
   activate vs leave). Do NOT silently pick. Batch these into explicit decision
   points and ask.
5. **Every destructive item carries a Rule-A pros/cons** in the plan: exactly
   what changes (real files/lines), pros, cons (assume there IS a cost and go
   find it), what's preserved vs sacrificed, and proof the replacement is at
   least as complete. Additive and reversible beats subtractive and clever.
6. **Verification is part of every item.** Each work item names how it will be
   verified (tsc on changed scope / build / the specific test). "Done" later
   will require that evidence actually ran.

---

## Phase 0: Locate & Load the Triage Report

1. Resolve the input:
   - If `$ARGUMENTS` is a file path → use it.
   - If `$ARGUMENTS` is a section name (e.g. "Messages") → look for
     `docs/triage/<section>-triage-*.md`.
   - If empty → list `docs/triage/*.md`, newest first.
2. If exactly one obvious match → use it (state which). If several (e.g. multiple
   dates for the same section) → ask the user which report to work from.
3. If none exist → tell the user to run `/section-triage <section>` first. Stop.
4. **Read the entire report.** Note its date. Internalize the Executive Summary,
   the per-bucket findings (Solid/Cracked/Severed/Stub/Gutted/Orphan/Dormant),
   the Connection Map, the UI Surface Audit, and the report's own Repair Priority
   Queue (you will pressure-test and re-sequence it, not just copy it).

---

## Phase 1: Re-Verify Ground Truth (the report is a snapshot)

The report could be hours or weeks old. Before planning:

1. **Check drift.** `git log --oneline -15 -- <section files>` since the report's
   date. If commits touched the section after the report, flag which findings
   they might invalidate and re-read those specifically.
2. **Re-confirm the high-stakes findings** by opening the real files and quoting
   current lines — at minimum every CRITICAL / latent-crash / data-loss finding,
   and any finding whose repair would be destructive (Gutted/Orphan/Severed). Use
   parallel subagents if there are many.
3. **Mark each finding** as `CONFIRMED` (still true), `STALE` (already fixed /
   no longer present — drop it), or `CHANGED` (true but different now — revise).
4. Produce a short "verification delta" — what changed between the report and now.
   If nothing material changed, say so explicitly.

Do not plan a repair on a finding you could not re-confirm. If you can't confirm
and can't refute, that's a question for the user, not a guess.

---

## Phase 2: Convert Findings → Repair Work Items

Map each confirmed finding to a **repair archetype**. The triage label implies a
default archetype, but several have forks (those become Phase 3 questions):

| Triage label | Default repair archetype | Fork to ask about |
|---|---|---|
| `[SOLID]` | **Leave it.** Do not touch. | — |
| `[CRACKED]` | **Targeted repair** — fix the specific break (bad import / wrong shape / missing prop / silent fail). Smallest change that restores intended behavior. | Usually none — but if "intended behavior" is ambiguous, ask. |
| `[SEVERED]` | **Reconnect** the wiring (route / import / context / handler). | Reconnect **or** remove? (Is it worth reviving?) |
| `[STUB]` | **Build it for real** (wire to service/table) **or cut it**. | Core vs nice-to-have → build now, defer, or remove the placeholder? |
| `[GUTTED]` | **Restore vs rebuild** — recover the prior version from git (cite the gutting commit) or rebuild fresh. | Restore old code **or** rebuild? Which is provably more complete? |
| `[ORPHAN]` | **Confirm-then-decide** — delete (with Rule-A pros/cons) **or** revive **or** leave. | Delete / revive / leave — needs explicit user call. |
| `[DORMANT]` | **Activate** (flag flip / mount / route) **or leave dormant**. | Activate now, activate behind flag, or leave? |

Then **cluster** related findings into coherent work items (don't make 60 atomic
tickets). A work item groups findings that touch the same file/subsystem and
should ship together. For each item capture:
- **Title** + the finding IDs it addresses.
- **Files/lines** (real, current).
- **Archetype** + chosen approach (or "pending decision" if it's a Phase-3 fork).
- **Complexity**: TRIVIAL (<5 min) / MODERATE (<30 min) / COMPLEX (>30 min).
- **Dependencies**: which other items must land first; what breaks if this stays broken.
- **Blast radius / cascade risk**: what else this touches.
- **Verification**: the exact check that proves it works.
- **Rule-A block** (only for destructive items): change / pros / cons / preserve
  vs sacrifice / completeness proof.

---

## Phase 3: Surface the Design & Direction Decisions

This is the heart of the command — the "ask the user along the way" step. Collect
every fork from Phase 2 and present them as **batched decision points** (use the
question tool; group related decisions, don't fire one prompt per finding). For
each decision give: the finding, the realistic options, the trade-off of each,
and a recommendation with reasoning. Typical forks:

- **Architectural forks** — e.g. "two surfaces render the same components; do we
  (A) wire the visible one to real data, (B) remove it and surface the hidden
  real one, or (C) cut the feature?" Show the concrete consequence of each.
- **Build vs cut** for every STUB that's in the live path (mock data shipping to
  users is the loudest signal — but the user owns the scope call).
- **Restore vs rebuild** for GUTTED code (offer the specific commit to revert/
  cherry-pick).
- **Delete vs keep** for ORPHANs (never propose deletion without the Rule-A
  pros/cons and a re-confirmation that it's truly unreferenced).
- **Activate vs leave** for DORMANT code and feature flags.
- **Scope/goal of this pass** — ask early: is this a *launch-blocker triage only*,
  a *quick-wins sweep*, or a *full restoration*? The answer reshapes the launch
  order and what gets cut vs built.

Record every answer (and any notes) verbatim into the plan doc so the decisions
are auditable later.

---

## Phase 4: Write the Finely-Tuned Repair Plan

Compile everything into the output doc. Structure:

```markdown
# <Section> Repair Plan — <Date>
Source report: docs/triage/<section>-triage-<date>.md (read <date>)

## 0. Verification Delta
What changed between the triage report and now; which findings are
CONFIRMED / STALE / CHANGED.

## 1. Decisions Taken
Each Phase-3 fork, the options, and the user's choice (+ rationale/notes).

## 2. Work Items
One subsection per item: title, findings addressed, files/lines, archetype +
approach, complexity, dependencies, blast radius, verification step, and — for
destructive items — the full Rule-A pros/cons / preserve-vs-sacrifice block.

## 3. Launch Order (see Phase 5)

## 4. Out of Scope / Deferred
What we deliberately are NOT doing this pass, and why (so a future session
doesn't mistake it for missed work).

## 5. Verification Strategy
The build/type-check/test commands that gate the whole plan, and the
per-item checks. Note the repo's ~1234 pre-existing tsc errors → gate on
"no NEW errors", and the 8GB heap flag.
```

The plan must be **specific** — "fix the unread count" is useless; "in
pulseService.getUnreadCount (:625) the `head:true` query returns `data=null`;
return `count ?? 0` instead of `data?.length`; verify with a targeted tsc on
services + the unread-badge test" is useful.

---

## Phase 5: Recommend Launch Order

Sequence the work items into an execution order and explain the reasoning. Order
by, in priority:

1. **Foundation value** — items that unblock other items go first. Build the
   dependency graph; topologically sort it.
2. **User impact / cascade risk** — guaranteed crashes, data loss, and
   live-path mock data outrank cosmetic fixes.
3. **Fix complexity** — when impact is equal, trivial quick-wins first (momentum
   + cheap risk reduction).
4. **Reversibility** — additive/reversible items before subtractive/destructive
   ones; destructive items land late, after their dependents are stable and the
   user has signed off.

Present it as:
- A **dependency graph** (which items block which).
- A **sequenced table**: order | item | category | complexity | why here | unblocks.
- **Waves/milestones** — group the sequence into shippable batches (e.g.
  "Wave 1: stop-the-bleeding trivial fixes", "Wave 2: the architectural fork",
  "Wave 3: build-or-cut the stubs", "Wave 4: orphan cleanup"). Each wave should
  leave the section in a committable, verifiable state.
- A note on what each wave **commits** (per CLAUDE.md: commit each unit; don't
  batch unrelated changes).

---

## Phase 6: Hand-Off — Ask Before Executing

End the planning session by:

1. Presenting the plan + launch order summary.
2. Confirming the output doc is written (and, per CLAUDE.md, offering to commit
   it — `docs/triage/*.md` is tracked).
3. Asking explicitly: **"Do you want me to begin Wave 1 now?"** If yes, execute
   **one item at a time**, each with its own Rule-A confirmation for destructive
   changes, its own verification run (report the real output), and its own
   commit. If no, stop — the plan stands on its own for a later session.

Never roll from "plan approved" into deleting working code without the per-item
gate. The plan is the green light to *propose* each change in turn, not to carry
them all out unattended.

---

## Guiding Principles

- **The report is an input, not gospel.** Re-verify; the codebase is the truth.
- **Forks belong to the user.** Build-vs-cut, restore-vs-rebuild, delete-vs-keep
  are product/design calls — present trade-offs, recommend, but let the user decide.
- **Preserve by default.** When a fork is "trim for elegance" vs "keep working
  code," lean keep. Over-engineer rather than undercut months of progress.
- **Sequence for safety.** Foundations and reversible wins first; destructive
  and load-bearing changes last, after their blast radius is understood and approved.
- **Plan in units that commit.** Every wave leaves a clean, verified, committable state.
- **No silent scope creep.** Anything deferred goes in "Out of Scope" in writing.
