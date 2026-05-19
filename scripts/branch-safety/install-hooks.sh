#!/usr/bin/env bash
# scripts/branch-safety/install-hooks.sh
#
# Copies Pulse's tracked branch-safety hooks into .git/hooks/ for this
# clone. Run once per fresh clone of the repo. Idempotent — safe to
# re-run; existing hook is replaced with the canonical tracked version.
#
# Why we don't just use `core.hooksPath = scripts/branch-safety/hooks`:
# the gitleaks pre-commit hook and the LFS hooks live in .git/hooks/
# already, and pointing core.hooksPath at our directory would skip
# them. This installer copies on top of .git/hooks/ instead so all
# protection stacks.
#
# Usage:
#   ./scripts/branch-safety/install-hooks.sh

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$repo_root" ]; then
  echo "error: not inside a git repository."
  exit 1
fi

cd "$repo_root"

src_dir="scripts/branch-safety/hooks"
dst_dir=".git/hooks"

if [ ! -d "$src_dir" ]; then
  echo "error: $src_dir not found."
  exit 1
fi

installed=0
for hook in "$src_dir"/*; do
  [ -f "$hook" ] || continue
  name=$(basename "$hook")
  cp "$hook" "$dst_dir/$name"
  chmod +x "$dst_dir/$name"
  echo "installed $dst_dir/$name"
  installed=$((installed + 1))
done

echo ""
echo "Done. $installed hook(s) installed."
echo "Test by running:   git checkout - && git checkout -"
echo "Expected output:   a 'BRANCH SWAP DETECTED' banner each time."
