#!/usr/bin/env bash
#
# Apply database migrations from deploy/db/migrations/.
#
# Same shape as WebDevClass's runner so the two projects behave identically:
# uses `sudo mysql` (Ubuntu authenticates root over the unix socket, so no
# password lives anywhere), and tracks what's been applied in a
# schema_migrations table. Safe to rerun any time — already-applied files
# are skipped.
#
# Usage:
#   ./deploy/db/migrate.sh
#   ./deploy/db/migrate.sh some_other_db
#
# Migration files are plain .sql, named so they sort in order:
#   001_create_bookings.sql
#   002_add_notes_column.sql
#
# Exit codes:
#   0  success, including "nothing new to apply"
#   1  a migration failed, or the environment is wrong

set -euo pipefail

DB_NAME="${1:-yuki}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql client not found. Run ./deploy/provision-stack.sh first." >&2
  exit 1
fi

if ! sudo mysql -Nse "SHOW DATABASES LIKE '$DB_NAME';" | grep -q "$DB_NAME"; then
  echo "Database '$DB_NAME' does not exist." >&2
  echo "Run ./deploy/provision-stack.sh, which creates it." >&2
  exit 1
fi

# The one piece of schema that can't itself live in a numbered migration.
sudo mysql "$DB_NAME" -e "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   VARCHAR(255) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"

shopt -s nullglob
FILES=("$MIGRATIONS_DIR"/*.sql)
shopt -u nullglob

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No migrations yet in $MIGRATIONS_DIR — nothing to do."
  exit 0
fi

APPLIED=0
for f in "${FILES[@]}"; do
  name="$(basename "$f")"
  already=$(sudo mysql "$DB_NAME" -Nse \
    "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$name';")
  if [ "$already" != "0" ]; then
    continue
  fi

  echo "==> Applying $name"
  # Each migration runs in its own transaction where the statements allow it.
  # DDL in MySQL is not transactional, so a migration that half-fails can
  # leave the schema mid-change — keep each file to one logical change.
  if ! sudo mysql "$DB_NAME" < "$f"; then
    echo "FAILED: $name — database may be partially migrated. Fix before rerunning." >&2
    exit 1
  fi
  sudo mysql "$DB_NAME" -e \
    "INSERT INTO schema_migrations (filename) VALUES ('$name');"
  APPLIED=$((APPLIED + 1))
done

if [ "$APPLIED" -eq 0 ]; then
  echo "Already up to date — nothing new to apply."
else
  echo "Applied $APPLIED migration(s)."
fi
