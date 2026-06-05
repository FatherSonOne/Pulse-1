---
name: deep-clean
description: "Deep clean the project root and docs — scan for clutter (screenshots, patches, temp dirs, build artifacts, stray HTML, stale handoffs/audits/session summaries), present findings grouped with per-group Archive/Delete/Skip approval, then route into organized dated archive subdirectories without breaking the app"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - TodoWrite
---

<objective>
Scan the project for clutter — stray screenshots, patch files, helper scripts, temp directories, build artifacts, stray HTML, and old/historical docs (handoffs, audits, session summaries, completed plans) — and present findings to the user grouped by category with clear reasoning for why each group is safe to remove or archive. Do NOTHING destructive without explicit per-group approval. When archiving docs, preserve the granular topic-categorization map (audits/sessions/phases/contacts/exports/...) inside the dated, recoverable archive folder. NEVER move source code, config files, or anything the app imports.
</objective>

<safety-rules>
- **ABSOLUTELY NEVER** move or delete files under `src/`, `public/`, `database/`, `supabase/`, or `node_modules/`
- **ABSOLUTELY NEVER** touch: `package.json`, `package-lock.json`, `tsconfig.*`, `vite.config.*`, `tailwind.config.*`, `postcss.config.*`, `vercel.json`, `index.html`, `index.tsx`, `index.css`, `CLAUDE.md`, `.env*`, `docker-compose.yml`, `Dockerfile`, `netlify.toml`, `nginx.conf`, `jest.config.*`, `healthcheck.sh`, `metadata.json`, `electron-builder.yml`, `LICENSE`, `THIRD_PARTY_LICENSES.csv`
- **ABSOLUTELY NEVER** touch top-level `README.md` or `CHANGELOG.md`
- **ABSOLUTELY NEVER** touch `.claude/`, `.git/`, `.github/`, `.vscode/`, `.graphify/` directories
- Before flagging ANY file, grep `src/` to confirm it is NOT imported/referenced by the app
- If unsure whether a file matters, **leave it alone and don't even list it**
- Present findings FIRST — execute ONLY after the user says what to do, per group
- Archive means move to `docs/archive/cleanup-YYYY-MM-DD/` (recoverable). Delete means gone.
- Always verify the build passes after cleanup (`npm run build`). If it breaks, restore the last batch moved and report.
</safety-rules>

<process>

## Phase 1: Silent Scan

