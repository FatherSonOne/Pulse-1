# TypeScript Error Burndown

> Tracking doc for issue #114 — *P2: TypeScript error burndown + CI gate on
> no-new-errors.*

## Why this exists

Vite/esbuild compile (transpile) TypeScript but **do not type-check** it. For a
long time nothing ran `tsc --noEmit` in anger, so type errors accumulated
silently. The two CI workflows that *did* invoke `tsc` (`ci.yml`,
`tests.yml`) ran a bare `npx tsc --noEmit`, which:

1. **OOMed at the default Node heap** — producing a misleading exit rather
   than a real type-check result, and
2. would have **hard-failed on the ~1,240 pre-existing errors** anyway, so the
   step was effectively meaningless.

Fixing all ~1,240 errors at once is out of scope and risky. Instead we
**froze the current error set as a baseline** and made CI fail only when a
change introduces a *new* error. The number can ratchet **down** over time;
it can never silently go **up**.

## Current baseline

- **Total: 1,240 errors** across **583 unique signatures**.
- Source of truth: `tsc-baseline.json` at the repo root (auto-generated; do
  not hand-edit).
- Captured with a full, cache-free check at an 8 GB heap
  (`NODE_OPTIONS=--max-old-space-size=8192`, `--incremental false`).

### Top error codes (the prioritized burndown targets)

| Count | Code     | Meaning                                                        |
| ----: | -------- | -------------------------------------------------------------- |
|   338 | `TS2304` | Cannot find name (missing import / undeclared global)          |
|   265 | `TS2339` | Property does not exist on type                                |
|   136 | `TS2593` | Test-globals not found (`describe`/`it`/`expect` — Vitest types)|
|   121 | `TS2322` | Type X is not assignable to type Y                             |
|   111 | `TS2307` | Cannot find module / type declarations                         |
|    48 | `TS2345` | Argument of type X not assignable to parameter Y               |
|    41 | `TS2708` | Cannot use namespace as a value                                |
|    23 | `TS2741` | Property missing in type but required                          |
|    22 | `TS2353` | Object literal may only specify known properties               |
|    19 | `TS2540` | Cannot assign to read-only property                            |
|    18 | `TS2367` | Comparison appears unintentional (non-overlapping types)       |
|    14 | `TS2551` | Property does not exist (did-you-mean spelling)                |

A large share of the count is concentrated in **test files** missing Vitest
global types (`TS2593`, `TS2304` for `describe`/`it`/`expect`/`vi`) and module
resolution (`TS2307`). These are the cheapest, highest-leverage clusters: a
single tsconfig/test-setup fix can clear dozens at once.

### Top files by error count

| Count | File                                                          |
| ----: | ------------------------------------------------------------ |
|   106 | `src/components/Messages/__tests__/ContextMenu.test.tsx`     |
|    92 | `src/components/Messages/MessagesSplitView.test.tsx`         |
|    88 | `src/components/Messages/__tests__/RadialMenu.test.tsx`      |
|    72 | `src/components/Messages/MessagesFeaturePanels.tsx`          |
|    63 | `src/components/MessageEnhancements/HoverReactionSystem.test.tsx` |
|    32 | `src/components/MessageEnhancements/ToolOverlay.tsx`         |
|    28 | `src/services/__tests__/messageChannelService.test.ts`       |
|    27 | `src/components/Messages.tsx`                                 |
|    25 | `src/components/MessageEnhancements/NetworkGraph.tsx`        |
|    19 | `src/hooks/__tests__/useHoverWithDelay.test.ts`             |
|    19 | `src/services/taskIntelligenceService.ts`                    |
|    18 | `src/components/Sidebar/Sidebar.tsx`                          |
|    17 | `src/components/LiveDashboard.tsx`                            |
|    16 | `src/services/conversationalAIService.ts`                    |
|    15 | `src/components/Relay/QuickVoxMode.tsx`                       |

> Regenerate these tables after a burndown pass:
> `node -e` over `tsc-baseline.json`, grouping signatures by code and file
> (split each signature key on `::` → `file::code::message`).

