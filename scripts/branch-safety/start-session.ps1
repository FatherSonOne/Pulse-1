# scripts/branch-safety/start-session.ps1
#
# One-step parallel-session launcher.
# Prompts for a task slug, fetches latest main, and spawns an isolated worktree
# off origin/main at ..\pulse1-<slug>\.
#
# Does NOT open a new VSCode window. The intended workflow is to add the new
# folder to an existing multi-root workspace via File -> Add Folder to Workspace.
#
# Usage:
#   .\scripts\branch-safety\start-session.ps1
#   .\scripts\branch-safety\start-session.ps1 -Slug fix-message-overflow
#   .\scripts\branch-safety\start-session.ps1 -Slug feat-quick-replies -BaseBranch origin/main
#   (or just double-click start-session.cmd in the repo root)
#
# When done with the spawned session:
#   git worktree remove ..\pulse1-<slug>

param(
    [string]$Slug = "",
    [string]$BaseBranch = "origin/main"
)

$ErrorActionPreference = "Stop"

# Resolve repo root from script location (script lives at repo\scripts\branch-safety\)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = (Resolve-Path (Join-Path $scriptDir "..\..")).Path

Set-Location $repoRoot

Write-Host ""
Write-Host "=== Pulse parallel-session launcher ===" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host ""

# Prompt for slug if not supplied
if (-not $Slug) {
    Write-Host "Pick a short task slug (letters / digits / dashes)."
    Write-Host "Examples: fix-message-overflow, feat-quick-replies, refactor-billing"
    $Slug = Read-Host "Slug"
}

if (-not $Slug) {
    Write-Error "No slug given. Aborting."
    exit 1
}

# Fetch so origin/main is current before we branch off it
Write-Host ""
Write-Host "Fetching latest from origin..." -ForegroundColor Cyan
git fetch origin --prune
if ($LASTEXITCODE -ne 0) {
    Write-Warning "git fetch failed. Continuing with whatever origin/main points at locally."
}

# Delegate to new-worktree.ps1 (handles slug normalization + branch + worktree)
& (Join-Path $scriptDir "new-worktree.ps1") -Slug $Slug -BaseBranch $BaseBranch
if ($LASTEXITCODE -ne 0) {
    Write-Error "new-worktree.ps1 failed. Aborting."
    exit $LASTEXITCODE
}

# Compute the target dir the same way new-worktree.ps1 did so we can report it
$cleanSlug = ($Slug.ToLower() -replace '[^a-z0-9-]+', '-').Trim('-')
$targetDir = (Resolve-Path (Join-Path $repoRoot "..\pulse1-$cleanSlug")).Path
$branch    = "feat/$cleanSlug"

Write-Host ""
Write-Host "Branch:    $branch  (off $BaseBranch)" -ForegroundColor Green
Write-Host "Worktree:  $targetDir" -ForegroundColor Green
Write-Host ""
Write-Host "Next: in your VSCode workspace, File -> Add Folder to Workspace -> pick" -ForegroundColor Cyan
Write-Host "  $targetDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "When the spawned session's PR is merged, tear it down with:" -ForegroundColor Gray
Write-Host "  git worktree remove '$targetDir'" -ForegroundColor Gray
Write-Host "  git branch -d $branch    # only if fully merged" -ForegroundColor Gray
Write-Host ""
