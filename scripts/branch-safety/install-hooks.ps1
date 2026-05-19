# scripts/branch-safety/install-hooks.ps1
#
# PowerShell installer for Pulse's tracked branch-safety hooks. Run once
# per fresh clone (or re-run any time to refresh).
#
# Why we don't use `core.hooksPath`: the gitleaks pre-commit and Git LFS
# hooks live in .git/hooks/. Pointing core.hooksPath elsewhere would
# skip them. This installer copies on top of .git/hooks/ instead so
# every protection stacks.
#
# Usage:
#   .\scripts\branch-safety\install-hooks.ps1

$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) {
    Write-Error "Not inside a git repository."
    exit 1
}

Set-Location $repoRoot

$srcDir = "scripts/branch-safety/hooks"
$dstDir = ".git/hooks"

if (-not (Test-Path $srcDir)) {
    Write-Error "$srcDir not found."
    exit 1
}

$installed = 0
Get-ChildItem -Path $srcDir -File | ForEach-Object {
    $name = $_.Name
    Copy-Item -Path $_.FullName -Destination (Join-Path $dstDir $name) -Force
    Write-Host "installed $dstDir/$name"
    $installed++
}

Write-Host ""
Write-Host "Done. $installed hook(s) installed." -ForegroundColor Green
Write-Host "Test by running:   git checkout - ; git checkout -"
Write-Host "Expected output:   a 'BRANCH SWAP DETECTED' banner each time."