## How the gate works

The gate lives in **`scripts/tsc-baseline.mjs`** (plain ESM, no new deps).

1. It launches the local `tsc --noEmit` via `spawnSync` with an explicit argv
   (no shell — no injection surface) and
   `NODE_OPTIONS=--max-old-space-size=8192` injected into the child env, so it
   **never OOMs** and is **cross-platform** (Windows dev + Linux CI) without
   needing `cross-env`. It passes `--incremental false` (don't let the
   `tsbuildinfo` cache under-report) and `--pretty false` (stable,
   machine-parseable output).
2. tsc exits non-zero when there are errors — that's *expected*, not a script
   failure. The script parses the output regardless of exit code.
3. Each error line (`file.ts(line,col): error TSxxxx: message`) is reduced to a
   **signature**:

   ```
   <repo-relative-posix-path>::<TScode>::<normalized-message>
   ```

   - **Line/column are deliberately excluded** so that unrelated edits which
     merely shift line numbers don't trip false "new error" alarms.
   - The path is normalized to a **repo-relative POSIX path** (forward
     slashes) so the baseline is byte-identical on Windows and Linux.
   - Messages have whitespace collapsed for stability.
4. Identical `(file, code, message)` triples are **counted**. The baseline
   stores a `{ signature: count }` map plus a `total`.
5. A **NEW error** = a signature absent from the baseline, **or** a signature
   whose current count *exceeds* its baseline count. (Counting prevents the
   regression where you delete one instance of a duplicated error and add a
   different one with the same signature — the total is still enforced
   per-signature.)
6. The gate also reports any **fixed** signatures (count dropped) so a human
   knows the baseline can be tightened.

Output summary line:

```
Baseline: 1240 errors · Current: 1240 · New: 0 · Fixed: 0
```

Exit codes: `0` = no new errors; `1` = new errors (each printed with its
real `file:line:col TScode message`) or missing baseline file; `2` = tsc
could not be launched.

## Contributor workflow

- **See all errors locally:**
  ```bash
  npm run typecheck
  ```
  (full `tsc --noEmit` at 8 GB heap via `cross-env` — this lists everything,
  baseline included.)

- **The CI gate** (also runnable locally):
  ```bash
  npm run typecheck:gate
  ```
  Fails your PR only if you *added* an error vs the baseline. Both `ci.yml`
  (the **Type Check** job) and `tests.yml` (the **Code Quality Checks** job)
  run this.

- **When you FIX errors**, tighten the baseline so they can never silently
  come back:
  ```bash
  npm run typecheck:baseline   # regenerates tsc-baseline.json
  git add tsc-baseline.json    # commit the lower count
  ```

## Burndown strategy

1. **Never let the number go up.** The gate enforces this automatically — keep
   it green.
2. **Knock out the test-globals clusters first.** `TS2593` (136) plus the
   `describe`/`it`/`expect`/`vi` slice of `TS2304` (338) are almost entirely
   test files lacking Vitest global types. A single fix — adding the Vitest
   types to the tsconfig `types`/test include (e.g. `vitest/globals`) or a
   shared test tsconfig — likely clears **several hundred** errors at once.
   This is the single highest-leverage move.
3. **Then `TS2307` (111) — module resolution.** Often a handful of missing
   `@types/*` packages or path-alias gaps; fixing the root cause clears many.
4. **Then go file-by-file, highest count first** (`ContextMenu.test.tsx` 106,
   `MessagesSplitView.test.tsx` 92, `RadialMenu.test.tsx` 88 …). Single-file
   clusters are self-contained and low-risk to verify.
5. **After each pass**, run `npm run typecheck:baseline`, commit the updated
   `tsc-baseline.json`, and confirm the total dropped. Refresh the tables in
   this doc periodically so the target list stays accurate.

## Out of scope (issue #114)

Actually *fixing* the 1,240 baseline errors is **not** part of this issue — it
is explicitly deferred and risky. #114 delivers the **gate** (no new errors)
and **this tracking doc**. The burndown itself is incremental, future work.
