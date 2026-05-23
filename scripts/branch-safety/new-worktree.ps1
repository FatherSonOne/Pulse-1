# scripts/branch-safety/new-worktree.ps1
#
# PowerShell wrapper around `git worktree add` for parallel-Claude-safety.
# Spawns an isolated working tree at f:/pulse1-<slug>/ on a fresh feature
# branch so two Claude sessions can never collide in the same working tree.
#
# Usage:
#   .\scripts\branch-safety\new-worktree.ps1 -Slug fix-message-overflow
#   .\scripts\branch-safety\new-worktree.ps1 -Slug feat-quick-replies -BaseBranch main
#
# Remove a worktree when done:
#   git worktree remove f:\pulse1-<slug>
#
# List live worktrees:
#   git worktree list

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Slug,

    [Parameter(Position = 1)]
    [string]$BaseBranch = ""
)

$ErrorActionPreference = "Stop"

if (-not $BaseBranch) {
    $BaseBranch = (git rev-parse --abbrev-ref HEAD).Trim()
}

# Normalize slug: lowercase, alphanumeric + dashes only, trim leading/trailing dashes.
$cleanSlug = ($Slug.ToLower() -replace '[^a-z0-9-]+', '-').Trim('-')

if (-not $cleanSlug) {
    Write-Error "Slug normalized to empty string. Use letters / digits / dashes."
    exit 1
}

$branch = "feat/$cleanSlug"
$targetDir = "..\pulse1-$cleanSlug"

# Guard: branch already exists?
$existingBranch = git show-ref --verify --quiet "refs/heads/$branch"; $exists = $?
if ($exists) {
    Write-Host "error: branch '$branch' already exists. Pick a different slug,"
    Write-Host "       or attach the existing branch to a new worktree with:"
    Write-Host "       git worktree add '$targetDir' '$branch'"
    exit 1
}

# Guard: target directory already exists?
if (Test-Path $targetDir) {
    Write-Error "Directory '$targetDir' already exists. Pick a different slug."
    exit 1
}

Write-Host ""
Write-Host "Creating worktree:" -ForegroundColor Cyan
Write-Host "  branch:    $branch  (off $BaseBranch)"
Write-Host "  directory: $targetDir"
Write-Host ""

git worktree add -b $branch $targetDir $BaseBranch

if ($LASTEXITCODE -ne 0) {
    Write-Error "git worktree add failed."
    exit $LASTEXITCODE
}

# Copy env files (.env*) from source worktree into the new one.
# These are gitignored by design, so `git worktree add` does NOT carry
# them along — but every parallel session needs them to run the dev
# server. Copying them here avoids the silent "Available VITE_ vars:
# none" surprise on first npm run dev.
$sourceRoot = (git rev-parse --show-toplevel).Trim()
$envFiles = @(Get-ChildItem -Path $sourceRoot -Filter ".env*" -File -Force -ErrorAction SilentlyContinue)
if ($envFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Copying env files from source worktree (gitignored, don't follow spawns):" -ForegroundColor Cyan
    foreach ($f in $envFiles) {
        Copy-Item -LiteralPath $f.FullName -Destination $targetDir -Force
        Write-Host "  $($f.Name)"
    }
}

Write-Host ""
Write-Host "Done. To start a parallel Claude session there:" -ForegroundColor Green
Write-Host "  cd '$targetDir'"
Write-Host "  # then open a new Claude Code window pointed at this directory"
Write-Host ""
Write-Host "List all worktrees:        git worktree list"
Write-Host "Remove this one when done: git worktree remove '$targetDir'"
