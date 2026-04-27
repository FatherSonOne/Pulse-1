---
name: deep-clean
description: Deep clean the project root and docs — archive stray plans, audits, session summaries, and junk files into organized subdirectories without breaking the app
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - TodoWrite
---

<objective>
Perform a meticulous cleanup of the project root and documentation folders. Move stray plan/design/audit/session documents into organized archive subdirectories. Delete junk files (Windows artifacts, orphaned test files). Verify the app still builds after cleanup. NEVER move source code, config files, or anything the app imports.
</objective>

<safety-rules>
- NEVER move or delete files under src/, public/, database/, supabase/, or node_modules/
- NEVER move package.json, tsconfig.*, vite.config.*, tailwind.config.*, vercel.json, index.html, index.tsx, index.css, CLAUDE.MD, .env*, docker-compose.yml, Dockerfile, netlify.toml, or any config file
- NEVER move .claude/, .git/, .github/, or .vscode/ directories
- Before moving ANY file, grep src/ to confirm it is NOT imported by the app
- If unsure whether a file is vital, LEAVE IT ALONE
- Always verify the build passes after cleanup (npm run build)
</safety-rules>

<process>

## Phase 1: Survey

1. List all files in the project root (excluding node_modules, dist, .git):
   ```bash
   find . -maxdepth 1 -not -name node_modules -not -name dist -not -name .git | sort
   ```

2. List all files in docs/ root (if docs/ exists):
   ```bash
   find docs/ -maxdepth 1 -type f 2>/dev/null | sort
   ```

3. Count files in docs/archive/ root (if it exists):
   ```bash
   find docs/archive/ -maxdepth 1 -type f 2>/dev/null | wc -l
   ```

4. Present a summary table to the user showing:
   - Number of stray .md files in root
   - Number of unorganized files in docs/
   - Number of flat files in docs/archive/
   - Any junk files detected (nul, *.tmp, orphaned test files)

Ask the user to confirm before proceeding. If they say go ahead, continue.

## Phase 2: Identify safe-to-move files

Categorize root-level .md files into these buckets:

| Category | Pattern Examples |
|---|---|
| Plans/Designs | `*_PLAN_*.md`, `*_DESIGN*.md`, `*INTEGRATION_PLAN*.md` |
| Audits | `*_AUDIT_*.md`, `*_AUDIT.md` |
| Session/Daily notes | `SESSION_*.md`, `TODAY_*.md`, `DAY_*.md`, `WEEK_*.md` |
| Junk/Artifacts | `nul`, `*.tmp`, `test-*.html`, `test-*.js`, `capture-*.js` |

For each file identified, grep `src/` to confirm it's not imported:
```bash
grep -r "filename" src/ --include="*.ts" --include="*.tsx" --include="*.js"
```

## Phase 3: Create archive structure

If docs/archive/ doesn't exist, create it. Create these subdirectories as needed (only if there are files to put in them):

```
docs/archive/
├── audits/          — Section audits (dated and undated)
├── phases/          — Phase completion reports (PHASE_*.md)
├── sessions/        — Daily/weekly session summaries (DAY_*, TODAY_*, WEEK_*, SESSION_*)
├── testing/         — QA tests, test reports, test matrices
├── deployment/      — Deployment guides, setup instructions, GitHub/Vercel docs
├── ai-features/     — AI integration docs, AI insights
├── calendar/        — Calendar enhancement docs
├── contacts/        — Contacts integration and redesign docs
├── exports/         — PDF/Excel export implementation docs
├── integrations/    — Feature integration docs (documents, email, timeline, etc.)
├── feature-completion/ — Checklists, completion summaries, implementation reports
├── ui-polish/       — Accessibility, color system, components, UI guides
├── performance/     — Performance audits and optimization docs
└── plans/           — Old plans moved from root (if docs/plans/ doesn't exist)
```

## Phase 4: Execute moves

Move files in batches by category. For each batch:
1. Echo what's being moved and where
2. Use `mv` to move the files
3. Report count moved

**Root cleanup:**
- Move `*_PLAN_*.md`, `*_DESIGN*.md`, `*INTEGRATION_PLAN*.md` to `docs/plans/` (create if needed)
- Delete `nul`, `test-*.html`, `test-*.js`, `capture-*.js` and other confirmed junk

**docs/ root cleanup:**
- Move `*_AUDIT_*.md` and `*_AUDIT.md` to `docs/archive/audits/`
- Move plan/design/prompt files to `docs/archive/` (appropriate subdir)
- Keep vital docs like user manuals, README in docs/ root

**docs/archive/ organization (if flat files exist):**
- Move `PHASE_*.md` to `archive/phases/`
- Move `DAY_*.md`, `SESSION_*.md`, `TODAY_*.md`, `WEEK_*.md`, `START_HERE_*.md`, `TOMORROW_*.md` to `archive/sessions/`
- Move `QA_TEST_*.md`, `TESTING_*.md`, `TEST_*.md` to `archive/testing/`
- Move `CONTACTS_*.md`, `PULSE_CONTACT_*.md` to `archive/contacts/`
- Move `EXCEL_EXPORT_*.md`, `EXPORT_*.md`, `PDF_EXPORT_*.md` to `archive/exports/`
- Move `AI_*.md` to `archive/ai-features/`
- Move `CALENDAR_*.md`, `ENHANCED_CALENDAR_*.md` to `archive/calendar/`
- Move `DEPLOYMENT_*.md`, `GITHUB_*.md`, `PRODUCTION_*.md`, `SETUP_*.md`, `HOW_TO_*.md` to `archive/deployment/`
- Move `PERFORMANCE_*.md` to `archive/performance/`
- Move `ACCESSIBILITY_*.md`, `COLOR_*.md`, `LIGHT_MODE_*.md`, UI component docs to `archive/ui-polish/`
- Move feature integration docs (DOCUMENTS_*, ENHANCEMENT_*, EMAIL_*, TIMELINE_*, etc.) to `archive/integrations/`
- Move remaining completion/summary/checklist files to `archive/feature-completion/`

## Phase 5: Verify

1. Run `npm run build` and confirm it succeeds
2. Show final directory structure:
   ```bash
   echo "=== Root .md files remaining ==="
   find . -maxdepth 1 -name "*.md" | sort
   echo ""
   echo "=== docs/ root ==="
   find docs/ -maxdepth 1 -type f 2>/dev/null | sort
   echo ""
   echo "=== archive/ subdirectories ==="
   for d in docs/archive/*/; do
     count=$(find "$d" -maxdepth 1 -type f | wc -l)
     echo "  $(basename "$d")/: $count files"
   done
   ```
3. Remove any empty archive subdirectories that got no files

## Phase 6: Report

Present a final summary table:
- Files moved (by category)
- Files deleted
- Build status (pass/fail)
- Before/after file counts for root and docs/

</process>
