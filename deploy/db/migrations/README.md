# Migrations

Empty on purpose — nothing the site serves today needs a database.

Drop `.sql` files here when there's something to store. Name them so they
sort in the order they must run:

```
001_create_bookings.sql
002_add_notes_column.sql
```

Then on the server:

```bash
cd ~/yuki && ./deploy/db/migrate.sh
```

The runner records each filename in `schema_migrations` and skips anything
already applied, so re-running is always safe.

Two rules worth keeping:

**One logical change per file.** MySQL doesn't roll DDL back, so a file that
fails halfway leaves the schema partly changed. Small files make that
recoverable.

**Never edit a migration that has run.** It won't re-apply, so the file and
the live schema silently diverge. Write a new migration instead.
