#!/bin/bash
# Creates the diamond_api login role at first DB init (docker-entrypoint-initdb.d).
# Requires DMD_DB_API_PASS in the environment.
set -euo pipefail

if [ -z "${DMD_DB_API_PASS:-}" ]; then
  echo "ERROR: DMD_DB_API_PASS is not set; refusing to create the API role with a blank password." >&2
  exit 1
fi

# Pass the password as a psql variable so it is safely quoted (handles special characters).
psql -v ON_ERROR_STOP=1 -v api_pass="$DMD_DB_API_PASS" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
SELECT 'CREATE ROLE diamond_api LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'diamond_api')\gexec

ALTER ROLE diamond_api WITH LOGIN PASSWORD :'api_pass';

GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO diamond_api;
GRANT USAGE ON SCHEMA public TO diamond_api;

-- Read-only on everything that exists now and (via default privileges) on tables created later.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO diamond_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO diamond_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO diamond_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO diamond_api;
EOSQL

echo "Least-privilege role 'diamond_api' is ready."
