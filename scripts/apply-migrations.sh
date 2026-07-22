#!/bin/bash
# Applies db/migrations/*.sql against the dockerized `db` service, tracking what's
# already been applied in a schema_migrations table. Runs entirely through
# `docker compose exec`.
set -e

cd "$(dirname "$0")/.."

COMPOSE_FILE="${DB_COMPOSE_FILE:-db/docker-compose-persistent.yml}"

run_psql() {
    docker compose -f "$COMPOSE_FILE" exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}

run_psql -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT NOW());" >/dev/null

for f in db/migrations/*.sql; do
    name=$(basename "$f")
    applied=$(run_psql -tA -c "SELECT 1 FROM schema_migrations WHERE filename = '$name';")

    if [ "$applied" = "1" ]; then
        echo "   ⏭  $name already applied"
        continue
    fi

    echo "   ▶  applying $name"
    run_psql < "$f"
    run_psql -c "INSERT INTO schema_migrations (filename) VALUES ('$name');" >/dev/null
done

echo "✅ Migrations up to date"
