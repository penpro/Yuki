#!/usr/bin/env bash
set -euo pipefail

# Publish the site to the nginx web root.
# Run this ON THE SERVER after pushing changes from the local machine.
#
# Usage:
#   ./deploy/deploy.sh
#   ./deploy/deploy.sh /home/ubuntu/yuki
#
# Deliberately does NOT run git pull — see deploy/README or the note at
# the bottom. Use pull-and-deploy.sh if you want both in one command.

REPO_ROOT="${1:-$HOME/yuki}"
WEB_ROOT="/var/www/yuki"

if [ ! -f "$REPO_ROOT/index.html" ]; then
  echo "index.html not found in: $REPO_ROOT" >&2
  echo "Is that the right repo root?" >&2
  exit 1
fi

echo "==> Publishing $REPO_ROOT -> $WEB_ROOT"

# --delete keeps the web root an exact mirror, so files removed from the
# repo actually disappear from the live site.
#
# The excludes matter for more than tidiness: *.pem must never reach a
# public directory, and the build scripts / feed cache have no business
# being downloadable.
sudo rsync -a --delete \
  --exclude='.git/' \
  --exclude='.gitignore' \
  --exclude='deploy/' \
  --exclude='*.py' \
  --exclude='*.pem' \
  --exclude='*.key' \
  --exclude='*.zip' \
  --exclude='.claude/' \
  --exclude='README.md' \
  --exclude='medium-feed.xml' \
  --exclude='.medium.json' \
  "$REPO_ROOT"/ "$WEB_ROOT"/

echo "==> Fixing ownership and permissions"
sudo chown -R "$USER":www-data "$WEB_ROOT"
sudo find "$WEB_ROOT" -type d -exec chmod 755 {} \;
sudo find "$WEB_ROOT" -type f -exec chmod 644 {} \;

echo "==> Verifying no secrets made it into the web root"
LEAKED=$(sudo find "$WEB_ROOT" \( -name '*.pem' -o -name '*.key' -o -name '*.ppk' -o -name '.env*' \) 2>/dev/null || true)
if [ -n "$LEAKED" ]; then
  echo "REFUSING TO CONTINUE — secret files found in the web root:" >&2
  echo "$LEAKED" >&2
  exit 1
fi
echo "    clean"

echo "==> Testing and reloading nginx"
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "==> Deployed. $(find "$WEB_ROOT" -type f | wc -l) files live."
