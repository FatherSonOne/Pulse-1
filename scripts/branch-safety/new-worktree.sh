#!/usr/bin/env bash
# scripts/branch-safety/new-worktree.sh
#
# Spawn a fresh, isolated working tree on its own feature branch — the
# parallel-Claude-session-safe alternative to switching branches in-place
# within f:/pulse1. Each worktree has its own physical directory, so no
# two sessions can ever clobber each other's working tree state.
#
# Usage:
#   ./scripts/branch-safety/new-worktree.sh <task-slug> [base-branch]
#
# Examples:
#   ./scripts/branch-safety/new-worktree.sh fix-message-overflow
#   ./scripts/branch-safety/new-worktree.sh feat-quick-replies main
#
# The new worktree lives at  f:/pulse1-<task-slug>/  on branch
# feat/<task-slug>  forked from <base-branch> (defaults to current).
#
# When you're done with a worktree:
#   git worktree remove f:/pulse1-<task-slug>
#
# List all live worktrees:
#   git worktree list

set -euo pipefail

slug="${1:-}"
base_branch="${2:-$(git rev-parse --abbrev-ref HEAD)}"

if [ -z "$slug" ]; then
  echo "usage: $0 <task-slug> [base-branch]"
  echo "       slug becomes feat/<slug>; directory becomes ../pulse1-<slug>"
  exit 1
fi

# Normalize slug — letters / digits / dashes only.
clean_slug=$(echo "$slug" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-' | sed 's/^-*//;s/-*$//')
if [ -z "$clean_slug" ]; then
  echo "error: slug normalized to empty string. Use letters/digits/dashes."
  exit 1
fi

branch="feat/${clean_slug}"
target_dir="../pulse1-${clean_slug}"

# Guard: branch already exists?
if git show-ref --verify --quiet "refs/heads/${branch}"; then
  echo "error: branch '${branch}' already exists. Pick a different slug,"
  echo "       or attach the existing branch to a new worktree with:"
  echo "       git worktree add '${target_dir}' '${branch}'"
  exit 1
fi

# Guard: target directory already exists?
if [ -e "${target_dir}" ]; then
  echo "error: directory '${target_dir}' already exists. Pick a different slug."
  exit 1
fi

echo "Creating worktree:"
echo "  branch:    ${branch}  (off ${base_branch})"
echo "  directory: ${target_dir}"
echo ""

git worktree add -b "${branch}" "${target_dir}" "${base_branch}"

echo ""
echo "Done. To start a parallel Claude session there:"
echo "  cd '${target_dir}'"
echo "  # then open a new Claude Code window pointed at this directory"
echo ""
echo "List all worktrees:  git worktree list"
echo "Remove this one when done:  git worktree remove '${target_dir}'"