Run these checks silently (don't dump raw output to the user). Collect results into groups.

### 1a. Root-level screenshots & images
```bash
find . -maxdepth 1 \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.webp" \) 2>/dev/null | sort
```
For each, grep src/ to check it's not referenced:
```bash
grep -r "filename.png" src/ --include="*.ts" --include="*.tsx" --include="*.css" 2>/dev/null
```

### 1b. Root-level patch files
```bash
find . -maxdepth 1 -name "*.patch" 2>/dev/null
```

### 1c. Root-level batch/powershell scripts
```bash
find . -maxdepth 1 \( -name "*.bat" -o -name "*.ps1" \) 2>/dev/null | sort
```
Check if any are referenced in package.json scripts or CI.

### 1d. Underscore temp directories (_temp, _shots, _prompts, _design-playground, etc.)
```bash
find . -maxdepth 1 -type d -name "_*" 2>/dev/null | sort
```
List contents and total size of each.

### 1e. Build/coverage output directories
```bash
for d in coverage output dist build electron-dist; do
  [ -d "$d" ] && echo "$d: $(find "$d" -type f | wc -l) files"
done
```

### 1f. Stale docs — root-level + docs/ handoffs, audits, plans, and session summaries
Scan BOTH the project root and `docs/` root for historical `.md` files. Exclude the protected
root docs (`README.md`, `CHANGELOG.md`, `CLAUDE.md`):
```bash
# Project root .md (stray plans/handoffs/audits — NOT README/CHANGELOG/CLAUDE)
find . -maxdepth 1 -name "*.md" -type f \
  -not -iname "README.md" -not -iname "CHANGELOG.md" -not -iname "CLAUDE.md" 2>/dev/null | sort
# docs/ root .md
find docs/ -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort
# count existing flat files already sitting in docs/archive/ root (candidates for re-filing)
find docs/archive/ -maxdepth 1 -type f 2>/dev/null | wc -l
```
Flag docs that are clearly historical (contain a date, or `HANDOFF`, `AUDIT`, `SESSION`,
`PHASE`, `COMPLETE`, `SUMMARY`, `PLAN`, `DESIGN` in the filename). When this group is
archived, route each file into a topic subdir (see the routing map in Phase 3) so the
archive stays browsable — don't dump them all flat.

### 1g. Planning artifacts in .planning/ that are clearly stale
```bash
find .planning/ -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort
```
Only flag files that are obviously completed/stale (e.g., contain "COMPLETE" or dates from >30 days ago). Leave active plans alone.

### 1h. Stray HTML playground files
```bash
find . -maxdepth 1 -name "*.html" -not -name "index.html" 2>/dev/null
find output/ -name "*.html" 2>/dev/null
```

## Phase 2: Present Findings

Present a clean, grouped summary table. For each group:

### Format:
```
### Group N: [Category Name]
**Files:** [count] files, ~[size estimate]
**Location:** [where they are]
**Examples:** [list 3-5 representative filenames]
**Why safe:** [1-2 sentence explanation of why these aren't needed for the app to run]
**Recommendation:** Archive to `docs/archive/cleanup-YYYY-MM-DD/[subfolder]/` | Delete | Skip

---
```

### Grouping rules:
| Group | What | Default recommendation |
|-------|------|----------------------|
| Root screenshots | `.png/.jpg/.jpeg` in project root | Archive (design reference) |
| Root patches | `.patch` files | Delete (git has the history) |
| Root scripts | `.bat/.ps1` helper scripts | Ask user (may still use them) |
| Underscore dirs | `_temp/`, `_shots/`, `_prompts/`, `_design-playground/` | Archive (design artifacts) |
| Build artifacts | `coverage/`, `output/`, `dist/`, `build/` | Delete (regenerated by build) |
| Historical docs | Dated handoffs, completed audits/plans in root or `docs/` | Archive (routed by topic) |
| Planning artifacts | Completed plans in `.planning/` | Archive |
| Stray HTML | Playground HTML files outside `src/` | Archive |

**IMPORTANT:** Only show groups where you actually found files. Skip empty groups.

After presenting, ask:
> **For each group above, tell me:** Archive, Delete, or Skip.
> You can also say "archive all" or "skip all" as a blanket.
> I won't touch anything until you decide.

## Phase 3: Execute (only after user responds)

For each group the user approved:

1. **Archive**: Create `docs/archive/cleanup-YYYY-MM-DD/[category]/` and `mv` files there
2. **Delete**: `rm` the files (only for things like coverage/ that regenerate)
3. **Skip**: Leave untouched

After each batch, echo what was moved/deleted and the count.

### Doc-categorization routing map (for the Historical docs group)

When the user approves archiving the Historical docs group, do NOT dump every `.md` into one
flat folder. Route each file into a topic subdir UNDER the dated cleanup folder so the archive
stays browsable — i.e. `docs/archive/cleanup-YYYY-MM-DD/docs/<topic>/`:

| Filename pattern | → topic subdir |
|---|---|
| `*_AUDIT_*.md`, `*_AUDIT.md` | `audits/` |
| `PHASE_*.md` | `phases/` |
| `DAY_*.md`, `SESSION_*.md`, `TODAY_*.md`, `WEEK_*.md`, `START_HERE_*.md`, `TOMORROW_*.md` | `sessions/` |
| `*_HANDOFF*.md`, `*HANDOFF*.md` | `handoffs/` |
| `QA_TEST_*.md`, `TESTING_*.md`, `TEST_*.md` | `testing/` |
| `CONTACTS_*.md`, `PULSE_CONTACT_*.md` | `contacts/` |
| `EXCEL_EXPORT_*.md`, `EXPORT_*.md`, `PDF_EXPORT_*.md` | `exports/` |
| `AI_*.md` | `ai-features/` |
| `CALENDAR_*.md`, `ENHANCED_CALENDAR_*.md` | `calendar/` |
| `DEPLOYMENT_*.md`, `GITHUB_*.md`, `PRODUCTION_*.md`, `SETUP_*.md`, `HOW_TO_*.md` | `deployment/` |
| `PERFORMANCE_*.md` | `performance/` |
| `ACCESSIBILITY_*.md`, `COLOR_*.md`, `LIGHT_MODE_*.md`, UI component docs | `ui-polish/` |
| `DOCUMENTS_*.md`, `ENHANCEMENT_*.md`, `EMAIL_*.md`, `TIMELINE_*.md` (feature integration) | `integrations/` |
| `*_PLAN_*.md`, `*_DESIGN*.md`, `*INTEGRATION_PLAN*.md` | `plans/` |
| anything else (completion/summary/checklist) | `feature-completion/` |

Create each topic subdir only when there's actually a file to put in it. If `docs/archive/`
already contains flat historical files from earlier sessions, you may offer to re-file those
into the same topic subdirs as a separate approved batch.

## Phase 4: Verify & Report

1. Run `npm run build` to confirm nothing broke
2. Remove any archive/topic subdirectories that ended up empty
3. Show a final summary:

```
## Cleanup Complete

| Action   | Category          | Files | Destination |
|----------|-------------------|-------|-------------|
| Archived | Root screenshots  | 10    | docs/archive/cleanup-2026-06-05/screenshots/ |
| Archived | Historical docs   | 23    | docs/archive/cleanup-2026-06-05/docs/<topic>/ |
| Deleted  | Coverage output   | 47    | (regenerated by tests) |
| Skipped  | Root scripts      | 5     | (left in place) |

**Build status:** ✓ Pass
**Space recovered:** ~X MB
```

4. If the build FAILS after cleanup, immediately restore the last batch moved (`mv` back) and report the issue before doing anything else.
5. If any archive directories were created, mention that the user can always recover files from `docs/archive/cleanup-YYYY-MM-DD/`.

</process>

<edge-cases>
- If a root image IS referenced by src/ code, exclude it from the list silently
- If `docs/archive/` doesn't exist yet, create it only when actually archiving
- If the user has a `creative-pipeline-demo/` or similar demo dir, ask about it separately — don't auto-classify
- If `.planning/` has active plans (no "COMPLETE" marker, recent dates), leave them alone
- Keep vital docs like user manuals and READMEs in place — never archive them
- If the build fails after cleanup, immediately restore the last batch moved and report the issue
</edge-cases>
