#!/usr/bin/env bash
set -euo pipefail

# Install backend dependencies, run migrations, and start or restart the
# node process under PM2. Run ON THE SERVER after pushing.
#
#   ./deploy/deploy-backend.sh
#   ./deploy/deploy-backend.sh /home/ubuntu/yuki
#
# Safe to re-run: npm ci is deterministic, migrations skip what's applied,
# and pm2 restart picks up new code and new env values.

REPO_ROOT="${1:-$HOME/yuki}"
BACKEND_DIR="$REPO_ROOT/backend"
PM2_NAME="yuki-backend"

if [ ! -f "$BACKEND_DIR/package.json" ]; then
  echo "package.json not found in: $BACKEND_DIR" >&2
  exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
  cat >&2 <<EOF
$BACKEND_DIR/.env does not exist.

  cp $BACKEND_DIR/.env.example $BACKEND_DIR/.env

then fill in DB_PASSWORD and SESSION_SECRET. Generate a secret with:

  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
EOF
  exit 1
fi

# Re-assert owner-only perms every deploy. Free when already correct, and
# cheap insurance if the file is ever restored from a backup or recreated.
chmod 600 "$BACKEND_DIR/.env"

echo "==> Applying database migrations"
"$REPO_ROOT/deploy/db/migrate.sh"

echo ""
echo "==> Installing backend dependencies"
cd "$BACKEND_DIR"
# npm ci is preferred — it installs exactly what the committed lockfile says.
# But it hard-fails if package.json and the lockfile have drifted, which is
# what happens the first deploy after a dependency is added and the lockfile
# wasn't regenerated. Falling back to npm install means a dependency change
# can't silently leave the old code running with the new package.json.
if [ -f package-lock.json ] && npm ci --omit=dev --silent 2>/dev/null; then
  echo "    installed from lockfile"
else
  echo "    lockfile missing or out of sync — falling back to npm install"
  npm install --omit=dev --silent
fi

echo "==> Starting backend under PM2"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start server.js --name "$PM2_NAME" --update-env
fi
pm2 save --force >/dev/null

# The app binds 127.0.0.1 and exits non-zero if it can't reach MySQL, so a
# short wait then a health check catches a bad deploy here rather than
# leaving a dead process that nginx 502s against.
echo "==> Waiting for the backend to come up"
sleep 3
PORT_NUM="$(grep -E '^PORT=' "$BACKEND_DIR/.env" | cut -d= -f2 | tr -d ' ' || true)"
PORT_NUM="${PORT_NUM:-3001}"

if curl -sf --max-time 5 "http://127.0.0.1:${PORT_NUM}/api/testimonials" >/dev/null; then
  echo "    backend responding on 127.0.0.1:${PORT_NUM}"
else
  echo "" >&2
  echo "BACKEND IS NOT RESPONDING. Recent logs:" >&2
  pm2 logs "$PM2_NAME" --lines 25 --nostream >&2 || true
  exit 1
fi

echo ""
pm2 list
