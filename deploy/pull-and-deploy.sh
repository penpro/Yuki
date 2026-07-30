#!/usr/bin/env bash
set -euo pipefail

# The everyday command. Run this ON THE SERVER after pushing from local.
#
# Usage:
#   ./deploy/pull-and-deploy.sh
#   ./deploy/pull-and-deploy.sh /home/ubuntu/yuki

REPO_ROOT="${1:-$HOME/yuki}"

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "Repo root does not look like a git checkout: $REPO_ROOT" >&2
  exit 1
fi

cd "$REPO_ROOT"

echo "==> git pull"
# --ff-only so a surprise divergence stops here loudly instead of
# silently creating a merge commit on the server.
git pull --ff-only

echo ""
"$REPO_ROOT/deploy/deploy.sh" "$REPO_ROOT"
